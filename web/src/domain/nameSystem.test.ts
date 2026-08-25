import { describe, expect, it } from "vitest";

import {
  characterDictionary,
  classicalFragments,
  generationCharacters,
} from "../data/nameSystemData";
import {
  applyTraditionalReference,
  buildBirthScenarios,
  diversifyRawCandidates,
  generateAllusionCandidates,
  generateRawPool,
  normalizeGivenName,
  searchClassicalEvidence,
} from "./nameSystem";

describe("取名领域核心", () => {
  it("提供足够且不重复的古典用字", () => {
    const characters = characterDictionary.map((item) => item.char);

    expect(characterDictionary.length).toBeGreaterThanOrEqual(500);
    expect(new Set(characters).size).toBe(characters.length);
  });

  it("生成不少于二十五万个不重复姓名，并排除叠字", () => {
    const pool = generateRawPool(generationCharacters);

    expect(pool.length).toBeGreaterThanOrEqual(250_000);
    expect(new Set(pool.map((item) => item.name)).size).toBe(pool.length);
    expect(pool.every((item) => item.first !== item.second)).toBe(true);
  });

  it("默认粗筛结果跨意象门类均衡分布", () => {
    const pool = diversifyRawCandidates(generateRawPool(generationCharacters));
    const firstPage = pool.slice(0, 48);
    const categoryPairs = new Set(
      firstPage.map(
        (candidate) =>
          `${candidate.firstCategory}::${candidate.secondCategory}`,
      ),
    );

    expect(categoryPairs.size).toBeGreaterThanOrEqual(30);
    expect(
      firstPage.filter((candidate) => candidate.familyProxy > 0).length,
    ).toBeLessThan(firstPage.length / 2);
  });

  it("每个典故候选都保留可复核证据", () => {
    const candidates = generateAllusionCandidates(
      classicalFragments,
      new Set(characterDictionary.map((item) => item.char)),
    );

    expect(classicalFragments.length).toBeGreaterThanOrEqual(120);
    expect(new Set(classicalFragments.map((item) => item.corpus)).size).toBeGreaterThanOrEqual(
      6,
    );
    expect(new Set(classicalFragments.map((item) => item.id)).size).toBe(
      classicalFragments.length,
    );
    expect(candidates.length).toBeGreaterThanOrEqual(1_200);
    const coveredFragmentIds = new Set(
      candidates.map((candidate) => candidate.fragmentId),
    );
    expect(
      classicalFragments
        .filter((fragment) => !coveredFragmentIds.has(fragment.id))
        .map((fragment) => fragment.id),
    ).toEqual([]);
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

  it("出生前传统参考权重强制归零", () => {
    expect(
      applyTraditionalReference(0.72, "recommendable", {
        birthStatus: "未出生",
        metaphysicsWeight: 0.9,
        metaphysicsScore: 100,
      }),
    ).toEqual({
      effectiveMetaphysicsWeight: 0,
      adjustedPersonalFit: 0.72,
      status: "待出生后录入",
    });
  });

  it("出生后传统参考最高只占 10%", () => {
    expect(
      applyTraditionalReference(0.72, "recommendable", {
        birthStatus: "已出生",
        metaphysicsWeight: 0.9,
        metaphysicsScore: 100,
      }),
    ).toEqual({
      effectiveMetaphysicsWeight: 0.1,
      adjustedPersonalFit: 0.748,
      status: "已记录传统参考",
    });
  });

  it("硬性淘汰不能被传统评分恢复", () => {
    expect(
      applyTraditionalReference(0.95, "blocked", {
        birthStatus: "已出生",
        metaphysicsWeight: 0.1,
        metaphysicsScore: 100,
      }),
    ).toEqual({
      effectiveMetaphysicsWeight: 0,
      adjustedPersonalFit: null,
      status: "硬性淘汰",
    });
  });

  it("没有评分与理由时不假装已完成传统复排", () => {
    expect(
      applyTraditionalReference(0.72, "recommendable", {
        birthStatus: "已出生",
        metaphysicsWeight: 0.1,
      }),
    ).toEqual({
      effectiveMetaphysicsWeight: 0.1,
      adjustedPersonalFit: 0.72,
      status: "待传统参考说明",
    });
  });

  it("按名字分级检索原典证据，不把单字旁证冒充完整典故", () => {
    expect(normalizeGivenName("王景玉")).toBe("景玉");
    expect(normalizeGivenName(" 令仪 ")).toBe("令仪");

    const exact = searchClassicalEvidence("王令仪", classicalFragments);
    expect(exact.some((item) => item.grade === "A" && item.quote.includes("令仪"))).toBe(
      true,
    );

    const separated = searchClassicalEvidence("王皎舒", classicalFragments);
    expect(
      separated.some(
        (item) =>
          item.grade === "B" &&
          item.quote.includes("皎") &&
          item.quote.includes("舒"),
      ),
    ).toBe(true);

    const sameWork = searchClassicalEvidence("王云仪", classicalFragments);
    expect(sameWork.some((item) => item.grade === "C")).toBe(true);

    const familyIdea = searchClassicalEvidence("王景玉", classicalFragments);
    expect(familyIdea.some((item) => item.grade === "D")).toBe(true);
    expect(familyIdea.some((item) => item.grade === "E")).toBe(true);
    expect(familyIdea.some((item) => item.grade === "F")).toBe(true);
    expect(
      familyIdea
        .filter((item) => item.grade === "F")
        .every((item) => item.extraction.includes("不能作为完整名字出处")),
    ).toBe(true);
  });

  it("预产主窗口形成132个日期时辰情景", () => {
    expect(buildBirthScenarios("2026-08-20", "2026-08-30")).toHaveLength(132);
  });
});
