// @vitest-environment node

import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  createPassageBatches,
  isFactorySourcePassage,
  loadFactoryCorpus,
  passageNameabilityScore,
  selectDiversePassages,
} from "./corpus.ts";

const fixtureRoot = fileURLToPath(new URL("./fixtures/corpus/", import.meta.url));

describe("古籍候选工厂取材", () => {
  it("读取目录与全文分片并恢复书目信息", async () => {
    const corpus = await loadFactoryCorpus(fixtureRoot);
    expect(corpus.corpusVersion).toBe("fixture-v1");
    expect(corpus.books).toHaveLength(2);
    expect(corpus.passages.map((passage) => passage.bookTitle)).toContain("《诗经》");
    expect(corpus.passages.every((passage) => passage.sourceUrl.startsWith("https://"))).toBe(true);
  });

  it("排除负面、战争、数字噪声和过短段落", () => {
    const make = (text: string) => ({ text, normalizedText: text, score: passageNameabilityScore({ text, normalizedText: text }) });
    expect(isFactorySourcePassage(make("柔嘉维则，令仪令色。"))).toBe(true);
    expect(isFactorySourcePassage(make("墓中死丧鬼神"))).toBe(false);
    expect(isFactorySourcePassage(make("123|456|789|"))).toBe(false);
    expect(isFactorySourcePassage(make("清雅"))).toBe(false);
  });

  it("按书轮询而不是让单一大书垄断", async () => {
    const corpus = await loadFactoryCorpus(fixtureRoot);
    const selected = selectDiversePassages(corpus.passages, { passagesPerBook: 2 });
    expect(selected.slice(0, 2).map((passage) => passage.bookId)).toEqual(["shi-jing", "song-ci"]);
    expect(new Set(selected.map((passage) => passage.bookId))).toEqual(new Set(["shi-jing", "song-ci"]));
  });

  it("为相同输入生成稳定批次编号", async () => {
    const corpus = await loadFactoryCorpus(fixtureRoot);
    const selected = selectDiversePassages(corpus.passages, { passagesPerBook: 2 });
    expect(createPassageBatches(selected, 2)).toEqual(createPassageBatches(selected, 2));
    expect(createPassageBatches(selected, 2)[0]?.id).toMatch(/^source-0001-[a-f0-9]{12}$/u);
  });
});

