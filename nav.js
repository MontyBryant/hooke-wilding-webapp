/* global window, document */

(function () {
  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  const toggle = qs("#navToggle");
  const nav = qs("#topbarNav");
  const topbar = qs(".topbar");
  if (!toggle || !nav || !topbar) return;

  const OPEN_CLASS = "is-nav-open";

  function setOpen(next) {
    const on = !!next;
    document.body.classList.toggle(OPEN_CLASS, on);
    toggle.setAttribute("aria-expanded", on ? "true" : "false");
    toggle.setAttribute("aria-label", on ? "Close menu" : "Open menu");
  }

  function isOpen() {
    return document.body.classList.contains(OPEN_CLASS);
  }

  toggle.addEventListener("click", () => setOpen(!isOpen()));

  // Close when tapping outside the topbar (mobile UX).
  document.addEventListener("click", (e) => {
    if (!isOpen()) return;
    if (topbar.contains(e.target)) return;
    setOpen(false);
  });

  // Close on Esc.
  document.addEventListener("keydown", (e) => {
    if (!isOpen()) return;
    if (e.key === "Escape") setOpen(false);
  });

  // Close after selecting a link.
  nav.addEventListener("click", (e) => {
    const a = e.target && e.target.closest ? e.target.closest("a") : null;
    if (a) setOpen(false);
  });

  // If viewport grows, close (so desktop layout isn't stuck in "open").
  window.addEventListener("resize", () => {
    if (!isOpen()) return;
    if (window.matchMedia && window.matchMedia("(min-width: 741px)").matches) setOpen(false);
  });
})();


