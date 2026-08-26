import { BudgetLedger } from "./budget.ts";
import { JsonFileCache, createCacheKey, redactSecrets } from "./storage.ts";
import type { FactoryPhase, FactoryRunConfig, TokenUsage } from "./types.ts";

interface FetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export type FactoryFetch = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  },
) => Promise<FetchResponse>;

export interface StructuredRequest<T> {
  phase: FactoryPhase;
  role: string;
  instructions: string;
  input: unknown;
  schemaName: string;
  schema: object;
  parse: (value: unknown) => T;
  maxOutputTokens?: number;
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
  temperature?: number;
}

interface CachedStructuredResponse {
  schemaVersion: 2;
  value: unknown;
}

interface DeepSeekResponse {
  status: string;
  incomplete_details?: { reason?: string } | null;
  output: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  usage?: {
    input_tokens?: number;
    input_tokens_details?: { cached_tokens?: number };
    output_tokens?: number;
    output_tokens_details?: { reasoning_tokens?: number };
  };
}

function parseCached(value: unknown): CachedStructuredResponse {
  if (
    typeof value !== "object" ||
    value === null ||
    (value as { schemaVersion?: unknown }).schemaVersion !== 2 ||
    !("value" in value)
  ) {
    throw new TypeError("DeepSeek 缓存格式无效。");
  }
  return value as CachedStructuredResponse;
}

function parseApiResponse(value: unknown): DeepSeekResponse {
  if (
    typeof value !== "object" ||
    value === null ||
    !Array.isArray((value as { output?: unknown }).output)
  ) {
    throw new TypeError("DeepSeek Responses API 返回格式无效。");
  }
  return value as DeepSeekResponse;
}

function outputText(response: DeepSeekResponse): string {
  const texts = response.output.flatMap((item) =>
    item.type === "message"
      ? (item.content ?? [])
          .filter((part) => part.type === "output_text" && typeof part.text === "string")
          .map((part) => part.text as string)
      : [],
  );
  if (texts.length === 0) throw new TypeError("DeepSeek 响应没有 output_text。");
  return texts.join("");
}

function tokenUsage(response: DeepSeekResponse): TokenUsage {
  return {
    inputTokens: Math.max(0, response.usage?.input_tokens ?? 0),
    cachedInputTokens: Math.max(0, response.usage?.input_tokens_details?.cached_tokens ?? 0),
    outputTokens: Math.max(0, response.usage?.output_tokens ?? 0),
    reasoningTokens: Math.max(0, response.usage?.output_tokens_details?.reasoning_tokens ?? 0),
  };
}

function estimatedInputTokens(instructions: string, input: unknown): number {
  const characters = instructions.length + JSON.stringify(input).length;
  return Math.max(256, Math.ceil(characters * 1.2) + 256);
}

function retryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function safeError(error: unknown): Error {
  const message = redactSecrets(error instanceof Error ? error.message : String(error));
  return new Error(message.slice(0, 1_000));
}

export interface DeepSeekClientOptions {
  config: FactoryRunConfig;
  ledger: BudgetLedger;
  cache?: JsonFileCache;
  apiKey?: string;
  fetcher?: FactoryFetch;
  sleep?: (milliseconds: number) => Promise<void>;
  timeoutMilliseconds?: number;
  maxAttempts?: number;
}

export class DeepSeekClient {
  readonly #config: FactoryRunConfig;
  readonly #ledger: BudgetLedger;
  readonly #cache: JsonFileCache;
  readonly #apiKey: string;
  readonly #fetcher: FactoryFetch;
  readonly #sleep: (milliseconds: number) => Promise<void>;
  readonly #timeoutMilliseconds: number;
  readonly #maxAttempts: number;

  constructor({
    config,
    ledger,
    cache = new JsonFileCache(config.cacheRoot),
    apiKey = process.env.DEEPSEEK_API_KEY ?? "",
    fetcher = fetch as unknown as FactoryFetch,
    sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    timeoutMilliseconds = 60_000,
    maxAttempts = 3,
  }: DeepSeekClientOptions) {
    this.#config = config;
    this.#ledger = ledger;
    this.#cache = cache;
    this.#apiKey = apiKey.trim();
    this.#fetcher = fetcher;
    this.#sleep = sleep;
    this.#timeoutMilliseconds = timeoutMilliseconds;
    this.#maxAttempts = maxAttempts;
  }

  async structured<T>(request: StructuredRequest<T>): Promise<T> {
    const keyMaterial = {
      cacheSchemaVersion: 2,
      model: this.#config.model,
      promptVersion: this.#config.promptVersion,
      role: request.role,
      instructions: request.instructions,
      input: request.input,
      schemaName: request.schemaName,
      schema: request.schema,
      reasoningEffort: request.reasoningEffort ?? "none",
      temperature: request.temperature ?? 0.2,
      maxOutputTokens: request.maxOutputTokens ?? 4_096,
    };
    const cacheKey = createCacheKey(keyMaterial);
    const cached = await this.#cache.get(cacheKey, parseCached);
    if (cached) {
      const parsed = request.parse(cached.value);
      this.#ledger.recordCacheHit({ cacheKey, phase: request.phase, role: request.role });
      return parsed;
    }
    if (!this.#apiKey) {
      throw new Error("缺少 DEEPSEEK_API_KEY；请使用新的本地 Key，或先运行 factory:dry-run。");
    }

    const result = await this.#requestWithRetry(request, cacheKey);
    let parsed: T;
    let rawValue: unknown;
    try {
      rawValue = JSON.parse(result.text) as unknown;
      parsed = request.parse(rawValue);
    } catch (error) {
      const repaired = await this.#repairJson(request, result.text, safeError(error), cacheKey);
      parsed = repaired.parsed;
      rawValue = repaired.rawValue;
    }
    await this.#cache.set(cacheKey, { schemaVersion: 2, value: rawValue }, parseCached);
    return parsed;
  }

  async #requestWithRetry<T>(
    request: StructuredRequest<T>,
    cacheKey: string,
    override?: { instructions: string; input: unknown; role: string; phase: FactoryPhase },
  ): Promise<{ text: string; usage: TokenUsage }> {
    const instructions = override?.instructions ?? request.instructions;
    const input = override?.input ?? request.input;
    const role = override?.role ?? request.role;
    const firstPhase = override?.phase ?? request.phase;
    const baseMaxOutputTokens = request.maxOutputTokens ?? 4_096;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.#maxAttempts; attempt += 1) {
      const phase = attempt === 0 ? firstPhase : "retry";
      const maxOutputTokens = Math.min(16_384, baseMaxOutputTokens * (2 ** attempt));
      const reservation = this.#ledger.reserve(phase, {
        inputTokens: estimatedInputTokens(instructions, input),
        cachedInputTokens: 0,
        outputTokens: maxOutputTokens,
        reasoningTokens: 0,
      });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.#timeoutMilliseconds);
      try {
        const response = await this.#fetcher("https://api.deepseek.com/responses", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.#apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.#config.model,
            instructions,
            input: JSON.stringify(input),
            reasoning: { effort: request.reasoningEffort ?? "none" },
            max_output_tokens: maxOutputTokens,
            temperature: request.temperature ?? 0.2,
            text: {
              format: {
                type: "json_schema",
                name: request.schemaName,
                schema: request.schema,
              },
            },
            store: false,
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          const responseText = redactSecrets((await response.text()).slice(0, 1_000));
          const error = new Error(`DeepSeek HTTP ${response.status}: ${responseText}`);
          if (!retryableStatus(response.status) || attempt === this.#maxAttempts - 1) {
            this.#ledger.release(reservation);
            throw error;
          }
          this.#ledger.release(reservation);
          lastError = error;
          await this.#sleep(Math.min(4_000, 250 * (2 ** attempt)));
          continue;
        }
        const apiResponse = parseApiResponse(await response.json());
        const usage = tokenUsage(apiResponse);
        this.#ledger.commit(reservation, { cacheKey, role, usage });
        if (apiResponse.status !== "completed") {
          const reason = apiResponse.incomplete_details?.reason?.trim() || "unknown";
          const error = new Error(`DeepSeek 响应状态不是 completed：${apiResponse.status}（${reason}）`);
          if (apiResponse.status !== "incomplete" || attempt === this.#maxAttempts - 1) throw error;
          lastError = error;
          await this.#sleep(Math.min(4_000, 250 * (2 ** attempt)));
          continue;
        }
        return { text: outputText(apiResponse), usage };
      } catch (error) {
        this.#ledger.release(reservation);
        const safe = safeError(error);
        const retryableNetworkError =
          (error as { name?: unknown }).name === "AbortError" ||
          error instanceof TypeError;
        if (!retryableNetworkError || attempt === this.#maxAttempts - 1) throw safe;
        lastError = safe;
        await this.#sleep(Math.min(4_000, 250 * (2 ** attempt)));
      } finally {
        clearTimeout(timeout);
      }
    }
    throw lastError ?? new Error("DeepSeek 请求失败。");
  }

  async #repairJson<T>(
    request: StructuredRequest<T>,
    invalidText: string,
    parseError: Error,
    parentCacheKey: string,
  ): Promise<{ parsed: T; rawValue: unknown }> {
    const repair = await this.#requestWithRetry(request, `${parentCacheKey}:repair`, {
      role: `${request.role}:json-repair`,
      phase: "retry",
      instructions: [
        "你只负责修复 JSON，使它严格符合给定 JSON Schema。不得改变事实内容，不得添加解释文字。",
        `原解析错误：${parseError.message}`,
      ].join("\n"),
      input: { invalidJson: invalidText },
    });
    try {
      const rawValue = JSON.parse(repair.text) as unknown;
      return { parsed: request.parse(rawValue), rawValue };
    } catch (error) {
      throw new TypeError(`DeepSeek JSON 定向修复仍然失败：${safeError(error).message}`);
    }
  }
}
