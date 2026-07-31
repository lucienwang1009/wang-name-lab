export const earlyChineseRevision =
  "b28fab8f54b0e3ec3ca97cc2baa8caecfe71259f";

export interface EarlyChineseFile {
  bookId: string;
  textId: string;
  target: string;
  url: string;
  verificationUrl: string;
}

const rawRoot = `https://raw.githubusercontent.com/direct-phonology/ect-krp/${earlyChineseRevision}/jsonl`;

const entries = [
  ["shang-shu", "KR1b0001"],
  ["zhou-yi", "KR1a0001"],
  ["zhou-li", "KR1d0002"],
  ["yi-li", "KR1d0026"],
  ["li-ji", "KR1d0052"],
  ["chun-qiu-zuo-zhuan", "KR1e0001"],
  ["chun-qiu-gong-yang-zhuan", "KR1e0007"],
  ["chun-qiu-gu-liang-zhuan", "KR1e0008"],
  ["xiao-jing", "KR1f0001"],
  ["guo-yu", "KR2e0001"],
  ["zhan-guo-ce", "KR2e0003"],
  ["yi-zhou-shu", "KR2d0001"],
  ["shi-ji", "KR2a0001"],
  ["han-shu", "KR2a0007"],
  ["yue-jue-shu", "KR2i0002"],
  ["wu-yue-chun-qiu", "KR2i0001"],
  ["lao-zi", "KR5c0057"],
  ["zhuang-zi", "KR5c0126"],
  ["mo-zi", "KR3j0002"],
  ["xun-zi", "KR3a0002"],
  ["han-fei-zi", "KR3c0005"],
  ["lie-zi", "KR5c0124"],
  ["guan-zi", "KR3c0001"],
  ["shang-jun-shu", "KR3c0004"],
  ["lv-shi-chun-qiu", "KR3j0009"],
  ["huai-nan-zi", "KR3j0010"],
  ["sun-zi-bing-fa", "KR3b0003"],
  ["kong-zi-jia-yu", "KR3a0001"],
  ["xin-shu", "KR3a0005"],
  ["yan-tie-lun", "KR3a0006"],
  ["lun-heng", "KR3j0080"],
  ["er-ya", "KR1j0002"],
  ["shuo-wen-jie-zi", "KR1j0018"],
  ["shi-ming", "KR1j0007"],
] as const;

export const earlyChineseFiles: readonly EarlyChineseFile[] = entries.map(
  ([bookId, textId]) => ({
    bookId,
    textId,
    target: `${bookId}.jsonl`,
    url: `${rawRoot}/${textId}.jsonl`,
    verificationUrl: `https://www.kanripo.org/text/${textId}/`,
  }),
);

export const earlyChineseAttribution = {
  project: "direct-phonology/ect-krp",
  repositoryUrl: "https://github.com/direct-phonology/ect-krp",
  revision: earlyChineseRevision,
  license: "CC-BY-SA-4.0",
  retrievedAt: "2026-07-31",
  editionCaveat:
    "据漢籍リポジトリ固定版本生成的去旁文白文层；上游移除标点、空白和大部分注释，本站按固定长度切为检索段，段界不等同于古籍原有句读。",
  rightsNote:
    "古籍原作属于公有领域；ECT-KRP 与其所用 Kanripo 文本按 CC BY-SA 4.0 提供，本站语料衍生层沿用同一许可。",
} as const;
