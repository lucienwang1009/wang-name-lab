export type SourceGrade = "A" | "B" | "C" | "D";
export type GateStatus = "通过" | "不通过";
export type BirthStatus = "未出生" | "已出生";

export interface CharacterEntry {
  char: string;
  category: string;
  meaning: string;
  feminine: number;
  rarity: number;
  usability: number;
  familyTag: "" | "玉" | "影" | "绍";
  folkElement: string;
  elementCaveat: string;
}

export interface ClassicalFragment {
  id: string;
  corpus: string;
  source: string;
  quote: string;
  scene: string;
  contextTone: string;
  url: string;
}

export interface CandidateScores {
  feminine: number;
  source: number;
  family: number;
  rarity: number;
  phonology: number;
  usability: number;
}

export interface CuratedCandidate {
  name: string;
  pinyin: string;
  tones: string;
  source: string;
  quote: string;
  extraction: string;
  grade: SourceGrade;
  scores: CandidateScores;
  gate: GateStatus;
  familyNote: string;
  risk: string;
  url: string;
  folkElements: string;
}

export interface RawNameCandidate {
  id: string;
  name: string;
  first: string;
  second: string;
  firstCategory: string;
  secondCategory: string;
  feminineProxy: number;
  familyProxy: number;
  rarityProxy: number;
  usabilityProxy: number;
  status: "待核典";
  evidence: string;
}

export interface AllusionCandidate {
  id: string;
  fragmentId: string;
  name: string;
  first: string;
  second: string;
  corpus: string;
  source: string;
  quote: string;
  extraction: string;
  grade: "A" | "B";
  scene: string;
  contextTone: string;
  url: string;
  reviewStatus: "机器生成，待人工精审";
}

export type EvidenceMatchGrade = "A" | "B" | "C" | "D" | "E" | "F";

export type EvidenceRelation =
  | "exact-phrase"
  | "clause-related"
  | "passage-related"
  | "cultural-recomposition";

export type EvidenceReviewStatus =
  | "reviewed"
  | "ai-reviewed"
  | "rule-screened"
  | "automatic";
export type RecommendationEligibility =
  | "recommendable"
  | "provisional"
  | "search-only"
  | "blocked";

export interface NameFeatureVector {
  classical: number;
  graceful: number;
  gentle: number;
  bright: number;
  austere: number;
  modern: number;
  pronounceable: number;
  writable: number;
  recognizable: number;
  uncommon: number;
  familyMeaning: number;
  exactPhrasePreference: number;
  recompositionPreference: number;
}

export type NameStyle =
  | "classical"
  | "graceful"
  | "gentle"
  | "bright"
  | "austere"
  | "modern";

export interface NameQuality {
  pinyin: string;
  tones: string;
  meaning: string;
  semanticExplanation: string;
  pronunciationNote: string;
  usabilityNote: string;
  uncommonnessNote: string;
  primaryStyle: NameStyle;
  imageryCategory: string;
}

export type NameRiskKind =
  | "registration"
  | "source-context"
  | "pronunciation"
  | "usability"
  | "name-collision";

export interface NameRisk {
  code: string;
  kind: NameRiskKind;
  severity: "hard" | "review" | "note";
  summary: string;
}

export interface PersonalizedEvidenceCitation {
  id: string;
  passageId?: string;
  matchedChar?: string;
  occurrence?: number;
  bookId: string;
  bookTitle: string;
  workTitle: string;
  chapterTitle: string;
  quote: string;
  sourceUrl: string;
  verificationUrl: string;
}

export interface CandidateFactoryScores {
  phonology: number;
  nameFeel: number;
  femininity: number;
  usability: number;
  distinctiveness: number;
}

export interface CandidateFactoryAudit {
  model: "deepseek-v4-flash";
  promptVersion: string;
  corpusVersion: string;
  runId: string;
  proposalId: string;
  semantic: {
    semanticScore: number;
    evidenceScore: number;
    explanation: string;
  };
  name: CandidateFactoryScores;
  adversarialCritique: string;
}

export interface PersonalizedEvidence {
  relation: EvidenceRelation;
  reviewStatus: EvidenceReviewStatus;
  extraction: string;
  citations: PersonalizedEvidenceCitation[];
}

export interface PersonalizedCandidate {
  id: string;
  surname: string;
  givenName: string;
  fullName: string;
  evidence: PersonalizedEvidence;
  features: NameFeatureVector;
  quality: NameQuality;
  eligibility: RecommendationEligibility;
  risks: NameRisk[];
  factoryAudit?: CandidateFactoryAudit;
}

export interface ClassicalEvidenceCitation {
  fragmentId: string;
  matchedChar: string;
  corpus: string;
  source: string;
  quote: string;
  scene: string;
  contextTone: string;
  url: string;
}

export interface ClassicalEvidenceMatch {
  id: string;
  givenName: string;
  matchedChars: string[];
  grade: EvidenceMatchGrade;
  corpus: string;
  source: string;
  quote: string;
  extraction: string;
  scene: string;
  contextTone: string;
  url: string;
  citations: ClassicalEvidenceCitation[];
}

export interface BirthScenario {
  id: string;
  date: string;
  hourBranch: string;
  timeRange: string;
  yearMonthNote: string;
  status: "仅情景占位，不计算喜用神";
}

export interface TraditionalReferenceOptions {
  birthStatus: BirthStatus;
  metaphysicsWeight: number;
  metaphysicsScore?: number;
}

export interface TraditionalReferenceResult {
  effectiveMetaphysicsWeight: number;
  adjustedPersonalFit: number | null;
  status:
    | "硬性淘汰"
    | "待出生后录入"
    | "待传统参考说明"
    | "已记录传统参考";
}
