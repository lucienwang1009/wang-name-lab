import { normalizeSearchText } from "./normalizeText.ts";
import { bucketForCharacter } from "./indexBuckets.ts";
import type { CorpusPassage } from "./types.ts";

export { bucketForCharacter } from "./indexBuckets.ts";

/**
 * Compact posting tuple: [passage ordinal, book ordinal, work ordinal,
 * text-shard ordinal, normalized-character positions].  The full strings live
 * once in the catalogue/text shards instead of being repeated for every
 * character occurrence.
 */
export type CharacterPosting = readonly [
  passage: number,
  book: number,
  work: number,
  textShard: number,
  positions: number[],
];

export interface CharacterIndexShard {
  schemaVersion: 2;
  bucket: string;
  part: number;
  characters: Record<string, CharacterPosting[]>;
}

export interface CorpusTextShard {
  schemaVersion: 2;
  shardId: string;
  bookId: string;
  sourceUrl: string;
  verificationUrl: string;
  passages: CorpusShardPassage[];
}

export type CorpusShardPassage = Omit<
  CorpusPassage,
  "bookId" | "sourceUrl" | "verificationUrl"
> & { ordinal: number };

export interface CorpusIndexBuild {
  textShards: Record<string, CorpusTextShard>;
  textShardPaths: string[];
  textShardPathsByBook: Record<string, string[]>;
  indexShards: Record<string, CharacterIndexShard>;
  indexPathsByCharacter: Record<string, string[]>;
  aliases: Record<string, string>;
}

const targetShardBytes = 700 * 1024;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function jsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function paddedPart(value: number): string {
  return String(value).padStart(3, "0");
}

function passageEvidenceRank(passage: CorpusPassage): number {
  const searchableLength = [...passage.normalizedText].length;
  const hasSentencePunctuation = /[。！？；!?;]/u.test(passage.text);
  const annotationMarkers = (passage.text.match(/[()（）/]/gu) ?? []).length;
  return (
    searchableLength +
    (hasSentencePunctuation ? 0 : 200) +
    Math.min(annotationMarkers, 10) * 100
  );
}

function splitByJsonSize<T>(
  values: readonly T[],
  wrap: (part: number, items: T[]) => unknown,
): T[][] {
  const parts: T[][] = [];
  let current: T[] = [];
  let currentBytes = jsonBytes(wrap(0, []));
  for (const value of values) {
    const valueBytes = jsonBytes(value) + (current.length > 0 ? 1 : 0);
    if (current.length > 0 && currentBytes + valueBytes > targetShardBytes) {
      parts.push(current);
      current = [value];
      currentBytes = jsonBytes(wrap(parts.length, [])) + jsonBytes(value);
    } else {
      current.push(value);
      currentBytes += valueBytes;
    }
  }
  if (current.length > 0) parts.push(current);
  return parts;
}

export function buildCorpusIndex(
  passages: readonly CorpusPassage[],
): CorpusIndexBuild {
  const sortedPassages = [...passages].sort(
    (left, right) =>
      compareText(left.bookId, right.bookId) ||
      left.order - right.order ||
      compareText(left.id, right.id),
  );
  const aliases = new Map<string, string>();

  const passageOrdinalsByBook = new Map<string, number[]>();
  for (const [ordinal, passage] of sortedPassages.entries()) {
    const group = passageOrdinalsByBook.get(passage.bookId) ?? [];
    group.push(ordinal);
    passageOrdinalsByBook.set(passage.bookId, group);
    for (const character of passage.text) {
      const normalized = normalizeSearchText(character);
      if ([...normalized].length === 1 && normalized !== character) {
        aliases.set(character, normalized);
      }
    }
  }

  const textShards: Record<string, CorpusTextShard> = {};
  const textShardPaths: string[] = [];
  const textShardPathsByBook: Record<string, string[]> = {};
  const unassignedShard = 0xffffffff;
  const textShardByPassage = new Uint32Array(sortedPassages.length);
  textShardByPassage.fill(unassignedShard);

  for (const bookId of [...passageOrdinalsByBook.keys()].sort(compareText)) {
    const bookOrdinals = passageOrdinalsByBook.get(bookId) ?? [];
    const bookPassages = bookOrdinals.map((ordinal) => sortedPassages[ordinal]!);
    const first = bookPassages[0];
    if (!first) continue;
    if (
      bookPassages.some(
        (passage) =>
          passage.sourceUrl !== first.sourceUrl ||
          passage.verificationUrl !== first.verificationUrl,
      )
    ) {
      throw new Error(`${bookId} 的正文分片包含不一致的来源。`);
    }
    const shardPassages = bookPassages.map(
      ({ bookId: _bookId, sourceUrl: _sourceUrl, verificationUrl: _verificationUrl, ...passage }, index) => ({
        ...passage,
        ordinal: bookOrdinals[index]!,
      }),
    );
    const parts = splitByJsonSize(shardPassages, (part, items) => ({
      schemaVersion: 2,
      shardId: `${bookId}/${paddedPart(part)}`,
      bookId,
      sourceUrl: first.sourceUrl,
      verificationUrl: first.verificationUrl,
      passages: items,
    }));
    textShardPathsByBook[bookId] = [];
    parts.forEach((items, part) => {
      const shardId = `${bookId}/${paddedPart(part)}`;
      const path = `${shardId}.json`;
      const textShardOrdinal = textShardPaths.length;
      textShardPaths.push(path);
      textShards[path] = {
        schemaVersion: 2,
        shardId,
        bookId,
        sourceUrl: first.sourceUrl,
        verificationUrl: first.verificationUrl,
        passages: items,
      };
      textShardPathsByBook[bookId]?.push(path);
      for (const passage of items) {
        textShardByPassage[passage.ordinal] = textShardOrdinal;
      }
    });
    passageOrdinalsByBook.delete(bookId);
  }

  const bookOrdinalById = new Map<string, number>();
  for (const bookId of [...new Set(sortedPassages.map((passage) => passage.bookId))].sort(compareText)) {
    bookOrdinalById.set(bookId, bookOrdinalById.size);
  }
  const workOrdinalById = new Map<string, number>();
  const postingsByCharacter = new Map<string, CharacterPosting[]>();
  const passageRanks = new Uint16Array(sortedPassages.length);
  for (const [passageOrdinal, passage] of sortedPassages.entries()) {
    passageRanks[passageOrdinal] = Math.min(
      passageEvidenceRank(passage),
      0xffff,
    );
    const textShard = textShardByPassage[passageOrdinal];
    if (textShard === undefined || textShard === unassignedShard) {
      throw new Error(`原句未分配正文分片：${passage.id}`);
    }
    const bookOrdinal = bookOrdinalById.get(passage.bookId);
    if (bookOrdinal === undefined) throw new Error(`书目未编号：${passage.bookId}`);
    let workOrdinal = workOrdinalById.get(passage.workId);
    if (workOrdinal === undefined) {
      workOrdinal = workOrdinalById.size;
      workOrdinalById.set(passage.workId, workOrdinal);
    }
    const positionsByCharacter = new Map<string, number[]>();
    [...passage.normalizedText].forEach((character, position) => {
      const positions = positionsByCharacter.get(character) ?? [];
      positions.push(position);
      positionsByCharacter.set(character, positions);
    });
    for (const [character, positions] of positionsByCharacter) {
      const postings = postingsByCharacter.get(character) ?? [];
      postings.push([
        passageOrdinal,
        bookOrdinal,
        workOrdinal,
        textShard,
        positions,
      ]);
      postingsByCharacter.set(character, postings);
    }
  }

  const indexShards: Record<string, CharacterIndexShard> = {};
  const indexPathsByCharacter: Record<string, string[]> = {};
  const charactersByBucket = new Map<string, string[]>();
  for (const character of postingsByCharacter.keys()) {
    const bucket = bucketForCharacter(character);
    const characters = charactersByBucket.get(bucket) ?? [];
    characters.push(character);
    charactersByBucket.set(bucket, characters);
  }
  for (const bucket of [...charactersByBucket.keys()].sort(compareText)) {
    let part = 0;
    let current: Record<string, CharacterPosting[]> = {};
    let currentBytes = jsonBytes({
      schemaVersion: 2,
      bucket,
      part,
      characters: {},
    });
    const flush = () => {
      const characters = Object.keys(current);
      if (characters.length === 0) return;
      const path = `${bucket}-${paddedPart(part)}.json`;
      indexShards[path] = {
        schemaVersion: 2,
        bucket,
        part,
        characters: current,
      };
      for (const character of characters) {
        const paths = indexPathsByCharacter[character] ?? [];
        paths.push(path);
        indexPathsByCharacter[character] = paths;
      }
      part += 1;
      current = {};
      currentBytes = jsonBytes({
        schemaVersion: 2,
        bucket,
        part,
        characters: {},
      });
    };

    for (const character of (charactersByBucket.get(bucket) ?? []).sort(compareText)) {
      const postings = postingsByCharacter.get(character) ?? [];
      postings.sort(
        (left, right) =>
          (passageRanks[left[0]] ?? 0) - (passageRanks[right[0]] ?? 0) ||
          left[0] - right[0],
      );
      const chunks = splitByJsonSize(postings, (chunkPart, items) => ({
        schemaVersion: 2,
        bucket,
        part: chunkPart,
        characters: { [character]: items },
      }));
      for (const items of chunks) {
        const entryBytes = jsonBytes({ [character]: items }) - 2;
        const separatorBytes = Object.keys(current).length > 0 ? 1 : 0;
        if (
          Object.hasOwn(current, character) ||
          (Object.keys(current).length > 0 &&
            currentBytes + separatorBytes + entryBytes > targetShardBytes)
        ) {
          flush();
        }
        current[character] = items;
        currentBytes +=
          (Object.keys(current).length > 1 ? 1 : 0) + entryBytes;
      }
      postingsByCharacter.delete(character);
    }
    flush();
  }

  return {
    textShards,
    textShardPaths,
    textShardPathsByBook,
    indexShards,
    indexPathsByCharacter,
    aliases: Object.fromEntries([...aliases.entries()].sort(([left], [right]) => compareText(left, right))),
  };
}
