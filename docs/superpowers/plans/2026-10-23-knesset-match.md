# Knesset Match Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public static Hebrew site where users vote on 80 real 25th-Knesset laws and see their agreement with the 26th lists (realistic spots) and the 25th factions.

**Architecture:** Python stdlib pipeline pulls Knesset OData into `data/raw/`, selects the final whole-bill vote per law, and builds one `site/data/data.json`. Laws content (summaries, categories) and lists (realistic-spot MK ids) are curated JSON in `content/`. The site is plain HTML/CSS/JS; scoring is a pure ES module tested with `node --test`. Deployed by GitHub Actions to Pages.

**Tech Stack:** Python 3.8 (stdlib + unittest), Node 24 (`node --test`), vanilla JS ES modules, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-23-knesset-match-design.md`

## Global Constraints
- Hebrew, `dir="rtl"`, mobile-first, works at 375px width with no horizontal scroll.
- No backend, no analytics, no third-party requests at runtime. All scoring in the browser.
- Neutral: one color for every party, no logos; the Knesset result of a law is never shown before the user answers.
- Scoring: same = 1, opposite = 0, נמנע / נוכח = 0.5, absent = not counted, user "don't know" = law not counted.
- Final vote per bill: latest `KNS_PlenumVote` with that `ItemID` and empty `VoteSubject`; keep only if ≥ 40 MKs voted בעד/נגד/נמנע.
- Realistic spots: as listed in the spec's "26th lists data" section; poll snapshot date 2026-10-22.
- v1 = 80 laws; the format must allow growing to 200 without code changes.
- `localStorage` access always inside try/catch; the site works without it.

## Review Focus
1. MK who switched faction mid-term (e.g. National Unity split, New Hope) — faction view must use the faction at the vote date, not the latest one. → Task 3 test `test_faction_at_vote_date`.
2. User answers "don't know" to all 10 — results screen must show a "no answers to compare yet" message, not NaN%. → Task 4 test `all dont-know gives empty results`.
3. Selected categories run out of unanswered laws — "עוד 10" must serve the remaining ones and then say there are no more, not loop or crash. → Task 4 test `nextBatch returns fewer when pool is exhausted`.
4. List with zero former MKs (Reservists, Amcha) — shown as "אין היסטוריית הצבעות", sorted last, no bar. → Task 4 test `list without MKs has null score`.
5. `localStorage` blocked (private mode) — app still runs and keeps answers in memory. → Task 5 manual check step.

---

### Task 1: Repo scaffold + OData fetch

**Files:**
- Create: `pipeline/odata.py`, `pipeline/fetch.py`, `tests/test_odata.py`, `.gitignore` (`data/raw/`, `__pycache__/`), `README.md` (one paragraph + how to run)

**Interfaces:**
- Produces: `odata.get_all(entity: str, params: dict, opener=urllib.request.urlopen) -> list[dict]` (follows `@odata.nextLink`, encodes spaces as `%20`, retries 3× on URLError/5xx).
- Produces: `python pipeline/fetch.py` writes `data/raw/{bills,votes,results,positions,people,committees}.json`:
  - bills: `KNS_Bill` KnessetNum 25, fields `Id,Name,CommitteeID,StatusID,SummaryLaw,PublicationDate`
  - votes: `KNS_PlenumVote` VoteDateTime ≥ 2022-11-15, fields `Id,ItemID,VoteDateTime,VoteTitle,VoteSubject`
  - results: `KNS_PlenumVoteResult` VoteDate ≥ 2022-11-15, fields `VoteID,MkId,ResultCode,ResultDesc`
  - positions: `KNS_PersonToPosition` KnessetNum 25, PositionID 43 or 61, fields `PersonID,FactionName,StartDate,FinishDate`
  - people: `KNS_Person` (all), fields `Id,FirstName,LastName`
  - committees: `KNS_Committee` KnessetNum 25, fields `Id,Name`

- [ ] **Step 1: Write failing test** `test_get_all_follows_next_link`: fake opener returns page 1 `{"value":[1],"@odata.nextLink":"u2"}` then `{"value":[2]}`; assert result `[1,2]` and second call URL is `"u2"`. Also `test_get_all_retries_then_succeeds` (first call raises URLError).
- [ ] **Step 2:** `python -m unittest tests/test_odata.py` → FAIL (module missing).
- [ ] **Step 3:** Implement `odata.py` and `fetch.py`.
- [ ] **Step 4:** Tests PASS; run `python pipeline/fetch.py` (background, ~5–10 min for ~530K results) and confirm each file is non-empty; results count ≈ 526K.
- [ ] **Step 5:** Create public GitHub repo `knesset-match` (`gh repo create knesset-match --public --source . --push`). Commit + push.

### Task 2: Vote selection + category mapping → curation candidates

**Files:**
- Create: `pipeline/select_votes.py`, `pipeline/categories.py`, `tests/test_select.py`
- Output: `data/candidates.json` (tracked; input to curation)

**Interfaces:**
- Produces: `final_vote_by_bill(votes: list[dict]) -> dict[int, dict]` — per `ItemID`, latest vote whose `VoteSubject` is null/blank after strip.
- Produces: `participation(results: list[dict]) -> dict[int, dict]` — per VoteID counts `{"for","against","abstain"}` (abstain = נמנע).
- Produces: `category_for(committee_name: str) -> str` — keyword map, first match wins:
  `חוץ והביטחון|ביטחון לאומי` → `ביטחון`; `חוקה|ועדת הכנסת|הממשלה|ביקורת המדינה` → `משפט ושלטון`; `כספים|כלכלה|מיזמים|תקשורת` → `כלכלה`; `חינוך|מדע` → `חינוך ותרבות`; `עבודה והרווחה|בריאות|מעמד האישה|עלייה|הילד|שורדי השואה` → `חברה ורווחה`; `פנים והגנת הסביבה|נגב|פריפריה|המזרחי` → `פנים וסביבה`; else `אחר`. A sixth curated-only category `דת ומדינה` is assigned by hand in Task 3.
- `data/candidates.json`: list of `{billId, name, voteId, voteDate, category, for, against, abstain, summaryLaw}` for bills with StatusID 118 and for+against+abstain ≥ 40, sorted by contestedness `min(for,against)/(for+against)` descending.

- [ ] **Step 1: Failing tests:** `test_final_vote_ignores_section_votes` (votes for ItemID 1: subject "סעיף 1" at 18:00, subject null at 17:00, subject "" at 16:00 → picks 17:00 one); `test_participation_threshold` (39 voters excluded, 40 included); `test_category_mapping` (`"ועדת החוץ והביטחון"`→`ביטחון`, `"הוועדה לדיון בהצעת חוק התקשורת (שידורים)..."`→`כלכלה`, `"ועדת האתיקה"`→`אחר`).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** PASS; run `python pipeline/select_votes.py`, print count (expect a few hundred) and category histogram.
- [ ] **Step 5:** Commit + push.

### Task 3: Curated content (laws + lists) and build

**Files:**
- Create: `content/laws.json`, `content/lists.json`, `pipeline/build.py`, `tests/test_build.py`
- Output: `site/data/data.json`

**Interfaces:**
- `content/laws.json`: `[{billId, voteId, title, summary, details, category, voteDate}]` — 80 entries. Chosen from `candidates.json`: meaningful to ordinary voters, ≥ 6 per category where possible, contested ones preferred. `title` ≤ 60 chars plain Hebrew; `summary` ≤ 160 chars; `details` 2–4 sentences: what the law does + context, neutral wording, no evaluative adjectives. Written in parallel by subagents from `summaryLaw`/bill text; then one neutrality-review subagent reads all 80 and flags loaded wording; fix flags.
- `content/lists.json`: `{"pollDate":"2026-10-22","lists":[{id, name, seats, candidates:[{name, mkId|null}]}]}` — the 13 lists and realistic spots from the spec, mkIds from the design-phase matching (152 MKs; includes the manual fixes).
- Produces `build.py` → `site/data/data.json`:
  ```
  {generated, pollDate,
   laws: [{id, title, summary, details, category, voteDate, url}],   // url = https://main.knesset.gov.il/Activity/Legislation/Laws/Pages/LawBill.aspx?t=lawsuggestionssearch&lawitemid=<billId>
   mks: {<mkId>: name},
   votes: {<lawId>: {<mkId>: [code, faction]}},   // code: 1 for, 0 against, 0.5 abstain/present
   lists: [{id, name, seats, total, mkIds}]}
  ```
- Produces `faction_at(positions, mk_id, when) -> str|None` — FactionName of the position whose Start ≤ when < Finish (Finish null = open).
- ResultDesc mapping: `בעד`→1, `נגד`→0, `נמנע`/`נוכח`→0.5, anything else → skipped.

- [ ] **Step 1: Failing tests:** `test_faction_at_vote_date` (MK with faction A until 2024-03-01 then B: vote on 2024-02-01 → A, on 2024-05-01 → B); `test_result_codes` (בעד/נגד/נמנע/נוכח/"לא הצביע" → 1/0/0.5/0.5/skipped); `test_build_shape` (tiny fixture → keys and one vote entry exactly).
- [ ] **Step 2:** FAIL. **Step 3:** Implement build; write content files. **Step 4:** PASS; run build; assert 80 laws, every law has ≥ 40 vote entries, every list mkId exists in `mks`. Spot-check 5 laws' MK votes against the Knesset site.
- [ ] **Step 5:** Commit + push.

### Task 4: Scoring module

**Files:**
- Create: `site/score.js`, `tests/score.test.mjs`

**Interfaces:**
- Consumes: `data.json` shape from Task 3.
- Produces (ES module exports):
  - `scoreFactions(answers, data) -> [{name, pct|null, laws, mks}]` — group pairs by faction at vote; pct = mean×100; sorted desc, nulls last.
  - `scoreLists(answers, data) -> [{id, name, pct|null, laws, mks, total}]` — pairs from each list's `mkIds`, any faction.
  - `nextBatch(data, answers, categories, n=10, rand=Math.random) -> lawId[]` — unanswered laws in `categories` (empty array = all), shuffled.
  - `answers` = `{<lawId>: 1 | 0 | null}` (null = don't know). Pair value = `1 - |user - code|`.
  - `laws` = number of answered laws contributing ≥ 1 pair; `mks` = distinct MKs contributing.

- [ ] **Step 1: Failing tests** (`node --test tests/`): `abstain counts half` (user 1, MK 0.5 → 50); `absent not counted` (MK with no entry → not in `mks`); `dont-know excluded`; `all dont-know gives empty results` (every pct null); `list without MKs has null score`; `split faction gives proportional pct` (3 for, 2 against, user for → 60); `nextBatch returns fewer when pool is exhausted` (3 left → returns 3, then []); `nextBatch respects categories`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit + push.

### Task 5: Site UI

**Files:**
- Create: `site/index.html`, `site/app.js`, `site/style.css`, `site/og.png` (1200×630 share image: title text only)

**Interfaces:**
- Consumes: `score.js` exports, `data/data.json`.
- Screens (single page, state machine `start → card → results`):
  - Start: title "מי מצביע כמוני?", one line explanation, category chips (multi; "הכל" default and mutually exclusive), privacy line "התשובות לא יוצאות מהמכשיר שלך", button "מתחילים".
  - Card: progress `n/10`, title, summary, "קרא עוד" toggles details + date + "לעמוד החוק באתר הכנסת" link; buttons בעד / נגד / לא יודע.
  - Results: tabs "רשימות 2026" (default) / "סיעות הכנסת ה־25"; rows: name, bar, pct, basis line (`לפי N חוקים · M ח״כים`, lists add `מתוך K מקומות ריאליים`); null → "אין היסטוריית הצבעות". Buttons "עוד 10", "שתף" (navigator.share, else `https://wa.me/?text=`), "להתחיל מחדש". When pool exhausted: "עניתם על כל החוקים בקטגוריות שבחרתם".
  - Footer (always): methodology in 4 short bullets, sources (Knesset OData, Kipa lists, polls average 19–22.10.2026), data date.
- If `data/data.json` fails to load: one line "לא הצלחנו לטעון את הנתונים, נסו לרענן" and no partial UI.
- State in `localStorage` key `km.v1` `{answers, categories}`, read/write in try/catch.

- [ ] **Step 1:** Implement. **Step 2:** Serve `site/` locally (`python -m http.server -d site 8080`), walk the flow at 375px in the browser pane: start → 10 answers (mix incl. don't-know) → results both tabs → עוד 10 → reload keeps progress. **Step 3:** Block storage (`localStorage` throwing via devtools override) and confirm the flow still works. **Step 4:** Commit + push.

### Task 6: Deploy

**Files:**
- Create: `.github/workflows/pages.yml` (actions/checkout, actions/configure-pages, actions/upload-pages-artifact with `path: site`, actions/deploy-pages)

- [ ] **Step 1:** Enable Pages with source "GitHub Actions" (`gh api -X POST repos/{owner}/knesset-match/pages -f build_type=workflow`). **Step 2:** Push, wait for the workflow, open `https://<owner>.github.io/knesset-match/` and repeat the 375px smoke walk. **Step 3:** Send the user the URL.
