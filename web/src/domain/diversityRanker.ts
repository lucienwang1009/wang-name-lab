import type { PreferenceState } from "../state/storage";
import { NAME_FEATURE_KEYS } from "./nameFeatures";
import { personalFit, recommendationReasons } from "./preferenceModel";
import type { PersonalizedCandidate } from "./types";

export type BatchSelectionKind = "fit" | "diverse" | "explore";

export interface PersonalizedBatchItem {
  candidate: PersonalizedCandidate;
  fit: number;
  selectionKind: BatchSelectionKind;
  reasons: string[];
  mmr: {
    relevance: number;
    diversity: number;
    weightedScore: number;
    uncertainty: number;
    exposurePenalty: number;
    diversityBonus: number;
    selectionScore: number;
    closestSelectedName?: string;
  };
}

export interface PersonalizedBatchOptions {
  size?: number;
  excludedNames?: readonly string[];
}

export const similarityWeights = {
  style: 0.45,
  sharedCharacter: 0.2,
  pronunciation: 0.15,
  sourceBook: 0.1,
  evidenceRelation: 0.1,
} as const;

export const mmrWeights = {
  relevance: 0.75,
  diversity: 0.25,
} as const;

const styleKeys = [
  "classical",
  "graceful",
  "gentle",
  "bright",
  "austere",
  "modern",
] as const satisfies readonly (typeof NAME_FEATURE_KEYS)[number][];

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

function cosineSimilarity(
  left: PersonalizedCandidate,
  right: PersonalizedCandidate,
): number {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (const key of styleKeys) {
    const leftValue = left.features[key];
    const rightValue = right.features[key];
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return dot / Math.sqrt(leftMagnitude * rightMagnitude);
}

function sharesCharacter(left: string, right: string): boolean {
  const rightCharacters = new Set([...right]);
  return [...left].some((character) => rightCharacters.has(character));
}

function normalizedPinyin(candidate: PersonalizedCandidate): string {
  return candidate.quality.pinyin.trim().toLocaleLowerCase().replace(/[\s-]+/gu, "");
}

function sourceBooks(candidate: PersonalizedCandidate): Set<string> {
  return new Set(candidate.evidence.citations.map((citation) => citation.bookId));
}

export function candidateSimilarity(
  left: PersonalizedCandidate,
  right: PersonalizedCandidate,
): number {
  const leftBooks = sourceBooks(left);
  const sameBook = right.evidence.citations.some((citation) =>
    leftBooks.has(citation.bookId),
  );
  const leftPinyin = normalizedPinyin(left);
  const rightPinyin = normalizedPinyin(right);
  return (
    cosineSimilarity(left, right) * similarityWeights.style +
    Number(sharesCharacter(left.givenName, right.givenName)) *
      similarityWeights.sharedCharacter +
    Number(Boolean(leftPinyin) && leftPinyin === rightPinyin) *
      similarityWeights.pronunciation +
    Number(sameBook) * similarityWeights.sourceBook +
    Number(left.evidence.relation === right.evidence.relation) *
      similarityWeights.evidenceRelation
  );
}

function mmrBreakdown(
  candidate: PersonalizedCandidate,
  selected: readonly PersonalizedCandidate[],
  preference: PreferenceState,
  kind: BatchSelectionKind,
): PersonalizedBatchItem["mmr"] {
  const similarities = selected.map((item) => ({
    name: item.fullName,
    similarity: candidateSimilarity(candidate, item),
  }));
  const closest = [...similarities].sort(
    (left, right) =>
      right.similarity - left.similarity || compareText(left.name, right.name),
  )[0];
  const relevance = personalFit(preference, candidate);
  const diversity = 1 - (closest?.similarity ?? 0);
  const weightedScore =
    relevance * mmrWeights.relevance + diversity * mmrWeights.diversity;
  const uncertainty = 1 - Math.abs(relevance - 0.5) * 2;
  const penalty = exposurePenalty(preference, candidate);
  const bonus = kind === "diverse" ? diversityBonus(candidate, selected) : 0;
  const selectionScore = kind === "explore"
    ? uncertainty * 0.5 + diversity * 0.3 + relevance * 0.2 - penalty
    : weightedScore + bonus - penalty;
  return {
    relevance,
    diversity,
    weightedScore,
    uncertainty,
    exposurePenalty: penalty,
    diversityBonus: bonus,
    selectionScore,
    closestSelectedName: closest?.name,
  };
}

function exposurePenalty(
  preference: PreferenceState,
  candidate: PersonalizedCandidate,
): number {
  const count =
    preference.exposureCounts[candidate.fullName] ??
    preference.exposureCounts[candidate.givenName] ??
    0;
  return Math.min(0.48, Math.log1p(count) * 0.1);
}

function currentCharacterCounts(
  selected: readonly PersonalizedCandidate[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const candidate of selected) {
    for (const character of new Set([...candidate.givenName])) {
      counts.set(character, (counts.get(character) ?? 0) + 1);
    }
  }
  return counts;
}

function allowedAtLevel(
  candidate: PersonalizedCandidate,
  selected: readonly PersonalizedCandidate[],
  relaxationLevel: number,
): boolean {
  const pinyin = normalizedPinyin(candidate);
  if (
    relaxationLevel < 3 &&
    pinyin &&
    selected.some((item) => normalizedPinyin(item) === pinyin)
  ) {
    return false;
  }

  const categoryCount = selected.filter(
    (item) => item.quality.imageryCategory === candidate.quality.imageryCategory,
  ).length;
  if (relaxationLevel < 1 && categoryCount >= 3) return false;

  const characterCounts = currentCharacterCounts(selected);
  const maximumCharacterCount = relaxationLevel < 2 ? 2 : 3;
  if (
    relaxationLevel < 3 &&
    [...new Set([...candidate.givenName])].some(
      (character) => (characterCounts.get(character) ?? 0) >= maximumCharacterCount,
    )
  ) {
    return false;
  }
  return true;
}

function diversityBonus(
  candidate: PersonalizedCandidate,
  selected: readonly PersonalizedCandidate[],
): number {
  const styles = new Set(selected.map((item) => item.quality.primaryStyle));
  const relations = new Set(selected.map((item) => item.evidence.relation));
  const categories = new Set(selected.map((item) => item.quality.imageryCategory));
  return (
    Number(!styles.has(candidate.quality.primaryStyle)) * 0.18 +
    Number(!relations.has(candidate.evidence.relation)) * 0.12 +
    Number(!categories.has(candidate.quality.imageryCategory)) * 0.08
  );
}

function phaseScore(
  kind: BatchSelectionKind,
  candidate: PersonalizedCandidate,
  selected: readonly PersonalizedCandidate[],
  preference: PreferenceState,
): number {
  return mmrBreakdown(candidate, selected, preference, kind).selectionScore;
}

function chooseCandidate(
  remaining: readonly PersonalizedCandidate[],
  selected: readonly PersonalizedCandidate[],
  preference: PreferenceState,
  kind: BatchSelectionKind,
): PersonalizedCandidate | undefined {
  for (let relaxationLevel = 0; relaxationLevel <= 3; relaxationLevel += 1) {
    const eligible = remaining.filter((candidate) =>
      allowedAtLevel(candidate, selected, relaxationLevel),
    );
    if (eligible.length === 0) continue;
    return [...eligible].sort(
      (left, right) =>
        phaseScore(kind, right, selected, preference) -
          phaseScore(kind, left, selected, preference) ||
        compareText(left.id, right.id),
    )[0];
  }
  return undefined;
}

export function buildPersonalizedBatch(
  candidates: readonly PersonalizedCandidate[],
  preference: PreferenceState,
  options: PersonalizedBatchOptions = {},
): PersonalizedBatchItem[] {
  const requestedSize = Math.max(0, Math.round(options.size ?? 12));
  const excluded = new Set(options.excludedNames ?? []);
  const remaining = candidates
    .filter(
      (candidate) =>
        (candidate.eligibility === "recommendable" ||
          candidate.eligibility === "provisional") &&
        !excluded.has(candidate.fullName) &&
        !excluded.has(candidate.givenName),
    )
    .sort((left, right) => compareText(left.id, right.id));
  const size = Math.min(requestedSize, remaining.length);
  const fitTarget = Math.min(size, Math.ceil((size * 7) / 12));
  const exploreTarget = Math.min(size - fitTarget, Math.floor((size * 2) / 12));
  const diverseTarget = size - fitTarget - exploreTarget;
  const phases: Array<[BatchSelectionKind, number]> = [
    ["fit", fitTarget],
    ["diverse", diverseTarget],
    ["explore", exploreTarget],
  ];
  const selected: PersonalizedCandidate[] = [];
  const kinds = new Map<string, BatchSelectionKind>();
  const breakdowns = new Map<string, PersonalizedBatchItem["mmr"]>();

  for (const [kind, target] of phases) {
    for (let index = 0; index < target; index += 1) {
      const available = remaining.filter(
        (candidate) => !kinds.has(candidate.id),
      );
      const next = chooseCandidate(available, selected, preference, kind);
      if (!next) break;
      breakdowns.set(next.id, mmrBreakdown(next, selected, preference, kind));
      selected.push(next);
      kinds.set(next.id, kind);
    }
  }

  while (selected.length < size) {
    const available = remaining.filter((candidate) => !kinds.has(candidate.id));
    const next = chooseCandidate(available, selected, preference, "diverse");
    if (!next) break;
    breakdowns.set(next.id, mmrBreakdown(next, selected, preference, "diverse"));
    selected.push(next);
    kinds.set(next.id, "diverse");
  }

  return selected.map((candidate) => ({
    candidate,
    fit: personalFit(preference, candidate),
    selectionKind: kinds.get(candidate.id) ?? "diverse",
    reasons: recommendationReasons(preference, candidate),
    mmr: breakdowns.get(candidate.id) ??
      mmrBreakdown(candidate, [], preference, kinds.get(candidate.id) ?? "diverse"),
  }));
}
