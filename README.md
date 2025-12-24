# Hooke Wilding Webapp (Hooke Farm Wilding Portal)

An **offline, interactive guide** to Hooke Farm’s wilding features — built from the WW24 info boards — plus a “Living Dorset Field Guide” you can extend over time.

## What’s in here

- **Explore map + feature boards**: `index.html` + `app.js`
  - Click map pins or cards to open a feature.
  - Search + tag filtering.
  - “Tour” mode steps through pinned features.
  - Feature details include the original board image, extracted text, seasonal notes, and an optional photo gallery.
- **Living Dorset Field Guide**: `field-guide.html` + `field-guide.js`
  - Browse a curated starter dataset of habitats/species.
  - Filter by group/habitat/season and search.
  - Species modal includes photo attribution and sources.
- **Watch & Read (videos + blogs)**: `content.html` + `content.js`
  - Curated library with search, filters, and sorting.
  - YouTube videos play in a modal; blog links open in a new tab.
- **About page**: `about.html`

## Run locally

This is a **static site** (no build step). You can open `index.html` directly, but a tiny local server is recommended.

### Option A: Python (recommended)

```bash
cd "/Users/montybryant/Documents/Work/Knowledge Resources/vibecoding/Hooke Almighty/hooke-wilding-webapp"
python3 -m http.server 8000
```

Then open `http://localhost:8000/index.html`.

### Option B: Any static file server

Serve the repo root directory and open `index.html`.

## Content + data model

### Wilding features (map + boards)

- **Bundled dataset used by the app**: `data/features-data.js`
  - Defines `window.__HOOKE_DATA__` (the app reads this in `app.js`).
- **Source JSON (human-readable)**: `data/features.json`
  - `features-data.js` is marked “Auto-generated from `data/features.json`”.
  - If you edit `features.json`, you’ll need to update/regenerate `features-data.js` to match.
  - If you add images into `assets/features/<feature-id>/`, you’ll also need to regenerate `features-data.js` (the browser can’t auto-scan folders at runtime in a static site).

Feature fields used by the UI include:
- **`id`** (string): stable unique id (also used for local overrides)
- **`title`** (string)
- **`tags`** (string[])
- **`thumb`** (string path)
- **`pages[0].image`** (string path)
- **`text`** (string): extracted text shown in the “original extracted text” section

### Living Dorset Field Guide

- **Dataset**: `data/dorset-field-guide.js`
  - Defines `window.__DORSET_GUIDE__`
  - Includes `habitats`, `groups`, `seasons`, and `species[]`
- **Images**: `assets/field-guide/`
  - The UI falls back to `assets/field-guide/placeholder.svg` if an image fails to load.

## Admin mode (local-only curation)

The Explore page includes an **Admin mode** for local editing and curation (titles, stories, tags, images, gallery, pin positions, hide/delete).

- **Where edits are saved**: your browser’s storage (LocalStorage + SessionStorage)
  - This keeps the site usable offline, but it also means **edits do not change files in this repo**.
- **Resetting changes**: clear the site’s browser storage (or use “Reset edits” per feature in Admin).
- **Security note**: Admin “protection” is client-side for an offline site and is not intended as a real security boundary.

## Tools

### Fetching cover images for the field guide (Wikimedia Commons)

Script: `tools/fetch_commons_covers.py`

- Searches Wikimedia Commons for each species term
- Filters to open licenses (CC BY / CC BY-SA / CC0 / Public domain)
- Downloads a resized thumbnail into `assets/field-guide/`
- Prints JSON attribution metadata you can paste into `data/dorset-field-guide.js`

Usage:

```bash
python3 tools/fetch_commons_covers.py
```

If your environment has SSL certificate issues, the script supports an insecure mode:

```bash
HOOKE_INSECURE_SSL=1 python3 tools/fetch_commons_covers.py
```

### Populate YouTube publish dates for Watch & Read (optional)

YouTube publish dates are not available via oEmbed and can’t be reliably scraped in-browser (CORS), so they’re best added at build/curation time.

1. Create a YouTube Data API v3 key
2. Run:

```bash
export YOUTUBE_API_KEY="YOUR_KEY"
python3 tools/build_content_youtube_dates.py --write
```

## Repo layout (high-level)

- **Pages**: `index.html`, `field-guide.html`, `content.html`, `about.html`
- **Logic**: `app.js`, `field-guide.js`
- **Styles**: `styles.css`
- **Data**: `data/`
- **Images & PDFs**: `assets/`
- **Utility scripts**: `tools/`


