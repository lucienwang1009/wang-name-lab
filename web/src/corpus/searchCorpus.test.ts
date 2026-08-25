import { describe, expect, it, vi } from "vitest";

import { buildCorpusIndex } from "./buildIndex";
import { createCorpusSearcher } from "./searchCorpus";
import type {
  CorpusBook,
  CorpusPassage,
} from "./types";
import type { PersonalizedCandidate } from "../domain/types";

const sourceUrl = "https://example.com/pinned.json";
const verificationUrl = "https://example.com/verify";

function passage(
  bookId: string,
  workNumber: number,
  passageNumber: number,
  text: string,
  normalizedText: string,
  order: number,
): CorpusPassage {
  const workId = `${bookId}/work-${String(workNumber).padStart(4, "0")}`;
  return {
    id: `${workId}/passage-${String(passageNumber).padStart(4, "0")}`,
    bookId,
    workId,
    chapterId: `${bookId}/chapter-${String(workNumber).padStart(4, "0")}`,
    workTitle: `篇目${workNumber}`,
    chapterTitle: `卷${workNumber}`,
    order,
    text,
    normalizedText,
    sourceUrl,
    verificationUrl,
  };
}

const passages = [
  passage("book-a", 1, 1, "令儀孔昭。", "令仪孔昭", 1),
  passage("book-a", 1, 2, "令其儀。", "令其仪", 2),
  passage("book-a", 2, 1, "景行行止。", "景行行止", 3),
  passage("book-a", 2, 2, "如玉如圭。", "如玉如圭", 4),
  passage("book-a", 3, 1, "景星庆云。", "景星庆云", 5),
  passage("book-a", 4, 1, "玉振金声。", "玉振金声", 6),
  passage("book-a", 5, 1, "皎皎白驹。", "皎皎白驹", 7),
  passage("book-b", 1, 1, "舒窈纠兮。", "舒窈纠兮", 1),
  passage("book-b", 2, 1, "怀瑾握玉。", "怀瑾握玉", 2),
] as const;

const books: CorpusBook[] = [
  {
    id: "book-a",
    title: "《甲书》",
    category: "经",
    period: "先秦",
    priority: 1,
    status: "ready",
    source: {
      originUrl: sourceUrl,
      editionNote: "测试固定转录",
      rightsNote: "公版测试",
      retrievedAt: "2026-07-31",
      segmentation: "punctuated",
    },
  },
  {
    id: "book-b",
    title: "《乙书》",
    category: "集",
    period: "先秦",
    priority: 1,
    status: "ready",
    source: {
      originUrl: sourceUrl,
      editionNote: "测试固定转录",
      rightsNote: "公版测试",
      retrievedAt: "2026-07-31",
      segmentation: "punctuated",
    },
  },
];

function fixtures(segmentation: "punctuated" | "unpunctuated" = "punctuated") {
  const built = buildCorpusIndex(passages);
  const recommendationCandidate: PersonalizedCandidate = {
    id: "recommendation:令仪",
    surname: "王",
    givenName: "令仪",
    fullName: "王令仪",
    evidence: {
      relation: "exact-phrase",
      reviewStatus: "reviewed",
      extraction: "原文连续成词：令仪",
      citations: [{
        id: "citation:令仪",
        bookId: "book-a",
        bookTitle: "《甲书》",
        workTitle: passages[0].workTitle,
        chapterTitle: passages[0].chapterTitle,
        quote: passages[0].text,
        sourceUrl,
        verificationUrl,
      }],
    },
    features: {
      classical: 0.9,
      graceful: 0.9,
      gentle: 0.7,
      bright: 0.4,
      austere: 0.3,
      modern: 0.1,
      pronounceable: 0.9,
      writable: 0.8,
      recognizable: 0.9,
      uncommon: 0.7,
      familyMeaning: 0.2,
      exactPhrasePreference: 1,
      recompositionPreference: 0,
    },
    quality: {
      pinyin: "wáng lìng yí",
      tones: "2-4-2",
      meaning: "端美的仪度。",
      semanticExplanation: "原句称赞仪容合度。",
      pronunciationNote: "声调起伏清楚。",
      usabilityNote: "字形常见，不易误读。",
      uncommonnessNote: "有典故感而非当下热名。",
      primaryStyle: "classical",
      imageryCategory: "仪范",
    },
    eligibility: "recommendable",
    risks: [],
  };
  const values = new Map<string, unknown>([
    [
      "/corpus/catalog.json",
      {
        schemaVersion: 2,
        buildVersion: "fixture-v1",
        scope: "测试全文库",
        coverageCaveat: "仅测试",
        characterIndex: built.indexPathsByCharacter,
        textShards: built.textShardPaths,
        recommendationPath: "recommendations-v2.json",
        recommendationCount: 1,
        books: books.map((book) => ({
          ...book,
          source: book.source ? { ...book.source, segmentation } : undefined,
        })),
      },
    ],
    ["/corpus/aliases.json", { schemaVersion: 1, aliases: built.aliases }],
    [
      "/corpus/recommendations-v2.json",
      {
        schemaVersion: 2,
        buildVersion: "fixture-v1",
        corpusVersion: "fixture-v1",
        recommendableCount: 1,
        searchOnlyCount: 8,
        candidates: [recommendationCandidate],
      },
    ],
  ]);
  for (const [path, value] of Object.entries(built.indexShards)) {
    values.set(`/corpus/index/${path}`, value);
  }
  for (const [path, value] of Object.entries(built.textShards)) {
    values.set(`/corpus/texts/${path}`, value);
  }
  return values;
}

function createFixtureFetcher(
  values = fixtures(),
  failPath?: string,
) {
  return vi.fn(async (input: string) => {
    const path = new URL(input, "https://example.test").pathname;
    if (path === failPath) {
      return { ok: false, status: 503, json: async () => ({}) };
    }
    const value = values.get(path);
    return value === undefined
      ? { ok: false, status: 404, json: async () => ({}) }
      : { ok: true, status: 200, json: async () => value };
  });
}

describe("浏览器端古籍全文检索", () => {
  it("按构建版本加载并缓存语义审核后的 V2 推荐池", async () => {
    const fetcher = createFixtureFetcher();
    const searcher = createCorpusSearcher({ baseUrl: "/corpus/", fetcher });

    const first = await searcher.discover();
    const second = await searcher.discover();

    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({
      fullName: "王令仪",
      eligibility: "recommendable",
      evidence: { reviewStatus: "reviewed" },
    });
    expect(second).toEqual(first);
    expect(
      fetcher.mock.calls.filter(([input]) =>
        new URL(input, "https://example.test").pathname.endsWith("/recommendations-v2.json"),
      ),
    ).toHaveLength(1);
  });

  it("推荐池首次加载失败后可真正重试", async () => {
    const values = fixtures();
    let failed = false;
    const fetcher = vi.fn(async (input: string) => {
      const path = new URL(input, "https://example.test").pathname;
      if (path === "/corpus/recommendations-v2.json" && !failed) {
        failed = true;
        return { ok: false, status: 503, json: async () => ({}) };
      }
      const value = values.get(path);
      return value === undefined
        ? { ok: false, status: 404, json: async () => ({}) }
        : { ok: true, status: 200, json: async () => value };
    });
    const searcher = createCorpusSearcher({ baseUrl: "/corpus/", fetcher });

    await expect(searcher.discover()).rejects.toThrow(/503/);
    await expect(searcher.discover()).resolves.toHaveLength(1);
    expect(
      fetcher.mock.calls.filter(([input]) =>
        new URL(input, "https://example.test").pathname.endsWith("/recommendations-v2.json"),
      ),
    ).toHaveLength(2);
  });

  it("区分 A–F 六级关系，并如实标出组合与单字旁证", async () => {
    const searcher = createCorpusSearcher({
      baseUrl: "/corpus/",
      fetcher: createFixtureFetcher(),
    });

    const direct = await searcher.search("王令仪");
    expect(direct.status).toBe("hit");
    expect(direct.matches.map((match) => match.grade)).toEqual(
      expect.arrayContaining(["A", "B", "C"]),
    );

    const composite = await searcher.search("王景玉");
    expect(composite.matches.map((match) => match.grade)).toEqual(
      expect.arrayContaining(["C", "D", "E", "F"]),
    );
    expect(composite.matches.find((match) => match.grade === "D")?.extraction)
      .toMatch(/不是原文固有词组/);
    expect(composite.matches.find((match) => match.grade === "E")?.extraction)
      .toMatch(/不是共同出处/);
    expect(
      new Set(
        composite.matches
          .filter((match) => match.grade === "F")
          .flatMap((match) => match.citations.map((citation) => citation.matchedChar)),
      ),
    ).toEqual(new Set(["景", "玉"]));

    const single = await searcher.search("王皎");
    expect(single.matches.every((match) => match.grade === "F")).toBe(true);
    expect(single.matches[0]?.extraction).toMatch(/只证明单字/);
  });

  it("用繁简别名命中规范化索引，并复用相同请求", async () => {
    const fetcher = createFixtureFetcher();
    const searcher = createCorpusSearcher({ baseUrl: "/corpus/", fetcher });

    const first = await searcher.search("王令儀");
    const second = await searcher.search("王令儀");

    expect(first.normalizedGivenName).toBe("令仪");
    expect(first.matches.some((match) => match.grade === "A")).toBe(true);
    expect(second).toEqual(first);
    const requestedPaths = fetcher.mock.calls.map(([input]) =>
      new URL(input, "https://example.test").pathname,
    );
    expect(requestedPaths.filter((path) => path === "/corpus/catalog.json"))
      .toHaveLength(1);
    expect(requestedPaths.filter((path) => path.startsWith("/corpus/index/")))
      .toHaveLength(1);
  });

  it("无可靠句读的机器分段不把相邻字误报为 A 级", async () => {
    const searcher = createCorpusSearcher({
      baseUrl: "/corpus/",
      fetcher: createFixtureFetcher(fixtures("unpunctuated")),
    });

    const result = await searcher.search("王令仪");

    expect(result.matches.some((match) => match.grade === "A")).toBe(false);
    expect(result.matches.some((match) =>
      match.grade === "B" && match.extraction.includes("不作为原文连续词组"),
    )).toBe(true);
  });

  it("索引中没有该字时返回 no-hit，不把缺桶误报成网络错误", async () => {
    const searcher = createCorpusSearcher({
      baseUrl: "/corpus/",
      fetcher: createFixtureFetcher(),
    });
    const result = await searcher.search("王芷若");
    expect(result.status).toBe("no-hit");
    expect(result.matches).toEqual([]);
  });

  it("正文分片加载失败时返回 error，而不是伪装成无结果", async () => {
    const searcher = createCorpusSearcher({
      baseUrl: "/corpus/",
      fetcher: createFixtureFetcher(fixtures(), "/corpus/texts/book-a/000.json"),
    });
    const result = await searcher.search("王令仪");
    expect(result.status).toBe("error");
    expect(result.matches).toEqual([]);
    expect(result.message).toMatch(/503/);
  });
});
