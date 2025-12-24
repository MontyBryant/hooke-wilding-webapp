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
PLACEHOLDER_IMG = "assets/field-guide/placeholder.svg"


def _auto_primary_image_for_feature(repo_root: Path, feature_id: str) -> Path | None:
    """
    Pick a "primary/board" image for a feature folder, if present.

    Priority:
      1) page-001.png (info-board render)
      2) thumb.png (explicit cover)
      3) First image file in the folder (sorted by name)
    """
    folder = repo_root / "assets" / "features" / feature_id
    if not folder.exists() or not folder.is_dir():
        return None

    preferred = [folder / "page-001.png", folder / "thumb.png"]
    for p in preferred:
        if p.exists() and p.is_file() and p.suffix.lower() in IMAGE_EXTS:
            return p

    imgs: list[Path] = []
    for p in folder.iterdir():
        if not p.is_file():
            continue
        if p.name.startswith("."):
            continue
        if p.suffix.lower() not in IMAGE_EXTS:
            continue
        imgs.append(p)

    if not imgs:
        return None
    imgs = sorted(imgs, key=lambda p: p.name.lower())
    return imgs[0]


def _auto_gallery_for_feature(repo_root: Path, feature_id: str, exclude_names: set[str] | None = None) -> list[dict]:
    """
    Collect additional images from `assets/features/<feature_id>/`.

    We intentionally exclude the info-board renders (`page-*.png`) and `thumb.png`
    because those are already used as the primary/board image.
    """
    folder = repo_root / "assets" / "features" / feature_id
    if not folder.exists() or not folder.is_dir():
        return []

    exclude_names = exclude_names or set()
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
        if p.name in exclude_names:
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

            # Headline image policy:
            # - If assets/features/<id>/page-001.png exists, it ALWAYS becomes the headline
            #   feature image + thumbnail (even if features.json specifies something else).
            # - Otherwise, only promote a folder image if the feature is using the placeholder
            #   (or missing), to keep existing curated images stable.
            folder = repo_root / "assets" / "features" / fid
            page001 = folder / "page-001.png"
            force_primary = page001.exists() and page001.is_file()

            primary = page001 if force_primary else _auto_primary_image_for_feature(repo_root, fid)
            primary_rel = primary.relative_to(repo_root).as_posix() if primary else ""
            if primary_rel:
                thumb = f.get("thumb")
                if force_primary or (not isinstance(thumb, str) or thumb.strip() in ("", PLACEHOLDER_IMG)):
                    f["thumb"] = primary_rel

                pages = f.get("pages")
                if isinstance(pages, list) and pages and isinstance(pages[0], dict):
                    img0 = pages[0].get("image")
                    if force_primary or (not isinstance(img0, str) or img0.strip() in ("", PLACEHOLDER_IMG)):
                        pages[0]["image"] = primary_rel
                        pages[0].setdefault("width", 0)
                        pages[0].setdefault("height", 0)
                        pages[0].setdefault("pageNumber", 1)
                        pages[0].setdefault("textPreview", "")
                else:
                    f["pages"] = [{"pageNumber": 1, "image": primary_rel, "width": 0, "height": 0, "textPreview": ""}]

            base_gallery = f.get("gallery") if isinstance(f.get("gallery"), list) else []
            # Avoid duplicating the primary image in the gallery thumbnail strip.
            exclude = {primary.name} if primary else set()
            auto_gallery = _auto_gallery_for_feature(repo_root, fid, exclude_names=exclude)
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


