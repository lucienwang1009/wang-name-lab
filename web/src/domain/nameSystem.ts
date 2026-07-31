import type {
  AllusionCandidate,
  BirthScenario,
  CharacterEntry,
  ClassicalFragment,
  CuratedCandidate,
  RawNameCandidate,
  RerankOptions,
  RerankResult,
} from "./types";

export const culturalWeights = {
  feminine: 5,
  source: 4,
  family: 3,
  rarity: 3,
  phonology: 3,
  usability: 2,
} as const;

const round = (value: number, digits = 1): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

function familyProxy(first: CharacterEntry, second: CharacterEntry): number {
  let score = 0;
  for (const item of [first, second]) {
    if (item.familyTag === "玉") score += 2.5;
    if (item.familyTag === "影") score += 2;
    if (item.familyTag === "绍") score += 1.5;
    if (item.char === "玉" || item.char === "影") score += 1;
    if (item.char === "韶") score += 1.5;
  }
  return Math.min(5, round(score));
}

export function generateRawPool(
  characters: readonly CharacterEntry[],
  surname = "王",
): RawNameCandidate[] {
  const pool: RawNameCandidate[] = [];
  let sequence = 1;

  for (const first of characters) {
    for (const second of characters) {
      if (first.char === second.char) continue;

      pool.push({
        id: `RAW-${String(sequence).padStart(5, "0")}`,
        name: `${surname}${first.char}${second.char}`,
        first: first.char,
        second: second.char,
        firstCategory: first.category,
        secondCategory: second.category,
        feminineProxy: round((first.feminine + second.feminine) / 2),
        familyProxy: familyProxy(first, second),
        rarityProxy: round((first.rarity + second.rarity) / 2),
        usabilityProxy: round((first.usability + second.usability) / 2),
        status: "待核典",
        evidence: "原始生成层：必须进入古籍核验与人工精审后才可推荐。",
      });
      sequence += 1;
    }
  }

  return pool;
}

export function diversifyRawCandidates(
  candidates: readonly RawNameCandidate[],
): RawNameCandidate[] {
  const buckets = new Map<string, RawNameCandidate[]>();

  for (const candidate of candidates) {
    const key = `${candidate.firstCategory}::${candidate.secondCategory}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(candidate);
    } else {
      buckets.set(key, [candidate]);
    }
  }

  const categories = [
    ...new Set(
      candidates.flatMap((candidate) => [
        candidate.firstCategory,
        candidate.secondCategory,
      ]),
    ),
  ];
  const grouped: RawNameCandidate[][] = [];

  for (let offset = 0; offset < categories.length; offset += 1) {
    for (let firstIndex = 0; firstIndex < categories.length; firstIndex += 1) {
      const firstCategory = categories[firstIndex];
      const secondCategory =
        categories[(firstIndex + offset) % categories.length];
      if (!firstCategory || !secondCategory) continue;
      const bucket = buckets.get(`${firstCategory}::${secondCategory}`);
      if (bucket) grouped.push(bucket);
    }
  }
  const largestBucket = grouped.reduce(
    (maximum, bucket) => Math.max(maximum, bucket.length),
    0,
  );
  const diversified: RawNameCandidate[] = [];

  for (let index = 0; index < largestBucket; index += 1) {
    for (const bucket of grouped) {
      const candidate = bucket[index];
      if (candidate) diversified.push(candidate);
    }
  }

  return diversified;
}

export function generateAllusionCandidates(
  fragments: readonly ClassicalFragment[],
  characterSet: ReadonlySet<string>,
  surname = "王",
): AllusionCandidate[] {
  const candidates: AllusionCandidate[] = [];

  for (const fragment of fragments) {
    const usable = [...fragment.quote].filter((char) => characterSet.has(char));
    const localSeen = new Set<string>();

    for (let firstIndex = 0; firstIndex < usable.length; firstIndex += 1) {
      const maxSecondIndex = Math.min(usable.length, firstIndex + 13);
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < maxSecondIndex;
        secondIndex += 1
      ) {
        const first = usable[firstIndex];
        const second = usable[secondIndex];
        if (!first || !second || first === second) continue;

        const name = `${surname}${first}${second}`;
        const key = `${fragment.id}:${name}`;
        if (localSeen.has(key)) continue;
        localSeen.add(key);

        const contiguous = fragment.quote.includes(`${first}${second}`);
        candidates.push({
          id: `${fragment.id}-${String(candidates.length + 1).padStart(4, "0")}`,
          fragmentId: fragment.id,
          name,
          first,
          second,
          corpus: fragment.corpus,
          source: fragment.source,
          quote: fragment.quote,
          extraction: contiguous
            ? `原文连续：${first}${second}`
            : `同一原句隔字/首尾：${first}…${second}`,
          grade: contiguous ? "A" : "B",
          scene: fragment.scene,
          contextTone: fragment.contextTone,
          url: fragment.url,
          reviewStatus: "机器生成，待人工精审",
        });
      }
    }
  }

  return candidates;
}

export function culturalScore(candidate: CuratedCandidate): number {
  if (candidate.gate !== "通过") return 0;
  const { scores } = candidate;
  return round(
    scores.feminine * culturalWeights.feminine +
      scores.source * culturalWeights.source +
      scores.family * culturalWeights.family +
      scores.rarity * culturalWeights.rarity +
      scores.phonology * culturalWeights.phonology +
      scores.usability * culturalWeights.usability,
  );
}

export function rankCuratedCandidates(
  candidates: readonly CuratedCandidate[],
): Array<CuratedCandidate & { culturalScore: number; rank: number | null }> {
  const scores = candidates.map((candidate) => culturalScore(candidate));
  const passingScores = scores
    .filter((score) => score > 0)
    .sort((left, right) => right - left);

  const ranked: Array<
    CuratedCandidate & { culturalScore: number; rank: number | null }
  > = candidates.map((candidate, index) => {
      const score = scores[index] ?? 0;
      return {
        ...candidate,
        culturalScore: score,
        rank: score === 0 ? null : passingScores.findIndex((item) => item === score) + 1,
      };
    });

  return ranked.sort((left, right) => {
    if (left.rank === null && right.rank === null) {
      return left.name.localeCompare(right.name);
    }
    if (left.rank === null) return 1;
    if (right.rank === null) return -1;
    return left.rank - right.rank || left.name.localeCompare(right.name);
  });
}

export function rerankCandidate(
  candidate: CuratedCandidate,
  options: RerankOptions,
): RerankResult {
  const baseScore = culturalScore(candidate);
  if (baseScore === 0) {
    return {
      culturalScore: 0,
      effectiveMetaphysicsWeight: 0,
      finalScore: 0,
      status: "硬筛淘汰",
    };
  }

  if (options.birthStatus === "未出生") {
    return {
      culturalScore: baseScore,
      effectiveMetaphysicsWeight: 0,
      finalScore: baseScore,
      status: "待出生后录入",
    };
  }

  const weight = clamp(options.metaphysicsWeight, 0, 0.25);
  if (options.metaphysicsScore === undefined) {
    return {
      culturalScore: baseScore,
      effectiveMetaphysicsWeight: weight,
      finalScore: baseScore,
      status: "待命理评分",
    };
  }

  const metaphysicsScore = clamp(options.metaphysicsScore, 0, 100);
  return {
    culturalScore: baseScore,
    effectiveMetaphysicsWeight: weight,
    finalScore: round(baseScore * (1 - weight) + metaphysicsScore * weight),
    status: "已复排",
  };
}

export function buildBirthScenarios(
  startDate: string,
  endDate: string,
): BirthScenario[] {
  const hourBranches = [
    ["子", "23:00–00:59"],
    ["丑", "01:00–02:59"],
    ["寅", "03:00–04:59"],
    ["卯", "05:00–06:59"],
    ["辰", "07:00–08:59"],
    ["巳", "09:00–10:59"],
    ["午", "11:00–12:59"],
    ["未", "13:00–14:59"],
    ["申", "15:00–16:59"],
    ["酉", "17:00–18:59"],
    ["戌", "19:00–20:59"],
    ["亥", "21:00–22:59"],
  ] as const;
  const scenarios: BirthScenario[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const last = new Date(`${endDate}T00:00:00Z`);
  let sequence = 1;

  while (cursor <= last) {
    const date = cursor.toISOString().slice(0, 10);
    for (const [hourBranch, timeRange] of hourBranches) {
      scenarios.push({
        id: `SCN-${String(sequence).padStart(3, "0")}`,
        date,
        hourBranch,
        timeRange,
        yearMonthNote:
          "按2026年主窗口：丙午年、立秋后申月；出生后须按实际节气时刻复核。",
        status: "仅情景占位，不计算喜用神",
      });
      sequence += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return scenarios;
}
