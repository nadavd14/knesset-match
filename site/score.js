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

export function nextBatch(data, answers, categories, n = 10, rand = Math.random) {
  const pool = data.laws
    .filter((l) => !(l.id in answers))
    .filter((l) => !categories.length || categories.includes(l.category))
    .map((l) => l.id);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}
