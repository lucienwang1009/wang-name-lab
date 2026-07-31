import type { BirthStatus } from "../domain/types";

export const PROFILE_STORAGE_KEY = "wang-name-lab.profile.v1";

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

export interface LocalProfile {
  version: 1;
  birthStatus: BirthStatus;
  metaphysicsWeight: number;
  favoriteNames: string[];
  rejectedNames: string[];
  compareNames: string[];
  notes: Record<string, string>;
  assessments: Record<string, MetaphysicsAssessment>;
  birth: BirthDetails;
}

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
    version: 1,
    birthStatus: "未出生",
    metaphysicsWeight: 0.15,
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
      version: 1,
      birthStatus: parsed.birthStatus === "已出生" ? "已出生" : "未出生",
      metaphysicsWeight: clamp(requestedWeight, 0, 0.25),
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
    };
  } catch {
    return createDefaultProfile();
  }
}

const browserStorage = (): Storage | undefined =>
  typeof window === "undefined" ? undefined : window.localStorage;

export function loadProfile(storage = browserStorage()): LocalProfile {
  if (!storage) return createDefaultProfile();
  return parseProfile(storage.getItem(PROFILE_STORAGE_KEY));
}

export function saveProfile(
  profile: LocalProfile,
  storage = browserStorage(),
): void {
  storage?.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

export function clearStoredProfile(storage = browserStorage()): void {
  storage?.removeItem(PROFILE_STORAGE_KEY);
}

export function exportProfile(profile: LocalProfile): string {
  return JSON.stringify(profile, null, 2);
}

