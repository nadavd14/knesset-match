import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreFactions, scoreLists, nextBatch, breakdown, scoreDeclared, declaredBreakdown } from "../site/score.js";

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

const mixed = {
  laws: [
    ...[1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({ id, category: "כלכלה", passed: true })),
    ...[11, 12, 13].map((id) => ({ id, category: "כלכלה", passed: false })),
  ],
  votes: {},
  lists: [],
};
const passedCount = (ids) => ids.filter((id) => id < 10).length;

test("nextBatch balances passed and rejected", () => {
  const ids = nextBatch(mixed, {}, [], 6);
  assert.equal(ids.length, 6);
  assert.equal(passedCount(ids), 3);
});

test("nextBatch tops up from the other pool when one runs out", () => {
  const ids = nextBatch(mixed, {}, [], 10);
  assert.equal(ids.length, 10);
  assert.equal(passedCount(ids), 7); // only 3 rejected exist
});

test("nextBatch interleaves so a batch never front-loads one pool", () => {
  const ids = nextBatch(mixed, {}, [], 6);
  assert.equal(passedCount(ids.slice(0, 2)), 1);
});

test("nextBatch caps at n", () => {
  assert.equal(nextBatch(data, {}, [], 2).length, 2);
});

test("breakdown by faction gives per-law shares and agreement", () => {
  const rows = breakdown({ 1: 1, 2: null }, data, { faction: "A" });
  assert.equal(rows.length, 1); // don't-know excluded
  assert.deepEqual(rows[0], { lawId: "1", user: 1, n: 5, forPct: 60, againstPct: 40, abstainPct: 0, pct: 60 });
});

test("breakdown by MK ids uses personal votes and skips laws with no votes", () => {
  const rows = breakdown({ 1: 0, 3: 1 }, data, { mkIds: ["11", "21"] });
  assert.equal(rows.length, 1); // law 3 has no votes from these MKs
  assert.deepEqual(rows[0], { lawId: "1", user: 0, n: 2, forPct: 50, againstPct: 0, abstainPct: 50, pct: 25 });
});

const decl = {
  lists: [{ id: "x", name: "X" }, { id: "y", name: "Y" }, { id: "z", name: "Z" }],
  declared: {
    laws: [1, 2, 3],
    lists: {
      x: { positions: { 1: { stance: "for", sources: [{ url: "u" }] }, 2: { stance: "mixed" }, 3: { stance: "none" } } },
      y: { positions: { 1: { stance: "against" }, 2: { stance: "none" }, 3: { stance: "none" } } },
      z: { positions: {} },
    },
  },
};

test("declared: for/against/mixed scored, none skipped", () => {
  const r = Object.fromEntries(scoreDeclared({ 1: 1, 2: 1, 3: 0, 9: 1 }, decl).map((x) => [x.id, x]));
  assert.equal(r.x.pct, 75); // law1 1, law2 0.5; law3 none
  assert.equal(r.x.laws, 2);
  assert.equal(r.x.answered, 3); // answered laws that are in the declared set
  assert.equal(r.y.pct, 0);
  assert.equal(r.z.pct, null);
});

test("declared: dont-know and laws outside the set are ignored", () => {
  const r = Object.fromEntries(scoreDeclared({ 1: null, 9: 1 }, decl).map((x) => [x.id, x]));
  assert.equal(r.x.pct, null);
  assert.equal(r.x.answered, 0);
});

test("declared: sorted desc with nulls last", () => {
  assert.deepEqual(scoreDeclared({ 1: 0 }, decl).map((x) => x.id), ["y", "x", "z"]);
});

test("declaredBreakdown lists each answered declared law with stance and sources", () => {
  const rows = declaredBreakdown({ 1: 0, 2: 1, 3: 1 }, decl, "x");
  assert.deepEqual(rows.map((r) => [r.lawId, r.stance, r.pct]), [["1", "for", 0], ["2", "mixed", 50], ["3", "none", null]]);
  assert.deepEqual(rows[0].sources, [{ url: "u" }]);
});

test("declared view absent in data gives empty results", () => {
  assert.deepEqual(scoreDeclared({ 1: 1 }, { lists: [] }), []);
});

test("declared: below the minimum basis the score is withheld", () => {
  const r = Object.fromEntries(scoreDeclared({ 1: 1 }, decl, 2).map((x) => [x.id, x]));
  assert.equal(r.x.pct, null); // only 1 declared stance among answered laws
  assert.equal(r.x.laws, 1);
  assert.equal(r.x.thin, true);
  const ok = Object.fromEntries(scoreDeclared({ 1: 1, 2: 1 }, decl, 2).map((x) => [x.id, x]));
  assert.equal(ok.x.pct, 75);
  assert.equal(ok.x.thin, false);
});
