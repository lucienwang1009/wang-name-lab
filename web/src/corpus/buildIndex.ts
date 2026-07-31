import { normalizeSearchText } from "./normalizeText.ts";
import { bucketForCharacter } from "./indexBuckets.ts";
import type { CorpusPassage } from "./types.ts";

export { bucketForCharacter } from "./indexBuckets.ts";

export interface CharacterPosting {
  passageId: string;
  bookId: string;
  workId: string;
  chapterId: string;
  positions: number[];
}

export interface CharacterIndexBucket {
  schemaVersion: 1;
  bucket: string;
  characters: Record<string, CharacterPosting[]>;
}

export interface CorpusTextShard {
  schemaVersion: 1;
  bookId: string;
  sourceUrl: string;
  verificationUrl: string;
  passages: CorpusShardPassage[];
}

export type CorpusShardPassage = Omit<
  CorpusPassage,
  "bookId" | "sourceUrl" | "verificationUrl"
>;

export interface CorpusIndexBuild {
  textShards: Record<string, CorpusTextShard>;
  buckets: Record<string, CharacterIndexBucket>;
  aliases: Record<string, string>;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
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
  const passagesByBook = new Map<string, CorpusShardPassage[]>();
  const sourceByBook = new Map<
    string,
    { sourceUrl: string; verificationUrl: string }
  >();
  const postingsByBucket = new Map<
    string,
    Map<string, CharacterPosting[]>
  >();
  const aliasEntries = new Map<string, string>();

  for (const passage of sortedPassages) {
    const bookPassages = passagesByBook.get(passage.bookId) ?? [];
    const { bookId, sourceUrl, verificationUrl, ...shardPassage } = passage;
    const existingSource = sourceByBook.get(bookId);
    if (
      existingSource &&
      (existingSource.sourceUrl !== sourceUrl ||
        existingSource.verificationUrl !== verificationUrl)
    ) {
      throw new Error(`${bookId} 的正文分片包含不一致的来源。`);
    }
    sourceByBook.set(bookId, { sourceUrl, verificationUrl });
    bookPassages.push(shardPassage);
    passagesByBook.set(passage.bookId, bookPassages);

    const positionsByCharacter = new Map<string, number[]>();
    [...passage.normalizedText].forEach((character, position) => {
      const positions = positionsByCharacter.get(character) ?? [];
      positions.push(position);
      positionsByCharacter.set(character, positions);
    });

    for (const [character, positions] of positionsByCharacter) {
      const bucketName = bucketForCharacter(character);
      const characters = postingsByBucket.get(bucketName) ?? new Map();
      const postings = characters.get(character) ?? [];
      postings.push({
        passageId: passage.id,
        bookId: passage.bookId,
        workId: passage.workId,
        chapterId: passage.chapterId,
        positions,
      });
      characters.set(character, postings);
      postingsByBucket.set(bucketName, characters);
    }

    for (const character of passage.text) {
      const normalized = normalizeSearchText(character);
      if ([...normalized].length === 1 && normalized !== character) {
        aliasEntries.set(character, normalized);
      }
    }
  }

  const textShards: Record<string, CorpusTextShard> = {};
  for (const bookId of [...passagesByBook.keys()].sort(compareText)) {
    const source = sourceByBook.get(bookId);
    if (!source) throw new Error(`${bookId} 缺少正文分片来源。`);
    textShards[bookId] = {
      schemaVersion: 1,
      bookId,
      ...source,
      passages: passagesByBook.get(bookId) ?? [],
    };
  }

  const buckets: Record<string, CharacterIndexBucket> = {};
  for (const bucketName of [...postingsByBucket.keys()].sort(compareText)) {
    const characters: Record<string, CharacterPosting[]> = {};
    const sourceCharacters = postingsByBucket.get(bucketName) ?? new Map();
    for (const character of [...sourceCharacters.keys()].sort(compareText)) {
      characters[character] = sourceCharacters.get(character) ?? [];
    }
    buckets[bucketName] = { schemaVersion: 1, bucket: bucketName, characters };
  }

  const aliases: Record<string, string> = {};
  for (const character of [...aliasEntries.keys()].sort(compareText)) {
    aliases[character] = aliasEntries.get(character) ?? character;
  }

  return { textShards, buckets, aliases };
}
