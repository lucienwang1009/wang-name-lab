import { describe, expect, it } from "vitest";

import {
  characterDictionary,
  classicalFragments,
  curatedCandidates,
  generationCharacters,
} from "../data/nameSystemData";
import {
  buildBirthScenarios,
  culturalScore,
  generateAllusionCandidates,
  generateRawPool,
  rerankCandidate,
} from "./nameSystem";

describe("取名领域核心", () => {
  it("提供足够且不重复的古典用字", () => {
    const characters = characterDictionary.map((item) => item.char);

    expect(characterDictionary.length).toBeGreaterThanOrEqual(145);
    expect(new Set(characters).size).toBe(characters.length);
  });

  it("生成不少于两万个不重复姓名，并排除叠字", () => {
    const pool = generateRawPool(generationCharacters);

    expect(pool.length).toBeGreaterThanOrEqual(20_000);
    expect(new Set(pool.map((item) => item.name)).size).toBe(pool.length);
    expect(pool.every((item) => item.first !== item.second)).toBe(true);
  });

  it("每个典故候选都保留可复核证据", () => {
    const candidates = generateAllusionCandidates(
      classicalFragments,
      new Set(characterDictionary.map((item) => item.char)),
    );

    expect(candidates.length).toBeGreaterThanOrEqual(500);
    expect(
      candidates.every(
        (item) =>
          item.source.length > 0 &&
          item.quote.length > 0 &&
          item.extraction.length > 0 &&
          item.url.startsWith("http"),
      ),
    ).toBe(true);
  });

  it("硬筛失败时文化分归零", () => {
    const rejected = curatedCandidates.find((item) => item.gate === "不通过");
    expect(rejected).toBeDefined();
    expect(culturalScore(rejected!)).toBe(0);
  });

  it("出生前命理权重强制归零，出生后才允许参与", () => {
    const candidate = curatedCandidates[0]!;
    const culture = culturalScore(candidate);

    expect(
      rerankCandidate(candidate, {
        birthStatus: "未出生",
        metaphysicsWeight: 0.15,
        metaphysicsScore: 100,
      }),
    ).toEqual({
      culturalScore: culture,
      effectiveMetaphysicsWeight: 0,
      finalScore: culture,
      status: "待出生后录入",
    });

    expect(
      rerankCandidate(candidate, {
        birthStatus: "已出生",
        metaphysicsWeight: 0.15,
        metaphysicsScore: 100,
      }).effectiveMetaphysicsWeight,
    ).toBe(0.15);
  });

  it("预产主窗口形成132个日期时辰情景", () => {
    expect(buildBirthScenarios("2026-08-20", "2026-08-30")).toHaveLength(132);
  });
});

