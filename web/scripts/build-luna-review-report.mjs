import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDirectory, "..");
const archivePath = path.join(webRoot, "factory/history/luna-20260828-review-history.json");
const outputPath = path.join(webRoot, "factory/history/luna-20260828-detailed-report.md");
const archive = JSON.parse(fs.readFileSync(archivePath, "utf8"));
const catalogue = JSON.parse(fs.readFileSync(path.join(webRoot, "public/corpus/catalog.json"), "utf8"));
const books = new Map(catalogue.books.map((book) => [book.id, book]));

const statusLabels = {
  published: "已发布",
  deferred: "暂缓",
  rejected: "当前拒绝",
};
const batchLabels = {
  "initial-source-scan": "首轮来源扫描",
  "initial-shortlist": "首轮姓名短名单",
  "recomposed-v1": "同段重组第一轮",
  "recomposed-v2": "同段重组第二轮",
  layered: "分层扩展",
  bidirectional: "双向检索",
  classics: "经史子专向",
  independent: "独立盲选",
  family: "家族线索弱关联",
  poetry: "诗赋词专向",
};
const relationLabels = {
  "exact-phrase": "原文连续取字",
  exact: "原文连续取字",
  "clause-related": "同句关联取字",
  "passage-related": "同段关联取字",
  recomposition: "透明重组",
};

const passageCache = new Map();
function passageFor(record) {
  const candidate = record.candidate;
  const passageId = candidate.passageId
    ?? candidate.evidence?.passageId
    ?? candidate.sources?.[0]?.passageId;
  if (!passageId) return {};
  if (passageCache.has(passageId)) return passageCache.get(passageId);
  const bookId = passageId.split("/")[0];
  const directory = path.join(webRoot, "public/corpus/texts", bookId);
  if (!fs.existsSync(directory)) return { passageId, bookId };
  for (const filename of fs.readdirSync(directory).sort()) {
    const shard = JSON.parse(fs.readFileSync(path.join(directory, filename), "utf8"));
    const passage = shard.passages.find((entry) => entry.id === passageId);
    if (passage) {
      const result = {
        ...passage,
        passageId,
        bookId,
        bookTitle: books.get(bookId)?.title ?? candidate.bookTitle ?? candidate.evidence?.bookTitle ?? bookId,
        sourceUrl: shard.sourceUrl,
        verificationUrl: shard.verificationUrl,
      };
      passageCache.set(passageId, result);
      return result;
    }
  }
  return { passageId, bookId };
}

function clean(value) {
  return typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";
}

function blockquote(value) {
  const text = clean(value);
  return text ? text.split("\n").map((line) => `> ${line}`).join("\n") : "> 未提供摘录。";
}

function listText(values) {
  return values.map(clean).filter(Boolean).join("；");
}

function normalizedDetail(record) {
  const candidate = record.candidate;
  const canonical = passageFor(record);
  const evidence = candidate.evidence ?? {};
  const pinyin = candidate.phonology?.pinyin
    ?? (candidate.pinyin ? (candidate.pinyin.startsWith("wáng ") ? candidate.pinyin : `wáng ${candidate.pinyin}`) : "未记录");
  const tones = candidate.phonology?.tones
    ?? (candidate.tones ? (candidate.tones.split("-").length === 3 ? candidate.tones : `2-${candidate.tones}`) : "未记录");
  const sourceExcerpt = candidate.sourceExcerpt
    ?? candidate.quote
    ?? candidate.excerpt
    ?? evidence.localExcerpt
    ?? candidate.originalText
    ?? canonical.text;
  const relation = candidate.takingRelation
    ?? candidate.recomposition?.explanation
    ?? evidence.recompositionExplanation
    ?? relationLabels[candidate.relation]
    ?? relationLabels[evidence.relation]
    ?? "未单独标注";
  const grammar = evidence.actualGrammar ?? candidate.grammarMeaning ?? "见原文与取字说明";
  const meaning = candidate.meaning
    ?? candidate.recompositionMeaning
    ?? evidence.recompositionExplanation
    ?? candidate.recomposition?.explanation
    ?? "代理未单独给出释义。";
  const nameFeel = candidate.nameFeelConclusion
    ?? candidate.adultNameFeel
    ?? candidate.naturalNameConclusion
    ?? candidate.femininityConclusion
    ?? "代理未单独给出姓名感结论。";
  const risks = [
    ...(candidate.usabilityRisks ?? []),
    candidate.risk,
    ...(candidate.adversarialReview?.materialIssues ?? []),
    candidate.adversarialReview?.critique,
  ];
  const sources = candidate.sources
    ?? evidence.occurrence?.map(({ matchedChar, occurrence }) => ({ character: matchedChar, occurrence }));
  const sourcePositions = Array.isArray(sources)
    ? sources.map((source) => `${source.character ?? source.matchedChar}（第 ${source.occurrence + 1} 次）`).join("、")
    : "未单独记录";
  return {
    canonical,
    pinyin,
    tones,
    sourceExcerpt,
    relation,
    grammar,
    meaning,
    nameFeel,
    risks: listText(risks) || "无额外风险说明。",
    sourcePositions,
  };
}

const statusOrder = new Map([["published", 0], ["deferred", 1], ["rejected", 2]]);
const records = [...archive.records].sort((left, right) =>
  statusOrder.get(left.mainReview.status) - statusOrder.get(right.mainReview.status)
  || left.batchId.localeCompare(right.batchId, "zh-CN")
  || left.givenName.localeCompare(right.givenName, "zh-CN")
);

const lines = [
  "# Luna 候选完整审阅档案",
  "",
  `生成日期：${archive.createdAt}`,
  "",
  `本档案共收录 **${archive.summary.uniqueNameCount} 个不同名字**：**${archive.summary.statusCounts.published} 个已发布**、**${archive.summary.statusCounts.deferred} 个暂缓**、**${archive.summary.statusCounts.rejected} 个当前拒绝**。状态表达当前主审结论，不代表物理删除；所有候选都保留用于以后优化提示词、过滤规则和偏好模型。`,
  "",
  "## 状态说明",
  "",
  "- **已发布**：进入当前个性推荐池。",
  "- **暂缓**：有明确价值，但存在一项需要偏好确认或进一步核查的问题。",
  "- **当前拒绝**：不进入当前推荐池，作为负例保留；规则或偏好变化后仍可重审。",
  "",
  "## 名单总览",
  "",
];

for (const status of ["published", "deferred", "rejected"]) {
  const names = records.filter((record) => record.mainReview.status === status).map((record) => `王${record.givenName}`);
  lines.push(`### ${statusLabels[status]}（${names.length}）`, "", names.join("、"), "");
}

lines.push("## 逐名详细记录", "");
records.forEach((record, index) => {
  const detail = normalizedDetail(record);
  const candidate = record.candidate;
  const canonical = detail.canonical;
  const workTitle = canonical.workTitle ?? candidate.workTitle ?? candidate.evidence?.workTitle ?? "篇名未整理";
  const chapterTitle = canonical.chapterTitle ?? candidate.chapterTitle ?? candidate.evidence?.chapterTitle ?? "章节未整理";
  const sourceLabel = [canonical.bookTitle ?? candidate.bookTitle ?? candidate.evidence?.bookTitle, workTitle, chapterTitle]
    .filter(Boolean)
    .join(" · ");
  lines.push(
    `### ${index + 1}. 王${record.givenName}`,
    "",
    `- **状态**：${statusLabels[record.mainReview.status]}`,
    `- **生成批次**：${batchLabels[record.batchId] ?? record.batchId}`,
    `- **出处**：${sourceLabel || "书目信息未整理"}`,
    `- **段落 ID**：\`${canonical.passageId ?? candidate.passageId ?? candidate.evidence?.passageId ?? "未记录"}\``,
    `- **取字位置**：${detail.sourcePositions}`,
    `- **取字关系**：${clean(detail.relation)}`,
    `- **原句语法**：${clean(detail.grammar)}`,
    `- **读音**：${clean(detail.pinyin)}；声调 ${clean(detail.tones)}`,
    `- **代理释义**：${clean(detail.meaning)}`,
    `- **姓名感判断**：${clean(detail.nameFeel)}`,
    `- **代理风险**：${clean(detail.risks)}`,
    `- **主审结论**：${clean(record.mainReview.reason)}`,
    "",
    "**原文摘录**",
    "",
    blockquote(detail.sourceExcerpt),
    "",
  );
  if (canonical.sourceUrl || canonical.verificationUrl) {
    const links = [];
    if (canonical.sourceUrl) links.push(`[固定数据源](${canonical.sourceUrl})`);
    if (canonical.verificationUrl) links.push(`[公版复核](${canonical.verificationUrl})`);
    lines.push(`来源链接：${links.join(" · ")}`, "");
  }
});

fs.writeFileSync(outputPath, `${lines.join("\n").trimEnd()}\n`);
console.log(JSON.stringify({ outputPath, records: records.length, bytes: fs.statSync(outputPath).size }));
