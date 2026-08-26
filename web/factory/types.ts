import type {
  EvidenceRelation,
  NameFeatureVector,
  NameRisk,
  NameStyle,
  PersonalizedCandidate,
} from "../src/domain/types.ts";

export const FACTORY_MODEL = "deepseek-v4-flash" as const;
export const FACTORY_SCHEMA_VERSION = 1 as const;

export type FactoryPhase =
  | "calibration"
  | "generation"
  | "semantic-review"
  | "name-review"
  | "adversarial-review"
  | "retry";

export type ReviewDecision = "approve" | "manual-review" | "reject";

export interface FactoryBook {
  id: string;
  title: string;
  category: string;
  period: string;
  priority: number;
}

export interface FactoryPassage {
  id: string;
  bookId: string;
  bookTitle: string;
  category: string;
  period: string;
  workTitle: string;
  chapterTitle: string;
  text: string;
  normalizedText: string;
  sourceUrl: string;
  verificationUrl: string;
  score: number;
}

export interface SourceCharacterRef {
  character: string;
  passageId: string;
  occurrence: number;
}

export interface SourcePointer {
  passageId: string;
  index: number;
}

export interface PointerSelection {
  first: SourcePointer;
  second: SourcePointer;
  meaning: string;
  rationale: string;
  imageryCategory: string;
  familyConnection: string;
}

export interface PointerSelectionIssue {
  batchId: string;
  selectionIndex: number;
  reason: string;
  selection: PointerSelection;
}

export interface CandidateProposal {
  proposalId: string;
  givenName: string;
  relation: EvidenceRelation;
  sources: [SourceCharacterRef, SourceCharacterRef];
  extraction: string;
  meaning: string;
  rationale: string;
  imageryCategory: string;
  familyConnection: string;
}

export interface SemanticReview {
  proposalId: string;
  decision: ReviewDecision;
  semanticScore: number;
  evidenceScore: number;
  explanation: string;
  risks: string[];
}

export interface NameReviewScores {
  phonology: number;
  nameFeel: number;
  femininity: number;
  usability: number;
  distinctiveness: number;
}

export interface NameReview {
  proposalId: string;
  decision: ReviewDecision;
  scores: NameReviewScores;
  primaryStyle: NameStyle;
  pronunciationNote: string;
  usabilityNote: string;
  uncommonnessNote: string;
  risks: string[];
}

export interface AdversarialReview {
  proposalId: string;
  decision: ReviewDecision;
  critique: string;
  fatalIssues: string[];
}

export interface FactoryAudit {
  model: typeof FACTORY_MODEL;
  promptVersion: string;
  corpusVersion: string;
  runId: string;
  proposalId: string;
  semantic: Pick<SemanticReview, "semanticScore" | "evidenceScore" | "explanation">;
  name: NameReviewScores;
  adversarialCritique: string;
}

export interface FactoryCandidate extends PersonalizedCandidate {
  evidence: PersonalizedCandidate["evidence"] & {
    reviewStatus: "ai-reviewed";
  };
  factoryAudit: FactoryAudit;
}

export interface TokenUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
}

export interface FactoryRequestRecord {
  cacheKey: string;
  phase: FactoryPhase;
  role: string;
  usage: TokenUsage;
  estimatedMicroCny: number;
  cached: boolean;
}

export interface PhaseBudgetCny {
  calibration: number;
  generation: number;
  semanticReview: number;
  nameReview: number;
  adversarialReview: number;
  retry: number;
}

export interface FactoryRunConfig {
  model: typeof FACTORY_MODEL;
  promptVersion: string;
  maxCny: number;
  target: number;
  passagesPerBook: number;
  batchSize: number;
  maxCandidatesPerPassage: number;
  dryRun: boolean;
  live: boolean;
  smoke: boolean;
  resume: boolean;
  runId: string;
  corpusRoot: string;
  approvedOutput: string;
  publicPreviewOutput: string;
  reportsRoot: string;
  cacheRoot: string;
  checkpointRoot: string;
  cnyPerUsd: number;
  pricingUsdPerMillion: {
    inputCacheHit: number;
    inputCacheMiss: number;
    output: number;
  };
  phaseBudgetCny: PhaseBudgetCny;
}

export interface FactoryCandidateFile {
  schemaVersion: typeof FACTORY_SCHEMA_VERSION;
  model: typeof FACTORY_MODEL;
  promptVersion: string;
  corpusVersion: string;
  runId: string;
  createdAt: string;
  count: number;
  candidates: FactoryCandidate[];
}

export interface FactoryReviewItem {
  proposal: CandidateProposal;
  localRisks: NameRisk[];
  semantic?: SemanticReview;
  name?: NameReview;
  adversarial?: AdversarialReview;
  status:
    | "generated"
    | "rule-passed"
    | "semantic-approved"
    | "name-approved"
    | "adversarial-approved"
    | "published"
    | "rejected"
    | "manual-review";
  rejectionReasons: string[];
}

export interface FactoryReviewReport {
  schemaVersion: typeof FACTORY_SCHEMA_VERSION;
  runId: string;
  corpusVersion: string;
  model: typeof FACTORY_MODEL;
  promptVersion: string;
  pointerSelectionCount: number;
  invalidPointerCount: number;
  pointerIssues: PointerSelectionIssue[];
  generatedCount: number;
  publishedCount: number;
  manualReviewCount: number;
  rejectedCount: number;
  items: FactoryReviewItem[];
}

export interface FactoryManifest {
  schemaVersion: typeof FACTORY_SCHEMA_VERSION;
  runId: string;
  startedAt: string;
  completedAt?: string;
  model: typeof FACTORY_MODEL;
  promptVersion: string;
  corpusVersion: string;
  dryRun: boolean;
  status: "completed" | "failed";
  error?: string;
  maxCny: number;
  pricingUsdPerMillion: FactoryRunConfig["pricingUsdPerMillion"];
  cnyPerUsd: number;
  requestCount: number;
  cacheHitCount: number;
  estimatedMicroCny: number;
  requests: FactoryRequestRecord[];
}

export interface FactoryCheckpoint {
  schemaVersion: typeof FACTORY_SCHEMA_VERSION;
  runId: string;
  corpusVersion: string;
  promptVersion: string;
  completedBatchIds: string[];
  pointerSelectionCount: number;
  pointerIssues: PointerSelectionIssue[];
  proposals: CandidateProposal[];
  reviewItems: FactoryReviewItem[];
}

export interface SynthesisInput {
  proposal: CandidateProposal;
  passagesById: ReadonlyMap<string, FactoryPassage>;
  semantic: SemanticReview;
  name: NameReview;
  adversarial: AdversarialReview;
  pinyin: string;
  tones: string;
  pronunciationRisks: NameRisk[];
  corpusVersion: string;
  promptVersion: string;
  runId: string;
}

export interface CandidateFeatureInput {
  style: NameStyle;
  relation: EvidenceRelation;
  nameScores: NameReviewScores;
  familyConnection: string;
}

export type FactoryFeatureVector = NameFeatureVector;
