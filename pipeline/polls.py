"""Threshold polling summary from Wikipedia's 2026 Israeli election polling table.

Writes content/polls.json: for each list, how many of the latest polls (one per pollster,
last two weeks) give it seats, and its average seats. Polls may not be published from
23 Oct 2026 23:59 until polls close, so this is a frozen snapshot.
"""
import json
import os
import re
import sys
import urllib.request

ROOT = os.path.join(os.path.dirname(__file__), "..")
PAGE = ("https://en.wikipedia.org/w/api.php?action=parse&page=Opinion_polling_for_the_2026_"
        "Israeli_legislative_election&prop=wikitext&format=json&formatversion=2")
# Table columns after date/firm/publisher/sample. Joint lists span two columns (colspan=2).
SLOTS = ["likud", "together", "rzp", "rzp", "otzma", "shas", "utj", "yb", "raam", "joint",
         "democrats", "yashar", "reservists", "reservists", "amcha", "haredi"]
MONTHS = {m: i + 1 for i, m in enumerate("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split())}


def _strip_attrs(cell):
    """Drop a leading 'style=..|' / 'colspan=2|' attribute block, ignoring '|' inside {{ }} or [[ ]]."""
    depth = 0
    for i, ch in enumerate(cell):
        if ch in "{[":
            depth += 1
        elif ch in "}]":
            depth -= 1
        elif ch == "|" and depth == 0:
            return cell[:i], cell[i + 1:]
    return "", cell


def _seats(text):
    text = text.strip()
    if "N/A" in text:
        return None
    m = re.match(r"^'*(\d+)'*$", re.sub(r"\{\{efn.*", "", text).strip())
    if m:
        return int(m.group(1))
    if "small" in text or "%" in text:
        return 0  # shown as a vote share below the threshold
    return None


def _link_text(text):
    m = re.search(r"\[\[(?:[^|\]]*\|)?([^\]]+)\]\]", text)
    return (m.group(1) if m else text).strip(" '")


def parse_rows(wiki):
    rows = []
    wiki = re.sub(r"<ref[^>]*/>|<ref.*?</ref>", "", wiki, flags=re.S)
    for chunk in wiki.split("\n|-"):
        cells = [line[1:] for line in chunk.split("\n") if line.startswith("|") and not line.startswith(("|-", "|}", "|+"))]
        if len(cells) < 8 or "Opdrts" not in cells[0]:
            continue
        d = re.search(r"Opdrts\|(\d*)\|(\d+)\|(\w{3})\|(\d{4})", cells[0])
        if not d:
            continue
        date = "%s-%02d-%02d" % (d.group(4), MONTHS[d.group(3)], int(d.group(2)))
        firm = _strip_attrs(cells[1])[1].strip()
        publisher = _link_text(_strip_attrs(cells[2])[1])
        seats, slot = {}, 0
        for cell in cells[4:]:
            if slot >= len(SLOTS):
                break
            attrs, text = _strip_attrs(cell)
            span = 2 if "colspan=2" in attrs.replace('"', "").replace(" ", "") else 1
            value = _seats(text)
            ids = set(SLOTS[slot:slot + span])
            for list_id in ids:
                if value is not None:
                    seats[list_id] = seats.get(list_id, 0) + value
            slot += span
        rows.append({"date": date, "firm": firm, "publisher": publisher, "seats": seats})
    return rows


def summarize(rows, since):
    latest = {}
    for r in rows:
        if r["date"] < since:
            continue
        key = (r["firm"], r["publisher"])
        if key not in latest or r["date"] > latest[key]["date"]:
            latest[key] = r
    polls = list(latest.values())
    out = {}
    for list_id in dict.fromkeys(SLOTS):
        vals = [p["seats"][list_id] for p in polls if list_id in p["seats"]]
        out[list_id] = {"polled": len(vals), "passing": sum(1 for v in vals if v > 0),
                        "avgSeats": round(sum(vals) / len(vals), 1) if vals else None}
    return {"polls": len(polls), "since": since, "until": max(p["date"] for p in polls),
            "pollsters": sorted("%s (%s)" % k for k in latest), "lists": out}


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    req = urllib.request.Request(PAGE, headers={"User-Agent": "knesset-match/1.0 (github.com/nadavd14/knesset-match)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        wiki = json.load(r)["parse"]["wikitext"]
    # Only the first (current) seat table: older tables have a different column layout.
    start = wiki.index("{| class=\"wikitable sortable")
    table = wiki[start:wiki.index("\n|}", start)]
    s = summarize(parse_rows(table), since="2026-10-19")
    with open(os.path.join(ROOT, "content", "polls.json"), "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1)
    print(s["polls"], "polls", s["since"], "→", s["until"])
    for k, v in s["lists"].items():
        print(k, v)


if __name__ == "__main__":
    main()
