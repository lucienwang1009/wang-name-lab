import type { BirthStatus } from "../domain/types";
import {
  NAME_FEATURE_KEYS,
  type NameFeatureKey,
} from "../domain/nameFeatures";

export const LEGACY_PROFILE_STORAGE_KEY = "wang-name-lab.profile.v1";
export const PROFILE_STORAGE_KEY = "wang-name-lab.profile.v2";

export interface BirthDetails {
  dueStart: string;
  dueEnd: string;
  date: string;
  time: string;
  city: string;
  longitude: string;
  solarTimePolicy: "出生后决定" | "北京时间" | "真太阳时" | "两套并列";
  fourPillars: string;
  useDirection: string;
  metaphysicsNote: string;
}

export interface MetaphysicsAssessment {
  score: number;
  rationale: string;
}

export type PairwiseChoice = "left" | "right" | "both-dislike" | "skip";

export interface PairwiseFeedback {
  leftName: string;
  rightName: string;
  choice: PairwiseChoice;
}

export type PreferenceWeights = Record<NameFeatureKey, number>;

export interface PreferenceState {
  weights: PreferenceWeights;
  feedback: PairwiseFeedback[];
  explicitFeedback: Record<string, number>;
  calibrationProgress: number;
  exposureCounts: Record<string, number>;
}

export interface LocalProfile {
  version: 2;
  birthStatus: BirthStatus;
  metaphysicsWeight: number;
  favoriteNames: string[];
  rejectedNames: string[];
  compareNames: string[];
  notes: Record<string, string>;
  assessments: Record<string, MetaphysicsAssessment>;
  birth: BirthDetails;
  preference: PreferenceState;
}

export const DEFAULT_PREFERENCE_WEIGHTS: PreferenceWeights = {
  classical: 1.2,
  graceful: 0.8,
  gentle: 0.45,
  bright: 0.2,
  austere: 0.15,
  modern: -0.55,
  pronounceable: 0.75,
  writable: 0.35,
  recognizable: 0.55,
  uncommon: 1.1,
  familyMeaning: 0.4,
  exactPhrasePreference: 0.6,
  recompositionPreference: 0.2,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const stringValue = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const stringList = (value: unknown, maximum = Number.POSITIVE_INFINITY): string[] =>
  Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === "string"))].slice(
        0,
        maximum,
      )
    : [];

const stringRecord = (value: unknown): Record<string, string> => {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
};

const numberRecord = (
  value: unknown,
  minimum: number,
  maximum: number,
): Record<string, number> => {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, number] =>
        typeof entry[1] === "number" && Number.isFinite(entry[1]),
      )
      .map(([key, item]) => [key, clamp(item, minimum, maximum)]),
  );
};

function preferenceWeights(value: unknown): PreferenceWeights | undefined {
  if (!isRecord(value)) return undefined;
  const entries = NAME_FEATURE_KEYS.map((key) => {
    const item = value[key];
    return typeof item === "number" && Number.isFinite(item)
      ? ([key, clamp(item, -3, 3)] as const)
      : undefined;
  });
  if (entries.some((entry) => entry === undefined)) return undefined;
  return Object.fromEntries(entries as Array<readonly [NameFeatureKey, number]>) as
    PreferenceWeights;
}

function pairwiseFeedback(value: unknown): PairwiseFeedback[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const allowed: PairwiseChoice[] = ["left", "right", "both-dislike", "skip"];
  const result: PairwiseFeedback[] = [];
  for (const item of value) {
    if (!isRecord(item)) return undefined;
    const choice = stringValue(item.choice);
    if (!allowed.includes(choice as PairwiseChoice)) return undefined;
    const leftName = stringValue(item.leftName);
    const rightName = stringValue(item.rightName);
    if (!leftName || !rightName) return undefined;
    result.push({ leftName, rightName, choice: choice as PairwiseChoice });
  }
  return result;
}

export function createDefaultPreference(): PreferenceState {
  return {
    weights: { ...DEFAULT_PREFERENCE_WEIGHTS },
    feedback: [],
    explicitFeedback: {},
    calibrationProgress: 0,
    exposureCounts: {},
  };
}

function parsePreference(value: unknown): PreferenceState {
  if (!isRecord(value)) return createDefaultPreference();
  const weights = preferenceWeights(value.weights);
  const feedback = pairwiseFeedback(value.feedback);
  if (!weights || !feedback) return createDefaultPreference();
  const progress =
    typeof value.calibrationProgress === "number" &&
    Number.isFinite(value.calibrationProgress)
      ? Math.round(clamp(value.calibrationProgress, 0, 8))
      : 0;
  return {
    weights,
    feedback,
    explicitFeedback: numberRecord(value.explicitFeedback, -1, 1),
    calibrationProgress: progress,
    exposureCounts: Object.fromEntries(
      Object.entries(numberRecord(value.exposureCounts, 0, 10_000)).map(
        ([name, count]) => [name, Math.round(count)],
      ),
    ),
  };
}

function assessmentRecord(
  value: unknown,
): Record<string, MetaphysicsAssessment> {
  if (!isRecord(value)) return {};
  const result: Record<string, MetaphysicsAssessment> = {};

  for (const [name, assessment] of Object.entries(value)) {
    if (!isRecord(assessment)) continue;
    const score =
      typeof assessment.score === "number" && Number.isFinite(assessment.score)
        ? clamp(assessment.score, 0, 100)
        : 0;
    result[name] = {
      score,
      rationale: stringValue(assessment.rationale),
    };
  }

  return result;
}

export function createDefaultProfile(): LocalProfile {
  return {
    version: 2,
    birthStatus: "未出生",
    metaphysicsWeight: 0.1,
    favoriteNames: [],
    rejectedNames: [],
    compareNames: [],
    notes: {},
    assessments: {},
    birth: {
      dueStart: "2026-08-20",
      dueEnd: "2026-08-30",
      date: "",
      time: "",
      city: "",
      longitude: "",
      solarTimePolicy: "出生后决定",
      fourPillars: "",
      useDirection: "",
      metaphysicsNote: "",
    },
    preference: createDefaultPreference(),
  };
}

export function parseProfile(raw: string | null): LocalProfile {
  if (!raw) return createDefaultProfile();

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return createDefaultProfile();
    const defaults = createDefaultProfile();
    const birth = isRecord(parsed.birth) ? parsed.birth : {};
    const requestedWeight =
      typeof parsed.metaphysicsWeight === "number"
        ? parsed.metaphysicsWeight
        : defaults.metaphysicsWeight;
    const solarTimePolicy = stringValue(
      birth.solarTimePolicy,
      defaults.birth.solarTimePolicy,
    );
    const allowedPolicies: BirthDetails["solarTimePolicy"][] = [
      "出生后决定",
      "北京时间",
      "真太阳时",
      "两套并列",
    ];

    return {
      version: 2,
      birthStatus: parsed.birthStatus === "已出生" ? "已出生" : "未出生",
      metaphysicsWeight: clamp(requestedWeight, 0, 0.1),
      favoriteNames: stringList(parsed.favoriteNames),
      rejectedNames: stringList(parsed.rejectedNames),
      compareNames: stringList(parsed.compareNames, 4),
      notes: stringRecord(parsed.notes),
      assessments: assessmentRecord(parsed.assessments),
      birth: {
        dueStart: stringValue(birth.dueStart, defaults.birth.dueStart),
        dueEnd: stringValue(birth.dueEnd, defaults.birth.dueEnd),
        date: stringValue(birth.date),
        time: stringValue(birth.time),
        city: stringValue(birth.city),
        longitude: stringValue(birth.longitude),
        solarTimePolicy: allowedPolicies.includes(
          solarTimePolicy as BirthDetails["solarTimePolicy"],
        )
          ? (solarTimePolicy as BirthDetails["solarTimePolicy"])
          : defaults.birth.solarTimePolicy,
        fourPillars: stringValue(birth.fourPillars),
        useDirection: stringValue(birth.useDirection),
        metaphysicsNote: stringValue(birth.metaphysicsNote),
      },
      preference: parsePreference(parsed.preference),
    };
  } catch {
    return createDefaultProfile();
  }
}

const browserStorage = (): Storage | undefined =>
  typeof window === "undefined" ? undefined : window.localStorage;

export function loadProfile(storage = browserStorage()): LocalProfile {
  if (!storage) return createDefaultProfile();
  const current = storage.getItem(PROFILE_STORAGE_KEY);
  if (current) return parseProfile(current);
  const legacy = storage.getItem(LEGACY_PROFILE_STORAGE_KEY);
  const migrated = parseProfile(legacy);
  if (legacy) storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(migrated));
  return migrated;
}

export function saveProfile(
  profile: LocalProfile,
  storage = browserStorage(),
): void {
  storage?.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

export function clearStoredProfile(storage = browserStorage()): void {
  storage?.removeItem(PROFILE_STORAGE_KEY);
  storage?.removeItem(LEGACY_PROFILE_STORAGE_KEY);
}

export function exportProfile(profile: LocalProfile): string {
  return JSON.stringify(profile, null, 2);
}
