import { scoreFactions, scoreLists, nextBatch } from "./score.js";

const CATEGORIES = ["ביטחון", "משפט ושלטון", "כלכלה", "חברה ורווחה", "דת ומדינה", "חינוך ותרבות", "פנים וסביבה"];
const BATCH = 10;
const KEY = "km.v1";
const app = document.getElementById("app");

let data;
const state = { answers: {}, categories: [], batch: [], idx: 0, tab: "lists" };

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved && typeof saved.answers === "object") {
      state.answers = saved.answers;
      state.categories = Array.isArray(saved.categories) ? saved.categories : [];
    }
  } catch { /* storage unavailable: keep answers in memory */ }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ answers: state.answers, categories: state.categories }));
  } catch { /* ignore */ }
}

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? "" : v);
  }
  el.append(...children.flat().filter((c) => c != null && c !== false));
  return el;
}

function show(...nodes) {
  app.replaceChildren(...nodes.flat().filter((n) => n != null && n !== false));
  window.scrollTo({ top: 0 });
}

const answeredCount = () => Object.values(state.answers).filter((v) => v === 0 || v === 1).length;
const lawById = (id) => data.laws.find((l) => l.id === Number(id));
const formatDate = (iso) => iso.split("-").reverse().join(".");

function startBatch() {
  state.batch = nextBatch(data, state.answers, state.categories, BATCH);
  state.idx = 0;
  if (state.batch.length) renderCard();
  else renderResults();
}

function renderStart() {
  const all = !state.categories.length;
  const toggle = (cat) => {
    if (cat === null) state.categories = [];
    else if (state.categories.includes(cat)) state.categories = state.categories.filter((c) => c !== cat);
    else state.categories = [...state.categories, cat];
    save();
    renderStart();
  };
  show(
    h("h1", {}, "עם מי אתם באמת מסכימים?"),
    h("p", { class: "lead" },
      `${data.laws.length} חוקים אמיתיים שהכנסת ה-25 הצביעה עליהם. אתם עונים בעד, נגד או לא יודע, ואנחנו משווים להצבעות של חברי הכנסת: לפי הרשימות שרצות עכשיו ולפי הסיעות בכנסת היוצאת.`),
    h("h2", {}, "על מה תרצו לענות?"),
    h("div", { class: "chips", role: "group", "aria-label": "קטגוריות" },
      h("button", { class: "chip", "aria-pressed": String(all), onclick: () => toggle(null) }, "הכל"),
      CATEGORIES.filter((c) => data.laws.some((l) => l.category === c)).map((c) =>
        h("button", { class: "chip", "aria-pressed": String(state.categories.includes(c)), onclick: () => toggle(c) }, c))),
    h("button", { class: "btn wide", onclick: startBatch }, answeredCount() ? "ממשיכים" : "מתחילים"),
    answeredCount() ? h("button", { class: "btn link", onclick: renderResults }, "לתוצאות שלי") : null,
    h("p", { class: "privacy" }, "🔒 התשובות לא יוצאות מהמכשיר שלך. אין הרשמה ואין מעקב."),
  );
}

function renderCard() {
  const law = lawById(state.batch[state.idx]);
  const answer = (v) => {
    state.answers[law.id] = v;
    save();
    state.idx += 1;
    if (state.idx < state.batch.length) renderCard();
    else renderResults();
  };
  const n = state.idx + 1;
  const total = state.batch.length;
  show(
    h("div", { class: "progress" },
      h("span", {}, `${n}/${total}`),
      h("div", { class: "track" }, h("div", { class: "fill", style: `width:${(n / total) * 100}%` }))),
    h("article", { class: "card" },
      h("span", { class: "cat" }, law.category),
      h("h2", {}, law.title),
      h("p", { class: "summary" }, law.summary),
      h("details", { class: "more" },
        h("summary", {}, "קרא עוד"),
        h("p", {}, law.details),
        h("p", { class: "meta" }, `ההצבעה במליאה: ${formatDate(law.voteDate)} · `,
          h("a", { href: law.url, target: "_blank", rel: "noopener" }, "לעמוד החוק באתר הכנסת")))),
    h("div", { class: "answers" },
      h("button", { class: "btn", onclick: () => answer(1) }, "בעד"),
      h("button", { class: "btn ghost", onclick: () => answer(0) }, "נגד"),
      h("button", { class: "btn link", onclick: () => answer(null) }, "לא יודע / מדלג")),
  );
}

function basisLine(r, isList) {
  const laws = r.laws === 1 ? "לפי חוק אחד" : `לפי ${r.laws} חוקים`;
  const mks = r.mks === 1 ? "ח״כ אחד" : `${r.mks} ח״כים`;
  return isList ? `${laws} · ${mks} לשעבר מתוך ${r.total} מקומות ריאליים` : `${laws} · ${mks}`;
}

function resultRows(rows, isList) {
  return h("ol", { class: "rows" }, rows.map((r) =>
    r.pct === null
      ? h("li", { class: "row empty" },
          h("div", { class: "head" }, h("span", {}, r.name), h("span", { class: "pct" }, "—")),
          h("div", { class: "basis" }, isList && !hasListMks(r)
            ? "אין היסטוריית הצבעות: אין במקומות הריאליים ח״כים מהכנסת ה-25"
            : "אין נתונים על החוקים שעניתם"))
      : h("li", { class: "row" },
          h("div", { class: "head" }, h("span", {}, r.name), h("span", { class: "pct" }, `${r.pct}%`)),
          h("div", { class: "bar", "aria-hidden": "true" }, h("span", { style: `width:${r.pct}%` })),
          h("div", { class: "basis" }, basisLine(r, isList)))));
}

function hasListMks(r) {
  const list = data.lists.find((l) => l.id === r.id);
  return list && list.mkIds.length > 0;
}

function shareText(rows) {
  const top = rows.find((r) => r.pct !== null);
  const head = top ? `יצאתי ${top.pct}% התאמה עם ${top.name}.` : "בדקתי עם מי אני מסכים בכנסת.";
  return `${head} ומה איתך? מי מצביע כמוני: ${location.href.split("#")[0]}`;
}

async function share(text) {
  if (navigator.share) {
    try { await navigator.share({ text }); return; } catch { /* cancelled */ }
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }
}

function renderResults() {
  const count = answeredCount();
  const lists = scoreLists(state.answers, data);
  const factions = scoreFactions(state.answers, data).filter((r) => r.pct !== null);
  const isList = state.tab === "lists";
  const remaining = nextBatch(data, state.answers, state.categories, 1).length;
  const setTab = (t) => { state.tab = t; renderResults(); };

  show(
    h("h1", {}, "התוצאות שלך"),
    h("p", { class: "lead" }, count
      ? `על סמך ${count} חוקים שעניתם עליהם בעד או נגד.`
      : "עדיין אין תשובות בעד או נגד להשוואה. ענו על כמה חוקים כדי לראות תוצאות."),
    count ? [
      h("div", { class: "tabs", role: "tablist" },
        h("button", { class: "tab", role: "tab", "aria-selected": String(isList), onclick: () => setTab("lists") }, "רשימות 2026"),
        h("button", { class: "tab", role: "tab", "aria-selected": String(!isList), onclick: () => setTab("factions") }, "סיעות הכנסת ה-25")),
      isList
        ? h("p", { class: "note" }, "לפי ההצבעות של מועמדים במקומות ריאליים שכיהנו בכנסת ה-25. מועמדים חדשים לא נספרים.")
        : h("p", { class: "note" }, "לפי הסיעה שבה ישב כל ח״כ ביום ההצבעה."),
      resultRows(isList ? lists : factions, isList),
    ] : null,
    h("div", { class: "actions" },
      remaining
        ? h("button", { class: "btn wide", onclick: startBatch }, `עוד ${BATCH} חוקים`)
        : h("p", { class: "note" }, "עניתם על כל החוקים בקטגוריות שבחרתם."),
      count ? h("button", { class: "btn ghost wide", onclick: () => share(shareText(lists)) }, "שתפו") : null,
      h("button", { class: "btn link", onclick: renderStart }, "שינוי קטגוריות"),
      count ? h("button", { class: "btn link", onclick: reset }, "להתחיל מחדש") : null),
  );
}

function reset() {
  if (!confirm("למחוק את כל התשובות ולהתחיל מחדש?")) return;
  state.answers = {};
  save();
  renderStart();
}

async function main() {
  try {
    const res = await fetch("data/data.json");
    if (!res.ok) throw new Error(res.status);
    data = await res.json();
  } catch {
    app.replaceChildren(h("p", { class: "error" }, "לא הצלחנו לטעון את הנתונים, נסו לרענן."));
    return;
  }
  load();
  if (answeredCount()) renderResults();
  else renderStart();
}

main();
