export function bucketForCharacter(character: string): string {
  const codePoint = character.codePointAt(0);
  if (codePoint === undefined) {
    throw new TypeError("无法为字符为空的检索项分桶。");
  }
  const highByte = (codePoint >>> 8).toString(16).padStart(4, "0");
  const lowByteQuarter = ((codePoint & 0xff) >>> 6).toString(16);
  return `${highByte}-${lowByteQuarter}`;
}
