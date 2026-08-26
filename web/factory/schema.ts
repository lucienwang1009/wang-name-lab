import type {
  AdversarialReview,
  CandidateProposal,
  FactoryCandidateFile,
  NameReview,
  NameReviewScores,
  ReviewDecision,
  SemanticReview,
  SourceCharacterRef,
} from "./types.ts";
import { FACTORY_MODEL, FACTORY_SCHEMA_VERSION } from "./types.ts";

const relations = new Set([
  "exact-phrase",
  "clause-related",
  "passage-related",
  "cultural-recomposition",
]);
const decisions = new Set<ReviewDecision>(["approve", "manual-review", "reject"]);
const styles = new Set(["classical", "graceful", "gentle", "bright", "austere", "modern"]);

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} 必须是对象。`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, { allowEmpty = false } = {}): string {
  if (typeof value !== "string" || (!allowEmpty && value.trim().length === 0)) {
    throw new TypeError(`${label} 必须是${allowEmpty ? "" : "非空"}字符串。`);
  }
  return value;
}

function unit(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new TypeError(`${label} 必须在 0 到 1 之间。`);
  }
  return value;
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new TypeError(`${label} 必须是字符串数组。`);
  }
  return value;
}

function decision(value: unknown, label: string): ReviewDecision {
  if (typeof value !== "string" || !decisions.has(value as ReviewDecision)) {
    throw new TypeError(`${label} 不是有效审核结论。`);
  }
  return value as ReviewDecision;
}

function sourceRef(value: unknown, label: string): SourceCharacterRef {
  const item = record(value, label);
  const character = text(item.character, `${label}.character`);
  if ([...character].length !== 1) throw new TypeError(`${label}.character 必须是单字。`);
  const occurrence = item.occurrence;
  if (!Number.isSafeInteger(occurrence) || Number(occurrence) < 0) {
    throw new TypeError(`${label}.occurrence 必须是非负整数。`);
  }
  return {
    character,
    passageId: text(item.passageId, `${label}.passageId`),
    occurrence: Number(occurrence),
  };
}

export function parseCandidateProposal(value: unknown): CandidateProposal {
  const item = record(value, "候选提案");
  const givenName = text(item.givenName, "givenName");
  if ([...givenName].length !== 2 || !/^\p{Script=Han}{2}$/u.test(givenName)) {
    throw new TypeError("givenName 必须是两个汉字。");
  }
  if (typeof item.relation !== "string" || !relations.has(item.relation)) {
    throw new TypeError("relation 不是有效取字关系。");
  }
  if (!Array.isArray(item.sources) || item.sources.length !== 2) {
    throw new TypeError("sources 必须包含两个字的来源。");
  }
  const sources = [
    sourceRef(item.sources[0], "sources[0]"),
    sourceRef(item.sources[1], "sources[1]"),
  ] as [SourceCharacterRef, SourceCharacterRef];
  if (sources.map(({ character }) => character).join("") !== givenName) {
    throw new TypeError("sources 中的字必须按顺序组成 givenName。");
  }
  return {
    proposalId: text(item.proposalId, "proposalId"),
    givenName,
    relation: item.relation as CandidateProposal["relation"],
    sources,
    extraction: text(item.extraction, "extraction"),
    meaning: text(item.meaning, "meaning"),
    rationale: text(item.rationale, "rationale"),
    imageryCategory: text(item.imageryCategory, "imageryCategory"),
    familyConnection: text(item.familyConnection, "familyConnection", { allowEmpty: true }),
  };
}

export function parseProposalList(value: unknown): CandidateProposal[] {
  const item = record(value, "生成响应");
  if (!Array.isArray(item.proposals)) throw new TypeError("生成响应缺少 proposals 数组。");
  return item.proposals.map(parseCandidateProposal);
}

export function parseSemanticReview(value: unknown): SemanticReview {
  const item = record(value, "语义审核");
  return {
    proposalId: text(item.proposalId, "proposalId"),
    decision: decision(item.decision, "decision"),
    semanticScore: unit(item.semanticScore, "semanticScore"),
    evidenceScore: unit(item.evidenceScore, "evidenceScore"),
    explanation: text(item.explanation, "explanation"),
    risks: stringArray(item.risks, "risks"),
  };
}

export function parseSemanticReviewList(value: unknown): SemanticReview[] {
  const item = record(value, "语义审核响应");
  if (!Array.isArray(item.reviews)) throw new TypeError("语义审核响应缺少 reviews 数组。");
  return item.reviews.map(parseSemanticReview);
}

function parseNameScores(value: unknown): NameReviewScores {
  const item = record(value, "姓名分项");
  return {
    phonology: unit(item.phonology, "phonology"),
    nameFeel: unit(item.nameFeel, "nameFeel"),
    femininity: unit(item.femininity, "femininity"),
    usability: unit(item.usability, "usability"),
    distinctiveness: unit(item.distinctiveness, "distinctiveness"),
  };
}

export function parseNameReview(value: unknown): NameReview {
  const item = record(value, "姓名感审核");
  if (typeof item.primaryStyle !== "string" || !styles.has(item.primaryStyle)) {
    throw new TypeError("primaryStyle 不是有效风格。");
  }
  return {
    proposalId: text(item.proposalId, "proposalId"),
    decision: decision(item.decision, "decision"),
    scores: parseNameScores(item.scores),
    primaryStyle: item.primaryStyle as NameReview["primaryStyle"],
    pronunciationNote: text(item.pronunciationNote, "pronunciationNote"),
    usabilityNote: text(item.usabilityNote, "usabilityNote"),
    uncommonnessNote: text(item.uncommonnessNote, "uncommonnessNote"),
    risks: stringArray(item.risks, "risks"),
  };
}

export function parseNameReviewList(value: unknown): NameReview[] {
  const item = record(value, "姓名感审核响应");
  if (!Array.isArray(item.reviews)) throw new TypeError("姓名感审核响应缺少 reviews 数组。");
  return item.reviews.map(parseNameReview);
}

export function parseAdversarialReview(value: unknown): AdversarialReview {
  const item = record(value, "对抗复审");
  return {
    proposalId: text(item.proposalId, "proposalId"),
    decision: decision(item.decision, "decision"),
    critique: text(item.critique, "critique"),
    fatalIssues: stringArray(item.fatalIssues, "fatalIssues"),
  };
}

export function parseAdversarialReviewList(value: unknown): AdversarialReview[] {
  const item = record(value, "对抗复审响应");
  if (!Array.isArray(item.reviews)) throw new TypeError("对抗复审响应缺少 reviews 数组。");
  return item.reviews.map(parseAdversarialReview);
}

export function parseFactoryCandidateFile(value: unknown): FactoryCandidateFile {
  const item = record(value, "候选发布文件");
  if (item.schemaVersion !== FACTORY_SCHEMA_VERSION || item.model !== FACTORY_MODEL) {
    throw new TypeError("候选发布文件版本或模型无效。");
  }
  if (!Array.isArray(item.candidates) || item.count !== item.candidates.length) {
    throw new TypeError("候选发布文件数量无效。");
  }
  for (const candidateValue of item.candidates) {
    const candidate = record(candidateValue, "发布候选");
    const evidence = record(candidate.evidence, "发布候选.evidence");
    if (
      typeof candidate.givenName !== "string" ||
      [...candidate.givenName].length !== 2 ||
      candidate.eligibility !== "recommendable" ||
      evidence.reviewStatus !== "ai-reviewed"
    ) {
      throw new TypeError("发布候选必须是已通过 AI 审核的双字推荐名。");
    }
  }
  return item as unknown as FactoryCandidateFile;
}

export const proposalListJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["proposals"],
  properties: {
    proposals: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["proposalId", "givenName", "relation", "sources", "extraction", "meaning", "rationale", "imageryCategory", "familyConnection"],
        properties: {
          proposalId: { type: "string" },
          givenName: { type: "string" },
          relation: { type: "string", enum: [...relations] },
          sources: {
            type: "array",
            minItems: 2,
            maxItems: 2,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["character", "passageId", "occurrence"],
              properties: {
                character: { type: "string" },
                passageId: { type: "string" },
                occurrence: { type: "integer", minimum: 0 },
              },
            },
          },
          extraction: { type: "string" },
          meaning: { type: "string" },
          rationale: { type: "string" },
          imageryCategory: { type: "string" },
          familyConnection: { type: "string" },
        },
      },
    },
  },
} as const;

const reviewBase = {
  proposalId: { type: "string" },
  decision: { type: "string", enum: [...decisions] },
} as const;

export const semanticReviewListJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reviews"],
  properties: {
    reviews: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["proposalId", "decision", "semanticScore", "evidenceScore", "explanation", "risks"],
        properties: {
          ...reviewBase,
          semanticScore: { type: "number", minimum: 0, maximum: 1 },
          evidenceScore: { type: "number", minimum: 0, maximum: 1 },
          explanation: { type: "string" },
          risks: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

export const nameReviewListJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reviews"],
  properties: {
    reviews: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["proposalId", "decision", "scores", "primaryStyle", "pronunciationNote", "usabilityNote", "uncommonnessNote", "risks"],
        properties: {
          ...reviewBase,
          scores: {
            type: "object",
            additionalProperties: false,
            required: ["phonology", "nameFeel", "femininity", "usability", "distinctiveness"],
            properties: Object.fromEntries(
              ["phonology", "nameFeel", "femininity", "usability", "distinctiveness"].map((key) => [key, { type: "number", minimum: 0, maximum: 1 }]),
            ),
          },
          primaryStyle: { type: "string", enum: [...styles] },
          pronunciationNote: { type: "string" },
          usabilityNote: { type: "string" },
          uncommonnessNote: { type: "string" },
          risks: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

export const adversarialReviewListJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reviews"],
  properties: {
    reviews: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["proposalId", "decision", "critique", "fatalIssues"],
        properties: {
          ...reviewBase,
          critique: { type: "string" },
          fatalIssues: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

