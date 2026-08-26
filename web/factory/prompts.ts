import type { StructuredRequest } from "./deepseek.ts";
import type { PassageBatch } from "./corpus.ts";
import {
  adversarialReviewListJsonSchema,
  nameReviewListJsonSchema,
  parseAdversarialReviewList,
  parseNameReviewList,
  parseProposalList,
  parseSemanticReviewList,
  proposalListJsonSchema,
  semanticReviewListJsonSchema,
} from "./schema.ts";
import type {
  AdversarialReview,
  CandidateProposal,
  FactoryPassage,
  NameReview,
  SemanticReview,
} from "./types.ts";

const sharedNamingContext = `
目标是为姓王的女孩寻找双字名。家庭不喜欢普通熟悉、随机摘字、拗口、偏男性化或像网名的组合；“王令仪”是目前可接受的古典端雅锚点，“王景玉”体现家族纪念但希望典故更扎实。奶奶名中有“玉”，姥姥名中有“绍、影”，这些只作为少量可选线索，不能主导候选，也不能机械加分。

允许原文连续取字、同句首尾/对偶取字、同篇一致意象重组和来源透明的文化重组。任何重组都必须如实说明，不能把组合伪装成原文成词。候选要同时像真实中文姓名、适合长期使用，并具有可复核的古籍证据。
`.trim();

function passagePayload(passage: FactoryPassage) {
  return {
    passageId: passage.id,
    bookId: passage.bookId,
    bookTitle: passage.bookTitle,
    category: passage.category,
    period: passage.period,
    workTitle: passage.workTitle,
    chapterTitle: passage.chapterTitle,
    text: passage.text,
    normalizedText: passage.normalizedText,
    allowedCharacters: [...new Set([...passage.normalizedText])].join(""),
  };
}

export function generationRequest(
  batch: PassageBatch,
  maxCandidatesPerPassage: number,
  phase: "calibration" | "generation" = "generation",
): StructuredRequest<CandidateProposal[]> {
  return {
    phase,
    role: "candidate-generator",
    instructions: [
      "你是古典汉语取名候选生成器，只提出候选，不评分，不声称审核通过。",
      sharedNamingContext,
      "绝对来源约束：只能使用本次 input.passages，不得引用、补写或暗示任何未提供的篇章、名句或典故；审美锚点“王令仪”和家庭示例“王景玉”只用于理解风格，除非相应字实际出现在所给原文，否则绝不能作为候选或出处。",
      "givenName 的第一个字必须逐字等于 sources[0].character，第二个字必须逐字等于 sources[1].character；名字和 character 使用规范简体字，每个 character 必须原样出现在对应 passage 的 allowedCharacters 与 normalizedText 中。原文 text 可能是繁体，但只允许确定的简繁对应，不得做异体猜测或同义替换。",
      "occurrence 是同一个 character 在该 passage.normalizedText 中从 0 开始的出现次数序号：只出现一次就必须填 0。无法确定原字和序号时，宁可不生成。",
      "关系必须如实标注：exact-phrase 仅限同一 passage 中两字按该顺序连续出现；clause-related 限同一句或紧密分句；passage-related 限同一 passage；跨 passage 只能标 cultural-recomposition。",
      `每条原句最多提出 ${maxCandidatesPerPassage} 个真正自然的候选；没有好名字时可以不生成。`,
      "extraction 只能描述所给原文中实际可见的字词关系，不得用外部名句给组合补证。",
      "proposalId 必须使用“批次ID:givenName”的形式，givenName 不含姓氏“王”。familyConnection 没有真实关联时返回空字符串。",
      "避免集中使用玉、影、清、月、若、汐、梓、萱等高频命名字；优先语义完整、音节清楚、端雅但不陈俗的组合。",
    ].join("\n\n"),
    input: { batchId: batch.id, passages: batch.passages.map(passagePayload) },
    schemaName: "candidate_proposals",
    schema: proposalListJsonSchema,
    parse: parseProposalList,
    maxOutputTokens: Math.max(1_200, batch.passages.length * maxCandidatesPerPassage * 280),
    reasoningEffort: "none",
    temperature: 0.85,
  };
}

function proposalForReview(proposal: CandidateProposal, passagesById: ReadonlyMap<string, FactoryPassage>) {
  const passageIds = [...new Set(proposal.sources.map((source) => source.passageId))];
  return {
    proposalId: proposal.proposalId,
    fullName: `王${proposal.givenName}`,
    relation: proposal.relation,
    sources: proposal.sources,
    claimedExtraction: proposal.extraction,
    claimedMeaning: proposal.meaning,
    sourcePassages: passageIds.map((id) => {
      const passage = passagesById.get(id);
      return passage ? passagePayload(passage) : { passageId: id, missing: true };
    }),
  };
}

export function semanticReviewRequest(
  proposals: readonly CandidateProposal[],
  passagesById: ReadonlyMap<string, FactoryPassage>,
): StructuredRequest<SemanticReview[]> {
  return {
    phase: "semantic-review",
    role: "anonymous-semantic-reviewer",
    instructions: [
      "你是独立的古典语义审查员。你没有看到生成器的自我评价，也不要推测生成意图。",
      sharedNamingContext,
      "核对两个字组合后是否形成完整自然的姓名语义、claimedMeaning 是否忠于所给原句、relation 是否夸大。",
      "只有 semanticScore 与 evidenceScore 均不低于 0.72，且没有实质语义风险时才 approve；证据或含义需要人工判断时 manual-review；牵强、残句或失实时 reject。",
      "risks 必须具体，不得只写‘一般’‘待考’。",
    ].join("\n\n"),
    input: { candidates: proposals.map((proposal) => proposalForReview(proposal, passagesById)) },
    schemaName: "semantic_reviews",
    schema: semanticReviewListJsonSchema,
    parse: parseSemanticReviewList,
    maxOutputTokens: Math.max(1_200, proposals.length * 220),
    reasoningEffort: "none",
    temperature: 0.15,
  };
}

export function nameReviewRequest(
  proposals: readonly CandidateProposal[],
): StructuredRequest<NameReview[]> {
  return {
    phase: "name-review",
    role: "name-sound-aesthetic-reviewer",
    instructions: [
      "你是独立的现代中文姓名审美与使用审查员，不评价古籍证据强弱，也看不到语义审查得分。",
      sharedNamingContext,
      "只从完整姓名王××出发，严格评估声调节奏、声母韵母碰撞、谐音、常见误读、字形重心、女性气质、时代感、随机拼字感、网名感和长期日常使用。",
      "nameFeel 或 phonology 低于 0.72 必须 reject；存在可接受但需核对的方言、多音或碰撞时 manual-review。不要因为字面古雅就放宽姓名感。",
    ].join("\n\n"),
    input: {
      candidates: proposals.map((proposal) => ({
        proposalId: proposal.proposalId,
        fullName: `王${proposal.givenName}`,
        givenName: proposal.givenName,
        claimedMeaning: proposal.meaning,
      })),
    },
    schemaName: "name_reviews",
    schema: nameReviewListJsonSchema,
    parse: parseNameReviewList,
    maxOutputTokens: Math.max(1_200, proposals.length * 240),
    reasoningEffort: "none",
    temperature: 0.1,
  };
}

export function adversarialReviewRequest(
  proposals: readonly CandidateProposal[],
  semanticById: ReadonlyMap<string, SemanticReview>,
  nameById: ReadonlyMap<string, NameReview>,
): StructuredRequest<AdversarialReview[]> {
  return {
    phase: "adversarial-review",
    role: "adversarial-final-reviewer",
    instructions: [
      "你是候选发布前的反方审查员。任务不是赞美，而是尽力找出高分候选仍然可能难听、牵强、像网名、像男性名、像生造词、产生负面联想或难以长期使用的原因。",
      sharedNamingContext,
      "只有在认真寻找反例后仍无致命问题才 approve。可核实但尚不致命的问题用 manual-review；fatalIssues 非空时必须 reject。",
    ].join("\n\n"),
    input: {
      finalists: proposals.map((proposal) => ({
        proposalId: proposal.proposalId,
        fullName: `王${proposal.givenName}`,
        relation: proposal.relation,
        meaning: proposal.meaning,
        semanticExplanation: semanticById.get(proposal.proposalId)?.explanation ?? "",
        pronunciationNote: nameById.get(proposal.proposalId)?.pronunciationNote ?? "",
        usabilityNote: nameById.get(proposal.proposalId)?.usabilityNote ?? "",
      })),
    },
    schemaName: "adversarial_reviews",
    schema: adversarialReviewListJsonSchema,
    parse: parseAdversarialReviewList,
    maxOutputTokens: Math.max(1_200, proposals.length * 180),
    // The adversarial role is enforced by the prompt and independent review input.
    // Hidden high-effort reasoning can consume the entire Responses output budget
    // before JSON is emitted, so keep reasoning disabled for deterministic review output.
    reasoningEffort: "none",
    temperature: 0.1,
  };
}
