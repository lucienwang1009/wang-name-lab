import { normalizeSearchText, splitClassicalSentences } from "../normalizeText.ts";

const maximumCharacters = 180;

function splitLongUnit(text: string): string[] {
  const characters = [...text.trim()];
  if (normalizeSearchText(text).length <= maximumCharacters) return [text.trim()];
  const chunks: string[] = [];
  let start = 0;
  while (start < characters.length) {
    let end = start;
    let searchableCharacters = 0;
    while (end < characters.length && searchableCharacters < maximumCharacters) {
      const character = characters[end];
      if (character && normalizeSearchText(character)) searchableCharacters += 1;
      end += 1;
    }
    const chunk = characters.slice(start, end).join("").trim();
    if (chunk) chunks.push(chunk);
    if (end >= characters.length) break;
    start = Math.max(start + 1, end - 1);
  }
  return chunks;
}

export function chunkClassicalText(text: string): string[] {
  const sentences = splitClassicalSentences(text).flatMap(splitLongUnit);
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const candidate = `${current}${sentence}`;
    if (current && normalizeSearchText(candidate).length > maximumCharacters) {
      chunks.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks.filter((chunk) => normalizeSearchText(chunk));
}
