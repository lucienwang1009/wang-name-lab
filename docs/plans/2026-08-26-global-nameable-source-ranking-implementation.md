# Global Nameable Source Ranking Implementation Plan

**Goal:** Let recommendation sources compete by naming quality across the complete corpus while retaining concentration limits and a genuinely selective final review.

**Architecture:** Keep all 70 books in corpus search. Replace per-book source round-robin with a bounded global pool and dynamic MMR state, without curated-fragment boosts. Tighten the blind final reviewer so `approve` means shortlist-worthy rather than merely usable, encode material shortlist blockers separately from fatal issues, deduplicate names after evidence review, and version the changed methodology as v10.

**Tech Stack:** TypeScript, Node.js 22, Vitest, existing local corpus and DeepSeek pointer pipeline.

### Task 1: Prove quality can outrank book coverage

**Files:**
- Modify: `web/factory/corpus.test.ts`
- Modify: `web/factory/corpus.ts`

1. Replace the per-book round-robin expectation with a failing fixture where two excellent passages from one book beat a weak passage from another.
2. Add a concentration fixture proving one book still cannot take the entire result.
3. Preserve the existing duplicate-word and same-work diversity test.

### Task 2: Implement bounded global dynamic MMR

**Files:**
- Modify: `web/factory/corpus.ts`

1. Derive the total source target from the legacy scale and eligible book count.
2. Build a bounded candidate pool from global high scores plus enough per-book fallback items.
3. Maintain maximum selected-character similarity incrementally.
4. Score quality minus character, work and book concentration penalties with stable ties.
5. Enforce loose per-book and per-work maximum shares without minimum quotas.

### Task 3: Make final approval mean shortlist-worthy

**Files:**
- Modify: `web/factory/prompts.test.ts`
- Modify: `web/factory/prompts.ts`
- Modify: `web/factory/config.ts`
- Modify: `web/factory/schema.test.ts`
- Modify: `web/factory/README.md`

1. Add prompt assertions that an anchor character is not rewarded and material aesthetic defects must reject.
2. Tell the generator to compare within a batch and return only genuinely strong combinations.
3. Tell the final reviewer to reject word-like, rigid, masculine, stale or explanation-dependent names even when usable.
4. Require structured `materialIssues`; local publication rejects any non-empty result even if the model says approve.
5. Remove the calibration-era curated-fragment score bonus.
6. Penalize arbitrary sliding windows from long unpunctuated text relative to complete punctuated clauses.
7. Keep only the strongest semantic-evidence proposal per given name before name review.
8. Pass concrete prior review risks to the final reviewer as leads for independent verification.
9. Upgrade the audit protocol to `name-factory-v10`.

### Task 4: Verify and recalibrate in isolation

1. Run focused tests, then the full suite, typecheck, corpus build and production build.
2. Audit the selected source distribution and confirm it is no longer one-per-book round-robin.
3. Run a zero-request cost estimate.
4. Commit before making remote requests.
5. Run an isolated small calibration under an explicit cap; do not modify public candidate files.
6. Audit every published name and compare usable-vs-shortlist-worthy yield before deciding whether formal expansion is justified.
