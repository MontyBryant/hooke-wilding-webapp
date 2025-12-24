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

  const $search = el("galSearch");
  const $cats = el("galCats");
  const $grid = el("galGrid");
  const $meta = el("galMeta");
  const $clear = el("galClear");

  const $modal = el("galModal");
  const $modalTitle = el("galModalTitle");
  const $modalImg = el("galModalImg");
  const $modalCap = el("galModalCap");
  const $modalClose = el("galModalClose");

  const state = { q: "", cats: new Set() };

  const categories = Array.from(new Set(data.images.map((im) => im.category))).sort((a, b) => a.localeCompare(b));

  function matches(im) {
    const q = normalize(state.q);
    const catOk = state.cats.size === 0 || state.cats.has(im.category);
    const qOk = !q || normalize(im.src).includes(q) || normalize(im.label || "").includes(q);
    return catOk && qOk;
  }

  function renderCats() {
    $cats.innerHTML = categories
      .map((c) => {
        const active = state.cats.has(c);
        return `<button class="chip ${active ? "is-active" : ""}" type="button" data-gal-cat="${escapeHtml(c)}">${escapeHtml(
          c
        )}</button>`;
      })
      .join("");
  }

  function renderGrid() {
    const filtered = data.images.filter(matches);
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
          <img class="gal-card__img" src="./${escapeHtml(im.src)}" alt="" loading="lazy" />
        </article>`;
      })
      .join("");
  }

  function openModalFor(im) {
    const label = im.label || im.src.split("/").pop();
    $modalTitle.textContent = label;
    $modalImg.src = `./${im.src}`;
    $modalImg.alt = label;
    $modalCap.textContent = `${im.category} · ${im.src}`;
    if (!$modal.open) $modal.showModal();
  }

  // Initial render
  renderCats();
  renderGrid();

  // Events
  $search.addEventListener("input", (e) => {
    state.q = e.target.value || "";
    renderGrid();
  });

  $clear.addEventListener("click", () => {
    state.q = "";
    state.cats.clear();
    $search.value = "";
    renderCats();
    renderGrid();
  });

  document.addEventListener("click", (e) => {
    const catBtn = e.target.closest("[data-gal-cat]");
    if (catBtn) {
      const c = catBtn.dataset.galCat;
      if (state.cats.has(c)) state.cats.delete(c);
      else state.cats.add(c);
      renderCats();
      renderGrid();
      return;
    }

    const card = e.target.closest("[data-gal-idx]");
    if (card) {
      const idx = Number(card.dataset.galIdx);
      const filtered = data.images.filter(matches);
      const im = filtered[idx];
      if (im) openModalFor(im);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const card = document.activeElement && document.activeElement.closest && document.activeElement.closest("[data-gal-idx]");
    if (!card) return;
    const idx = Number(card.dataset.galIdx);
    const filtered = data.images.filter(matches);
    const im = filtered[idx];
    if (im) openModalFor(im);
  });

  $modalClose.addEventListener("click", () => $modal.close());
  $modal.addEventListener("click", (e) => {
    if (e.target === $modal) $modal.close();
  });
}

main();


