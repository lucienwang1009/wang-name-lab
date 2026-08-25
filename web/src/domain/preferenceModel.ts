import {
  DEFAULT_PREFERENCE_WEIGHTS,
  type PairwiseChoice,
  type PreferenceState,
  type PreferenceWeights,
} from "../state/storage";
import { NAME_FEATURE_KEYS, type NameFeatureKey } from "./nameFeatures";
import type { PersonalizedCandidate } from "./types";

const learningRate = 0.4;
const shrinkage = 0.015;
const explicitFeedbackWeight = 1.25;

const featureLabels: Record<NameFeatureKey, string> = {
  classical: "古典气质",
  graceful: "端雅风格",
  gentle: "柔和气质",
  bright: "明净明丽",
  austere: "清峻疏朗",
  modern: "现代感",
  pronounceable: "完整姓名易读",
  writable: "日常书写方便",
  recognizable: "识读负担较低",
  uncommon: "少见而不猎奇",
  familyMeaning: "家族纪念意义",
  exactPhrasePreference: "原文成词",
  recompositionPreference: "透明的文化重组",
};

const clampWeight = (value: number): number => Math.min(3, Math.max(-3, value));

export function sigmoid(value: number): number {
  if (value >= 36) return 1;
  if (value <= -36) return 0;
  return 1 / (1 + Math.exp(-value));
}

function centeredFeature(candidate: PersonalizedCandidate, key: NameFeatureKey): number {
  return candidate.features[key] - 0.5;
}

export function personalUtility(
  preference: PreferenceState,
  candidate: PersonalizedCandidate,
): number {
  const featureUtility = NAME_FEATURE_KEYS.reduce(
    (sum, key) => sum + preference.weights[key] * centeredFeature(candidate, key),
    0,
  );
  const explicit =
    preference.explicitFeedback[candidate.fullName] ??
    preference.explicitFeedback[candidate.givenName] ??
    0;
  return featureUtility + explicit * explicitFeedbackWeight;
}

export function personalFit(
  preference: PreferenceState,
  candidate: PersonalizedCandidate,
): number {
  return sigmoid(personalUtility(preference, candidate));
}

function shrinkTowardPrior(key: NameFeatureKey, value: number): number {
  const prior = DEFAULT_PREFERENCE_WEIGHTS[key];
  return prior + (value - prior) * (1 - shrinkage);
}

function updatedWeights(
  preference: PreferenceState,
  winner: PersonalizedCandidate,
  loser: PersonalizedCandidate,
): PreferenceWeights {
  const differenceUtility = NAME_FEATURE_KEYS.reduce(
    (sum, key) =>
      sum +
      preference.weights[key] *
        (winner.features[key] - loser.features[key]),
    0,
  );
  const gradientScale = learningRate * (1 - sigmoid(differenceUtility));
  return Object.fromEntries(
    NAME_FEATURE_KEYS.map((key) => {
      const gradient = gradientScale * (winner.features[key] - loser.features[key]);
      const next = shrinkTowardPrior(key, preference.weights[key] + gradient);
      return [key, clampWeight(next)];
    }),
  ) as PreferenceWeights;
}

function bothDislikedFeedback(
  preference: PreferenceState,
  left: PersonalizedCandidate,
  right: PersonalizedCandidate,
): Record<string, number> {
  return {
    ...preference.explicitFeedback,
    [left.fullName]: -0.75,
    [right.fullName]: -0.75,
  };
}

export function recordPairwiseChoice(
  preference: PreferenceState,
  left: PersonalizedCandidate,
  right: PersonalizedCandidate,
  choice: PairwiseChoice,
): PreferenceState {
  if (choice === "skip") return preference;

  const weights =
    choice === "left"
      ? updatedWeights(preference, left, right)
      : choice === "right"
        ? updatedWeights(preference, right, left)
        : preference.weights;
  const explicitFeedback =
    choice === "both-dislike"
      ? bothDislikedFeedback(preference, left, right)
      : preference.explicitFeedback;

  return {
    ...preference,
    weights,
    explicitFeedback,
    feedback: [
      ...preference.feedback,
      { leftName: left.fullName, rightName: right.fullName, choice },
    ],
    calibrationProgress: Math.min(8, preference.calibrationProgress + 1),
  };
}

export function recommendationReasons(
  preference: PreferenceState,
  candidate: PersonalizedCandidate,
  maximum = 3,
): string[] {
  return NAME_FEATURE_KEYS.map((key) => ({
    key,
    contribution: preference.weights[key] * centeredFeature(candidate, key),
  }))
    .filter(({ contribution }) => contribution > 0.04)
    .sort(
      (left, right) =>
        right.contribution - left.contribution ||
        NAME_FEATURE_KEYS.indexOf(left.key) - NAME_FEATURE_KEYS.indexOf(right.key),
    )
    .slice(0, Math.max(0, maximum))
    .map(({ key }) => `${featureLabels[key]}符合你们当前表现出的偏好`);
}
