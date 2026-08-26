// @vitest-environment node

import { describe, expect, it } from "vitest";

import { selectDiverseCandidates, synthesizeCandidate } from "./synthesis.ts";
import type { FactoryPassage, SynthesisInput } from "./types.ts";

const passage: FactoryPassage = {
  id: "shi-jing/1",
  bookId: "shi-jing",
  bookTitle: "《诗经》",
  category: "经",
  period: "先秦",
  workTitle: "烝民",
  chapterTitle: "大雅",
  text: "柔嘉维则，令仪令色。",
  normalizedText: "柔嘉维则令仪令色",
  sourceUrl: "https://example.test/source",
  verificationUrl: "https://example.test/verify",
  score: 100,
};

function input(givenName = "令仪"): SynthesisInput {
  return {
    proposal: {
      proposalId: `batch:${givenName}`,
      givenName,
      relation: "exact-phrase",
      sources: [
        { character: givenName[0] ?? "令", passageId: passage.id, occurrence: 0 },
        { character: givenName[1] ?? "仪", passageId: passage.id, occurrence: 0 },
      ],
      extraction: "连续取字",
      meaning: "端美的仪度",
      rationale: "完整",
      imageryCategory: givenName === "令仪" ? "仪范" : "德性",
      familyConnection: "",
    },
    passagesById: new Map([[passage.id, passage]]),
    semantic: { proposalId: `batch:${givenName}`, decision: "approve", semanticScore: 0.9, evidenceScore: 0.95, explanation: "语义完整。", risks: [] },
    name: {
      proposalId: `batch:${givenName}`,
      decision: "approve",
      scores: { phonology: 0.9, nameFeel: 0.92, femininity: 0.86, usability: 0.9, distinctiveness: 0.78 },
      primaryStyle: "graceful",
      pronunciationNote: "声调起伏清楚。",
      usabilityNote: "易识读。",
      uncommonnessNote: "少见度为代理判断。",
      risks: [],
    },
    adversarial: { proposalId: `batch:${givenName}`, decision: "approve", critique: "未发现致命问题。", fatalIssues: [] },
    pinyin: "wáng lìng yí",
    tones: "2-4-2",
    pronunciationRisks: [],
    corpusVersion: "fixture-v1",
    promptVersion: "test-v1",
    runId: "test-run",
  };
}

describe("候选发布合成", () => {
  it("生成证据、特征、读音和审核审计完整的 AI 候选", () => {
    const candidate = synthesizeCandidate(input());
    expect(candidate).toMatchObject({
      fullName: "王令仪",
      eligibility: "recommendable",
      evidence: { reviewStatus: "ai-reviewed", relation: "exact-phrase" },
      quality: { pinyin: "wáng lìng yí", tones: "2-4-2" },
      factoryAudit: { model: "deepseek-v4-flash", corpusVersion: "fixture-v1" },
    });
    expect(candidate.evidence.citations[0]?.quote).toContain("令仪");
  });

  it("不允许未通过全部审核的候选被发布", () => {
    const rejected = input();
    rejected.adversarial.decision = "reject";
    expect(() => synthesizeCandidate(rejected)).toThrow(/不能发布/);
  });

  it("按质量和字符、书目、意象约束选择多样候选", () => {
    const names = ["令仪", "柔嘉", "静嘉", "清嘉", "明嘉"];
    const candidates = names.map((name, index) => {
      const value = input(name);
      value.name.scores.nameFeel -= index * 0.01;
      return synthesizeCandidate(value);
    });
    const selected = selectDiverseCandidates(candidates, 3);
    expect(selected).toHaveLength(3);
    expect(selected[0]?.givenName).toBe("令仪");
    expect(selected.filter((candidate) => candidate.givenName.includes("嘉"))).toHaveLength(2);
  });
});

