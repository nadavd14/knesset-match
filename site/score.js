// Agreement scoring. Pure functions over data.json; no DOM.
// answers: { [lawId]: 1 | 0 | null }  (null = "don't know", law not counted)
// data.votes[lawId][mkId] = [code, faction]  code: 1 for, 0 against, 0.5 abstain/present

function answered(answers) {
  return Object.entries(answers).filter(([, v]) => v === 0 || v === 1);
}

function newAcc() {
  return { sum: 0, n: 0, laws: new Set(), mks: new Set() };
}

function add(acc, lawId, mkId, user, code) {
  acc.sum += 1 - Math.abs(user - code);
  acc.n += 1;
  acc.laws.add(lawId);
  acc.mks.add(mkId);
}

function finish(acc) {
  return {
    pct: acc.n ? Math.round((acc.sum / acc.n) * 100) : null,
    laws: acc.laws.size,
    mks: acc.mks.size,
  };
}

function byPct(a, b) {
  if (a.pct === null) return b.pct === null ? 0 : 1;
  if (b.pct === null) return -1;
  return b.pct - a.pct;
}

export function scoreFactions(answers, data) {
  const accs = new Map();
  for (const entry of Object.values(data.votes)) {
    for (const [, faction] of Object.values(entry)) {
      if (faction && !accs.has(faction)) accs.set(faction, newAcc());
    }
  }
  for (const [lawId, user] of answered(answers)) {
    for (const [mkId, [code, faction]] of Object.entries(data.votes[lawId] || {})) {
      if (faction) add(accs.get(faction), lawId, mkId, user, code);
    }
  }
  return [...accs].map(([name, acc]) => ({ name, ...finish(acc) })).sort(byPct);
}

export function scoreLists(answers, data) {
  const rows = data.lists.map((list) => {
    const acc = newAcc();
    for (const [lawId, user] of answered(answers)) {
      const entry = data.votes[lawId] || {};
      for (const mkId of list.mkIds) {
        if (entry[mkId]) add(acc, lawId, mkId, user, entry[mkId][0]);
      }
    }
    return { id: list.id, name: list.name, total: list.total, ...finish(acc) };
  });
  return rows.sort(byPct);
}

// Per answered law: how the given group voted (shares of counted MKs) and agreement with the user.
// who: { faction: name } (faction at vote date) or { mkIds: [...] } (personal votes, any faction).
export function breakdown(answers, data, who) {
  const rows = [];
  for (const [lawId, user] of answered(answers)) {
    const entry = data.votes[lawId] || {};
    const codes = who.faction
      ? Object.values(entry).filter(([, f]) => f === who.faction).map(([c]) => c)
      : who.mkIds.filter((id) => entry[id]).map((id) => entry[id][0]);
    if (!codes.length) continue;
    const share = (v) => Math.round((codes.filter((c) => c === v).length / codes.length) * 100);
    const agree = codes.reduce((s, c) => s + 1 - Math.abs(user - c), 0) / codes.length;
    rows.push({ lawId, user, n: codes.length, forPct: share(1), againstPct: share(0), abstainPct: share(0.5),
      pct: Math.round(agree * 100) });
  }
  return rows;
}

function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Half passed laws, half rejected bills, alternating; one pool tops up when the other runs out.
// Otherwise answering "for" to everything would mostly match whoever held the majority.
export function nextBatch(data, answers, categories, n = 10, rand = Math.random) {
  const open = data.laws
    .filter((l) => !(l.id in answers))
    .filter((l) => !categories.length || categories.includes(l.category));
  const pools = [
    shuffle(open.filter((l) => l.passed !== false).map((l) => l.id), rand),
    shuffle(open.filter((l) => l.passed === false).map((l) => l.id), rand),
  ];
  let turn = rand() < 0.5 ? 0 : 1;
  const out = [];
  while (out.length < n && (pools[0].length || pools[1].length)) {
    if (!pools[turn].length) turn = 1 - turn;
    out.push(pools[turn].shift());
    turn = 1 - turn;
  }
  return out;
}

// Declared positions (platforms and public statements), not votes.
// for = 1, against = 0, mixed (contradictory statements) = 0.5, none = law not counted.
const STANCE = { for: 1, against: 0, mixed: 0.5 };

function declaredAnswers(answers, data) {
  const set = new Set((data.declared?.laws || []).map(String));
  return answered(answers).filter(([lawId]) => set.has(lawId));
}

export function scoreDeclared(answers, data) {
  if (!data.declared) return [];
  const mine = declaredAnswers(answers, data);
  return data.lists.map((list) => {
    const positions = data.declared.lists[list.id]?.positions || {};
    let sum = 0, n = 0;
    for (const [lawId, user] of mine) {
      const v = STANCE[positions[lawId]?.stance];
      if (v === undefined) continue;
      sum += 1 - Math.abs(user - v);
      n += 1;
    }
    return { id: list.id, name: list.name, pct: n ? Math.round((sum / n) * 100) : null, laws: n, answered: mine.length };
  }).sort(byPct);
}

export function declaredBreakdown(answers, data, listId) {
  const positions = data.declared?.lists[listId]?.positions || {};
  return declaredAnswers(answers, data).map(([lawId, user]) => {
    const p = positions[lawId] || { stance: "none" };
    const v = STANCE[p.stance];
    return { lawId, user, stance: p.stance, pct: v === undefined ? null : Math.round((1 - Math.abs(user - v)) * 100),
      sources: p.sources || [], note: p.note };
  });
}
