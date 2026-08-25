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
  it("只把具备名字级说明的人工核验种子放入主动推荐", () => {
    const pool = buildRecommendationPool({
      curatedCandidates: [curated("令仪")],
      discoveryCandidates: [
        discovery("令仪", "令仪令色。", "passage:reviewed"),
        discovery("残片", "残片只是自动相邻字。"),
      ],
      reviewedSeeds,
    });

    expect(pool.recommendable.map((item) => item.givenName)).toContain("令仪");
    expect(pool.searchOnly.map((item) => item.givenName)).toContain("残片");
    expect(pool.recommendable.map((item) => item.givenName)).not.toContain("残片");
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
