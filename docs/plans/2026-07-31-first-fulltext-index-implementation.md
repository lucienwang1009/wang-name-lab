# First Full-Text Corpus and Index Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Import five licensed classical Chinese full texts, generate compact static character-index shards, and make name evidence search read the full-text corpus in the browser.

**Architecture:** Vendor five JSON files from one pinned MIT-licensed source revision and verify every download by SHA-256. Transform the heterogeneous source formats into sentence-level `CorpusPassage` records, normalize search text to Simplified Chinese with OpenCC while preserving display text, then emit book text shards and Unicode-bucketed character postings for GitHub Pages.

**Tech Stack:** TypeScript 7, Node.js 24, OpenCC-JS 1.4.1, Vitest, React 19, Vite 8.

---

## Source decision

The Chinese Text Project remains a manual verification destination only: its official FAQ prohibits automated bulk downloading and republication without permission. The machine source for this phase is `chinese-poetry/chinese-poetry`, pinned to commit `b8594f81a89752241442f2ce267d6f66f96704ee`, whose repository declares the MIT licence.

First batch:

- 《诗经》: `诗经/shijing.json`
- 《楚辞》: `楚辞/chuci.json`
- 《论语》: `论语/lunyu.json`
- 《孟子》: `四书五经/mengzi.json`
- 《大学》: `四书五经/daxue.json`

All result cards must retain a pinned machine-source link and a separate public-domain verification link. The repository transcription is not presented as a critical scholarly edition.

### Task 1: Pin, verify, and vendor the five source files

**Files:**
- Create: `web/corpus/sources/chinese-poetry.ts`
- Create: `web/scripts/fetch-corpus.mjs`
- Create: `web/corpus/vendor/chinese-poetry/LICENSE`
- Create: `web/corpus/vendor/chinese-poetry/*.json`
- Create: `web/THIRD_PARTY_NOTICES.md`
- Modify: `web/package.json`

**Step 1: Define immutable source records**

Each record includes book ID, pinned raw URL, SHA-256, repository revision, rights note, edition caveat, and Wikisource verification URL. Never use a moving `master` URL.

**Step 2: Implement the fetcher**

Download to a temporary file, verify SHA-256, and replace the explicit vendor target only on success. Reject redirects outside `raw.githubusercontent.com` and reject unknown target paths.

**Step 3: Fetch and verify all six files**

Run: `node scripts/fetch-corpus.mjs`

Expected: five JSON files and the upstream MIT licence are present; all hashes match.

**Step 4: Document attribution**

State the upstream repository, pinned revision, MIT licence, transformation performed, and verification caveat.

### Task 2: Normalize heterogeneous source records into passages

**Files:**
- Create: `web/src/corpus/normalizeText.ts`
- Create: `web/src/corpus/normalizeText.test.ts`
- Create: `web/src/corpus/importers/chinesePoetry.ts`
- Create: `web/src/corpus/importers/chinesePoetry.test.ts`
- Modify: `web/src/corpus/types.ts`
- Modify: `web/src/corpus/coreCatalogue.ts`
- Modify: `web/src/corpus/buildCorpus.ts`
- Modify: `web/package.json`
- Modify: `web/pnpm-lock.yaml`

**Step 1: Write failing normalization tests**

Cover punctuation removal, whitespace removal, traditional-to-simplified conversion, sentence splitting at `。！？；`, stable passage IDs, and preservation of display text.

**Step 2: Install the pinned converter**

Run: `pnpm add -D opencc-js@1.4.1`

OpenCC runs only at build time. Do not ship its dictionary in the initial browser bundle.

**Step 3: Implement pure import adapters**

Handle array formats used by Shijing, Chuci, Lunyu, and Mengzi plus the object format used by Daxue. Add `workTitle`, `chapterTitle`, and `verificationUrl` to every passage.

**Step 4: Strengthen the build gate**

A `ready` book with zero passages is a blocking error. A passage whose source URL does not match its parent source record is a blocking error.

**Step 5: Run focused tests**

Run: `vitest run src/corpus/normalizeText.test.ts src/corpus/importers/chinesePoetry.test.ts src/corpus/buildCorpus.test.ts`

Expected: PASS.

### Task 3: Generate text shards and compact character-index buckets

**Files:**
- Create: `web/src/corpus/buildIndex.ts`
- Create: `web/src/corpus/buildIndex.test.ts`
- Modify: `web/scripts/build-corpus.mjs`
- Generate: `web/public/corpus/texts/*.json`
- Generate: `web/public/corpus/index/*.json`
- Generate: `web/public/corpus/aliases.json`
- Modify: `web/public/corpus/catalog.json`
- Modify: `web/public/corpus/build-report.json`

**Step 1: Write failing index tests**

Verify exact character positions, deduplicated postings, structural IDs, stable sorting, alias generation for traditional characters, and deterministic Unicode bucket names.

**Step 2: Implement the index builder**

Each posting contains passage, book, work and chapter IDs plus positions. Bucket characters by the high Unicode byte rather than creating thousands of files in one directory.

**Step 3: Extend the corpus build**

Load and validate the vendored inputs, emit one text file per ready book, emit index buckets and aliases, remove only the explicit stale `public/corpus/index` and `public/corpus/texts` directories, and fail before publishing on any blocking error.

**Step 4: Verify the output budget**

No generated file may exceed 1 MiB in this phase. Build twice and compare hashes for deterministic output.

### Task 4: Implement the browser full-text search engine

**Files:**
- Create: `web/src/corpus/searchCorpus.ts`
- Create: `web/src/corpus/searchCorpus.test.ts`

**Step 1: Write failing A–F search tests**

Use an injected fetch function and small static fixtures. Verify A/B same-sentence classification, C same-work, D same-book, E cross-book, F single-character evidence, script aliases, request deduplication, and network-error status.

**Step 2: Implement lazy loading**

Fetch only the catalogue, the two Unicode index buckets, aliases, and text shards needed by selected results. Cache promises for the current build version.

**Step 3: Preserve evidence honesty**

D–E must say they are constructed relationships; F must say it is only a single-character use. A failed shard request returns an error, never an empty result.

### Task 5: Connect full-text results to the existing name search UI

**Files:**
- Modify: `web/src/components/EvidenceSearch.tsx`
- Modify: `web/src/components/Catalogues.tsx`
- Modify: `web/src/App.test.tsx`
- Modify: `web/src/styles/app.css`

**Step 1: Add explicit corpus status**

Show `全文库 5 部 / 精选片段 126 条`. Distinguish loading, full-text hit, no hit, and load failure.

**Step 2: Keep curated evidence as a secondary layer**

Full-text results appear first. Existing curated fragments remain below under `精选片段补充`, never as the only source behind a “全文” label.

**Step 3: Verify desktop and mobile layouts**

Search `王景玉`, `王令仪`, and `王皎舒`; inspect network requests, result labels, horizontal overflow, and browser console.

### Task 6: Full verification and commit

**Files:**
- Modify: `docs/plans/2026-07-31-classical-corpus-design.md`

**Step 1: Run the full gate**

Run corpus fetch verification, corpus build, TypeScript check, all Vitest tests, Vite production build, generated-file size check, and `git diff --check` under Node 24.

**Step 2: Confirm honest coverage**

Expected: 70 target books, exactly five ready books, nonzero passages and characters, zero blocking errors, and 65 source-pending warnings.

**Step 3: Commit**

```bash
git add docs web
git commit -m "feat: search first classical full-text corpus"
```

