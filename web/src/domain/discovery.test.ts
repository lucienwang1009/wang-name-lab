import { describe, expect, it } from "vitest";

import type { CorpusDiscoveryCandidate } from "../corpus/types";
import type { CuratedCandidate } from "./types";
import {
  filterDiscoveryCandidates,
  mergeDiscoveryCandidates,
  sampleDiscoveryCandidates,
} from "./discovery";

function corpus(givenName: string, grade: "A" | "B" = "A"): CorpusDiscoveryCandidate {
  return {
    id: `corpus:${givenName}`,
    givenName,
    grade,
    bookId: "shi-jing",
    bookTitle: "《诗经》",
    category: "经",
    passageId: `passage:${givenName}`,
    workTitle: "烝民",
    chapterTitle: "大雅",
    quote: "令仪令色。",
    extraction: `原文连续：${givenName}`,
    sourceUrl: "https://example.com/source",
    verificationUrl: "https://example.com/verify",
    feminine: 4.5,
    rarity: 3.5,
    usability: 4.5,
    familyScore: 0,
  };
}

function curated(name: string, grade: CuratedCandidate["grade"] = "A"): CuratedCandidate {
  return {
    name,
    pinyin: "Wáng Lìng-yí",
    tones: "2-4-2",
    source: "《诗经·大雅·烝民》",
    quote: "令仪令色。",
    extraction: "原文连续：令仪",
    grade,
    scores: {
      feminine: 4.8,
      source: 5,
      family: 1,
      rarity: 3,
      phonology: 4.7,
      usability: 5,
    },
    gate: "通过",
    familyNote: "风格基准",
    risk: "典故相对熟悉",
    url: "https://example.com/verify",
    folkElements: "仅记录",
  };
}

describe("统一典籍寻名池", () => {
  it("人工精选覆盖同名全文发现项，同时保留来源标记", () => {
    const merged = mergeDiscoveryCandidates(
      [corpus("令仪"), corpus("景玉", "B")],
      [curated("王令仪")],
    );

    expect(merged).toHaveLength(2);
    expect(merged.find((item) => item.name === "王令仪")?.origin).toBe("curated");
    expect(merged.find((item) => item.name === "王景玉")?.origin).toBe("corpus");
  });

  it("默认只展示 A/B，人工精选模式可单独查看通过精审的 C 级", () => {
    const merged = mergeDiscoveryCandidates(
      [corpus("令仪"), corpus("景玉", "B")],
      [curated("王皎莹", "C")],
    );

    expect(filterDiscoveryCandidates(merged, "evidence", [])).toHaveLength(2);
    expect(filterDiscoveryCandidates(merged, "a-only", []).map((item) => item.grade))
      .toEqual(["A"]);
    expect(filterDiscoveryCandidates(merged, "curated", []).map((item) => item.name))
      .toEqual(["王皎莹"]);
  });

  it("默认随机层排除女性感偏低和叠字候选，收藏模式仍可主动找回", () => {
    const lowFeminine = { ...corpus("景行"), feminine: 3.5 };
    const repeated = corpus("昭昭");
    const merged = mergeDiscoveryCandidates([lowFeminine, repeated], []);

    expect(filterDiscoveryCandidates(merged, "evidence", [])).toEqual([]);
    expect(
      filterDiscoveryCandidates(merged, "favorites", ["王景行"]).map(
        (item) => item.name,
      ),
    ).toEqual(["王景行"]);
  });

  it("换一批时在池子足够的情况下不重复上一批", () => {
    const candidates = Array.from({ length: 8 }, (_, index) => ({
      ...corpus(`名${index}`),
      id: `candidate-${index}`,
      name: `王名${index}`,
      origin: "corpus" as const,
    }));
    const previousIds = candidates.slice(0, 4).map((item) => item.id);
    const batch = sampleDiscoveryCandidates(candidates, 4, previousIds, () => 0);

    expect(batch).toHaveLength(4);
    expect(batch.every((item) => !previousIds.includes(item.id))).toBe(true);
  });
});
