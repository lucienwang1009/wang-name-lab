import { describe, expect, it } from "vitest";

import { buildDiscoveryPool } from "./buildDiscoveryPool";
import type { CharacterEntry } from "../domain/types";
import type { CorpusBook, CorpusPassage } from "./types";

const sourceUrl = "https://example.com/source";
const verificationUrl = "https://example.com/verify";

function character(
  char: string,
  feminine = 4.5,
  usability = 4,
): CharacterEntry {
  return {
    char,
    category: "测试",
    meaning: "测试用字",
    feminine,
    rarity: 3.5,
    usability,
    familyTag: "",
    folkElement: "测试",
    elementCaveat: "测试",
  };
}

function book(
  id: string,
  segmentation: "punctuated" | "unpunctuated",
): CorpusBook {
  return {
    id,
    title: id === "shi-jing" ? "《诗经》" : "《无标点本》",
    category: "经",
    period: "先秦",
    priority: 1,
    status: "ready",
    source: {
      originUrl: sourceUrl,
      editionNote: "测试版本",
      rightsNote: "测试授权",
      retrievedAt: "2026-08-01",
      segmentation,
    },
  };
}

function passage(
  id: string,
  bookId: string,
  text: string,
  normalizedText: string,
  order: number,
): CorpusPassage {
  return {
    id,
    bookId,
    workId: `${bookId}/work-0001`,
    chapterId: `${bookId}/chapter-0001`,
    workTitle: bookId === "shi-jing" ? "湛露" : "测试篇",
    chapterTitle: "测试章",
    order,
    text,
    normalizedText,
    sourceUrl,
    verificationUrl,
  };
}

const characters = ["令", "仪", "孔", "昭", "景", "玉", "成", "章"].map(
  (value) => character(value),
);

describe("典籍驱动的随机寻名池", () => {
  it("有可靠句读的直接相连字生成 A 级，近距离同句取字生成 B 级", () => {
    const result = buildDiscoveryPool({
      books: [book("shi-jing", "punctuated")],
      characters,
      passages: [
        passage(
          "shi-jing/work-0001/passage-0001",
          "shi-jing",
          "令儀孔昭。",
          "令仪孔昭",
          1,
        ),
      ],
    });

    expect(result.find((item) => item.givenName === "令仪")).toMatchObject({
      grade: "A",
      bookTitle: "《诗经》",
      workTitle: "湛露",
      quote: "令儀孔昭。",
    });
    expect(result.find((item) => item.givenName === "令昭")).toMatchObject({
      grade: "B",
      extraction: "同句近距离取字：令…昭",
    });
  });

  it("无可靠句读来源只把直接相邻字作为 B 级", () => {
    const result = buildDiscoveryPool({
      books: [book("plain-text", "unpunctuated")],
      characters,
      passages: [
        passage(
          "plain-text/work-0001/passage-0001",
          "plain-text",
          "景玉成章",
          "景玉成章",
          1,
        ),
      ],
    });

    expect(result.find((item) => item.givenName === "景玉")).toMatchObject({
      grade: "B",
      extraction: "无句读转录相邻：景…玉",
    });
    expect(result.some((item) => item.grade === "A")).toBe(false);
    expect(result.some((item) => item.givenName === "景章")).toBe(false);
  });

  it("排除未批准用字，并为重复名字保留更短、更清晰的证据", () => {
    const short = passage(
      "shi-jing/work-0001/passage-0001",
      "shi-jing",
      "莫不令儀。",
      "莫不令仪",
      1,
    );
    const long = passage(
      "shi-jing/work-0001/passage-0002",
      "shi-jing",
      `天下宾客咸称其德（古注）${"文".repeat(80)}令儀。`,
      `天下宾客咸称其德${"文".repeat(80)}令仪`,
      2,
    );
    const result = buildDiscoveryPool({
      books: [book("shi-jing", "punctuated")],
      characters,
      passages: [long, short],
    });

    expect(result.find((item) => item.givenName === "令仪")?.passageId).toBe(
      short.id,
    );
    expect(result.some((item) => item.givenName.includes("天"))).toBe(false);
    expect(buildDiscoveryPool({
      books: [book("shi-jing", "punctuated")],
      characters,
      passages: [short, long],
    })).toEqual(result);
  });

  it("大候选池同时保留 A 级与 B 级来源，不被 A 级总分完全挤占", () => {
    const result = buildDiscoveryPool({
      books: [book("shi-jing", "punctuated")],
      characters,
      passages: [
        passage(
          "shi-jing/work-0001/passage-0001",
          "shi-jing",
          "令儀孔昭景玉成章。",
          "令仪孔昭景玉成章",
          1,
        ),
      ],
      limit: 8,
    });

    expect(result.some((item) => item.grade === "A")).toBe(true);
    expect(result.some((item) => item.grade === "B")).toBe(true);
  });
});
