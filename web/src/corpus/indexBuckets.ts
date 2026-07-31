export function bucketForCharacter(character: string): string {
  const codePoint = character.codePointAt(0);
  if (codePoint === undefined) {
    throw new TypeError("无法为字符为空的检索项分桶。");
  }
  return Math.floor(codePoint / 0x100).toString(16).padStart(3, "0");
}
