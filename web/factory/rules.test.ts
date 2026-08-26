// @vitest-environment node

import { describe, expect, it } from "vitest";

import { derivePronunciation, deduplicateProposals, runLocalRules } from "./rules.ts";
import type { CandidateProposal, FactoryPassage } from "./types.ts";

const passage: FactoryPassage = {
  id: "shi-jing/zheng-min/1",
  bookId: "shi-jing",
  bookTitle: "《诗经》",
  category: "经",
  period: "先秦",
  workTitle: "烝民",
  chapterTitle: "大雅",
  text: "柔嘉维则，令仪令色，小心翼翼。",
  normalizedText: "柔嘉维则令仪令色小心翼翼",
  sourceUrl: "https://example.test/source",
  verificationUrl: "https://example.test/verify",
  score: 100,
};

const proposal: CandidateProposal = {
  proposalId: "batch:令仪",
  givenName: "令仪",
  relation: "exact-phrase",
  sources: [
    { character: "令", passageId: passage.id, occurrence: 0 },
    { character: "仪", passageId: passage.id, occurrence: 0 },
  ],
  extraction: "原文连续取字",
  meaning: "端美的仪度",
  rationale: "姓名语义完整",
  imageryCategory: "仪范",
  familyConnection: "",
};

describe("本地姓名规则", () => {
  it("从完整王姓名称确定拼音、声调和多音风险", () => {
    const result = derivePronunciation("令仪");
    expect(result.pinyin).toBe("wáng lìng yí");
    expect(result.tones).toBe("2-4-2");
    expect(result.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "polyphonic-令", severity: "review" }),
    ]));
  });

  it("允许可复核的连续双字，复核风险不作为硬淘汰", () => {
    const result = runLocalRules(proposal, new Map([[passage.id, passage]]));
    expect(result.passed).toBe(true);
    expect(result.risks.some((item) => item.severity === "hard")).toBe(false);
  });

  it("拒绝虚词残片、叠字、非规范繁体与负面上下文", () => {
    const cases: CandidateProposal[] = [
      { ...proposal, proposalId: "之仪", givenName: "之仪", sources: [{ character: "之", passageId: passage.id, occurrence: 0 }, proposal.sources[1]] },
      { ...proposal, proposalId: "令令", givenName: "令令", sources: [proposal.sources[0], proposal.sources[0]] },
      { ...proposal, proposalId: "令儀", givenName: "令儀", sources: [proposal.sources[0], { character: "儀", passageId: passage.id, occurrence: 0 }] },
    ];
    for (const item of cases) {
      expect(runLocalRules(item, new Map([[passage.id, passage]])).passed).toBe(false);
    }
    const negative = { ...passage, id: "bad", text: "令仪死丧墓中", normalizedText: "令仪死丧墓中" };
    expect(runLocalRules({
      ...proposal,
      proposalId: "bad",
      sources: proposal.sources.map((source) => ({ ...source, passageId: negative.id })) as CandidateProposal["sources"],
    }, new Map([[negative.id, negative]])).passed).toBe(false);
  });

  it("拒绝虚假的连续、同句和同篇取字声明", () => {
    const other = { ...passage, id: "other", workTitle: "另一篇", text: "清嘉可人", normalizedText: "清嘉可人" };
    const exact = {
      ...proposal,
      givenName: "令嘉",
      sources: [proposal.sources[0], { character: "嘉", passageId: passage.id, occurrence: 0 }],
    } as CandidateProposal;
    expect(runLocalRules(exact, new Map([[passage.id, passage]])).passed).toBe(false);
    const clause = {
      ...exact,
      relation: "clause-related",
      sources: [proposal.sources[0], { character: "嘉", passageId: other.id, occurrence: 0 }],
    } as CandidateProposal;
    expect(runLocalRules(clause, new Map([[passage.id, passage], [other.id, other]])).passed).toBe(false);
  });

  it("在模型审核前稳定去除完全重复提案", () => {
    expect(deduplicateProposals([proposal, { ...proposal }])).toHaveLength(1);
    expect(deduplicateProposals([proposal, { ...proposal, proposalId: "other", relation: "clause-related" }])).toHaveLength(2);
  });

  it("阻止王姓后稳定负面谐音", () => {
    expect(derivePronunciation("八方").risks).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: "hard", code: "wang-explicit-negative-homophone" }),
    ]));
  });
});

