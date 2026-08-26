import type {
  NameFeatureVector,
  PersonalizedCandidate,
  RecommendationEligibility,
} from "./types";

export const NAME_FEATURE_KEYS = [
  "classical",
  "graceful",
  "gentle",
  "bright",
  "austere",
  "modern",
  "pronounceable",
  "writable",
  "recognizable",
  "uncommon",
  "familyMeaning",
  "exactPhrasePreference",
  "recompositionPreference",
] as const satisfies readonly (keyof NameFeatureVector)[];

export type NameFeatureKey = (typeof NAME_FEATURE_KEYS)[number];

const clampUnit = (value: number): number => Math.min(1, Math.max(0, value));

export function normalizeFeatures(
  input: Partial<Record<NameFeatureKey, number>>,
): NameFeatureVector {
  return Object.fromEntries(
    NAME_FEATURE_KEYS.map((key) => {
      const value = input[key];
      return [key, clampUnit(typeof value === "number" && Number.isFinite(value) ? value : 0)];
    }),
  ) as unknown as NameFeatureVector;
}

export function recommendationEligibility(
  candidate: Pick<PersonalizedCandidate, "evidence" | "quality" | "risks">,
): RecommendationEligibility {
  if (candidate.risks.some((risk) => risk.severity === "hard")) return "blocked";

  const hasCitation = candidate.evidence.citations.some(
    (citation) =>
      citation.quote.trim().length > 0 &&
      citation.bookTitle.trim().length > 0 &&
      citation.sourceUrl.startsWith("https://"),
  );
  const hasNameLevelExplanation =
    candidate.quality.meaning.trim().length > 0 &&
    candidate.quality.semanticExplanation.trim().length > 0 &&
    candidate.quality.pinyin.trim().length > 0;

  if (
    (candidate.evidence.reviewStatus === "reviewed" ||
      candidate.evidence.reviewStatus === "ai-reviewed") &&
    hasCitation &&
    hasNameLevelExplanation
  ) {
    return "recommendable";
  }
  if (candidate.evidence.reviewStatus === "rule-screened" && hasCitation) {
    return "provisional";
  }
  return "search-only";
}
