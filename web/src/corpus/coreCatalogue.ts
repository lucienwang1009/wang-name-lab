import type {
  CorpusBook,
  CorpusCategory,
  CorpusPriority,
} from "./types.ts";
import {
  chinesePoetryAttribution,
  chinesePoetryFiles,
} from "../../corpus/sources/chinese-poetry.ts";
import {
  earlyChineseAttribution,
  earlyChineseFiles,
} from "../../corpus/sources/early-chinese.ts";
import {
  kanripoAttribution,
  kanripoDirectSeries,
  kanripoFiles,
  kanripoRevisions,
} from "../../corpus/sources/kanripo.ts";

const baseBook = (
  id: string,
  title: string,
  category: CorpusCategory,
  period: string,
  priority: CorpusPriority,
): Omit<CorpusBook, "status" | "source"> => ({
  id,
  title,
  category,
  period,
  priority,
});

const sourceByBookId = new Map<string, CorpusBook["source"]>([
  ...chinesePoetryFiles
    .filter((file) => file.bookId)
    .map(
      (file) =>
        [
          file.bookId as string,
          {
            originUrl: file.url,
            editionNote: chinesePoetryAttribution.editionCaveat,
            rightsNote: chinesePoetryAttribution.rightsNote,
            retrievedAt: chinesePoetryAttribution.retrievedAt,
            checksum: file.sha256 ?? chinesePoetryAttribution.revision,
            segmentation: "punctuated" as const,
          },
        ] as const,
    ),
  ...earlyChineseFiles.map(
    (file) =>
      [
        file.bookId,
        {
          originUrl: file.url,
          editionNote: earlyChineseAttribution.editionCaveat,
          rightsNote: earlyChineseAttribution.rightsNote,
          retrievedAt: earlyChineseAttribution.retrievedAt,
          checksum: earlyChineseAttribution.revision,
          segmentation: "unpunctuated" as const,
        },
      ] as const,
  ),
  ...kanripoFiles.map(
    (file) =>
      [
        file.bookId,
        {
          originUrl: file.url,
          editionNote: kanripoAttribution.editionCaveat,
          rightsNote: kanripoAttribution.rightsNote,
          retrievedAt: kanripoAttribution.retrievedAt,
          checksum: kanripoRevisions[file.collection],
          segmentation: "unpunctuated" as const,
        },
      ] as const,
  ),
  [
    kanripoDirectSeries.bookId,
    {
      originUrl: `https://github.com/${kanripoDirectSeries.repository}/tree/${kanripoDirectSeries.revision}`,
      editionNote: kanripoAttribution.editionCaveat,
      rightsNote: kanripoAttribution.rightsNote,
      retrievedAt: kanripoAttribution.retrievedAt,
      checksum: kanripoDirectSeries.revision,
      segmentation: "unpunctuated" as const,
    },
  ],
]);

const catalogueBook = (
  id: string,
  title: string,
  category: CorpusCategory,
  period: string,
  priority: CorpusPriority,
): CorpusBook => {
  const file = sourceByBookId.get(id);
  if (!file) throw new Error(`缺少 ${id} 的固定语料来源。`);
  return {
    ...baseBook(id, title, category, period, priority),
    status: "ready",
    source: file,
  };
};

export const coreCatalogue = [
  catalogueBook("shi-jing", "《诗经》", "经", "先秦", 1),
  catalogueBook("shang-shu", "《尚书》", "经", "先秦", 1),
  catalogueBook("zhou-yi", "《周易》", "经", "先秦", 1),
  catalogueBook("zhou-li", "《周礼》", "经", "先秦", 2),
  catalogueBook("yi-li", "《仪礼》", "经", "先秦", 2),
  catalogueBook("li-ji", "《礼记》", "经", "先秦至汉", 1),
  catalogueBook("chun-qiu-zuo-zhuan", "《春秋左传》", "经", "先秦", 1),
  catalogueBook("chun-qiu-gong-yang-zhuan", "《春秋公羊传》", "经", "先秦至汉", 3),
  catalogueBook("chun-qiu-gu-liang-zhuan", "《春秋谷梁传》", "经", "先秦至汉", 3),
  catalogueBook("lun-yu", "《论语》", "经", "先秦", 1),
  catalogueBook("meng-zi", "《孟子》", "经", "先秦", 1),
  catalogueBook("da-xue", "《大学》", "经", "先秦至汉", 1),
  catalogueBook("zhong-yong", "《中庸》", "经", "先秦至汉", 1),
  catalogueBook("xiao-jing", "《孝经》", "经", "先秦至汉", 2),

  catalogueBook("guo-yu", "《国语》", "史", "先秦", 1),
  catalogueBook("zhan-guo-ce", "《战国策》", "史", "先秦至汉", 1),
  catalogueBook("yi-zhou-shu", "《逸周书》", "史", "先秦", 3),
  catalogueBook("shi-ji", "《史记》", "史", "西汉", 1),
  catalogueBook("han-shu", "《汉书》", "史", "东汉", 2),
  catalogueBook("hou-han-shu", "《后汉书》", "史", "南朝宋", 2),
  catalogueBook("san-guo-zhi", "《三国志》", "史", "西晋", 2),
  catalogueBook("yue-jue-shu", "《越绝书》", "史", "汉", 3),
  catalogueBook("wu-yue-chun-qiu", "《吴越春秋》", "史", "东汉", 3),
  catalogueBook("shi-shuo-xin-yu", "《世说新语》", "史", "南朝宋", 1),

  catalogueBook("lao-zi", "《老子》", "子", "先秦", 1),
  catalogueBook("zhuang-zi", "《庄子》", "子", "先秦", 1),
  catalogueBook("mo-zi", "《墨子》", "子", "先秦", 2),
  catalogueBook("xun-zi", "《荀子》", "子", "先秦", 1),
  catalogueBook("han-fei-zi", "《韩非子》", "子", "先秦", 2),
  catalogueBook("lie-zi", "《列子》", "子", "先秦至魏晋", 2),
  catalogueBook("guan-zi", "《管子》", "子", "先秦至汉", 2),
  catalogueBook("shang-jun-shu", "《商君书》", "子", "先秦", 3),
  catalogueBook("lv-shi-chun-qiu", "《吕氏春秋》", "子", "先秦", 1),
  catalogueBook("huai-nan-zi", "《淮南子》", "子", "西汉", 1),
  catalogueBook("wen-zi", "《文子》", "子", "先秦至汉", 3),
  catalogueBook("yin-wen-zi", "《尹文子》", "子", "先秦", 3),
  catalogueBook("shen-zi", "《慎子》", "子", "先秦", 3),
  catalogueBook("sun-zi-bing-fa", "《孙子兵法》", "子", "先秦", 2),
  catalogueBook("wu-zi", "《吴子》", "子", "先秦", 3),
  catalogueBook("gui-gu-zi", "《鬼谷子》", "子", "先秦至六朝", 3),
  catalogueBook("kong-zi-jia-yu", "《孔子家语》", "子", "汉魏", 2),
  catalogueBook("xin-shu", "《新书》", "子", "西汉", 2),
  catalogueBook("yan-tie-lun", "《盐铁论》", "子", "西汉", 3),
  catalogueBook("lun-heng", "《论衡》", "子", "东汉", 2),
  catalogueBook("wen-xin-diao-long", "《文心雕龙》", "子", "南朝梁", 1),
  catalogueBook("shi-pin", "《诗品》", "子", "南朝梁", 2),

  catalogueBook("chu-ci", "《楚辞》", "集", "先秦至汉", 1),
  catalogueBook("wen-xuan", "《文选》", "集", "南朝梁", 1),
  catalogueBook("gu-shi-shi-jiu-shou", "《古诗十九首》", "集", "汉", 1),
  catalogueBook("yue-fu-shi-ji", "《乐府诗集》", "集", "北宋", 1),
  catalogueBook("yu-tai-xin-yong", "《玉台新咏》", "集", "南朝梁", 2),
  catalogueBook("cao-zi-jian-ji", "《曹子建集》", "集", "三国魏", 1),
  catalogueBook("tao-yuan-ming-ji", "《陶渊明集》", "集", "东晋", 1),
  catalogueBook("li-tai-bai-ji", "《李太白集》", "集", "唐", 1),
  catalogueBook("du-gong-bu-ji", "《杜工部集》", "集", "唐", 2),
  catalogueBook("wang-you-cheng-ji", "《王右丞集》", "集", "唐", 1),
  catalogueBook("bai-shi-chang-qing-ji", "《白氏长庆集》", "集", "唐", 2),
  catalogueBook("li-shang-yin-shi-ji", "《李商隐诗集》", "集", "唐", 2),
  catalogueBook("dong-po-quan-ji", "《东坡全集》", "集", "北宋", 1),
  catalogueBook("jia-xuan-chang-duan-ju", "《稼轩长短句》", "集", "南宋", 2),
  catalogueBook("shu-yu-ci", "《漱玉词》", "集", "南宋", 1),
  catalogueBook("tang-shi-san-bai-shou", "《唐诗三百首》", "集", "清", 1),
  catalogueBook("song-ci-san-bai-shou", "《宋词三百首》", "集", "近代", 1),
  catalogueBook("gu-wen-guan-zhi", "《古文观止》", "集", "清", 2),

  catalogueBook("er-ya", "《尔雅》", "字书", "先秦至汉", 1),
  catalogueBook("shuo-wen-jie-zi", "《说文解字》", "字书", "东汉", 1),
  catalogueBook("fang-yan", "《方言》", "字书", "西汉", 2),
  catalogueBook("shi-ming", "《释名》", "字书", "东汉", 2),
  catalogueBook("guang-ya", "《广雅》", "字书", "三国魏", 2),
  catalogueBook("yu-pian", "《玉篇》", "字书", "南朝梁", 3),
] as const satisfies readonly CorpusBook[];
