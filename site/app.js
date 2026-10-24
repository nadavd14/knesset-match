import { scoreFactions, scoreLists, nextBatch, breakdown, scoreDeclared, declaredBreakdown } from "./score.js";

const CATEGORIES = ["ביטחון", "משפט ושלטון", "כלכלה", "חברה ורווחה", "דת ומדינה", "חינוך ותרבות", "פנים וסביבה"];
const BATCH = 10;
const MIN_DECLARED = 3; // declared-positions score needs statements on at least this many answered laws
const KEY = "km.v1";
const app = document.getElementById("app");

let data;
const state = { answers: {}, categories: [], batch: [], idx: 0, tab: "lists", focus: false };

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
  const wrap = h("div", { class: "fade" }, ...nodes.flat().filter((n) => n != null && n !== false));
  app.replaceChildren(wrap);
  window.scrollTo({ top: 0 });
  const page = location.hash.startsWith("#info") ? "info" : "quiz";
  document.querySelectorAll("[data-nav]").forEach((a) =>
    a.dataset.nav === page ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
}

const answeredCount = () => Object.values(state.answers).filter((v) => v === 0 || v === 1).length;
const lawById = (id) => data.laws.find((l) => l.id === Number(id));
const formatDate = (iso) => iso.split("-").reverse().join(".");

const declaredSet = () => new Set((data.declared?.laws || []).map(Number));
const poolData = () => state.focus ? { ...data, laws: data.laws.filter((l) => declaredSet().has(l.id)) } : data;

function startBatch() {
  state.batch = nextBatch(poolData(), state.answers, state.focus ? [] : state.categories, BATCH);
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
  const started = Object.keys(state.answers).length > 0;
  show(
    h("section", { class: "hero" },
      h("span", { class: "eyebrow" }, "בחירות לכנסת ה-26 · שלישי, 27 באוקטובר"),
      h("h1", {}, "עם מי אתם באמת מסכימים?"),
      h("p", { class: "lead" }, "עונים על חוקים אמיתיים שהכנסת היוצאת הצביעה עליהם, ורואים אילו רשימות הצביעו כמוכם."),
      h("ol", { class: "steps" },
        h("li", {}, h("b", {}, "1"), "בוחרים נושאים"),
        h("li", {}, h("b", {}, "2"), "עונים בעד או נגד"),
        h("li", {}, h("b", {}, "3"), "רואים התאמה לכל רשימה"))),
    h("div", { class: "card" },
      h("h2", {}, "על מה תרצו לענות?"),
      h("div", { class: "chips", role: "group", "aria-label": "נושאים" },
        h("button", { class: "chip", "aria-pressed": String(all), onclick: () => toggle(null) }, "כל הנושאים"),
        CATEGORIES.filter((c) => data.laws.some((l) => l.category === c)).map((c) =>
          h("button", { class: "chip", "aria-pressed": String(state.categories.includes(c)), onclick: () => toggle(c) }, c))),
      h("button", { class: "btn wide big", onclick: startBatch }, started ? "ממשיכים לענות" : "מתחילים"),
      started ? h("div", { class: "linkrow" }, h("button", { class: "btn link", onclick: renderResults }, "לתוצאות שלי")) : null),
    h("div", { class: "facts" },
      h("span", {}, `${data.laws.length} חוקים והצעות`), h("span", {}, "·"),
      h("span", {}, `${data.lists.length} רשימות`), h("span", {}, "·"),
      h("span", {}, "🔒 בלי הרשמה, התשובות נשארות אצלכם")),
  );
}

function argLink(sources, side) {
  const src = (sources || []).find((x) => x.side === side && x.url);
  return src ? [" ", h("a", { href: src.url, target: "_blank", rel: "noopener", class: "srclink" }, "(מקור)")] : null;
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
  const undo = () => {
    state.idx -= 1;
    delete state.answers[state.batch[state.idx]];
    save();
    renderCard();
  };
  const n = state.idx + 1;
  const total = state.batch.length;
  show(
    h("div", { class: "quizbar" },
      state.idx > 0 ? h("button", { class: "undo", onclick: undo }, "‹ הקודם") : null,
      h("div", { class: "track", "aria-hidden": "true" }, h("div", { class: "fill", style: `width:${(n / total) * 100}%` })),
      h("span", {}, `${n} מתוך ${total}`)),
    h("article", { class: "card" },
      h("div", { class: "cardmeta" },
        h("span", { class: "cat" }, law.category),
        h("span", { class: "meta" }, formatDate(law.voteDate))),
      h("h2", { class: "law" }, law.title),
      h("p", { class: "summary" }, law.summary),
      h("details", { class: "more" },
        h("summary", {}, "פרטים נוספים"),
        h("p", {}, law.details),
        law.args ? h("div", { class: "args" },
          h("p", {}, h("b", {}, "בעד: "), law.args.for, argLink(law.args.sources, "for")),
          h("p", {}, h("b", {}, "נגד: "), law.args.against, argLink(law.args.sources, "against"))) : null,
        h("p", { class: "meta" }, h("a", { href: law.url, target: "_blank", rel: "noopener" }, "לעמוד החוק באתר הכנסת")))),
    h("div", { class: "answers", role: "group", "aria-label": "התשובה שלך" },
      h("button", { class: "btn", onclick: () => answer(1) }, "✓ בעד"),
      h("button", { class: "skip", onclick: () => answer(null) }, "לא יודע"),
      h("button", { class: "btn ghost", onclick: () => answer(0) }, "✕ נגד")),
  );
}

function basisLine(r, isList) {
  const laws = r.laws === 1 ? "לפי חוק אחד" : `לפי ${r.laws} חוקים`;
  const mks = r.mks === 1 ? "ח״כ אחד" : `${r.mks} ח״כים`;
  return isList ? `${laws} · ${mks} לשעבר מתוך ${r.total} מקומות ריאליים` : `${laws} · ${mks}`;
}

const listById = (id) => data.lists.find((l) => l.id === id);

function badge(list) {
  if (!list) return null;
  return h("span", { class: "badge" },
    list.logo ? h("img", { class: "logo", src: list.logo, alt: "", loading: "lazy" }) : null,
    list.letters ? h("span", { class: "letters", title: "האותיות על פתק ההצבעה" }, list.letters) : null);
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
            h("div", { class: "basis" }, basisLine(r, isList), h("span", { class: "chev" }, " ›"))));
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
    h("div", { class: "entity-head" }, list && list.logo ? h("img", { class: "logo", src: list.logo, alt: "" }) : null,
      h("h1", {}, list ? list.name : key), list && list.letters ? h("span", { class: "letters" }, list.letters) : null),
    score.pct === null
      ? h("p", { class: "lead" }, "אין עדיין חוקים שעניתם עליהם ויש עליהם הצבעות של הקבוצה הזו.")
      : h("div", { class: "entity-score" }, h("span", { class: "big" }, `${score.pct}%`), h("span", { class: "meta" }, `התאמה בהצבעות · ${basisLine(score, !!list)}`)),
    list ? h("p", { class: "note" }, "לפי ההצבעות האישיות של מי שכיהנו בכנסת ה-25 ונמצאים במקומות הריאליים, גם אם ישבו אז בסיעה אחרת.")
      : h("p", { class: "note" }, "לפי ח״כים שישבו בסיעה הזו ביום כל הצבעה."),
    agreed.length ? [h("h2", { class: "section-title" }, `הסכמתם (${agreed.length})`), h("div", { class: "card" }, h("ol", { class: "rows" }, agreed.map(lawRow)))] : null,
    disagreed.length ? [h("h2", { class: "section-title" }, `לא הסכמתם (${disagreed.length})`), h("div", { class: "card" }, h("ol", { class: "rows" }, disagreed.map(lawRow)))] : null,
    list ? declaredSection(list) : null,
    list ? [
      h("h2", { class: "section-title" }, "המקומות הריאליים ברשימה"),
      poll ? h("p", { class: "note" }, `בסקרים האחרונים (${data.polls.polls} סקרים, ${formatDate(data.polls.since)}–${formatDate(data.polls.until)}): עוברת את אחוז החסימה ב-${poll.passing} מתוך ${poll.polled}, ממוצע ${poll.avgSeats} מנדטים.`) : null,
      h("div", { class: "card" }, h("ol", { class: "cands" }, list.candidates.map((c) =>
        h("li", {}, c.name, c.mkId ? h("span", { class: "tag" }, "ח״כ בכנסת ה-25") : null)))),
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
    h("h1", {}, "מידע לבוחר"),
    h("p", { class: "lead" }, "כל מה שצריך לדעת לפני שלישי: מתי ואיך מצביעים, ומי הרשימות."),
    day ? h("section", { class: "card info" },
      h("h2", {}, "יום הבחירות: שלישי, 27 באוקטובר 2026"),
      h("ul", {},
        day.hours ? h("li", {}, day.hours) : null,
        day.id ? h("li", {}, day.id) : null,
        day.dayOff ? h("li", {}, day.dayOff) : null,
        day.findStation ? h("li", {}, h("a", { href: day.findStation, target: "_blank", rel: "noopener" }, "איתור הקלפי שלך באתר ועדת הבחירות")) : null),
      day.howSeatsWork ? [h("h2", {}, "איך קול הופך למנדט"), h("p", {}, day.howSeatsWork)] : null) : null,
    h("h2", { class: "section-title" }, "הרשימות"),
    h("nav", { class: "jump", "aria-label": "קפיצה לרשימה" }, data.lists.map((l) => h("a", { href: `#info`, onclick: (e) => { e.preventDefault(); document.getElementById(`info-${l.id}`)?.scrollIntoView({ behavior: "smooth" }); } }, l.name))),
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

const STANCE_LABEL = { for: "בעד", against: "נגד", mixed: "הצהרות סותרות", none: "אין הצהרה" };

function declaredRows(rows) {
  return h("ol", { class: "rows" }, rows.map((r) => {
    const name = h("span", { class: "name" }, badge(listById(r.id)), r.name);
    const href = `#list/${r.id}`;
    return r.pct === null
      ? h("li", { class: "row empty" }, h("a", { class: "rowlink", href },
          h("div", { class: "head" }, name, h("span", { class: "pct" }, "—")),
          h("div", { class: "basis" }, r.thin
            ? `נמצאו הצהרות רק על ${r.laws === 1 ? "חוק אחד" : r.laws + " חוקים"} מאלה שעניתם, מעט מדי לציון`
            : "לא מצאנו הצהרות על החוקים שעניתם")))
      : h("li", { class: "row" }, h("a", { class: "rowlink", href },
          h("div", { class: "head" }, name, h("span", { class: "pct" }, `${r.pct}%`)),
          h("div", { class: "bar", "aria-hidden": "true" }, h("span", { style: `width:${r.pct}%` })),
          h("div", { class: "basis" }, `לפי הצהרות על ${r.laws} מתוך ${r.answered} חוקים שעניתם · מקורות`, h("span", { class: "chev" }, " ›"))));
  }));
}

function topMatch(rows, kind) {
  const top = rows.find((r) => r.pct !== null);
  if (!top) return null;
  const list = kind !== "factions" ? listById(top.id) : null;
  const href = list ? `#list/${top.id}` : `#faction/${encodeURIComponent(top.name)}`;
  return h("a", { class: "card topmatch", href },
    h("div", { class: "who" }, h("small", {}, kind === "factions" ? "הסיעה הכי קרובה אליך" : "הרשימה הכי קרובה אליך"),
      h("span", { class: "name" }, badge(list), h("strong", {}, top.name))),
    h("span", { class: "big" }, `${top.pct}%`));
}

function renderResults() {
  const count = answeredCount();
  const lists = scoreLists(state.answers, data);
  const factions = scoreFactions(state.answers, data).filter((r) => r.pct !== null);
  const declared = scoreDeclared(state.answers, data, MIN_DECLARED);
  const tab = state.tab;
  const declaredAnswered = declared.length ? declared[0].answered : 0;
  const remaining = nextBatch(poolData(), state.answers, state.focus ? [] : state.categories, 1).length;
  const setTab = (t) => { state.tab = t; renderResults(); };
  const tabBtn = (id, label) => h("button", { class: "tab", role: "tab", "aria-selected": String(tab === id), onclick: () => setTab(id) }, label);
  const focusDeclared = () => { state.focus = true; startBatch(); };

  show(
    h("h1", {}, "התוצאות שלך"),
    h("p", { class: "lead" }, count
      ? `על סמך ${count} חוקים שעניתם עליהם בעד או נגד.`
      : "עדיין אין תשובות בעד או נגד להשוואה. ענו על כמה חוקים כדי לראות תוצאות."),
    count ? [
      h("div", { class: "tabs", role: "tablist" },
        tabBtn("lists", "רשימות 2026"), tabBtn("factions", "סיעות הכנסת ה-25"),
        data.declared ? tabBtn("declared", "עמדות מוצהרות") : null),
      topMatch(tab === "lists" ? lists : tab === "factions" ? factions : declared, tab),
      tab === "lists" ? [h("p", { class: "note" }, "לפי ההצבעות של מועמדים במקומות ריאליים שכיהנו בכנסת ה-25. מועמדים חדשים לא נספרים."), h("div", { class: "card" }, resultRows(lists, true))]
      : tab === "factions" ? [h("p", { class: "note" }, "לפי הסיעה שבה ישב כל ח״כ ביום ההצבעה."), h("div", { class: "card" }, resultRows(factions, false))]
      : [h("p", { class: "note" }, `לפי מה שהרשימות ומועמדיהן הבולטים אמרו וכתבו בפומבי (מצעים, ראיונות, נאומים) על ${data.declared.laws.length} חוקים והצעות בולטים, עם מקור לכל עמדה. הצהרות סותרות = חצי; אין הצהרה = לא נספר. כאן גם רשימות חדשות מקבלות ציון.`),
          declaredAnswered < 5 ? h("button", { class: "btn ghost wide", onclick: focusDeclared },
            declaredAnswered ? `עניתם על ${declaredAnswered} מהחוקים האלה. ענו על עוד כדי לחדד` : "ענו על החוקים שיש עליהם הצהרות") : null,
          h("div", { class: "card" }, declaredRows(declared))],
    ] : null,
    h("div", { class: "actions" },
      remaining
        ? h("button", { class: "btn wide", onclick: startBatch }, state.focus ? "עוד חוקים עם הצהרות" : `עוד ${BATCH} חוקים`)
        : h("p", { class: "note" }, state.focus ? "עניתם על כל החוקים שיש עליהם הצהרות." : "עניתם על כל החוקים בקטגוריות שבחרתם."),
      state.focus ? h("button", { class: "btn link", onclick: () => { state.focus = false; renderResults(); } }, "חזרה לכל החוקים") : null,
      count ? h("button", { class: "btn ghost wide", onclick: () => share(shareText(lists)) }, "שתפו") : null,
      h("div", { class: "linkrow" },
        h("button", { class: "btn link", onclick: renderStart }, "שינוי נושאים"),
        Object.keys(state.answers).length ? h("button", { class: "btn link", onclick: reset }, "להתחיל מחדש") : null)),
  );
}

function sourceLinks(sources) {
  return sources.map((src) => h("blockquote", { class: "src" },
    src.quote ? `"${src.quote}"` : null,
    h("div", { class: "meta" }, [src.speaker, src.date].filter(Boolean).join(" · "),
      src.url ? [" · ", h("a", { href: src.url, target: "_blank", rel: "noopener" }, "מקור")] : null)));
}

function declaredSection(list) {
  const d = data.declared?.lists[list.id];
  if (!d) return null;
  const answeredRows = declaredBreakdown(state.answers, data, list.id).filter((r) => r.stance !== "none");
  const all = (data.declared.laws || []).map((id) => [id, d.positions[id]]).filter(([, p]) => p && p.stance !== "none");
  return [
    h("h2", { class: "section-title" }, "עמדות מוצהרות"),
    h("p", { class: "note" }, `מצאנו עמדה פומבית עם מקור על ${all.length} מתוך ${data.declared.laws.length} החוקים הבולטים. היכן שלא מצאנו, החוק לא נספר.`),
    answeredRows.length ? h("p", { class: "note" }, `בחוקים שעניתם עליהם: ${answeredRows.filter((r) => r.pct === 100).length} התאמות, ${answeredRows.filter((r) => r.pct === 0).length} אי-התאמות, ${answeredRows.filter((r) => r.pct === 50).length} הצהרות סותרות.`) : null,
    all.length ? h("div", { class: "card" }, h("ol", { class: "rows" }, all.map(([id, p]) => {
      const law = lawById(id);
      const mine = state.answers[id];
      return h("li", { class: "lawrow" },
        h("div", { class: "head" }, h("span", {}, law.title), h("span", { class: `stance ${p.stance}` }, STANCE_LABEL[p.stance])),
        mine === 0 || mine === 1 ? h("div", { class: "basis" }, `ענית ${mine ? "בעד" : "נגד"}`) : null,
        p.note ? h("p", { class: "meta" }, p.note) : null,
        sourceLinks(p.sources || []));
    }))) : h("p", { class: "note" }, "לא מצאנו הצהרות פומביות של הרשימה על החוקים הבולטים."),
    d.statements && d.statements.length ? [h("h2", { class: "section-title" }, "הצהרות בולטות בקמפיין"),
      h("div", { class: "card" }, h("ol", { class: "rows" }, d.statements.map((st) => h("li", { class: "lawrow" },
        h("div", { class: "head" }, h("span", {}, st.topic)), sourceLinks([st])))))] : null,
    d.partners && d.partners.length ? [h("h2", { class: "section-title" }, "הצהרות על שותפויות"),
      h("ul", { class: "card partners" }, d.partners.map((pt) => h("li", {}, pt.text, " ",
        h("span", { class: "meta" }, [pt.speaker, pt.date].filter(Boolean).join(" · "),
          pt.url ? [" · ", h("a", { href: pt.url, target: "_blank", rel: "noopener" }, "מקור")] : null))))] : null,
  ];
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
