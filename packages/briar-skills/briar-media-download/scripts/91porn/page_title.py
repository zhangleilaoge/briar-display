#!/usr/bin/env python3
import html as H
import re
import sys

raw = open(sys.argv[1], encoding="utf-8", errors="ignore").read()
m = re.search(r"<title[^>]*>(.*?)</title>", raw, re.I | re.S)
title = H.unescape(m.group(1)).strip() if m else ""
# site suffix noise
title = re.sub(r"\s*[-|]\s*91porn\s*$", "", title, flags=re.I).strip()
print(title)
