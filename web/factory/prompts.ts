import type { StructuredRequest } from "./deepseek.ts";
import type { PassageBatch } from "./corpus.ts";
import {
  adversarialReviewListJsonSchema,
  nameReviewListJsonSchema,
  parseAdversarialReviewList,
  parseNameReviewList,
  parsePointerSelectionList,
  parseSemanticReviewList,
  pointerSelectionListJsonSchema,
  semanticReviewListJsonSchema,
} from "./schema.ts";
import type {
  AdversarialReview,
  CandidateProposal,
  FactoryPassage,
  NameReview,
  PointerSelection,
  SemanticReview,
} from "./types.ts";

const generatorNamingContext = `
目标是为姓王的女孩寻找双字名。家庭不喜欢普通熟悉、随机摘字、拗口、偏男性化或像网名的组合，希望古典端雅、语义完整、读写自然，并适合长期日常使用。

奶奶名中有“玉”，姥姥名中有“绍、影”，这些只作为少量可选的家庭线索，不能主导选择，也不能机械加分。允许连续取字、同句首尾/对偶取字、同篇一致意象重组和跨篇文化重组，但优先选择组合后仍像真实中文姓名的两个字。
`.trim();

const reviewNamingContext = `
目标是为姓王的女孩寻找双字名。家庭不喜欢普通熟悉、随机摘字、拗口、偏男性化或像网名的组合；“王令仪”是目前可接受的古典端雅锚点，“王景玉”体现家族纪念但希望典故更扎实。奶奶名中有“玉”，姥姥名中有“绍、影”，这些只作为少量可选线索，不能主导候选，也不能机械加分。

允许原文连续取字、同句首尾/对偶取字、同篇一致意象重组和来源透明的文化重组。任何重组都必须如实说明，不能把组合伪装成原文成词。候选要同时像真实中文姓名、适合长期使用，并具有可复核的古籍证据。
`.trim();

function indexedText(text: string): string {
  return [...text].map((character, index) => `[${index}]${character}`).join(" ");
}

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
  };
}

function generatorPassagePayload(passage: FactoryPassage) {
  return {
    ...passagePayload(passage),
    indexedText: indexedText(passage.normalizedText),
  };
}

export function generationRequest(
  batch: PassageBatch,
  maxCandidatesPerPassage: number,
  phase: "calibration" | "generation" = "generation",
): StructuredRequest<PointerSelection[]> {
  return {
    phase,
    role: "candidate-generator",
    instructions: [
      "你是古典汉语取名的原文位置选择器，只选择两个字的位置，不评分，不声称审核通过。",
      generatorNamingContext,
      "绝对来源约束：只能使用本次 input.passages 中实际提供的 normalizedText，不得引用、补写、改写或暗示任何未提供的篇章、名句或典故。",
      "每个 passage 的 indexedText 已把 normalizedText 显示为“[编号]汉字”。选择字符时必须直接复制 indexedText 中方括号内的编号，不要自行计数，也不要使用 text 中含标点的位置。返回前逐项核对该编号后显示的汉字正是你想选择的字。",
      "每个选择只返回 first 与 second 两个指针；每个指针只包含 passageId 和 index。index 是 indexedText 中显示的编号，也是该 passage.normalizedText 按 Unicode 字符计数、从 0 开始的位置，不是某个字的出现次数。两个指针不得指向同一位置。",
      "first 指向名字的第一个字，second 指向名字的第二个字；可以连续、间隔、倒序或跨 passage 选择。程序会按位置读取原字，并自行计算名字、出现次数、来源关系与提取说明。",
      "除 meaning、rationale、imageryCategory、familyConnection 这些审美元数据外，只返回两个位置指针。不得返回或填写名字、汉字、出现次数、证据关系、提取说明、proposalId 或外部出处。",
      `每条原句最多选择 ${maxCandidatesPerPassage} 组真正自然的位置；没有好组合时可以不选择。`,
      "meaning 和 rationale 只能解释这两个位置实际指向的字组合后的含义与姓名感；familyConnection 没有真实关联时返回空字符串。",
      "优先选择同句、同段或同篇中语义完整的组合；跨 passage 仅限两个实际字符组合后格外自然且含义一致的情况。不要选择“在、之、兮、者、也、而、于”等容易形成残句感的虚词。",
      "避免集中使用玉、影、清、月、若、汐、梓、萱等高频命名字；优先语义完整、音节清楚、端雅但不陈俗的组合。",
    ].join("\n\n"),
    input: { batchId: batch.id, passages: batch.passages.map(generatorPassagePayload) },
    schemaName: "source_pointer_selections",
    schema: pointerSelectionListJsonSchema,
    parse: parsePointerSelectionList,
    maxOutputTokens: Math.max(1_200, batch.passages.length * maxCandidatesPerPassage * 180),
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
      reviewNamingContext,
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
      reviewNamingContext,
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
      reviewNamingContext,
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
