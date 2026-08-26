// @vitest-environment node

import { describe, expect, it } from "vitest";

import { parseFactoryArgs } from "./config.ts";
import {
  parseCandidateProposal,
  parseNameReview,
  parsePointerSelectionList,
  parseSemanticReview,
  pointerSelectionListJsonSchema,
} from "./schema.ts";

const proposal = {
  proposalId: "batch-1:令仪",
  givenName: "令仪",
  relation: "exact-phrase",
  sources: [
    { character: "令", passageId: "shi-jing/1", occurrence: 0 },
    { character: "仪", passageId: "shi-jing/1", occurrence: 0 },
  ],
  extraction: "原文连续取字",
  meaning: "端美的仪度",
  rationale: "语义完整，适合作为女孩姓名",
  imageryCategory: "仪范",
  familyConnection: "",
};

describe("候选工厂运行时契约", () => {
  it("解析只包含两个原文位置和语义元数据的指针选择", () => {
    expect(parsePointerSelectionList({
      selections: [{
        first: { passageId: "shi-jing/1", index: 4 },
        second: { passageId: "shi-jing/1", index: 5 },
        meaning: "美好的仪范",
        rationale: "两字组合自然",
        imageryCategory: "仪范",
        familyConnection: "",
      }],
    })).toEqual([expect.objectContaining({
      first: { passageId: "shi-jing/1", index: 4 },
      second: { passageId: "shi-jing/1", index: 5 },
    })]);
  });

  it("指针响应拒绝模型自填名字、来源字和负数位置", () => {
    const base = {
      first: { passageId: "shi-jing/1", index: 4 },
      second: { passageId: "shi-jing/1", index: 5 },
      meaning: "美好的仪范",
      rationale: "两字组合自然",
      imageryCategory: "仪范",
      familyConnection: "",
    };
    expect(() => parsePointerSelectionList({ selections: [{ ...base, givenName: "令仪" }] }))
      .toThrow(/不允许字段/u);
    expect(() => parsePointerSelectionList({
      selections: [{ ...base, first: { passageId: "shi-jing/1", index: -1 } }],
    })).toThrow(/非负整数/u);
    expect(JSON.stringify(pointerSelectionListJsonSchema)).not.toMatch(/givenName|character|occurrence|relation|extraction/u);
  });

  it("解析来源完整的双字候选", () => {
    expect(parseCandidateProposal(proposal)).toMatchObject({
      givenName: "令仪",
      relation: "exact-phrase",
    });
  });

  it("拒绝来源字与姓名不一致的提案", () => {
    expect(() => parseCandidateProposal({
      ...proposal,
      sources: [proposal.sources[0], { ...proposal.sources[1], character: "容" }],
    })).toThrow(/组成 givenName/);
  });

  it("拒绝越界评分和未知审核结论", () => {
    expect(() => parseSemanticReview({
      proposalId: proposal.proposalId,
      decision: "approve",
      semanticScore: 1.2,
      evidenceScore: 0.9,
      explanation: "可用",
      risks: [],
    })).toThrow(/0 到 1/);
    expect(() => parseNameReview({
      proposalId: proposal.proposalId,
      decision: "maybe",
      scores: { phonology: 0.8, nameFeel: 0.8, femininity: 0.8, usability: 0.8, distinctiveness: 0.8 },
      primaryStyle: "classical",
      pronunciationNote: "自然",
      usabilityNote: "可用",
      uncommonnessNote: "少见",
      risks: [],
    })).toThrow(/审核结论/);
  });
});

describe("候选工厂 CLI 配置", () => {
  it("默认是 deepseek-v4-flash、20 元且不发起远程请求", () => {
    const config = parseFactoryArgs([], { cwd: "/repo/web", env: {} });
    expect(config).toMatchObject({
      model: "deepseek-v4-flash",
      promptVersion: "name-factory-v6",
      maxCny: 20,
      target: 400,
      dryRun: true,
      live: false,
    });
    expect(Object.values(config.phaseBudgetCny).reduce((sum, value) => sum + value, 0)).toBe(20);
  });

  it("冒烟模式把实际预算强制限制为 1 元", () => {
    const config = parseFactoryArgs(["--smoke", "--max-cny", "20"], { cwd: "/repo/web", env: {} });
    expect(config.maxCny).toBe(1);
    expect(config.target).toBe(3);
    expect(config.live).toBe(true);
  });

  it("支持显式 live 参数并拒绝未知选项", () => {
    expect(parseFactoryArgs(["--", "--live", "--target", "350"], { cwd: "/repo/web", env: {} }))
      .toMatchObject({ live: true, dryRun: false, target: 350 });
    expect(() => parseFactoryArgs(["--secret-key", "nope"], { cwd: "/repo/web", env: {} }))
      .toThrow(/未知参数/);
  });
});
