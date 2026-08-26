// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { parseFactoryArgs } from "./config.ts";
import type { LoadedFactoryCorpus } from "./corpus.ts";
import type { StructuredRequest } from "./deepseek.ts";
import { runFactoryPipeline, type FactoryModelGateway } from "./pipeline.ts";
import type {
  AdversarialReview,
  FactoryPassage,
  NameReview,
  PointerSelection,
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

function pointerSelection(givenName: "令仪" | "柔嘉" | "八方" | "无效"): PointerSelection {
  const positions = {
    令仪: { passageId: passages[0]?.id ?? "", first: 4, second: 5 },
    柔嘉: { passageId: passages[0]?.id ?? "", first: 0, second: 1 },
    八方: { passageId: passages[1]?.id ?? "", first: 0, second: 1 },
    无效: { passageId: passages[0]?.id ?? "", first: 999, second: 1 },
  }[givenName];
  return {
    first: { passageId: positions.passageId, index: positions.first },
    second: { passageId: positions.passageId, index: positions.second },
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

function gateway({
  rejectName,
  nameScores,
  materialIssueName,
}: {
  rejectName?: string;
  nameScores?: Partial<NameReview["scores"]>;
  materialIssueName?: string;
} = {}) {
  const requests: Array<{ role: string; input: unknown }> = [];
  const structured = vi.fn(async <T,>(request: { role: string; input: unknown }) => {
    requests.push({ role: request.role, input: request.input });
    if (request.role === "candidate-generator") {
      return [
        pointerSelection("令仪"),
        pointerSelection("柔嘉"),
        pointerSelection("八方"),
        pointerSelection("无效"),
      ] as T;
    }
    const candidates = ((request.input as { candidates?: Array<{ proposalId: string; fullName?: string }> }).candidates ??
      (request.input as { finalists?: Array<{ proposalId: string; fullName?: string }> }).finalists ?? []);
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
        decision: candidate.fullName?.endsWith(rejectName ?? "__none__") ? "reject" : "approve",
        scores: {
          phonology: 0.9,
          nameFeel: 0.9,
          femininity: 0.88,
          usability: 0.86,
          distinctiveness: 0.8,
          ...nameScores,
        },
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
      materialIssues: candidate.fullName?.endsWith(materialIssueName ?? "__none__") ? ["姓名感不足"] : [],
      fatalIssues: [],
    })) as T;
  });
  return { gateway: { structured } as FactoryModelGateway, requests, structured };
}

describe("候选工厂分阶段流水线", () => {
  it("smoke 只取一个生成批次再完成审核链", async () => {
    const manyBooksCorpus: LoadedFactoryCorpus = {
      corpusVersion: "many-books-v1",
      books: Array.from({ length: 6 }, (_, index) => ({
        id: index === 0 ? "shi-jing" : `z-book-${index}`,
        title: `《测试${index}》`,
        category: "经",
        period: "先秦",
        priority: 1,
      })),
      passages: Array.from({ length: 6 }, (_, index) => ({
        ...passages[0]!,
        id: index === 0 ? passages[0]!.id : `z-book-${index}/1`,
        bookId: index === 0 ? "shi-jing" : `z-book-${index}`,
        bookTitle: `《测试${index}》`,
      })),
    };
    const fake = gateway();
    const smokeConfig = parseFactoryArgs(["--smoke", "--run-id", "smoke-fixture"], { cwd: "/repo/web", env: {} });
    await runFactoryPipeline({ config: smokeConfig, corpus: manyBooksCorpus, gateway: fake.gateway });
    expect(fake.requests.filter((request) => request.role === "candidate-generator")).toHaveLength(1);
    expect(fake.requests.length).toBeLessThanOrEqual(4);
  });

  it("先用校准预算跑首批，首批全数硬失败时停止扩量", async () => {
    const badGateway: FactoryModelGateway = {
      async structured<T>(request: StructuredRequest<T>) {
        if (request.role !== "candidate-generator") throw new Error("不应进入审核阶段");
        return [pointerSelection("八方")] as T;
      },
    };
    await expect(runFactoryPipeline({ config: config(), corpus, gateway: badGateway }))
      .rejects.toThrow(/校准批次/);
  });

  it("自动生成审计跨 passage 指针并在审核前淘汰", async () => {
    const checkpoints: Array<{ pointerIssues: Array<{ reason: string }> }> = [];
    const crossGateway: FactoryModelGateway = {
      async structured<T>(request: StructuredRequest<T>) {
        if (request.role !== "candidate-generator") throw new Error("不应进入审核阶段");
        return [{
          ...pointerSelection("柔嘉"),
          second: { passageId: passages[1]!.id, index: 1 },
        }] as T;
      },
    };
    await expect(runFactoryPipeline({
      config: config(),
      corpus,
      gateway: crossGateway,
      onCheckpoint: async (value) => { checkpoints.push(value); },
    })).rejects.toThrow(/校准批次/u);
    expect(checkpoints.at(-1)?.pointerIssues[0]?.reason).toMatch(/同一个段落/u);
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
    expect(result.report).toMatchObject({ pointerSelectionCount: 4, invalidPointerCount: 1 });
    expect(result.report.pointerIssues[0]?.reason).toMatch(/越界/u);
  });

  it("模型勉强 approve 但姓名感未达发布门槛时不进入对抗审核", async () => {
    const fake = gateway({ nameScores: { nameFeel: 0.82 } });
    const result = await runFactoryPipeline({ config: config(), corpus, gateway: fake.gateway });
    expect(result.candidateFile.count).toBe(0);
    expect(fake.requests.some((request) => request.role === "adversarial-final-reviewer")).toBe(false);
    expect(result.report.items.find((item) => item.proposal.givenName === "令仪")?.rejectionReasons)
      .toContain("姓名感 0.82 低于发布门槛 0.84。");
  });

  it("对抗复审即使填 approve，存在短名单实质问题也必须淘汰", async () => {
    const fake = gateway({ materialIssueName: "柔嘉" });
    const result = await runFactoryPipeline({ config: config(), corpus, gateway: fake.gateway });
    expect(result.candidateFile.candidates.map((candidate) => candidate.givenName)).toEqual(["令仪"]);
    expect(result.report.items.find((item) => item.proposal.givenName === "柔嘉")?.rejectionReasons)
      .toContain("姓名感不足");
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
