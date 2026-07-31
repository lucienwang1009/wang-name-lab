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

export interface BirthScenario {
  id: string;
  date: string;
  hourBranch: string;
  timeRange: string;
  yearMonthNote: string;
  status: "仅情景占位，不计算喜用神";
}

export interface RerankOptions {
  birthStatus: BirthStatus;
  metaphysicsWeight: number;
  metaphysicsScore?: number;
}

export interface RerankResult {
  culturalScore: number;
  effectiveMetaphysicsWeight: number;
  finalScore: number;
  status: "硬筛淘汰" | "待出生后录入" | "待命理评分" | "已复排";
}

