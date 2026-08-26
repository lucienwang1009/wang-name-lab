// @vitest-environment node

import { describe, expect, it } from "vitest";

import type { PassageBatch } from "./corpus.ts";
import { compilePointerSelections } from "./pointers.ts";
import type { FactoryPassage, PointerSelection } from "./types.ts";

function passage(overrides: Partial<FactoryPassage> = {}): FactoryPassage {
  return {
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
    ...overrides,
  };
}

function selection(
  first: PointerSelection["first"],
  second: PointerSelection["second"],
): PointerSelection {
  return {
    first,
    second,
    meaning: "由原文二字形成的完整含义",
    rationale: "组合适合作为姓名",
    imageryCategory: "德性",
    familyConnection: "",
  };
}

describe("原文指针编译", () => {
  it("从相邻位置读取姓名、出现序号并确定连续关系", () => {
    const batch: PassageBatch = { id: "source-test", passages: [passage()] };
    const result = compilePointerSelections([
      selection({ passageId: "shi-jing/1", index: 4 }, { passageId: "shi-jing/1", index: 5 }),
    ], batch);
    expect(result.issues).toEqual([]);
    expect(result.proposals[0]).toMatchObject({
      givenName: "令仪",
      relation: "exact-phrase",
      sources: [
        { passageId: "shi-jing/1", character: "令", occurrence: 0 },
        { passageId: "shi-jing/1", character: "仪", occurrence: 0 },
      ],
    });
    expect(result.proposals[0]?.proposalId).toMatch(/^source-test:pointer-[a-f0-9]{16}$/u);
    expect(result.proposals[0]?.extraction).toMatch(/程序按原文位置核定/u);
  });

  it("自动区分同句、同段跨句、同篇跨段和跨篇重组", () => {
    const first = passage({
      id: "book/work-a/1",
      bookId: "book",
      bookTitle: "《甲书》",
      workTitle: "甲篇",
      text: "柔嘉。令仪。",
      normalizedText: "柔嘉令仪",
    });
    const second = passage({
      id: "book/work-a/2",
      bookId: "book",
      bookTitle: "《甲书》",
      workTitle: "甲篇",
      text: "清光在庭。",
      normalizedText: "清光在庭",
    });
    const third = passage({
      id: "other/work-b/1",
      bookId: "other",
      bookTitle: "《乙书》",
      workTitle: "乙篇",
      text: "月华如水。",
      normalizedText: "月华如水",
    });
    const batch: PassageBatch = { id: "source-relations", passages: [first, second, third] };
    const result = compilePointerSelections([
      selection({ passageId: first.id, index: 0 }, { passageId: first.id, index: 1 }),
      selection({ passageId: first.id, index: 0 }, { passageId: first.id, index: 2 }),
      selection({ passageId: first.id, index: 0 }, { passageId: second.id, index: 0 }),
      selection({ passageId: first.id, index: 0 }, { passageId: third.id, index: 0 }),
    ], batch);
    expect(result.proposals.map(({ relation }) => relation)).toEqual([
      "exact-phrase",
      "passage-related",
      "passage-related",
      "cultural-recomposition",
    ]);
  });

  it("同一句中的非连续位置归为同句取字", () => {
    const batch: PassageBatch = { id: "source-clause", passages: [passage()] };
    const result = compilePointerSelections([
      selection({ passageId: "shi-jing/1", index: 0 }, { passageId: "shi-jing/1", index: 5 }),
    ], batch);
    expect(result.proposals[0]?.relation).toBe("clause-related");
  });

  it("按位置计算同字出现序号", () => {
    const repeated = passage({ text: "令仪令色。", normalizedText: "令仪令色" });
    const result = compilePointerSelections([
      selection({ passageId: repeated.id, index: 2 }, { passageId: repeated.id, index: 3 }),
    ], { id: "source-occurrence", passages: [repeated] });
    expect(result.proposals[0]?.sources).toEqual([
      { passageId: repeated.id, character: "令", occurrence: 1 },
      { passageId: repeated.id, character: "色", occurrence: 0 },
    ]);
  });

  it("逐项审计未知段落、越界位置和相同位置", () => {
    const batch: PassageBatch = { id: "source-invalid", passages: [passage()] };
    const result = compilePointerSelections([
      selection({ passageId: "missing", index: 0 }, { passageId: "shi-jing/1", index: 1 }),
      selection({ passageId: "shi-jing/1", index: 999 }, { passageId: "shi-jing/1", index: 1 }),
      selection({ passageId: "shi-jing/1", index: 1 }, { passageId: "shi-jing/1", index: 1 }),
    ], batch);
    expect(result.proposals).toEqual([]);
    expect(result.issues).toHaveLength(3);
    expect(result.issues.map(({ reason }) => reason).join("\n")).toMatch(/不属于当前批次.*越界.*不能相同/su);
  });
});
