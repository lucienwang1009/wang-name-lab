import { normalizeSearchText } from "./normalizeText.ts";
import { recommendationEligibility } from "../domain/nameFeatures.ts";
import type { PersonalizedCandidate } from "../domain/types.ts";
import type { CorpusPassage } from "./types.ts";

export interface GeneratedCandidateArtifact {
  schemaVersion: 1;
  model: "deepseek-v4-flash" | "gpt-5.6-luna";
  promptVersion: string;
  corpusVersion: string;
  runId: string;
  createdAt: string;
  count: number;
  candidates: PersonalizedCandidate[];
}

const SUPPORTED_REVIEW_MODELS = new Set([
  "deepseek-v4-flash",
  "gpt-5.6-luna",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseGeneratedCandidateArtifact(
  value: unknown,
  expectedCorpusVersion: string,
): GeneratedCandidateArtifact {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !SUPPORTED_REVIEW_MODELS.has(String(value.model)) ||
    value.corpusVersion !== expectedCorpusVersion ||
    typeof value.promptVersion !== "string" ||
    typeof value.runId !== "string" ||
    typeof value.createdAt !== "string" ||
    !Array.isArray(value.candidates) ||
    value.count !== value.candidates.length
  ) {
    throw new TypeError("AI 候选发布文件格式无效或与当前全文库版本不一致。");
  }
  for (const candidate of value.candidates) {
    if (
      !isRecord(candidate) ||
      !isRecord(candidate.evidence) ||
      !isRecord(candidate.factoryAudit) ||
      candidate.eligibility !== "recommendable" ||
      candidate.evidence.reviewStatus !== "ai-reviewed" ||
      candidate.factoryAudit.model !== value.model ||
      candidate.factoryAudit.corpusVersion !== expectedCorpusVersion ||
      candidate.factoryAudit.promptVersion !== value.promptVersion ||
      candidate.factoryAudit.runId !== value.runId
    ) {
      throw new TypeError("AI 候选缺少完整审核状态或版本审计。");
    }
  }
  return value as unknown as GeneratedCandidateArtifact;
}

function occurrenceExists(text: string, character: string, occurrence: number): boolean {
  const normalizedCharacter = normalizeSearchText(character);
  const matches = [...normalizeSearchText(text)].filter((item) => item === normalizedCharacter);
  return Number.isSafeInteger(occurrence) && occurrence >= 0 && occurrence < matches.length;
}

export function verifyGeneratedCandidateEvidence(
  artifact: GeneratedCandidateArtifact,
  passages: readonly CorpusPassage[],
): PersonalizedCandidate[] {
  const passagesById = new Map(passages.map((passage) => [passage.id, passage]));
  const seenNames = new Set<string>();
  for (const candidate of artifact.candidates) {
    if (seenNames.has(candidate.givenName)) {
      throw new Error(`AI 候选姓名重复：${candidate.givenName}。`);
    }
    seenNames.add(candidate.givenName);
    if ([...candidate.givenName].length !== 2 || candidate.fullName !== `王${candidate.givenName}`) {
      throw new Error(`AI 候选 ${candidate.givenName} 不是有效的王姓双字名。`);
    }
    if (recommendationEligibility(candidate) !== "recommendable") {
      throw new Error(`AI 候选 ${candidate.givenName} 未达到可推荐门槛。`);
    }
    const matchedCharacters = new Set<string>();
    for (const citation of candidate.evidence.citations) {
      if (!citation.passageId || !citation.matchedChar || citation.occurrence === undefined) {
        throw new Error(`AI 候选 ${candidate.givenName} 的引用缺少精确段落、取字或出现序号。`);
      }
      const passage = passagesById.get(citation.passageId);
      if (!passage) throw new Error(`AI 候选 ${candidate.givenName} 引用了不存在的段落 ${citation.passageId}。`);
      if (
        citation.quote !== passage.text ||
        citation.bookId !== passage.bookId ||
        citation.workTitle !== passage.workTitle ||
        citation.chapterTitle !== passage.chapterTitle ||
        citation.sourceUrl !== passage.sourceUrl ||
        citation.verificationUrl !== passage.verificationUrl
      ) {
        throw new Error(`AI 候选 ${candidate.givenName} 的引用内容与固定语料不一致。`);
      }
      if (!occurrenceExists(passage.text, citation.matchedChar, citation.occurrence)) {
        throw new Error(`AI 候选 ${candidate.givenName} 的取字位置无法在固定语料复核。`);
      }
      matchedCharacters.add(normalizeSearchText(citation.matchedChar));
    }
    for (const character of normalizeSearchText(candidate.givenName)) {
      if (!matchedCharacters.has(character)) {
        throw new Error(`AI 候选 ${candidate.givenName} 的“${character}”缺少语料引用。`);
      }
    }
  }
  return [...artifact.candidates];
}

export function verifyGeneratedCandidateArtifacts(
  artifacts: readonly GeneratedCandidateArtifact[],
  passages: readonly CorpusPassage[],
): PersonalizedCandidate[] {
  const candidates = artifacts.flatMap((artifact) =>
    verifyGeneratedCandidateEvidence(artifact, passages)
  );
  const seenNames = new Set<string>();
  for (const candidate of candidates) {
    if (seenNames.has(candidate.givenName)) {
      throw new Error(`不同 AI 审核产物中存在跨文件重名：${candidate.givenName}。`);
    }
    seenNames.add(candidate.givenName);
  }
  return candidates;
}

export function emptyGeneratedCandidateArtifact(corpusVersion: string): GeneratedCandidateArtifact {
  return {
    schemaVersion: 1,
    model: "deepseek-v4-flash",
    promptVersion: "none",
    corpusVersion,
    runId: "none",
    createdAt: "1970-01-01T00:00:00.000Z",
    count: 0,
    candidates: [],
  };
}
