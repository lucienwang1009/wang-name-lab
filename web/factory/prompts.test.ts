// @vitest-environment node

import { describe, expect, it } from "vitest";

import { adversarialReviewRequest, generationRequest } from "./prompts.ts";
import type { CandidateProposal, FactoryPassage } from "./types.ts";

const passage: FactoryPassage = {
  id: "shi-jing/1",
  bookId: "shi-jing",
  bookTitle: "《诗经》",
  category: "经",
  period: "先秦",
  workTitle: "烝民",
  chapterTitle: "大雅",
  text: "柔嘉维则，令仪令色。",
  normalizedText: "柔嘉维则令仪令色",
  sourceUrl: "https://example.test/source",
  verificationUrl: "https://example.test/verify",
  score: 100,
};

describe("候选生成提示词", () => {
  it("明确限定输入原字、出现序号和证据关系", () => {
    const request = generationRequest({ id: "source-0001-test", passages: [passage] }, 3, "calibration");
    expect(request.instructions).toMatch(/只能使用本次 input\.passages/u);
    expect(request.instructions).toMatch(/只出现一次就必须填 0/u);
    expect(request.instructions).toMatch(/名字和 character 使用规范简体字/u);
    expect(request.instructions).toMatch(/exact-phrase 仅限同一 passage/u);
    expect(request.instructions).toMatch(/王令仪.*只用于理解风格/u);
    expect(request.input).toMatchObject({
      passages: [{ passageId: passage.id, allowedCharacters: expect.stringContaining("令仪") }],
    });
  });

  it("对抗复审不让隐藏推理耗尽结构化输出预算", () => {
    const proposal: CandidateProposal = {
      proposalId: "source-0001-test:令仪",
      givenName: "令仪",
      relation: "exact-phrase",
      sources: [
        { character: "令", passageId: passage.id, occurrence: 0 },
        { character: "仪", passageId: passage.id, occurrence: 0 },
      ],
      extraction: "连续取字",
      meaning: "美好的仪范",
      rationale: "自然",
      imageryCategory: "仪范",
      familyConnection: "",
    };
    const request = adversarialReviewRequest([proposal], new Map(), new Map());
    expect(request.reasoningEffort).toBe("none");
    expect(request.maxOutputTokens).toBeGreaterThanOrEqual(1_200);
  });
});
