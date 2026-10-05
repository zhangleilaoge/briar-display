#!/usr/bin/env python3
import os
import re
import sys

title = sys.argv[1] if len(sys.argv) > 1 else ""
arch_id = sys.argv[2] if len(sys.argv) > 2 else "video"
t = re.sub(r'[\\/:*?"<>|\s]+', "_", title).strip("_")[:80]
print(t or f"mrds66-{arch_id}")
