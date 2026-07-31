import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
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

const [
  { chinesePoetryFiles, chinesePoetryRevision },
  { earlyChineseFiles, earlyChineseRevision },
  { kanripoFiles, kanripoDirectSeries, kanripoRevisions },
] = await Promise.all([
  import("../corpus/sources/chinese-poetry.ts"),
  import("../corpus/sources/early-chinese.ts"),
  import("../corpus/sources/kanripo.ts"),
]);

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const vendorRoot = resolve(scriptDirectory, "../corpus/vendor");
const lockPath = resolve(vendorRoot, "source-lock.json");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function rawUrl(owner, repository, revision, path) {
  return `https://raw.githubusercontent.com/${owner}/${repository}/${revision}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

const downloads = [
  ...chinesePoetryFiles.map((file) => ({
    key: `chinese-poetry/${file.target}`,
    target: resolve(vendorRoot, "chinese-poetry", file.target),
    url: file.url,
    expectedHash: file.sha256,
  })),
  ...earlyChineseFiles.map((file) => ({
    key: `early-chinese/${file.target}`,
    target: resolve(vendorRoot, "early-chinese", file.target),
    url: file.url,
  })),
  ...kanripoFiles.map((file) => ({
    key: `kanripo/${file.target}`,
    target: resolve(vendorRoot, "kanripo", file.target),
    url: file.url,
  })),
  {
    key: "licenses/CC-BY-SA-4.0.txt",
    target: resolve(vendorRoot, "licenses", "CC-BY-SA-4.0.txt"),
    url: rawUrl(
      "direct-phonology",
      "ect-krp",
      earlyChineseRevision,
      "LICENSE",
    ),
  },
].sort((left, right) => compareText(left.key, right.key));

function validatePinnedRawUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "raw.githubusercontent.com") {
    throw new Error(`Rejected corpus source URL: ${url.href}`);
  }
  const decodedPath = decodeURIComponent(url.pathname);
  const allowedPrefixes = [
    `/chinese-poetry/chinese-poetry/${chinesePoetryRevision}/`,
    `/direct-phonology/ect-krp/${earlyChineseRevision}/`,
    ...Object.entries(kanripoRevisions).map(
      ([collection, revision]) => `/kr-shadow/${collection}/${revision}/`,
    ),
    `/${kanripoDirectSeries.repository}/${kanripoDirectSeries.revision}/`,
  ];
  if (!allowedPrefixes.some((prefix) => decodedPath.startsWith(prefix))) {
    throw new Error(`Corpus source is not pinned to an approved revision: ${url.href}`);
  }
}

async function fetchBytes(url) {
  validatePinnedRawUrl(url);
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "WangNameLab/0.1 corpus-build" },
  });
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status} ${url}`);
  validatePinnedRawUrl(response.url);
  return Buffer.from(await response.arrayBuffer());
}

async function loadExistingLock() {
  try {
    const parsed = JSON.parse(await readFile(lockPath, "utf8"));
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.files)) {
      throw new TypeError("invalid lock schema");
    }
    return new Map(parsed.files.map((file) => [file.key, file]));
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return new Map();
    throw new Error("Existing corpus source lock is invalid.", { cause: error });
  }
}

async function buildDirectSeries() {
  const { repository, revision, textId } = kanripoDirectSeries;
  const treeUrl = `https://api.github.com/repos/${repository}/git/trees/${revision}?recursive=1`;
  const response = await fetch(treeUrl, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "WangNameLab/0.1 corpus-build",
    },
  });
  if (!response.ok) {
    throw new Error(`Kanripo series tree failed: HTTP ${response.status}`);
  }
  const tree = await response.json();
  const paths = (tree.tree ?? [])
    .filter(
      (entry) =>
        entry.type === "blob" &&
        new RegExp(`^${textId}_[0-9]+\\.txt$`, "u").test(entry.path),
    )
    .map((entry) => entry.path)
    .sort(compareText);
  if (paths.length === 0) throw new Error(`${textId} did not expose any source volumes.`);
  const parts = [];
  for (const path of paths) {
    const url = rawUrl(...repository.split("/"), revision, path);
    const bytes = await fetchBytes(url);
    parts.push(`\n** ${path}\n${bytes.toString("utf8")}\n`);
  }
  return {
    key: `kanripo/${kanripoDirectSeries.target}`,
    target: resolve(vendorRoot, "kanripo", kanripoDirectSeries.target),
    url: `https://github.com/${repository}/tree/${revision}`,
    bytes: Buffer.from(parts.join(""), "utf8"),
    parts: paths.length,
  };
}

const existingLock = await loadExistingLock();
const temporaryDirectory = await mkdtemp(resolve(vendorRoot, ".fetch-"));
const lockedFiles = [];

try {
  const directSeries = await buildDirectSeries();
  const resolvedDownloads = [
    ...downloads,
    directSeries,
  ].sort((left, right) => compareText(left.key, right.key));

  for (const file of resolvedDownloads) {
    const bytes = file.bytes ?? (await fetchBytes(file.url));
    const actualHash = sha256(bytes);
    const locked = existingLock.get(file.key);
    const expectedHash = file.expectedHash ?? locked?.sha256;
    if (expectedHash && actualHash !== expectedHash) {
      throw new Error(
        `Checksum mismatch for ${file.key}: expected ${expectedHash}, got ${actualHash}`,
      );
    }
    const temporaryPath = resolve(temporaryDirectory, encodeURIComponent(file.key));
    await writeFile(temporaryPath, bytes);
    await mkdir(dirname(file.target), { recursive: true });
    await rename(temporaryPath, file.target);
    lockedFiles.push({
      key: file.key,
      url: file.url,
      sha256: actualHash,
      bytes: bytes.byteLength,
      ...(file.parts ? { parts: file.parts } : {}),
    });
  }

  const lock = {
    schemaVersion: 1,
    generatedAt: "2026-07-31",
    files: lockedFiles,
  };
  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

console.log(
  `Corpus fetch: verified ${lockedFiles.length} pinned artifacts across three open sources.`,
);
