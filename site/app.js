import { scoreFactions, scoreLists, nextBatch, breakdown } from "./score.js";

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
  const shownAt = Date.now();
  const answer = (v) => {
    if (Date.now() - shownAt < 350) return; // a double tap must not also answer the next card
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

const listById = (id) => data.lists.find((l) => l.id === id);

function badge(list) {
  return list && list.letters ? h("span", { class: "letters", title: "האותיות על פתק ההצבעה" }, list.letters) : null;
}

function resultRows(rows, isList) {
  return h("ol", { class: "rows" }, rows.map((r) => {
    const href = isList ? `#list/${r.id}` : `#faction/${encodeURIComponent(r.name)}`;
    const name = h("span", { class: "name" }, isList ? badge(listById(r.id)) : null, r.name);
    return r.pct === null
      ? h("li", { class: "row empty" },
          h("a", { class: "rowlink", href },
            h("div", { class: "head" }, name, h("span", { class: "pct" }, "—")),
            h("div", { class: "basis" }, isList && !hasListMks(r)
              ? "אין היסטוריית הצבעות: אין במקומות הריאליים ח״כים מהכנסת ה-25"
              : "אין נתונים על החוקים שעניתם")))
      : h("li", { class: "row" },
          h("a", { class: "rowlink", href },
            h("div", { class: "head" }, name, h("span", { class: "pct" }, `${r.pct}%`)),
            h("div", { class: "bar", "aria-hidden": "true" }, h("span", { style: `width:${r.pct}%` })),
            h("div", { class: "basis" }, basisLine(r, isList), " · פירוט ›")));
  }));
}

function lawRow(row) {
  const law = lawById(row.lawId);
  return h("li", { class: "lawrow" },
    h("div", { class: "head" }, h("span", {}, law.title), h("span", { class: "pct" }, `${row.pct}%`)),
    h("div", { class: "split", "aria-hidden": "true" },
      h("span", { class: "for", style: `width:${row.forPct}%` }),
      h("span", { class: "abs", style: `width:${row.abstainPct}%` }),
      h("span", { class: "against", style: `width:${row.againstPct}%` })),
    h("div", { class: "basis" },
      `ענית ${row.user ? "בעד" : "נגד"} · בעד ${row.forPct}% · נגד ${row.againstPct}%`,
      row.abstainPct ? ` · נמנעו/לא הצביעו ${row.abstainPct}%` : "",
      ` · ${row.n === 1 ? "ח״כ אחד" : row.n + " ח״כים"}`));
}

function renderEntity(kind, key) {
  const list = kind === "list" ? listById(key) : null;
  if (kind === "list" && !list) { location.hash = ""; return; }
  const rows = breakdown(state.answers, data, list ? { mkIds: list.mkIds } : { faction: key });
  const score = (list ? scoreLists(state.answers, data).find((r) => r.id === key)
    : scoreFactions(state.answers, data).find((r) => r.name === key)) || { pct: null };
  const agreed = rows.filter((r) => r.pct >= 50).sort((a, b) => b.pct - a.pct);
  const disagreed = rows.filter((r) => r.pct < 50).sort((a, b) => a.pct - b.pct);
  const poll = list && data.polls && data.polls.lists[list.id];
  show(
    h("a", { class: "back", href: "#" }, "‹ חזרה לתוצאות"),
    h("h1", {}, badge(list), list ? list.name : key),
    h("p", { class: "lead" }, score.pct === null ? "אין עדיין חוקים שעניתם עליהם ויש עליהם הצבעות של הקבוצה הזו."
      : `${score.pct}% התאמה, ${basisLine(score, !!list)}.`),
    list ? h("p", { class: "note" }, "לפי ההצבעות האישיות של מי שכיהנו בכנסת ה-25 ונמצאים במקומות הריאליים, גם אם ישבו אז בסיעה אחרת.")
      : h("p", { class: "note" }, "לפי ח״כים שישבו בסיעה הזו ביום כל הצבעה."),
    agreed.length ? [h("h2", {}, `הסכמתם (${agreed.length})`), h("ol", { class: "rows" }, agreed.map(lawRow))] : null,
    disagreed.length ? [h("h2", {}, `לא הסכמתם (${disagreed.length})`), h("ol", { class: "rows" }, disagreed.map(lawRow))] : null,
    list ? [
      h("h2", {}, "המקומות הריאליים ברשימה"),
      poll ? h("p", { class: "note" }, `בסקרים האחרונים (${data.polls.polls} סקרים, ${formatDate(data.polls.since)}–${formatDate(data.polls.until)}): עוברת את אחוז החסימה ב-${poll.passing} מתוך ${poll.polled}, ממוצע ${poll.avgSeats} מנדטים.`) : null,
      h("ol", { class: "cands" }, list.candidates.map((c) =>
        h("li", {}, c.name, c.mkId ? h("span", { class: "tag" }, "כיהן/ה בכנסת ה-25") : null))),
      h("p", { class: "note" }, h("a", { href: "#info" }, "עוד על הרשימה במידע לבוחר ›")),
    ] : null,
  );
}

function renderInfo() {
  const info = data.voterinfo;
  const polls = data.polls;
  const day = info && info.electionDay;
  const surplus = (id) => ((info && info.surplusAgreements) || [])
    .filter((a) => a.a === id || a.b === id).map((a) => listById(a.a === id ? a.b : a.a)).filter(Boolean);
  show(
    h("a", { class: "back", href: "#" }, "‹ חזרה"),
    h("h1", {}, "מידע לבוחר"),
    day ? h("section", { class: "card info" },
      h("h2", {}, "יום הבחירות: שלישי, 27 באוקטובר 2026"),
      h("ul", {},
        day.hours ? h("li", {}, day.hours) : null,
        day.id ? h("li", {}, day.id) : null,
        day.dayOff ? h("li", {}, day.dayOff) : null,
        day.findStation ? h("li", {}, h("a", { href: day.findStation, target: "_blank", rel: "noopener" }, "איתור הקלפי שלך באתר ועדת הבחירות")) : null),
      day.howSeatsWork ? [h("h2", {}, "איך קול הופך למנדט"), h("p", {}, day.howSeatsWork)] : null) : null,
    h("h2", {}, "הרשימות"),
    h("p", { class: "note" }, "אותיות הפתק והסכמי העודפים: לפי פרסומי ועדת הבחירות המרכזית (ילקוט הפרסומים 15045, 19.10.2026)."),
    polls ? h("p", { class: "note" }, `נתוני הסקרים: ${polls.polls} סקרים אחרונים, אחד מכל גוף סוקר, ${formatDate(polls.since)}–${formatDate(polls.until)}. מ-24.10 אסור לפרסם סקרים חדשים.`) : null,
    data.lists.map((list) => {
      const li = info && info.lists && info.lists[list.id];
      const poll = polls && polls.lists[list.id];
      const partners = surplus(list.id);
      return h("section", { class: "card info", id: `info-${list.id}` },
        h("h2", {}, badge(list), list.name),
        li && li.leader ? h("p", { class: "meta" }, `בראש הרשימה: ${li.leader}`) : null,
        poll ? h("p", {}, `בסקרים: עוברת את אחוז החסימה ב-${poll.passing} מתוך ${poll.polled} סקרים · ממוצע ${poll.avgSeats} מנדטים`) : null,
        h("p", {}, "מצע: ", li && li.platformUrl ? h("a", { href: li.platformUrl, target: "_blank", rel: "noopener" }, "למצע המפלגה") : "לא מצאנו מצע שפורסם לבחירות האלה"),
        li && li.platformNote ? h("p", { class: "meta" }, li.platformNote) : null,
        li && li.website ? h("p", { class: "meta" }, h("a", { href: li.website, target: "_blank", rel: "noopener" }, "אתר המפלגה")) : null,
        li && li.planUrls && li.planUrls.length ? h("p", {}, "תוכניות שפורסמו: ", li.planUrls.flatMap((p, i) =>
          [i ? " · " : "", h("a", { href: p.url, target: "_blank", rel: "noopener" }, (p.title || "").trim() || "קישור")])) : null,
        h("p", {}, "הסכם עודפים: ", partners.length ? partners.map((p) => p.name).join(", ") : "לא חתמה על הסכם עודפים"),
        h("p", { class: "meta" }, "10 הראשונים: ", list.candidates.slice(0, 10).map((c) => c.name).join(" · ")),
        h("p", {}, h("a", { href: `#list/${list.id}` }, "איך הצביעו חברי הרשימה לעומתכם ›")));
    }),
  );
}

function route() {
  const hash = decodeURIComponent(location.hash.slice(1));
  if (hash.startsWith("list/")) return renderEntity("list", hash.slice(5));
  if (hash.startsWith("faction/")) return renderEntity("faction", hash.slice(8));
  if (hash === "info") return renderInfo();
  if (Object.keys(state.answers).length) renderResults();
  else renderStart();
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
    try {
      await navigator.share({ text });
      return;
    } catch (e) {
      if (e && e.name === "AbortError") return; // user cancelled
    }
  }
  // no Web Share, or it failed (common in in-app browsers)
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
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
      Object.keys(state.answers).length ? h("button", { class: "btn link", onclick: reset }, "להתחיל מחדש") : null),
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
  window.addEventListener("hashchange", route);
  route();
}

main();
