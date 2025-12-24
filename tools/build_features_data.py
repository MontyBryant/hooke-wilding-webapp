#!/usr/bin/env python3
"""
Build `data/features-data.js` from `data/features.json`.

Why:
  The app loads `data/features-data.js` which sets `window.__HOOKE_DATA__`.
  Keeping a single source of truth (`data/features.json`) makes it easier to
  update paths/content and regenerate the JS bundle deterministically.

Usage:
  python3 tools/build_features_data.py
"""

from __future__ import annotations

import json
from pathlib import Path


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    src = repo_root / "data" / "features.json"
    out = repo_root / "data" / "features-data.js"

    data = json.loads(src.read_text(encoding="utf-8"))
    # Minified JSON for fast load + small file size.
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))

    out_text = "// Auto-generated from data/features.json\n" f"window.__HOOKE_DATA__ = {payload};\n"
    out.write_text(out_text, encoding="utf-8")
    print(f"Wrote {out} ({len(data.get('features') or [])} features)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


