# Nameable Source Windows Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rank and present corpus sources by natural two-character naming opportunities instead of raw auspicious-character counts.

**Architecture:** Deterministic clause windows retain absolute offsets into the original passage. Pair-opportunity scoring supplies passage quality and prompt windows; source selection applies MMR, while the automatic pipeline rejects cross-passage selections before review. Published evidence continues to use the unchanged original passage.

**Tech Stack:** TypeScript, Node.js 22, Vitest, existing character dictionary, corpus loader and DeepSeek pointer pipeline.

---

### Task 1: Specify source-window extraction and scoring

**Files:**
- Modify: `web/factory/corpus.test.ts`
- Modify: `web/factory/corpus.ts`

**Steps:**
1. Add failing tests for absolute window offsets, negative-window exclusion and pair opportunities.
2. Add a ranking fixture proving “柔嘉维则，令仪令色” outranks a repeated-month passage.
3. Implement single- and adjacent-clause windows using normalized Unicode offsets.
4. Score distance-1–4 pairs from `characterDictionary`, with continuity, femininity, usability and rarity terms.
5. Derive passage score from the top windows and require at least one opportunity for source eligibility.
6. Run `pnpm --dir web exec vitest run factory/corpus.test.ts`.

### Task 2: Add deterministic MMR source selection

**Files:**
- Modify: `web/factory/corpus.test.ts`
- Modify: `web/factory/corpus.ts`

**Steps:**
1. Add a failing test with two near-duplicate moon passages and one distinct virtue passage.
2. Implement quality-minus-similarity selection with stable tie-breaking and same-work penalty.
3. Preserve per-book round-robin output and deterministic batch IDs.
4. Run corpus and pipeline tests.

### Task 3: Send only ranked source windows

**Files:**
- Modify: `web/factory/prompts.test.ts`
- Modify: `web/factory/prompts.ts`
- Modify: `web/factory/config.ts`
- Modify: `web/factory/schema.test.ts`

**Steps:**
1. Add a failing prompt test for `sourceWindows` with absolute indexed characters.
2. Require both pointers to use the same passage and displayed window positions.
3. Remove full-passage `indexedText` from generation input while retaining full text for context and review.
4. Upgrade the prompt version to `name-factory-v5`.
5. Run prompt, schema and type tests.

### Task 4: Enforce same-passage automatic generation

**Files:**
- Modify: `web/factory/pointers.ts`
- Modify: `web/factory/pointers.test.ts`
- Modify: `web/factory/pipeline.ts`
- Modify: `web/factory/pipeline.test.ts`

**Steps:**
1. Add a compiler option test showing cross-work compilation remains available by default but can be disabled.
2. Return an audited pointer issue when automatic generation selects two passages.
3. Call the compiler with cross-passage selection disabled from the factory pipeline.
4. Run pointer and pipeline tests.

### Task 5: Verify, document and calibrate

**Files:**
- Modify: `web/factory/README.md`
- Local-only: `web/factory/reports/source-windows-v5-smoke-20260826-1/`

**Steps:**
1. Document window scoring, MMR and the same-passage automatic boundary.
2. Run all tests, typecheck, zero-request dry-run, production build and credential security test.
3. Inspect the real 70-book top selections and prove the first calibration sources changed appropriately.
4. Commit before any remote request.
5. Run one isolated smoke with the existing 1 CNY hard cap.
6. Audit source windows, pointer consistency, review stages, cost and unchanged public candidate files.
