import { describe, expect, it } from "vitest";

import type { PersonalizedCandidate } from "./types";
import {
  NAME_FEATURE_KEYS,
  normalizeFeatures,
  recommendationEligibility,
} from "./nameFeatures";

function candidate(
  patch: Partial<PersonalizedCandidate> = {},
): PersonalizedCandidate {
  return {
    id: "candidate:令仪",
    surname: "王",
    givenName: "令仪",
    fullName: "王令仪",
    evidence: {
      relation: "exact-phrase",
      reviewStatus: "reviewed",
      extraction: "原文连续成词：令仪",
      citations: [
        {
          id: "citation:令仪",
          bookId: "shijing",
          bookTitle: "诗经",
          workTitle: "小雅",
          chapterTitle: "湛露",
          quote: "岂弟君子，莫不令仪。",
          sourceUrl: "https://example.com/shijing",
          verificationUrl: "https://example.com/shijing",
        },
      ],
    },
    features: normalizeFeatures({ classical: 0.95, graceful: 0.9 }),
    quality: {
      pinyin: "wáng lìng yí",
      tones: "2-4-2",
      meaning: "端正美好的仪范。",
      semanticExplanation: "令与仪在原句中构成完整词义。",
      pronunciationNote: "三字起伏清楚。",
      usabilityNote: "均为常用规范字。",
      uncommonnessNote: "少见程度待属地重名查询复核。",
      primaryStyle: "graceful",
      imageryCategory: "德仪风范",
    },
    eligibility: "recommendable",
    risks: [],
    ...patch,
  };
}

describe("名字级特征", () => {
  it("把全部特征归一化到零至一并补齐缺省值", () => {
    const features = normalizeFeatures({ classical: 2, gentle: -1 });

    expect(features).toMatchObject({ classical: 1, gentle: 0 });
    expect(Object.keys(features).sort()).toEqual([...NAME_FEATURE_KEYS].sort());
    expect(Object.values(features).every((value) => value >= 0 && value <= 1)).toBe(
      true,
    );
  });

  it("只有人工核验且名字级说明完整的候选可以主动推荐", () => {
    expect(recommendationEligibility(candidate())).toBe("recommendable");
    expect(
      recommendationEligibility(
        candidate({
          evidence: {
            ...candidate().evidence,
            reviewStatus: "automatic",
          },
        }),
      ),
    ).toBe("search-only");
    expect(
      recommendationEligibility(
        candidate({
          quality: {
            ...candidate().quality,
            semanticExplanation: "",
          },
        }),
      ),
    ).toBe("search-only");
  });

  it("通过完整流水线的 AI 审核候选也可以主动推荐", () => {
    expect(recommendationEligibility(candidate({
      evidence: { ...candidate().evidence, reviewStatus: "ai-reviewed" },
    }))).toBe("recommendable");
  });

  it("规则粗筛有可靠出处时进入待精审层而不冒充人工精审", () => {
    expect(
      recommendationEligibility(
        candidate({
          evidence: {
            ...candidate().evidence,
            reviewStatus: "rule-screened",
          },
          quality: {
            ...candidate().quality,
            pinyin: "",
            meaning: "",
            semanticExplanation: "",
          },
        }),
      ),
    ).toBe("provisional");
  });

  it("硬风险不会被其他特征抵消", () => {
    expect(
      recommendationEligibility(
        candidate({
          risks: [
            {
              code: "negative-context",
              kind: "source-context",
              severity: "hard",
              summary: "原句为明确贬义语境。",
            },
          ],
        }),
      ),
    ).toBe("blocked");
  });
});
