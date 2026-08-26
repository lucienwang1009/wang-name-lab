import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { normalizeSearchText } from "../src/corpus/normalizeText.ts";
import { characterDictionary } from "../src/data/nameSystemData.ts";
import type { FactoryBook, FactoryPassage } from "./types.ts";

interface CorpusCatalogueFile {
  schemaVersion: 2;
  buildVersion: string;
  textShards: string[];
  books: Array<{
    id: string;
    title: string;
    category: string;
    period: string;
    priority: number;
    status: string;
  }>;
}

interface CorpusTextShardFile {
  schemaVersion: 2;
  bookId: string;
  sourceUrl: string;
  verificationUrl: string;
  passages: Array<{
    id: string;
    workTitle: string;
    chapterTitle: string;
    text: string;
    normalizedText: string;
  }>;
}

export interface LoadedFactoryCorpus {
  corpusVersion: string;
  books: FactoryBook[];
  passages: FactoryPassage[];
}

export interface PassageBatch {
  id: string;
  passages: FactoryPassage[];
}

const hardNegative = /[死丧喪墓葬尸鬼刑杀殺戮辱贱賤凶灾災祸禍病疫殇殤]/gu;
const warfare = /[兵战戰伐攻败敗虏虜斩斬围圍]/gu;
const windowNegative = /[死丧喪墓葬尸鬼刑杀殺戮辱贱賤凶灾災祸禍病疫殇殤踯躅愁悲哀怨恨泣泪淚苦忧憂患]/u;
const functionCharacters = new Set([..."在之兮者也矣于於以而与與为為乃则則曰何所且将將公君我你"]);
const charactersByValue = new Map(characterDictionary.map((entry) => [entry.char, entry]));
const clausePattern = /[^，,。！？!?；;]+[，,。！？!?；;]?/gu;
const sentenceEndingPattern = /[。！？!?；;]$/u;

export interface NameableSourceWindow {
  text: string;
  normalizedText: string;
  startIndex: number;
  endIndex: number;
  score: number;
  pairOpportunityCount: number;
  namingCharacters: string[];
}

interface SourceClause {
  text: string;
  normalizedText: string;
  startIndex: number;
  endIndex: number;
  closesSentence: boolean;
}

interface PairOpportunity {
  score: number;
  characters: [string, string];
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} 格式无效。`);
  }
  return value as Record<string, unknown>;
}

function parseCatalogue(value: unknown): CorpusCatalogueFile {
  const item = record(value, "全文库目录");
  if (
    item.schemaVersion !== 2 ||
    typeof item.buildVersion !== "string" ||
    !Array.isArray(item.textShards) ||
    item.textShards.some((path) => typeof path !== "string") ||
    !Array.isArray(item.books)
  ) {
    throw new TypeError("全文库目录格式无效；请先运行 pnpm corpus:build。");
  }
  return item as unknown as CorpusCatalogueFile;
}

function parseTextShard(value: unknown, expectedPath: string): CorpusTextShardFile {
  const item = record(value, `全文分片 ${expectedPath}`);
  if (
    item.schemaVersion !== 2 ||
    typeof item.bookId !== "string" ||
    typeof item.sourceUrl !== "string" ||
    typeof item.verificationUrl !== "string" ||
    !Array.isArray(item.passages)
  ) {
    throw new TypeError(`全文分片 ${expectedPath} 格式无效。`);
  }
  return item as unknown as CorpusTextShardFile;
}

function occurrences(text: string, pattern: RegExp): number {
  pattern.lastIndex = 0;
  const count = text.match(pattern)?.length ?? 0;
  pattern.lastIndex = 0;
  return count;
}

function sourceClauses(text: string): SourceClause[] {
  let normalizedOffset = 0;
  return [...text.normalize("NFC").matchAll(clausePattern)].flatMap((match) => {
    const clauseText = match[0].trim();
    const normalizedText = normalizeSearchText(clauseText);
    if (!normalizedText) return [];
    const startIndex = normalizedOffset;
    normalizedOffset += [...normalizedText].length;
    return [{
      text: clauseText,
      normalizedText,
      startIndex,
      endIndex: normalizedOffset,
      closesSentence: sentenceEndingPattern.test(clauseText),
    }];
  });
}

function pairOpportunities(text: string): PairOpportunity[] {
  const characters = [...text];
  const opportunities: PairOpportunity[] = [];
  for (let firstIndex = 0; firstIndex < characters.length; firstIndex += 1) {
    const firstCharacter = characters[firstIndex];
    const first = firstCharacter ? charactersByValue.get(firstCharacter) : undefined;
    if (!first || functionCharacters.has(first.char)) continue;
    for (
      let secondIndex = firstIndex + 1;
      secondIndex <= Math.min(firstIndex + 4, characters.length - 1);
      secondIndex += 1
    ) {
      const secondCharacter = characters[secondIndex];
      const second = secondCharacter ? charactersByValue.get(secondCharacter) : undefined;
      if (!second || functionCharacters.has(second.char) || first.char === second.char) continue;
      const distance = secondIndex - firstIndex;
      const continuity = distance === 1 ? 160 : Math.max(30, 95 - distance * 18);
      opportunities.push({
        score:
          ((first.feminine + second.feminine) / 2) * 28 +
          ((first.usability + second.usability) / 2) * 24 +
          ((first.rarity + second.rarity) / 2) * 8 +
          continuity,
        characters: [first.char, second.char],
      });
    }
  }
  return opportunities.sort((left, right) => right.score - left.score ||
    left.characters.join("").localeCompare(right.characters.join("")));
}

function createSourceWindow(
  text: string,
  normalizedText: string,
  startIndex: number,
  endIndex: number,
  sourcePenalty = 0,
): NameableSourceWindow | undefined {
  const length = [...normalizedText].length;
  if (length < 4 || length > 40 || windowNegative.test(normalizedText)) return undefined;
  if (occurrences(text, warfare) > 1 || occurrences(text, /[|\d()（）\[\]{}]/gu) > 0) return undefined;
  const opportunities = pairOpportunities(normalizedText);
  const best = opportunities[0];
  if (!best) return undefined;
  const characters = [...normalizedText];
  const adjacentDuplicateCount = characters.slice(1).filter((character, index) =>
    character === characters[index]
  ).length;
  const namingCharacters = [...new Set(opportunities.flatMap(({ characters }) => characters))].sort();
  const score = best.score + (opportunities[1]?.score ?? 0) * 0.3 +
    Math.min(opportunities.length, 12) * 4 - length * 0.5 - adjacentDuplicateCount * 40 - sourcePenalty;
  return {
    text,
    normalizedText,
    startIndex,
    endIndex,
    score,
    pairOpportunityCount: opportunities.length,
    namingCharacters,
  };
}

export function extractNameableSourceWindows(
  passage: Pick<FactoryPassage, "text" | "normalizedText">,
): NameableSourceWindow[] {
  const clauses = sourceClauses(passage.text);
  const windows: NameableSourceWindow[] = [];
  clauses.forEach((clause, index) => {
    const clauseCharacters = [...clause.normalizedText];
    if (clauseCharacters.length <= 40) {
      const single = createSourceWindow(
        clause.text,
        clause.normalizedText,
        clause.startIndex,
        clause.endIndex,
      );
      if (single) windows.push(single);
    } else {
      for (let offset = 0; offset < clauseCharacters.length; offset += 16) {
        const endOffset = Math.min(offset + 24, clauseCharacters.length);
        if (endOffset - offset < 8) break;
        const normalizedText = clauseCharacters.slice(offset, endOffset).join("");
        const sliding = createSourceWindow(
          normalizedText,
          normalizedText,
          clause.startIndex + offset,
          clause.startIndex + endOffset,
          80,
        );
        if (sliding) windows.push(sliding);
        if (endOffset === clauseCharacters.length) break;
      }
    }
    const next = clauses[index + 1];
    if (!clause.closesSentence && next) {
      const combined = createSourceWindow(
        `${clause.text}${next.text}`,
        `${clause.normalizedText}${next.normalizedText}`,
        clause.startIndex,
        next.endIndex,
      );
      if (combined) windows.push(combined);
    }
  });
  const unique = new Map<string, NameableSourceWindow>();
  for (const window of windows) {
    const key = `${window.startIndex}:${window.endIndex}`;
    const existing = unique.get(key);
    if (!existing || window.score > existing.score) unique.set(key, window);
  }
  return [...unique.values()].sort((left, right) =>
    right.score - left.score || left.startIndex - right.startIndex || left.endIndex - right.endIndex
  );
}

export function passageNameabilityScore(
  passage: Pick<FactoryPassage, "text" | "normalizedText">,
  priority = 2,
): number {
  const windows = extractNameableSourceWindows(passage);
  if (windows.length === 0) return -100_000;
  return windows[0]!.score + (windows[1]?.score ?? 0) * 0.35 +
    (4 - Math.min(3, Math.max(1, priority))) * 30;
}

export function isFactorySourcePassage(
  passage: Pick<FactoryPassage, "text" | "normalizedText" | "score">,
): boolean {
  const length = [...passage.normalizedText].length;
  if (length < 8 || length > 480) return false;
  if (occurrences(passage.text, hardNegative) > 0) return false;
  if (occurrences(passage.text, warfare) > 2) return false;
  if (occurrences(passage.text, /[|\d]/gu) > Math.max(3, length * 0.04)) return false;
  // passageNameabilityScore returns a large negative sentinel when no
  // candidate-friendly window exists, so the score gate also enforces that invariant.
  return passage.score > -15;
}

export async function loadFactoryCorpus(corpusRoot: string): Promise<LoadedFactoryCorpus> {
  let catalogue: CorpusCatalogueFile;
  try {
    catalogue = parseCatalogue(JSON.parse(await readFile(join(corpusRoot, "catalog.json"), "utf8")) as unknown);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("找不到全文库构建产物；请先运行 pnpm corpus:build。", { cause: error });
    }
    throw error;
  }
  const readyBooks = catalogue.books.filter((book) => book.status === "ready");
  const books: FactoryBook[] = readyBooks.map(({ id, title, category, period, priority }) => ({
    id,
    title,
    category,
    period,
    priority,
  }));
  const booksById = new Map(books.map((book) => [book.id, book]));
  const shards = await Promise.all(
    catalogue.textShards.map(async (path) =>
      parseTextShard(
        JSON.parse(await readFile(join(corpusRoot, "texts", path), "utf8")) as unknown,
        path,
      ),
    ),
  );
  const passages = shards.flatMap((shard) => {
    const book = booksById.get(shard.bookId);
    if (!book) return [];
    return shard.passages.map((passage): FactoryPassage => {
      const base = {
        id: passage.id,
        bookId: book.id,
        bookTitle: book.title,
        category: book.category,
        period: book.period,
        workTitle: passage.workTitle,
        chapterTitle: passage.chapterTitle,
        text: passage.text,
        normalizedText: passage.normalizedText,
        sourceUrl: shard.sourceUrl,
        verificationUrl: shard.verificationUrl,
      };
      return { ...base, score: passageNameabilityScore(base, book.priority) };
    });
  });
  return {
    corpusVersion: catalogue.buildVersion,
    books,
    passages: passages.filter(isFactorySourcePassage),
  };
}

function comparePassage(left: FactoryPassage, right: FactoryPassage): number {
  return right.score - left.score || left.id.localeCompare(right.id);
}

function passageNamingCharacters(passage: FactoryPassage): Set<string> {
  return new Set(
    extractNameableSourceWindows(passage)
      .slice(0, 3)
      .flatMap((window) => window.namingCharacters),
  );
}

function jaccard(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

export function selectDiversePassages(
  passages: readonly FactoryPassage[],
  { passagesPerBook }: { passagesPerBook: number },
): FactoryPassage[] {
  const byBook = new Map<string, FactoryPassage[]>();
  for (const passage of passages) {
    const group = byBook.get(passage.bookId) ?? [];
    group.push(passage);
    byBook.set(passage.bookId, group);
  }
  for (const group of byBook.values()) group.sort(comparePassage);
  const target = Math.min(passages.length, passagesPerBook * byBook.size);
  if (target === 0) return [];

  // The legacy flag still controls the total source scale, but no longer grants
  // every book a quota. Globally strong passages compete first; small per-book
  // fallbacks only ensure the bounded pool can satisfy concentration caps.
  const globallyRanked = [...passages].sort(comparePassage);
  const poolLimit = Math.min(passages.length, Math.max(256, target * 6));
  const poolById = new Map(
    globallyRanked.slice(0, poolLimit).map((passage) => [passage.id, passage]),
  );
  const fallbackPerBook = Math.max(1, Math.ceil(target / byBook.size));
  for (const group of byBook.values()) {
    for (const passage of group.slice(0, fallbackPerBook)) poolById.set(passage.id, passage);
  }

  const bookLimit = Math.max(
    3,
    Math.ceil(target * 0.08),
    Math.ceil(target / byBook.size),
  );
  const uniqueWorkCount = new Set(passages.map((passage) => `${passage.bookId}\u0000${passage.workTitle}`)).size;
  const workLimit = Math.max(
    2,
    Math.ceil(target * 0.04),
    Math.ceil(target / uniqueWorkCount),
  );
  const selected: FactoryPassage[] = [];
  const charactersByPassage = new Map(
    [...poolById.values()].map((passage) => [passage.id, passageNamingCharacters(passage)]),
  );
  const remaining = [...poolById.values()].map((passage) => ({ passage, maximumSimilarity: 0 }));
  const bookCounts = new Map<string, number>();
  const workCounts = new Map<string, number>();

  while (selected.length < target) {
    let bestIndex = -1;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      if (!candidate) continue;
      const { passage, maximumSimilarity } = candidate;
      const bookCount = bookCounts.get(passage.bookId) ?? 0;
      const workKey = `${passage.bookId}\u0000${passage.workTitle}`;
      const workCount = workCounts.get(workKey) ?? 0;
      if (bookCount >= bookLimit || workCount >= workLimit) continue;
      const mmrScore = passage.score - maximumSimilarity * 120 - workCount * 80 - bookCount * 12;
      const currentBest = bestIndex >= 0 ? remaining[bestIndex]?.passage : undefined;
      if (
        mmrScore > bestScore ||
        (mmrScore === bestScore && currentBest && comparePassage(passage, currentBest) < 0)
      ) {
        bestIndex = index;
        bestScore = mmrScore;
      }
    }
    if (bestIndex < 0) break;
    const [chosenEntry] = remaining.splice(bestIndex, 1);
    const chosen = chosenEntry?.passage;
    if (!chosen) break;
    selected.push(chosen);
    bookCounts.set(chosen.bookId, (bookCounts.get(chosen.bookId) ?? 0) + 1);
    const workKey = `${chosen.bookId}\u0000${chosen.workTitle}`;
    workCounts.set(workKey, (workCounts.get(workKey) ?? 0) + 1);
    const chosenCharacters = charactersByPassage.get(chosen.id) ?? new Set<string>();
    for (const candidate of remaining) {
      const characters = charactersByPassage.get(candidate.passage.id) ?? new Set<string>();
      candidate.maximumSimilarity = Math.max(
        candidate.maximumSimilarity,
        jaccard(characters, chosenCharacters),
      );
    }
  }
  return selected;
}

export function createPassageBatches(
  passages: readonly FactoryPassage[],
  batchSize: number,
): PassageBatch[] {
  const batches: PassageBatch[] = [];
  for (let index = 0; index < passages.length; index += batchSize) {
    const items = passages.slice(index, index + batchSize);
    const digest = createHash("sha256")
      .update(items.map((passage) => passage.id).join("\n"))
      .digest("hex")
      .slice(0, 12);
    batches.push({ id: `source-${String(batches.length + 1).padStart(4, "0")}-${digest}`, passages: items });
  }
  return batches;
}
