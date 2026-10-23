"""Download the base Knesset tables into data/raw/.

Per-MK vote results are fetched later by select_votes.py, only for the
final votes it selects (the full table is ~530K rows).
"""
import json
import os

import odata

RAW = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
SINCE = "2022-11-15T00:00:00Z"

TABLES = {
    "bills": ("KNS_Bill", {
        "$filter": "KnessetNum eq 25",
        "$select": "Id,Name,CommitteeID,StatusID,SummaryLaw,PublicationDate",
    }),
    "votes": ("KNS_PlenumVote", {
        "$filter": "VoteDateTime ge " + SINCE,
        "$select": "Id,ItemID,VoteDateTime,VoteTitle,VoteSubject",
    }),
    "positions": ("KNS_PersonToPosition", {
        "$filter": "KnessetNum eq 25 and (PositionID eq 43 or PositionID eq 61)",
        "$select": "PersonID,FactionName,StartDate,FinishDate",
    }),
    "people": ("KNS_Person", {"$select": "Id,FirstName,LastName"}),
    "committees": ("KNS_Committee", {"$filter": "KnessetNum eq 25", "$select": "Id,Name"}),
}


def save(name, rows):
    os.makedirs(RAW, exist_ok=True)
    with open(os.path.join(RAW, name + ".json"), "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False)


def main():
    for name, (entity, params) in TABLES.items():
        rows = odata.get_all(entity, params)
        save(name, rows)
        print(name, len(rows))


if __name__ == "__main__":
    main()
