import OpenCC from "opencc-js/t2cn";

const toSimplified = OpenCC.Converter({ from: "t", to: "cn" });
const sentencePattern = /[^。！？!?；;]+[。！？!?；;]?/gu;
const hanCharacterPattern = /\p{Script=Han}/u;

export function splitClassicalSentences(text: string): string[] {
  return (text.normalize("NFC").match(sentencePattern) ?? [])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function normalizeSearchText(text: string): string {
  return [...toSimplified(text.normalize("NFC"))]
    .filter((character) => hanCharacterPattern.test(character))
    .join("");
}
