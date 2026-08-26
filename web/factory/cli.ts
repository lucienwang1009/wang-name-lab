import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { BudgetLedger, estimateUsageMicroCny, microCnyToCny } from "./budget.ts";
import { parseFactoryArgs } from "./config.ts";
import {
  createPassageBatches,
  loadFactoryCorpus,
  selectDiversePassages,
  type LoadedFactoryCorpus,
} from "./corpus.ts";
import { DeepSeekClient } from "./deepseek.ts";
import { runFactoryPipeline, type FactoryModelGateway } from "./pipeline.ts";
import {
  parseFactoryCandidateFile,
  parseFactoryCheckpoint,
  parseFactoryManifest,
  parseFactoryReviewReport,
} from "./schema.ts";
import { atomicWriteJson, JsonFileCache, readJsonIfExists } from "./storage.ts";
import type {
  FactoryCheckpoint,
  FactoryManifest,
  FactoryRunConfig,
  TokenUsage,
} from "./types.ts";
import { FACTORY_MODEL, FACTORY_SCHEMA_VERSION } from "./types.ts";

export interface DryRunPlan {
  corpusVersion: string;
  selectedPassages: number;
  generationBatches: number;
  estimatedRawCandidates: number;
  estimatedRequests: number;
  conservativeCostCny: number;
  remoteRequests: 0;
}

export interface FactoryCliResult {
  mode: "dry-run" | "live";
  runId: string;
  dryRunPlan?: DryRunPlan;
  publishedCount?: number;
  estimatedCostCny?: number;
  reportDirectory?: string;
}

export interface FactoryCliDependencies {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  loadCorpus?: (root: string) => Promise<LoadedFactoryCorpus>;
  gateway?: FactoryModelGateway;
  log?: (message: string) => void;
}

function estimatedRequestUsage(inputCharacters: number, outputTokens: number): TokenUsage {
  return {
    inputTokens: Math.max(1, Math.ceil(inputCharacters / 2)),
    cachedInputTokens: 0,
    outputTokens,
    reasoningTokens: 0,
  };
}

export function buildDryRunPlan(config: FactoryRunConfig, corpus: LoadedFactoryCorpus): DryRunPlan {
  const selected = selectDiversePassages(corpus.passages, { passagesPerBook: config.passagesPerBook });
  const batches = createPassageBatches(selected, config.batchSize);
  const raw = selected.length * config.maxCandidatesPerPassage;
  const likelyLocalPassed = Math.ceil(raw * 0.55);
  const likelySemanticPassed = Math.ceil(likelyLocalPassed * 0.6);
  const likelyNamePassed = Math.ceil(likelySemanticPassed * 0.6);
  const semanticRequests = Math.ceil(likelyLocalPassed / config.batchSize);
  const nameRequests = Math.ceil(likelySemanticPassed / config.batchSize);
  const adversarialRequests = Math.ceil(Math.min(likelyNamePassed, Math.max(config.target * 2, config.target + 20)) / config.batchSize);
  let microCny = 0;
  for (const batch of batches) {
    const inputCharacters = batch.passages.reduce((sum, passage) => sum + passage.text.length + 180, 0);
    microCny += estimateUsageMicroCny(
      estimatedRequestUsage(inputCharacters, Math.max(1_200, batch.passages.length * config.maxCandidatesPerPassage * 280)),
      config.pricingUsdPerMillion,
      config.cnyPerUsd,
    );
  }
  const reviewUsage = estimatedRequestUsage(config.batchSize * 700, Math.max(1_200, config.batchSize * 240));
  microCny += (semanticRequests + nameRequests + adversarialRequests) * estimateUsageMicroCny(
    reviewUsage,
    config.pricingUsdPerMillion,
    config.cnyPerUsd,
  );
  return {
    corpusVersion: corpus.corpusVersion,
    selectedPassages: selected.length,
    generationBatches: batches.length,
    estimatedRawCandidates: raw,
    estimatedRequests: batches.length + semanticRequests + nameRequests + adversarialRequests,
    conservativeCostCny: Math.min(config.maxCny, microCnyToCny(microCny)),
    remoteRequests: 0,
  };
}

function checkpointPath(config: FactoryRunConfig): string {
  return join(config.checkpointRoot, `${config.runId}.json`);
}

function reportDirectory(config: FactoryRunConfig): string {
  return join(config.reportsRoot, config.runId);
}

async function loadCheckpoint(config: FactoryRunConfig): Promise<FactoryCheckpoint | undefined> {
  if (!config.resume) return undefined;
  const value = await readJsonIfExists(checkpointPath(config), parseFactoryCheckpoint);
  if (!value) throw new Error(`找不到可恢复的检查点：${checkpointPath(config)}`);
  return value;
}

function manifest(
  config: FactoryRunConfig,
  ledger: BudgetLedger,
  corpusVersion: string,
  startedAt: string,
  completedAt: string,
): FactoryManifest {
  return {
    schemaVersion: FACTORY_SCHEMA_VERSION,
    runId: config.runId,
    startedAt,
    completedAt,
    model: FACTORY_MODEL,
    promptVersion: config.promptVersion,
    corpusVersion,
    dryRun: false,
    maxCny: config.maxCny,
    pricingUsdPerMillion: config.pricingUsdPerMillion,
    cnyPerUsd: config.cnyPerUsd,
    requestCount: ledger.records.filter((record) => !record.cached).length,
    cacheHitCount: ledger.records.filter((record) => record.cached).length,
    estimatedMicroCny: ledger.spentMicroCny,
    requests: [...ledger.records],
  };
}

export async function runFactoryCli(
  args: readonly string[],
  dependencies: FactoryCliDependencies = {},
): Promise<FactoryCliResult> {
  const cwd = dependencies.cwd ?? process.cwd();
  const env = dependencies.env ?? process.env;
  const config = parseFactoryArgs(args, { cwd, env });
  const log = dependencies.log ?? console.log;
  const loadCorpus = dependencies.loadCorpus ?? loadFactoryCorpus;
  const corpus = await loadCorpus(config.corpusRoot);

  if (config.dryRun) {
    const plan = buildDryRunPlan(config, corpus);
    log(`Dry run: ${plan.selectedPassages} 条原句，${plan.generationBatches} 个生成批次，预计约 ${plan.estimatedRawCandidates} 个原始提案。`);
    log(`预计 ${plan.estimatedRequests} 次模型请求，保守估算 ${plan.conservativeCostCny.toFixed(4)} 元；实际远程请求 0。`);
    return { mode: "dry-run", runId: config.runId, dryRunPlan: plan };
  }
  if (!config.live) throw new Error("真实候选构建必须显式使用 --live。 ");

  const startedAt = (dependencies.now?.() ?? new Date()).toISOString();
  const ledger = new BudgetLedger(config);
  const gateway = dependencies.gateway ?? new DeepSeekClient({
    config,
    ledger,
    cache: new JsonFileCache(config.cacheRoot),
    apiKey: env.DEEPSEEK_API_KEY ?? "",
  });
  const previousCheckpoint = await loadCheckpoint(config);
  log(`Live run ${config.runId}: model=${config.model}, budget<=${config.maxCny.toFixed(2)} CNY.`);
  const result = await runFactoryPipeline({
    config,
    corpus,
    gateway,
    checkpoint: previousCheckpoint,
    now: dependencies.now,
    onCheckpoint: async (value) => {
      await atomicWriteJson(checkpointPath(config), value, parseFactoryCheckpoint);
    },
  });
  const completedAt = (dependencies.now?.() ?? new Date()).toISOString();
  const runManifest = manifest(config, ledger, corpus.corpusVersion, startedAt, completedAt);
  const reports = reportDirectory(config);
  await atomicWriteJson(config.approvedOutput, result.candidateFile, parseFactoryCandidateFile);
  await atomicWriteJson(config.publicPreviewOutput, result.candidateFile, parseFactoryCandidateFile);
  await atomicWriteJson(join(reports, "review-report.json"), result.report, parseFactoryReviewReport);
  await atomicWriteJson(join(reports, "manifest.json"), runManifest, parseFactoryManifest);
  await atomicWriteJson(checkpointPath(config), result.checkpoint, parseFactoryCheckpoint);
  log(`Published ${result.candidateFile.count} candidates; estimated cost ${microCnyToCny(ledger.spentMicroCny).toFixed(4)} CNY.`);
  return {
    mode: "live",
    runId: config.runId,
    publishedCount: result.candidateFile.count,
    estimatedCostCny: microCnyToCny(ledger.spentMicroCny),
    reportDirectory: reports,
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  runFactoryCli(process.argv.slice(2)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Candidate factory failed: ${message}`);
    process.exitCode = 1;
  });
}

