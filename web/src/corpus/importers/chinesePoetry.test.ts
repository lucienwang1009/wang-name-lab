import { describe, expect, it } from "vitest";

import { ingestChinesePoetry } from "./chinesePoetry";

const common = {
  sourceUrl: "https://raw.githubusercontent.com/example/revision/text.json",
  verificationUrl: "https://zh.wikisource.org/wiki/example",
};

describe("chinese-poetry 全文导入", () => {
  it("导入《诗经》数组格式并切成稳定原句", () => {
    const passages = ingestChinesePoetry({
      ...common,
      bookId: "shi-jing",
      raw: [
        {
          title: "关雎",
          chapter: "国风",
          section: "周南",
          content: ["关关雎鸠，在河之洲。窈窕淑女，君子好逑。"],
        },
      ],
    });

    expect(passages).toHaveLength(2);
    expect(passages[0]).toMatchObject({
      id: "shi-jing/work-0001/passage-0001",
      bookId: "shi-jing",
      workId: "shi-jing/work-0001",
      chapterId: "shi-jing/chapter-0001",
      workTitle: "关雎",
      chapterTitle: "国风·周南",
      text: "关关雎鸠，在河之洲。",
      normalizedText: "关关雎鸠在河之洲",
      order: 1,
      ...common,
    });
    expect(passages[1]?.id).toBe("shi-jing/work-0001/passage-0002");
  });

  it("导入《大学》对象格式并保留原始繁体展示文本", () => {
    const passages = ingestChinesePoetry({
      ...common,
      bookId: "da-xue",
      raw: {
        chapter: "大學",
        paragraphs: ["大學之道，在明明德，在親民，在止於至善。"],
      },
    });

    expect(passages).toHaveLength(1);
    expect(passages[0]).toMatchObject({
      workTitle: "大學",
      chapterTitle: "大學",
      text: "大學之道，在明明德，在親民，在止於至善。",
      normalizedText: "大学之道在明明德在亲民在止于至善",
    });
  });

  it("对相同输入产生完全一致的编号和内容", () => {
    const input = {
      ...common,
      bookId: "lun-yu" as const,
      raw: [{ chapter: "学而篇", paragraphs: ["子曰：学而时习之。"] }],
    };
    expect(ingestChinesePoetry(input)).toEqual(ingestChinesePoetry(input));
  });

  it("拒绝无法识别的源文件结构", () => {
    expect(() =>
      ingestChinesePoetry({ ...common, bookId: "meng-zi", raw: { bad: true } }),
    ).toThrow(/无法识别/);
  });
});
