# Classics-First Name Discovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the raw-combination and curated-ranking pages with one repeatable classics-first discovery page whose candidates all have A/B textual evidence and can jump directly into the 70-book search.

**Architecture:** Generate a compact, deterministic discovery pool during the existing corpus build from normalized passages and the approved naming-character dictionary. Load that static pool lazily in the browser, merge it with the existing human-curated register, and let a single React page sample non-repeating batches while preserving local favorites, rejects, comparison, and deep-linked evidence lookup.

**Tech Stack:** TypeScript 7, React 19, Vite 8, Vitest 4, static JSON corpus assets.

---

### Task 1: Build a deterministic A/B discovery pool

**Files:**
- Create: `web/src/corpus/buildDiscoveryPool.ts`
- Create: `web/src/corpus/buildDiscoveryPool.test.ts`
- Modify: `web/src/corpus/types.ts`
- Modify: `web/scripts/build-corpus.mjs`

**Steps:**
1. Write failing fixtures covering punctuated direct A matches, punctuated near-distance B matches, unpunctuated adjacency downgraded to B, ineligible characters, and duplicate-name evidence ranking.
2. Run `pnpm vitest run src/corpus/buildDiscoveryPool.test.ts` and confirm failure.
3. Implement deterministic extraction, scoring, deduplication, and a bounded 1,200-name output.
4. Emit `discovery.json` with the corpus build version and provenance fields; keep it below the 1 MiB gate.
5. Run the focused test and corpus build; confirm nonzero A/B counts and no build warnings.

### Task 2: Load and sample discovery candidates in the browser

**Files:**
- Modify: `web/src/corpus/searchCorpus.ts`
- Modify: `web/src/corpus/searchCorpus.test.ts`
- Create: `web/src/domain/discovery.ts`
- Create: `web/src/domain/discovery.test.ts`

**Steps:**
1. Add failing tests for parsing `discovery.json`, request caching, grade filtering, deterministic injected-random sampling, and avoidance of the immediately previous batch.
2. Extend the corpus client with `discover()` while keeping injected test clients backward compatible.
3. Implement pure merging and sampling helpers that prefer human-curated records on duplicate names.
4. Run focused tests and TypeScript checking.

### Task 3: Merge the two pages into `ClassicsNameDiscovery`

**Files:**
- Modify: `web/src/components/Catalogues.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/AppShell.tsx`
- Modify: `web/src/components/FunnelOverview.tsx`
- Modify: `web/src/components/DecisionSections.tsx`
- Modify: `web/src/styles/app.css`

**Steps:**
1. Write failing app tests for one merged navigation item, a 12-name random batch, A/B-only defaults, `换一批`, human-curated badges, and preserved favorite/compare actions.
2. Replace the two routes with one `explore` route labelled `典籍寻名`; map legacy `#curated` to it.
3. Build the editorial random-draw header, filters, evidence cards, loading/error fallback, and controls.
4. Update overview copy and comparison links to the merged page.
5. Run component tests and fix accessibility names and empty states.

### Task 4: Deep-link a candidate into full-text evidence

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/Catalogues.tsx`
- Modify: `web/src/components/EvidenceSearch.tsx`
- Modify: `web/src/App.test.tsx`

**Steps:**
1. Add a failing flow test that clicks `查完整典籍` and expects `#allusions?name=...` plus an automatically populated search box.
2. Parse section and `name` from the hash without breaking legacy hashes.
3. Pass the initial query into `EvidenceSearch` and synchronize it when the deep link changes.
4. Run the flow test twice, including direct page reload at the deep link.

### Task 5: Full verification and commit

**Files:**
- Modify: `docs/plans/2026-08-01-classics-first-discovery-design.md` only if implementation facts differ.

**Steps:**
1. Run `pnpm corpus:fetch`, `pnpm test`, `pnpm build`, generated-file size checks, deterministic corpus hashing, and `git diff --check` under Node 24.
2. Use the local browser to verify random refresh, human-curated filtering, `王令仪` deep-link search, console logs, and 375px overflow.
3. Commit the implementation with `feat: discover names from classical evidence`.
