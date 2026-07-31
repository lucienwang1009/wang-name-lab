export const kanripoRevisions = {
  KR1: "87ca682e6e875d570f353fe8cb25cdb5fd15d1ec",
  KR2: "cd4bd65ceb1329febd63436e37d5bb4b98f14208",
  KR3: "eca6cb15ba5ee47a4267fde608db2ecd2d5f55ac",
  KR4: "82a0ffcb9f183352c137a41ffdeb110a2c3bf32a",
  KR5: "10d3f4d9e1b633175af795f84243794dad90ebf3",
} as const;

type KanripoCollection = keyof typeof kanripoRevisions;

export interface KanripoFile {
  bookId: string;
  textId: string;
  collection: KanripoCollection;
  path: string;
  target: string;
  url: string;
  verificationUrl: string;
  sectionFilter?: string;
}

const entries: readonly [
  bookId: string,
  collection: KanripoCollection,
  textId: string,
  path: string,
  sectionFilter?: string,
][] = [
  ["hou-han-shu", "KR2", "KR2a0009", "KR2a0009 後漢書-宋-范曄.txt"],
  ["shi-shuo-xin-yu", "KR3", "KR3l0002", "KR3l0002 世說新語-劉宋-劉義慶.txt"],
  ["wen-zi", "KR5", "KR5c0118", "KR5c0118 文子-周-辛鈃.txt"],
  ["yin-wen-zi", "KR3", "KR3j0004", "KR3j0004 尹文子-周-尹文.txt"],
  ["shen-zi", "KR3", "KR3j0005", "KR3j0005 愼子-周-愼到.txt"],
  ["wu-zi", "KR3", "KR3b0004", "KR3b0004 吳子-周-吳起.txt"],
  ["gui-gu-zi", "KR3", "KR3j0008", "KR3j0008 鬼谷子-周-鬼谷子.txt"],
  ["wen-xin-diao-long", "KR4", "KR4i0001", "KR4i0001 文心雕龍-梁-劉勰.txt"],
  ["shi-pin", "KR4", "KR4i0003", "KR4i0003 詩品-梁-鍾嶸.txt"],
  ["wen-xuan", "KR4", "KR4h0001", "KR4h0001 文選-梁-蕭統.txt"],
  ["gu-shi-shi-jiu-shou", "KR4", "KR4h0001", "KR4h0001 文選-梁-蕭統.txt", "古詩一十九首"],
  ["yue-fu-shi-ji", "KR4", "KR4h0034", "KR4h0034 樂府詩集-宋-郭茂倩.txt"],
  ["yu-tai-xin-yong", "KR4", "KR4h0005", "KR4h0005 玉臺新詠-陳-徐陵.txt"],
  ["cao-zi-jian-ji", "KR4", "KR4b0004", "KR4b0004 曹子建集-魏-曹植.txt"],
  ["tao-yuan-ming-ji", "KR4", "KR4b0008", "KR4b0008 陶淵明集-晉-陶潛.txt"],
  ["li-tai-bai-ji", "KR4", "KR4c0013", "KR4c0013 李太白集分類補註-唐-李白.txt"],
  ["du-gong-bu-ji", "KR4", "KR4c0018", "KR4c0018 集千家註杜工部詩集-唐-杜甫.txt"],
  ["wang-you-cheng-ji", "KR4", "KR4c0021", "KR4c0021 須溪先生校本唐王右丞集-唐-.txt"],
  ["bai-shi-chang-qing-ji", "KR4", "KR4c0069", "KR4c0069 白氏長慶集-唐-白居易.txt"],
  ["li-shang-yin-shi-ji", "KR4", "KR4c0074", "KR4c0074 李義山詩集-唐-李商隱.txt"],
  ["dong-po-quan-ji", "KR4", "KR4d0076", "KR4d0076 東坡全集-宋-蘇軾.txt"],
  ["jia-xuan-chang-duan-ju", "KR4", "KR4j0040", "KR4j0040 稼軒詞-宋-辛棄疾.txt"],
  ["shu-yu-ci", "KR4", "KR4j0027", "KR4j0027 漱玉詞-宋-李清照.txt"],
  ["fang-yan", "KR1", "KR1j0006", "KR1j0006 輶軒使者絕代語釋別國方言-漢-揚雄.txt"],
  ["guang-ya", "KR1", "KR1j0008", "KR1j0008 廣雅-魏-張揖.txt"],
  ["yu-pian", "KR1", "KR1j0022", "KR1j0022 重修玉篇-梁-顧野王.txt"],
];

export const kanripoFiles: readonly KanripoFile[] = entries.map(
  ([bookId, collection, textId, path, sectionFilter]) => ({
    bookId,
    collection,
    textId,
    path,
    target: sectionFilter ? `${bookId}--source.txt` : `${bookId}.txt`,
    url: `https://raw.githubusercontent.com/kr-shadow/${collection}/${kanripoRevisions[collection]}/${encodeURIComponent(path)}`,
    verificationUrl: `https://www.kanripo.org/text/${textId}/`,
    sectionFilter,
  }),
);

export const kanripoDirectSeries = {
  bookId: "san-guo-zhi",
  textId: "KR2a0012",
  repository: "kanripo/KR2a0012",
  revision: "214fcafa79894355909c9d8c2c1533089e7791c6",
  target: "san-guo-zhi.txt",
  verificationUrl: "https://www.kanripo.org/text/KR2a0012/",
} as const;

export const kanripoAttribution = {
  project: "漢籍リポジトリ / kr-shadow",
  repositoryUrl: "https://github.com/kr-shadow",
  license: "CC-BY-SA-4.0",
  retrievedAt: "2026-07-31",
  editionCaveat:
    "漢籍リポジトリ固定版本的机器转录；部分书目所据版本含古注、序跋或整理标记，页面必须结合所列 KR 书号复核，不宣称为现代权威校勘本。",
  rightsNote:
    "古籍原作属于公有领域；Kanripo 数字文本按 CC BY-SA 4.0 提供，本站语料衍生层沿用同一许可。",
} as const;
