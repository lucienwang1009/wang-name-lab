// @vitest-environment node

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { BudgetLedger } from "./budget.ts";
import { parseFactoryArgs } from "./config.ts";
import { DeepSeekClient, type FactoryFetch } from "./deepseek.ts";
import { JsonFileCache } from "./storage.ts";

const temporaryDirectories: string[] = [];

async function setup(fetcher: FactoryFetch, apiKey = `sk-${"x".repeat(24)}`) {
  const directory = await mkdtemp(join(tmpdir(), "deepseek-client-"));
  temporaryDirectories.push(directory);
  const config = parseFactoryArgs([], { cwd: "/repo/web", env: {} });
  const ledger = new BudgetLedger(config);
  const sleep = vi.fn(async () => undefined);
  return {
    config,
    ledger,
    sleep,
    client: new DeepSeekClient({
      config,
      ledger,
      apiKey,
      fetcher,
      cache: new JsonFileCache(directory),
      sleep,
      timeoutMilliseconds: 2_000,
    }),
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function apiResponse(value: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      status: "completed",
      output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }],
      usage: {
        input_tokens: 100,
        input_tokens_details: { cached_tokens: 20 },
        output_tokens: 30,
        output_tokens_details: { reasoning_tokens: 5 },
      },
    }),
    text: async () => "",
  };
}

const request = {
  phase: "generation" as const,
  role: "generator",
  instructions: "生成结构化候选",
  input: { passages: [] },
  schemaName: "fixture",
  schema: { type: "object", properties: { ok: { type: "boolean" } } },
  parse(value: unknown) {
    if (typeof value !== "object" || value === null || typeof (value as { ok?: unknown }).ok !== "boolean") {
      throw new TypeError("invalid fixture");
    }
    return value as { ok: boolean };
  },
  maxOutputTokens: 100,
  reasoningEffort: "none" as const,
};

describe("DeepSeek Responses API 客户端", () => {
  it("发送指定模型、JSON Schema 和禁用思考的本地请求", async () => {
    const fetcher = vi.fn<FactoryFetch>(async (_input, _init) => apiResponse({ ok: true }));
    const { client, ledger } = await setup(fetcher);
    await expect(client.structured(request)).resolves.toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("https://api.deepseek.com/responses");
    const body = JSON.parse(init?.body ?? "{}") as Record<string, any>;
    expect(body).toMatchObject({
      model: "deepseek-v4-flash",
      reasoning: { effort: "none" },
      text: { format: { type: "json_schema", name: "fixture" } },
      store: false,
    });
    expect(init?.headers.Authorization).toMatch(/^Bearer sk-/u);
    expect(ledger.records[0]?.usage).toMatchObject({ inputTokens: 100, cachedInputTokens: 20, outputTokens: 30 });
  });

  it("命中缓存时不再发送请求", async () => {
    const fetcher = vi.fn<FactoryFetch>(async (_input, _init) => apiResponse({ ok: true }));
    const { client, ledger } = await setup(fetcher);
    await client.structured(request);
    await client.structured(request);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(ledger.records.at(-1)?.cached).toBe(true);
  });

  it("缓存原始 JSON，解析器返回转换结果时仍可再次命中", async () => {
    const fetcher = vi.fn<FactoryFetch>(async (_input, _init) => apiResponse({ items: ["令仪"] }));
    const { client, ledger } = await setup(fetcher);
    const transformingRequest = {
      ...request,
      parse(value: unknown) {
        if (
          typeof value !== "object" ||
          value === null ||
          !Array.isArray((value as { items?: unknown }).items)
        ) throw new TypeError("items missing");
        return (value as { items: string[] }).items;
      },
    };
    await expect(client.structured(transformingRequest)).resolves.toEqual(["令仪"]);
    await expect(client.structured(transformingRequest)).resolves.toEqual(["令仪"]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(ledger.records.at(-1)?.cached).toBe(true);
  });

  it("对 429 有界退避，但对鉴权错误不重试", async () => {
    let calls = 0;
    const retryingFetcher = vi.fn<FactoryFetch>(async (_input, _init) => {
      calls += 1;
      return calls === 1
        ? { ok: false, status: 429, json: async () => ({}), text: async () => "limited" }
        : apiResponse({ ok: true });
    });
    const retrying = await setup(retryingFetcher);
    await expect(retrying.client.structured(request)).resolves.toEqual({ ok: true });
    expect(retryingFetcher).toHaveBeenCalledTimes(2);
    expect(retrying.sleep).toHaveBeenCalledTimes(1);

    const authFetcher = vi.fn<FactoryFetch>(async (_input, _init) => ({
      ok: false,
      status: 401,
      json: async () => ({}),
      text: async () => "bad bearer",
    }));
    const auth = await setup(authFetcher);
    await expect(auth.client.structured(request)).rejects.toThrow(/401/);
    expect(authFetcher).toHaveBeenCalledTimes(1);
  });

  it("incomplete 会按实际 usage 计费并扩大输出上限后重试", async () => {
    let calls = 0;
    const fetcher = vi.fn<FactoryFetch>(async (_input, _init) => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: "incomplete",
            incomplete_details: { reason: "max_output_tokens" },
            output: [],
            usage: { input_tokens: 50, output_tokens: 100 },
          }),
          text: async () => "",
        };
      }
      return apiResponse({ ok: true });
    });
    const { client, ledger, sleep } = await setup(fetcher);
    await expect(client.structured(request)).resolves.toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(ledger.records).toHaveLength(2);
    expect(ledger.records[0]?.usage).toMatchObject({ inputTokens: 50, outputTokens: 100 });
    expect(ledger.records[1]?.phase).toBe("retry");
    const firstBody = JSON.parse(fetcher.mock.calls[0]?.[1].body ?? "{}") as { max_output_tokens?: number };
    const secondBody = JSON.parse(fetcher.mock.calls[1]?.[1].body ?? "{}") as { max_output_tokens?: number };
    expect(firstBody.max_output_tokens).toBe(100);
    expect(secondBody.max_output_tokens).toBe(200);
  });

  it("结构化输出解析失败时只进行一次定向修复", async () => {
    let calls = 0;
    const fetcher = vi.fn<FactoryFetch>(async (_input, _init) => {
      calls += 1;
      if (calls === 1) {
        return {
          ...apiResponse({ ok: true }),
          json: async () => ({
            status: "completed",
            output: [{ type: "message", content: [{ type: "output_text", text: "{broken" }] }],
            usage: { input_tokens: 10, output_tokens: 10 },
          }),
        };
      }
      return apiResponse({ ok: true });
    });
    const { client } = await setup(fetcher);
    await expect(client.structured(request)).resolves.toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
    const repairBody = JSON.parse(fetcher.mock.calls[1]?.[1].body ?? "{}") as { instructions?: string };
    expect(repairBody.instructions).toMatch(/修复 JSON/);
  });

  it("安全提取模型追加内容前的第一个完整 JSON", async () => {
    const fetcher = vi.fn<FactoryFetch>(async (_input, _init) => ({
      ...apiResponse({ ok: true }),
      json: async () => ({
        status: "completed",
        output: [{
          type: "message",
          content: [{ type: "output_text", text: '{"ok":true}{"ok":false}' }],
        }],
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
    }));
    const { client } = await setup(fetcher);
    await expect(client.structured(request)).resolves.toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("没有 Key 且缓存未命中时快速失败", async () => {
    const fetcher = vi.fn<FactoryFetch>(async (_input, _init) => apiResponse({ ok: true }));
    const { client } = await setup(fetcher, "");
    await expect(client.structured(request)).rejects.toThrow(/DEEPSEEK_API_KEY/);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
