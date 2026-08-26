// @vitest-environment node

import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  createPassageBatches,
  extractNameableSourceWindows,
  isFactorySourcePassage,
  loadFactoryCorpus,
  passageNameabilityScore,
  selectDiversePassages,
} from "./corpus.ts";
import type { FactoryPassage } from "./types.ts";

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

  it("从分句提取保留全文绝对下标的候选友好窗口", () => {
    const windows = extractNameableSourceWindows({
      text: "无关。柔嘉维则，令仪令色。待天明兮立踯躅。",
      normalizedText: "无关柔嘉维则令仪令色待天明兮立踯躅",
    });
    expect(windows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: "柔嘉维则，令仪令色。",
        normalizedText: "柔嘉维则令仪令色",
        startIndex: 2,
        endIndex: 10,
        pairOpportunityCount: expect.any(Number),
      }),
    ]));
    expect(windows.every((window) => !window.text.includes("踯躅"))).toBe(true);
  });

  it("按自然双字机会评分，而不是重复吉祥单字计数", () => {
    const graceful = { text: "柔嘉维则，令仪令色。", normalizedText: "柔嘉维则令仪令色" };
    const repeatedMonth = {
      text: "七月在野，八月在宇，九月在户，十月蟋蟀。",
      normalizedText: "七月在野八月在宇九月在户十月蟋蟀",
    };
    expect(passageNameabilityScore(graceful)).toBeGreaterThan(
      passageNameabilityScore(repeatedMonth),
    );
    expect(extractNameableSourceWindows(graceful)[0]?.pairOpportunityCount).toBeGreaterThan(0);
    expect(passageNameabilityScore(graceful)).toBeGreaterThan(passageNameabilityScore({
      text: "总角之宴，言笑晏晏，信誓旦旦，不思其反。",
      normalizedText: "总角之宴言笑晏晏信誓旦旦不思其反",
    }));
  });

  it("为无句读长文本生成保留绝对下标的滑动窗口", () => {
    const text = "翩若惊鸿婉若游龙荣曜秋菊华茂春松髣髴兮若轻云之蔽月飘飖兮若流风之回雪延颈秀项皓质呈露芳泽无加";
    const windows = extractNameableSourceWindows({ text, normalizedText: text });
    expect(windows.length).toBeGreaterThan(1);
    expect(windows).toEqual(expect.arrayContaining([
      expect.objectContaining({ startIndex: 0, endIndex: 24 }),
      expect.objectContaining({ startIndex: 16, endIndex: 40 }),
    ]));
  });

  it("全库统一竞争时高质量来源可以同时胜过弱书目", () => {
    const make = (id: string, bookId: string, score: number, text: string): FactoryPassage => ({
      id,
      bookId,
      bookTitle: `《${bookId}》`,
      category: "集",
      period: "先秦",
      workTitle: id,
      chapterTitle: "测试",
      text,
      normalizedText: text.replace(/[，。]/gu, ""),
      sourceUrl: "https://example.test/source",
      verificationUrl: "https://example.test/verify",
      score,
    });
    const selected = selectDiversePassages([
      make("strong-a-1", "strong", 300, "柔嘉维则，令仪令色。"),
      make("strong-a-2", "strong", 290, "婉若清扬，惠风和畅。"),
      make("weak-b-1", "weak", 10, "林木山石，道路车马。"),
    ], { passagesPerBook: 1 });
    expect(selected.map((passage) => passage.id)).toEqual(["strong-a-1", "strong-a-2"]);
  });

  it("全局质量优先仍限制单书垄断", () => {
    const passages = Array.from({ length: 6 }, (_, index): FactoryPassage => ({
      id: `strong-${index}`,
      bookId: "strong",
      bookTitle: "《强书》",
      category: "集",
      period: "先秦",
      workTitle: `强作品${index}`,
      chapterTitle: "测试",
      text: "柔嘉维则，令仪令色。",
      normalizedText: "柔嘉维则令仪令色",
      sourceUrl: "https://example.test/source",
      verificationUrl: "https://example.test/verify",
      score: 300 - index,
    }));
    passages.push({ ...passages[0]!, id: "weak-1", bookId: "weak", bookTitle: "《弱书》", workTitle: "弱作品", score: 20 });
    const selected = selectDiversePassages(passages, { passagesPerBook: 2 });
    expect(selected).toHaveLength(4);
    expect(selected.some((passage) => passage.bookId === "weak")).toBe(true);
    expect(selected.filter((passage) => passage.bookId === "strong")).toHaveLength(3);
  });

  it("用 MMR 在质量接近时避开重复用字和作品", () => {
    const make = (id: string, workTitle: string, text: string, score: number): FactoryPassage => ({
      id,
      bookId: "shi-jing",
      bookTitle: "《诗经》",
      category: "经",
      period: "先秦",
      workTitle,
      chapterTitle: "测试",
      text,
      normalizedText: text.replace(/[，。]/gu, ""),
      sourceUrl: "https://example.test/source",
      verificationUrl: "https://example.test/verify",
      score,
    });
    const selected = selectDiversePassages([
      make("moon-1", "月篇一", "月明月照，月明月照。", 100),
      make("moon-2", "月篇二", "月明月照，月明月照。", 99),
      make("virtue", "烝民", "柔嘉维则，令仪令色。", 98),
    ], { passagesPerBook: 2 });
    expect(selected.map(({ id }) => id)).toEqual(["moon-1", "virtue"]);
  });

  it("为相同输入生成稳定批次编号", async () => {
    const corpus = await loadFactoryCorpus(fixtureRoot);
    const selected = selectDiversePassages(corpus.passages, { passagesPerBook: 2 });
    expect(createPassageBatches(selected, 2)).toEqual(createPassageBatches(selected, 2));
    expect(createPassageBatches(selected, 2)[0]?.id).toMatch(/^source-0001-[a-f0-9]{12}$/u);
  });
});
