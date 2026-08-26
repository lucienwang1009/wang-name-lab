import { describe, expect, it } from "vitest";

import type { CuratedCandidate } from "../domain/types";
import type { CorpusDiscoveryCandidate } from "./types";
import {
  buildRecommendationPool,
  type ReviewedSeedMetadata,
} from "./buildRecommendationPool";

const sourceUrl = "https://example.com/source";

function discovery(
  givenName: string,
  quote: string,
  passageId = `passage:${givenName}`,
): CorpusDiscoveryCandidate {
  return {
    id: `discovery:${givenName}:${passageId}`,
    givenName,
    grade: "A",
    bookId: "shi-jing",
    bookTitle: "诗经",
    category: "经",
    passageId,
    workTitle: "大雅",
    chapterTitle: "烝民",
    quote,
    extraction: `转录字符连续：${givenName}`,
    sourceUrl,
    verificationUrl: `${sourceUrl}/verify`,
    feminine: 4,
    rarity: 4,
    usability: 4,
    familyScore: 0,
    firstCategory: "姿容德性",
    secondCategory: "姿容德性",
  };
}

function curated(
  name: string,
  gate: CuratedCandidate["gate"] = "通过",
): CuratedCandidate {
  return {
    name: `王${name}`,
    pinyin: "Wáng Lìng-yí",
    tones: "2-4-2",
    source: "《诗经·大雅·烝民》",
    quote: "令仪令色。",
    extraction: `原文连续：${name}`,
    grade: "A",
    scores: {
      feminine: 5,
      source: 5,
      family: 1,
      rarity: 3,
      phonology: 5,
      usability: 5,
    },
    gate,
    familyNote: "作为风格基准",
    risk: gate === "通过" ? "典故稳定" : "原句为负面语境",
    url: sourceUrl,
    folkElements: "仅作民俗记录",
  };
}

const reviewedSeeds: Record<string, ReviewedSeedMetadata> = {
  令仪: {
    meaning: "端正美好的仪范。",
    semanticExplanation: "令与仪在原句中构成完整词义。",
    primaryStyle: "graceful",
    imageryCategory: "德仪风范",
  },
};

describe("方法论 V2 推荐池", () => {
  it("合并 AI 审核候选，并让人工精审优先于同名 AI 记录", () => {
    const generated = {
      id: "personalized:令仪",
      surname: "王",
      givenName: "令仪",
      fullName: "王令仪",
      evidence: {
        relation: "exact-phrase" as const,
        reviewStatus: "ai-reviewed" as const,
        extraction: "AI 连续取字",
        citations: [{
          id: "ai:令仪",
          bookId: "shi-jing",
          bookTitle: "《诗经》",
          workTitle: "烝民",
          chapterTitle: "大雅",
          quote: "柔嘉维则，令仪令色。",
          sourceUrl,
          verificationUrl: `${sourceUrl}/verify`,
        }],
      },
      features: { classical: 0.9, graceful: 0.9, gentle: 0.5, bright: 0.5, austere: 0.4, modern: 0.1, pronounceable: 0.9, writable: 0.9, recognizable: 0.9, uncommon: 0.7, familyMeaning: 0.1, exactPhrasePreference: 1, recompositionPreference: 0.1 },
      quality: { pinyin: "wáng lìng yí", tones: "2-4-2", meaning: "AI 释义", semanticExplanation: "AI 多重审核通过", pronunciationNote: "自然", usabilityNote: "可用", uncommonnessNote: "少见", primaryStyle: "graceful" as const, imageryCategory: "仪范" },
      eligibility: "recommendable" as const,
      risks: [],
    };
    const aiOnly = buildRecommendationPool({
      curatedCandidates: [],
      discoveryCandidates: [],
      generatedCandidates: [generated],
      reviewedSeeds: {},
    });
    expect(aiOnly.recommendable[0]?.evidence.reviewStatus).toBe("ai-reviewed");

    const withHuman = buildRecommendationPool({
      curatedCandidates: [curated("令仪")],
      discoveryCandidates: [],
      generatedCandidates: [generated],
      reviewedSeeds,
    });
    expect(withHuman.recommendable[0]).toMatchObject({
      evidence: { reviewStatus: "reviewed" },
      quality: { meaning: "端正美好的仪范。" },
    });
    expect(withHuman.recommendable[0]?.evidence.citations).toHaveLength(2);
  });

  it("区分人工精审、规则粗筛和仅检索", () => {
    const pool = buildRecommendationPool({
      curatedCandidates: [curated("令仪")],
      discoveryCandidates: [
        discovery("令仪", "令仪令色。", "passage:reviewed"),
        discovery("残片", "残片只是自动相邻字。"),
      ],
      reviewedSeeds,
    });

    expect(pool.recommendable.map((item) => item.givenName)).toContain("令仪");
    expect(pool.provisional.map((item) => item.givenName)).toContain("残片");
    expect(pool.recommendable.map((item) => item.givenName)).not.toContain("残片");
    expect(pool.provisional[0]).toMatchObject({
      eligibility: "provisional",
      evidence: { reviewStatus: "rule-screened" },
    });
  });

  it("同句近距、叠字和低代理指标仍只用于检索", () => {
    const near = { ...discovery("清影", "清光照影。"), grade: "B" as const };
    const repeated = discovery("清清", "清清水色。", "passage:repeated");
    const lowUsability = {
      ...discovery("清影", "清影相随。", "passage:low"),
      usability: 3.2,
    };
    const pool = buildRecommendationPool({
      curatedCandidates: [],
      discoveryCandidates: [near, repeated, lowUsability],
      reviewedSeeds: {},
    });

    expect(pool.provisional).toHaveLength(0);
    expect(pool.searchOnly.map((item) => item.givenName).sort()).toEqual([
      "清影",
      "清清",
    ]);
  });

  it("负面上下文和人工硬筛候选不能进入推荐", () => {
    const pool = buildRecommendationPool({
      curatedCandidates: [curated("玉影", "不通过")],
      discoveryCandidates: [discovery("兵死", "兵死墓葬哀悼之文。")],
      reviewedSeeds,
    });

    expect(pool.recommendable.map((item) => item.givenName)).not.toContain("兵死");
    expect(pool.blocked.map((item) => item.givenName)).toEqual(["兵死", "玉影"]);
  });

  it("合并同名的不同出处并保持确定性", () => {
    const input = {
      curatedCandidates: [curated("令仪")],
      discoveryCandidates: [
        discovery("令仪", "莫不令仪。", "passage:second"),
        discovery("令仪", "令仪令色。", "passage:first"),
      ],
      reviewedSeeds,
    };

    const first = buildRecommendationPool(input);
    const second = buildRecommendationPool({
      ...input,
      discoveryCandidates: [...input.discoveryCandidates].reverse(),
    });

    expect(first).toEqual(second);
    expect(first.recommendable[0]?.evidence.citations).toHaveLength(3);
  });
});
