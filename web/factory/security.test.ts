// @vitest-environment node

import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: repositoryRoot, encoding: "utf8" });
}

describe("候选工厂凭据与部署边界", () => {
  it("Git 跟踪文件中不存在形似真实 DeepSeek Key 的值", async () => {
    const files = git(["ls-files", "-z"]).split("\0").filter(Boolean);
    const secretPattern = /\bsk-[A-Za-z0-9_-]{20,}\b/gu;
    const matches: string[] = [];
    for (const file of files) {
      const content = await readFile(new URL(`../../${file}`, import.meta.url), "utf8").catch(() => "");
      if (secretPattern.test(content)) matches.push(file);
      secretPattern.lastIndex = 0;
    }
    expect(matches).toEqual([]);
  });

  it("本地 Key、缓存、报告、检查点和预览文件都被 Git 排除", () => {
    const ignored = [
      "web/.env.local",
      "web/.factory-cache/request.json",
      "web/factory/reports/run/manifest.json",
      "web/factory/checkpoints/run.json",
      "web/public/data/generated-candidates.json",
    ];
    for (const path of ignored) {
      expect(() => git(["check-ignore", "-q", path])).not.toThrow();
    }
  });

  it("GitHub Pages 构建不调用候选工厂也不注入 DeepSeek 凭据", async () => {
    const workflow = await readFile(new URL("../../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");
    expect(workflow).toContain("pnpm --dir web build");
    expect(workflow).not.toMatch(/factory:(?:build|smoke)/u);
    expect(workflow).not.toContain("DEEPSEEK_API_KEY");
  });
});

