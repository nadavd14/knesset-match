"""Default law category from the committee that prepared it (first match wins).

"דת ומדינה" has no committee of its own and is assigned by hand in content/laws.json.
"""
import re

RULES = [
    ("ביטחון", r"חוץ והביטחון|ביטחון לאומי"),
    ("משפט ושלטון", r"חוקה|ועדת הכנסת|הממשלה|ביקורת המדינה"),
    ("כלכלה", r"כספים|כלכלה|מיזמים|תקשורת"),
    ("חינוך ותרבות", r"חינוך|מדע"),
    ("חברה ורווחה", r"עבודה והרווחה|בריאות|מעמד האישה|עלייה|הילד|שורדי השואה"),
    ("פנים וסביבה", r"פנים והגנת הסביבה|נגב|פריפריה|המזרחי"),
]
OTHER = "אחר"


def category_for(committee_name):
    for category, pattern in RULES:
        if committee_name and re.search(pattern, committee_name):
            return category
    return OTHER
