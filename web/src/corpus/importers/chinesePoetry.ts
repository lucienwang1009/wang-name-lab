import { normalizeSearchText, splitClassicalSentences } from "../normalizeText.ts";
import type { CorpusPassage } from "../types.ts";

type ChinesePoetryBookId =
  | "shi-jing"
  | "chu-ci"
  | "lun-yu"
  | "meng-zi"
  | "da-xue";

interface ImportOptions {
  bookId: ChinesePoetryBookId;
  raw: unknown;
  sourceUrl: string;
  verificationUrl: string;
}

interface WorkInput {
  title: string;
  chapterTitle: string;
  segments: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    return undefined;
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function readContentWork(value: unknown): WorkInput | undefined {
  if (!isRecord(value)) return undefined;
  const title = readString(value.title);
  const segments = readStringArray(value.content);
  if (!title || !segments) return undefined;

  const chapterTitle = [readString(value.chapter), readString(value.section)]
    .filter((item): item is string => Boolean(item))
    .join("·");

  return {
    title,
    chapterTitle: chapterTitle || title,
    segments,
  };
}

function readParagraphWork(value: unknown): WorkInput | undefined {
  if (!isRecord(value)) return undefined;
  const chapter = readString(value.chapter);
  const segments = readStringArray(value.paragraphs);
  if (!chapter || !segments) return undefined;
  return { title: chapter, chapterTitle: chapter, segments };
}

function parseWorks(raw: unknown): WorkInput[] {
  if (Array.isArray(raw)) {
    const contentWorks = raw.map(readContentWork);
    if (contentWorks.every((work): work is WorkInput => Boolean(work))) {
      return contentWorks;
    }

    const paragraphWorks = raw.map(readParagraphWork);
    if (paragraphWorks.every((work): work is WorkInput => Boolean(work))) {
      return paragraphWorks;
    }
  } else {
    const paragraphWork = readParagraphWork(raw);
    if (paragraphWork) return [paragraphWork];
  }

  throw new TypeError("无法识别 chinese-poetry 源文件结构。 ");
}

function paddedId(prefix: string, index: number): string {
  return `${prefix}-${String(index).padStart(4, "0")}`;
}

export function ingestChinesePoetry({
  bookId,
  raw,
  sourceUrl,
  verificationUrl,
}: ImportOptions): CorpusPassage[] {
  const works = parseWorks(raw);
  const chapterNumbers = new Map<string, number>();
  const passages: CorpusPassage[] = [];

  works.forEach((work, workOffset) => {
    const workId = `${bookId}/${paddedId("work", workOffset + 1)}`;
    let chapterNumber = chapterNumbers.get(work.chapterTitle);
    if (chapterNumber === undefined) {
      chapterNumber = chapterNumbers.size + 1;
      chapterNumbers.set(work.chapterTitle, chapterNumber);
    }
    const chapterId = `${bookId}/${paddedId("chapter", chapterNumber)}`;
    let passageNumber = 0;

    for (const segment of work.segments) {
      for (const text of splitClassicalSentences(segment)) {
        const normalizedText = normalizeSearchText(text);
        if (!normalizedText) continue;
        passageNumber += 1;
        passages.push({
          id: `${workId}/${paddedId("passage", passageNumber)}`,
          bookId,
          workId,
          chapterId,
          workTitle: work.title,
          chapterTitle: work.chapterTitle,
          order: passages.length + 1,
          text,
          normalizedText,
          sourceUrl,
          verificationUrl,
        });
      }
    }
  });

  return passages;
}
