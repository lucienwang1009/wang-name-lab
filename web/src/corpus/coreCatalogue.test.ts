import { describe, expect, it } from "vitest";

import { coreCatalogue } from "./coreCatalogue";

describe("核心古籍目标书目", () => {
  it("保持在第一版约定的 50–100 部范围内", () => {
    expect(coreCatalogue.length).toBeGreaterThanOrEqual(50);
    expect(coreCatalogue.length).toBeLessThanOrEqual(100);
  });

  it("使用唯一且稳定的书籍编号", () => {
    expect(new Set(coreCatalogue.map((book) => book.id)).size).toBe(
      coreCatalogue.length,
    );

    for (const book of coreCatalogue) {
      expect(book.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(book.title.trim()).not.toBe("");
      expect(book.category).toMatch(/^(经|史|子|集|字书)$/);
      expect([1, 2, 3]).toContain(book.priority);
    }
  });

  it("不会把尚未核验来源的书标成可检索", () => {
    for (const book of coreCatalogue) {
      if (book.status !== "ready") continue;
      expect(book.source?.originUrl).toMatch(/^https:\/\//);
      expect(book.source?.editionNote.trim()).not.toBe("");
      expect(book.source?.rightsNote.trim()).not.toBe("");
    }
  });
});
