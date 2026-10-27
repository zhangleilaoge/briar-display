#!/usr/bin/env python3
import re
import sys

title = sys.argv[1] if len(sys.argv) > 1 else ""
viewkey = sys.argv[2] if len(sys.argv) > 2 else "video"
t = re.sub(r'[\\/:*?"<>|\s]+', "_", title).strip("_")[:80]
print(t or f"91porn-{viewkey}")
