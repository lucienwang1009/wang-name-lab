import { describe, expect, it } from "vitest";

import { normalizeSearchText, splitClassicalSentences } from "./normalizeText";

describe("古籍原句规范化", () => {
  it("按句末标点切分并保留展示标点", () => {
    expect(
      splitClassicalSentences(
        "关关雎鸠，在河之洲。窈窕淑女，君子好逑！其三；末句",
      ),
    ).toEqual([
      "关关雎鸠，在河之洲。",
      "窈窕淑女，君子好逑！",
      "其三；",
      "末句",
    ]);
  });

  it("建立简体、无标点、无空白的检索文本", () => {
    expect(normalizeSearchText("大學 之道，在明明德。\n")).toBe(
      "大学之道在明明德",
    );
  });

  it("不删除古籍正文中的汉字和生僻字", () => {
    expect(normalizeSearchText("關關雎鳩，璆鏘鳴兮。"))
      .toBe("关关雎鸠璆锵鸣兮");
  });
});
