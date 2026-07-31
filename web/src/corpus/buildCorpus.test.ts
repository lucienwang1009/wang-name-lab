import { describe, expect, it } from "vitest";

import { buildCorpusReport } from "./buildCorpus";
import type { CorpusBook, CorpusPassage } from "./types";

const plannedBook: CorpusBook = {
  id: "shi-jing",
  title: "《诗经》",
  category: "经",
  period: "先秦",
  priority: 1,
  status: "planned",
};

const passage: CorpusPassage = {
  id: "shi-jing/zhou-nan/guan-ju/1",
  bookId: "shi-jing",
  workId: "zhou-nan",
  chapterId: "guan-ju",
  order: 1,
  text: "关关雎鸠，在河之洲。",
  normalizedText: "关关雎鸠在河之洲",
  sourceUrl: "https://example.com/shi-jing",
};

describe("古籍语料构建报告", () => {
  it("稳定统计书目、状态、分类、原句和字数", () => {
    const report = buildCorpusReport({ books: [plannedBook], passages: [passage] });

    expect(report.catalogue).toEqual({
      totalBooks: 1,
      totalPassages: 1,
      totalCharacters: 8,
      byCategory: { 经: 1, 史: 0, 子: 0, 集: 0, 字书: 0 },
      byStatus: { planned: 1, "source-reviewed": 0, ready: 0 },
    });
    expect(report.blockingErrors).toEqual([]);
    expect(report.warnings).toContainEqual(
      expect.objectContaining({ code: "PLANNED_BOOK_SOURCE_PENDING" }),
    );
  });

  it("阻止重复或不合法的书目以及伪 ready 状态", () => {
    const report = buildCorpusReport({
      books: [
        plannedBook,
        { ...plannedBook },
        { ...plannedBook, id: "Bad ID", title: " " },
        { ...plannedBook, id: "ready-book", status: "ready" },
      ],
      passages: [],
    });

    expect(report.blockingErrors.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "DUPLICATE_BOOK_ID",
        "EMPTY_BOOK_TITLE",
        "INVALID_BOOK_ID",
        "READY_BOOK_MISSING_SOURCE",
      ]),
    );
  });

  it("阻止无法回溯或无法检索的原句", () => {
    const report = buildCorpusReport({
      books: [plannedBook],
      passages: [
        passage,
        { ...passage },
        {
          ...passage,
          id: "unknown/chapter/1",
          bookId: "unknown",
          normalizedText: "",
          sourceUrl: "",
        },
      ],
    });

    expect(report.blockingErrors.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "DUPLICATE_PASSAGE_ID",
        "EMPTY_NORMALIZED_TEXT",
        "PASSAGE_MISSING_SOURCE_URL",
        "UNKNOWN_PASSAGE_BOOK",
      ]),
    );
  });

  it("输出顺序与输入顺序无关", () => {
    const forward = buildCorpusReport({
      books: [plannedBook, { ...plannedBook, id: "bad id", title: " " }],
      passages: [],
    });
    const reversed = buildCorpusReport({
      books: [{ ...plannedBook, id: "bad id", title: " " }, plannedBook],
      passages: [],
    });

    expect(reversed).toEqual(forward);
  });
});
