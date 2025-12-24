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


IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}


def _auto_gallery_for_feature(repo_root: Path, feature_id: str) -> list[dict]:
    """
    Collect additional images from `assets/features/<feature_id>/`.

    We intentionally exclude the info-board renders (`page-*.png`) and `thumb.png`
    because those are already used as the primary/board image.
    """
    folder = repo_root / "assets" / "features" / feature_id
    if not folder.exists() or not folder.is_dir():
        return []

    imgs: list[Path] = []
    for p in folder.iterdir():
        if not p.is_file():
            continue
        if p.name.startswith("."):
            continue
        if p.suffix.lower() not in IMAGE_EXTS:
            continue
        if p.name == "thumb.png":
            continue
        if p.name.startswith("page-"):
            continue
        imgs.append(p)

    imgs = sorted(imgs, key=lambda p: p.name.lower())
    out: list[dict] = []
    for p in imgs:
        rel = p.relative_to(repo_root).as_posix()
        out.append({"id": f"auto-{p.name}", "url": rel})
    return out


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    src = repo_root / "data" / "features.json"
    out = repo_root / "data" / "features-data.js"

    data = json.loads(src.read_text(encoding="utf-8"))

    # Enrich each feature with auto-detected photos from its folder.
    features = data.get("features") or []
    if isinstance(features, list):
        for f in features:
            if not isinstance(f, dict):
                continue
            fid = f.get("id")
            if not isinstance(fid, str) or not fid.strip():
                continue
            base_gallery = f.get("gallery") if isinstance(f.get("gallery"), list) else []
            auto_gallery = _auto_gallery_for_feature(repo_root, fid)
            # Merge + dedupe by url (stable).
            seen = set()
            merged = []
            for it in [*base_gallery, *auto_gallery]:
                if not isinstance(it, dict):
                    continue
                url = it.get("url")
                if not isinstance(url, str) or not url:
                    continue
                if url in seen:
                    continue
                seen.add(url)
                merged.append(it)
            if merged:
                f["gallery"] = merged

    # Minified JSON for fast load + small file size.
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))

    out_text = "// Auto-generated from data/features.json\n" f"window.__HOOKE_DATA__ = {payload};\n"
    out.write_text(out_text, encoding="utf-8")
    print(f"Wrote {out} ({len(data.get('features') or [])} features)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


