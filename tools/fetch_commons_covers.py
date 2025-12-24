#!/usr/bin/env python3
"""
Fetch open-licensed cover photos from Wikimedia Commons for the Living Dorset Field Guide.

- Searches Commons File namespace for each species term.
- Picks a JPG with an acceptable open license (CC BY, CC BY-SA, CC0, Public domain).
- Downloads a resized thumbnail (width=1200) to assets/field-guide/<species-id>.jpg
- Prints a JSON mapping with attribution metadata to paste back into the dataset.

Usage:
  python3 tools/fetch_commons_covers.py
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import ssl


COMMONS_API = "https://commons.wikimedia.org/w/api.php"


SPECIES = [
    ("dartford-warbler", "Dartford warbler Sylvia undata"),
    ("nightjar", "European nightjar Caprimulgus europaeus"),
    ("sand-lizard", "Sand lizard Lacerta agilis"),
    ("smooth-snake", "Smooth snake Coronella austriaca"),
    ("pipistrelle", "Pipistrelle bat Pipistrellus"),
    ("greater-horseshoe", "Greater horseshoe bat Rhinolophus ferrumequinum"),
    ("adonis-blue", "Adonis blue Polyommatus bellargus"),
    ("chalkhill-blue", "Chalkhill blue Polyommatus coridon"),
    ("bee-orchid", "Bee orchid Ophrys apifera"),
    ("pyramidal-orchid", "Pyramidal orchid Anacamptis pyramidalis"),
    ("ragged-robin", "Ragged robin Silene flos-cuculi"),
    ("emperor-dragonfly", "Emperor dragonfly Anax imperator"),
    ("seagrass", "Eelgrass Zostera"),
]


def http_get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "HookeWildingPortal/1.0 (offline app builder)"})
    ctx = None
    # Some environments (like sandboxed macOS toolchains) may lack a usable CA bundle.
    # Allow an explicit insecure mode to still fetch public Commons content.
    if os.environ.get("HOOKE_INSECURE_SSL", "").strip() == "1":
        ctx = ssl._create_unverified_context()
    with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
        raw = r.read().decode("utf-8")
    return json.loads(raw)


def commons_search_files(query: str, limit: int = 8) -> list[str]:
    params = {
        "action": "query",
        "format": "json",
        "list": "search",
        "srnamespace": "6",  # File:
        "srlimit": str(limit),
        "srsearch": query,
    }
    url = COMMONS_API + "?" + urllib.parse.urlencode(params)
    data = http_get_json(url)
    out = []
    for it in data.get("query", {}).get("search", []):
        title = it.get("title", "")
        if title.startswith("File:"):
            out.append(title)
    return out


def get_imageinfo(file_titles: list[str], width: int = 1200) -> dict[str, dict]:
    if not file_titles:
        return {}
    params = {
        "action": "query",
        "format": "json",
        "prop": "imageinfo",
        "titles": "|".join(file_titles),
        "iiprop": "url|extmetadata|mime|size",
        "iiurlwidth": str(width),
    }
    url = COMMONS_API + "?" + urllib.parse.urlencode(params)
    data = http_get_json(url)
    pages = data.get("query", {}).get("pages", {}) or {}
    out = {}
    for _, page in pages.items():
        title = page.get("title", "")
        infos = page.get("imageinfo", []) or []
        if not title or not infos:
            continue
        out[title] = infos[0]
    return out


def clean_html(s: str) -> str:
    # extmetadata values may contain HTML
    s = re.sub(r"<[^>]+>", "", s or "").strip()
    s = re.sub(r"\s+", " ", s)
    return s


def is_ok_license(meta: dict) -> bool:
    short = clean_html((meta.get("LicenseShortName") or {}).get("value", ""))
    usage = clean_html((meta.get("UsageTerms") or {}).get("value", ""))
    lic = (short or usage).lower()
    if not lic:
        return False
    bad = ["non-free", "fair use", "all rights reserved", "copyrighted"]
    if any(b in lic for b in bad):
        return False
    ok = ["cc by", "cc-by", "cc by-sa", "cc-by-sa", "cc0", "public domain"]
    return any(o in lic for o in ok)


def pick_best_candidate(infos: dict[str, dict]) -> tuple[str, dict] | None:
    # prefer JPGs (we're saving as .jpg filenames in the app)
    candidates = []
    for title, info in infos.items():
        if not title.lower().endswith((".jpg", ".jpeg")):
            continue
        meta = info.get("extmetadata", {}) or {}
        if not is_ok_license(meta):
            continue
        candidates.append((title, info))
    if not candidates:
        return None
    # heuristics: prefer larger originals and photo mime
    def score(item):
        _title, info = item
        mime = info.get("mime", "")
        w = int(info.get("width") or 0)
        h = int(info.get("height") or 0)
        size = int(info.get("size") or 0)
        s = 0
        if mime == "image/jpeg":
            s += 5
        s += min(10, (w * h) // 2_000_000)  # rough megapixels bump
        s += min(10, size // 1_000_000)
        return s

    candidates.sort(key=score, reverse=True)
    return candidates[0]


def download(url: str, dest: str) -> None:
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "HookeWildingPortal/1.0 (offline app builder)"})
    ctx = None
    if os.environ.get("HOOKE_INSECURE_SSL", "").strip() == "1":
        ctx = ssl._create_unverified_context()
    with urllib.request.urlopen(req, timeout=60, context=ctx) as r:
        data = r.read()
    with open(dest, "wb") as f:
        f.write(data)


def main() -> int:
    out_dir = os.path.join(os.path.dirname(__file__), "..", "assets", "field-guide")
    out_dir = os.path.abspath(out_dir)

    results = {}
    failures = []

    for species_id, query in SPECIES:
        print(f"- Searching: {species_id}  ({query})")
        titles = commons_search_files(query, limit=10)
        infos = get_imageinfo(titles, width=1200)
        picked = pick_best_candidate(infos)
        if not picked:
            print(f"  !! No suitable open-license JPG found (skipping)")
            failures.append(species_id)
            continue

        title, info = picked
        meta = info.get("extmetadata", {}) or {}
        thumburl = info.get("thumburl") or info.get("url")
        if not thumburl:
            print("  !! No url/thumburl (skipping)")
            failures.append(species_id)
            continue

        artist = clean_html((meta.get("Artist") or {}).get("value", "")) or clean_html((meta.get("Credit") or {}).get("value", ""))
        license_short = clean_html((meta.get("LicenseShortName") or {}).get("value", "")) or clean_html((meta.get("UsageTerms") or {}).get("value", ""))
        license_url = clean_html((meta.get("LicenseUrl") or {}).get("value", ""))
        source_url = f"https://commons.wikimedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}"

        dest = os.path.join(out_dir, f"{species_id}.jpg")
        print(f"  -> {title}")
        print(f"     license: {license_short}")
        if artist:
            print(f"     artist: {artist}")
        print(f"     downloading: {thumburl}")
        download(thumburl, dest)

        results[species_id] = {
            "src": f"assets/field-guide/{species_id}.jpg",
            "sourceTitle": title,
            "sourceUrl": source_url,
            "artist": artist,
            "license": license_short,
            "licenseUrl": license_url,
        }

        # be polite
        time.sleep(0.35)

    print("\n=== RESULTS JSON (for dataset) ===")
    print(json.dumps(results, indent=2, ensure_ascii=False))
    if failures:
        print("\n=== SKIPPED ===")
        print(", ".join(failures))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


