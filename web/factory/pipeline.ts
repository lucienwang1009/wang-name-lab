import { createPassageBatches, selectDiversePassages, type LoadedFactoryCorpus } from "./corpus.ts";
import type { StructuredRequest } from "./deepseek.ts";
import {
  adversarialReviewRequest,
  generationRequest,
  nameReviewRequest,
  semanticReviewRequest,
} from "./prompts.ts";
import { compilePointerSelections } from "./pointers.ts";
import { deduplicateProposals, runLocalRules } from "./rules.ts";
import { selectDiverseCandidates, synthesizeCandidate } from "./synthesis.ts";
import type {
  CandidateProposal,
  FactoryCandidateFile,
  FactoryCheckpoint,
  FactoryPassage,
  FactoryReviewItem,
  FactoryReviewReport,
  FactoryRunConfig,
  PointerSelectionIssue,
} from "./types.ts";
import { FACTORY_MODEL, FACTORY_SCHEMA_VERSION } from "./types.ts";

export interface FactoryModelGateway {
  structured<T>(request: StructuredRequest<T>): Promise<T>;
}

export interface PipelineResult {
  candidateFile: FactoryCandidateFile;
  report: FactoryReviewReport;
  checkpoint: FactoryCheckpoint;
}

export interface RunPipelineOptions {
  config: FactoryRunConfig;
  corpus: LoadedFactoryCorpus;
  gateway: FactoryModelGateway;
  checkpoint?: FactoryCheckpoint;
  onCheckpoint?: (checkpoint: FactoryCheckpoint) => Promise<void>;
  now?: () => Date;
}

function chunks<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

const calibrationBookOrder = [
  "shi-jing",
  "chu-ci",
  "tang-shi-san-bai-shou",
  "song-ci-san-bai-shou",
  "gu-shi-shi-jiu-shou",
  "cao-zi-jian-ji",
  "lao-zi",
  "zhuang-zi",
  "huai-nan-zi",
  "wen-xin-diao-long",
  "li-tai-bai-ji",
] as const;

const calibrationBookRank = new Map<string, number>(calibrationBookOrder.map((bookId, index) => [bookId, index]));

function prioritizeCalibrationBatches(
  passages: readonly FactoryPassage[],
  batchSize: number,
): ReturnType<typeof createPassageBatches> {
  const ranked = [...passages].sort((left, right) => {
    const leftRank = calibrationBookRank.get(left.bookId) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = calibrationBookRank.get(right.bookId) ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank || right.score - left.score || left.id.localeCompare(right.id);
  });
  const calibrationCount = Math.min(ranked.length, batchSize * 3);
  const calibrationPassages = ranked.slice(0, calibrationCount);
  const calibrationIds = new Set(calibrationPassages.map((passage) => passage.id));
  const remainingPassages = passages.filter((passage) => !calibrationIds.has(passage.id));
  return [
    ...createPassageBatches(calibrationPassages, batchSize),
    ...createPassageBatches(remainingPassages, batchSize),
  ];
}

function newReviewItem(proposal: CandidateProposal): FactoryReviewItem {
  return {
    proposal,
    localRisks: [],
    status: "generated",
    rejectionReasons: [],
  };
}

function reject(item: FactoryReviewItem, reason: string): void {
  item.status = "rejected";
  if (!item.rejectionReasons.includes(reason)) item.rejectionReasons.push(reason);
}

function manualReview(item: FactoryReviewItem, reason: string): void {
  item.status = "manual-review";
  if (!item.rejectionReasons.includes(reason)) item.rejectionReasons.push(reason);
}

function checkpointFor(
  config: FactoryRunConfig,
  corpusVersion: string,
  completedBatchIds: readonly string[],
  pointerSelectionCount: number,
  pointerIssues: readonly PointerSelectionIssue[],
  proposals: readonly CandidateProposal[],
  items: readonly FactoryReviewItem[],
): FactoryCheckpoint {
  return {
    schemaVersion: FACTORY_SCHEMA_VERSION,
    runId: config.runId,
    corpusVersion,
    promptVersion: config.promptVersion,
    completedBatchIds: [...completedBatchIds],
    pointerSelectionCount,
    pointerIssues: [...pointerIssues],
    proposals: [...proposals],
    reviewItems: [...items],
  };
}

function assertCheckpointCompatible(
  checkpoint: FactoryCheckpoint | undefined,
  config: FactoryRunConfig,
  corpusVersion: string,
): void {
  if (!checkpoint) return;
  if (
    checkpoint.runId !== config.runId ||
    checkpoint.corpusVersion !== corpusVersion ||
    checkpoint.promptVersion !== config.promptVersion
  ) {
    throw new Error("检查点与当前 run-id、语料版本或提示词版本不一致，不能恢复。 ");
  }
}

async function checkpoint(
  options: RunPipelineOptions,
  completedBatchIds: readonly string[],
  pointerSelectionCount: number,
  pointerIssues: readonly PointerSelectionIssue[],
  proposals: readonly CandidateProposal[],
  items: readonly FactoryReviewItem[],
): Promise<FactoryCheckpoint> {
  const value = checkpointFor(
    options.config,
    options.corpus.corpusVersion,
    completedBatchIds,
    pointerSelectionCount,
    pointerIssues,
    proposals,
    items,
  );
  await options.onCheckpoint?.(value);
  return value;
}

function reviewMap<T extends { proposalId: string }>(reviews: readonly T[]): Map<string, T> {
  return new Map(reviews.map((review) => [review.proposalId, review]));
}

export async function runFactoryPipeline(options: RunPipelineOptions): Promise<PipelineResult> {
  const { config, corpus, gateway } = options;
  assertCheckpointCompatible(options.checkpoint, config, corpus.corpusVersion);
  const passagesById = new Map(corpus.passages.map((passage) => [passage.id, passage]));
  const selectedPassages = selectDiversePassages(corpus.passages, {
    passagesPerBook: config.passagesPerBook,
  });
  const allSourceBatches = prioritizeCalibrationBatches(selectedPassages, config.batchSize);
  // Smoke is an end-to-end connectivity/format check, not a small production run.
  // Keep it to one source batch (then at most one request for each review stage).
  const sourceBatches = config.smoke ? allSourceBatches.slice(0, 1) : allSourceBatches;
  const completedBatchIds = new Set(options.checkpoint?.completedBatchIds ?? []);
  let pointerSelectionCount = options.checkpoint?.pointerSelectionCount ?? 0;
  const pointerIssues: PointerSelectionIssue[] = [...(options.checkpoint?.pointerIssues ?? [])];
  const proposals: CandidateProposal[] = [...(options.checkpoint?.proposals ?? [])];
  const calibrationAttemptLimit = config.smoke ? 1 : Math.min(3, sourceBatches.length);
  let calibrationAttempts = sourceBatches
    .slice(0, calibrationAttemptLimit)
    .filter((batch) => completedBatchIds.has(batch.id))
    .length;
  let calibrationPassed = proposals.some((proposal) => runLocalRules(proposal, passagesById).passed);

  for (const batch of sourceBatches) {
    if (completedBatchIds.has(batch.id)) continue;
    const isCalibration = !calibrationPassed && calibrationAttempts < calibrationAttemptLimit;
    const phase = isCalibration ? "calibration" : "generation";
    const selections = await gateway.structured(generationRequest(
      batch,
      config.maxCandidatesPerPassage,
      phase,
    ));
    pointerSelectionCount += selections.length;
    const compiled = compilePointerSelections(selections, batch, { allowCrossPassage: false });
    pointerIssues.push(...compiled.issues);
    const acceptedFromBatch = compiled.proposals;
    const batchPassed = acceptedFromBatch.some((proposal) => runLocalRules(proposal, passagesById).passed);
    if (isCalibration) {
      calibrationAttempts += 1;
      calibrationPassed ||= batchPassed;
    }
    proposals.push(...acceptedFromBatch);
    completedBatchIds.add(batch.id);
    await checkpoint(
      options,
      [...completedBatchIds],
      pointerSelectionCount,
      pointerIssues,
      proposals,
      [],
    );
    if (isCalibration && !calibrationPassed && calibrationAttempts >= calibrationAttemptLimit) {
      throw new Error(`连续 ${calibrationAttempts} 个校准批次没有产生任何通过本地硬规则的候选；已停止扩量，请先调整提示词或取材规则。`);
    }
  }

  const uniqueProposals = deduplicateProposals(proposals);
  const items = new Map<string, FactoryReviewItem>();
  for (const proposal of uniqueProposals) {
    const item = newReviewItem(proposal);
    const local = runLocalRules(proposal, passagesById);
    item.localRisks = local.risks;
    if (local.passed) item.status = "rule-passed";
    else reject(item, local.risks.filter((risk) => risk.severity === "hard").map((risk) => risk.summary).join("；"));
    items.set(proposal.proposalId, item);
  }
  await checkpoint(options, [...completedBatchIds], pointerSelectionCount, pointerIssues, uniqueProposals, [...items.values()]);

  const localPassed = [...items.values()].filter((item) => item.status === "rule-passed");
  for (const group of chunks(localPassed, config.batchSize)) {
    const reviews = reviewMap(await gateway.structured(semanticReviewRequest(
      group.map((item) => item.proposal),
      passagesById,
    )));
    for (const item of group) {
      const review = reviews.get(item.proposal.proposalId);
      if (!review) {
        reject(item, "语义审核响应缺失。");
      } else {
        item.semantic = review;
        if (review.decision === "approve" && review.semanticScore >= 0.72 && review.evidenceScore >= 0.72) {
          item.status = "semantic-approved";
        } else if (review.decision === "manual-review") {
          manualReview(item, review.risks.join("；") || "语义需要人工复核。");
        } else {
          reject(item, review.risks.join("；") || "语义审核未通过。");
        }
      }
    }
    await checkpoint(options, [...completedBatchIds], pointerSelectionCount, pointerIssues, uniqueProposals, [...items.values()]);
  }

  const semanticApproved = [...items.values()].filter((item) => item.status === "semantic-approved");
  for (const group of chunks(semanticApproved, config.batchSize)) {
    const reviews = reviewMap(await gateway.structured(nameReviewRequest(group.map((item) => item.proposal))));
    for (const item of group) {
      const review = reviews.get(item.proposal.proposalId);
      if (!review) {
        reject(item, "姓名感审核响应缺失。");
      } else {
        item.name = review;
        if (review.decision === "approve" && review.scores.nameFeel >= 0.72 && review.scores.phonology >= 0.72) {
          item.status = "name-approved";
        } else if (review.decision === "manual-review") {
          manualReview(item, review.risks.join("；") || "姓名感需要人工复核。");
        } else {
          reject(item, review.risks.join("；") || "姓名感审核未通过。");
        }
      }
    }
    await checkpoint(options, [...completedBatchIds], pointerSelectionCount, pointerIssues, uniqueProposals, [...items.values()]);
  }

  const preliminaries = [...items.values()]
    .filter((item) => item.status === "name-approved")
    .sort((left, right) => {
      const leftScore = (left.semantic?.semanticScore ?? 0) + (left.name?.scores.nameFeel ?? 0) + (left.name?.scores.phonology ?? 0);
      const rightScore = (right.semantic?.semanticScore ?? 0) + (right.name?.scores.nameFeel ?? 0) + (right.name?.scores.phonology ?? 0);
      return rightScore - leftScore || left.proposal.givenName.localeCompare(right.proposal.givenName);
    })
    .slice(0, Math.max(config.target * 2, config.target + 20));
  const preliminaryIds = new Set(preliminaries.map((item) => item.proposal.proposalId));
  for (const item of items.values()) {
    if (item.status === "name-approved" && !preliminaryIds.has(item.proposal.proposalId)) {
      reject(item, "综合分未进入对抗复审范围。");
    }
  }
  for (const group of chunks(preliminaries, config.batchSize)) {
    const reviews = reviewMap(await gateway.structured(adversarialReviewRequest(
      group.map((item) => item.proposal),
      new Map(group.flatMap((item) => item.semantic ? [[item.proposal.proposalId, item.semantic] as const] : [])),
      new Map(group.flatMap((item) => item.name ? [[item.proposal.proposalId, item.name] as const] : [])),
    )));
    for (const item of group) {
      const review = reviews.get(item.proposal.proposalId);
      if (!review) {
        reject(item, "对抗复审响应缺失。");
      } else {
        item.adversarial = review;
        if (review.decision === "approve" && review.fatalIssues.length === 0) {
          item.status = "adversarial-approved";
        } else if (review.decision === "manual-review") {
          manualReview(item, review.critique);
        } else {
          reject(item, [...review.fatalIssues, review.critique].filter(Boolean).join("；"));
        }
      }
    }
    await checkpoint(options, [...completedBatchIds], pointerSelectionCount, pointerIssues, uniqueProposals, [...items.values()]);
  }

  const synthesized = [...items.values()].flatMap((item) => {
    if (
      item.status !== "adversarial-approved" ||
      !item.semantic ||
      !item.name ||
      !item.adversarial
    ) return [];
    const pronunciation = runLocalRules(item.proposal, passagesById).pronunciation;
    return [synthesizeCandidate({
      proposal: item.proposal,
      passagesById,
      semantic: item.semantic,
      name: item.name,
      adversarial: item.adversarial,
      pinyin: pronunciation.pinyin,
      tones: pronunciation.tones,
      pronunciationRisks: pronunciation.risks,
      corpusVersion: corpus.corpusVersion,
      promptVersion: config.promptVersion,
      runId: config.runId,
    })];
  });
  const selectedCandidates = selectDiverseCandidates(synthesized, config.target);
  const publishedNames = new Set(selectedCandidates.map((candidate) => candidate.givenName));
  for (const item of items.values()) {
    if (item.status === "adversarial-approved") {
      if (publishedNames.has(item.proposal.givenName)) item.status = "published";
      else reject(item, "未进入最终多样性排序名额。");
    }
  }
  const candidateFile: FactoryCandidateFile = {
    schemaVersion: FACTORY_SCHEMA_VERSION,
    model: FACTORY_MODEL,
    promptVersion: config.promptVersion,
    corpusVersion: corpus.corpusVersion,
    runId: config.runId,
    createdAt: (options.now?.() ?? new Date()).toISOString(),
    count: selectedCandidates.length,
    candidates: selectedCandidates,
  };
  const reviewItems = [...items.values()].sort((left, right) =>
    left.proposal.givenName.localeCompare(right.proposal.givenName) || left.proposal.proposalId.localeCompare(right.proposal.proposalId)
  );
  const report: FactoryReviewReport = {
    schemaVersion: FACTORY_SCHEMA_VERSION,
    runId: config.runId,
    corpusVersion: corpus.corpusVersion,
    model: FACTORY_MODEL,
    promptVersion: config.promptVersion,
    pointerSelectionCount,
    invalidPointerCount: pointerIssues.length,
    pointerIssues,
    generatedCount: uniqueProposals.length,
    publishedCount: selectedCandidates.length,
    manualReviewCount: reviewItems.filter((item) => item.status === "manual-review").length,
    rejectedCount: reviewItems.filter((item) => item.status === "rejected").length,
    items: reviewItems,
  };
  const finalCheckpoint = await checkpoint(
    options,
    [...completedBatchIds],
    pointerSelectionCount,
    pointerIssues,
    uniqueProposals,
    reviewItems,
  );
  return { candidateFile, report, checkpoint: finalCheckpoint };
}
