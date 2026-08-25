import type { CharacterEntry } from "../domain/types.ts";
import { normalizeSearchText } from "./normalizeText.ts";
import type {
  CorpusBook,
  CorpusDiscoveryCandidate,
  CorpusPassage,
} from "./types.ts";

interface BuildDiscoveryOptions {
  books: readonly CorpusBook[];
  characters: readonly CharacterEntry[];
  passages: readonly CorpusPassage[];
  limit?: number;
}

interface SearchableUnit {
  character: string;
  rawIndex: number;
}

interface RankedCandidate {
  candidate: CorpusDiscoveryCandidate;
  score: number;
}

const defaultLimit = 1200;
const nearDistance = 4;
const defaultAGradeShare = 0.75;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function searchableUnits(text: string): SearchableUnit[] {
  return [...text].flatMap((rawCharacter, rawIndex) => {
    const normalized = [...normalizeSearchText(rawCharacter)];
    const character = normalized.length === 1 ? normalized[0] : undefined;
    return character ? [{ character, rawIndex }] : [];
  });
}

function evidencePenalty(passage: CorpusPassage): number {
  const annotationMarkers = (passage.text.match(/[()（）/]/gu) ?? []).length;
  return (
    [...passage.normalizedText].length +
    Math.min(annotationMarkers, 10) * 80
  );
}

function candidateScore(
  grade: "A" | "B",
  first: CharacterEntry,
  second: CharacterEntry,
  book: CorpusBook,
  passage: CorpusPassage,
): number {
  const feminine = (first.feminine + second.feminine) / 2;
  const rarity = (first.rarity + second.rarity) / 2;
  const usability = (first.usability + second.usability) / 2;
  const familyScore = Number(Boolean(first.familyTag)) + Number(Boolean(second.familyTag));
  return (
    (grade === "A" ? 10_000 : 0) +
    feminine * 120 +
    usability * 90 +
    rarity * 45 +
    familyScore * 80 +
    (4 - book.priority) * 60 -
    evidencePenalty(passage)
  );
}

export function buildDiscoveryPool({
  books,
  characters,
  passages,
  limit = defaultLimit,
}: BuildDiscoveryOptions): CorpusDiscoveryCandidate[] {
  const booksById = new Map(books.map((book) => [book.id, book]));
  const charactersByValue = new Map(
    characters.map((character) => [character.char, character]),
  );
  const bestByName = new Map<string, RankedCandidate>();
  const sortedPassages = [...passages].sort(
    (left, right) =>
      compareText(left.bookId, right.bookId) ||
      left.order - right.order ||
      compareText(left.id, right.id),
  );

  const offer = (
    passage: CorpusPassage,
    book: CorpusBook,
    firstUnit: SearchableUnit,
    secondUnit: SearchableUnit,
    grade: "A" | "B",
    extraction: string,
  ) => {
    const first = charactersByValue.get(firstUnit.character);
    const second = charactersByValue.get(secondUnit.character);
    if (!first || !second) return;
    const givenName = `${first.char}${second.char}`;
    const score = candidateScore(grade, first, second, book, passage);
    const candidate: CorpusDiscoveryCandidate = {
      id: `corpus-discovery:${givenName}`,
      givenName,
      grade,
      bookId: book.id,
      bookTitle: book.title,
      category: book.category,
      passageId: passage.id,
      workTitle: passage.workTitle,
      chapterTitle: passage.chapterTitle,
      quote: passage.text,
      extraction,
      sourceUrl: passage.sourceUrl,
      verificationUrl: passage.verificationUrl,
      feminine: (first.feminine + second.feminine) / 2,
      rarity: (first.rarity + second.rarity) / 2,
      usability: (first.usability + second.usability) / 2,
      familyScore:
        Number(Boolean(first.familyTag)) + Number(Boolean(second.familyTag)),
      firstCategory: first.category,
      secondCategory: second.category,
    };
    const existing = bestByName.get(givenName);
    if (
      !existing ||
      score > existing.score ||
      (score === existing.score && passage.id < existing.candidate.passageId)
    ) {
      bestByName.set(givenName, { candidate, score });
    }
  };

  for (const passage of sortedPassages) {
    const book = booksById.get(passage.bookId);
    if (!book?.source) continue;
    const units = searchableUnits(passage.text);
    for (let firstIndex = 0; firstIndex < units.length; firstIndex += 1) {
      const first = units[firstIndex];
      if (!first || !charactersByValue.has(first.character)) continue;
      const direct = units[firstIndex + 1];
      if (
        direct &&
        direct.rawIndex === first.rawIndex + 1 &&
        charactersByValue.has(direct.character)
      ) {
        if (book.source.segmentation === "punctuated") {
          offer(
            passage,
            book,
            first,
            direct,
            "A",
            `转录字符连续：${first.character}${direct.character}`,
          );
        } else {
          offer(
            passage,
            book,
            first,
            direct,
            "B",
            `无句读转录相邻：${first.character}…${direct.character}`,
          );
        }
      }

      if (book.source.segmentation !== "punctuated") continue;
      for (
        let secondIndex = firstIndex + 2;
        secondIndex <= Math.min(firstIndex + nearDistance, units.length - 1);
        secondIndex += 1
      ) {
        const second = units[secondIndex];
        if (!second || !charactersByValue.has(second.character)) continue;
        offer(
          passage,
          book,
          first,
          second,
          "B",
          `同句近距离取字：${first.character}…${second.character}`,
        );
      }
    }
  }

  const ranked = [...bestByName.values()].sort(
    (left, right) =>
      right.score - left.score ||
      compareText(left.candidate.givenName, right.candidate.givenName),
  );
  const boundedLimit = Math.max(0, limit);
  const aLimit = Math.ceil(boundedLimit * defaultAGradeShare);
  const bLimit = boundedLimit - aLimit;
  const selected = [
    ...ranked.filter(({ candidate }) => candidate.grade === "A").slice(0, aLimit),
    ...ranked.filter(({ candidate }) => candidate.grade === "B").slice(0, bLimit),
  ];
  if (selected.length < boundedLimit) {
    const selectedNames = new Set(
      selected.map(({ candidate }) => candidate.givenName),
    );
    selected.push(
      ...ranked
        .filter(({ candidate }) => !selectedNames.has(candidate.givenName))
        .slice(0, boundedLimit - selected.length),
    );
  }
  return selected.map(({ candidate }) => candidate);
}
