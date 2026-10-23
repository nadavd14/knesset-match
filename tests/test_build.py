import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "pipeline"))
from build import faction_at, result_code, build_data  # noqa: E402

POSITIONS = [
    {"PersonID": 1, "FactionName": None, "StartDate": "2022-11-15T00:00:00", "FinishDate": None},  # plain MK row
    {"PersonID": 1, "FactionName": "A", "StartDate": "2022-11-15T00:00:00", "FinishDate": "2024-03-01T00:00:00"},
    {"PersonID": 1, "FactionName": "B", "StartDate": "2024-03-01T00:00:00", "FinishDate": None},
    {"PersonID": 2, "FactionName": "C", "StartDate": "2022-11-15T00:00:00", "FinishDate": None},
]


class FactionTest(unittest.TestCase):
    def test_faction_at_vote_date(self):
        self.assertEqual(faction_at(POSITIONS, 1, "2024-02-01T10:00:00+02:00"), "A")
        self.assertEqual(faction_at(POSITIONS, 1, "2024-05-01T10:00:00+03:00"), "B")
        self.assertIsNone(faction_at(POSITIONS, 3, "2024-05-01T10:00:00+03:00"))


class FactionNameTest(unittest.TestCase):
    def test_faction_names_shortened_and_trimmed(self):
        from build import short_faction
        self.assertEqual(short_faction("הליכוד "), "הליכוד")
        self.assertEqual(short_faction('התאחדות הספרדים שומרי תורה תנועתו של מרן הרב עובדיה יוסף זצ"ל'), 'ש"ס')
        self.assertEqual(short_faction("עוצמה יהודית בראשות איתמר בן גביר"), "עוצמה יהודית")
        self.assertEqual(short_faction("יש עתיד"), "יש עתיד")
        self.assertIsNone(short_faction(None))


class ResultCodeTest(unittest.TestCase):
    def test_result_codes(self):
        self.assertEqual(result_code("בעד"), 1)
        self.assertEqual(result_code("נגד"), 0)
        self.assertEqual(result_code("נמנע"), 0.5)
        self.assertEqual(result_code("נוכח"), 0.5)
        self.assertIsNone(result_code("לא הצביע"))


class BuildShapeTest(unittest.TestCase):
    def test_build_shape(self):
        laws = [{"billId": 10, "voteId": 100, "title": "t", "summary": "s", "details": "d",
                 "category": "כלכלה", "voteDate": "2024-05-01"}]
        results = [
            {"VoteID": 100, "MkId": 1, "ResultDesc": "בעד"},
            {"VoteID": 100, "MkId": 2, "ResultDesc": "נמנע"},
            {"VoteID": 100, "MkId": 2, "ResultDesc": "לא הצביע"},
            {"VoteID": 999, "MkId": 1, "ResultDesc": "נגד"},
        ]
        votes = [{"Id": 100, "VoteDateTime": "2024-05-01T10:00:00+03:00"}]
        people = [{"Id": 1, "FirstName": "דנה", "LastName": "לוי"}, {"Id": 2, "FirstName": "רון", "LastName": "כהן"},
                  {"Id": 3, "FirstName": "x", "LastName": "y"}]
        lists = {"pollDate": "2026-10-22", "lists": [
            {"id": "a", "name": "א", "seats": 3, "candidates": [{"name": "דנה לוי", "mkId": 1}, {"name": "z", "mkId": None}]}]}
        d = build_data(laws, results, votes, POSITIONS, people, lists)
        self.assertEqual(d["laws"][0]["id"], 10)
        self.assertIn("lawitemid=10", d["laws"][0]["url"])
        self.assertEqual(d["votes"]["10"], {"1": [1, "B"], "2": [0.5, "C"]})
        self.assertEqual(d["mks"], {"1": "דנה לוי", "2": "רון כהן"})
        # total = realistic spots (seats), even when fewer candidate names are known
        self.assertEqual(d["lists"], [{"id": "a", "name": "א", "seats": 3, "total": 3, "mkIds": ["1"]}])
        self.assertEqual(d["pollDate"], "2026-10-22")


if __name__ == "__main__":
    unittest.main()
