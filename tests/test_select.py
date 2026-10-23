import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "pipeline"))
from categories import category_for  # noqa: E402
from select_votes import final_vote_by_bill, participation, MIN_VOTERS  # noqa: E402


def vote(id_, item, when, subject):
    return {"Id": id_, "ItemID": item, "VoteDateTime": when, "VoteSubject": subject}


class FinalVoteTest(unittest.TestCase):
    def test_final_vote_ignores_section_votes(self):
        votes = [
            vote(1, 1, "2024-01-01T18:00:00+02:00", "סעיף 1"),
            vote(2, 1, "2024-01-01T17:00:00+02:00", None),
            vote(3, 1, "2024-01-01T16:00:00+02:00", ""),
            vote(4, 1, "2024-01-01T19:00:00+02:00", "הסתייגות 3"),
        ]
        self.assertEqual(final_vote_by_bill(votes)[1]["Id"], 2)

    def test_blank_subject_with_spaces_counts_as_whole_bill(self):
        votes = [vote(5, 9, "2024-01-01T10:00:00+02:00", "  ")]
        self.assertEqual(final_vote_by_bill(votes)[9]["Id"], 5)


class ParticipationTest(unittest.TestCase):
    def test_participation_counts(self):
        results = [{"VoteID": 7, "ResultDesc": d} for d in ["בעד", "בעד", "נגד", "נמנע", "נוכח"]]
        self.assertEqual(participation(results)[7], {"for": 2, "against": 1, "abstain": 1})

    def test_participation_threshold(self):
        self.assertEqual(MIN_VOTERS, 40)


class CategoryTest(unittest.TestCase):
    def test_category_mapping(self):
        self.assertEqual(category_for("ועדת החוץ והביטחון"), "ביטחון")
        self.assertEqual(category_for("הוועדה לביטחון לאומי"), "ביטחון")
        self.assertEqual(category_for("הוועדה לדיון בהצעת חוק התקשורת (שידורים), התשפ\"ו-2025"), "כלכלה")
        self.assertEqual(category_for("ועדת החוקה, חוק ומשפט"), "משפט ושלטון")
        self.assertEqual(category_for("ועדת העבודה והרווחה"), "חברה ורווחה")
        self.assertEqual(category_for("ועדת האתיקה"), "אחר")
        self.assertEqual(category_for(None), "אחר")


if __name__ == "__main__":
    unittest.main()
