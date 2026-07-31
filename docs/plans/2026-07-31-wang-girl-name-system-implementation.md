# Wang Girl Name System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a reusable Excel-based naming system that generates a large raw pool, audits classical allusions, applies feminine and practical gates, and supports post-birth metaphysical reranking.

**Architecture:** A single JavaScript builder owns auditable seed data and produces a formula-driven `.xlsx` workbook. Pure helper functions generate and validate raw name combinations before spreadsheet creation; the workbook keeps user-editable inputs, weights, scores, and status formulas visible.

**Tech Stack:** Bundled Node.js, `@oai/artifact-tool`, Node built-in test runner, Excel formulas.

---

### Task 1: Create data and generation helpers

**Files:**
- Create: `src/name-system-data.mjs`
- Create: `src/name-system-core.mjs`
- Test: `tests/name-system-core.test.mjs`

**Step 1: Write failing tests**

Test that the character dictionary has unique characters, raw generation produces at least 20,000 unique `王xx` names, identical double characters are excluded, and every source-backed candidate contains source metadata.

**Step 2: Run tests and verify failure**

Run:

```bash
/Users/lucien/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/name-system-core.test.mjs
```

Expected: failure because the modules do not exist.

**Step 3: Implement minimal pure functions**

Implement:

```js
export function generateRawPool(characters, surname = "王") {}
export function generateAllusionCandidates(fragments, characterSet, surname = "王") {}
export function validateSystemData({ characters, fragments, curated }) {}
```

Raw generation must be deterministic and attach the two character categories, a family-resonance proxy, a femininity proxy, and the status `待核典`.

**Step 4: Run tests and verify pass**

Expected: all core tests pass and the raw pool contains at least 20,000 unique names.

### Task 2: Build workbook structure

**Files:**
- Create: `build_complete_name_system.mjs`
- Modify: `src/name-system-data.mjs`

**Step 1: Add the twelve worksheets**

Create every sheet before any cross-sheet formula:

```text
导航与结论
基础输入
评分与否决
用字字典
原始生成池
古籍语料库
典故候选池
精选评分
命理情景
出生后复排
否决记录
名字档案卡
```

**Step 2: Populate editable inputs and visible assumptions**

Set the prenatal window to 2026-08-20 through 2026-08-30, birth status to `未出生`, surname to `王`, sex to `女`, family references to `字玉` and `绍影`, and metaphysical weight to 0% before birth / suggested 15% after birth. Use validation lists for categorical inputs.

**Step 3: Populate source and candidate tables**

Write the character dictionary, raw pool, source fragments, generated allusion candidates, curated feminine shortlist, and rejection log in block writes. Add plain-text URLs in dedicated source columns.

### Task 3: Add formulas and hard gates

**Files:**
- Modify: `build_complete_name_system.mjs`

**Step 1: Add visible rule tables**

Create formula-referenced weights for femininity, source integrity, family resonance, rarity, phonology, and usability. Create source-grade mappings and hard-gate definitions.

**Step 2: Add scoring formulas**

Use bounded cross-sheet references. A failed gate returns zero. Before birth, final ranking equals cultural score; after birth, the user-set metaphysical weight blends a separate compatibility score.

**Step 3: Add post-birth status handling**

Empty actual birth fields must display `待出生后录入`; the system must never generate a fabricated favorable element or fortune statement.

### Task 4: Add presentation and navigation

**Files:**
- Modify: `build_complete_name_system.mjs`

**Step 1: Match the existing visual language**

Use ink green, muted gold, paper and pale jade colors; reserve blue font for editable inputs and green for formulas. Freeze panes on long tables, hide gridlines, cap widths, and wrap long source text.

**Step 2: Add dashboard summaries**

Show raw pool count, source-backed count, curated count, hard-gate pass count, birth status, current recommended names, and the next required action.

**Step 3: Add archive cards**

Create compact cards for the strongest feminine candidates, led by `王皎舒`, `王瑶碧`, and `王玉蕤`, while retaining risks and evidence.

### Task 5: Export and verify

**Files:**
- Create: `outputs/019fb1f8-0141-7962-9a84-aca9698006a2/王姓女孩完整取名系统.xlsx`

**Step 1: Run the builder**

Run the bundled Node executable with the bundled `node_modules` symlink.

**Step 2: Inspect key ranges**

Inspect dashboard, inputs, scoring formulas, source tables, raw pool count, post-birth state, and final ranking.

**Step 3: Scan errors**

Search the workbook for `#REF!`, `#DIV/0!`, `#VALUE!`, `#NAME?`, and `#N/A`; expected result is zero formula errors.

**Step 4: Render every sheet**

Render a representative used range for all twelve worksheets and visually inspect the previews. Fix clipped titles, unreadable headers, excessive row heights, or broken dashboard blocks.

**Step 5: Export final workbook**

Export one final `.xlsx` file without overwriting the earlier static audit workbook.

