import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreFactions, scoreLists, nextBatch } from "../site/score.js";

// law 1: A has 3 for + 2 against, B one abstain; law 2: A one for, B one against.
const data = {
  laws: [
    { id: 1, category: "כלכלה" },
    { id: 2, category: "ביטחון" },
    { id: 3, category: "ביטחון" },
    { id: 4, category: "חינוך ותרבות" },
  ],
  votes: {
    1: { 11: [1, "A"], 12: [1, "A"], 13: [1, "A"], 14: [0, "A"], 15: [0, "A"], 21: [0.5, "B"] },
    2: { 11: [1, "A"], 21: [0, "B"] },
    3: {},
    4: {},
  },
  lists: [
    { id: "x", name: "X", seats: 5, total: 5, mkIds: ["11", "21"] },
    { id: "y", name: "Y", seats: 3, total: 3, mkIds: [] },
  ],
};

const byName = (rows) => Object.fromEntries(rows.map((r) => [r.name, r]));

test("split faction gives proportional pct", () => {
  const r = byName(scoreFactions({ 1: 1 }, data));
  assert.equal(r.A.pct, 60);
  assert.equal(r.A.mks, 5);
  assert.equal(r.A.laws, 1);
});

test("abstain counts half", () => {
  assert.equal(byName(scoreFactions({ 1: 1 }, data)).B.pct, 50);
});

test("absent not counted", () => {
  const r = byName(scoreFactions({ 2: 1 }, data));
  assert.equal(r.A.pct, 100);
  assert.equal(r.A.mks, 1);
});

test("dont-know excluded", () => {
  const r = byName(scoreFactions({ 1: null, 2: 0 }, data));
  assert.equal(r.A.pct, 0);
  assert.equal(r.A.laws, 1);
});

test("all dont-know gives empty results", () => {
  const rows = scoreFactions({ 1: null, 2: null }, data);
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.pct === null));
  assert.ok(scoreLists({ 1: null }, data).every((r) => r.pct === null));
});

test("lists use personal votes of their MKs", () => {
  // law 1 user for: mk11 → 1, mk21 abstain → 0.5 ; law 2 user for: mk11 → 1, mk21 against → 0
  const r = byName(scoreLists({ 1: 1, 2: 1 }, data));
  assert.equal(r.X.pct, 63); // (1 + 0.5 + 1 + 0) / 4 = 62.5 → rounded
  assert.equal(r.X.mks, 2);
  assert.equal(r.X.laws, 2);
  assert.equal(r.X.total, 5);
});

test("list without MKs has null score and sorts last", () => {
  const rows = scoreLists({ 1: 1 }, data);
  assert.equal(rows.at(-1).name, "Y");
  assert.equal(rows.at(-1).pct, null);
});

test("results sorted descending", () => {
  const rows = scoreFactions({ 1: 0 }, data); // A: 2/5 = 40, B: 50
  assert.deepEqual(rows.map((r) => r.name), ["B", "A"]);
});

test("nextBatch respects categories", () => {
  const ids = nextBatch(data, {}, ["ביטחון"], 10);
  assert.deepEqual(ids.sort(), [2, 3]);
});

test("nextBatch with no categories means all", () => {
  assert.equal(nextBatch(data, {}, [], 10).length, 4);
});

test("nextBatch returns fewer when pool is exhausted", () => {
  const answers = { 1: 1 };
  const first = nextBatch(data, answers, [], 10);
  assert.equal(first.length, 3);
  for (const id of first) answers[id] = null;
  assert.deepEqual(nextBatch(data, answers, [], 10), []);
});

test("nextBatch caps at n", () => {
  assert.equal(nextBatch(data, {}, [], 2).length, 2);
});
