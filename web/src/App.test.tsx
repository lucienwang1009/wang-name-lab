import {
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

  it("可以输入名字并按证据等级反查古籍原句", () => {
    window.location.hash = "#allusions";
    render(<App />);

    const search = screen.getByRole("searchbox", {
      name: "输入姓名查找古籍原句",
    });
    fireEvent.change(search, { target: { value: "王令仪" } });
    expect(screen.getByText("原文连续出现：令仪")).toBeTruthy();

    fireEvent.change(search, { target: { value: "王景玉" } });
    expect(screen.getByText("暂未找到同句或同篇共同出处")).toBeTruthy();
    expect(screen.getByText("D级 · 同书异篇")).toBeTruthy();
    expect(screen.getByText("E级 · 跨典双源")).toBeTruthy();
    expect(
      screen.getAllByText(/不能作为完整名字出处/).length,
    ).toBeGreaterThan(0);
  });
});
