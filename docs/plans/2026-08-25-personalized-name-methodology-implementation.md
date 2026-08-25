# Personalized Classical Naming Methodology V2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Directly replace the old adjacency-weighted discovery method with semantically verified candidates, local preference learning, and diverse personalized ranking while retaining the existing 70-book corpus and full-text search.

**Architecture:** Extend the deterministic corpus build with a versioned V2 recommendation asset that separates evidence, name-level features, and recommendation eligibility. In the browser, migrate local data to a versioned profile, learn an interpretable linear preference model from pairwise and explicit feedback, then assemble 12-name batches with MMR and fixed diversity constraints. Replace the existing discovery UI without keeping a legacy-ranking toggle.

**Tech Stack:** TypeScript 7, React 19, Vite 8, Vitest 4, Testing Library, deterministic Node corpus build, static JSON assets, browser localStorage.

---

### Task 1: Introduce V2 candidate and preference types

**Files:**
- Modify: `web/src/domain/types.ts`
- Modify: `web/src/corpus/types.ts`
- Create: `web/src/domain/nameFeatures.ts`
- Create: `web/src/domain/nameFeatures.test.ts`

**Step 1: Write the failing tests**

Add fixtures proving that a V2 candidate contains separate `evidence`, `features`, `quality`, `eligibility`, and `risks` fields; feature values are clamped to `0..1`; and incomplete candidates become `search-only` rather than recommendable.

```ts
expect(normalizeFeatures({ classical: 2, gentle: -1 })).toMatchObject({
  classical: 1,
  gentle: 0,
});
expect(recommendationEligibility(incomplete)).toBe("search-only");
```

**Step 2: Run the focused test and verify failure**

Run: `cd web && pnpm vitest run src/domain/nameFeatures.test.ts`  
Expected: FAIL because `nameFeatures.ts` and the V2 types do not exist.

**Step 3: Implement the minimal types and pure helpers**

Define `EvidenceRelation`, `RecommendationEligibility`, `NameFeatureVector`, `NameQuality`, `NameRisk`, and `PersonalizedCandidate`. Keep the feature key list centralized so preference and diversity code share identical ordering.

**Step 4: Run focused tests and type checking**

Run: `cd web && pnpm vitest run src/domain/nameFeatures.test.ts && pnpm typecheck`  
Expected: PASS.

**Step 5: Commit**

```bash
git add web/src/domain/types.ts web/src/corpus/types.ts web/src/domain/nameFeatures.ts web/src/domain/nameFeatures.test.ts
git commit -m "feat: model personalized name candidates"
```

### Task 2: Build a semantically gated V2 recommendation asset

**Files:**
- Create: `web/src/corpus/buildRecommendationPool.ts`
- Create: `web/src/corpus/buildRecommendationPool.test.ts`
- Modify: `web/scripts/build-corpus.mjs`
- Modify: `web/src/data/nameSystemData.ts`

**Step 1: Write failing corpus fixtures**

Cover exact contiguous text that is a complete phrase, contiguous text that is only a proper-name or grammatical fragment, same-clause extraction, negative context, duplicated names with multiple citations, curated verified seeds, and incomplete feature metadata.

```ts
expect(pool.recommendable.map((item) => item.givenName)).toContain("令仪");
expect(pool.recommendable.map((item) => item.givenName)).not.toContain("兵死");
expect(pool.searchOnly.find((item) => item.givenName === "残片")).toBeDefined();
```

**Step 2: Run the test and verify failure**

Run: `cd web && pnpm vitest run src/corpus/buildRecommendationPool.test.ts`  
Expected: FAIL because the V2 builder does not exist.

**Step 3: Implement evidence extraction and semantic gating**

Reuse normalized passages and existing source metadata. Preserve all citations for a name. Map reviewed human seeds to `reviewed`, use conservative deterministic rules for automatic `search-only` records, and require an explicit semantic explanation before automatic records become recommendable. Do not carry over `candidateScore`, `feminine >= 4`, book-priority score, evidence-length penalty, or family-character bonuses.

**Step 4: Emit the static asset**

Add `recommendations-v2.json` with schema version, corpus version, recommendable candidates, search-only count, and provenance. Keep `discovery.json` only as a temporary build input if needed; the browser must stop loading it.

**Step 5: Verify deterministic output**

Run the build twice and compare SHA-256 hashes:

```bash
cd web
pnpm corpus:build
shasum -a 256 public/corpus/recommendations-v2.json
pnpm corpus:build
shasum -a 256 public/corpus/recommendations-v2.json
```

Expected: both hashes are identical and focused tests pass.

**Step 6: Commit**

```bash
git add web/src/corpus/buildRecommendationPool.ts web/src/corpus/buildRecommendationPool.test.ts web/scripts/build-corpus.mjs web/src/data/nameSystemData.ts
git commit -m "feat: build semantically verified name pool"
```

### Task 3: Add a versioned local profile and migrate retained data

**Files:**
- Modify: `web/src/state/storage.ts`
- Modify: `web/src/state/storage.test.ts`
- Modify: `web/src/state/useLocalProfile.ts`

**Step 1: Write failing migration tests**

Test migration of old favorites, rejects, comparison names, notes, birth details, and assessments. Verify that old batch IDs and old cultural scores are discarded, corrupt preference data resets safely, and the new schema starts with explicit prior weights derived from confirmed preferences.

```ts
expect(migrated.version).toBe(2);
expect(migrated.favoriteNames).toContain("王令仪");
expect(migrated.preference.feedback).toEqual([]);
expect(migrated.birth).toEqual(oldProfile.birth);
```

**Step 2: Run and verify failure**

Run: `cd web && pnpm vitest run src/state/storage.test.ts`  
Expected: FAIL on the new versioned-profile assertions.

**Step 3: Implement migration and profile actions**

Add pairwise outcomes, explicit likes/dislikes, calibration progress, seen-name exposure counts, model weights, and schema version. Add actions for pairwise choice, explicit feedback, calibration reset, and exposure recording. Clamp traditional-reference weight to `0..0.10`.

**Step 4: Run tests and type checking**

Run: `cd web && pnpm vitest run src/state/storage.test.ts && pnpm typecheck`  
Expected: PASS.

**Step 5: Commit**

```bash
git add web/src/state/storage.ts web/src/state/storage.test.ts web/src/state/useLocalProfile.ts
git commit -m "feat: migrate local naming preferences"
```

### Task 4: Implement interpretable preference learning

**Files:**
- Create: `web/src/domain/preferenceModel.ts`
- Create: `web/src/domain/preferenceModel.test.ts`

**Step 1: Write failing mathematical tests**

Test stable sigmoid behavior, a winner increasing relative utility, a loser decreasing it, “both dislike” producing negative item feedback, skip producing no update, feature weights remaining bounded, and recommendation reasons returning the largest positive contributions.

```ts
const updated = recordPairwiseChoice(profile, left, right, "left");
expect(personalFit(updated, left)).toBeGreaterThan(personalFit(updated, right));
expect(recordPairwiseChoice(profile, left, right, "skip")).toEqual(profile);
```

**Step 2: Run and verify failure**

Run: `cd web && pnpm vitest run src/domain/preferenceModel.test.ts`  
Expected: FAIL because the preference model is absent.

**Step 3: Implement the online linear model**

Use a centralized feature ordering, pairwise logistic updates, bounded learning rate, L2 shrinkage toward the explicit prior, and separate explicit item feedback. Return a normalized `0..1` fit for internal ranking only. Generate 1–3 textual reasons from feature contributions without displaying a percentage score.

**Step 4: Run focused tests and type checking**

Run: `cd web && pnpm vitest run src/domain/preferenceModel.test.ts && pnpm typecheck`  
Expected: PASS.

**Step 5: Commit**

```bash
git add web/src/domain/preferenceModel.ts web/src/domain/preferenceModel.test.ts
git commit -m "feat: learn family naming preferences"
```

### Task 5: Implement MMR diversity and 7+3+2 batching

**Files:**
- Create: `web/src/domain/diversityRanker.ts`
- Create: `web/src/domain/diversityRanker.test.ts`

**Step 1: Write failing batch tests**

Use a fixed candidate fixture to verify deterministic ordering, fit sensitivity, shared-character cap, exact-homophone cap, category cap, three-style coverage, two evidence-relation coverage, exposure penalty, excluded-name removal, and graceful constraint relaxation when fewer than 12 candidates exist.

```ts
const batch = buildPersonalizedBatch(candidates, profile, { size: 12 });
expect(maxSharedCharacterCount(batch)).toBeLessThanOrEqual(2);
expect(new Set(batch.map((item) => item.primaryStyle)).size).toBeGreaterThanOrEqual(3);
```

**Step 2: Run and verify failure**

Run: `cd web && pnpm vitest run src/domain/diversityRanker.test.ts`  
Expected: FAIL because the ranker does not exist.

**Step 3: Implement similarity and greedy selection**

Implement weighted feature cosine similarity plus shared-character, pronunciation, book, and evidence-relation signals. Select 7 high-fit, 3 diverse-near-fit, and 2 uncertainty/exploration candidates with stable tie-breaking by ID. Keep MMR and similarity weights as exported constants.

**Step 4: Run focused tests and type checking**

Run: `cd web && pnpm vitest run src/domain/diversityRanker.test.ts && pnpm typecheck`  
Expected: PASS.

**Step 5: Commit**

```bash
git add web/src/domain/diversityRanker.ts web/src/domain/diversityRanker.test.ts
git commit -m "feat: diversify personalized name batches"
```

### Task 6: Load V2 recommendations and replace the discovery experience

**Files:**
- Modify: `web/src/corpus/searchCorpus.ts`
- Modify: `web/src/corpus/searchCorpus.test.ts`
- Modify: `web/src/components/Catalogues.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/AppShell.tsx`
- Modify: `web/src/components/FunnelOverview.tsx`
- Modify: `web/src/styles/app.css`
- Modify: `web/src/App.test.tsx`

**Step 1: Write failing loader and UI tests**

Test V2 schema validation, request caching, retryable loading errors, removal of legacy score labels and old filters, an 8-pair calibration flow, four response buttons, a 12-name personalized batch, recommendation reasons, viewpoint switches, feedback updates, favorite/compare preservation, and evidence deep links.

**Step 2: Run and verify failure**

Run: `cd web && pnpm vitest run src/corpus/searchCorpus.test.ts src/App.test.tsx`  
Expected: FAIL on V2 loader and new accessible UI names.

**Step 3: Implement the V2 client and calibration UI**

Load `recommendations-v2.json`; never fall back to `discovery.json` on failure. Choose 16 high-quality, feature-covering anchors deterministically and present 8 pairs. Persist every explicit outcome through `useLocalProfile`.

**Step 4: Replace discovery cards and filters**

Show independent evidence, meaning, pronunciation, usability, uncommonness caveat, style tags, recommendation reasons, and trade-offs. Provide the five confirmed viewpoints without reconstructing a universal total score. Preserve favorites, rejects, comparison, hash navigation, and `查完整典籍`.

**Step 5: Remove legacy runtime usage**

Stop importing `filterDiscoveryCandidates`, `sampleDiscoveryCandidates`, `culturalWeights`, and legacy score bars from the active discovery route. Leave compatibility helpers only where required for migration or tests, then delete dead code once type checking confirms no consumers.

**Step 6: Run focused tests and type checking**

Run: `cd web && pnpm vitest run src/corpus/searchCorpus.test.ts src/App.test.tsx && pnpm typecheck`  
Expected: PASS.

**Step 7: Commit**

```bash
git add web/src/corpus/searchCorpus.ts web/src/corpus/searchCorpus.test.ts web/src/components/Catalogues.tsx web/src/App.tsx web/src/components/AppShell.tsx web/src/components/FunnelOverview.tsx web/src/styles/app.css web/src/App.test.tsx
git commit -m "feat: replace discovery with personalized naming"
```

### Task 7: Update candidate details and traditional-reference boundary

**Files:**
- Modify: `web/src/components/DecisionSections.tsx`
- Modify: `web/src/domain/nameSystem.ts`
- Modify: `web/src/domain/nameSystem.test.ts`
- Modify: `web/src/state/storage.test.ts`

**Step 1: Write failing behavior tests**

Verify that candidate details no longer show the legacy cultural total, evidence remains separate from personal reasons, pre-birth traditional weight remains zero, post-birth weight caps at 10%, and hard-rejected names cannot be restored by a traditional assessment.

**Step 2: Run and verify failure**

Run: `cd web && pnpm vitest run src/domain/nameSystem.test.ts src/state/storage.test.ts`  
Expected: FAIL on the new 10% cap and removed legacy presentation.

**Step 3: Implement the boundary**

Keep actual birth details and rationale fields. Change the runtime cap from `0.25` to `0.10`, update copy, and keep traditional assessment separate from the default personalized recommendation. Remove obsolete cultural-score UI while retaining any pure evidence-search helpers still used elsewhere.

**Step 4: Run focused tests and type checking**

Run: `cd web && pnpm vitest run src/domain/nameSystem.test.ts src/state/storage.test.ts && pnpm typecheck`  
Expected: PASS.

**Step 5: Commit**

```bash
git add web/src/components/DecisionSections.tsx web/src/domain/nameSystem.ts web/src/domain/nameSystem.test.ts web/src/state/storage.test.ts
git commit -m "refactor: separate traditional naming reference"
```

### Task 8: Full verification, visual review, and deployment readiness

**Files:**
- Modify: `docs/plans/2026-08-25-personalized-name-methodology-design.md` only if verified implementation facts differ.

**Step 1: Run the complete automated suite**

```bash
cd web
pnpm test
pnpm build
git diff --check
```

Expected: all Vitest tests pass, TypeScript and Vite production builds succeed, the corpus build reports a nonzero recommendable count, and `git diff --check` emits no output.

**Step 2: Verify deterministic corpus output**

Build twice and compare `recommendations-v2.json` hashes. Expected: identical hashes.

**Step 3: Run local browser flows**

Verify at desktop and 375px widths:

1. fresh-profile calibration through all 8 pairs;
2. changed recommendation order after opposite choices;
3. 12-name diversity limits;
4. “都不喜欢” and explicit dislike behavior;
5. favorite, compare, refresh, and reload persistence;
6. `王令仪` and `王景玉` evidence deep links;
7. V2 resource-error retry state;
8. no horizontal overflow or console errors.

**Step 4: Review the diff and commit final fixes**

```bash
git status --short
git diff --stat
git diff --check
git add -A
git commit -m "test: verify personalized naming workflow"
```

Only create the final commit when material verification or documentation changes remain; do not create an empty commit.
