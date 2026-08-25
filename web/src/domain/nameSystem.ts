import type {
  AllusionCandidate,
  BirthScenario,
  CharacterEntry,
  ClassicalEvidenceCitation,
  ClassicalEvidenceMatch,
  ClassicalFragment,
  RawNameCandidate,
  RecommendationEligibility,
  TraditionalReferenceOptions,
  TraditionalReferenceResult,
} from "./types";

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

const isChineseCharacter = (char: string): boolean =>
  /[\u3400-\u9fff]/u.test(char);

const maxCompositeMatchesPerGrade = 12;

function sourceFamily(source: string): string {
  const opening = source.indexOf("《");
  const closing = source.indexOf("》", opening + 1);
  if (opening < 0 || closing < 0) return source;

  const prefix = source.slice(0, opening);
  const title = source.slice(opening + 1, closing);
  const rootTitle = title.split("·")[0];
  return `${prefix}《${rootTitle}》`;
}

function toCitation(
  fragment: ClassicalFragment,
  matchedChar: string,
): ClassicalEvidenceCitation {
  return {
    fragmentId: fragment.id,
    matchedChar,
    corpus: fragment.corpus,
    source: fragment.source,
    quote: fragment.quote,
    scene: fragment.scene,
    contextTone: fragment.contextTone,
    url: fragment.url,
  };
}

function uniqueBySource(
  fragments: readonly ClassicalFragment[],
): ClassicalFragment[] {
  const seen = new Set<string>();
  return fragments.filter((fragment) => {
    if (seen.has(fragment.source)) return false;
    seen.add(fragment.source);
    return true;
  });
}

export function normalizeGivenName(query: string, surname = "王"): string {
  const characters = [...query].filter(isChineseCharacter);
  if (characters[0] === surname) characters.shift();
  return characters.slice(0, 2).join("");
}

export function searchClassicalEvidence(
  query: string,
  fragments: readonly ClassicalFragment[],
  surname = "王",
): ClassicalEvidenceMatch[] {
  const givenName = normalizeGivenName(query, surname);
  const chars = [...givenName];
  if (chars.length === 0) return [];

  const first = chars[0];
  const second = chars[1];
  const direct: ClassicalEvidenceMatch[] = [];
  const single: ClassicalEvidenceMatch[] = [];

  for (const fragment of fragments) {
    const matchedChars = chars.filter(
      (char, index) => chars.indexOf(char) === index && fragment.quote.includes(char),
    );
    if (matchedChars.length === 0) continue;

    if (first && second && fragment.quote.includes(`${first}${second}`)) {
      direct.push({
        id: `A:${fragment.id}:${givenName}`,
        givenName,
        matchedChars: [first, second],
        grade: "A",
        corpus: fragment.corpus,
        source: fragment.source,
        quote: fragment.quote,
        extraction: `原文连续出现：${first}${second}`,
        scene: fragment.scene,
        contextTone: fragment.contextTone,
        url: fragment.url,
        citations: [toCitation(fragment, `${first}${second}`)],
      });
      continue;
    }

    if (first && second && matchedChars.length === 2) {
      const firstIndex = fragment.quote.indexOf(first);
      const secondIndex = fragment.quote.indexOf(second);
      const reverseContiguous = fragment.quote.includes(`${second}${first}`);
      direct.push({
        id: `B:${fragment.id}:${givenName}`,
        givenName,
        matchedChars: [first, second],
        grade: "B",
        corpus: fragment.corpus,
        source: fragment.source,
        quote: fragment.quote,
        extraction: reverseContiguous
          ? `同句反序连续：${second}${first} → ${first}${second}`
          : firstIndex < secondIndex
            ? `同句顺取：${first}…${second}`
            : `同句反序：${second}…${first}`,
        scene: fragment.scene,
        contextTone: fragment.contextTone,
        url: fragment.url,
        citations: [toCitation(fragment, `${first}${second}`)],
      });
      continue;
    }

    single.push({
      id: `S:${fragment.id}:${matchedChars.join("")}`,
      givenName,
      matchedChars,
      grade: "F",
      corpus: fragment.corpus,
      source: fragment.source,
      quote: fragment.quote,
      extraction: `仅含${matchedChars.map((char) => `“${char}”`).join("、")}，只算单字用例，不能作为完整名字出处`,
      scene: fragment.scene,
      contextTone: fragment.contextTone,
      url: fragment.url,
      citations: [toCitation(fragment, matchedChars.join("、"))],
    });
  }

  const sameSource: ClassicalEvidenceMatch[] = [];
  if (first && second) {
    const sourceGroups = new Map<string, ClassicalFragment[]>();
    for (const fragment of fragments) {
      const group = sourceGroups.get(fragment.source);
      if (group) group.push(fragment);
      else sourceGroups.set(fragment.source, [fragment]);
    }

    for (const sourceFragments of sourceGroups.values()) {
      if (
        sourceFragments.some(
          (fragment) =>
            fragment.quote.includes(first) && fragment.quote.includes(second),
        )
      ) {
        continue;
      }
      const firstFragment = sourceFragments.find((fragment) =>
        fragment.quote.includes(first),
      );
      const secondFragment = sourceFragments.find((fragment) =>
        fragment.quote.includes(second),
      );
      if (!firstFragment || !secondFragment || firstFragment.id === secondFragment.id) {
        continue;
      }
      sameSource.push({
        id: `C:${firstFragment.id}:${secondFragment.id}:${givenName}`,
        givenName,
        matchedChars: [first, second],
        grade: "C",
        corpus: firstFragment.corpus,
        source: firstFragment.source,
        quote: `${firstFragment.quote} ／ ${secondFragment.quote}`,
        extraction: `同篇分见：${first}…${second}，需人工复核篇内距离与语境`,
        scene: `${firstFragment.scene}；${secondFragment.scene}`,
        contextTone: `${firstFragment.contextTone}；${secondFragment.contextTone}`,
        url: firstFragment.url,
        citations: [
          toCitation(firstFragment, first),
          toCitation(secondFragment, second),
        ],
      });
    }
  }

  const sameBook: ClassicalEvidenceMatch[] = [];
  const crossClassic: ClassicalEvidenceMatch[] = [];
  if (first && second) {
    const firstOnly = uniqueBySource(
      fragments.filter(
        (fragment) =>
          fragment.quote.includes(first) && !fragment.quote.includes(second),
      ),
    );
    const secondOnly = uniqueBySource(
      fragments.filter(
        (fragment) =>
          fragment.quote.includes(second) && !fragment.quote.includes(first),
      ),
    );
    const seenBookPairs = new Set<string>();
    const seenCrossPairs = new Set<string>();

    for (const firstFragment of firstOnly) {
      for (const secondFragment of secondOnly) {
        if (firstFragment.id === secondFragment.id) continue;
        const firstFamily = sourceFamily(firstFragment.source);
        const secondFamily = sourceFamily(secondFragment.source);
        const pairKey = `${firstFragment.source}|${secondFragment.source}`;

        if (
          firstFamily === secondFamily &&
          firstFragment.source !== secondFragment.source &&
          !seenBookPairs.has(pairKey) &&
          sameBook.length < maxCompositeMatchesPerGrade
        ) {
          seenBookPairs.add(pairKey);
          sameBook.push({
            id: `D:${firstFragment.id}:${secondFragment.id}:${givenName}`,
            givenName,
            matchedChars: [first, second],
            grade: "D",
            corpus: firstFragment.corpus,
            source: firstFamily,
            quote: `${firstFragment.quote} ／ ${secondFragment.quote}`,
            extraction: `同书异篇：分别取“${first}”“${second}”，不是原文固有词组`,
            scene: `${firstFragment.scene}；${secondFragment.scene}`,
            contextTone: `${firstFragment.contextTone}；${secondFragment.contextTone}`,
            url: firstFragment.url,
            citations: [
              toCitation(firstFragment, first),
              toCitation(secondFragment, second),
            ],
          });
          continue;
        }

        if (
          firstFamily !== secondFamily &&
          !seenCrossPairs.has(pairKey) &&
          crossClassic.length < maxCompositeMatchesPerGrade
        ) {
          seenCrossPairs.add(pairKey);
          crossClassic.push({
            id: `E:${firstFragment.id}:${secondFragment.id}:${givenName}`,
            givenName,
            matchedChars: [first, second],
            grade: "E",
            corpus: `${firstFragment.corpus} × ${secondFragment.corpus}`,
            source: "跨典双源",
            quote: `${firstFragment.quote} ／ ${secondFragment.quote}`,
            extraction: `跨典合取：分别取“${first}”“${second}”，只表示命名组合，不是共同出处`,
            scene: `${firstFragment.scene}；${secondFragment.scene}`,
            contextTone: `${firstFragment.contextTone}；${secondFragment.contextTone}`,
            url: firstFragment.url,
            citations: [
              toCitation(firstFragment, first),
              toCitation(secondFragment, second),
            ],
          });
        }

        if (
          sameBook.length >= maxCompositeMatchesPerGrade &&
          crossClassic.length >= maxCompositeMatchesPerGrade
        ) {
          break;
        }
      }
    }
  }

  const gradeOrder = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5 } as const;
  return [...direct, ...sameSource, ...sameBook, ...crossClassic, ...single].sort(
    (left, right) =>
      gradeOrder[left.grade] - gradeOrder[right.grade] ||
      left.source.localeCompare(right.source),
  );
}

export function applyTraditionalReference(
  fit: number,
  eligibility: RecommendationEligibility,
  options: TraditionalReferenceOptions,
): TraditionalReferenceResult {
  if (eligibility === "blocked") {
    return {
      effectiveMetaphysicsWeight: 0,
      adjustedPersonalFit: null,
      status: "硬性淘汰",
    };
  }

  const personalFit = clamp(fit, 0, 1);
  if (options.birthStatus === "未出生") {
    return {
      effectiveMetaphysicsWeight: 0,
      adjustedPersonalFit: personalFit,
      status: "待出生后录入",
    };
  }

  const weight = clamp(options.metaphysicsWeight, 0, 0.1);
  if (options.metaphysicsScore === undefined) {
    return {
      effectiveMetaphysicsWeight: weight,
      adjustedPersonalFit: personalFit,
      status: "待传统参考说明",
    };
  }

  const traditionalFit = clamp(options.metaphysicsScore, 0, 100) / 100;
  return {
    effectiveMetaphysicsWeight: weight,
    adjustedPersonalFit: round(
      personalFit * (1 - weight) + traditionalFit * weight,
      3,
    ),
    status: "已记录传统参考",
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
