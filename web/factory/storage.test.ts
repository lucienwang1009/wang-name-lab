// @vitest-environment node

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { atomicWriteJson, createCacheKey, JsonFileCache, redactSecrets } from "./storage.ts";

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "wang-name-factory-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("候选工厂本地存储", () => {
  it("缓存键不依赖对象字段顺序且调用方无需传入 API Key", () => {
    expect(createCacheKey({ model: "deepseek-v4-flash", input: { b: 2, a: 1 } }))
      .toBe(createCacheKey({ input: { a: 1, b: 2 }, model: "deepseek-v4-flash" }));
  });

  it("写入缓存并按运行时解析器读取", async () => {
    const cache = new JsonFileCache(await temporaryDirectory());
    const key = createCacheKey({ hello: "world" });
    const parse = (value: unknown) => {
      if (typeof value !== "object" || value === null) throw new TypeError("invalid");
      return value as { ok: boolean };
    };
    await cache.set(key, { ok: true }, parse);
    await expect(cache.get(key, parse)).resolves.toEqual({ ok: true });
  });

  it("校验失败时保留上一个完整文件", async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, "approved.json");
    await writeFile(path, '{"version":1}\n', "utf8");
    await expect(atomicWriteJson(path, { version: 2 }, () => {
      throw new TypeError("bad artifact");
    })).rejects.toThrow(/bad artifact/);
    expect(await readFile(path, "utf8")).toBe('{"version":1}\n');
  });

  it("拒绝落盘疑似密钥并能清洗错误文字", async () => {
    const directory = await temporaryDirectory();
    const fakeSecret = `sk-${"a".repeat(24)}`;
    await expect(atomicWriteJson(join(directory, "bad.json"), { value: fakeSecret }, (value) => value))
      .rejects.toThrow(/疑似凭据/);
    expect(redactSecrets(`Authorization: Bearer ${fakeSecret}`)).not.toContain(fakeSecret);
  });
});

