"""Join curated content with Knesset votes into site/data/data.json."""
import datetime
import json
import os
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
RAW = os.path.join(ROOT, "data", "raw")
LAW_URL = "https://main.knesset.gov.il/Activity/Legislation/Laws/Pages/LawBill.aspx?t=lawsuggestionssearch&lawitemid=%d"
CODES = {"בעד": 1, "נגד": 0, "נמנע": 0.5, "נוכח": 0.5}


SHORT_FACTIONS = {
    'התאחדות הספרדים שומרי תורה תנועתו של מרן הרב עובדיה יוסף זצ"ל': 'ש"ס',
    "הציונות הדתית בראשות בצלאל סמוטריץ'": "הציונות הדתית",
    "עוצמה יהודית בראשות איתמר בן גביר": "עוצמה יהודית",
    "נעם - בראשות אבי מעוז": "נעם",
    'חה"כ עידן רול': "עידן רול (יחיד)",
}


def short_faction(name):
    if name is None:
        return None
    name = name.strip()
    return SHORT_FACTIONS.get(name, name)


def result_code(desc):
    return CODES.get(desc)


def faction_at(positions, mk_id, when):
    """FactionName of the MK's position covering `when` (Start <= when < Finish)."""
    t = when[:19]
    for p in positions:
        if p["PersonID"] != mk_id or not p["FactionName"]:
            continue
        if p["StartDate"][:19] <= t and (p["FinishDate"] is None or t < p["FinishDate"][:19]):
            return p["FactionName"]
    return None


def build_data(laws, results, votes, positions, people, lists):
    when = {v["Id"]: v["VoteDateTime"] for v in votes}
    names = {p["Id"]: (p["FirstName"] + " " + p["LastName"]).strip() for p in people}
    by_vote = {}
    for r in results:
        by_vote.setdefault(r["VoteID"], []).append(r)

    out_votes, used = {}, set()
    for law in laws:
        entry = {}
        for r in by_vote.get(law["voteId"], []):
            code = result_code(r["ResultDesc"])
            if code is None:
                continue
            entry[str(r["MkId"])] = [code, short_faction(faction_at(positions, r["MkId"], when[law["voteId"]]))]
            used.add(r["MkId"])
        out_votes[str(law["billId"])] = entry

    out_lists = []
    for lst in lists["lists"]:
        mk_ids = [str(c["mkId"]) for c in lst["candidates"] if c["mkId"]]
        used.update(int(m) for m in mk_ids)
        out_lists.append({"id": lst["id"], "name": lst["name"], "seats": lst["seats"],
                          "total": lst["seats"], "mkIds": mk_ids})

    return {
        "generated": datetime.date.today().isoformat(),
        "pollDate": lists["pollDate"],
        "laws": [{"id": l["billId"], "title": l["title"], "summary": l["summary"], "details": l["details"],
                  "category": l["category"], "voteDate": l["voteDate"], "url": LAW_URL % l["billId"]}
                 for l in laws],
        "mks": {str(i): names[i] for i in sorted(used) if i in names},
        "votes": out_votes,
        "lists": out_lists,
    }


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    laws = load(os.path.join(ROOT, "content", "laws.json"))
    lists = load(os.path.join(ROOT, "content", "lists.json"))
    data = build_data(laws, load(os.path.join(RAW, "results.json")), load(os.path.join(RAW, "votes.json")),
                      load(os.path.join(RAW, "positions.json")), load(os.path.join(RAW, "people.json")), lists)
    for law in data["laws"]:
        assert len(data["votes"][str(law["id"])]) >= 40, law["id"]
    for lst in data["lists"]:
        assert all(m in data["mks"] for m in lst["mkIds"]), lst["id"]
    os.makedirs(os.path.join(ROOT, "site", "data"), exist_ok=True)
    with open(os.path.join(ROOT, "site", "data", "data.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print("laws:", len(data["laws"]), "mks:", len(data["mks"]), "lists:", len(data["lists"]))


if __name__ == "__main__":
    main()
