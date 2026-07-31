import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [nodeMajor = 0, nodeMinor = 0] = process.versions.node
  .split(".")
  .map(Number);
if (nodeMajor < 22 || (nodeMajor === 22 && nodeMinor < 18)) {
  console.error(
    `Corpus build requires Node >=22.18; current runtime is ${process.versions.node}.`,
  );
  process.exit(1);
}

const [
  { buildCorpusReport },
  { coreCatalogue },
  { ingestChinesePoetry },
  { ingestEarlyChinese },
  { ingestKanripo },
  { buildCorpusIndex },
  { chinesePoetryFiles },
  { earlyChineseFiles },
  { kanripoFiles, kanripoDirectSeries },
] = await Promise.all([
  import("../src/corpus/buildCorpus.ts"),
  import("../src/corpus/coreCatalogue.ts"),
  import("../src/corpus/importers/chinesePoetry.ts"),
  import("../src/corpus/importers/earlyChinese.ts"),
  import("../src/corpus/importers/kanripo.ts"),
  import("../src/corpus/buildIndex.ts"),
  import("../corpus/sources/chinese-poetry.ts"),
  import("../corpus/sources/early-chinese.ts"),
  import("../corpus/sources/kanripo.ts"),
]);

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputDirectory = resolve(scriptDirectory, "../public/corpus");
const vendorRoot = resolve(scriptDirectory, "../corpus/vendor");
const indexDirectory = resolve(outputDirectory, "index");
const textDirectory = resolve(outputDirectory, "texts");
const maximumFileBytes = 1024 * 1024;

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const sourceLock = JSON.parse(
  await readFile(resolve(vendorRoot, "source-lock.json"), "utf8"),
);
if (sourceLock.schemaVersion !== 1 || !Array.isArray(sourceLock.files)) {
  throw new TypeError("Corpus source lock is invalid; run corpus:fetch.");
}
const lockedByKey = new Map(sourceLock.files.map((file) => [file.key, file]));

async function readLockedSource(key) {
  const lock = lockedByKey.get(key);
  if (!lock || typeof lock.sha256 !== "string") {
    throw new Error(`Corpus source lock is missing ${key}; run corpus:fetch.`);
  }
  const bytes = await readFile(resolve(vendorRoot, key));
  const actual = sha256(bytes);
  if (actual !== lock.sha256) {
    throw new Error(`${key} 校验失败：期望 ${lock.sha256}，实际 ${actual}。`);
  }
  return bytes;
}

async function loadChinesePoetry(file) {
  if (!file.bookId || !file.verificationUrl) return [];
  const bytes = await readLockedSource(`chinese-poetry/${file.target}`);
  let raw;
  try {
    raw = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`${file.target} 不是合法 JSON。`, { cause: error });
  }
  return ingestChinesePoetry({
    bookId: file.bookId,
    raw,
    sourceUrl: file.url,
    verificationUrl: file.verificationUrl,
  });
}

async function loadEarlyChinese(file) {
  const bytes = await readLockedSource(`early-chinese/${file.target}`);
  return ingestEarlyChinese({
    bookId: file.bookId,
    raw: bytes.toString("utf8"),
    sourceUrl: file.url,
    verificationUrl: file.verificationUrl,
  });
}

async function loadKanripo(file) {
  const bytes = await readLockedSource(`kanripo/${file.target}`);
  return ingestKanripo({
    bookId: file.bookId,
    textId: file.textId,
    raw: bytes.toString("utf8"),
    sourceUrl: file.url,
    verificationUrl: file.verificationUrl,
    sectionFilter: file.sectionFilter,
  });
}

async function loadDirectSeries() {
  const bytes = await readLockedSource(`kanripo/${kanripoDirectSeries.target}`);
  return ingestKanripo({
    bookId: kanripoDirectSeries.bookId,
    textId: kanripoDirectSeries.textId,
    raw: bytes.toString("utf8"),
    sourceUrl: `https://github.com/${kanripoDirectSeries.repository}/tree/${kanripoDirectSeries.revision}`,
    verificationUrl: kanripoDirectSeries.verificationUrl,
  });
}

const importedGroups = await Promise.all([
  ...chinesePoetryFiles.filter((file) => file.bookId).map(loadChinesePoetry),
  ...earlyChineseFiles.map(loadEarlyChinese),
  ...kanripoFiles.map(loadKanripo),
  loadDirectSeries(),
]);
const sortedBooks = [...coreCatalogue].sort((left, right) =>
  compareText(left.id, right.id),
);
const sortedPassages = importedGroups.flat().sort(
  (left, right) =>
    compareText(left.bookId, right.bookId) ||
    left.order - right.order ||
    compareText(left.id, right.id),
);
const report = buildCorpusReport({ books: sortedBooks, passages: sortedPassages });

console.log(
  `Corpus import: ${report.catalogue.totalPassages} passages, ` +
    `${report.catalogue.totalCharacters} searchable characters.`,
);

if (report.blockingErrors.length > 0) {
  for (const error of report.blockingErrors) {
    console.error(`[${error.code}] ${error.targetId ?? "corpus"}: ${error.message}`);
  }
  throw new Error("语料构建门禁失败；未发布任何新生成文件。");
}

const indexBuild = buildCorpusIndex(sortedPassages);
const buildVersion = sha256(
  JSON.stringify(
    sourceLock.files.map(({ key, sha256: checksum }) => [key, checksum]),
  ),
);
const catalogue = {
  schemaVersion: 2,
  buildVersion,
  scope: "取名相关核心古籍 70 部全文检索库",
  coverageCaveat:
    "已接入目标清单 70 部；机器转录、古注与本站检索分段不等同于现代权威校勘本，重要引文须沿固定来源或公版页面复核。",
  characterIndex: indexBuild.indexPathsByCharacter,
  textShards: indexBuild.textShardPaths,
  textShardsByBook: indexBuild.textShardPathsByBook,
  books: sortedBooks,
};
const attribution = {
  schemaVersion: 1,
  corpusLicense: "CC-BY-SA-4.0",
  notice:
    "古籍原作属于公有领域；本语料所含 ECT-KRP 与 Kanripo 数字整理成果及衍生索引按 CC BY-SA 4.0 提供。chinese-poetry 数据依其 MIT 许可使用。",
  sourceLock: sourceLock.files,
};
const licenseText = await readLockedSource("licenses/CC-BY-SA-4.0.txt");
const metadataArtifacts = [
  { relativePath: "catalog.json", content: `${JSON.stringify(catalogue)}\n` },
  { relativePath: "build-report.json", content: `${JSON.stringify(report, null, 2)}\n` },
  { relativePath: "attribution.json", content: `${JSON.stringify(attribution, null, 2)}\n` },
  { relativePath: "LICENSE-CC-BY-SA-4.0.txt", content: licenseText.toString("utf8") },
  {
    relativePath: "aliases.json",
    content: `${JSON.stringify({ schemaVersion: 1, aliases: indexBuild.aliases })}\n`,
  },
].sort((left, right) => compareText(left.relativePath, right.relativePath));

function assertWithinBudget(relativePath, content) {
  const byteLength = Buffer.byteLength(content, "utf8");
  if (byteLength > maximumFileBytes) {
    throw new Error(
      `${relativePath} 为 ${byteLength} 字节，超过 1 MiB 构建预算。`,
    );
  }
}

for (const artifact of metadataArtifacts) {
  assertWithinBudget(artifact.relativePath, artifact.content);
}
for (const [path, shard] of Object.entries(indexBuild.textShards)) {
  assertWithinBudget(`texts/${path}`, `${JSON.stringify(shard)}\n`);
}
for (const [path, index] of Object.entries(indexBuild.indexShards)) {
  assertWithinBudget(`index/${path}`, `${JSON.stringify(index)}\n`);
}

await Promise.all([
  rm(indexDirectory, { recursive: true, force: true }),
  rm(textDirectory, { recursive: true, force: true }),
]);
await Promise.all([
  mkdir(indexDirectory, { recursive: true }),
  mkdir(textDirectory, { recursive: true }),
]);
let artifactCount = 0;
async function writeArtifact(relativePath, content) {
  const path = resolve(outputDirectory, relativePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
  artifactCount += 1;
}

await Promise.all(
  metadataArtifacts.map((artifact) =>
    writeArtifact(artifact.relativePath, artifact.content),
  ),
);
for (const path of Object.keys(indexBuild.textShards).sort(compareText)) {
  const shard = indexBuild.textShards[path];
  await writeArtifact(`texts/${path}`, `${JSON.stringify(shard)}\n`);
  delete indexBuild.textShards[path];
}
for (const path of Object.keys(indexBuild.indexShards).sort(compareText)) {
  const index = indexBuild.indexShards[path];
  await writeArtifact(`index/${path}`, `${JSON.stringify(index)}\n`);
  delete indexBuild.indexShards[path];
}

const { catalogue: counts } = report;
console.log(
  `Corpus build: ${counts.totalBooks} books (${counts.byStatus.ready} ready), ` +
    `${counts.totalPassages} passages, ${report.blockingErrors.length} blocking errors, ` +
    `${report.warnings.length} warnings, ${artifactCount} static files.`,
);
