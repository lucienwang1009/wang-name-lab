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
    expect(metrics.getByText("25,440")).toBeTruthy();
    expect(metrics.getByText("511")).toBeTruthy();
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
});
