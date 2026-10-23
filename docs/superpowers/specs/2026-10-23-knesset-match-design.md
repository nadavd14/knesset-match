# Knesset Match — Design

**Date:** 2026-10-23 · **Ship target:** live today (2026-10-23), elections on 2026-10-27.

## Goal
A public, free, Hebrew, mobile-first website: the user votes on real laws that went to a vote in the 25th Knesset (for / against / don't know) and sees how closely they agree with each party, both by the **26th Knesset lists** (realistic spots) and by the **25th Knesset factions**. Neutral and fact-based: it only shows how answers line up with actual votes, never recommends who to vote for.

## Scope
- v1: **80 laws**. Right after: grow to **200**.
- Hosting: public GitHub repo `knesset-match` + GitHub Pages (free).
- No server, no analytics, no data sent anywhere. All computation in the browser.

## Data sources
- Knesset OData V4: `https://knesset.gov.il/OdataV4/ParliamentInfo/`
  - `KNS_Bill` — bills (`KnessetNum=25`, `StatusID=118` passed; `SummaryLaw` official summary; `CommitteeID`).
  - `KNS_PlenumVote` — plenum votes; `ItemID` = `KNS_Bill.Id`.
  - `KNS_PlenumVoteResult` — per-MK result (`MkId`, `ResultDesc`: בעד / נגד / נמנע / נוכח).
  - `KNS_Committee` — committee names → category.
- 26th Knesset lists: Central Elections Committee PDFs (mirrored on idi.org.il), read manually; checked against press coverage.
- Polls: recent poll average (snapshot date shown on the site).

## Vote selection
- Per bill, the **final whole-bill vote**: latest `KNS_PlenumVote` for that `ItemID` whose `VoteSubject` is empty (not a section/reservation vote).
- Keep only votes with **≥ 40 MKs** recorded as בעד/נגד/נמנע.
- From the pool, pick 80 (later 200) laws that are meaningful to ordinary voters and spread across categories; prefer contested votes (a real split between for and against) over near-unanimous ones.

## Categories
Derived from the bill's committee (e.g. Foreign Affairs & Defense → ביטחון; Education → חינוך; Finance → כלכלה; Constitution, Law & Justice → משפט ושלטון; Labor & Welfare / Health → חברה ורווחה; Interior → פנים ושלטון מקומי, …). Hand-correct obvious misfits. UI: multi-select chips plus "הכל" (default).

## Content per law
`id, title (short, plain), summary (≤2 lines), details (expanded paragraph), category, voteDate, knessetUrl`. Written from `SummaryLaw` / explanatory notes, in neutral language: what the law does, not whether it is good. No adjectives that take a side. A subagent runs a neutrality review pass.

## Scoring
Per answered law (user chose for/against; "don't know" excludes the law):
- For each MK who voted: same as the user = 1, opposite = 0, **נמנע / נוכח = 0.5**. **Absent (no record) = not counted.**
- **Faction view (25th):** score = mean over all counted MK-law pairs for MKs of that faction at the time of the vote.
- **Lists view (26th, default):** take candidates in realistic spots (**poll-average seats + 2**) who were 25th-Knesset MKs; score from their **personal** votes, whatever faction they sat in.
- Every score shows its basis: "לפי N הצבעות · M ח״כים" (lists: "M מתוך K מקומות ריאליים").
- A list with no sitting MKs in realistic spots: "אין היסטוריית הצבעות", no percentage.
- Sort descending. Same neutral color for every party, no logos.

## User flow
1. **Start:** one-line explanation, category chips, privacy note ("התשובות לא יוצאות מהמכשיר שלך"), Start.
2. **Law card:** title + short summary, "קרא עוד" (details, date, Knesset link). Buttons בעד / נגד / לא יודע. Progress n/10. The Knesset's own result is **not shown** before the user answers.
3. **Results after each 10:** tabs "רשימות 2026" (default) / "סיעות הכנסת ה־25", bars with basis. "עוד 10" continues (results update over all answers). "שתף" → share text (Web Share API, WhatsApp fallback).
4. Progress saved in `localStorage` (wrapped in try/catch).
5. Footer: methodology (counting rules, sources, data date, poll snapshot date) and a disclaimer.

Law order: random within the chosen categories, no repeats.

## Architecture
```
knesset-match/
  pipeline/            Python 3.8, stdlib only
    fetch.py           → data/raw/*.json (bills, votes, results, committees, MKs)
    build.py           → site/data/votes.json (selected laws × MK results, factions)
  content/
    laws.json          curated laws + Hebrew summaries
    lists.json         26th lists: realistic-spot candidates → MkId, poll seats + date
  site/                static, published by GitHub Pages
    index.html, app.js, style.css, data/*.json
  tests/               pipeline + scoring tests
```
`app.js` contains a pure `score(answers, data, view)` function that is tested with Node.

## Error handling
- Pipeline: retries + paging over OData; fails loudly on schema surprises.
- Site: if data fails to load, show a short error message; no partial results.

## Testing
- Unit tests for vote selection (final whole-bill vote, ≥40 threshold) and scoring (0.5 abstention, absence excluded, don't-know excluded, list mapping).
- Manual check in the browser at phone width before publishing; spot-check 5 laws' MK votes against the Knesset site.

## 26th lists data (done during design)
- Candidates: Kipa's full lists (published 2026-10-21). Realistic spots = round(average of 8 polls, one per pollster, 19–22 Oct 2026) + 2; lists averaging below the threshold are excluded.
- Seats used: Likud 23, Yashar 23, Together 15, Democrats 11, Joint List 11 (only 10 names published), Otzma 10, Shas 10, UTJ 10, Yisrael Beiteinu 10, RZP-Zehut 9, Ra'am 8, Reservists-NEP 5, Amcha Yisrael 3.
- Matching to 25th-Knesset MKs (152 people, `KNS_PersonToPosition`, PositionID 43/61): automatic by name, then a manual last-name-only review (name variants: גד/גדי איזנקוט, מרים/מירי רגב, אליהו/אלי כהן, יחיאל/חילי טרופר, בעז/בועז ביסמוט, ואליד אל הואשלה/אלהואשלה). Result: 72 of 147 realistic spots are former MKs.

## Phase 2 (by 2026-10-25): "declared positions" view
A third results tab, "עמדות מוצהרות", for **20–25 high-profile laws** (draft law, judicial overhaul, death penalty for terrorists, broadcasting law, …).
- One position per list per law, from the platform or public statements by the list or its leading candidates: for = 1, against = 0, **contradictory statements = 0.5**, **no statement = not counted**.
- Every position stores a source (URL + short quote + date) and is shown with a link from the results.
- Research runs with parallel subagents; every cell needs a real source — never inferred from ideology.
- Laws outside the set are not counted in this view; its basis line shows how many answered laws it covers.

## Out of scope (v1)
Accounts, a backend, comparing individual MKs, non-Knesset candidates' positions, English UI.
