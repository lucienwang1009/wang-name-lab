// @vitest-environment node

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { runFactoryCli } from "./cli.ts";
import type { StructuredRequest } from "./deepseek.ts";
import type { FactoryModelGateway } from "./pipeline.ts";
import type { LoadedFactoryCorpus } from "./corpus.ts";
import type { AdversarialReview, CandidateProposal, FactoryPassage, NameReview, SemanticReview } from "./types.ts";

const temporaryDirectories: string[] = [];
const passage: FactoryPassage = {
  id: "shi-jing/1",
  bookId: "shi-jing",
  bookTitle: "《诗经》",
  category: "经",
  period: "先秦",
  workTitle: "烝民",
  chapterTitle: "大雅",
  text: "柔嘉维则，令仪令色。",
  normalizedText: "柔嘉维则令仪令色",
  sourceUrl: "https://example.test/source",
  verificationUrl: "https://example.test/verify",
  score: 100,
};
const corpus: LoadedFactoryCorpus = {
  corpusVersion: "fixture-v1",
  books: [{ id: "shi-jing", title: "《诗经》", category: "经", period: "先秦", priority: 1 }],
  passages: [passage],
};

async function directory() {
  const value = await mkdtemp(join(tmpdir(), "factory-cli-"));
  temporaryDirectories.push(value);
  return value;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function fakeGateway(): FactoryModelGateway {
  return {
    async structured<T>(request: StructuredRequest<T>) {
      if (request.role === "candidate-generator") {
        return [{
          proposalId: "fixture:令仪",
          givenName: "令仪",
          relation: "exact-phrase",
          sources: [
            { character: "令", passageId: passage.id, occurrence: 0 },
            { character: "仪", passageId: passage.id, occurrence: 0 },
          ],
          extraction: "连续取字",
          meaning: "端美的仪度",
          rationale: "完整",
          imageryCategory: "仪范",
          familyConnection: "",
        } satisfies CandidateProposal] as T;
      }
      const input = request.input as { candidates?: Array<{ proposalId: string }>; finalists?: Array<{ proposalId: string }> };
      const candidates = input.candidates ?? input.finalists ?? [];
      if (request.role === "anonymous-semantic-reviewer") {
        return candidates.map((item): SemanticReview => ({ proposalId: item.proposalId, decision: "approve", semanticScore: 0.9, evidenceScore: 0.9, explanation: "成立", risks: [] })) as T;
      }
      if (request.role === "name-sound-aesthetic-reviewer") {
        return candidates.map((item): NameReview => ({
          proposalId: item.proposalId,
          decision: "approve",
          scores: { phonology: 0.9, nameFeel: 0.9, femininity: 0.9, usability: 0.9, distinctiveness: 0.8 },
          primaryStyle: "graceful",
          pronunciationNote: "自然",
          usabilityNote: "可用",
          uncommonnessNote: "少见",
          risks: [],
        })) as T;
      }
      return candidates.map((item): AdversarialReview => ({ proposalId: item.proposalId, decision: "approve", critique: "无致命问题", fatalIssues: [] })) as T;
    },
  };
}

function paths(root: string) {
  return [
    "--corpus-root", "fixture-corpus",
    "--approved-output", join(root, "corpus/generated/approved.json"),
    "--preview-output", join(root, "public/data/generated.json"),
    "--reports-root", join(root, "reports"),
    "--cache-root", join(root, "cache"),
    "--checkpoint-root", join(root, "checkpoints"),
  ];
}

describe("本地候选工厂 CLI", () => {
  it("默认 dry-run 不需要 Key、不调用模型且返回零远程请求", async () => {
    const root = await directory();
    const gateway = { structured: vi.fn() } as unknown as FactoryModelGateway;
    const result = await runFactoryCli([...paths(root), "--run-id", "dry-run"], {
      cwd: root,
      env: {},
      loadCorpus: async () => corpus,
      gateway,
      log: vi.fn(),
    });
    expect(result.mode).toBe("dry-run");
    expect(result.dryRunPlan).toMatchObject({ remoteRequests: 0, selectedPassages: 1 });
    expect(gateway.structured).not.toHaveBeenCalled();
  });

  it("显式 live 后原子写出候选、报告、清单和检查点", async () => {
    const root = await directory();
    const result = await runFactoryCli([
      ...paths(root),
      "--live",
      "--run-id", "live-run",
      "--target", "1",
      "--passages-per-book", "1",
    ], {
      cwd: root,
      env: {},
      loadCorpus: async () => corpus,
      gateway: fakeGateway(),
      now: () => new Date("2026-08-26T00:00:00Z"),
      log: vi.fn(),
    });
    expect(result).toMatchObject({ mode: "live", publishedCount: 1, estimatedCostCny: 0 });
    const approved = JSON.parse(await readFile(join(root, "corpus/generated/approved.json"), "utf8")) as { candidates: Array<{ fullName: string }> };
    expect(approved.candidates[0]?.fullName).toBe("王令仪");
    await expect(readFile(join(root, "reports/live-run/review-report.json"), "utf8")).resolves.toContain("published");
    await expect(readFile(join(root, "reports/live-run/manifest.json"), "utf8")).resolves.toContain("deepseek-v4-flash");
    await expect(readFile(join(root, "checkpoints/live-run.json"), "utf8")).resolves.toContain("fixture-v1");
  });

  it("真实客户端在 live 模式缺少 Key 时失败且不生成发布文件", async () => {
    const root = await directory();
    await expect(runFactoryCli([
      ...paths(root),
      "--live",
      "--run-id", "missing-key",
      "--target", "1",
      "--passages-per-book", "1",
    ], {
      cwd: root,
      env: {},
      loadCorpus: async () => corpus,
      log: vi.fn(),
    })).rejects.toThrow(/DEEPSEEK_API_KEY/);
    await expect(readFile(join(root, "corpus/generated/approved.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("smoke 模式强制最高 1 元预算", async () => {
    const root = await directory();
    const logs: string[] = [];
    await runFactoryCli([
      ...paths(root),
      "--smoke",
      "--run-id", "smoke-run",
      "--max-cny", "20",
    ], {
      cwd: root,
      env: {},
      loadCorpus: async () => corpus,
      gateway: fakeGateway(),
      log: (message) => logs.push(message),
    });
    expect(logs.join("\n")).toContain("budget<=1.00 CNY");
  });
});
