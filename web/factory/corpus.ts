import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

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

const positiveImagery = /[令仪雅柔惠静嘉清明昭景玉影月星云雪露霜兰蕙芳华英若芷瑶琼琬安宁和乐悦欣恬婉舒懿徽]/gu;
const hardNegative = /[死丧喪墓葬尸鬼刑杀殺戮辱贱賤凶灾災祸禍病疫殇殤]/gu;
const warfare = /[兵战戰伐攻败敗虏虜斩斬围圍]/gu;

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

export function passageNameabilityScore(
  passage: Pick<FactoryPassage, "text" | "normalizedText">,
  priority = 2,
): number {
  const length = [...passage.normalizedText].length;
  const positive = occurrences(passage.text, positiveImagery);
  const negative = occurrences(passage.text, hardNegative);
  const military = occurrences(passage.text, warfare);
  const punctuation = occurrences(passage.text, /[，。！？；、]/gu);
  const noise = occurrences(passage.text, /[|\d()（）\[\]{}]/gu);
  return (
    positive * 18 +
    Math.min(punctuation, 8) * 3 +
    (4 - Math.min(3, Math.max(1, priority))) * 8 -
    negative * 60 -
    military * 12 -
    noise * 2 -
    Math.abs(Math.min(length, 240) - 70) / 8
  );
}

export function isFactorySourcePassage(
  passage: Pick<FactoryPassage, "text" | "normalizedText" | "score">,
): boolean {
  const length = [...passage.normalizedText].length;
  if (length < 8 || length > 480) return false;
  if (occurrences(passage.text, hardNegative) > 0) return false;
  if (occurrences(passage.text, warfare) > 2) return false;
  if (occurrences(passage.text, /[|\d]/gu) > Math.max(3, length * 0.04)) return false;
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
  const bookOrder = [...byBook.entries()].sort(
    ([leftId, left], [rightId, right]) =>
      (left[0]?.category ?? "").localeCompare(right[0]?.category ?? "") ||
      leftId.localeCompare(rightId),
  );
  const selected: FactoryPassage[] = [];
  for (let round = 0; round < passagesPerBook; round += 1) {
    for (const [, group] of bookOrder) {
      const passage = group[round];
      if (passage) selected.push(passage);
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

