# Local AI Candidate Factory Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete local TypeScript candidate factory using `deepseek-v4-flash`, a CNY 20 hard budget, deterministic corpus verification, staged AI review, resumable local artifacts, and integration with the adaptive GitHub Pages name feed.

**Architecture:** Add `web/factory/` inside the existing TypeScript package so the CLI, tests, and browser build share one lockfile and Node toolchain. The factory reads the corpus shards produced by `corpus:build`, runs independent generation/review stages through a small Responses API client, writes an audited source artifact under `web/corpus/generated/`, and lets the existing corpus build publish only human- or AI-reviewed names. All remote calls are local-only and explicitly enabled; GitHub Actions remains static.

**Tech Stack:** TypeScript 7, Node.js 22.18+, pnpm, Vitest, DeepSeek Responses API, `pinyin-pro`, React/Vite.

---

### Task 1: Factory domain schema and configuration

**Files:**
- Create: `web/factory/types.ts`
- Create: `web/factory/schema.ts`
- Create: `web/factory/config.ts`
- Create: `web/factory/schema.test.ts`
- Modify: `web/package.json`
- Modify: `web/tsconfig.node.json`

**Step 1: Write failing schema tests**

Test valid and invalid generator proposals, stage reviews, factory candidate artifacts, defaults for `deepseek-v4-flash`, `--max-cny 20`, `--dry-run`, and rejection of unknown CLI options.

**Step 2: Run the focused test**

Run: `pnpm --dir web test -- factory/schema.test.ts`

Expected: FAIL because factory modules do not exist.

**Step 3: Implement types, runtime parsers, and config parsing**

Define explicit source, proposal, semantic review, name review, adversarial review, usage, manifest, report, and publish-file types. Runtime parsers must reject missing evidence, invalid two-character names, non-unit scores, invalid decisions, and unrecognized evidence relations. CLI defaults must not read or print a secret.

**Step 4: Re-run focused tests**

Expected: PASS.

**Step 5: Commit**

```bash
git add web/factory web/package.json web/tsconfig.node.json
git commit -m "feat: add candidate factory domain schema"
```

### Task 2: Budget ledger, cache, checkpoint, and atomic files

**Files:**
- Create: `web/factory/budget.ts`
- Create: `web/factory/budget.test.ts`
- Create: `web/factory/storage.ts`
- Create: `web/factory/storage.test.ts`
- Modify: `.gitignore`

**Step 1: Write failing budget and storage tests**

Cover cached/uncached input pricing, output pricing, CNY conversion, phase caps, whole-run hard cap, preflight reservations, actual usage reconciliation, cache hashing without API keys, checkpoint reload, redaction, and atomic replacement preserving the previous file on validation failure.

**Step 2: Run focused tests and confirm failure**

Run: `pnpm --dir web test -- factory/budget.test.ts factory/storage.test.ts`

**Step 3: Implement deterministic ledger and storage helpers**

Use integer micro-CNY internally. Cache keys hash model, prompt version, role, JSON schema, and input. Add `.factory-cache/`, `factory/reports/`, `factory/checkpoints/`, and generated temporary files to `.gitignore`; keep the approved source artifact trackable.

**Step 4: Re-run focused tests**

Expected: PASS.

**Step 5: Commit**

```bash
git add .gitignore web/factory
git commit -m "feat: add factory budget and resumable storage"
```

### Task 3: DeepSeek Responses API client

**Files:**
- Create: `web/factory/deepseek.ts`
- Create: `web/factory/deepseek.test.ts`
- Modify: `web/.env.example`

**Step 1: Write failing client tests**

Mock `fetch` and verify `POST https://api.deepseek.com/responses`, bearer authentication, exact model `deepseek-v4-flash`, `text.format.type=json_schema`, `reasoning.effort`, output-text extraction, usage extraction, timeout, 429/5xx bounded exponential retry, no retry for authentication errors, one JSON repair attempt, response redaction, and cache hits that make no request.

**Step 2: Run focused test and confirm failure**

Run: `pnpm --dir web test -- factory/deepseek.test.ts`

**Step 3: Implement the client**

Inject `fetch`, sleep, and clock for testing. Require `DEEPSEEK_API_KEY` only when a live request is actually made. Never include the key in thrown errors, cache files, request hashes, reports, or logs. Reserve budget before each attempt and reconcile from response usage.

**Step 4: Re-run focused tests**

Expected: PASS.

**Step 5: Commit**

```bash
git add web/factory/deepseek.ts web/factory/deepseek.test.ts web/.env.example
git commit -m "feat: add secured DeepSeek factory client"
```

### Task 4: Corpus loader and diverse source batching

**Files:**
- Create: `web/factory/corpus.ts`
- Create: `web/factory/corpus.test.ts`
- Create: `web/factory/fixtures/corpus/catalog.json`
- Create: `web/factory/fixtures/corpus/texts/test-book/001.json`

**Step 1: Write failing corpus tests**

Verify catalogue/shard loading, restoration of book metadata, exclusion of short/noisy/negative passages, deterministic selection, coverage across books and categories, per-book limits, positive-imagery scoring, and stable batch IDs.

**Step 2: Run focused tests and confirm failure**

Run: `pnpm --dir web test -- factory/corpus.test.ts`

**Step 3: Implement corpus loading and batching**

Read `public/corpus/catalog.json` and every listed text shard after `corpus:build`. Rank useful passages without claiming semantic truth, then round-robin across books/categories so one large corpus cannot dominate. Keep exact passage IDs and source URLs in every request.

**Step 4: Re-run focused tests**

Expected: PASS.

**Step 5: Commit**

```bash
git add web/factory/corpus.ts web/factory/corpus.test.ts web/factory/fixtures
git commit -m "feat: add diverse classical source batching"
```

### Task 5: Prompt roles, local phonology, and deterministic gates

**Files:**
- Create: `web/factory/prompts.ts`
- Create: `web/factory/rules.ts`
- Create: `web/factory/rules.test.ts`
- Modify: `web/package.json`
- Modify: `web/pnpm-lock.yaml`

**Step 1: Add `pinyin-pro` and write failing rule tests**

Run: `pnpm --dir web add pinyin-pro@3.29.3`

Test standard two-character names, identical characters, function-character fragments, negative context, source-position verification for all evidence relations, full-name pinyin/tones, polyphonic warnings, 王-surname phonetic collisions, duplicate IDs, and hard-rule precedence.

**Step 2: Run focused tests and confirm failure**

Run: `pnpm --dir web test -- factory/rules.test.ts`

**Step 3: Implement role-isolated prompts and local rules**

Prompts must encode the family context and aesthetic anchors without overproducing 玉/影/绍. Generator output cannot contain scores. Review prompts cannot see generator self-judgment. Use `pinyin-pro` to derive complete pronunciation locally and compare it with model output; model pinyin never overrides local data.

**Step 4: Re-run focused tests**

Expected: PASS.

**Step 5: Commit**

```bash
git add web/factory/prompts.ts web/factory/rules.ts web/factory/rules.test.ts web/package.json web/pnpm-lock.yaml
git commit -m "feat: add candidate prompts and deterministic gates"
```

### Task 6: Staged candidate pipeline and synthesis

**Files:**
- Create: `web/factory/pipeline.ts`
- Create: `web/factory/pipeline.test.ts`
- Create: `web/factory/synthesis.ts`
- Create: `web/factory/synthesis.test.ts`

**Step 1: Write failing pipeline tests**

Use a fake model gateway to prove the state chain `generated → rule-passed → semantic-approved → name-approved → adversarial-approved → published`, anonymous reviewer inputs, deterministic rejection reasons, duplicate evidence merging, name/character/source diversity caps, target count behavior, checkpoint resume, and refusal to lower hard gates when the target is missed.

**Step 2: Run focused tests and confirm failure**

Run: `pnpm --dir web test -- factory/pipeline.test.ts factory/synthesis.test.ts`

**Step 3: Implement orchestration and conversion**

Run the generator in batches, local-gate before paid reviews, review candidates in bounded groups, adversarially review only likely finalists, and synthesize AI-reviewed `PersonalizedCandidate` records with stable IDs, citations, features, risks, score audit, model, prompt version, corpus version, and run ID.

**Step 4: Re-run focused tests**

Expected: PASS.

**Step 5: Commit**

```bash
git add web/factory/pipeline.ts web/factory/pipeline.test.ts web/factory/synthesis.ts web/factory/synthesis.test.ts
git commit -m "feat: implement staged AI candidate pipeline"
```

### Task 7: CLI, reports, dry-run, and smoke mode

**Files:**
- Create: `web/factory/cli.ts`
- Create: `web/factory/cli.test.ts`
- Create: `web/factory/README.md`
- Modify: `web/package.json`

**Step 1: Write failing CLI tests**

Cover `factory:dry-run`, live-run opt-in, `--max-cny`, `--target`, `--resume`, `--run-id`, `--smoke`, missing corpus, missing key, manifest/report output, and atomic approved-artifact publication.

**Step 2: Run focused tests and confirm failure**

Run: `pnpm --dir web test -- factory/cli.test.ts`

**Step 3: Implement the CLI and usage guide**

Default to dry-run unless `--live` is explicit. The smoke mode must force a maximum CNY 1 budget. Print only run progress, counts, cache hits, and estimated cost. Write `web/corpus/generated/approved-candidates.json`, local reports, and a local preview copy under `web/public/data/`.

**Step 4: Re-run focused tests**

Expected: PASS.

**Step 5: Commit**

```bash
git add web/factory/cli.ts web/factory/cli.test.ts web/factory/README.md web/package.json
git commit -m "feat: add local candidate factory CLI"
```

### Task 8: Recommendation V3 and browser integration

**Files:**
- Create: `web/src/corpus/generatedCandidates.ts`
- Create: `web/src/corpus/generatedCandidates.test.ts`
- Modify: `web/src/domain/types.ts`
- Modify: `web/src/domain/nameFeatures.ts`
- Modify: `web/src/corpus/types.ts`
- Modify: `web/src/corpus/buildRecommendationPool.ts`
- Modify: `web/src/corpus/buildRecommendationPool.test.ts`
- Modify: `web/scripts/build-corpus.mjs`
- Modify: `web/src/corpus/searchCorpus.ts`
- Modify: `web/src/corpus/searchCorpus.test.ts`
- Modify: `web/src/components/PersonalizedNameDiscovery.tsx`
- Modify: `web/src/App.tsx`

**Step 1: Write failing integration tests**

Verify corpus-version validation, passage evidence verification, AI-reviewed eligibility, merge precedence `human > AI > automatic`, demotion of all unreviewed rule-generated names to search-only, recommendation V3 counts/schema, old feedback stability, the `AI 多重审核` UI label, and accurate overview/feed counts.

**Step 2: Run focused tests and confirm failure**

Run: `pnpm --dir web test -- src/corpus/generatedCandidates.test.ts src/corpus/buildRecommendationPool.test.ts src/corpus/searchCorpus.test.ts src/App.test.tsx`

**Step 3: Implement V3 publication and loading**

Load the approved artifact during `corpus:build`, verify every citation against imported passages, merge with human seeds, publish only recommendable names, and copy the factory artifact to `public/data/generated-candidates.json`. Keep the prior V2 parser compatible for tests/old static deployments while preferring V3.

**Step 4: Re-run focused tests**

Expected: PASS.

**Step 5: Commit**

```bash
git add web/src web/scripts/build-corpus.mjs
git commit -m "feat: publish AI-reviewed recommendation pool"
```

### Task 9: Security, end-to-end verification, and documentation alignment

**Files:**
- Create: `web/factory/security.test.ts`
- Modify: `docs/plans/2026-08-26-local-ai-candidate-factory-design.md`
- Modify: `web/THIRD_PARTY_NOTICES.md`
- Modify: `.github/workflows/deploy-pages.yml` only if verification requires no-secret factory exclusions to be explicit

**Step 1: Add security and artifact tests**

Scan tracked files and generated web artifacts for secret-like DeepSeek keys, ensure ignored local paths are not deployable, and prove the default test/build path makes no API request.

**Step 2: Run all automated checks**

Run:

```bash
pnpm --dir web test
pnpm --dir web typecheck
pnpm --dir web factory:dry-run
pnpm --dir web build
git diff --check
```

Expected: all pass; dry-run reports zero remote requests and cost.

**Step 3: Inspect generated artifacts and UI**

Confirm recommendation counts, evidence paths, no secret material, desktop/mobile feed rendering, source lookup, reactions, undo, favorites, comparison, and production asset loading.

**Step 4: Align docs with final paths and commands**

Document the secure new-key flow without recording a key and explain that live factory runs happen locally, never in GitHub Actions.

**Step 5: Commit**

```bash
git add web/factory/security.test.ts web/THIRD_PARTY_NOTICES.md docs .github/workflows/deploy-pages.yml
git commit -m "test: verify candidate factory end to end"
```

### Completion audit

Before marking the work complete, inspect current files and command outputs against every design requirement: exact model, local-only secrets, CNY 20 preflight and reconciliation, 2/10/5/2/1 phase allocation, dry-run, CNY 1 smoke mode, caching, checkpoints, retries, JSON repair, source verification, local pinyin, all four extraction relations, reviewer isolation, adversarial review, atomic publication, reports/manifests, provisional-candidate demotion, browser MMR integration, backward-compatible preferences, test/build/Pages success, and no tracked or deployed key.
