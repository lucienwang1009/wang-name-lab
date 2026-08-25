import { describe, expect, it } from "vitest";

import { createDefaultPreference } from "../state/storage";
import { normalizeFeatures } from "./nameFeatures";
import {
  personalFit,
  recommendationReasons,
  recordPairwiseChoice,
  sigmoid,
} from "./preferenceModel";
import type { PersonalizedCandidate } from "./types";

function candidate(
  givenName: string,
  features: Parameters<typeof normalizeFeatures>[0],
): PersonalizedCandidate {
  return {
    id: `candidate:${givenName}`,
    surname: "王",
    givenName,
    fullName: `王${givenName}`,
    evidence: {
      relation: "exact-phrase",
      reviewStatus: "reviewed",
      extraction: `原文连续：${givenName}`,
      citations: [],
    },
    features: normalizeFeatures(features),
    quality: {
      pinyin: "wáng test",
      tones: "2-1-2",
      meaning: "测试",
      semanticExplanation: "测试",
      pronunciationNote: "测试",
      usabilityNote: "测试",
      uncommonnessNote: "测试",
      primaryStyle: "classical",
      imageryCategory: "测试",
    },
    eligibility: "recommendable",
    risks: [],
  };
}

const classical = candidate("令仪", {
  classical: 1,
  graceful: 1,
  uncommon: 0.8,
  pronounceable: 0.9,
});
const modern = candidate("一诺", {
  modern: 1,
  bright: 0.8,
  uncommon: 0.2,
  pronounceable: 0.9,
});

describe("家庭偏好学习", () => {
  it("sigmoid 在极端输入下仍保持稳定", () => {
    expect(sigmoid(1_000)).toBe(1);
    expect(sigmoid(-1_000)).toBe(0);
    expect(sigmoid(0)).toBe(0.5);
  });

  it("二选一会提高胜者相对于败者的适配", () => {
    const initial = createDefaultPreference();
    const before = personalFit(initial, classical) - personalFit(initial, modern);
    const updated = recordPairwiseChoice(initial, classical, modern, "left");
    const after = personalFit(updated, classical) - personalFit(updated, modern);

    expect(after).toBeGreaterThan(before);
    expect(updated.feedback).toHaveLength(1);
    expect(updated.calibrationProgress).toBe(1);
  });

  it("跳过不改变模型，都不喜欢会降低两个候选的适配", () => {
    const initial = createDefaultPreference();

    expect(recordPairwiseChoice(initial, classical, modern, "skip")).toEqual(initial);
    const updated = recordPairwiseChoice(
      initial,
      classical,
      modern,
      "both-dislike",
    );
    expect(personalFit(updated, classical)).toBeLessThan(personalFit(initial, classical));
    expect(personalFit(updated, modern)).toBeLessThan(personalFit(initial, modern));
  });

  it("长期更新后权重仍在允许范围内", () => {
    let preference = createDefaultPreference();
    for (let index = 0; index < 300; index += 1) {
      preference = recordPairwiseChoice(preference, classical, modern, "left");
    }

    expect(Object.values(preference.weights).every((value) => value >= -3 && value <= 3))
      .toBe(true);
  });

  it("推荐理由来自贡献最大的可解释特征而不是百分制总分", () => {
    const reasons = recommendationReasons(createDefaultPreference(), classical, 3);

    expect(reasons.length).toBeGreaterThan(0);
    expect(reasons.join(" ")).toMatch(/古典|端雅|少见/u);
    expect(reasons.join(" ")).not.toMatch(/\d+分/u);
  });
});
