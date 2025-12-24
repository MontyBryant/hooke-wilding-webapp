/* global window, document */

function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element: #${id}`);
  return node;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalize(s) {
  return String(s || "").toLowerCase().trim();
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlight(text, query) {
  const q = String(query || "").trim();
  if (!q) return escapeHtml(text);
  const re = new RegExp(escapeRegExp(q), "ig");
  const parts = String(text).split(re);
  const matches = String(text).match(re) || [];
  let out = "";
  for (let i = 0; i < parts.length; i++) {
    out += escapeHtml(parts[i]);
    if (i < matches.length) out += `<mark>${escapeHtml(matches[i])}</mark>`;
  }
  return out;
}

function unique(arr) {
  return Array.from(new Set(arr));
}

function main() {
  const data = window.__DORSET_GUIDE__;
  if (!data || !Array.isArray(data.species)) {
    document.body.innerHTML = "<div style='padding:24px;font-family:system-ui'>Missing Dorset guide data.</div>";
    return;
  }

  const $search = el("fgSearch");
  const $groups = el("fgGroups");
  const $habitats = el("fgHabitats");
  const $seasons = el("fgSeasons");
  const $grid = el("fgGrid");
  const $meta = el("fgMeta");
  const $clear = el("fgClear");
  const $speciesModal = el("speciesModal");
  const $speciesModalTitle = el("speciesModalTitle");
  const $speciesModalMeta = el("speciesModalMeta");
  const $speciesModalHeadTags = el("speciesModalHeadTags");
  const $speciesModalImg = el("speciesModalImg");
  const $speciesModalNote = el("speciesModalNote");
  const $speciesModalCredit = el("speciesModalCredit");
  const $speciesModalHabitats = el("speciesModalHabitats");
  const $speciesModalWatchFor = el("speciesModalWatchFor");
  const $speciesModalSeasons = el("speciesModalSeasons");
  const $speciesModalConservation = el("speciesModalConservation");
  const $speciesModalSources = el("speciesModalSources");
  const $speciesModalClose = el("speciesModalClose");

  const habitatsById = Object.fromEntries((data.habitats || []).map((h) => [h.id, h]));
  const groups = data.groups || unique(data.species.map((s) => s.group)).sort((a, b) => a.localeCompare(b));
  const seasons = data.seasons || ["Spring", "Summer", "Autumn", "Winter"];

  const state = { q: "", groups: new Set(), habitats: new Set(), seasons: new Set() };

  function updateClearVisibility() {
    const hasActive =
      !!String(state.q || "").trim() ||
      state.groups.size > 0 ||
      state.habitats.size > 0 ||
      state.seasons.size > 0;
    $clear.hidden = !hasActive;
  }

  function matches(s) {
    const q = normalize(state.q);
    const hay = normalize(
      [
        s.commonName,
        s.scientificName,
        s.group,
        (s.habitats || []).join(" "),
        (s.notes || ""),
        (s.watchFor || []).join(" "),
      ].join(" ")
    );
    const qOk = !q || hay.includes(q);
    const gOk = state.groups.size === 0 || state.groups.has(s.group);
    const hOk = state.habitats.size === 0 || (s.habitats || []).some((h) => state.habitats.has(h));
    const seasonOk =
      state.seasons.size === 0 ||
      (s.seasonality &&
        Object.keys(s.seasonality).some((k) => state.seasons.has(k) && String(s.seasonality[k] || "").trim() !== ""));
    return qOk && gOk && hOk && seasonOk;
  }

  function renderFilters() {
    $groups.innerHTML = groups
      .map((g) => {
        const active = state.groups.has(g);
        return `<button class="chip ${active ? "is-active" : ""}" type="button" data-fg-group="${escapeHtml(g)}">${escapeHtml(
          g
        )}</button>`;
      })
      .join("");

    $habitats.innerHTML = (data.habitats || [])
      .map((h) => {
        const active = state.habitats.has(h.id);
        return `<button class="chip ${active ? "is-active" : ""}" type="button" data-fg-habitat="${escapeHtml(
          h.id
        )}">${escapeHtml(h.name)}</button>`;
      })
      .join("");

    $seasons.innerHTML = seasons
      .map((s) => {
        const active = state.seasons.has(s);
        return `<button class="chip ${active ? "is-active" : ""}" type="button" data-fg-season="${escapeHtml(s)}">${escapeHtml(
          s
        )}</button>`;
      })
      .join("");

    updateClearVisibility();
  }

  function renderGrid() {
    const filtered = data.species.filter(matches);
    $meta.textContent = `${filtered.length} item${filtered.length === 1 ? "" : "s"}`;

    if (filtered.length === 0) {
      $grid.innerHTML = `<div class="panel" style="grid-column:1 / -1">
        <div class="panel__title">No matches</div>
        <div class="panel__meta">Try clearing filters or using a shorter search.</div>
      </div>`;
      return;
    }

    $grid.innerHTML = filtered
      .map((s) => {
        const q = state.q;
        const habitatNames = (s.habitats || []).map((h) => (habitatsById[h] ? habitatsById[h].name : h));
        const note = s.notes || "";
        const cover = (s.cover && s.cover.src) || "assets/field-guide/placeholder.svg";

        return `<article class="fg-card is-clickable" role="button" tabindex="0" data-species-id="${escapeHtml(s.id)}" aria-label="Open details for ${escapeHtml(
          s.commonName
        )}">
          <img class="fg-card__img" src="./${escapeHtml(cover)}" alt="" loading="lazy" onerror="this.src='./assets/field-guide/placeholder.svg'" />
          <div class="fg-card__head">
            <div class="fg-card__title">${highlight(s.commonName, q)}</div>
            <div class="fg-card__meta">
              <span class="mini">${escapeHtml(s.group)}</span>
              ${s.scientificName ? `<span class="mini"><em>${highlight(s.scientificName, q)}</em></span>` : ""}
            </div>
          </div>
          <div class="fg-card__body">
            ${note ? `<div class="fg-card__note">${highlight(note, q)}</div>` : ""}
            <div class="fg-card__row"><span class="fg-label">Habitats</span> <span>${habitatNames
              .map((h) => highlight(h, q))
              .join(", ")}</span></div>
            ${s.watchFor && s.watchFor.length ? `<div class="fg-card__row"><span class="fg-label">Watch for</span> <span>${s.watchFor
              .map((w) => highlight(w, q))
              .join(", ")}</span></div>` : ""}
          </div>
        </article>`;
      })
      .join("");
  }

  function openSpeciesModalById(id) {
    const s = data.species.find((x) => x.id === id);
    if (!s) return;
    const q = state.q;
    const cover = (s.cover && s.cover.src) || "assets/field-guide/placeholder.svg";
    const habitatNames = (s.habitats || []).map((h) => (habitatsById[h] ? habitatsById[h].name : h));
    const habitatBadges = (s.habitats || [])
      .map((h) => {
        const hh = habitatsById[h];
        if (!hh) return null;
        return `<span class="mini">${highlight(hh.name, q)}</span>`;
      })
      .filter(Boolean)
      .join("");

    $speciesModalTitle.innerHTML = `${highlight(s.commonName, q)}${
      s.scientificName ? ` <span class="muted" style="font-weight:400"><em>${highlight(s.scientificName, q)}</em></span>` : ""
    }`;
    $speciesModalImg.src = `./${cover}`;
    $speciesModalImg.alt = `${s.commonName} cover photo`;
    if (s.cover && (s.cover.sourceUrl || s.cover.license || s.cover.artist)) {
      const artist = s.cover.artist ? `© ${escapeHtml(s.cover.artist)}` : "";
      const lic = s.cover.license ? escapeHtml(s.cover.license) : "";
      const licLink = s.cover.licenseUrl
        ? `<a href="${escapeHtml(s.cover.licenseUrl)}" target="_blank" rel="noopener">license</a>`
        : "";
      const srcLink = s.cover.sourceUrl
        ? `<a href="${escapeHtml(s.cover.sourceUrl)}" target="_blank" rel="noopener">source</a>`
        : "";
      const bits = [artist, lic].filter(Boolean).join(" · ");
      const links = [srcLink, licLink].filter(Boolean).join(" · ");
      $speciesModalCredit.innerHTML = `${bits}${bits && links ? " · " : ""}${links}`;
      $speciesModalCredit.hidden = false;
    } else {
      $speciesModalCredit.textContent = "";
      $speciesModalCredit.hidden = true;
    }
    // Tags to the right of the title (header)
    $speciesModalHeadTags.innerHTML = `<span class="mini">${escapeHtml(s.group)}</span>${habitatBadges ? habitatBadges : ""}`;
    // Keep old container unused (hidden in HTML) for backward compatibility
    $speciesModalMeta.innerHTML = "";
    $speciesModalNote.innerHTML = s.notes ? highlight(s.notes, q) : "<span class='muted'>No notes yet.</span>";
    $speciesModalHabitats.innerHTML = habitatNames.length ? habitatNames.map((h) => highlight(h, q)).join(", ") : "<span class='muted'>—</span>";
    $speciesModalWatchFor.innerHTML =
      s.watchFor && s.watchFor.length ? s.watchFor.map((w) => highlight(w, q)).join(", ") : "<span class='muted'>—</span>";

    const seasonLines = seasons
      .filter((k) => s.seasonality && String(s.seasonality[k] || "").trim() !== "")
      .map(
        (k) =>
          `<div class="fg-season"><strong>${escapeHtml(k)}:</strong> ${highlight(s.seasonality[k], q)}</div>`
      )
      .join("");
    $speciesModalSeasons.innerHTML = seasonLines || "<div class='muted'>—</div>";

    // Conservation status (structured fields; may be TBD until verified)
    const c = (s.conservation && typeof s.conservation === "object" ? s.conservation : null) || {};
    const cLines = [
      c.ukGbStatus ? `<div><strong>UK/GB status:</strong> ${escapeHtml(c.ukGbStatus)}</div>` : "",
      c.priority ? `<div><strong>Priority species/habitat:</strong> ${escapeHtml(c.priority)}</div>` : "",
      Array.isArray(c.protected) && c.protected.length
        ? `<div><strong>Protected status:</strong> ${c.protected.map((x) => escapeHtml(x)).join(", ")}</div>`
        : "",
      c.notes ? `<div class="muted" style="margin-top:6px">${escapeHtml(c.notes)}</div>` : "",
    ].filter(Boolean);
    $speciesModalConservation.innerHTML = cLines.length ? cLines.join("") : "<span class='muted'>—</span>";

    // Sources & further reading
    const sources = Array.isArray(s.sources) ? s.sources : [];
    if (sources.length) {
      $speciesModalSources.innerHTML = `<ul class="fg-sources">
        ${sources
          .map((it) => {
            const title = escapeHtml(it.title || "Source");
            const url = escapeHtml(it.url || "");
            const note = it.note ? ` <span class="muted">— ${escapeHtml(it.note)}</span>` : "";
            const link = url ? `<a href="${url}" target="_blank" rel="noopener">${title}</a>` : title;
            return `<li>${link}${note}</li>`;
          })
          .join("")}
      </ul>`;
    } else {
      $speciesModalSources.innerHTML = "<span class='muted'>—</span>";
    }

    if (!$speciesModal.open) $speciesModal.showModal();
  }

  // Initial render
  renderFilters();
  renderGrid();

  // Events
  $search.addEventListener("input", (e) => {
    state.q = e.target.value || "";
    updateClearVisibility();
    renderGrid();
  });

  document.addEventListener("click", (e) => {
    const card = e.target.closest("[data-species-id]");
    if (card) {
      openSpeciesModalById(card.dataset.speciesId);
      return;
    }

    const g = e.target.closest("[data-fg-group]");
    if (g) {
      const v = g.dataset.fgGroup;
      if (state.groups.has(v)) state.groups.delete(v);
      else state.groups.add(v);
      renderFilters();
      renderGrid();
      return;
    }

    const h = e.target.closest("[data-fg-habitat]");
    if (h) {
      const v = h.dataset.fgHabitat;
      if (state.habitats.has(v)) state.habitats.delete(v);
      else state.habitats.add(v);
      renderFilters();
      renderGrid();
      return;
    }

    const s = e.target.closest("[data-fg-season]");
    if (s) {
      const v = s.dataset.fgSeason;
      if (state.seasons.has(v)) state.seasons.delete(v);
      else state.seasons.add(v);
      renderFilters();
      renderGrid();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const card = e.target && e.target.closest && e.target.closest("[data-species-id]");
    if (!card) return;
    openSpeciesModalById(card.dataset.speciesId);
  });

  $speciesModalClose.addEventListener("click", () => $speciesModal.close());
  $speciesModal.addEventListener("click", (e) => {
    if (e.target === $speciesModal) $speciesModal.close();
  });

  $clear.addEventListener("click", () => {
    state.q = "";
    state.groups.clear();
    state.habitats.clear();
    state.seasons.clear();
    $search.value = "";
    updateClearVisibility();
    renderFilters();
    renderGrid();
  });
}

main();


