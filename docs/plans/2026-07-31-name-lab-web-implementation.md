# Wang Name Lab Web Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build and deploy a public TypeScript naming laboratory whose personal birth and family data stays in the browser.

**Architecture:** A Vite React SPA lives in `web/`. Pure TypeScript domain modules generate and score names from typed source data, React renders search/comparison/birth workflows, and GitHub Actions deploys `web/dist` to GitHub Pages.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, CSS, GitHub Actions, GitHub Pages.

---

### Task 1: Isolate and scaffold the web project

**Files:**
- Create: `.gitignore`
- Create: `web/package.json`
- Create: `web/index.html`
- Create: `web/tsconfig.json`
- Create: `web/tsconfig.app.json`
- Create: `web/tsconfig.node.json`
- Create: `web/vite.config.ts`
- Create: `web/src/main.tsx`

**Steps:**

1. Ignore worktrees, dependencies, build output, workbook outputs and local environment files without ignoring source data.
2. Create a `codex/web-app` worktree from the documented main branch.
3. Add React/Vite/TypeScript/Vitest dependencies and commit the lockfile.
4. Set Vite `base` to `/wang-name-lab/`.
5. Add `typecheck`, `test`, `build` and `preview` scripts.
6. Run the empty production build; expect success.

### Task 2: Port the domain model with tests

**Files:**
- Create: `web/src/domain/types.ts`
- Create: `web/src/domain/nameSystem.ts`
- Create: `web/src/domain/nameSystem.test.ts`
- Create: `web/src/data/nameSystemData.ts`

**Steps:**

1. Write failing tests for unique characters, at least 20,000 unique generated names, excluded doubled characters, auditable allusion metadata, hard-gate zeroing and prenatal metaphysical weight.
2. Port the character dictionary, classical fragments, curated candidates, grades and rejection rules into typed TypeScript.
3. Port deterministic raw generation, allusion generation, cultural scoring, birth scenarios and reranking.
4. Run unit tests and typecheck; expect all pass.

### Task 3: Implement privacy-safe application state

**Files:**
- Create: `web/src/state/useLocalProfile.ts`
- Create: `web/src/state/storage.ts`
- Create: `web/src/state/storage.test.ts`

**Steps:**

1. Define a versioned `LocalProfile` containing only user-entered preferences and birth data.
2. Add safe JSON parsing, migration fallback, export and clear functions.
3. Prove via tests that corrupt storage returns defaults and no network primitive is used.
4. Add favorites, rejected names, comparison selection and local metaphysical assessments.

### Task 4: Build the application shell and overview

**Files:**
- Create: `web/src/App.tsx`
- Create: `web/src/components/AppShell.tsx`
- Create: `web/src/components/FunnelOverview.tsx`
- Create: `web/src/components/SectionHeader.tsx`
- Create: `web/src/styles/tokens.css`
- Create: `web/src/styles/global.css`
- Create: `web/src/styles/app.css`

**Steps:**

1. Implement hash-based section navigation with no server routes.
2. Build the editorial “宋版书页 × 档案馆” shell.
3. Display live counts and the current shortlist funnel.
4. Add responsive navigation, keyboard focus, reduced-motion handling and semantic landmarks.

### Task 5: Build search, allusion and shortlist workflows

**Files:**
- Create: `web/src/components/NameExplorer.tsx`
- Create: `web/src/components/AllusionLibrary.tsx`
- Create: `web/src/components/CuratedRanking.tsx`
- Create: `web/src/components/NameCard.tsx`

**Steps:**

1. Add indexed text/category/family/femininity filters over the generated pool.
2. Paginate results and avoid rendering more than 60 name rows at once.
3. Add source-grade filters and expandable original passages.
4. Display cultural score, risk, family resonance and hard-gate state.
5. Add favorite/reject/compare actions backed by local state.

### Task 6: Build comparison and post-birth reranking

**Files:**
- Create: `web/src/components/CompareDrawer.tsx`
- Create: `web/src/components/CompareTable.tsx`
- Create: `web/src/components/BirthProfile.tsx`
- Create: `web/src/components/Methodology.tsx`

**Steps:**

1. Limit comparison to four names and explain the limit visibly.
2. Compare source grade, scores, family line, pronunciation, risks and practical cost.
3. Store birth data and assessments locally only.
4. Keep effective metaphysical weight at zero before birth; after birth allow 0%–25%.
5. Show disclaimers about traditional metaphysics, character-element disagreement and true-solar-time uncertainty.
6. Add local JSON export and data clearing.

### Task 7: Configure GitHub Pages deployment

**Files:**
- Create: `.github/workflows/deploy-pages.yml`
- Create: `README.md`

**Steps:**

1. Add checkout, Node 24 setup, `npm ci`, typecheck, test and build jobs.
2. Configure Pages, upload `web/dist` and deploy with the required permissions.
3. Document local development, privacy behavior, scoring boundaries and deployment URL.
4. Verify the workflow syntax and the `/wang-name-lab/` asset base.

### Task 8: Verify visually and deploy

**Steps:**

1. Run unit tests, TypeScript check and production build.
2. Serve the production output locally.
3. Inspect desktop and mobile flows with Playwright: overview, search, source expansion, compare, local birth profile, refresh persistence and clear data.
4. Fix all visible clipping, overflow, focus and contrast problems.
5. Create the public repository `lucienwang1009/wang-name-lab`.
6. Merge the implementation branch, push `main`, enable GitHub Actions as the Pages source and wait for deployment.
7. Open the production URL and repeat the critical smoke test.

