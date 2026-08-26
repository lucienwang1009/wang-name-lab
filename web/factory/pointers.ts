import { createHash } from "node:crypto";

import { normalizeSearchText, splitClassicalSentences } from "../src/corpus/normalizeText.ts";
import type { PassageBatch } from "./corpus.ts";
import type {
  CandidateProposal,
  FactoryPassage,
  PointerSelection,
  PointerSelectionIssue,
  SourceCharacterRef,
  SourcePointer,
} from "./types.ts";

export interface CompiledPointerSelections {
  proposals: CandidateProposal[];
  issues: PointerSelectionIssue[];
}

export interface PointerCompilerOptions {
  allowCrossPassage?: boolean;
}

interface ResolvedPointer {
  passage: FactoryPassage;
  index: number;
  character: string;
  occurrence: number;
}

function resolvePointer(
  pointer: SourcePointer,
  passagesById: ReadonlyMap<string, FactoryPassage>,
): { value?: ResolvedPointer; reason?: string } {
  const passage = passagesById.get(pointer.passageId);
  if (!passage) return { reason: `段落 ${pointer.passageId} 不属于当前批次。` };
  if (!Number.isSafeInteger(pointer.index) || pointer.index < 0) {
    return { reason: `段落 ${pointer.passageId} 的位置必须是非负整数。` };
  }
  const characters = [...passage.normalizedText];
  const character = characters[pointer.index];
  if (!character) {
    return { reason: `段落 ${pointer.passageId} 的位置 ${pointer.index} 越界（正文共 ${characters.length} 字）。` };
  }
  if (!/^\p{Script=Han}$/u.test(character)) {
    return { reason: `段落 ${pointer.passageId} 的位置 ${pointer.index} 不是汉字。` };
  }
  const occurrence = characters.slice(0, pointer.index).filter((item) => item === character).length;
  return { value: { passage, index: pointer.index, character, occurrence } };
}

function sentenceRangeAt(passage: FactoryPassage, index: number): { start: number; end: number } | undefined {
  let start = 0;
  for (const sentence of splitClassicalSentences(passage.text)) {
    const length = [...normalizeSearchText(sentence)].length;
    const end = start + length;
    if (index >= start && index < end) return { start, end };
    start = end;
  }
  if (index >= 0 && index < [...passage.normalizedText].length) {
    return { start: 0, end: [...passage.normalizedText].length };
  }
  return undefined;
}

function sameSentence(first: ResolvedPointer, second: ResolvedPointer): boolean {
  if (first.passage.id !== second.passage.id) return false;
  const firstRange = sentenceRangeAt(first.passage, first.index);
  const secondRange = sentenceRangeAt(second.passage, second.index);
  return Boolean(
    firstRange &&
    secondRange &&
    firstRange.start === secondRange.start &&
    firstRange.end === secondRange.end,
  );
}

function relation(first: ResolvedPointer, second: ResolvedPointer): CandidateProposal["relation"] {
  if (first.passage.id === second.passage.id) {
    if (second.index === first.index + 1) return "exact-phrase";
    if (sameSentence(first, second)) return "clause-related";
    return "passage-related";
  }
  if (
    first.passage.bookId === second.passage.bookId &&
    first.passage.workTitle.length > 0 &&
    first.passage.workTitle === second.passage.workTitle
  ) return "passage-related";
  return "cultural-recomposition";
}

function sourceRef(pointer: ResolvedPointer): SourceCharacterRef {
  return {
    passageId: pointer.passage.id,
    character: pointer.character,
    occurrence: pointer.occurrence,
  };
}

function sourceLabel(pointer: ResolvedPointer): string {
  const work = pointer.passage.workTitle ? `·${pointer.passage.workTitle}` : "";
  return `${pointer.passage.bookTitle}${work}规范正文第 ${pointer.index + 1} 字“${pointer.character}”`;
}

function extraction(first: ResolvedPointer, second: ResolvedPointer, value: CandidateProposal["relation"]): string {
  const relationLabel: Record<CandidateProposal["relation"], string> = {
    "exact-phrase": "原文连续取字",
    "clause-related": "同句位置取字",
    "passage-related": "同篇语境取字",
    "cultural-recomposition": "跨篇原文位置重组",
  };
  return `程序按原文位置核定：${sourceLabel(first)}，${sourceLabel(second)}；${relationLabel[value]}。`;
}

function proposalId(batchId: string, selection: PointerSelection): string {
  const digest = createHash("sha256")
    .update([
      batchId,
      selection.first.passageId,
      String(selection.first.index),
      selection.second.passageId,
      String(selection.second.index),
    ].join("\n"))
    .digest("hex")
    .slice(0, 16);
  return `${batchId}:pointer-${digest}`;
}

export function compilePointerSelections(
  selections: readonly PointerSelection[],
  batch: PassageBatch,
  { allowCrossPassage = true }: PointerCompilerOptions = {},
): CompiledPointerSelections {
  const passagesById = new Map(batch.passages.map((passage) => [passage.id, passage]));
  const proposals: CandidateProposal[] = [];
  const issues: PointerSelectionIssue[] = [];
  selections.forEach((selection, selectionIndex) => {
    const first = resolvePointer(selection.first, passagesById);
    const second = resolvePointer(selection.second, passagesById);
    const reasons = [first.reason, second.reason].filter((value): value is string => Boolean(value));
    if (
      selection.first.passageId === selection.second.passageId &&
      selection.first.index === selection.second.index
    ) reasons.push("两个来源位置不能相同。");
    if (!allowCrossPassage && selection.first.passageId !== selection.second.passageId) {
      reasons.push("自动生成的两个来源位置必须来自同一个段落。");
    }
    if (!first.value || !second.value || reasons.length > 0) {
      issues.push({ batchId: batch.id, selectionIndex, reason: reasons.join("；"), selection });
      return;
    }
    const evidenceRelation = relation(first.value, second.value);
    proposals.push({
      proposalId: proposalId(batch.id, selection),
      givenName: `${first.value.character}${second.value.character}`,
      relation: evidenceRelation,
      sources: [sourceRef(first.value), sourceRef(second.value)],
      extraction: extraction(first.value, second.value, evidenceRelation),
      meaning: selection.meaning,
      rationale: selection.rationale,
      imageryCategory: selection.imageryCategory,
      familyConnection: selection.familyConnection,
    });
  });
  return { proposals, issues };
}
