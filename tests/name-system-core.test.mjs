import test from "node:test";
import assert from "node:assert/strict";

import {
  characterDictionary,
  classicalFragments,
  curatedCandidates,
} from "../src/name-system-data.mjs";
import {
  generateAllusionCandidates,
  generateRawPool,
  validateSystemData,
} from "../src/name-system-core.mjs";

test("character dictionary is large enough and has unique characters", () => {
  assert.ok(characterDictionary.length >= 145);
  const chars = characterDictionary.map((item) => item.char);
  assert.equal(new Set(chars).size, chars.length);
});

test("raw generation creates at least 20,000 unique Wang names", () => {
  const pool = generateRawPool(characterDictionary);
  assert.ok(pool.length >= 20_000);
  assert.equal(new Set(pool.map((item) => item.name)).size, pool.length);
  assert.ok(pool.every((item) => item.name.startsWith("王")));
});

test("raw generation excludes identical double characters and attaches proxies", () => {
  const pool = generateRawPool(characterDictionary);
  assert.ok(pool.every((item) => item.first !== item.second));
  assert.ok(pool.every((item) => item.status === "待核典"));
  assert.ok(pool.every((item) => Number.isFinite(item.feminineProxy)));
  assert.ok(pool.every((item) => Number.isFinite(item.familyProxy)));
  assert.ok(pool.every((item) => item.firstCategory && item.secondCategory));
});

test("source-backed generation preserves auditable metadata", () => {
  const set = new Set(characterDictionary.map((item) => item.char));
  const candidates = generateAllusionCandidates(classicalFragments, set);
  assert.ok(candidates.length >= 500);
  assert.ok(
    candidates.every(
      (item) =>
        item.source &&
        item.quote &&
        item.extraction &&
        item.grade &&
        item.url,
    ),
  );
});

test("system data passes integrity validation", () => {
  const result = validateSystemData({
    characters: characterDictionary,
    fragments: classicalFragments,
    curated: curatedCandidates,
  });
  assert.deepEqual(result.errors, []);
  assert.ok(result.summary.characters >= 145);
  assert.ok(result.summary.fragments >= 30);
  assert.ok(result.summary.curated >= 20);
});

