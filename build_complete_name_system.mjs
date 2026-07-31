import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

import {
  characterDictionary,
  classicalFragments,
  curatedCandidates,
  rejectionRules,
  sourceGradeMap,
} from "./src/name-system-data.mjs";
import {
  buildBirthScenarios,
  generateAllusionCandidates,
  generateRawPool,
  validateSystemData,
} from "./src/name-system-core.mjs";

const outputDir =
  "/Users/lucien/Documents/孩子起名/outputs/019fb1f8-0141-7962-9a84-aca9698006a2";
const outputPath = `${outputDir}/王姓女孩完整取名系统.xlsx`;

const validation = validateSystemData({
  characters: characterDictionary,
  fragments: classicalFragments,
  curated: curatedCandidates,
});
if (validation.errors.length) {
  throw new Error(`系统数据校验失败：\n${validation.errors.join("\n")}`);
}

// 160 字形成 25,440 个有序组合；完整字典保留给后续扩展。
const generationCharacters = characterDictionary.slice(0, 160);
const rawPool = generateRawPool(generationCharacters);
const characterSet = new Set(characterDictionary.map((item) => item.char));
const allusionPool = generateAllusionCandidates(
  classicalFragments,
  characterSet,
);
const birthScenarios = buildBirthScenarios("2026-08-20", "2026-08-30");
const rejectedCandidates = curatedCandidates.filter(
  (item) => item.gate !== "通过",
);
const cardCandidates = curatedCandidates
  .filter((item) => item.gate === "通过")
  .slice(0, 8);

const theme = {
  ink: "#183B38",
  ink2: "#285C55",
  gold: "#B58B3A",
  sand: "#F4EFE5",
  paper: "#FFFDF8",
  pale: "#EAF2EF",
  pale2: "#DDEBE6",
  rose: "#F5E7E4",
  roseText: "#8A3D37",
  line: "#D7D6CF",
  gray: "#6A716F",
  white: "#FFFFFF",
  blue: "#1F5E9C",
  green: "#176B52",
};

const workbook = Workbook.create();
const sheetNames = [
  "导航与结论",
  "基础输入",
  "评分与否决",
  "用字字典",
  "原始生成池",
  "古籍语料库",
  "典故候选池",
  "精选评分",
  "命理情景",
  "出生后复排",
  "否决记录",
  "名字档案卡",
];
const sheets = Object.fromEntries(
  sheetNames.map((name) => [name, workbook.worksheets.add(name)]),
);

function setupSheet(sheet) {
  sheet.showGridLines = false;
}

function addTitle(sheet, range, text, subtitleRange, subtitle) {
  sheet.getRange(range).merge();
  sheet.getRange(range.split(":")[0]).values = [[text]];
  sheet.getRange(range).format = {
    fill: theme.ink,
    font: {
      bold: true,
      color: theme.white,
      size: 18,
      name: "PingFang SC",
    },
    verticalAlignment: "center",
  };
  sheet.getRange(subtitleRange).merge();
  sheet.getRange(subtitleRange.split(":")[0]).values = [[subtitle]];
  sheet.getRange(subtitleRange).format = {
    fill: theme.sand,
    font: { color: theme.ink2, italic: true, name: "PingFang SC" },
    verticalAlignment: "center",
    wrapText: true,
  };
}

function formatHeader(range) {
  range.format = {
    fill: theme.ink2,
    font: { bold: true, color: theme.white, name: "PingFang SC" },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "all", style: "thin", color: "#FFFFFF" },
  };
}

function formatData(range) {
  range.format = {
    font: { name: "PingFang SC", size: 10 },
    borders: { preset: "all", style: "thin", color: theme.line },
    verticalAlignment: "top",
    wrapText: true,
  };
}

for (const sheet of Object.values(sheets)) setupSheet(sheet);

// 基础输入
{
  const sheet = sheets["基础输入"];
  addTitle(
    sheet,
    "A1:F1",
    "王姓女孩完整取名系统｜基础输入",
    "A2:F2",
    "蓝字为用户输入；出生前不计算确定八字。实际出生后补齐时间与城市，再进行命理复排。",
  );
  sheet.getRange("A4:C4").values = [["项目", "当前值", "说明"]];
  formatHeader(sheet.getRange("A4:C4"));
  sheet.getRange("A5:C23").values = [
    ["姓氏", "王", "当前项目固定为王姓"],
    ["孩子状态", "未出生", "出生后改为“已出生”"],
    ["性别", "女", "女性感为硬门槛"],
    ["预产窗口开始", new Date("2026-08-20T00:00:00+08:00"), "仅用于情景准备"],
    ["预产窗口结束", new Date("2026-08-30T00:00:00+08:00"), "仅用于情景准备"],
    ["奶奶姓名线索", "字玉", "可直接保留“玉”或用玉石意象暗合"],
    ["姥姥姓名线索", "绍影", "可保留“影”、转写“韶”或使用月光意象"],
    ["实际出生日期", null, "出生后填写公历日期"],
    ["实际出生时间", null, "尽量精确到分钟"],
    ["出生城市", null, "用于时区与真太阳时讨论"],
    ["出生地经度", null, "可选；用于真太阳时修正"],
    ["真太阳时口径", "出生后决定", "建议同时保留北京时间与真太阳时两套结果"],
    ["四柱", null, "出生后由核验排盘填写，不在预产期阶段猜测"],
    ["喜用方向", null, "记录流派、判断依据和不确定性"],
    ["命理说明", null, "不得只写“缺什么补什么”"],
    ["出生后命理建议权重", 0.15, "建议不超过25%；可设为0"],
    ["当前有效命理权重", null, "未出生时由公式强制为0"],
    ["生僻容忍度", "中高", "接受少见字，但需能稳定录入"],
    ["不普通偏好", "高", "常见组合将降级"],
  ];
  sheet.getRange("B21").formulas = [['=IF(B6="未出生",0,B20)']];
  formatData(sheet.getRange("A5:C23"));
  sheet.getRange("B5:B20").format.font = {
    color: theme.blue,
    name: "PingFang SC",
  };
  sheet.getRange("B21").format = {
    fill: theme.pale,
    font: { bold: true, color: theme.green, name: "PingFang SC" },
    numberFormat: "0%",
  };
  sheet.getRange("B8:B9").format.numberFormat = "yyyy-mm-dd";
  sheet.getRange("B20:B21").format.numberFormat = "0%";
  sheet.getRange("B6").dataValidation = {
    rule: { type: "list", values: ["未出生", "已出生"] },
  };
  sheet.getRange("B7").dataValidation = {
    rule: { type: "list", values: ["女", "男"] },
  };
  sheet.getRange("B16").dataValidation = {
    rule: {
      type: "list",
      values: ["出生后决定", "北京时间", "真太阳时", "两套并列"],
    },
  };
  sheet.getRange("B22").dataValidation = {
    rule: { type: "list", values: ["低", "中", "中高", "高"] },
  };
  sheet.getRange("B23").dataValidation = {
    rule: { type: "list", values: ["中", "中高", "高"] },
  };
  sheet.getRange("A1:F1").format.rowHeight = 34;
  sheet.getRange("A2:F2").format.rowHeight = 32;
  sheet.getRange("A1:A23").format.columnWidth = 24;
  sheet.getRange("B1:B23").format.columnWidth = 24;
  sheet.getRange("C1:C23").format.columnWidth = 62;
  sheet.getRange("D1:F23").format.columnWidth = 12;
  sheet.freezePanes.freezeRows(4);
}

// 评分与否决
{
  const sheet = sheets["评分与否决"];
  addTitle(
    sheet,
    "A1:H1",
    "评分规则、典故等级与硬性否决",
    "A2:H2",
    "文化审美与传统命理分轨。命中硬性否决时，总分不能补偿。",
  );
  sheet.getRange("A4:D4").values = [["文化维度", "权重乘数", "满分", "说明"]];
  formatHeader(sheet.getRange("A4:D4"));
  sheet.getRange("A5:D10").values = [
    ["女性感", 5, 25, "名字单独听也应明确偏女性"],
    ["出处真实", 4, 20, "原典、上下文和取字路径均可核对"],
    ["家族呼应", 3, 15, "玉、影、绍/韶及相关意象"],
    ["稀有程度", 3, 15, "公开检索代理，不等同户籍重名率"],
    ["王姓音律", 3, 15, "声调、连读和方言风险"],
    ["使用成本", 2, 10, "识读、书写和录入"],
  ];
  formatData(sheet.getRange("A5:D10"));
  sheet.getRange("B5:B10").format = {
    font: { color: theme.blue, name: "PingFang SC" },
    numberFormat: "0",
    horizontalAlignment: "center",
  };
  sheet.getRange("C5:C10").format.numberFormat = "0";

  sheet.getRange("F4:H4").values = [["等级", "定义", "出处得分参考"]];
  formatHeader(sheet.getRange("F4:H4"));
  sheet.getRange("F5:H8").values = sourceGradeMap;
  formatData(sheet.getRange("F5:H8"));
  sheet.getRange("H5:H8").format.numberFormat = "0.0";

  sheet.getRange("A12:D12").merge();
  sheet.getRange("A12").values = [["硬性否决规则"]];
  sheet.getRange("A12:D12").format = {
    fill: theme.gold,
    font: { bold: true, color: theme.white, name: "PingFang SC" },
  };
  sheet.getRange("A13:D13").values = [["代码", "类别", "触发条件", "处理"]];
  formatHeader(sheet.getRange("A13:D13"));
  sheet.getRange(`A14:D${13 + rejectionRules.length}`).values = rejectionRules;
  formatData(sheet.getRange(`A14:D${13 + rejectionRules.length}`));

  sheet.getRange("F10:H10").merge();
  sheet.getRange("F10").values = [["出生后复排"]];
  sheet.getRange("F10:H10").format = {
    fill: theme.gold,
    font: { bold: true, color: theme.white, name: "PingFang SC" },
  };
  sheet.getRange("F11:H14").values = [
    ["项目", "默认值", "边界"],
    ["文化审美权重", 0.85, "出生后可调"],
    ["命理适配权重", 0.15, "建议0%–25%"],
    ["出生前有效命理权重", 0, "强制为0"],
  ];
  formatData(sheet.getRange("F11:H14"));
  sheet.getRange("G12:G14").format.numberFormat = "0%";

  sheet.getRange("A22:H22").merge();
  sheet.getRange("A22").values = [["民俗模块边界"]];
  sheet.getRange("A22:H22").format = {
    fill: theme.rose,
    font: { bold: true, color: theme.roseText, name: "PingFang SC" },
  };
  sheet.getRange("A23:H26").values = [
    ["•", "四柱、喜用神属于传统命理文化，不是现代科学验证的命运因果模型。", "", "", "", "", "", ""],
    ["•", "用字五行没有统一古代标准；不同姓名学流派可能把同一字归入不同五行。", "", "", "", "", "", ""],
    ["•", "三才五格、81数理源于近代日本姓名学，不进入默认总分。", "", "", "", "", "", ""],
    ["•", "生肖偏旁宜忌只保留为可选民俗说明，不作为硬规则。", "", "", "", "", "", ""],
  ];
  for (let row = 23; row <= 26; row += 1) sheet.getRange(`B${row}:H${row}`).merge();
  sheet.getRange("A23:H26").format = {
    font: { name: "PingFang SC" },
    wrapText: true,
    verticalAlignment: "top",
  };
  sheet.getRange("A1:A26").format.columnWidth = 15;
  sheet.getRange("B1:B26").format.columnWidth = 18;
  sheet.getRange("C1:C26").format.columnWidth = 20;
  sheet.getRange("D1:D26").format.columnWidth = 48;
  sheet.getRange("E1:E26").format.columnWidth = 4;
  sheet.getRange("F1:F26").format.columnWidth = 22;
  sheet.getRange("G1:G26").format.columnWidth = 26;
  sheet.getRange("H1:H26").format.columnWidth = 26;
  sheet.freezePanes.freezeRows(3);
}

// 用字字典
{
  const sheet = sheets["用字字典"];
  addTitle(
    sheet,
    "A1:J1",
    "古典用字字典",
    "A2:J2",
    `共 ${characterDictionary.length} 字；其中前 ${generationCharacters.length} 字进入本版原始组合生成。五行栏只记录民俗归类争议。`,
  );
  sheet.getRange("A4:J4").values = [[
    "序号",
    "用字",
    "类别",
    "基本意象",
    "女性感",
    "稀有度",
    "实用性",
    "家族标签",
    "民俗五行标签",
    "边界说明",
  ]];
  formatHeader(sheet.getRange("A4:J4"));
  const rows = characterDictionary.map((item, index) => [
    index + 1,
    item.char,
    item.category,
    item.meaning,
    item.feminine,
    item.rarity,
    item.usability,
    item.familyTag,
    item.folkElement,
    item.elementCaveat,
  ]);
  const end = 4 + rows.length;
  sheet.getRange(`A5:J${end}`).values = rows;
  formatData(sheet.getRange(`A5:J${end}`));
  sheet.getRange(`E5:G${end}`).format.numberFormat = "0.0";
  sheet.getRange(`B5:B${end}`).format = {
    font: { bold: true, color: theme.ink, size: 13, name: "PingFang SC" },
    horizontalAlignment: "center",
  };
  const widths = [7, 8, 16, 28, 10, 10, 10, 12, 24, 45];
  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, end, 1).format.columnWidth = width;
  });
  sheet.freezePanes.freezeRows(4);
  sheet.freezePanes.freezeColumns(2);
}

// 原始生成池
{
  const sheet = sheets["原始生成池"];
  addTitle(
    sheet,
    "A1:L1",
    "原始姓名生成池",
    "A2:L2",
    `本版载入 ${rawPool.length.toLocaleString("zh-CN")} 个不重复的“王+双字”组合。这里只扩大搜索空间，不代表已经有典故或适合使用。`,
  );
  sheet.getRange("A4:L4").values = [[
    "ID",
    "姓名",
    "首字",
    "次字",
    "首字类别",
    "次字类别",
    "女性感代理",
    "家族呼应代理",
    "稀有代理",
    "实用代理",
    "状态",
    "证据边界",
  ]];
  formatHeader(sheet.getRange("A4:L4"));
  const rows = rawPool.map((item) => [
    item.id,
    item.name,
    item.first,
    item.second,
    item.firstCategory,
    item.secondCategory,
    item.feminineProxy,
    item.familyProxy,
    item.rarityProxy,
    item.usabilityProxy,
    item.status,
    item.evidence,
  ]);
  const end = 4 + rows.length;
  sheet.getRange(`A5:L${end}`).values = rows;
  formatData(sheet.getRange(`A5:L${end}`));
  sheet.getRange(`G5:J${end}`).format.numberFormat = "0.0";
  sheet.getRange(`B5:B${end}`).format = {
    font: { bold: true, color: theme.ink, name: "PingFang SC" },
    horizontalAlignment: "center",
  };
  const widths = [14, 12, 8, 8, 16, 16, 12, 14, 12, 12, 12, 56];
  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, Math.min(end, 300), 1).format.columnWidth =
      width;
  });
  sheet.freezePanes.freezeRows(4);
  sheet.freezePanes.freezeColumns(2);
}

// 古籍语料库
{
  const sheet = sheets["古籍语料库"];
  addTitle(
    sheet,
    "A1:H1",
    "古籍语料库｜已核验种子",
    "A2:H2",
    "每条语料保存篇目、原文、女性/意象场景、上下文倾向和可核对链接；后续可以继续扩充。",
  );
  sheet.getRange("A4:H4").values = [[
    "ID",
    "语料范围",
    "篇目",
    "原文",
    "人物/场景",
    "上下文倾向",
    "来源链接",
    "状态",
  ]];
  formatHeader(sheet.getRange("A4:H4"));
  const rows = classicalFragments.map((item) => [
    item.id,
    item.corpus,
    item.source,
    item.quote,
    item.scene,
    item.contextTone,
    item.url,
    "已核验种子",
  ]);
  const end = 4 + rows.length;
  sheet.getRange(`A5:H${end}`).values = rows;
  formatData(sheet.getRange(`A5:H${end}`));
  sheet.getRange(`G5:G${end}`).format.font = {
    color: theme.blue,
    size: 9,
    name: "PingFang SC",
  };
  const widths = [12, 16, 24, 48, 28, 20, 46, 14];
  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, end, 1).format.columnWidth = width;
  });
  sheet.getRange(`A5:H${end}`).format.rowHeight = 48;
  sheet.freezePanes.freezeRows(4);
  sheet.freezePanes.freezeColumns(3);
}

// 典故候选池
{
  const sheet = sheets["典故候选池"];
  addTitle(
    sheet,
    "A1:M1",
    "典故候选生成池",
    "A2:M2",
    `从 ${classicalFragments.length} 条核验语料自动提取 ${allusionPool.length} 条可溯源组合；“可溯源”不等于“已经适合起名”，仍须女性感和语义精审。`,
  );
  sheet.getRange("A4:M4").values = [[
    "ID",
    "姓名",
    "语料ID",
    "语料范围",
    "篇目",
    "原文",
    "取字方式",
    "典故等级",
    "人物/场景",
    "上下文",
    "审核状态",
    "来源链接",
    "人工备注",
  ]];
  formatHeader(sheet.getRange("A4:M4"));
  const rows = allusionPool.map((item) => [
    item.id,
    item.name,
    item.fragmentId,
    item.corpus,
    item.source,
    item.quote,
    item.extraction,
    item.grade,
    item.scene,
    item.contextTone,
    item.reviewStatus,
    item.url,
    null,
  ]);
  const end = 4 + rows.length;
  sheet.getRange(`A5:M${end}`).values = rows;
  formatData(sheet.getRange(`A5:M${end}`));
  sheet.getRange(`B5:B${end}`).format = {
    font: { bold: true, color: theme.ink, name: "PingFang SC" },
    horizontalAlignment: "center",
  };
  sheet.getRange(`M5:M${end}`).format.font = {
    color: theme.blue,
    name: "PingFang SC",
  };
  const widths = [18, 12, 12, 14, 24, 44, 26, 12, 24, 20, 22, 42, 32];
  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, end, 1).format.columnWidth = width;
  });
  sheet.getRange(`A5:M${end}`).format.rowHeight = 48;
  sheet.freezePanes.freezeRows(4);
  sheet.freezePanes.freezeColumns(2);
}

// 精选评分
let curatedEnd;
{
  const sheet = sheets["精选评分"];
  addTitle(
    sheet,
    "A1:U1",
    "人工精审候选｜文化审美评分",
    "A2:U2",
    "蓝字为人工评分，绿色为公式文化分。女性感已提高为首要维度；硬筛不通过者总分归零。",
  );
  sheet.getRange("A4:U4").values = [[
    "序号",
    "硬筛",
    "姓名",
    "拼音",
    "声调",
    "等级",
    "篇目",
    "女性感",
    "出处",
    "家族",
    "稀有",
    "音律",
    "实用",
    "文化分",
    "原文",
    "取字方式",
    "家族说明",
    "风险",
    "民俗五行标签",
    "来源链接",
    "复核状态",
  ]];
  formatHeader(sheet.getRange("A4:U4"));
  const rows = curatedCandidates.map((item, index) => [
    index + 1,
    item.gate,
    item.name,
    item.pinyin,
    item.tones,
    item.grade,
    item.source,
    item.scores.feminine,
    item.scores.source,
    item.scores.family,
    item.scores.rarity,
    item.scores.phonology,
    item.scores.usability,
    null,
    item.quote,
    item.extraction,
    item.familyNote,
    item.risk,
    item.folkElements,
    item.url,
    item.gate === "通过" ? "已人工精审" : "已否决",
  ]);
  curatedEnd = 4 + rows.length;
  sheet.getRange(`A5:U${curatedEnd}`).values = rows;
  sheet.getRange("N5").formulas = [[
    `=IF(B5<>"通过",0,ROUND(H5*'评分与否决'!$B$5+I5*'评分与否决'!$B$6+J5*'评分与否决'!$B$7+K5*'评分与否决'!$B$8+L5*'评分与否决'!$B$9+M5*'评分与否决'!$B$10,1))`,
  ]];
  sheet.getRange(`N5:N${curatedEnd}`).fillDown();
  formatData(sheet.getRange(`A5:U${curatedEnd}`));
  sheet.getRange(`H5:M${curatedEnd}`).format = {
    font: { color: theme.blue, name: "PingFang SC" },
    horizontalAlignment: "center",
    numberFormat: "0.0",
  };
  sheet.getRange(`N5:N${curatedEnd}`).format = {
    fill: theme.pale,
    font: { bold: true, color: theme.green, name: "PingFang SC" },
    horizontalAlignment: "center",
    numberFormat: "0.0",
  };
  sheet.getRange(`C5:C${curatedEnd}`).format = {
    font: { bold: true, color: theme.ink, size: 12, name: "PingFang SC" },
    horizontalAlignment: "center",
    verticalAlignment: "center",
  };
  sheet.getRange(`B5:B${curatedEnd}`).conditionalFormats.add("containsText", {
    text: "不通过",
    format: {
      fill: theme.rose,
      font: { bold: true, color: theme.roseText },
    },
  });
  sheet.getRange(`N5:N${curatedEnd}`).conditionalFormats.add("colorScale", {
    colors: ["#F3D8D2", "#F8E9B8", "#CFE8D9"],
    thresholds: ["min", "50%", "max"],
  });
  const widths = [
    7, 11, 12, 17, 9, 9, 24, 9, 9, 9, 9, 9, 9, 11, 42, 25, 34, 40, 21, 42,
    16,
  ];
  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, curatedEnd, 1).format.columnWidth = width;
  });
  sheet.getRange(`A5:U${curatedEnd}`).format.rowHeight = 62;
  sheet.freezePanes.freezeRows(4);
  sheet.freezePanes.freezeColumns(3);
}

// 命理情景
{
  const sheet = sheets["命理情景"];
  addTitle(
    sheet,
    "A1:G1",
    "预产窗口命理情景矩阵",
    "A2:G2",
    "11天 × 12时辰 = 132个情景。该表只说明未知量规模，不提前计算喜用神，也不用于选择生产时辰。",
  );
  sheet.getRange("A4:G4").values = [[
    "情景ID",
    "公历日期",
    "时辰",
    "北京时间段",
    "年/月提示",
    "当前状态",
    "出生后复核",
  ]];
  formatHeader(sheet.getRange("A4:G4"));
  const rows = birthScenarios.map((item) => [
    item.id,
    item.date,
    item.hourBranch,
    item.timeRange,
    item.yearMonthNote,
    item.status,
    "实际出生后只保留对应日期与时段，并核对节气、城市和真太阳时。",
  ]);
  const end = 4 + rows.length;
  sheet.getRange(`A5:G${end}`).values = rows;
  formatData(sheet.getRange(`A5:G${end}`));
  const widths = [12, 14, 10, 18, 54, 30, 48];
  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, end, 1).format.columnWidth = width;
  });
  sheet.freezePanes.freezeRows(4);
}

// 出生后复排
let rerankEnd;
{
  const sheet = sheets["出生后复排"];
  addTitle(
    sheet,
    "A1:J1",
    "出生后命理复排｜文化分与命理分双轨",
    "A2:J2",
    "出生前命理权重自动为0。出生后由人工填写0–100命理适配分及依据，最终分按可见权重计算。",
  );
  sheet.getRange("A4:J4").values = [[
    "姓名",
    "文化分",
    "民俗五行标签",
    "命理适配分\n0–100",
    "命理依据/流派",
    "有效命理权重",
    "最终分",
    "状态",
    "排名",
    "风险摘要",
  ]];
  formatHeader(sheet.getRange("A4:J4"));
  rerankEnd = 4 + curatedCandidates.length;
  const rows = curatedCandidates.map((item) => [
    item.name,
    null,
    item.folkElements,
    null,
    null,
    null,
    null,
    null,
    null,
    item.risk,
  ]);
  sheet.getRange(`A5:J${rerankEnd}`).values = rows;
  sheet.getRange("B5").formulas = [["='精选评分'!N5"]];
  sheet.getRange(`B5:B${rerankEnd}`).fillDown();
  sheet.getRange("F5").formulas = [["='基础输入'!$B$21"]];
  sheet.getRange(`F5:F${rerankEnd}`).fillDown();
  sheet.getRange("G5").formulas = [
    ['=IF(B5=0,0,ROUND(B5*(1-F5)+IF(D5="",0,D5)*F5,1))'],
  ];
  sheet.getRange(`G5:G${rerankEnd}`).fillDown();
  sheet.getRange("H5").formulas = [[
    '=IF(\'基础输入\'!$B$6="未出生","待出生后录入",IF(D5="","待命理评分","已复排"))',
  ]];
  sheet.getRange(`H5:H${rerankEnd}`).fillDown();
  sheet.getRange("I5").formulas = [[
    `=IF(G5=0,"",1+COUNTIF($G$5:$G$${rerankEnd},">"&G5))`,
  ]];
  sheet.getRange(`I5:I${rerankEnd}`).fillDown();
  formatData(sheet.getRange(`A5:J${rerankEnd}`));
  sheet.getRange(`D5:E${rerankEnd}`).format.font = {
    color: theme.blue,
    name: "PingFang SC",
  };
  sheet.getRange(`B5:B${rerankEnd}`).format = {
    font: { color: theme.green, bold: true, name: "PingFang SC" },
    numberFormat: "0.0",
    horizontalAlignment: "center",
  };
  sheet.getRange(`F5:F${rerankEnd}`).format.numberFormat = "0%";
  sheet.getRange(`G5:G${rerankEnd}`).format = {
    fill: theme.pale,
    font: { color: theme.green, bold: true, name: "PingFang SC" },
    numberFormat: "0.0",
    horizontalAlignment: "center",
  };
  sheet.getRange(`D5:D${rerankEnd}`).dataValidation = {
    rule: {
      type: "decimal",
      operator: "between",
      formula1: 0,
      formula2: 100,
    },
  };
  const widths = [13, 12, 22, 14, 42, 15, 12, 19, 9, 42];
  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, rerankEnd, 1).format.columnWidth = width;
  });
  sheet.freezePanes.freezeRows(4);
  sheet.freezePanes.freezeColumns(2);
}

// 否决记录
{
  const sheet = sheets["否决记录"];
  addTitle(
    sheet,
    "A1:J1",
    "否决记录｜保留被淘汰姓名及原因",
    "A2:J2",
    "淘汰不是删除：保留证据可以避免未来重复踩坑，也能说明总分为什么不能覆盖硬性风险。",
  );
  sheet.getRange("A4:J4").values = [[
    "序号",
    "姓名",
    "触发类别",
    "篇目",
    "原文",
    "取字方式",
    "家族说明",
    "否决理由",
    "来源链接",
    "状态",
  ]];
  formatHeader(sheet.getRange("A4:J4"));
  const rows = rejectedCandidates.map((item, index) => [
    index + 1,
    item.name,
    item.risk.includes("墓葬")
      ? "原典语境"
      : item.risk.includes("近音")
        ? "口语谐音"
        : item.risk.includes("同名") || item.risk.includes("人物")
          ? "姓名碰撞"
          : "偏好冲突",
    item.source,
    item.quote,
    item.extraction,
    item.familyNote,
    item.risk,
    item.url,
    "不通过",
  ]);
  const end = 4 + rows.length;
  sheet.getRange(`A5:J${end}`).values = rows;
  formatData(sheet.getRange(`A5:J${end}`));
  sheet.getRange(`B5:B${end}`).format = {
    font: { bold: true, color: theme.roseText, name: "PingFang SC" },
    horizontalAlignment: "center",
  };
  sheet.getRange(`J5:J${end}`).format = {
    fill: theme.rose,
    font: { bold: true, color: theme.roseText, name: "PingFang SC" },
    horizontalAlignment: "center",
  };
  const widths = [7, 12, 16, 24, 42, 24, 30, 48, 42, 12];
  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, end, 1).format.columnWidth = width;
  });
  sheet.getRange(`A5:J${end}`).format.rowHeight = 68;
  sheet.freezePanes.freezeRows(4);
}

// 名字档案卡
{
  const sheet = sheets["名字档案卡"];
  addTitle(
    sheet,
    "A1:H1",
    "当前优先候选｜名字档案卡",
    "A2:H2",
    "当前是出生前文化排序；出生后命理模块只能调整顺序，不能挽救硬筛失败的名字。",
  );
  sheet.getRange("A4:H4").values = [[
    "姓名",
    "文化分",
    "出处",
    "原文与取法",
    "家族故事",
    "主要风险",
    "民俗五行标签",
    "来源链接",
  ]];
  formatHeader(sheet.getRange("A4:H4"));
  const rows = cardCandidates.map((item) => [
    item.name,
    null,
    item.source,
    `${item.quote}\n${item.extraction}（${item.grade}级）`,
    item.familyNote,
    item.risk,
    item.folkElements,
    item.url,
  ]);
  const end = 4 + rows.length;
  sheet.getRange(`A5:H${end}`).values = rows;
  for (let index = 0; index < cardCandidates.length; index += 1) {
    sheet.getRange(`B${5 + index}`).formulas = [[`='精选评分'!N${5 + index}`]];
  }
  formatData(sheet.getRange(`A5:H${end}`));
  sheet.getRange(`A5:A${end}`).format = {
    fill: theme.pale,
    font: { bold: true, color: theme.ink, size: 15, name: "PingFang SC" },
    horizontalAlignment: "center",
    verticalAlignment: "center",
  };
  sheet.getRange(`B5:B${end}`).format = {
    fill: theme.pale,
    font: { bold: true, color: theme.green, name: "PingFang SC" },
    numberFormat: "0.0",
    horizontalAlignment: "center",
    verticalAlignment: "center",
  };
  const widths = [14, 12, 26, 48, 36, 42, 24, 46];
  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, end, 1).format.columnWidth = width;
  });
  sheet.getRange(`A5:H${end}`).format.rowHeight = 86;
  sheet.freezePanes.freezeRows(4);
}

// 导航与结论（放在最后写公式，所有引用工作表已存在）
{
  const sheet = sheets["导航与结论"];
  addTitle(
    sheet,
    "A1:J1",
    "王姓女孩完整取名系统｜出生前版本",
    "A2:J2",
    "系统状态：出生前建库。先以女性感、古籍证据、家族故事和实际使用筛选；出生后再录入命理。",
  );
  sheet.getRange("A4:B4").merge();
  sheet.getRange("A4").values = [["字库规模"]];
  sheet.getRange("C4:D4").merge();
  sheet.getRange("C4").values = [["原始组合"]];
  sheet.getRange("E4:F4").merge();
  sheet.getRange("E4").values = [["典故候选"]];
  sheet.getRange("G4:H4").merge();
  sheet.getRange("G4").values = [["人工精审"]];
  sheet.getRange("I4:J4").merge();
  sheet.getRange("I4").values = [["硬筛通过"]];
  for (const address of ["A4:B4", "C4:D4", "E4:F4", "G4:H4", "I4:J4"]) {
    sheet.getRange(address).format = {
      fill: theme.gold,
      font: { bold: true, color: theme.white, name: "PingFang SC" },
      horizontalAlignment: "center",
      verticalAlignment: "center",
    };
  }
  for (const [range, formula] of [
    ["A5:B6", `=COUNTA('用字字典'!$B$5:$B$400)`],
    ["C5:D6", `=COUNTA('原始生成池'!$B$5:$B$30000)`],
    ["E5:F6", `=COUNTA('典故候选池'!$B$5:$B$2000)`],
    ["G5:H6", `=COUNTA('精选评分'!$C$5:$C$100)`],
    ["I5:J6", `=COUNTIF('精选评分'!$B$5:$B$100,"通过")`],
  ]) {
    sheet.getRange(range).merge();
    sheet.getRange(range.split(":")[0]).formulas = [[formula]];
    sheet.getRange(range).format = {
      fill: theme.paper,
      font: { bold: true, color: theme.ink, size: 20, name: "PingFang SC" },
      horizontalAlignment: "center",
      verticalAlignment: "center",
      borders: { preset: "outside", style: "thin", color: theme.line },
      numberFormat: "#,##0",
    };
  }

  sheet.getRange("A8:J8").merge();
  sheet.getRange("A8").values = [["当前状态与下一步"]];
  sheet.getRange("A8:J8").format = {
    fill: theme.ink2,
    font: { bold: true, color: theme.white, name: "PingFang SC" },
  };
  sheet.getRange("A9:C12").values = [
    ["项目", "当前值", "解释"],
    ["孩子状态", null, "未出生时不输出确定八字"],
    ["当前有效命理权重", null, "未出生时自动为0%"],
    ["下一步", "继续扩充、朗读和家庭筛选", "实际出生后补日期、时间和城市"],
  ];
  sheet.getRange("B10").formulas = [["='基础输入'!$B$6"]];
  sheet.getRange("B11").formulas = [["='基础输入'!$B$21"]];
  formatHeader(sheet.getRange("A9:C9"));
  formatData(sheet.getRange("A10:C12"));
  sheet.getRange("B11").format.numberFormat = "0%";
  sheet.getRange("B10:B12").format = {
    fill: theme.pale,
    font: { bold: true, color: theme.green, name: "PingFang SC" },
  };

  sheet.getRange("E9:J9").merge();
  sheet.getRange("E9").values = [["当前文化排序前三"]];
  sheet.getRange("E9:J9").format = {
    fill: theme.ink2,
    font: { bold: true, color: theme.white, name: "PingFang SC" },
    horizontalAlignment: "center",
  };
  const topRows = [5, 6, 7];
  topRows.forEach((sourceRow, index) => {
    const row = 10 + index;
    sheet.getRange(`E${row}:F${row}`).merge();
    sheet.getRange(`G${row}`).formulas = [[`='精选评分'!C${sourceRow}`]];
    sheet.getRange(`H${row}`).formulas = [[`='精选评分'!N${sourceRow}`]];
    sheet.getRange(`I${row}:J${row}`).merge();
    sheet.getRange(`E${row}`).values = [[`第${index + 1}位`]];
    sheet.getRange(`I${row}`).formulas = [[`='精选评分'!G${sourceRow}`]];
    sheet.getRange(`E${row}:J${row}`).format = {
      fill: index === 0 ? theme.pale2 : theme.paper,
      borders: { preset: "all", style: "thin", color: theme.line },
      font: { name: "PingFang SC" },
      verticalAlignment: "center",
      wrapText: true,
    };
    sheet.getRange(`G${row}`).format.font = {
      bold: true,
      color: theme.ink,
      size: 15,
      name: "PingFang SC",
    };
    sheet.getRange(`H${row}`).format = {
      font: { bold: true, color: theme.green, name: "PingFang SC" },
      numberFormat: "0.0",
      horizontalAlignment: "center",
    };
  });

  sheet.getRange("A15:J15").merge();
  sheet.getRange("A15").values = [["如何使用这套系统"]];
  sheet.getRange("A15:J15").format = {
    fill: theme.ink2,
    font: { bold: true, color: theme.white, name: "PingFang SC" },
  };
  sheet.getRange("A16:J21").values = [
    ["1", "基础输入", "确认家族线、偏好和预产窗口；出生前状态保持“未出生”。", "", "", "", "", "", "", ""],
    ["2", "原始生成池", "只用于扩大搜索空间；任何未核典组合都不能直接推荐。", "", "", "", "", "", "", ""],
    ["3", "典故候选池", "查看原文、取字等级和上下文，人工筛去语义牵强的组合。", "", "", "", "", "", "", ""],
    ["4", "精选评分", "比较女性感、出处、家族、稀有、音律和实用；硬筛失败者为0分。", "", "", "", "", "", "", ""],
    ["5", "名字档案卡", "朗读、手写并请家人分别评价，保留20–40个出生前候选。", "", "", "", "", "", "", ""],
    ["6", "出生后复排", "补实际日期、时间、城市与命理依据；命理默认只占15%。", "", "", "", "", "", "", ""],
  ];
  for (let row = 16; row <= 21; row += 1) sheet.getRange(`C${row}:J${row}`).merge();
  sheet.getRange("A16:J21").format = {
    borders: { preset: "all", style: "thin", color: theme.line },
    font: { name: "PingFang SC" },
    wrapText: true,
    verticalAlignment: "center",
  };
  sheet.getRange("A16:A21").format = {
    fill: theme.gold,
    font: { bold: true, color: theme.white, name: "PingFang SC" },
    horizontalAlignment: "center",
  };
  sheet.getRange("A1:J1").format.rowHeight = 36;
  sheet.getRange("A2:J2").format.rowHeight = 32;
  sheet.getRange("A4:J6").format.rowHeight = 30;
  sheet.getRange("A10:J12").format.rowHeight = 38;
  sheet.getRange("A16:J21").format.rowHeight = 38;
  sheet.getRange("A1:A21").format.columnWidth = 9;
  sheet.getRange("B1:B21").format.columnWidth = 17;
  sheet.getRange("C1:D21").format.columnWidth = 16;
  sheet.getRange("E1:F21").format.columnWidth = 12;
  sheet.getRange("G1:G21").format.columnWidth = 15;
  sheet.getRange("H1:H21").format.columnWidth = 11;
  sheet.getRange("I1:J21").format.columnWidth = 20;
  sheet.freezePanes.freezeRows(2);
}

// Keep workbook construction deterministic. Export is run again after presentation review.
await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

console.log(
  JSON.stringify(
    {
      outputPath,
      sheets: sheetNames.length,
      characters: characterDictionary.length,
      generationCharacters: generationCharacters.length,
      rawPool: rawPool.length,
      fragments: classicalFragments.length,
      allusionPool: allusionPool.length,
      curated: curatedCandidates.length,
      rejected: rejectedCandidates.length,
      birthScenarios: birthScenarios.length,
    },
    null,
    2,
  ),
);

