// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { parseFactoryArgs } from "./config.ts";
import type { LoadedFactoryCorpus } from "./corpus.ts";
import type { StructuredRequest } from "./deepseek.ts";
import { runFactoryPipeline, type FactoryModelGateway } from "./pipeline.ts";
import type {
  AdversarialReview,
  CandidateProposal,
  FactoryPassage,
  NameReview,
  SemanticReview,
} from "./types.ts";

const passages: FactoryPassage[] = [
  {
    id: "shi-jing/1",
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
  },
  {
    id: "test/negative-sound",
    bookId: "shi-jing",
    bookTitle: "《诗经》",
    category: "经",
    period: "先秦",
    workTitle: "测试",
    chapterTitle: "测试",
    text: "八方和宁，嘉会可期。",
    normalizedText: "八方和宁嘉会可期",
    sourceUrl: "https://example.test/source",
    verificationUrl: "https://example.test/verify",
    score: 80,
  },
];

const corpus: LoadedFactoryCorpus = {
  corpusVersion: "fixture-v1",
  books: [{ id: "shi-jing", title: "《诗经》", category: "经", period: "先秦", priority: 1 }],
  passages,
};

function proposal(givenName: string, passageId = passages[0]?.id ?? ""): CandidateProposal {
  return {
    proposalId: `source:${givenName}`,
    givenName,
    relation: "exact-phrase",
    sources: [
      { character: [...givenName][0] ?? "令", passageId, occurrence: 0 },
      { character: [...givenName][1] ?? "仪", passageId, occurrence: 0 },
    ],
    extraction: "连续取字",
    meaning: "完整含义",
    rationale: "生成器内部理由不应泄露给匿名审查",
    imageryCategory: "德性",
    familyConnection: "",
  };
}

function config() {
  return parseFactoryArgs([
    "--live",
    "--run-id", "fixture-run",
    "--target", "2",
    "--passages-per-book", "2",
    "--batch-size", "8",
  ], { cwd: "/repo/web", env: {} });
}

function gateway({ rejectName }: { rejectName?: string } = {}) {
  const requests: Array<{ role: string; input: unknown }> = [];
  const structured = vi.fn(async <T,>(request: { role: string; input: unknown }) => {
    requests.push({ role: request.role, input: request.input });
    if (request.role === "candidate-generator") {
      return [proposal("令仪"), proposal("柔嘉"), proposal("八方", "test/negative-sound")] as T;
    }
    const candidates = ((request.input as { candidates?: Array<{ proposalId: string }> }).candidates ??
      (request.input as { finalists?: Array<{ proposalId: string }> }).finalists ?? []);
    if (request.role === "anonymous-semantic-reviewer") {
      return candidates.map((candidate): SemanticReview => ({
        proposalId: candidate.proposalId,
        decision: "approve",
        semanticScore: 0.9,
        evidenceScore: 0.9,
        explanation: "语义和证据成立。",
        risks: [],
      })) as T;
    }
    if (request.role === "name-sound-aesthetic-reviewer") {
      return candidates.map((candidate): NameReview => ({
        proposalId: candidate.proposalId,
        decision: candidate.proposalId.endsWith(rejectName ?? "__none__") ? "reject" : "approve",
        scores: { phonology: 0.9, nameFeel: 0.9, femininity: 0.88, usability: 0.86, distinctiveness: 0.8 },
        primaryStyle: "graceful",
        pronunciationNote: "自然",
        usabilityNote: "可用",
        uncommonnessNote: "少见",
        risks: [],
      })) as T;
    }
    return candidates.map((candidate): AdversarialReview => ({
      proposalId: candidate.proposalId,
      decision: "approve",
      critique: "未发现致命问题。",
      fatalIssues: [],
    })) as T;
  });
  return { gateway: { structured } as FactoryModelGateway, requests, structured };
}

describe("候选工厂分阶段流水线", () => {
  it("先用校准预算跑首批，首批全数硬失败时停止扩量", async () => {
    const badGateway: FactoryModelGateway = {
      async structured<T>(request: StructuredRequest<T>) {
        if (request.role !== "candidate-generator") throw new Error("不应进入审核阶段");
        return [proposal("八方", "test/negative-sound")] as T;
      },
    };
    await expect(runFactoryPipeline({ config: config(), corpus, gateway: badGateway }))
      .rejects.toThrow(/校准批次/);
  });

  it("只发布依次通过本地、语义、姓名感和对抗审核的候选", async () => {
    const fake = gateway({ rejectName: "柔嘉" });
    const result = await runFactoryPipeline({ config: config(), corpus, gateway: fake.gateway, now: () => new Date("2026-08-26T00:00:00Z") });
    expect(result.candidateFile.candidates.map((candidate) => candidate.givenName)).toEqual(["令仪"]);
    expect(result.report.items.find((item) => item.proposal.givenName === "八方")).toMatchObject({
      status: "rejected",
      localRisks: expect.arrayContaining([expect.objectContaining({ severity: "hard" })]),
    });
    expect(result.report.items.find((item) => item.proposal.givenName === "柔嘉")?.status).toBe("rejected");
  });

  it("匿名语义审查输入不包含生成器 rationale 或自评分", async () => {
    const fake = gateway();
    await runFactoryPipeline({ config: config(), corpus, gateway: fake.gateway });
    const semantic = fake.requests.find((request) => request.role === "anonymous-semantic-reviewer");
    expect(JSON.stringify(semantic?.input)).not.toContain("生成器内部理由");
    expect(JSON.stringify(semantic?.input)).not.toContain("semanticScore");
  });

  it("按批次保存检查点并能跳过已经完成的生成请求", async () => {
    const first = gateway();
    const checkpoints: unknown[] = [];
    const firstResult = await runFactoryPipeline({
      config: config(),
      corpus,
      gateway: first.gateway,
      onCheckpoint: async (value) => { checkpoints.push(value); },
    });
    expect(checkpoints.length).toBeGreaterThan(3);
    const resumed = gateway();
    await runFactoryPipeline({
      config: config(),
      corpus,
      gateway: resumed.gateway,
      checkpoint: firstResult.checkpoint,
    });
    expect(resumed.requests.some((request) => request.role === "candidate-generator")).toBe(false);
  });

  it("目标数量不足时不放宽硬规则凑数", async () => {
    const fake = gateway({ rejectName: "柔嘉" });
    const result = await runFactoryPipeline({ config: config(), corpus, gateway: fake.gateway });
    expect(result.candidateFile.count).toBeLessThan(config().target);
    expect(result.report.generatedCount).toBe(3);
  });
});
