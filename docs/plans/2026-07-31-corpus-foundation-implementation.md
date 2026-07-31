# Corpus Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the audited catalogue, normalized corpus types, and deterministic validation report that later full-text indexing will consume.

**Architecture:** Keep the human-maintained target catalogue in TypeScript, validate it with pure functions, and generate static JSON artifacts for GitHub Pages. Treat planned books separately from ingestion-ready books so the public coverage count never implies that an unverified text is searchable.

**Tech Stack:** TypeScript 7, Vitest, Node.js 24, Vite 8, React 19.

---

### Task 1: Define the corpus contract and target catalogue

**Files:**
- Create: `web/src/corpus/types.ts`
- Create: `web/src/corpus/coreCatalogue.ts`
- Create: `web/src/corpus/coreCatalogue.test.ts`

**Step 1: Write the failing catalogue tests**

Test that the catalogue contains 50–100 unique books, every entry has a stable kebab-case ID, every entry has a category and priority, and only entries with verified source metadata may use `ready` status.

```ts
expect(coreCatalogue.length).toBeGreaterThanOrEqual(50);
expect(coreCatalogue.length).toBeLessThanOrEqual(100);
expect(new Set(coreCatalogue.map((book) => book.id)).size).toBe(coreCatalogue.length);
```

**Step 2: Run the test to verify it fails**

Run: `node_modules/.bin/vitest run src/corpus/coreCatalogue.test.ts`

Expected: FAIL because the catalogue modules do not exist.

**Step 3: Implement the minimal corpus contract and catalogue**

Define `CorpusBook`, `CorpusPassage`, `CorpusSource`, ingestion status, category, and priority. Add 50–100 naming-relevant core books as `planned`; do not invent source or licence metadata.

**Step 4: Run the test to verify it passes**

Run: `node_modules/.bin/vitest run src/corpus/coreCatalogue.test.ts`

Expected: PASS.

### Task 2: Build deterministic validation and reporting

**Files:**
- Create: `web/src/corpus/buildCorpus.ts`
- Create: `web/src/corpus/buildCorpus.test.ts`

**Step 1: Write failing validation tests**

Cover duplicate IDs, invalid IDs, missing titles, ready books without a source URL or rights note, duplicate passage IDs, missing parent books, empty normalized text, and aggregate counts.

```ts
const report = buildCorpusReport({ books, passages });
expect(report.blockingErrors).toContainEqual(
  expect.objectContaining({ code: "DUPLICATE_BOOK_ID" }),
);
```

**Step 2: Run the test to verify it fails**

Run: `node_modules/.bin/vitest run src/corpus/buildCorpus.test.ts`

Expected: FAIL because `buildCorpusReport` does not exist.

**Step 3: Implement the pure report builder**

Return a stable report containing schema version, catalogue counts, passage counts, blocking errors, warnings, category totals, and status totals. Sort all output deterministically. Planned books without source metadata are warnings, not blocking errors; ready books without verified metadata are blocking errors.

**Step 4: Run the test to verify it passes**

Run: `node_modules/.bin/vitest run src/corpus/buildCorpus.test.ts`

Expected: PASS.

### Task 3: Generate static catalogue and report artifacts

**Files:**
- Create: `web/scripts/build-corpus.mjs`
- Create: `web/src/corpus/passages.ts`
- Modify: `web/package.json`
- Generate: `web/public/corpus/catalog.json`
- Generate: `web/public/corpus/build-report.json`

**Step 1: Add a CLI smoke test through the package script**

Add `corpus:build` that runs the TypeScript-aware Node 24 build entry. The command must exit non-zero when the report contains blocking errors.

**Step 2: Implement the build wrapper**

The wrapper imports the TypeScript catalogue and report builder, writes formatted JSON, and prints a one-line summary. It creates only `public/corpus`; raw or third-party corpora do not belong in `public`.

**Step 3: Run the build**

Run: `node scripts/build-corpus.mjs`

Expected: exit 0, with 50–100 catalogue entries, zero ready books, zero passages, zero blocking errors, and explicit planned-source warnings.

**Step 4: Verify generated artifacts**

Run: `git diff --check`

Expected: no output. Inspect both JSON files and confirm sorted, deterministic content.

### Task 4: Integrate verification and document the handoff

**Files:**
- Modify: `web/package.json`
- Modify: `docs/plans/2026-07-31-classical-corpus-design.md`

**Step 1: Put corpus validation before production build**

Update `build` so a blocking corpus error prevents deployment.

**Step 2: Run full verification**

Run:

```bash
node node_modules/typescript/bin/tsc -b --pretty false
node node_modules/vitest/vitest.mjs run
node scripts/build-corpus.mjs
node node_modules/vite/bin/vite.js build
git diff --check
```

Expected: typecheck, all tests, corpus build, and production build pass.

**Step 3: Commit the foundation**

```bash
git add docs web/package.json web/public/corpus web/scripts web/src/corpus
git commit -m "feat: add audited classical corpus foundation"
```

