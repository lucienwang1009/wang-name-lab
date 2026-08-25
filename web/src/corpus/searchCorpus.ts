import { normalizeGivenName } from "../domain/nameSystem";
import type {
  CharacterIndexShard,
  CharacterPosting,
  CorpusTextShard,
} from "./buildIndex";
import type {
  CorpusBook,
  CorpusRecommendationFile,
} from "./types";
import type { PersonalizedCandidate } from "../domain/types";

export type CorpusEvidenceGrade = "A" | "B" | "C" | "D" | "E" | "F";

export interface CorpusEvidenceCitation {
  passageId: string;
  matchedChar: string;
  bookId: string;
  bookTitle: string;
  category: string;
  workTitle: string;
  chapterTitle: string;
  text: string;
  sourceUrl: string;
  verificationUrl: string;
}

export interface CorpusEvidenceMatch {
  id: string;
  grade: CorpusEvidenceGrade;
  givenName: string;
  extraction: string;
  citations: CorpusEvidenceCitation[];
}

export interface CorpusCoverage {
  targetBooks: number;
  readyBooks: number;
  buildVersion: string;
}

export interface CorpusSearchResult {
  status: "idle" | "hit" | "no-hit" | "error";
  givenName: string;
  normalizedGivenName: string;
  matches: CorpusEvidenceMatch[];
  coverage?: CorpusCoverage;
  message?: string;
}

interface CorpusCatalogue {
  schemaVersion: 2;
  buildVersion: string;
  characterIndex: Record<string, string[]>;
  textShards: string[];
  recommendationPath?: string;
  recommendationCount?: number;
  books: CorpusBook[];
}

interface CorpusAliasFile {
  schemaVersion: 1;
  aliases: Record<string, string>;
}

interface CorpusFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type CorpusFetcher = (input: string) => Promise<CorpusFetchResponse>;

interface SearcherOptions {
  baseUrl?: string;
  fetcher?: CorpusFetcher;
}

export interface CorpusSearchClient {
  discover(): Promise<PersonalizedCandidate[]>;
  search(query: string): Promise<CorpusSearchResult>;
}

interface SeedCitation {
  posting: CharacterPosting;
  matchedChar: string;
}

interface MatchSeed {
  id: string;
  grade: CorpusEvidenceGrade;
  extraction: string;
  citations: SeedCitation[];
}

const gradeOrder: Record<CorpusEvidenceGrade, number> = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  E: 4,
  F: 5,
};

const gradeLimits: Record<CorpusEvidenceGrade, number> = {
  A: 8,
  B: 8,
  C: 6,
  D: 6,
  E: 6,
  F: 8,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCatalogue(value: unknown): CorpusCatalogue {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 2 ||
    typeof value.buildVersion !== "string" ||
    !isRecord(value.characterIndex) ||
    !Array.isArray(value.textShards) ||
    !Array.isArray(value.books)
  ) {
    throw new TypeError("全文库目录格式无效。");
  }
  return value as unknown as CorpusCatalogue;
}

function parseAliases(value: unknown): CorpusAliasFile {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.aliases)) {
    throw new TypeError("全文库繁简别名表格式无效。");
  }
  return value as unknown as CorpusAliasFile;
}

function parseRecommendationFile(
  value: unknown,
  expectedBuildVersion: string,
): CorpusRecommendationFile {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 2 ||
    value.buildVersion !== expectedBuildVersion ||
    value.corpusVersion !== expectedBuildVersion ||
    typeof value.recommendableCount !== "number" ||
    typeof value.searchOnlyCount !== "number" ||
    !Array.isArray(value.candidates) ||
    value.candidates.length !== value.recommendableCount ||
    value.candidates.some(
      (candidate) =>
        !isRecord(candidate) ||
        candidate.eligibility !== "recommendable" ||
        !isRecord(candidate.evidence) ||
        candidate.evidence.reviewStatus !== "reviewed",
    )
  ) {
    throw new TypeError("个性化推荐池格式无效或与全文库版本不一致。");
  }
  return value as unknown as CorpusRecommendationFile;
}

function parseIndexShard(
  value: unknown,
  character: string,
  path: string,
): CharacterIndexShard {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 2 ||
    typeof value.bucket !== "string" ||
    typeof value.part !== "number" ||
    !isRecord(value.characters) ||
    !Array.isArray(value.characters[character])
  ) {
    throw new TypeError(`全文库字符索引 ${path} 格式无效。`);
  }
  return value as unknown as CharacterIndexShard;
}

function parseTextShard(value: unknown, path: string): CorpusTextShard {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 2 ||
    typeof value.shardId !== "string" ||
    typeof value.bookId !== "string" ||
    typeof value.sourceUrl !== "string" ||
    typeof value.verificationUrl !== "string" ||
    !Array.isArray(value.passages)
  ) {
    throw new TypeError(`全文库正文分片 ${path} 格式无效。`);
  }
  return value as unknown as CorpusTextShard;
}

function groupPostings(
  postings: readonly CharacterPosting[],
  key: "work" | "book",
): Map<number, CharacterPosting[]> {
  const groups = new Map<number, CharacterPosting[]>();
  const index = key === "work" ? 2 : 1;
  for (const posting of postings) {
    const value = posting[index];
    const group = groups.get(value) ?? [];
    group.push(posting);
    groups.set(value, group);
  }
  return groups;
}

function firstPair(
  left: readonly CharacterPosting[],
  right: readonly CharacterPosting[],
  predicate: (leftPosting: CharacterPosting, rightPosting: CharacterPosting) => boolean,
): [CharacterPosting, CharacterPosting] | undefined {
  for (const leftPosting of left) {
    for (const rightPosting of right) {
      if (predicate(leftPosting, rightPosting)) return [leftPosting, rightPosting];
    }
  }
  return undefined;
}

function positionsAreForwardAdjacent(
  first: readonly number[],
  second: readonly number[],
): boolean {
  const secondPositions = new Set(second);
  return first.some((position) => secondPositions.has(position + 1));
}

function hasDirectCharacterSequence(
  text: string,
  normalizedSequence: readonly string[],
  aliases: Readonly<Record<string, string>>,
): boolean {
  if (normalizedSequence.length !== 2) return false;
  const characters = [...text];
  for (let index = 0; index < characters.length - 1; index += 1) {
    const first = characters[index];
    const second = characters[index + 1];
    if (
      first &&
      second &&
      (aliases[first] ?? first) === normalizedSequence[0] &&
      (aliases[second] ?? second) === normalizedSequence[1]
    ) {
      return true;
    }
  }
  return false;
}

function buildMatchSeeds(
  displayChars: readonly string[],
  normalizedChars: readonly string[],
  postingsByCharacter: ReadonlyMap<string, readonly CharacterPosting[]>,
): MatchSeed[] {
  const firstDisplay = displayChars[0];
  const secondDisplay = displayChars[1];
  const firstNormalized = normalizedChars[0];
  const secondNormalized = normalizedChars[1];
  if (!firstDisplay || !firstNormalized) return [];

  const firstPostings = postingsByCharacter.get(firstNormalized) ?? [];
  const secondPostings = secondNormalized
    ? postingsByCharacter.get(secondNormalized) ?? []
    : [];
  const seeds: MatchSeed[] = [];
  const countByGrade = new Map<CorpusEvidenceGrade, number>();
  const seen = new Set<string>();

  const add = (
    grade: CorpusEvidenceGrade,
    extraction: string,
    citations: SeedCitation[],
  ): boolean => {
    if ((countByGrade.get(grade) ?? 0) >= gradeLimits[grade]) return false;
    const id = `${grade}:${citations
      .map((citation) => `${citation.posting[0]}:${citation.matchedChar}`)
      .join("|")}`;
    if (seen.has(id)) return false;
    seen.add(id);
    countByGrade.set(grade, (countByGrade.get(grade) ?? 0) + 1);
    seeds.push({ id, grade, extraction, citations });
    return true;
  };

  if (!secondDisplay || !secondNormalized) {
    for (const posting of firstPostings) {
      add("F", `全文单字用例：只证明单字“${firstDisplay}”有古典用例，不构成双字名字典故`, [
        { posting, matchedChar: firstDisplay },
      ]);
    }
    return seeds;
  }

  const sameCharacter = firstNormalized === secondNormalized;
  if (sameCharacter) {
    for (const posting of firstPostings) {
      if (posting[4].length < 2) continue;
      const isAdjacent = positionsAreForwardAdjacent(
        posting[4],
        posting[4].filter((_, index) => index > 0),
      );
      add(
        isAdjacent ? "A" : "B",
        isAdjacent
          ? `全文转录字符连续出现：${firstDisplay}${secondDisplay}`
          : `全文同句分见：${firstDisplay}…${secondDisplay}`,
        [{ posting, matchedChar: `${firstDisplay}${secondDisplay}` }],
      );
    }
  } else {
    const secondByPassage = new Map(
      secondPostings.map((posting) => [posting[0], posting]),
    );
    for (const firstPosting of firstPostings) {
      const secondPosting = secondByPassage.get(firstPosting[0]);
      if (!secondPosting) continue;
      const forward = positionsAreForwardAdjacent(
        firstPosting[4],
        secondPosting[4],
      );
      const reverse = positionsAreForwardAdjacent(
        secondPosting[4],
        firstPosting[4],
      );
      add(
        forward ? "A" : "B",
        forward
          ? `全文转录字符连续出现：${firstDisplay}${secondDisplay}`
          : reverse
            ? `全文同句反序连续：${secondDisplay}${firstDisplay} → ${firstDisplay}${secondDisplay}`
            : `全文同句分见：${firstDisplay}…${secondDisplay}`,
        [{ posting: firstPosting, matchedChar: `${firstDisplay}${secondDisplay}` }],
      );
    }
  }

  const firstByWork = groupPostings(firstPostings, "work");
  const secondByWork = groupPostings(secondPostings, "work");
  for (const workId of [...firstByWork.keys()].sort()) {
    const left = firstByWork.get(workId) ?? [];
    const right = secondByWork.get(workId);
    if (!right) continue;
    const pair = firstPair(
      left,
      right,
      (firstPosting, secondPosting) =>
        firstPosting[0] !== secondPosting[0],
    );
    if (!pair) continue;
    add(
      "C",
      `全文同篇分见：分别取“${firstDisplay}”“${secondDisplay}”，需结合两处语境判断`,
      [
        { posting: pair[0], matchedChar: firstDisplay },
        { posting: pair[1], matchedChar: secondDisplay },
      ],
    );
  }

  const firstByBook = groupPostings(firstPostings, "book");
  const secondByBook = groupPostings(secondPostings, "book");
  for (const bookId of [...firstByBook.keys()].sort()) {
    const left = firstByBook.get(bookId) ?? [];
    const right = secondByBook.get(bookId);
    if (!right) continue;
    const pair = firstPair(
      left,
      right,
      (firstPosting, secondPosting) =>
        firstPosting[2] !== secondPosting[2],
    );
    if (!pair) continue;
    add(
      "D",
      `全文同书异篇：分别取“${firstDisplay}”“${secondDisplay}”，不是原文固有词组`,
      [
        { posting: pair[0], matchedChar: firstDisplay },
        { posting: pair[1], matchedChar: secondDisplay },
      ],
    );
  }

  for (const firstBookId of [...firstByBook.keys()].sort()) {
    for (const secondBookId of [...secondByBook.keys()].sort()) {
      if (firstBookId === secondBookId) continue;
      const firstPosting = firstByBook.get(firstBookId)?.[0];
      const secondPosting = secondByBook.get(secondBookId)?.[0];
      if (!firstPosting || !secondPosting) continue;
      add(
        "E",
        `全文跨典合取：分别取“${firstDisplay}”“${secondDisplay}”，只表示命名组合，不是共同出处`,
        [
          { posting: firstPosting, matchedChar: firstDisplay },
          { posting: secondPosting, matchedChar: secondDisplay },
        ],
      );
    }
  }

  const firstPassageIds = new Set(firstPostings.map((posting) => posting[0]));
  const secondPassageIds = new Set(secondPostings.map((posting) => posting[0]));
  const singleSources: Array<
    [string, readonly CharacterPosting[], ReadonlySet<number>]
  > = [
    [firstDisplay, firstPostings, secondPassageIds],
    [secondDisplay, secondPostings, firstPassageIds],
  ];
  for (const [character, postings, otherPassageIds] of singleSources) {
    let addedForCharacter = 0;
    for (const posting of postings) {
      if (sameCharacter ? posting[4].length > 1 : otherPassageIds.has(posting[0])) {
        continue;
      }
      if (add(
        "F",
        `全文单字用例：只证明单字“${character}”有古典用例，不构成完整名字典故`,
        [{ posting, matchedChar: character }],
      )) {
        addedForCharacter += 1;
        if (addedForCharacter >= gradeLimits.F / 2) break;
      }
    }
  }

  return seeds.sort(
    (left, right) =>
      gradeOrder[left.grade] - gradeOrder[right.grade],
  );
}

export function createCorpusSearcher({
  baseUrl = `${import.meta.env.BASE_URL}corpus/`,
  fetcher = (input) => fetch(input),
}: SearcherOptions = {}): CorpusSearchClient {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const requestCache = new Map<string, Promise<unknown>>();

  const loadJson = (path: string, buildVersion?: string): Promise<unknown> => {
    const version = buildVersion
      ? `?v=${encodeURIComponent(buildVersion.slice(0, 12))}`
      : "";
    const url = `${normalizedBaseUrl}${path}${version}`;
    const cached = requestCache.get(url);
    if (cached) return cached;
    const request = (async () => {
      const response = await fetcher(url);
      if (!response.ok) {
        throw new Error(`全文库资源加载失败（HTTP ${response.status}）：${path}`);
      }
      return response.json();
    })().catch((error: unknown) => {
      requestCache.delete(url);
      throw error;
    });
    requestCache.set(url, request);
    return request;
  };

  const loadCatalogue = async () =>
    parseCatalogue(await loadJson("catalog.json"));

  return {
    async discover(): Promise<PersonalizedCandidate[]> {
      const catalogue = await loadCatalogue();
      const recommendations = parseRecommendationFile(
        await loadJson(
          catalogue.recommendationPath ?? "recommendations-v2.json",
          catalogue.buildVersion,
        ),
        catalogue.buildVersion,
      );
      return recommendations.candidates;
    },
    async search(query: string): Promise<CorpusSearchResult> {
      const givenName = normalizeGivenName(query);
      if (!givenName) {
        return {
          status: "idle",
          givenName: "",
          normalizedGivenName: "",
          matches: [],
        };
      }

      try {
        const catalogue = await loadCatalogue();
        const aliasFile = parseAliases(
          await loadJson("aliases.json", catalogue.buildVersion),
        );
        const displayChars = [...givenName];
        const normalizedChars = displayChars.map(
          (character) => aliasFile.aliases[character] ?? character,
        );
        const normalizedGivenName = normalizedChars.join("");
        const postingsByCharacter = new Map<string, readonly CharacterPosting[]>();
        await Promise.all(
          [...new Set(normalizedChars)].map(async (character) => {
            const paths = catalogue.characterIndex[character] ?? [];
            const shards = await Promise.all(
              paths.map(async (path) =>
                parseIndexShard(
                  await loadJson(`index/${path}`, catalogue.buildVersion),
                  character,
                  path,
                ),
              ),
            );
            postingsByCharacter.set(
              character,
              shards.flatMap((shard) => shard.characters[character] ?? []),
            );
          }),
        );

        const seeds = buildMatchSeeds(
          displayChars,
          normalizedChars,
          postingsByCharacter,
        );
        const coverage: CorpusCoverage = {
          targetBooks: catalogue.books.length,
          readyBooks: catalogue.books.filter((book) => book.status === "ready").length,
          buildVersion: catalogue.buildVersion,
        };
        if (seeds.length === 0) {
          return {
            status: "no-hit",
            givenName,
            normalizedGivenName,
            matches: [],
            coverage,
          };
        }

        const requiredTextShards = [
          ...new Set(
            seeds.flatMap((seed) =>
              seed.citations.map((citation) => citation.posting[3]),
            ),
          ),
        ].sort((left, right) => left - right);
        const shardValues = await Promise.all(
          requiredTextShards.map(async (shardOrdinal) => {
            const path = catalogue.textShards[shardOrdinal];
            if (!path) throw new Error(`全文库缺少正文分片编号：${shardOrdinal}`);
            return [
              shardOrdinal,
              parseTextShard(
                await loadJson(`texts/${path}`, catalogue.buildVersion),
                path,
              ),
            ] as const;
          }),
        );
        const books = new Map(catalogue.books.map((book) => [book.id, book]));
        const passages = new Map(
          shardValues.flatMap(([_shardOrdinal, shard]) =>
            shard.passages.map((passage) => [
              passage.ordinal,
              { bookId: shard.bookId, shard, passage },
            ] as const),
          ),
        );
        const matches: CorpusEvidenceMatch[] = seeds.map((seed) => {
          const citations = seed.citations.map(({ posting, matchedChar }) => {
            const loaded = passages.get(posting[0]);
            if (!loaded) {
              throw new Error(`正文分片缺少索引原句：${posting[0]}`);
            }
            const book = books.get(loaded.bookId);
            return {
              passageId: loaded.passage.id,
              matchedChar,
              bookId: loaded.bookId,
              bookTitle: book?.title ?? loaded.bookId,
              category: book?.category ?? "古籍",
              workTitle: loaded.passage.workTitle,
              chapterTitle: loaded.passage.chapterTitle,
              text: loaded.passage.text,
              sourceUrl: loaded.shard.sourceUrl,
              verificationUrl: loaded.shard.verificationUrl,
            };
          });
          let grade = seed.grade;
          let extraction = seed.extraction;
          if (grade === "A") {
            const citation = citations[0];
            const book = citation ? books.get(citation.bookId) : undefined;
            const direct = Boolean(
              citation &&
                book?.source?.segmentation === "punctuated" &&
                hasDirectCharacterSequence(
                  citation.text,
                  normalizedChars,
                  aliasFile.aliases,
                ),
            );
            if (!direct) {
              grade = "B";
              extraction = `全文检索段相邻出现：${displayChars.join("…")}；上游无可靠句读或字间有标点，不作为原文连续词组`;
            }
          }
          return {
            id: `${grade}:${seed.id.slice(2)}`,
            grade,
            givenName,
            extraction,
            citations,
          };
        }).sort(
          (left, right) =>
            gradeOrder[left.grade] - gradeOrder[right.grade],
        );

        return {
          status: "hit",
          givenName,
          normalizedGivenName,
          matches,
          coverage,
        };
      } catch (error) {
        return {
          status: "error",
          givenName,
          normalizedGivenName: givenName,
          matches: [],
          message: error instanceof Error ? error.message : "全文库加载失败。",
        };
      }
    },
  };
}

const configuredCorpusBaseUrl = import.meta.env.VITE_CORPUS_BASE_URL?.trim();

export const corpusSearcher = createCorpusSearcher(
  configuredCorpusBaseUrl
    ? { baseUrl: configuredCorpusBaseUrl }
    : undefined,
);
