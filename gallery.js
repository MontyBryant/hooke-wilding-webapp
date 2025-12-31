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

function main() {
  const data = window.__HOOKE_GALLERY__;
  if (!data || !Array.isArray(data.images)) {
    document.body.innerHTML =
      "<div style='padding:24px;font-family:system-ui'>Missing gallery manifest. Expected window.__HOOKE_GALLERY__.</div>";
    return;
  }

  const allImages = data.images.map((im) => ({
    ...im,
    src: String(im.src || ""),
    category: String(im.category || "Other"),
    label: String(im.label || ""),
    tags: Array.isArray(im.tags) ? im.tags.map((t) => String(t)).filter((t) => t.trim() !== "") : [],
    createdMs: Number.isFinite(Number(im.createdMs)) ? Number(im.createdMs) : 0,
    createdAt: String(im.createdAt || ""),
  }));

  const $search = el("galSearch");
  const $view = el("galView");
  const $sort = el("galSort");
  const $cats = el("galCats");
  const $tags = el("galTags");
  const $grid = el("galGrid");
  const $meta = el("galMeta");
  const $clear = el("galClear");

  const $modal = el("galModal");
  const $modalTitle = el("galModalTitle");
  const $modalCap = el("galModalCap");
  const $modalClose = el("galModalClose");
  const $stageImg = el("galStageImg");
  const $thumbs = el("galThumbs");
  const $prev = el("galPrev");
  const $next = el("galNext");
  const $counter = el("galCounter");

  const state = { q: "", cats: new Set(), tags: new Set(), view: "after", sort: "created_desc" };

  function baseImages() {
    if (state.view === "before") return allImages.filter((im) => im.category === "Before");
    // "after": everything except Before
    return allImages.filter((im) => im.category !== "Before");
  }

  function categoriesForCurrentView() {
    return Array.from(new Set(baseImages().map((im) => im.category))).sort((a, b) => a.localeCompare(b));
  }

  function matches(im) {
    const q = normalize(state.q);
    const catOk = state.cats.size === 0 || state.cats.has(im.category);
    const tagOk = state.tags.size === 0 || (im.tags || []).some((t) => state.tags.has(t));
    const qOk = !q || normalize(im.src).includes(q) || normalize(im.label || "").includes(q);
    return catOk && tagOk && qOk;
  }

  function compare(a, b) {
    if (state.sort === "name_asc") return String(a.src).localeCompare(String(b.src));
    const da = Number(a.createdMs || 0);
    const db = Number(b.createdMs || 0);
    if (da !== db) return state.sort === "created_asc" ? da - db : db - da;
    return String(a.src).localeCompare(String(b.src));
  }

  function filteredSorted() {
    return baseImages().filter(matches).sort(compare);
  }

  function updateClearVisibility() {
    const hasActive =
      !!String(state.q || "").trim() ||
      state.cats.size > 0 ||
      state.tags.size > 0 ||
      state.view !== "after" ||
      state.sort !== "created_desc";
    $clear.hidden = !hasActive;
  }

  function renderViewToggle() {
    const defs = [
      { id: "after", label: "After" },
      { id: "before", label: "Before" },
    ];
    $view.innerHTML = defs
      .map((d) => {
        const active = state.view === d.id;
        return `<button class="chip ${active ? "is-active" : ""}" type="button" data-gal-view="${escapeHtml(d.id)}">${escapeHtml(
          d.label
        )}</button>`;
      })
      .join("");
  }

  function renderCats() {
    const categories = categoriesForCurrentView();
    $cats.innerHTML = categories
      .map((c) => {
        const active = state.cats.has(c);
        return `<button class="chip ${active ? "is-active" : ""}" type="button" data-gal-cat="${escapeHtml(c)}">${escapeHtml(
          c
        )}</button>`;
      })
      .join("");
    updateClearVisibility();
  }

  function tagsForCurrentView() {
    // Narrow the tag list by category selection (so it doesn't show irrelevant tags).
    const scoped = baseImages().filter((im) => state.cats.size === 0 || state.cats.has(im.category));
    const all = Array.from(new Set(scoped.flatMap((im) => im.tags || [])));
    // Put the structural tags first, then everything else.
    const order = { Before: 1, About: 2, Misc: 3, "Feature photo": 4, "Info board": 5, Artwork: 6, Other: 7 };
    return all.sort((a, b) => (order[a] || 99) - (order[b] || 99) || a.localeCompare(b));
  }

  function renderTags() {
    const tags = tagsForCurrentView();
    $tags.innerHTML = tags
      .map((t) => {
        const active = state.tags.has(t);
        return `<button class="chip ${active ? "is-active" : ""}" type="button" data-gal-tag="${escapeHtml(t)}">${escapeHtml(
          t
        )}</button>`;
      })
      .join("");
    updateClearVisibility();
  }

  function renderGrid() {
    const filtered = filteredSorted();
    $meta.textContent = `${filtered.length} image${filtered.length === 1 ? "" : "s"}`;

    if (filtered.length === 0) {
      $grid.innerHTML = `<div class="panel" style="grid-column:1 / -1">
        <div class="panel__title">No matches</div>
        <div class="panel__meta">Try clearing filters or using a shorter search.</div>
      </div>`;
      return;
    }

    $grid.innerHTML = filtered
      .map((im, idx) => {
        const label = im.label || im.src.split("/").pop();
        return `<article class="gal-card" role="button" tabindex="0" data-gal-idx="${escapeHtml(String(idx))}" aria-label="Open image ${escapeHtml(
          label
        )}" data-gal-category="${escapeHtml(im.category)}">
          <img class="gal-card__img" src="${escapeHtml(im.src)}" alt="" loading="lazy" />
        </article>`;
      })
      .join("");
  }

  const modalState = { items: [], idx: 0 };

  function setModalIndex(nextIdx) {
    const items = modalState.items;
    if (!items || items.length === 0) return;
    const len = items.length;
    const idx = ((nextIdx % len) + len) % len;
    modalState.idx = idx;
    const im = items[idx];

    const label = im.label || im.src.split("/").pop();
    $modalTitle.textContent = label;
    $stageImg.src = im.src;
    $stageImg.alt = label;
    const when = im.createdAt ? im.createdAt : "";
    $modalCap.textContent = `${im.category}${when ? ` · ${when}` : ""} · ${im.src}`;
    $counter.textContent = `${idx + 1} / ${len}`;
    const multi = len > 1;
    $prev.hidden = !multi;
    $next.hidden = !multi;
    $prev.disabled = !multi;
    $next.disabled = !multi;

    Array.from($thumbs.querySelectorAll(".thumb[data-idx]")).forEach((t) => {
      t.classList.toggle("is-active", Number(t.dataset.idx) === idx);
    });
    const active = $thumbs.querySelector(`.thumb[data-idx="${idx}"]`);
    if (active && typeof active.scrollIntoView === "function") {
      active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }

  function openModalForIndex(idx, list) {
    modalState.items = Array.isArray(list) ? list : [];
    modalState.idx = Number.isFinite(idx) ? idx : 0;
    $thumbs.innerHTML = modalState.items
      .map((im, i) => {
        const label = im.label || im.src.split("/").pop();
        const active = i === modalState.idx;
        return `<button class="thumb ${active ? "is-active" : ""}" type="button" data-idx="${escapeHtml(String(i))}" aria-label="Open ${escapeHtml(
          label
        )}">
          <img src="${escapeHtml(im.src)}" alt="" loading="lazy" />
        </button>`;
      })
      .join("");

    setModalIndex(modalState.idx);
    if (!$modal.open) $modal.showModal();
  }

  // Initial render
  renderViewToggle();
  renderCats();
  renderTags();
  renderGrid();
  updateClearVisibility();

  // Events
  $search.addEventListener("input", (e) => {
    state.q = e.target.value || "";
    updateClearVisibility();
    renderGrid();
  });

  $sort.addEventListener("change", (e) => {
    state.sort = e.target.value || "created_desc";
    updateClearVisibility();
    renderGrid();
  });

  $clear.addEventListener("click", () => {
    state.q = "";
    state.cats.clear();
    state.tags.clear();
    state.view = "after";
    state.sort = "created_desc";
    $search.value = "";
    $sort.value = "created_desc";
    renderViewToggle();
    renderCats();
    renderTags();
    renderGrid();
  });

  document.addEventListener("click", (e) => {
    const viewBtn = e.target.closest("[data-gal-view]");
    if (viewBtn) {
      state.view = viewBtn.dataset.galView === "before" ? "before" : "after";
      state.cats.clear();
      state.tags.clear();
      renderViewToggle();
      renderCats();
      renderTags();
      renderGrid();
      return;
    }

    const catBtn = e.target.closest("[data-gal-cat]");
    if (catBtn) {
      const c = catBtn.dataset.galCat;
      if (state.cats.has(c)) state.cats.delete(c);
      else state.cats.add(c);
      renderCats();
      renderTags();
      renderGrid();
      return;
    }

    const tagBtn = e.target.closest("[data-gal-tag]");
    if (tagBtn) {
      const t = tagBtn.dataset.galTag;
      if (state.tags.has(t)) state.tags.delete(t);
      else state.tags.add(t);
      renderTags();
      renderGrid();
      return;
    }

    const card = e.target.closest("[data-gal-idx]");
    if (card) {
      const idx = Number(card.dataset.galIdx);
      const filtered = filteredSorted();
      if (Number.isFinite(idx) && filtered[idx]) openModalForIndex(idx, filtered);
    }
  });

  document.addEventListener("keydown", (e) => {
    if ($modal.open && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      if (!modalState.items || modalState.items.length < 2) return;
      e.preventDefault();
      setModalIndex(modalState.idx + (e.key === "ArrowLeft" ? -1 : 1));
      return;
    }
    if (e.key !== "Enter") return;
    const card = document.activeElement && document.activeElement.closest && document.activeElement.closest("[data-gal-idx]");
    if (!card) return;
    const idx = Number(card.dataset.galIdx);
    const filtered = filteredSorted();
    if (Number.isFinite(idx) && filtered[idx]) openModalForIndex(idx, filtered);
  });

  $modalClose.addEventListener("click", () => $modal.close());
  $modal.addEventListener("click", (e) => {
    if (e.target === $modal) $modal.close();
  });

  $thumbs.addEventListener("click", (e) => {
    const btn = e.target.closest(".thumb[data-idx]");
    if (!btn) return;
    const idx = Number(btn.dataset.idx);
    if (Number.isFinite(idx)) setModalIndex(idx);
  });
  $prev.addEventListener("click", () => setModalIndex(modalState.idx - 1));
  $next.addEventListener("click", () => setModalIndex(modalState.idx + 1));
}

main();


