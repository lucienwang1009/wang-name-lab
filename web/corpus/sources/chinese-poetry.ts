export const chinesePoetryRevision =
  "b8594f81a89752241442f2ce267d6f66f96704ee";

export interface PinnedCorpusFile {
  bookId?:
    | "shi-jing"
    | "chu-ci"
    | "lun-yu"
    | "meng-zi"
    | "da-xue"
    | "zhong-yong"
    | "tang-shi-san-bai-shou"
    | "song-ci-san-bai-shou"
    | "gu-wen-guan-zhi";
  target: string;
  url: string;
  sha256?: string;
  verificationUrl?: string;
  format?: "classic" | "poetry";
}

const rawRoot = `https://raw.githubusercontent.com/chinese-poetry/chinese-poetry/${chinesePoetryRevision}`;

export const chinesePoetryFiles: readonly PinnedCorpusFile[] = [
  {
    bookId: "shi-jing",
    target: "shijing.json",
    url: `${rawRoot}/%E8%AF%97%E7%BB%8F/shijing.json`,
    sha256: "3c7ca54d59424542ada99adfcc85420287fbbd5c8a511e9baf705cb2b04051e7",
    verificationUrl: "https://zh.wikisource.org/zh-hans/%E8%A9%A9%E7%B6%93",
  },
  {
    bookId: "chu-ci",
    target: "chuci.json",
    url: `${rawRoot}/%E6%A5%9A%E8%BE%9E/chuci.json`,
    sha256: "5069e733d93781cecd55405c6d4699a7c17125b3f13cf79810d68792482e5b9b",
    verificationUrl: "https://zh.wikisource.org/zh-hans/%E6%A5%9A%E8%BE%AD",
  },
  {
    bookId: "lun-yu",
    target: "lunyu.json",
    url: `${rawRoot}/%E8%AE%BA%E8%AF%AD/lunyu.json`,
    sha256: "bc336a3839706377892719db44c48a09794a493190535a42bf1c7d4c4233e96c",
    verificationUrl: "https://zh.wikisource.org/zh-hans/%E8%AB%96%E8%AA%9E",
  },
  {
    bookId: "meng-zi",
    target: "mengzi.json",
    url: `${rawRoot}/%E5%9B%9B%E4%B9%A6%E4%BA%94%E7%BB%8F/mengzi.json`,
    sha256: "349888018acd0b3fea58de92e53403b8c77640d84b1ae9d37360d5ff1966bcdc",
    verificationUrl: "https://zh.wikisource.org/zh-hans/%E5%AD%9F%E5%AD%90",
  },
  {
    bookId: "da-xue",
    target: "daxue.json",
    url: `${rawRoot}/%E5%9B%9B%E4%B9%A6%E4%BA%94%E7%BB%8F/daxue.json`,
    sha256: "1939dfeb2cb8fde6c96fb5ce6bd1cff93df05460027c90c685f4863b05c550e8",
    verificationUrl: "https://zh.wikisource.org/zh-hans/%E5%A4%A7%E5%AD%B8",
  },
  {
    bookId: "zhong-yong",
    target: "zhongyong.json",
    url: `${rawRoot}/%E5%9B%9B%E4%B9%A6%E4%BA%94%E7%BB%8F/zhongyong.json`,
    verificationUrl: "https://zh.wikisource.org/zh-hans/%E4%B8%AD%E5%BA%B8",
  },
  {
    bookId: "tang-shi-san-bai-shou",
    target: "tangshisanbaishou.json",
    url: `${rawRoot}/%E5%85%A8%E5%94%90%E8%AF%97/%E5%94%90%E8%AF%97%E4%B8%89%E7%99%BE%E9%A6%96.json`,
    verificationUrl:
      "https://zh.wikisource.org/zh-hans/%E5%94%90%E8%A9%A9%E4%B8%89%E7%99%BE%E9%A6%96",
    format: "poetry",
  },
  {
    bookId: "song-ci-san-bai-shou",
    target: "songcisanbaishou.json",
    url: `${rawRoot}/%E5%AE%8B%E8%AF%8D/%E5%AE%8B%E8%AF%8D%E4%B8%89%E7%99%BE%E9%A6%96.json`,
    verificationUrl:
      "https://zh.wikisource.org/zh-hans/%E5%AE%8B%E8%A9%9E%E4%B8%89%E7%99%BE%E9%A6%96",
    format: "poetry",
  },
  {
    bookId: "gu-wen-guan-zhi",
    target: "guwenguanzhi.json",
    url: `${rawRoot}/%E8%92%99%E5%AD%A6/guwenguanzhi.json`,
    verificationUrl:
      "https://zh.wikisource.org/zh-hans/%E5%8F%A4%E6%96%87%E8%A7%80%E6%AD%A2",
    format: "poetry",
  },
  {
    target: "LICENSE",
    url: `${rawRoot}/LICENSE`,
    sha256: "c195319aeaa3ffcbe16aa5d26eec19eae5a42f84337dd2b3dc3c9d5ccbbd6507",
  },
];

export const chinesePoetryAttribution = {
  project: "chinese-poetry/chinese-poetry",
  repositoryUrl: "https://github.com/chinese-poetry/chinese-poetry",
  revision: chinesePoetryRevision,
  license: "MIT",
  retrievedAt: "2026-07-31",
  editionCaveat:
    "开源仓库的机器可读转录与现代标点版本，并非指定古籍底本或校勘本；重要结果须通过所附公版页面复核。",
  rightsNote:
    "古籍原作属于公有领域；本项目依上游仓库声明，按 MIT 许可证使用其机器可读数据整理成果。",
} as const;
