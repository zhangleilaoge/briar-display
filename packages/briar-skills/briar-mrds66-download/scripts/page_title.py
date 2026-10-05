#!/usr/bin/env python3
import html as H
import re
import sys

raw = open(sys.argv[1], encoding="utf-8", errors="ignore").read()
m = re.search(r"<title[^>]*>(.*?)</title>", raw, re.I | re.S)
print(H.unescape(m.group(1)).strip() if m else "")
