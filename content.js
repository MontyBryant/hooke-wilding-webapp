/* global window, document */

function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element: #${id}`);
  return node;
}

function normalize(s) {
  return String(s || "").toLowerCase().trim();
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function unique(arr) {
  return Array.from(new Set(arr));
}

function parseIsoDate(s) {
  const v = String(s || "").trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  // Normalize to midnight UTC so comparisons are consistent.
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function formatDate(s) {
  const d = parseIsoDate(s);
  if (!d) return "Date unknown";
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function youtubeIdFromUrl(url) {
  try {
    const u = new URL(String(url));
    // youtu.be/<id>
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "").trim();
      return id || null;
    }
    // youtube.com/watch?v=<id>
    const v = u.searchParams.get("v");
    if (v) return v.trim();
    // /embed/<id>
    const m = u.pathname.match(/\/embed\/([a-zA-Z0-9_-]{6,})/);
    if (m && m[1]) return m[1];
    return null;
  } catch {
    return null;
  }
}

function youtubeThumbById(id) {
  // No network APIs needed; works offline if cached, otherwise loads from YouTube.
  return `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
}

const LS_META = "hookeContentMeta::v1";
const LS_BLOG_META = "hookeContentBlogMeta::v1";

function loadMetaCache() {
  try {
    const raw = window.localStorage.getItem(LS_META);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

function saveMetaCache(cache) {
  try {
    window.localStorage.setItem(LS_META, JSON.stringify(cache || {}));
  } catch {
    // ignore
  }
}

function loadBlogMetaCache() {
  try {
    const raw = window.localStorage.getItem(LS_BLOG_META);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

function saveBlogMetaCache(cache) {
  try {
    window.localStorage.setItem(LS_BLOG_META, JSON.stringify(cache || {}));
  } catch {
    // ignore
  }
}

async function fetchYouTubeOEmbed(url) {
  const endpoint = new URL("https://www.youtube.com/oembed");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("url", String(url));
  const res = await fetch(String(endpoint), { method: "GET" });
  if (!res.ok) throw new Error(`oEmbed failed: ${res.status}`);
  const data = await res.json();
  return data && typeof data === "object" ? data : null;
}

async function fetchWordpressOEmbed(postUrl) {
  // WordPress exposes an oEmbed endpoint that usually includes `thumbnail_url`
  // (often the SEO / featured image).
  const u = new URL(String(postUrl));
  const endpoint = new URL(`${u.origin}/wp-json/oembed/1.0/embed`);
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("url", String(postUrl));
  const res = await fetch(String(endpoint), { method: "GET" });
  if (!res.ok) throw new Error(`WP oEmbed failed: ${res.status}`);
  const data = await res.json();
  return data && typeof data === "object" ? data : null;
}

function main() {
  const data = window.__HOOKE_CONTENT__;
  if (!data || !data.featured || !Array.isArray(data.items)) {
    document.body.innerHTML =
      "<div style='padding:24px;font-family:system-ui'>Missing content data. Expected window.__HOOKE_CONTENT__.</div>";
    return;
  }

  const featured = { ...data.featured };
  const items = data.items.map((it) => ({ ...it }));

  // Normalize: attach derived fields
  function normalizeItem(it, order) {
    const type = it.type === "blog" ? "blog" : "youtube";
    const tags = Array.isArray(it.tags) ? it.tags : [];
    const url = String(it.url || "").trim();
    const date = it.date ? String(it.date) : null;
    const vid = type === "youtube" ? youtubeIdFromUrl(url) : null;
    return { ...it, type, tags, url, date, youtubeId: vid, order: Number.isFinite(order) ? order : 0 };
  }

  const all = [normalizeItem(featured, -1), ...items.map((it, idx) => normalizeItem(it, idx))];

  // Apply cached YouTube metadata
  const cache = loadMetaCache();
  const blogCache = loadBlogMetaCache();
  all.forEach((it) => {
    if (it.type !== "youtube") return;
    if (!it.youtubeId) return;
    const meta = cache[it.youtubeId];
    if (!meta || typeof meta !== "object") return;
    it.title = typeof meta.title === "string" ? meta.title : it.title;
    it.author = typeof meta.author === "string" ? meta.author : it.author;
    it.thumbnail = typeof meta.thumbnail === "string" ? meta.thumbnail : it.thumbnail;
  });
  all.forEach((it) => {
    if (it.type !== "blog") return;
    const key = it.url;
    if (!key) return;
    const meta = blogCache[key];
    if (!meta || typeof meta !== "object") return;
    it.title = typeof meta.title === "string" ? meta.title : it.title;
    it.publisher = typeof meta.publisher === "string" ? meta.publisher : it.publisher;
    it.thumbnail = typeof meta.thumbnail === "string" ? meta.thumbnail : it.thumbnail;
    it.author = typeof meta.author === "string" ? meta.author : it.author;
  });

  const $featuredCard = el("featuredCard");
  const $featuredThumb = el("featuredThumb");
  const $featuredTitle = el("featuredTitle");
  const $featuredSub = el("featuredSub");
  const $featuredTags = el("featuredTags");

  const $search = el("contentSearch");
  const $types = el("contentTypes");
  const $tags = el("contentTags");
  const $grid = el("contentGrid");
  const $meta = el("contentMeta");
  const $clear = el("contentClear");
  const $sort = el("contentSort");
  const $dateFrom = el("dateFrom");
  const $dateTo = el("dateTo");

  const $videoModal = el("videoModal");
  const $videoModalTitle = el("videoModalTitle");
  const $videoModalMeta = el("videoModalMeta");
  const $videoModalClose = el("videoModalClose");
  const $videoModalOpen = el("videoModalOpen");
  const $videoFrame = el("videoFrame");

  const state = {
    q: "",
    tags: new Set(),
    types: new Set(), // "youtube" | "blog"
    from: "",
    to: "",
    sort: "date_desc",
  };

  function updateClearVisibility() {
    const hasActive =
      !!String(state.q || "").trim() ||
      state.tags.size > 0 ||
      state.types.size > 0 ||
      !!String(state.from || "").trim() ||
      !!String(state.to || "").trim() ||
      state.sort !== "date_desc";
    $clear.hidden = !hasActive;
  }

  function allTags() {
    return unique(all.flatMap((it) => it.tags || [])).sort((a, b) => a.localeCompare(b));
  }

  function matches(it) {
    const q = normalize(state.q);
    const typeOk = state.types.size === 0 || state.types.has(it.type);
    const tagOk = state.tags.size === 0 || (it.tags || []).some((t) => state.tags.has(t));
    const hay = normalize(
      [
        it.title || "",
        it.author || "",
        it.publisher || "",
        it.url || "",
        (it.tags || []).join(" "),
        it.type,
      ].join(" ")
    );
    const qOk = !q || hay.includes(q);

    const d = parseIsoDate(it.date);
    const from = parseIsoDate(state.from);
    const to = parseIsoDate(state.to);
    const fromOk = !from || (d && d.getTime() >= from.getTime());
    const toOk = !to || (d && d.getTime() <= to.getTime());

    return qOk && typeOk && tagOk && fromOk && toOk;
  }

  function compareItems(a, b) {
    if (state.sort === "title_asc") {
      return String(a.title || "").localeCompare(String(b.title || ""));
    }
    const da = parseIsoDate(a.date);
    const db = parseIsoDate(b.date);
    // Unknown dates always last
    const aHas = !!da;
    const bHas = !!db;
    if (aHas !== bHas) return aHas ? -1 : 1;
    if (!da || !db) return Number(a.order || 0) - Number(b.order || 0);
    const diff = da.getTime() - db.getTime();
    if (diff === 0) return Number(a.order || 0) - Number(b.order || 0);
    return state.sort === "date_asc" ? diff : -diff;
  }

  function renderFeatured() {
    const it = all[0];
    const vid = it.youtubeId || youtubeIdFromUrl(it.url);
    const thumb = it.thumbnail || (vid ? youtubeThumbById(vid) : "./assets/sunflower.webp");
    $featuredThumb.src = thumb;
    $featuredThumb.alt = it.title ? it.title : "Featured video thumbnail";

    $featuredTitle.textContent = it.title || "Featured video";
    $featuredSub.textContent = it.author ? `by ${it.author}` : "Click to play";
    $featuredTags.innerHTML = (it.tags || []).slice(0, 4).map((t) => `<span class="mini">${escapeHtml(t)}</span>`).join("");
    $featuredCard.dataset.youtubeId = vid || "";
    $featuredCard.dataset.url = it.url;
    $featuredCard.disabled = !vid;
  }

  function renderFilters() {
    const typeDefs = [
      { id: "youtube", label: "Videos" },
      { id: "blog", label: "Blogs" },
    ];
    $types.innerHTML = typeDefs
      .map((t) => {
        const active = state.types.has(t.id);
        return `<button class="chip ${active ? "is-active" : ""}" type="button" data-content-type="${escapeHtml(
          t.id
        )}">${escapeHtml(t.label)}</button>`;
      })
      .join("");

    const tagsList = allTags();
    $tags.innerHTML = tagsList
      .map((t) => {
        const active = state.tags.has(t);
        return `<button class="chip ${active ? "is-active" : ""}" type="button" data-content-tag="${escapeHtml(t)}">${escapeHtml(
          t
        )}</button>`;
      })
      .join("");

    updateClearVisibility();
  }

  function renderGrid() {
    const list = items.map((it, idx) => normalizeItem(it, idx));
    // Merge any loaded/cached meta back in
    list.forEach((it) => {
      if (it.type !== "youtube" || !it.youtubeId) return;
      const meta = cache[it.youtubeId];
      if (meta && typeof meta === "object") {
        it.title = typeof meta.title === "string" ? meta.title : it.title;
        it.author = typeof meta.author === "string" ? meta.author : it.author;
        it.thumbnail = typeof meta.thumbnail === "string" ? meta.thumbnail : it.thumbnail;
      }
    });
    list.forEach((it) => {
      if (it.type !== "blog") return;
      const meta = blogCache[it.url];
      if (meta && typeof meta === "object") {
        it.title = typeof meta.title === "string" ? meta.title : it.title;
        it.publisher = typeof meta.publisher === "string" ? meta.publisher : it.publisher;
        it.thumbnail = typeof meta.thumbnail === "string" ? meta.thumbnail : it.thumbnail;
        it.author = typeof meta.author === "string" ? meta.author : it.author;
      }
    });

    const filtered = list.filter(matches).sort(compareItems);
    $meta.textContent = `${filtered.length} item${filtered.length === 1 ? "" : "s"}`;

    if (filtered.length === 0) {
      $grid.innerHTML = `<div class="panel" style="grid-column:1 / -1">
        <div class="panel__title">No matches</div>
        <div class="panel__meta">Try clearing tags, widening the date range, or using a shorter search.</div>
      </div>`;
      return;
    }

    $grid.innerHTML = filtered
      .map((it) => {
        if (it.type === "blog") {
          const thumb = it.thumbnail || "./assets/sunflower.webp";
          const title = it.title || it.url;
          const by = it.author ? `${it.author} · ` : "";
          const sub = `${it.publisher ? `${it.publisher} · ` : ""}${by}${formatDate(it.date)}`;
          const tags = (it.tags || []).slice(0, 4);
          return `<a class="card" href="${escapeHtml(it.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open article ${escapeHtml(
            title
          )}">
            <img class="card__img" src="${escapeHtml(thumb)}" alt="" loading="lazy" onerror="this.src='./assets/sunflower.webp'" />
            <div class="card__body">
              <div class="card__title">${escapeHtml(title)}</div>
              <div class="card__sub">${escapeHtml(sub)}</div>
              <div class="card__chips">${tags.map((t) => `<span class="mini">${escapeHtml(t)}</span>`).join("")}</div>
            </div>
          </a>`;
        }

        const vid = it.youtubeId;
        const thumb = it.thumbnail || (vid ? youtubeThumbById(vid) : "./assets/sunflower.webp");
        const title = it.title || "YouTube video";
        const sub = `${it.author ? `by ${it.author} · ` : ""}${formatDate(it.date)}`;
        const tags = (it.tags || []).slice(0, 4);
        return `<article class="card" role="button" tabindex="0" data-youtube-id="${escapeHtml(vid || "")}" data-url="${escapeHtml(
          it.url
        )}" aria-label="Play video ${escapeHtml(title)}">
          <img class="card__img" src="${escapeHtml(thumb)}" alt="" loading="lazy" />
          <div class="card__body">
            <div class="card__title">${escapeHtml(title)}</div>
            <div class="card__sub">${escapeHtml(sub)}</div>
            <div class="card__chips">${tags.map((t) => `<span class="mini">${escapeHtml(t)}</span>`).join("")}</div>
          </div>
        </article>`;
      })
      .join("");
  }

  function openVideoById(videoId, url, title) {
    if (!videoId) return;
    $videoModalTitle.textContent = title || "Video";
    $videoModalMeta.textContent = url ? `YouTube · ${url}` : "YouTube";
    if (url) {
      $videoModalOpen.href = url;
      $videoModalOpen.removeAttribute("aria-disabled");
    } else {
      $videoModalOpen.href = "#";
      $videoModalOpen.setAttribute("aria-disabled", "true");
    }

    // Some YouTube embeds fail when opened from `file://` or when the player can't infer a valid origin.
    // Add `origin` when available, and prefer `www.youtube.com/embed` for best compatibility.
    const originOk = window.location && window.location.origin && window.location.origin !== "null";
    const originParam = originOk ? `&origin=${encodeURIComponent(window.location.origin)}` : "";
    const src = `https://www.youtube.com/embed/${encodeURIComponent(
      videoId
    )}?autoplay=1&rel=0&modestbranding=1&playsinline=1${originParam}`;
    $videoFrame.src = src;
    if (!$videoModal.open) $videoModal.showModal();
  }

  function closeVideo() {
    try {
      $videoFrame.src = "";
    } catch {
      // ignore
    }
    if ($videoModal.open) $videoModal.close();
  }

  function resetFilters() {
    state.q = "";
    state.tags.clear();
    state.types.clear();
    state.from = "";
    state.to = "";
    state.sort = "date_desc";
    $search.value = "";
    $dateFrom.value = "";
    $dateTo.value = "";
    $sort.value = "date_desc";
    renderFilters();
    renderGrid();
  }

  // Initial render
  renderFeatured();
  renderFilters();
  renderGrid();

  // If the site is opened directly from disk, YouTube embeds often throw "Video player configuration error".
  // Give the user a clear hint so they can use localhost or a deployed URL.
  if (window.location && window.location.protocol === "file:") {
    $meta.textContent =
      "Tip: YouTube playback may fail when opened from a file. Serve this folder (e.g. http://localhost) or use the deployed site.";
  }

  // Events
  $search.addEventListener("input", (e) => {
    state.q = e.target.value || "";
    updateClearVisibility();
    renderGrid();
  });
  $sort.addEventListener("change", (e) => {
    state.sort = e.target.value || "date_desc";
    updateClearVisibility();
    renderGrid();
  });
  $dateFrom.addEventListener("change", (e) => {
    state.from = e.target.value || "";
    updateClearVisibility();
    renderGrid();
  });
  $dateTo.addEventListener("change", (e) => {
    state.to = e.target.value || "";
    updateClearVisibility();
    renderGrid();
  });
  $clear.addEventListener("click", resetFilters);

  document.addEventListener("click", (e) => {
    const typeBtn = e.target.closest("[data-content-type]");
    if (typeBtn) {
      const t = typeBtn.dataset.contentType;
      if (state.types.has(t)) state.types.delete(t);
      else state.types.add(t);
      renderFilters();
      renderGrid();
      return;
    }

    const tagBtn = e.target.closest("[data-content-tag]");
    if (tagBtn) {
      const t = tagBtn.dataset.contentTag;
      if (state.tags.has(t)) state.tags.delete(t);
      else state.tags.add(t);
      renderFilters();
      renderGrid();
      return;
    }

    const video = e.target.closest("[data-youtube-id]");
    if (video) {
      const vid = video.dataset.youtubeId;
      const url = video.dataset.url || "";
      const title = (video.querySelector && video.querySelector(".card__title") && video.querySelector(".card__title").textContent) || "Video";
      openVideoById(vid, url, title);
      return;
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const card =
      document.activeElement && document.activeElement.closest && document.activeElement.closest("[data-youtube-id]");
    if (!card) return;
    openVideoById(
      card.dataset.youtubeId,
      card.dataset.url || "",
      (card.querySelector(".card__title") && card.querySelector(".card__title").textContent) || "Video"
    );
  });

  $featuredCard.addEventListener("click", (e) => {
    // Prevent the document-level click handler from also firing on the featured card.
    e.stopPropagation();
    const vid = $featuredCard.dataset.youtubeId;
    const url = $featuredCard.dataset.url || "";
    const title = $featuredTitle.textContent || "Featured video";
    openVideoById(vid, url, title);
  });

  $videoModalClose.addEventListener("click", closeVideo);
  $videoModal.addEventListener("click", (e) => {
    if (e.target === $videoModal) closeVideo();
  });
  $videoModal.addEventListener("close", () => {
    // Ensure video stops when user presses Esc.
    try {
      $videoFrame.src = "";
    } catch {
      // ignore
    }
  });

  // Fetch missing YouTube meta (best-effort; offline-safe).
  const youtubeToFetch = unique(
    all
      .filter((it) => it.type === "youtube" && it.youtubeId)
      .map((it) => it.youtubeId)
      .filter((id) => !cache[id])
  );

  if (youtubeToFetch.length) {
    Promise.all(
      youtubeToFetch.map(async (id) => {
        const it = all.find((x) => x.youtubeId === id);
        if (!it) return;
        try {
          const meta = await fetchYouTubeOEmbed(it.url);
          if (!meta) return;
          cache[id] = {
            title: typeof meta.title === "string" ? meta.title : "",
            author: typeof meta.author_name === "string" ? meta.author_name : "",
            thumbnail: typeof meta.thumbnail_url === "string" ? meta.thumbnail_url : "",
          };
        } catch {
          // ignore (offline / CORS / blocked)
        }
      })
    ).then(() => {
      saveMetaCache(cache);
      // Re-render once with whatever metadata we managed to fetch.
      renderFeatured();
      renderGrid();
    });
  }

  // Fetch missing blog meta (WordPress oEmbed) to get a thumbnail (often the featured/SEO image).
  const blogToFetch = unique(
    all
      .filter((it) => it.type === "blog" && it.url)
      .map((it) => it.url)
      .filter((url) => !blogCache[url])
  );

  if (blogToFetch.length) {
    Promise.all(
      blogToFetch.map(async (url) => {
        try {
          const meta = await fetchWordpressOEmbed(url);
          if (!meta) return;
          blogCache[url] = {
            title: typeof meta.title === "string" ? meta.title : "",
            author: typeof meta.author_name === "string" ? meta.author_name : "",
            publisher: typeof meta.provider_name === "string" ? meta.provider_name : "",
            thumbnail: typeof meta.thumbnail_url === "string" ? meta.thumbnail_url : "",
          };
        } catch {
          // ignore (offline / blocked / non-WordPress)
        }
      })
    ).then(() => {
      saveBlogMetaCache(blogCache);
      renderGrid();
    });
  }
}

main();


