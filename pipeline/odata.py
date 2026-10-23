"""Minimal client for the Knesset OData V4 API."""
import json
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://knesset.gov.il/OdataV4/ParliamentInfo/"


def build_url(entity, params):
    query = urllib.parse.urlencode(params, safe="$(),':", quote_via=urllib.parse.quote)
    return BASE + entity + "?" + query


def _open_json(url, opener, sleep, retries=3):
    for attempt in range(retries):
        try:
            with opener(url, timeout=120) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code < 500 or attempt == retries - 1:
                raise
        except urllib.error.URLError:
            if attempt == retries - 1:
                raise
        sleep(2 ** attempt)


def get_all(entity, params, opener=urllib.request.urlopen, sleep=time.sleep):
    """Return every row of `entity`, following @odata.nextLink pages."""
    url = build_url(entity, params)
    rows = []
    while url:
        data = _open_json(url, opener, sleep)
        rows += data["value"]
        url = data.get("@odata.nextLink")
    return rows
