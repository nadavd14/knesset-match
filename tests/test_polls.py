import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "pipeline"))
from polls import parse_rows, summarize  # noqa: E402

WIKI = """
|-
|<i>23 Oct</i>
| colspan="21" |''no new opinion polls may be published''
|-
|{{Opdrts||22|Oct|2026}}
| style=background:DarkOrange |SF+ND
|[[Channel 14 (Israel)|Channel 14]]
|7937
|style="background:#BBCDE4" |'''30'''
|11
|colspan=2|7
|8
|9
|8
|5
|6
|8
|8
|20
|colspan=2|{{small|(1.9%)}}
|{{small|(1.5%)}}
|{{small|(0.3%)}}
|{{small|(0.8%)}}{{efn|Noam at 0.6%}}
|style="background:#b2b2f0" |'''62'''
|-
|{{Opdrts||21|Oct|2026}}
|style=background:#FFDFCC |Midgam R&C
|[[HaHadashot 12]]
|505
|19
|15
|colspan=2|6
|7
|8
|7
|8
|5
|9
|9
|style="background:#d0eafb" |'''23'''
|colspan=2|{{small|(2.8%)}}
|4
|{{N/A}}
|{{small|(0.3%)}}
|47
|-
|{{Opdrts||20|Oct|2026}}
| style=background:DarkOrange |SF+ND
|[[Channel 14 (Israel)|Channel 14]]
|2116
|29
|9
|colspan=2|7
|8
|9
|8
|6
|6
|8
|9
|20
|colspan=2|{{small|(2.5%)}}
|{{small|(1.9%)}}
|{{small|(0.9%)}}
|0
|62
"""


class PollsTest(unittest.TestCase):
    def test_parse_rows(self):
        rows = parse_rows(WIKI)
        self.assertEqual(len(rows), 3)
        r = rows[0]
        self.assertEqual(r["date"], "2026-10-22")
        self.assertEqual(r["firm"], "SF+ND")
        self.assertEqual(r["seats"]["likud"], 30)
        self.assertEqual(r["seats"]["rzp"], 7)
        self.assertEqual(r["seats"]["yashar"], 20)
        self.assertEqual(r["seats"]["reservists"], 0)  # below threshold
        self.assertEqual(r["seats"]["amcha"], 0)
        self.assertEqual(rows[1]["seats"]["amcha"], 4)
        self.assertNotIn("haredi", rows[1]["seats"])  # N/A = not polled

    def test_summarize_latest_per_firm(self):
        s = summarize(parse_rows(WIKI), since="2026-10-09")
        self.assertEqual(s["polls"], 2)  # SF+ND counted once (latest), Midgam once
        self.assertEqual(s["lists"]["amcha"], {"polled": 2, "passing": 1, "avgSeats": 2.0})
        self.assertEqual(s["lists"]["likud"]["avgSeats"], 24.5)
        self.assertEqual(s["lists"]["reservists"]["passing"], 0)


if __name__ == "__main__":
    unittest.main()
