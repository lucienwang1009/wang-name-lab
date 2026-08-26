# Indexed Pointer Selection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make LLM source-pointer selection reliable by supplying an explicit character-index view while preserving local evidence compilation.

**Architecture:** `generationRequest` adds a deterministic `indexedText` beside each passage and upgrades the prompt/cache version. The model copies displayed indices, while `compilePointerSelections` remains the only component that derives characters, names and evidence. Local rules reject the newly observed function-character failure before paid review stages.

**Tech Stack:** TypeScript, Node.js 22, Vitest, existing DeepSeek Responses client and corpus pipeline.

---

### Task 1: Specify indexed passage input

**Files:**
- Modify: `web/factory/prompts.test.ts`
- Modify: `web/factory/schema.test.ts`

**Steps:**
1. Add a prompt test requiring `indexedText` to map every `normalizedText` character to its zero-based index.
2. Require the instructions to say that the model copies the displayed number and does not count characters itself.
3. Change the default prompt-version expectation to `name-factory-v4`.
4. Run the targeted tests and verify that they fail before implementation.

### Task 2: Add indexed input and cache invalidation

**Files:**
- Modify: `web/factory/prompts.ts`
- Modify: `web/factory/config.ts`
- Modify: `web/factory/cli.ts`

**Steps:**
1. Generate compact `[index]character` tokens from `normalizedText` in `passagePayload`.
2. Tell the generator to copy indices from that field and verify the two displayed characters before returning.
3. Prefer same-sentence or same-work combinations unless a cross-work combination is exceptionally natural.
4. Upgrade the prompt version to `name-factory-v4` and include indexed-input overhead in the dry-run estimate.
5. Run prompt, schema and type tests.

### Task 3: Reject the observed function-character failure

**Files:**
- Modify: `web/factory/rules.test.ts`
- Modify: `web/factory/rules.ts`

**Steps:**
1. Add a failing test proving a two-character proposal containing “在” receives a hard `function-character-fragment` risk.
2. Add “在” to the deterministic function-character pattern.
3. Run the rules and pipeline tests.

### Task 4: Verify and run an isolated smoke

**Files:**
- Modify: `web/factory/README.md`
- Local-only: `web/factory/reports/pointer-v4-smoke-20260826-1/`

**Steps:**
1. Document indexed pointer input and `name-factory-v4`.
2. Run the complete test suite, typecheck, production build and credential security test.
3. Commit the implementation before making a paid request.
4. Run `factory:smoke` with a 1 CNY hard limit and report-only candidate output paths.
5. Inspect selection count, invalid pointers, compiled names, rejection stages, request usage and estimated cost.
6. Confirm the tracked worktree and current public candidate files remain unchanged.
