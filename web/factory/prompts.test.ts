// @vitest-environment node

import { describe, expect, it } from "vitest";

import { adversarialReviewRequest, generationRequest, nameReviewRequest } from "./prompts.ts";
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
  it("只让模型选择原文位置，不让模型填写名字和证据关系", () => {
    const request = generationRequest({ id: "source-0001-test", passages: [passage] }, 3, "calibration");
    expect(request.instructions).toMatch(/只能选择本次 input\.passages/u);
    expect(request.instructions).toMatch(/Unicode.*0 开始/u);
    expect(request.instructions).toMatch(/直接复制 indexedText.*编号/su);
    expect(request.instructions).toMatch(/不要自行计数/u);
    expect(request.instructions).toMatch(/必须来自同一个 passageId/u);
    expect(request.instructions).toMatch(/批次内横向比较/u);
    expect(request.instructions).toMatch(/宁缺毋滥/u);
    expect(request.instructions).toMatch(/只返回.*passageId.*index/su);
    expect(request.instructions).toMatch(/不得返回.*名字/su);
    expect(request.instructions).not.toMatch(/王令仪|王景玉/u);
    expect(JSON.stringify(request.schema)).not.toMatch(
      /givenName|character|occurrence|relation|extraction/u,
    );
    expect(request.input).toMatchObject({
      passages: [{
        passageId: passage.id,
        normalizedText: "柔嘉维则令仪令色",
        sourceWindows: expect.arrayContaining([
          {
            text: "柔嘉维则，令仪令色。",
            indexedText: "[0]柔 [1]嘉 [2]维 [3]则 [4]令 [5]仪 [6]令 [7]色",
          },
          {
            text: "令仪令色。",
            indexedText: "[4]令 [5]仪 [6]令 [7]色",
          },
        ]),
      }],
    });
    const inputPassage = (request.input as { passages: Array<Record<string, unknown>> }).passages[0];
    expect(inputPassage).not.toHaveProperty("indexedText");
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
    const nameRequest = nameReviewRequest([proposal]);
    expect(nameRequest.instructions).toMatch(/本地读音分析.*事实依据/su);
    expect(nameRequest.instructions).toMatch(/不能因为共享“仪”.*加分/su);
    expect(nameRequest.input).toMatchObject({
      candidates: [{
        fullName: "王令仪",
        localPronunciation: {
          pinyin: "wáng lìng yí",
          tones: "2-4-2",
          risks: expect.any(Array),
        },
      }],
    });

    const request = adversarialReviewRequest([proposal], new Map(), new Map());
    expect(request.reasoningEffort).toBe("none");
    expect(request.maxOutputTokens).toBeGreaterThanOrEqual(1_200);
    expect(request.instructions).toMatch(/普通轻微取舍.*approve/su);
    expect(request.instructions).toMatch(/manual-review.*实质未决风险/su);
    expect(request.instructions).toMatch(/面向家长.*短名单/su);
    expect(request.instructions).toMatch(/偏刚.*像普通词组.*reject/su);
    expect(request.instructions).toMatch(/critique.*180/u);
    expect(request.input).toMatchObject({
      finalists: [{
        fullName: "王令仪",
        localPronunciation: { pinyin: "wáng lìng yí", tones: "2-4-2" },
      }],
    });
  });
});
