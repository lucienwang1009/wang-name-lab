# Pointer-Based Candidate Generation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace model-authored names and citations with locally compiled names derived from LLM-selected corpus character positions.

**Architecture:** The generation request returns only two corpus pointers plus subjective meaning metadata. A deterministic compiler dereferences pointers against the current `PassageBatch`, derives the name, occurrences, evidence relation, identifier and extraction, and records invalid selections for audit. Existing local rules and all review/publishing stages remain downstream unchanged.

**Tech Stack:** TypeScript, Node.js 22, Vitest, existing DeepSeek Responses client and corpus types.

---

### Task 1: Add pointer response contracts and schemas

**Files:**
- Modify: `web/factory/types.ts`
- Modify: `web/factory/schema.ts`
- Modify: `web/factory/schema.test.ts`

**Steps:**
1. Write failing parser tests for valid pointers and for forbidden model-authored name/evidence fields.
2. Add `SourcePointer`, `PointerSelection`, and `PointerSelectionIssue` types.
3. Add a strict JSON Schema and parser returning `PointerSelection[]`.
4. Run `pnpm --dir web exec vitest run factory/schema.test.ts` and expect PASS.
5. Commit the contract change.

### Task 2: Implement deterministic pointer compilation

**Files:**
- Create: `web/factory/pointers.ts`
- Create: `web/factory/pointers.test.ts`

**Steps:**
1. Write failing tests for exact, same-clause, same-work and cross-work relationships.
2. Write failing tests for occurrence derivation, same-position, out-of-range and unknown-passage errors.
3. Implement Unicode-safe dereferencing, normalized sentence ranges, relationship derivation, deterministic IDs and extraction text.
4. Return `{ proposals, issues }` without throwing for individual invalid selections.
5. Run `pnpm --dir web exec vitest run factory/pointers.test.ts` and expect PASS.
6. Commit the compiler.

### Task 3: Replace the generation prompt

**Files:**
- Modify: `web/factory/config.ts`
- Modify: `web/factory/prompts.ts`
- Modify: `web/factory/prompts.test.ts`

**Steps:**
1. Change the prompt test to require pointer-only output and assert forbidden fields are absent from the response schema.
2. Upgrade the prompt version to `name-factory-v3`.
3. Replace `generationRequest` with a pointer-selection request using the strict pointer schema.
4. Keep raw `text` and `normalizedText` in input; explain index semantics and prohibit invented passages.
5. Run prompt and schema tests and expect PASS.
6. Commit the prompt migration.

### Task 4: Integrate compilation and pointer audit into the pipeline

**Files:**
- Modify: `web/factory/pipeline.ts`
- Modify: `web/factory/types.ts`
- Modify: `web/factory/schema.ts`
- Modify: `web/factory/pipeline.test.ts`
- Modify: `web/factory/cli.test.ts`

**Steps:**
1. Update fake generation gateways to return pointers.
2. Add a failing end-to-end test proving the gateway cannot directly choose the resulting name.
3. Compile each batch response locally before hard rules.
4. Persist pointer issues and counts in checkpoints and review reports.
5. Preserve resume behavior and calibration stopping rules.
6. Run pipeline and CLI tests and expect PASS.
7. Commit pipeline integration.

### Task 5: Update documentation and verify without API calls

**Files:**
- Modify: `web/factory/README.md`
- Modify: `docs/plans/2026-08-26-local-ai-candidate-factory-design.md`

**Steps:**
1. Document pointer-only generation and its audit fields.
2. Run `pnpm --dir web test` and expect all tests PASS.
3. Run `pnpm --dir web typecheck` and expect PASS.
4. Run `pnpm --dir web factory:dry-run -- --max-cny 2 --target 50 --passages-per-book 2 --batch-size 8` and verify remote requests remain zero.
5. Run `pnpm --dir web build` and expect Recommendation V3 to remain at 25 human-reviewed and 0 AI-reviewed until a separately approved live run.
6. Run `git diff --check` and the credential security test.
7. Commit documentation and verification updates.

