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
import type {
  CorpusSearchClient,
  CorpusSearchResult,
} from "./corpus/searchCorpus";
import type { PersonalizedCandidate } from "./domain/types";
import {
  createDefaultProfile,
  PROFILE_STORAGE_KEY,
} from "./state/storage";

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

const idleClient: CorpusSearchClient = {
  discover: vi.fn(async () => []),
  search: vi.fn(async (): Promise<CorpusSearchResult> => ({
    status: "idle",
    givenName: "",
    normalizedGivenName: "",
    matches: [],
  })),
};

function recommendationCandidate(
  givenName: string,
  index = 0,
): PersonalizedCandidate {
  return {
    id: `recommendation:${String(index).padStart(2, "0")}:${givenName}`,
    surname: "王",
    givenName,
    fullName: `王${givenName}`,
    evidence: {
      relation: index % 3 === 0 ? "exact-phrase" : "clause-related",
      reviewStatus: "reviewed",
      extraction: `经审核的取字：${givenName}`,
      citations: [{
        id: `citation:${givenName}`,
        bookId: index % 2 === 0 ? "shi-jing" : "chu-ci",
        bookTitle: index % 2 === 0 ? "《诗经》" : "《楚辞》",
        workTitle: "烝民",
        chapterTitle: "大雅",
        quote: `古籍原句${givenName}。`,
        sourceUrl: "https://example.com/source",
        verificationUrl: "https://example.com/verify",
      }],
    },
    features: {
      classical: 0.65 + (index % 4) * 0.08,
      graceful: 0.45 + (index % 5) * 0.1,
      gentle: 0.3 + (index % 6) * 0.1,
      bright: 0.2 + ((index + 2) % 6) * 0.1,
      austere: 0.2 + ((index + 3) % 5) * 0.1,
      modern: 0.1 + (index % 3) * 0.1,
      pronounceable: 0.75 + (index % 3) * 0.06,
      writable: 0.65 + (index % 4) * 0.06,
      recognizable: 0.7 + (index % 4) * 0.05,
      uncommon: 0.55 + (index % 5) * 0.08,
      familyMeaning: index === 0 ? 0.9 : 0.2,
      exactPhrasePreference: index % 3 === 0 ? 1 : 0.4,
      recompositionPreference: index % 3 === 0 ? 0 : 0.6,
    },
    quality: {
      pinyin: `wáng test ${index}`,
      tones: "2-4-2",
      meaning: `候选${givenName}的语义。`,
      semanticExplanation: "取字关系已经人工核对。",
      pronunciationNote: "声调起伏清楚。",
      usabilityNote: "日常读写可用。",
      uncommonnessNote: "相对少见但不猎奇。",
      primaryStyle: ["classical", "graceful", "gentle", "bright", "austere"][index % 5] as PersonalizedCandidate["quality"]["primaryStyle"],
      imageryCategory: `意象${index % 5}`,
    },
    eligibility: "recommendable",
    risks: [],
  };
}

const recommendationFixtures = Array.from({ length: 20 }, (_, index) =>
  recommendationCandidate(`令${String.fromCharCode(0x4e00 + index)}`, index),
);

function completeCalibration() {
  const profile = createDefaultProfile();
  profile.preference.calibrationProgress = 8;
  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

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
    render(<App corpusSearchClient={idleClient} />);

    expect(
      screen.getByRole("heading", { name: "为一个名字，留下完整来路" }),
    ).toBeTruthy();
    const metrics = within(screen.getByLabelText("候选规模"));
    expect(metrics.getByText("25")).toBeTruthy();
    expect(metrics.getByText("1,200")).toBeTruthy();
    expect(metrics.getByText("0 / 8")).toBeTruthy();
    expect(metrics.getByText("126")).toBeTruthy();
    expect(metrics.getByText("70")).toBeTruthy();
  });

  it("可以从总览进入 8 组家庭偏好校准", async () => {
    const corpusSearchClient: CorpusSearchClient = {
      discover: vi.fn(async () => recommendationFixtures),
      search: idleClient.search,
    };
    render(<App corpusSearchClient={corpusSearchClient} />);

    fireEvent.click(screen.getByRole("button", { name: "开始个性寻名" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "先用 8 组选择认识你们", level: 1 }),
      ).toBeTruthy();
    });
    for (let index = 0; index < 8; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: "跳过这组" }));
    }
    expect(await screen.findByRole("heading", { name: "个性寻名", level: 1 })).toBeTruthy();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(12);
    expect(screen.queryByText("女性感")).toBeNull();
    expect(screen.queryByRole("button", { name: "A + B 可靠出处" })).toBeNull();
  });

  it("V2 推荐资源失败后可从错误页重试", async () => {
    window.location.hash = "#explore";
    let attempts = 0;
    const corpusSearchClient: CorpusSearchClient = {
      discover: vi.fn(async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("测试资源中断。");
        return recommendationFixtures;
      }),
      search: idleClient.search,
    };
    render(<App corpusSearchClient={corpusSearchClient} />);

    expect(await screen.findByRole("heading", { name: "个性寻名暂时无法加载" })).toBeTruthy();
    expect(screen.getByText("测试资源中断。")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "重新加载推荐" }));

    expect(await screen.findByRole("heading", { name: "先用 8 组选择认识你们" })).toBeTruthy();
    expect(corpusSearchClient.discover).toHaveBeenCalledTimes(2);
  });

  it("从候选卡直接带名字进入完整典籍核查", async () => {
    window.location.hash = "#explore";
    completeCalibration();
    const candidates = [recommendationCandidate("景玉")];
    const corpusSearchClient: CorpusSearchClient = {
      discover: vi.fn(async () => candidates),
      search: vi.fn(async () => fullTextNoHit),
    };
    render(<App corpusSearchClient={corpusSearchClient} />);

    const heading = await screen.findByRole("heading", { name: "王景玉", level: 2 });
    const card = heading.closest("article");
    expect(card).toBeTruthy();
    fireEvent.click(within(card as HTMLElement).getByRole("button", { name: "查完整典籍" }));

    const search = await screen.findByRole("searchbox", {
      name: "输入姓名查找古籍原句",
    });
    expect((search as HTMLInputElement).value).toBe("王景玉");
    expect(window.location.hash).toContain("allusions?name=");
  });

  it("规则粗筛候选参与组批但明确标注待人工精审与 MMR 依据", async () => {
    window.location.hash = "#explore";
    completeCalibration();
    const reviewed = recommendationCandidate("景玉");
    const provisional: PersonalizedCandidate = {
      ...reviewed,
      evidence: { ...reviewed.evidence, reviewStatus: "rule-screened" },
      eligibility: "provisional",
      quality: {
        ...reviewed.quality,
        pinyin: "",
        tones: "",
        semanticExplanation: "组合语义仍待人工精审。",
      },
    };
    const corpusSearchClient: CorpusSearchClient = {
      discover: vi.fn(async () => [provisional]),
      search: idleClient.search,
    };
    render(<App corpusSearchClient={corpusSearchClient} />);

    const card = (await screen.findByRole("heading", {
      name: "王景玉",
      level: 2,
    })).closest("article") as HTMLElement;
    expect(within(card).getByText("规则粗筛 · 待人工精审")).toBeTruthy();
    expect(within(card).getByText("MMR 组批依据")).toBeTruthy();
    expect(within(card).getByText(/个人适配 .* × 75% \+ 本批差异 .* × 25%/)).toBeTruthy();
  });

  it("收藏与对照保留 V2 候选的语义和证据", async () => {
    window.location.hash = "#explore";
    completeCalibration();
    const candidate = recommendationCandidate("景玉");
    const corpusSearchClient: CorpusSearchClient = {
      discover: vi.fn(async () => [candidate]),
      search: vi.fn(async () => fullTextNoHit),
    };
    render(<App corpusSearchClient={corpusSearchClient} />);

    const card = (await screen.findByRole("heading", {
      name: "王景玉",
      level: 2,
    })).closest("article") as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: "收藏" }));
    fireEvent.click(within(card).getByRole("button", { name: "加入对照" }));
    expect(screen.getByRole("button", { name: "已收藏" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "展开对照" }));

    expect(await screen.findByRole("heading", { name: "王景玉", level: 2 })).toBeTruthy();
    expect(screen.getByText("候选景玉的语义。")).toBeTruthy();
    expect(screen.getByText("原文连续成词")).toBeTruthy();
    expect(screen.queryByText("文化分")).toBeNull();
  });

  it("方法页分开四层判断，不再展示旧文化总分", () => {
    window.location.hash = "#method";
    render(<App corpusSearchClient={idleClient} />);

    expect(screen.getByRole("heading", { name: "典籍证据" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "名字质量" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "个人适配" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "传统参考边界" })).toBeTruthy();
    expect(screen.getByText(/70 部古籍先广泛发现/)).toBeTruthy();
    expect(screen.getByText(/0\.75 × 个人适配 \+ 0\.25/)).toBeTruthy();
    expect(screen.queryByText("文化评分")).toBeNull();
    expect(screen.queryByText(/25%.*女性感/)).toBeNull();
  });

  it("出生前权重为零，出生后传统参考上限为 10%", async () => {
    window.location.hash = "#birth";
    const candidate = recommendationCandidate("景玉");
    const corpusSearchClient: CorpusSearchClient = {
      discover: vi.fn(async () => [candidate]),
      search: vi.fn(async () => fullTextNoHit),
    };
    render(<App corpusSearchClient={corpusSearchClient} />);

    expect(screen.getByText("传统权重自动为 0")).toBeTruthy();
    expect(screen.getByText(/2026 年 8 月 20–30 日/)).toBeTruthy();
    expect(screen.getByText("已有参考预排（不参与排序）")).toBeTruthy();
    expect(screen.getByDisplayValue(/丙午 丙申 甲子 丁卯/)).toBeTruthy();
    expect(await screen.findByText("王景玉")).toBeTruthy();
    expect(screen.queryByText("文化分")).toBeNull();
    expect(screen.queryByText("最终分")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "已出生" }));
    const slider = screen.getByRole("slider");
    expect(slider.getAttribute("max")).toBe("0.1");
    expect(screen.getByText(/0–10%/)).toBeTruthy();
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
