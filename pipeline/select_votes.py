"""Pick the final whole-bill vote of every passed law and fetch its per-MK results.

Writes data/raw/results.json (cache) and data/candidates.json (input to curation).
"""
import datetime
import json
import os
import sys

import odata
from categories import category_for

ROOT = os.path.join(os.path.dirname(__file__), "..")
RAW = os.path.join(ROOT, "data", "raw")
PASSED = 118
MIN_VOTERS = 40
CHUNK = 8


def final_vote_by_bill(votes):
    """ItemID -> latest vote on the whole bill (blank VoteSubject)."""
    best = {}
    for v in votes:
        if (v.get("VoteSubject") or "").strip():
            continue
        cur = best.get(v["ItemID"])
        if cur is None or v["VoteDateTime"] > cur["VoteDateTime"]:
            best[v["ItemID"]] = v
    return best


def _ts(v):
    return datetime.datetime.fromisoformat(v["VoteDateTime"])


def is_final_reading(final, bill_votes):
    """The whole-bill vote must be within a day of the bill's last vote of any kind.

    Otherwise the third-reading vote is missing from the data and `final` is an earlier reading.
    """
    last = max(_ts(v) for v in bill_votes)
    return last - _ts(final) <= datetime.timedelta(days=1)


def participation(results):
    """VoteID -> counts of for / against / abstain (נמנע)."""
    keys = {"בעד": "for", "נגד": "against", "נמנע": "abstain"}
    out = {}
    for r in results:
        counts = out.setdefault(r["VoteID"], {"for": 0, "against": 0, "abstain": 0})
        key = keys.get(r["ResultDesc"])
        if key:
            counts[key] += 1
    return out


def load(name):
    with open(os.path.join(RAW, name + ".json"), encoding="utf-8") as f:
        return json.load(f)


def fetch_results(vote_ids):
    path = os.path.join(RAW, "results.json")
    cached = load("results") if os.path.exists(path) else []
    have = {r["VoteID"] for r in cached}
    todo = sorted(set(vote_ids) - have)
    for i in range(0, len(todo), CHUNK):
        f = " or ".join("VoteID eq %d" % v for v in todo[i:i + CHUNK])
        cached += odata.get_all("KNS_PlenumVoteResult", {
            "$filter": f, "$select": "VoteID,MkId,ResultCode,ResultDesc"})
        print("results: %d/%d chunks" % (i // CHUNK + 1, (len(todo) + CHUNK - 1) // CHUNK), flush=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(cached, fh, ensure_ascii=False)
    return cached


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    bills = {b["Id"]: b for b in load("bills") if b["StatusID"] == PASSED}
    committees = {c["Id"]: c["Name"] for c in load("committees")}
    votes = load("votes")
    by_bill = {}
    for v in votes:
        by_bill.setdefault(v["ItemID"], []).append(v)
    finals = {k: v for k, v in final_vote_by_bill(votes).items()
              if k in bills and is_final_reading(v, by_bill[k])}
    counts = participation(fetch_results([v["Id"] for v in finals.values()]))

    out = []
    for bill_id, v in finals.items():
        c = counts.get(v["Id"], {"for": 0, "against": 0, "abstain": 0})
        if c["for"] + c["against"] + c["abstain"] < MIN_VOTERS:
            continue
        b = bills[bill_id]
        out.append({
            "billId": bill_id, "name": b["Name"], "voteId": v["Id"], "voteDate": v["VoteDateTime"][:10],
            "category": category_for(committees.get(b["CommitteeID"])),
            "for": c["for"], "against": c["against"], "abstain": c["abstain"],
            "summaryLaw": b["SummaryLaw"],
        })
    out.sort(key=lambda x: -min(x["for"], x["against"]) / max(1, x["for"] + x["against"]))
    with open(os.path.join(ROOT, "data", "candidates.json"), "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
    hist = {}
    for x in out:
        hist[x["category"]] = hist.get(x["category"], 0) + 1
    print("passed bills with final vote:", len(finals), "| candidates:", len(out))
    print(json.dumps(hist, ensure_ascii=False))


if __name__ == "__main__":
    main()
