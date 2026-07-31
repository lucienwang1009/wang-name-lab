import { describe, expect, it } from "vitest";

import { bucketForCharacter, buildCorpusIndex } from "./buildIndex";
import type { CorpusPassage } from "./types";

const passage = (
  id: string,
  text: string,
  normalizedText: string,
  order: number,
): CorpusPassage => ({
  id,
  bookId: "shi-jing",
  workId: "shi-jing/work-0001",
  chapterId: "shi-jing/chapter-0001",
  workTitle: "小雅",
  chapterTitle: "小雅·鹿鸣之什",
  order,
  text,
  normalizedText,
  sourceUrl: "https://example.com/pinned.json",
  verificationUrl: "https://example.com/verify",
});

describe("古籍静态字符索引", () => {
  it("记录同一原句中字符的全部位置，但只生成一条结构化 posting", () => {
    const source = passage("shi-jing/work-0001/passage-0001", "高山仰止，景行行止。", "高山仰止景行行止", 1);
    const result = buildCorpusIndex([source]);
    const bucket = result.buckets[bucketForCharacter("行")];

    expect(bucket?.characters["行"]).toEqual([
      {
        passageId: source.id,
        bookId: source.bookId,
        workId: source.workId,
        chapterId: source.chapterId,
        positions: [5, 6],
      },
    ]);
  });

  it("按 Unicode 高位字节稳定分桶并生成繁简别名", () => {
    const source = passage("shi-jing/work-0001/passage-0001", "令儀孔昭。", "令仪孔昭", 1);
    const result = buildCorpusIndex([source]);

    expect(bucketForCharacter("景")).toBe("0066-1");
    expect(result.aliases).toEqual({ 儀: "仪" });
    expect(result.buckets[bucketForCharacter("仪")]?.characters["仪"]?.[0])
      .toMatchObject({ passageId: source.id, positions: [1] });
  });

  it("按书生成正文分片，且输出不受输入顺序影响", () => {
    const first = passage("shi-jing/work-0001/passage-0001", "景行。", "景行", 1);
    const second = passage("shi-jing/work-0002/passage-0001", "令儀。", "令仪", 2);

    const forward = buildCorpusIndex([first, second]);
    const reversed = buildCorpusIndex([second, first]);

    expect(reversed).toEqual(forward);
    expect(forward.textShards["shi-jing"]).toEqual({
      schemaVersion: 1,
      bookId: "shi-jing",
      sourceUrl: first.sourceUrl,
      verificationUrl: first.verificationUrl,
      passages: [
        {
          id: first.id,
          workId: first.workId,
          chapterId: first.chapterId,
          workTitle: first.workTitle,
          chapterTitle: first.chapterTitle,
          order: first.order,
          text: first.text,
          normalizedText: first.normalizedText,
        },
        {
          id: second.id,
          workId: second.workId,
          chapterId: second.chapterId,
          workTitle: second.workTitle,
          chapterTitle: second.chapterTitle,
          order: second.order,
          text: second.text,
          normalizedText: second.normalizedText,
        },
      ],
    });
  });
});
