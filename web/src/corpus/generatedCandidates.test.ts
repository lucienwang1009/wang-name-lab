import { describe, expect, it } from "vitest";

import type { PersonalizedCandidate } from "../domain/types.ts";
import type { CorpusPassage } from "./types.ts";
import {
  parseGeneratedCandidateArtifact,
  verifyGeneratedCandidateArtifacts,
  verifyGeneratedCandidateEvidence,
} from "./generatedCandidates.ts";

const passage: CorpusPassage = {
  id: "shi-jing/work-1/passage-1",
  bookId: "shi-jing",
  workId: "shi-jing/work-1",
  chapterId: "shi-jing/chapter-1",
  workTitle: "烝民",
  chapterTitle: "大雅",
  order: 0,
  text: "柔嘉维则，令仪令色。",
  normalizedText: "柔嘉维则令仪令色",
  sourceUrl: "https://example.test/source",
  verificationUrl: "https://example.test/verify",
};

const candidate: PersonalizedCandidate = {
  id: "personalized:令仪",
  surname: "王",
  givenName: "令仪",
  fullName: "王令仪",
  evidence: {
    relation: "exact-phrase",
    reviewStatus: "ai-reviewed",
    extraction: "连续取字",
    citations: [
      { id: `${passage.id}:令:0`, passageId: passage.id, matchedChar: "令", occurrence: 0, bookId: passage.bookId, bookTitle: "《诗经》", workTitle: passage.workTitle, chapterTitle: passage.chapterTitle, quote: passage.text, sourceUrl: passage.sourceUrl, verificationUrl: passage.verificationUrl },
      { id: `${passage.id}:仪:0`, passageId: passage.id, matchedChar: "仪", occurrence: 0, bookId: passage.bookId, bookTitle: "《诗经》", workTitle: passage.workTitle, chapterTitle: passage.chapterTitle, quote: passage.text, sourceUrl: passage.sourceUrl, verificationUrl: passage.verificationUrl },
    ],
  },
  features: { classical: 0.9, graceful: 0.9, gentle: 0.5, bright: 0.4, austere: 0.4, modern: 0.2, pronounceable: 0.9, writable: 0.9, recognizable: 0.9, uncommon: 0.7, familyMeaning: 0.1, exactPhrasePreference: 1, recompositionPreference: 0.1 },
  quality: { pinyin: "wáng lìng yí", tones: "2-4-2", meaning: "端美的仪度", semanticExplanation: "语义成立", pronunciationNote: "自然", usabilityNote: "可用", uncommonnessNote: "少见", primaryStyle: "graceful", imageryCategory: "仪范" },
  eligibility: "recommendable",
  risks: [],
  factoryAudit: {
    model: "deepseek-v4-flash",
    promptVersion: "test-v1",
    corpusVersion: "fixture-v1",
    runId: "test-run",
    proposalId: "batch:令仪",
    semantic: { semanticScore: 0.9, evidenceScore: 0.9, explanation: "语义成立" },
    name: { phonology: 0.9, nameFeel: 0.9, femininity: 0.9, usability: 0.9, distinctiveness: 0.8 },
    adversarialCritique: "无致命问题",
  },
};

function artifact(candidates: PersonalizedCandidate[] = [candidate]) {
  return {
    schemaVersion: 1,
    model: "deepseek-v4-flash",
    promptVersion: "test-v1",
    corpusVersion: "fixture-v1",
    runId: "test-run",
    createdAt: "2026-08-26T00:00:00.000Z",
    count: candidates.length,
    candidates,
  };
}

describe("AI 候选构建期导入", () => {
  it("验证模型、提示词、运行和语料版本", () => {
    expect(parseGeneratedCandidateArtifact(artifact(), "fixture-v1").count).toBe(1);
    const lunaCandidate = structuredClone(candidate);
    lunaCandidate.factoryAudit!.model = "gpt-5.6-luna";
    expect(parseGeneratedCandidateArtifact({
      ...artifact([lunaCandidate]),
      model: "gpt-5.6-luna",
    }, "fixture-v1").model).toBe("gpt-5.6-luna");
    expect(() => parseGeneratedCandidateArtifact({
      ...artifact(),
      model: "gpt-5.6-luna",
    }, "fixture-v1")).toThrow(/完整审核状态/);
    expect(() => parseGeneratedCandidateArtifact({ ...artifact(), corpusVersion: "stale" }, "fixture-v1"))
      .toThrow(/版本不一致/);
  });

  it("逐字回查固定语料后才允许进入推荐池", () => {
    const parsed = parseGeneratedCandidateArtifact(artifact(), "fixture-v1");
    expect(verifyGeneratedCandidateEvidence(parsed, [passage])).toEqual([candidate]);
    const tampered = structuredClone(candidate);
    tampered.evidence.citations[0]!.quote = "被篡改的原句";
    const parsedTampered = parseGeneratedCandidateArtifact(artifact([tampered]), "fixture-v1");
    expect(() => verifyGeneratedCandidateEvidence(parsedTampered, [passage])).toThrow(/固定语料不一致/);
  });

  it("拒绝缺字证据和重复姓名", () => {
    const missing = structuredClone(candidate);
    missing.evidence.citations = missing.evidence.citations.filter((citation) => citation.matchedChar !== "仪");
    expect(() => verifyGeneratedCandidateEvidence(
      parseGeneratedCandidateArtifact(artifact([missing]), "fixture-v1"),
      [passage],
    )).toThrow(/缺少语料引用/);
    expect(() => verifyGeneratedCandidateEvidence(
      parseGeneratedCandidateArtifact(artifact([candidate, candidate]), "fixture-v1"),
      [passage],
    )).toThrow(/姓名重复/);
  });

  it("允许多个审核模型产物并拒绝跨文件重名", () => {
    const deepseekArtifact = parseGeneratedCandidateArtifact(artifact(), "fixture-v1");
    const lunaCandidate = structuredClone(candidate);
    lunaCandidate.givenName = "柔嘉";
    lunaCandidate.fullName = "王柔嘉";
    lunaCandidate.id = "personalized:柔嘉";
    lunaCandidate.evidence.citations = [
      { ...candidate.evidence.citations[0]!, id: `${passage.id}:柔:0`, matchedChar: "柔", occurrence: 0 },
      { ...candidate.evidence.citations[1]!, id: `${passage.id}:嘉:0`, matchedChar: "嘉", occurrence: 0 },
    ];
    lunaCandidate.factoryAudit!.model = "gpt-5.6-luna";
    const lunaArtifact = parseGeneratedCandidateArtifact({
      ...artifact([lunaCandidate]),
      model: "gpt-5.6-luna",
    }, "fixture-v1");
    expect(verifyGeneratedCandidateArtifacts(
      [deepseekArtifact, lunaArtifact],
      [passage],
    ).map(({ givenName }) => givenName)).toEqual(["令仪", "柔嘉"]);
    expect(() => verifyGeneratedCandidateArtifacts(
      [deepseekArtifact, deepseekArtifact],
      [passage],
    )).toThrow(/跨文件重名/);
  });
});
