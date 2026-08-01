import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import {
  characterDictionary,
  classicalFragments,
  generationCharacters,
} from "./data/nameSystemData";
import { generateAllusionCandidates } from "./domain/nameSystem";
import type {
  CorpusSearchClient,
  CorpusSearchResult,
} from "./corpus/searchCorpus";

const fullTextHit: CorpusSearchResult = {
  status: "hit",
  givenName: "令仪",
  normalizedGivenName: "令仪",
  coverage: {
    targetBooks: 70,
    readyBooks: 70,
    buildVersion: "fixture-v1",
  },
  matches: [
    {
      id: "A:shi-jing/work-0001/passage-0001:令仪",
      grade: "A",
      givenName: "令仪",
      extraction: "全文原句连续出现：令仪",
      citations: [
        {
          passageId: "shi-jing/work-0001/passage-0001",
          matchedChar: "令仪",
          bookId: "shi-jing",
          bookTitle: "《诗经》",
          category: "经",
          workTitle: "湛露",
          chapterTitle: "小雅",
          text: "岂弟君子，莫不令仪。",
          sourceUrl: "https://example.com/pinned.json",
          verificationUrl: "https://example.com/verify",
        },
      ],
    },
  ],
};

const fullTextNoHit: CorpusSearchResult = {
  status: "no-hit",
  givenName: "景玉",
  normalizedGivenName: "景玉",
  matches: [],
  coverage: {
    targetBooks: 70,
    readyBooks: 70,
    buildVersion: "fixture-v1",
  },
};

describe("取名实验室应用", () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.localStorage.clear();
    window.location.hash = "";
    Object.defineProperty(window, "scrollTo", {
      configurable: true,
      value: vi.fn(),
      writable: true,
    });
  });

  it("展示筛选漏斗与候选规模", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "为一个名字，留下完整来路" }),
    ).toBeTruthy();
    const metrics = within(screen.getByLabelText("候选规模"));
    const rawCount = generationCharacters.length * (generationCharacters.length - 1);
    expect(metrics.getByText(rawCount.toLocaleString("zh-CN"))).toBeTruthy();
    const allusionCount = generateAllusionCandidates(
      classicalFragments,
      new Set(characterDictionary.map((entry) => entry.char)),
    ).length;
    expect(
      metrics.getByText(classicalFragments.length.toLocaleString("zh-CN")),
    ).toBeTruthy();
    expect(metrics.getByText(allusionCount.toLocaleString("zh-CN"))).toBeTruthy();
    expect(metrics.getByText("132")).toBeTruthy();
  });

  it("可以从总览进入人工精选榜", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "先看人工精选" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "人工精选榜", level: 1 }),
      ).toBeTruthy();
    });
  });

  it("先展示全文命中，再用精选片段补充 A–F 证据", async () => {
    window.location.hash = "#allusions";
    let resolveFirst: ((result: CorpusSearchResult) => void) | undefined;
    const firstSearch = new Promise<CorpusSearchResult>((resolve) => {
      resolveFirst = resolve;
    });
    const corpusSearchClient: CorpusSearchClient = {
      discover: vi.fn(async () => []),
      search: vi.fn((query) =>
        query.includes("令") ? firstSearch : Promise.resolve(fullTextNoHit),
      ),
    };
    render(<App corpusSearchClient={corpusSearchClient} />);

    expect(screen.getByText("全文库 70 部")).toBeTruthy();
    expect(screen.getByText("精选片段 126 条")).toBeTruthy();

    const search = screen.getByRole("searchbox", {
      name: "输入姓名查找古籍原句",
    });
    fireEvent.change(search, { target: { value: "王令仪" } });

    expect(await screen.findByText("正在查找全文索引")).toBeTruthy();
    expect(screen.getByText(/不等于现代权威校勘本/)).toBeTruthy();
    await act(async () => {
      resolveFirst?.(fullTextHit);
      await firstSearch;
    });
    expect(await screen.findByText("全文原句连续出现：令仪")).toBeTruthy();
    expect(screen.getByRole("link", { name: "固定机器来源 ↗" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "公版页面复核 ↗" })).toBeTruthy();
    expect(screen.getByText("原文连续出现：令仪")).toBeTruthy();
    const fullTextHeading = screen.getByRole("heading", {
      name: "七十部核心古籍正文",
    });
    const curatedHeading = screen.getByRole("heading", {
      name: "精选片段补充",
    });
    expect(
      fullTextHeading.compareDocumentPosition(curatedHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.change(search, { target: { value: "王景玉" } });
    expect(
      await screen.findByText("当前 70 部核心库未找到对应关系"),
    ).toBeTruthy();
    expect(screen.getByText("精选片段暂未找到同句或同篇共同出处")).toBeTruthy();
    expect(screen.getByText("D级 · 同书异篇")).toBeTruthy();
    expect(screen.getByText("E级 · 跨典双源")).toBeTruthy();
    expect(
      screen.getAllByText(/不能作为完整名字出处/).length,
    ).toBeGreaterThan(0);
  });

  it("全文库失败时明确报错，但继续展示精选片段", async () => {
    window.location.hash = "#allusions";
    const corpusSearchClient: CorpusSearchClient = {
      discover: vi.fn(async () => []),
      search: vi.fn(async (): Promise<CorpusSearchResult> => ({
        status: "error",
        givenName: "令仪",
        normalizedGivenName: "令仪",
        matches: [],
        message: "测试网络中断。",
      })),
    };
    render(<App corpusSearchClient={corpusSearchClient} />);

    fireEvent.change(
      screen.getByRole("searchbox", { name: "输入姓名查找古籍原句" }),
      { target: { value: "王令仪" } },
    );

    expect(await screen.findByText("全文库加载失败")).toBeTruthy();
    expect(screen.getByText(/测试网络中断/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "精选片段补充" })).toBeTruthy();
    expect(screen.getByText("原文连续出现：令仪")).toBeTruthy();
  });
});
