#!/usr/bin/env python3
"""
Populate YouTube publish dates for items in data/content-data.js.

Why: YouTube oEmbed does NOT include publish dates, and browsers can't reliably scrape youtube.com pages due to CORS.
This script fetches `snippet.publishedAt` from YouTube Data API v3 and patches `date:` fields for YouTube items.

Usage:
  export YOUTUBE_API_KEY="YOUR_KEY"
  python3 tools/build_content_youtube_dates.py --write

Dry-run (no file write):
  python3 tools/build_content_youtube_dates.py
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT_JS_PATH = os.path.join(ROOT, "data", "content-data.js")


@dataclass(frozen=True)
class YouTubeItem:
  content_id: str
  url: str
  video_id: str


def youtube_id_from_url(url: str) -> Optional[str]:
  try:
    u = urllib.parse.urlparse(url.strip())
  except Exception:
    return None
  host = (u.hostname or "").lower()
  if "youtu.be" in host:
    vid = (u.path or "").strip("/").strip()
    return vid or None
  qs = urllib.parse.parse_qs(u.query or "")
  v = (qs.get("v") or [""])[0].strip()
  if v:
    return v
  m = re.search(r"/embed/([a-zA-Z0-9_-]{6,})", u.path or "")
  if m:
    return m.group(1)
  return None


def extract_youtube_items(content_js: str) -> List[YouTubeItem]:
  """
  Very small JS-ish extractor:
  finds object literals that contain:
    id: "..."
    type: "youtube"
    url: "..."
  """
  # Grab object blocks: { ... } with a conservative match.
  # This assumes each item is a plain object literal in the array (as in our curated file).
  blocks = re.findall(r"\{\s*[^{}]*?id:\s*\"[^\"]+\"[\s\S]*?\}", content_js)
  out: List[YouTubeItem] = []
  for b in blocks:
    m_id = re.search(r'id:\s*"([^"]+)"', b)
    m_type = re.search(r'type:\s*"([^"]+)"', b)
    m_url = re.search(r'url:\s*"([^"]+)"', b)
    if not (m_id and m_type and m_url):
      continue
    if m_type.group(1) != "youtube":
      continue
    url = m_url.group(1)
    vid = youtube_id_from_url(url)
    if not vid:
      continue
    out.append(YouTubeItem(content_id=m_id.group(1), url=url, video_id=vid))
  # Deduplicate by video_id (keep first)
  seen = set()
  uniq: List[YouTubeItem] = []
  for it in out:
    if it.video_id in seen:
      continue
    seen.add(it.video_id)
    uniq.append(it)
  return uniq


def fetch_youtube_published_at(api_key: str, video_ids: List[str]) -> Dict[str, str]:
  """
  Returns mapping: videoId -> YYYY-MM-DD
  """
  out: Dict[str, str] = {}
  # API supports up to 50 ids per request.
  for i in range(0, len(video_ids), 50):
    chunk = video_ids[i : i + 50]
    qs = urllib.parse.urlencode(
      {
        "part": "snippet",
        "id": ",".join(chunk),
        "key": api_key,
      }
    )
    url = f"https://www.googleapis.com/youtube/v3/videos?{qs}"
    req = urllib.request.Request(url, headers={"User-Agent": "hooke-wilding-webapp/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
      body = resp.read().decode("utf-8")
    data = json.loads(body)
    for item in data.get("items", []):
      vid = item.get("id")
      snippet = item.get("snippet") or {}
      published_at = snippet.get("publishedAt")
      if not (vid and published_at):
        continue
      # Example: 2025-01-02T12:34:56Z
      try:
        dt = datetime.fromisoformat(published_at.replace("Z", "+00:00")).astimezone(timezone.utc)
        out[str(vid)] = dt.date().isoformat()
      except Exception:
        continue
  return out


def patch_dates(content_js: str, dates_by_video_id: Dict[str, str]) -> Tuple[str, int]:
  """
  Patch `date:` fields for youtube objects by matching their `url` and computing video id from it.
  Returns (new_content, patch_count)
  """
  patch_count = 0

  # Replace inside each object literal block to keep change localized.
  def repl_obj(match: re.Match) -> str:
    nonlocal patch_count
    obj = match.group(0)
    m_type = re.search(r'type:\s*"([^"]+)"', obj)
    if not m_type or m_type.group(1) != "youtube":
      return obj
    m_url = re.search(r'url:\s*"([^"]+)"', obj)
    if not m_url:
      return obj
    vid = youtube_id_from_url(m_url.group(1))
    if not vid:
      return obj
    iso = dates_by_video_id.get(vid)
    if not iso:
      return obj
    # Patch or insert date field.
    if re.search(r"date:\s*(null|\"[^\"]*\")\s*,", obj):
      new_obj, n = re.subn(r"date:\s*(null|\"[^\"]*\")\s*,", f'date: "{iso}",', obj, count=1)
      if n:
        patch_count += 1
      return new_obj
    # If date field missing (shouldn't happen), insert after url.
    new_obj, n = re.subn(r'(url:\s*"[^"]+"\s*,)', r'\1\n    date: "' + iso + r'",', obj, count=1)
    if n:
      patch_count += 1
    return new_obj

  new_content = re.sub(r"\{\s*[^{}]*?id:\s*\"[^\"]+\"[\s\S]*?\}", repl_obj, content_js)
  return new_content, patch_count


def main() -> int:
  ap = argparse.ArgumentParser()
  ap.add_argument("--write", action="store_true", help="Write changes back to data/content-data.js")
  ap.add_argument("--path", default=CONTENT_JS_PATH, help="Path to content-data.js")
  args = ap.parse_args()

  path = os.path.abspath(args.path)
  if not os.path.exists(path):
    print(f"ERROR: not found: {path}", file=sys.stderr)
    return 2

  api_key = os.environ.get("YOUTUBE_API_KEY", "").strip()
  if not api_key:
    print("ERROR: Missing env var YOUTUBE_API_KEY", file=sys.stderr)
    return 2

  src = open(path, "r", encoding="utf-8").read()
  items = extract_youtube_items(src)
  if not items:
    print("No YouTube items found to update.")
    return 0

  vids = [it.video_id for it in items]
  print(f"Found {len(vids)} unique YouTube video IDs.")

  dates = fetch_youtube_published_at(api_key, vids)
  print(f"Fetched publish dates for {len(dates)} videos.")

  patched, n = patch_dates(src, dates)
  if n == 0:
    print("No date fields patched (maybe already set?).")
    return 0

  if args.write:
    open(path, "w", encoding="utf-8").write(patched)
    print(f"Wrote updates to {path} (patched {n} items).")
  else:
    print(f"Dry run: would patch {n} items. Re-run with --write to apply.")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())


