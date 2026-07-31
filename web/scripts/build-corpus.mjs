import { mkdir, writeFile } from "node:fs/promises";
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

const [{ buildCorpusReport }, { coreCatalogue }, { corpusPassages }] =
  await Promise.all([
    import("../src/corpus/buildCorpus.ts"),
    import("../src/corpus/coreCatalogue.ts"),
    import("../src/corpus/passages.ts"),
  ]);

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputDirectory = resolve(scriptDirectory, "../public/corpus");
const sortedBooks = [...coreCatalogue].sort((left, right) =>
  left.id.localeCompare(right.id),
);
const sortedPassages = [...corpusPassages].sort((left, right) =>
  left.id.localeCompare(right.id),
);
const report = buildCorpusReport({ books: sortedBooks, passages: sortedPassages });
const catalogue = {
  schemaVersion: 1,
  scope: "核心古籍全文库第一版目标书目",
  coverageCaveat: "planned 书目尚未进入全文检索；只有 ready 书目计入实际覆盖。",
  books: sortedBooks,
};

async function writeJson(filename, value) {
  await writeFile(
    resolve(outputDirectory, filename),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeJson("catalog.json", catalogue),
  writeJson("build-report.json", report),
]);

const { catalogue: counts } = report;
console.log(
  `Corpus build: ${counts.totalBooks} books (${counts.byStatus.ready} ready), ` +
    `${counts.totalPassages} passages, ${report.blockingErrors.length} blocking errors, ` +
    `${report.warnings.length} warnings.`,
);

if (report.blockingErrors.length > 0) process.exitCode = 1;
