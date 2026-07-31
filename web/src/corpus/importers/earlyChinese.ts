import { normalizeSearchText } from "../normalizeText.ts";
import type { CorpusPassage } from "../types.ts";
import { chunkClassicalText } from "./chunkText.ts";

interface ImportOptions {
  bookId: string;
  raw: string;
  sourceUrl: string;
  verificationUrl: string;
}

interface EarlyChineseRow {
  id: string;
  series: string;
  text: string;
}

function parseRows(raw: string): EarlyChineseRow[] {
  const rows = raw
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line, index) => {
      let value: unknown;
      try {
        value = JSON.parse(line);
      } catch (error) {
        throw new TypeError(`ECT-KRP 第 ${index + 1} 行不是合法 JSON。`, {
          cause: error,
        });
      }
      if (
        typeof value !== "object" ||
        value === null ||
        !("id" in value) ||
        !("series" in value) ||
        !("text" in value) ||
        typeof value.id !== "string" ||
        typeof value.series !== "string" ||
        typeof value.text !== "string"
      ) {
        throw new TypeError(`ECT-KRP 第 ${index + 1} 行结构无效。`);
      }
      return value as EarlyChineseRow;
    });
  if (rows.length === 0) throw new TypeError("ECT-KRP 源文件没有正文。 ");
  return rows;
}

export function ingestEarlyChinese({
  bookId,
  raw,
  sourceUrl,
  verificationUrl,
}: ImportOptions): CorpusPassage[] {
  const rows = parseRows(raw);
  const passages: CorpusPassage[] = [];
  rows.forEach((row, workOffset) => {
    const workNumber = String(workOffset + 1).padStart(4, "0");
    const workId = `${bookId}/work-${workNumber}`;
    const chapterId = `${bookId}/chapter-${workNumber}`;
    chunkClassicalText(row.text).forEach((text, passageOffset) => {
      passages.push({
        id: `${workId}/passage-${String(passageOffset + 1).padStart(4, "0")}`,
        bookId,
        workId,
        chapterId,
        workTitle: row.id,
        chapterTitle: row.id,
        order: passages.length + 1,
        text,
        normalizedText: normalizeSearchText(text),
        sourceUrl,
        verificationUrl,
      });
    });
  });
  return passages;
}
