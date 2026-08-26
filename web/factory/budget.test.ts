// @vitest-environment node

import { describe, expect, it } from "vitest";

import { BudgetExceededError, BudgetLedger, estimateUsageMicroCny, microCnyToCny } from "./budget.ts";
import { parseFactoryArgs } from "./config.ts";

const usage = {
  inputTokens: 1_000_000,
  cachedInputTokens: 250_000,
  outputTokens: 1_000_000,
  reasoningTokens: 200_000,
};

describe("候选工厂预算账本", () => {
  it("区分缓存命中、未命中输入与输出价格", () => {
    const config = parseFactoryArgs([], { cwd: "/repo/web", env: { DEEPSEEK_CNY_PER_USD: "10" } });
    const micro = estimateUsageMicroCny(usage, config.pricingUsdPerMillion, config.cnyPerUsd);
    expect(microCnyToCny(micro)).toBeCloseTo((0.25 * 0.0028 + 0.75 * 0.14 + 0.28) * 10, 5);
  });

  it("在请求前同时执行阶段上限和总上限", () => {
    const config = parseFactoryArgs(["--max-cny", "0.02"], { cwd: "/repo/web", env: {} });
    const ledger = new BudgetLedger(config);
    expect(() => ledger.reserve("generation", usage)).toThrow(BudgetExceededError);
  });

  it("按真实 usage 结算并让缓存命中保持零成本", () => {
    const config = parseFactoryArgs([], { cwd: "/repo/web", env: {} });
    const ledger = new BudgetLedger(config);
    const reservation = ledger.reserve("generation", usage);
    ledger.commit(reservation, {
      cacheKey: "request-1",
      role: "generator",
      usage: { inputTokens: 100, cachedInputTokens: 0, outputTokens: 50, reasoningTokens: 0 },
    });
    ledger.recordCacheHit({ cacheKey: "request-1", phase: "generation", role: "generator" });
    expect(ledger.records).toHaveLength(2);
    expect(ledger.records[0]?.estimatedMicroCny).toBeGreaterThan(0);
    expect(ledger.records[1]?.estimatedMicroCny).toBe(0);
    expect(ledger.reservedMicroCny).toBe(0);
  });

  it("释放失败请求的预算预留", () => {
    const config = parseFactoryArgs([], { cwd: "/repo/web", env: {} });
    const ledger = new BudgetLedger(config);
    const reservation = ledger.reserve("generation", usage);
    expect(ledger.reservedMicroCny).toBeGreaterThan(0);
    ledger.release(reservation);
    expect(ledger.reservedMicroCny).toBe(0);
  });
});

