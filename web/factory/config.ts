import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import type { FactoryRunConfig } from "./types.ts";
import { FACTORY_MODEL } from "./types.ts";

export const DEFAULT_PROMPT_VERSION = "name-factory-v5";

function positiveNumber(value: string | undefined, label: string, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new TypeError(`${label} 必须是正数。`);
  return parsed;
}

function positiveInteger(value: string | undefined, label: string, fallback: number): number {
  const parsed = positiveNumber(value, label, fallback);
  if (!Number.isSafeInteger(parsed)) throw new TypeError(`${label} 必须是正整数。`);
  return parsed;
}

function optionValue(args: readonly string[], index: number, option: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new TypeError(`${option} 缺少参数。`);
  return value;
}

export function parseFactoryArgs(
  args: readonly string[],
  { cwd = process.cwd(), env = process.env }: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): FactoryRunConfig {
  let live = false;
  let dryRun = true;
  let smoke = false;
  let resume = false;
  let maxCnyValue: string | undefined;
  let targetValue: string | undefined;
  let passagesPerBookValue: string | undefined;
  let batchSizeValue: string | undefined;
  let maxCandidatesValue: string | undefined;
  let runId = `factory-${new Date().toISOString().replace(/[:.]/gu, "-")}-${randomUUID().slice(0, 8)}`;
  let corpusRoot = resolve(cwd, "public/corpus");
  let approvedOutput = resolve(cwd, "corpus/generated/approved-candidates.json");
  let publicPreviewOutput = resolve(cwd, "public/data/generated-candidates.json");
  let reportsRoot = resolve(cwd, "factory/reports");
  let cacheRoot = resolve(cwd, ".factory-cache");
  let checkpointRoot = resolve(cwd, "factory/checkpoints");

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--": break;
      case "--live": live = true; dryRun = false; break;
      case "--dry-run": dryRun = true; live = false; break;
      case "--smoke": smoke = true; live = true; dryRun = false; break;
      case "--resume": resume = true; break;
      case "--max-cny": maxCnyValue = optionValue(args, index, arg); index += 1; break;
      case "--target": targetValue = optionValue(args, index, arg); index += 1; break;
      case "--passages-per-book": passagesPerBookValue = optionValue(args, index, arg); index += 1; break;
      case "--batch-size": batchSizeValue = optionValue(args, index, arg); index += 1; break;
      case "--max-candidates-per-passage": maxCandidatesValue = optionValue(args, index, arg); index += 1; break;
      case "--run-id": runId = optionValue(args, index, arg); index += 1; break;
      case "--corpus-root": corpusRoot = resolve(cwd, optionValue(args, index, arg)); index += 1; break;
      case "--approved-output": approvedOutput = resolve(cwd, optionValue(args, index, arg)); index += 1; break;
      case "--preview-output": publicPreviewOutput = resolve(cwd, optionValue(args, index, arg)); index += 1; break;
      case "--reports-root": reportsRoot = resolve(cwd, optionValue(args, index, arg)); index += 1; break;
      case "--cache-root": cacheRoot = resolve(cwd, optionValue(args, index, arg)); index += 1; break;
      case "--checkpoint-root": checkpointRoot = resolve(cwd, optionValue(args, index, arg)); index += 1; break;
      default: throw new TypeError(`未知参数：${arg}`);
    }
  }

  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/u.test(runId)) {
    throw new TypeError("run-id 只能包含字母、数字、点、下划线和连字符。");
  }

  const requestedMax = positiveNumber(maxCnyValue, "max-cny", 20);
  const maxCny = smoke ? Math.min(1, requestedMax) : requestedMax;
  const phaseScale = maxCny / 20;
  return {
    model: FACTORY_MODEL,
    promptVersion: env.DEEPSEEK_PROMPT_VERSION?.trim() || DEFAULT_PROMPT_VERSION,
    maxCny,
    target: smoke ? Math.min(3, positiveInteger(targetValue, "target", 3)) : positiveInteger(targetValue, "target", 400),
    passagesPerBook: smoke ? 1 : positiveInteger(passagesPerBookValue, "passages-per-book", 16),
    batchSize: smoke ? 2 : positiveInteger(batchSizeValue, "batch-size", 8),
    maxCandidatesPerPassage: smoke ? 1 : positiveInteger(maxCandidatesValue, "max-candidates-per-passage", 3),
    dryRun,
    live,
    smoke,
    resume,
    runId,
    corpusRoot,
    approvedOutput,
    publicPreviewOutput,
    reportsRoot,
    cacheRoot,
    checkpointRoot,
    cnyPerUsd: positiveNumber(env.DEEPSEEK_CNY_PER_USD, "DEEPSEEK_CNY_PER_USD", 7.2),
    pricingUsdPerMillion: {
      inputCacheHit: positiveNumber(env.DEEPSEEK_INPUT_CACHE_HIT_USD, "DEEPSEEK_INPUT_CACHE_HIT_USD", 0.0028),
      inputCacheMiss: positiveNumber(env.DEEPSEEK_INPUT_CACHE_MISS_USD, "DEEPSEEK_INPUT_CACHE_MISS_USD", 0.14),
      output: positiveNumber(env.DEEPSEEK_OUTPUT_USD, "DEEPSEEK_OUTPUT_USD", 0.28),
    },
    phaseBudgetCny: {
      calibration: 2 * phaseScale,
      generation: 10 * phaseScale,
      semanticReview: 2.5 * phaseScale,
      nameReview: 2.5 * phaseScale,
      adversarialReview: 2 * phaseScale,
      retry: 1 * phaseScale,
    },
  };
}
