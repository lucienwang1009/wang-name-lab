import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const secretPattern = /\bsk-[A-Za-z0-9_-]{12,}\b/gu;
const bearerPattern = /Bearer\s+[^\s"']+/giu;

export function redactSecrets(value: string): string {
  return value
    .replace(secretPattern, "[REDACTED_DEEPSEEK_KEY]")
    .replace(bearerPattern, "Bearer [REDACTED]");
}

function sortedValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedValue);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortedValue(item)]),
  );
}

export function stableJson(value: unknown): string {
  return JSON.stringify(sortedValue(value));
}

export function createCacheKey(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export async function readJsonIfExists<T>(
  path: string,
  parse: (value: unknown) => T,
): Promise<T | undefined> {
  try {
    return parse(JSON.parse(await readFile(path, "utf8")) as unknown);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function atomicWriteJson<T>(
  path: string,
  value: unknown,
  validate: (value: unknown) => T,
): Promise<T> {
  const validated = validate(value);
  const content = `${JSON.stringify(validated, null, 2)}\n`;
  if (secretPattern.test(content) || /Bearer\s+/iu.test(content)) {
    secretPattern.lastIndex = 0;
    throw new Error("拒绝写入疑似凭据内容。");
  }
  secretPattern.lastIndex = 0;
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, content, { encoding: "utf8", mode: 0o600 });
    validate(JSON.parse(await readFile(temporary, "utf8")) as unknown);
    await rename(temporary, path);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
  return validated;
}

export class JsonFileCache {
  readonly #root: string;

  constructor(root: string) {
    this.#root = root;
  }

  pathFor(key: string): string {
    if (!/^[a-f0-9]{64}$/u.test(key)) throw new TypeError("缓存键必须是 SHA-256 十六进制值。");
    return join(this.#root, key.slice(0, 2), `${key}.json`);
  }

  async get<T>(key: string, parse: (value: unknown) => T): Promise<T | undefined> {
    return readJsonIfExists(this.pathFor(key), parse);
  }

  async set<T>(key: string, value: unknown, parse: (value: unknown) => T): Promise<T> {
    return atomicWriteJson(this.pathFor(key), value, parse);
  }
}

