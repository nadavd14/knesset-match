# מי מצביע כמוני? · Knesset Match

אתר סטטי: מצביעים על חוקים אמיתיים מהכנסת ה־25 ורואים את אחוז ההתאמה לרשימות לכנסת ה־26 (מקומות ריאליים) ולסיעות הכנסת ה־25. החישוב כולו בדפדפן, בלי שרת.

```
python pipeline/fetch.py          # base tables → data/raw/
python pipeline/select_votes.py   # final votes + results → data/candidates.json
python pipeline/build.py          # → site/data/data.json
python -m unittest discover tests && node --test tests/
python -m http.server -d site 8080
```

Data: Knesset OData (`knesset.gov.il/OdataV4/ParliamentInfo`). Design: `docs/superpowers/specs/`.
