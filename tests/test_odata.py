import io
import json
import os
import sys
import unittest
import urllib.error

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "pipeline"))
import odata  # noqa: E402


def page(obj):
    return io.BytesIO(json.dumps(obj).encode("utf-8"))


class GetAllTest(unittest.TestCase):
    def test_get_all_follows_next_link(self):
        calls = []
        pages = [{"value": [1], "@odata.nextLink": "u2"}, {"value": [2]}]

        def opener(url, timeout=None):
            calls.append(url)
            return page(pages[len(calls) - 1])

        self.assertEqual(odata.get_all("KNS_X", {"$top": "1"}, opener=opener), [1, 2])
        self.assertEqual(calls[1], "u2")
        self.assertIn("KNS_X?", calls[0])

    def test_get_all_retries_then_succeeds(self):
        calls = []

        def opener(url, timeout=None):
            calls.append(url)
            if len(calls) == 1:
                raise urllib.error.URLError("boom")
            return page({"value": ["ok"]})

        self.assertEqual(odata.get_all("KNS_X", {}, opener=opener, sleep=lambda s: None), ["ok"])
        self.assertEqual(len(calls), 2)

    def test_spaces_encoded(self):
        seen = []

        def opener(url, timeout=None):
            seen.append(url)
            return page({"value": []})

        odata.get_all("KNS_X", {"$filter": "KnessetNum eq 25"}, opener=opener)
        self.assertNotIn(" ", seen[0])
        self.assertIn("KnessetNum%20eq%2025", seen[0])


if __name__ == "__main__":
    unittest.main()
