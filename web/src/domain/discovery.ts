import type { CorpusDiscoveryCandidate } from "../corpus/types";
import type { CuratedCandidate } from "./types";

export type DiscoveryMode = "evidence" | "a-only" | "curated" | "favorites";
export type DiscoveryOrigin = "corpus" | "curated";

export interface DiscoveryCandidate {
  id: string;
  name: string;
  givenName: string;
  origin: DiscoveryOrigin;
  grade: CuratedCandidate["grade"];
  source: string;
  quote: string;
  extraction: string;
  sourceUrl: string;
  verificationUrl: string;
  feminine: number;
  rarity: number;
  usability: number;
  familyScore: number;
  pinyin?: string;
  tones?: string;
  familyNote?: string;
  risk?: string;
}

function fromCorpus(
  candidate: CorpusDiscoveryCandidate,
  surname: string,
): DiscoveryCandidate {
  return {
    id: candidate.id,
    name: `${surname}${candidate.givenName}`,
    givenName: candidate.givenName,
    origin: "corpus",
    grade: candidate.grade,
    source: `${candidate.bookTitle}·${candidate.workTitle}`,
    quote: candidate.quote,
    extraction: candidate.extraction,
    sourceUrl: candidate.sourceUrl,
    verificationUrl: candidate.verificationUrl,
    feminine: candidate.feminine,
    rarity: candidate.rarity,
    usability: candidate.usability,
    familyScore: candidate.familyScore,
  };
}

function fromCurated(candidate: CuratedCandidate): DiscoveryCandidate {
  return {
    id: `curated:${candidate.name}`,
    name: candidate.name,
    givenName: [...candidate.name].slice(1).join(""),
    origin: "curated",
    grade: candidate.grade,
    source: candidate.source,
    quote: candidate.quote,
    extraction: candidate.extraction,
    sourceUrl: candidate.url,
    verificationUrl: candidate.url,
    feminine: candidate.scores.feminine,
    rarity: candidate.scores.rarity,
    usability: candidate.scores.usability,
    familyScore: candidate.scores.family,
    pinyin: candidate.pinyin,
    tones: candidate.tones,
    familyNote: candidate.familyNote,
    risk: candidate.risk,
  };
}

export function mergeDiscoveryCandidates(
  corpusCandidates: readonly CorpusDiscoveryCandidate[],
  curatedCandidates: readonly CuratedCandidate[],
  surname = "王",
): DiscoveryCandidate[] {
  const byName = new Map(
    corpusCandidates.map((candidate) => {
      const converted = fromCorpus(candidate, surname);
      return [converted.name, converted] as const;
    }),
  );
  for (const candidate of curatedCandidates) {
    if (candidate.gate !== "通过") continue;
    const converted = fromCurated(candidate);
    byName.set(converted.name, converted);
  }
  return [...byName.values()];
}

export function filterDiscoveryCandidates(
  candidates: readonly DiscoveryCandidate[],
  mode: DiscoveryMode,
  favoriteNames: readonly string[],
): DiscoveryCandidate[] {
  const favoriteSet = new Set(favoriteNames);
  const feminineEvidence = (candidate: DiscoveryCandidate) =>
    candidate.feminine >= 4 &&
    candidate.usability >= 3.5 &&
    [...candidate.givenName][0] !== [...candidate.givenName][1];
  if (mode === "a-only") {
    return candidates.filter(
      (candidate) => candidate.grade === "A" && feminineEvidence(candidate),
    );
  }
  if (mode === "curated") {
    return candidates.filter((candidate) => candidate.origin === "curated");
  }
  if (mode === "favorites") {
    return candidates.filter((candidate) => favoriteSet.has(candidate.name));
  }
  return candidates.filter(
    (candidate) =>
      (candidate.grade === "A" || candidate.grade === "B") &&
      feminineEvidence(candidate),
  );
}

export function sampleDiscoveryCandidates<T extends { id: string }>(
  candidates: readonly T[],
  count: number,
  previousIds: readonly string[] = [],
  random: () => number = Math.random,
): T[] {
  const boundedCount = Math.max(0, Math.min(count, candidates.length));
  const previous = new Set(previousIds);
  const withoutPrevious = candidates.filter((candidate) => !previous.has(candidate.id));
  const source =
    withoutPrevious.length >= boundedCount ? withoutPrevious : [...candidates];
  const shuffled = [...source];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    const current = shuffled[index];
    const replacement = shuffled[target];
    if (current === undefined || replacement === undefined) continue;
    shuffled[index] = replacement;
    shuffled[target] = current;
  }
  return shuffled.slice(0, boundedCount);
}
