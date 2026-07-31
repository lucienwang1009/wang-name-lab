import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [nodeMajor = 0, nodeMinor = 0] = process.versions.node
  .split(".")
  .map(Number);
if (nodeMajor < 22 || (nodeMajor === 22 && nodeMinor < 18)) {
  console.error(
    `Corpus fetch requires Node >=22.18; current runtime is ${process.versions.node}.`,
  );
  process.exit(1);
}

const { chinesePoetryFiles, chinesePoetryRevision } = await import(
  "../corpus/sources/chinese-poetry.ts"
);
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const vendorDirectory = resolve(
  scriptDirectory,
  "../corpus/vendor/chinese-poetry",
);
const allowedTargets = new Set(chinesePoetryFiles.map((file) => file.target));

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function validateRemoteUrl(value) {
  const url = new URL(value);
  const expectedPrefix = `/chinese-poetry/chinese-poetry/${chinesePoetryRevision}/`;
  if (
    url.protocol !== "https:" ||
    url.hostname !== "raw.githubusercontent.com" ||
    !decodeURIComponent(url.pathname).startsWith(expectedPrefix)
  ) {
    throw new Error(`Rejected corpus source URL: ${url.href}`);
  }
}

async function download(file, temporaryDirectory) {
  if (!allowedTargets.has(file.target) || file.target.includes("/")) {
    throw new Error(`Rejected corpus target: ${file.target}`);
  }
  validateRemoteUrl(file.url);
  const response = await fetch(file.url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Download failed for ${file.target}: HTTP ${response.status}`);
  }
  validateRemoteUrl(response.url);
  const bytes = Buffer.from(await response.arrayBuffer());
  const actualHash = sha256(bytes);
  if (actualHash !== file.sha256) {
    throw new Error(
      `Checksum mismatch for ${file.target}: expected ${file.sha256}, got ${actualHash}`,
    );
  }
  const temporaryPath = resolve(temporaryDirectory, file.target);
  await writeFile(temporaryPath, bytes);
  return temporaryPath;
}

await mkdir(vendorDirectory, { recursive: true });
const temporaryDirectory = await mkdtemp(resolve(vendorDirectory, ".fetch-"));

try {
  const temporaryFiles = await Promise.all(
    chinesePoetryFiles.map((file) => download(file, temporaryDirectory)),
  );
  for (let index = 0; index < chinesePoetryFiles.length; index += 1) {
    const file = chinesePoetryFiles[index];
    const temporaryPath = temporaryFiles[index];
    if (!file || !temporaryPath) throw new Error("Incomplete corpus fetch result.");
    await rename(temporaryPath, resolve(vendorDirectory, file.target));
  }

  for (const file of chinesePoetryFiles) {
    const bytes = await readFile(resolve(vendorDirectory, file.target));
    if (sha256(bytes) !== file.sha256) {
      throw new Error(`Post-write checksum mismatch for ${file.target}.`);
    }
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

console.log(
  `Corpus fetch: verified ${chinesePoetryFiles.length - 1} texts and upstream licence at ${chinesePoetryRevision.slice(0, 8)}.`,
);
