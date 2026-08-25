import { describe, expect, it } from "vitest";

import { createDefaultPreference } from "../state/storage";
import { normalizeFeatures } from "./nameFeatures";
import {
  buildPersonalizedBatch,
  candidateSimilarity,
} from "./diversityRanker";
import type {
  EvidenceRelation,
  NameStyle,
  PersonalizedCandidate,
} from "./types";

const styles: NameStyle[] = [
  "graceful",
  "gentle",
  "bright",
  "austere",
  "classical",
  "modern",
];
const relations: EvidenceRelation[] = [
  "exact-phrase",
  "clause-related",
  "passage-related",
  "cultural-recomposition",
];
const names = [
  "令仪",
  "疏影",
  "皎舒",
  "清圆",
  "兰佩",
  "云裳",
  "玉兰",
  "玉清",
  "玉华",
  "瑶碧",
  "盈袖",
  "静姝",
  "露华",
  "秋兰",
  "明睐",
  "芳甸",
  "琬琰",
  "宜笑",
];

function candidate(index: number): PersonalizedCandidate {
  const givenName = names[index] ?? `测试${index}`;
  const style = styles[index % styles.length] ?? "classical";
  const relation = relations[index % relations.length] ?? "exact-phrase";
  return {
    id: `candidate:${String(index).padStart(2, "0")}`,
    surname: "王",
    givenName,
    fullName: `王${givenName}`,
    evidence: {
      relation,
      reviewStatus: "reviewed",
      extraction: "测试取字",
      citations: [
        {
          id: `citation:${index}`,
          bookId: `book:${index % 5}`,
          bookTitle: `典籍${index % 5}`,
          workTitle: "测试篇",
          chapterTitle: "测试章",
          quote: "测试原句",
          sourceUrl: "https://example.com/source",
          verificationUrl: "https://example.com/verify",
        },
      ],
    },
    features: normalizeFeatures({
      classical: style === "modern" ? 0.4 : 0.9,
      graceful: style === "graceful" ? 1 : 0.3,
      gentle: style === "gentle" ? 1 : 0.3,
      bright: style === "bright" ? 1 : 0.3,
      austere: style === "austere" ? 1 : 0.3,
      modern: style === "modern" ? 1 : 0.2,
      pronounceable: 0.9,
      writable: 0.85,
      recognizable: 0.9,
      uncommon: 0.55 + (index % 4) * 0.1,
      exactPhrasePreference: relation === "exact-phrase" ? 1 : 0.2,
      recompositionPreference: relation === "cultural-recomposition" ? 1 : 0.2,
    }),
    quality: {
      pinyin: index === 1 || index === 2 ? "wáng tóng yīn" : `wáng name ${index}`,
      tones: "2-1-2",
      meaning: "测试含义",
      semanticExplanation: "测试语义",
      pronunciationNote: "测试读音",
      usabilityNote: "测试易用",
      uncommonnessNote: "测试少见度",
      primaryStyle: style,
      imageryCategory: `意象${index % 5}`,
    },
    eligibility: "recommendable",
    risks: [],
  };
}

const candidates = names.map((_, index) => candidate(index));

function maximumSharedCharacterCount(batch: PersonalizedCandidate[]): number {
  const counts = new Map<string, number>();
  for (const item of batch) {
    for (const character of new Set([...item.givenName])) {
      counts.set(character, (counts.get(character) ?? 0) + 1);
    }
  }
  return Math.max(0, ...counts.values());
}

describe("个性化多样性组批", () => {
  it("相似度综合风格、共享字、读音、典籍和取字方式", () => {
    expect(candidateSimilarity(candidates[1]!, candidates[2]!)).toBeGreaterThan(
      candidateSimilarity(candidates[1]!, candidates[10]!),
    );
  });

  it("生成确定性的十二名 7+3+2 批次并满足可用的多样性约束", () => {
    const preference = createDefaultPreference();
    const first = buildPersonalizedBatch(candidates, preference, { size: 12 });
    const second = buildPersonalizedBatch([...candidates].reverse(), preference, {
      size: 12,
    });
    const selected = first.map((item) => item.candidate);

    expect(first).toEqual(second);
    expect(first).toHaveLength(12);
    expect(first.filter((item) => item.selectionKind === "fit")).toHaveLength(7);
    expect(first.filter((item) => item.selectionKind === "diverse")).toHaveLength(3);
    expect(first.filter((item) => item.selectionKind === "explore")).toHaveLength(2);
    expect(maximumSharedCharacterCount(selected)).toBeLessThanOrEqual(2);
    expect(new Set(selected.map((item) => item.quality.pinyin)).size).toBe(12);
    expect(new Set(selected.map((item) => item.quality.primaryStyle)).size)
      .toBeGreaterThanOrEqual(3);
    expect(new Set(selected.map((item) => item.evidence.relation)).size)
      .toBeGreaterThanOrEqual(2);
  });

  it("排除明确拒绝项，并通过曝光惩罚降低反复出现", () => {
    const baseline = buildPersonalizedBatch(candidates, createDefaultPreference(), {
      size: 5,
    });
    const repeatedName = baseline[0]!.candidate.fullName;
    const preference = {
      ...createDefaultPreference(),
      exposureCounts: { [repeatedName]: 100 },
    };
    const penalized = buildPersonalizedBatch(candidates, preference, {
      size: 5,
      excludedNames: [candidates[1]!.fullName],
    });

    expect(penalized[0]!.candidate.fullName).not.toBe(repeatedName);
    expect(penalized.some((item) => item.candidate.fullName === candidates[1]!.fullName))
      .toBe(false);
  });

  it("候选不足时只放宽多样性约束并返回所有安全候选", () => {
    const small = buildPersonalizedBatch(candidates.slice(0, 4), createDefaultPreference(), {
      size: 12,
    });

    expect(small).toHaveLength(4);
    expect(small.every((item) => item.candidate.eligibility === "recommendable")).toBe(
      true,
    );
  });
});
