import { normalizeSearchText } from "../normalizeText.ts";
import type { CorpusPassage } from "../types.ts";
import { chunkClassicalText } from "./chunkText.ts";

interface ImportOptions {
  bookId: string;
  textId: string;
  raw: string;
  sourceUrl: string;
  verificationUrl: string;
  sectionFilter?: string;
}

interface Section {
  title: string;
  chapterTitle: string;
  text: string;
}

function parseSections(raw: string, textId: string): Section[] {
  const sections: Section[] = [];
  let chapterTitle = textId;
  let title = textId;
  let lines: string[] = [];
  const flush = () => {
    const text = lines.join("").trim();
    if (normalizeSearchText(text)) sections.push({ title, chapterTitle, text });
    lines = [];
  };

  for (const sourceLine of raw.split(/\r?\n/u)) {
    const line = sourceLine.trim();
    if (!line || line.startsWith("#+")) continue;
    const heading = line.match(/^(\*{2,})\s+(?:\d+\s+)?(.+)$/u);
    if (heading) {
      flush();
      const depth = heading[1]?.length ?? 0;
      const headingTitle = heading[2]?.trim() || textId;
      if (depth === 2) chapterTitle = headingTitle;
      title = headingTitle;
      continue;
    }
    lines.push(line);
  }
  flush();
  return sections;
}

function filterSections(sections: readonly Section[], filter?: string): Section[] {
  if (!filter) return [...sections];
  const start = sections.findIndex((section) => section.title.includes(filter));
  if (start < 0) throw new TypeError(`Kanripo 源文件未找到分节：${filter}`);
  return [sections[start]!];
}

export function ingestKanripo({
  bookId,
  textId,
  raw,
  sourceUrl,
  verificationUrl,
  sectionFilter,
}: ImportOptions): CorpusPassage[] {
  const sections = filterSections(parseSections(raw, textId), sectionFilter);
  const passages: CorpusPassage[] = [];
  sections.forEach((section, workOffset) => {
    const workNumber = String(workOffset + 1).padStart(4, "0");
    const workId = `${bookId}/work-${workNumber}`;
    const chapterId = `${bookId}/chapter-${workNumber}`;
    chunkClassicalText(section.text).forEach((text, passageOffset) => {
      passages.push({
        id: `${workId}/passage-${String(passageOffset + 1).padStart(4, "0")}`,
        bookId,
        workId,
        chapterId,
        workTitle: section.title,
        chapterTitle: section.chapterTitle,
        order: passages.length + 1,
        text,
        normalizedText: normalizeSearchText(text),
        sourceUrl,
        verificationUrl,
      });
    });
  });
  if (passages.length === 0) throw new TypeError(`${textId} 没有可检索正文。`);
  return passages;
}
