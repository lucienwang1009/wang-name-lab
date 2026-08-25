# Adaptive Name Feed Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the 461-candidate personalized naming page into a one-name-at-a-time feed that learns after every reaction.

**Architecture:** Extend the local preference profile with reversible per-name reactions and reaction order. Add a deterministic online policy that alternates fit, diversity, and exploration while using recent history as MMR context, then replace the batch grid with one editorial recommendation card and immediate feedback controls.

**Tech Stack:** TypeScript, React 19, Vitest, Testing Library, Vite, localStorage.

---

### Task 1: Persist reversible reactions

**Files:**
- Modify: `web/src/state/storage.ts`
- Modify: `web/src/domain/preferenceModel.ts`
- Test: `web/src/state/storage.test.ts`
- Test: `web/src/domain/preferenceModel.test.ts`

**Steps:**
1. Add failing tests for reaction parsing, positive/negative feature updates, neutral skip, changed reactions, and undo.
2. Run `pnpm test -- src/state/storage.test.ts src/domain/preferenceModel.test.ts` and confirm failure.
3. Add `CandidateReaction`, `reactions`, and `reactionOrder`; implement delta-based `recordCandidateReaction` and `undoCandidateReaction`.
4. Re-run the focused tests and confirm they pass.

### Task 2: Select one adaptive recommendation

**Files:**
- Modify: `web/src/domain/diversityRanker.ts`
- Test: `web/src/domain/diversityRanker.test.ts`

**Steps:**
1. Add failing tests proving the 60/20/20 policy, reacted-name exclusion, recent-history diversity, determinism, and exhaustion behavior.
2. Run the focused test and confirm failure.
3. Implement `selectAdaptiveRecommendation` by reusing the existing relevance, similarity, uncertainty, exposure, and MMR calculations.
4. Re-run the focused tests and confirm they pass.

### Task 3: Connect reactions to the local profile

**Files:**
- Modify: `web/src/state/useLocalProfile.ts`
- Modify: `web/src/App.tsx`

**Steps:**
1. Add profile actions that atomically record or undo a candidate reaction while synchronizing favorites and rejected names.
2. Expose the actions to the personalized feed.
3. Run `pnpm typecheck` and resolve all contract errors.

### Task 4: Replace the batch page with a single-name feed

**Files:**
- Modify: `web/src/components/PersonalizedNameDiscovery.tsx`
- Modify: `web/src/styles/app.css`
- Test: `web/src/App.test.tsx`

**Steps:**
1. Replace the old calibration and 12-card expectations with failing tests for immediate first recommendation, four reactions, next-name change, progress, undo, source lookup, and review-tier labels.
2. Run `pnpm test -- src/App.test.tsx` and confirm failure.
3. Build the single editorial card, feedback rail, model status, remaining count, and completion state.
4. Add restrained transition and responsive styles consistent with the existing archive aesthetic.
5. Re-run the interface tests and confirm they pass.

### Task 5: Explain and verify the first stage

**Files:**
- Modify: `web/src/components/DecisionSections.tsx`
- Modify: `web/src/components/FunnelOverview.tsx`
- Test: `web/src/App.test.tsx`

**Steps:**
1. Update methodology text from one-time calibration and 7+3+2 batches to continuous local learning and 60/20/20 serving.
2. Run `pnpm test -- --run`, `pnpm typecheck`, and `pnpm build`; require all to pass.
3. Start the local site and verify the first recommendation, two opposite reactions, undo, persistence after reload, and responsive layout.
4. Commit the implementation with a focused message.
