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
  { buildCorpusIndex },
  { chinesePoetryFiles, chinesePoetryRevision },
] =
  await Promise.all([
    import("../src/corpus/buildCorpus.ts"),
    import("../src/corpus/coreCatalogue.ts"),
    import("../src/corpus/importers/chinesePoetry.ts"),
    import("../src/corpus/buildIndex.ts"),
    import("../corpus/sources/chinese-poetry.ts"),
  ]);

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputDirectory = resolve(scriptDirectory, "../public/corpus");
const vendorDirectory = resolve(
  scriptDirectory,
  "../corpus/vendor/chinese-poetry",
);
const indexDirectory = resolve(outputDirectory, "index");
const textDirectory = resolve(outputDirectory, "texts");
const maximumFileBytes = 1024 * 1024;

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function loadPinnedSource(file) {
  if (!file.bookId || !file.verificationUrl) return undefined;
  const bytes = await readFile(resolve(vendorDirectory, file.target));
  const actualHash = sha256(bytes);
  if (actualHash !== file.sha256) {
    throw new Error(
      `${file.target} 校验失败：期望 ${file.sha256}，实际 ${actualHash}。`,
    );
  }

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

const sortedBooks = [...coreCatalogue].sort((left, right) =>
  compareText(left.id, right.id),
);
const sourceFiles = chinesePoetryFiles
  .filter((file) => file.bookId)
  .sort((left, right) => compareText(left.bookId, right.bookId));
const importedGroups = await Promise.all(sourceFiles.map(loadPinnedSource));
const sortedPassages = importedGroups
  .flatMap((group) => group ?? [])
  .sort(
    (left, right) =>
      compareText(left.bookId, right.bookId) ||
      left.order - right.order ||
      compareText(left.id, right.id),
  );
const report = buildCorpusReport({ books: sortedBooks, passages: sortedPassages });

if (report.blockingErrors.length > 0) {
  for (const error of report.blockingErrors) {
    console.error(`[${error.code}] ${error.targetId ?? "corpus"}: ${error.message}`);
  }
  throw new Error("语料构建门禁失败；未发布任何新生成文件。");
}

const indexBuild = buildCorpusIndex(sortedPassages);
const catalogue = {
  schemaVersion: 1,
  buildVersion: chinesePoetryRevision,
  scope: "核心古籍全文库第一版目标书目",
  coverageCaveat: "planned 书目尚未进入全文检索；只有 ready 书目计入实际覆盖。",
  indexBuckets: Object.keys(indexBuild.buckets),
  books: sortedBooks,
};
const artifacts = [
  {
    relativePath: "catalog.json",
    content: `${JSON.stringify(catalogue, null, 2)}\n`,
  },
  {
    relativePath: "build-report.json",
    content: `${JSON.stringify(report, null, 2)}\n`,
  },
  {
    relativePath: "aliases.json",
    content: `${JSON.stringify({ schemaVersion: 1, aliases: indexBuild.aliases })}\n`,
  },
  ...Object.entries(indexBuild.textShards).map(([bookId, shard]) => ({
    relativePath: `texts/${bookId}.json`,
    content: `${JSON.stringify(shard)}\n`,
  })),
  ...Object.entries(indexBuild.buckets).map(([bucket, index]) => ({
    relativePath: `index/${bucket}.json`,
    content: `${JSON.stringify(index)}\n`,
  })),
].sort((left, right) => compareText(left.relativePath, right.relativePath));

for (const artifact of artifacts) {
  const byteLength = Buffer.byteLength(artifact.content, "utf8");
  if (byteLength > maximumFileBytes) {
    throw new Error(
      `${artifact.relativePath} 为 ${byteLength} 字节，超过 1 MiB 构建预算。`,
    );
  }
}

await Promise.all([
  rm(indexDirectory, { recursive: true, force: true }),
  rm(textDirectory, { recursive: true, force: true }),
]);
await Promise.all([
  mkdir(indexDirectory, { recursive: true }),
  mkdir(textDirectory, { recursive: true }),
]);
await Promise.all(
  artifacts.map((artifact) =>
    writeFile(
      resolve(outputDirectory, artifact.relativePath),
      artifact.content,
      "utf8",
    ),
  ),
);

const { catalogue: counts } = report;
console.log(
  `Corpus build: ${counts.totalBooks} books (${counts.byStatus.ready} ready), ` +
    `${counts.totalPassages} passages, ${report.blockingErrors.length} blocking errors, ` +
    `${report.warnings.length} warnings, ${artifacts.length} static files.`,
);
