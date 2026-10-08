// select-dropdown.js — one designed menu for every <select> in the app (filters, items per page,
// the upload and save dialogs), instead of the browser's plain system list.
//
// The real <select> stays where it is and keeps its value, so layout and every app.js handler work
// unchanged: opening it shows this menu instead of the native one, and choosing an option sets the
// select's value and fires its usual `input` and `change` events.
//
// The menu lives in the browser's top layer (popover), so it also opens above modal dialogs.
// Keyboard: ↑ ↓ Home End to move, Enter to choose, Esc to close, letters to jump; long lists get a
// search box. Skipped for selects with class "sr-only" or attribute data-native.
(() => {
  'use strict';
  const SEARCH_MIN_OPTIONS = 9;
  const usePopover = typeof HTMLElement.prototype.showPopover === 'function';
  const CHECK = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

  const menu = document.createElement('div');
  menu.className = 'sd-menu';
  menu.id = 'selectDropdownMenu';
  menu.setAttribute('role', 'listbox');
  menu.tabIndex = -1;
  if (usePopover) menu.setAttribute('popover', 'manual'); else menu.hidden = true;
  menu.innerHTML = `
    <div class="sd-search" hidden>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.2" y2="16.2"/></svg>
      <input type="search" id="selectDropdownSearch" placeholder="Search…" autocomplete="off" aria-label="Search options">
    </div>
    <div class="sd-list"></div>
    <p class="sd-empty" hidden>No matches</p>`;
  document.body.appendChild(menu);
  const searchWrap = menu.querySelector('.sd-search');
  const search = menu.querySelector('input');
  const list = menu.querySelector('.sd-list');
  const empty = menu.querySelector('.sd-empty');

  let current = null;   // the <select> whose menu is open
  let items = [];       // { el, option }
  let active = -1;
  let typed = '';
  let typedTimer = 0;

  const eligible = el => el instanceof HTMLSelectElement && !el.multiple && !(el.size > 1)
    && !el.classList.contains('sr-only') && !el.hasAttribute('data-native');
  const isOpen = () => current !== null;

  function render(query = '') {
    const q = query.trim().toLowerCase();
    list.innerHTML = '';
    items = [];
    let lastGroup = null;
    for (const option of current.options) {
      if (option.hidden) continue;
      const text = option.textContent.trim();
      if (q && !text.toLowerCase().includes(q)) continue;
      const group = option.parentElement instanceof HTMLOptGroupElement ? option.parentElement.label : null;
      if (group && group !== lastGroup) {
        const heading = document.createElement('p');
        heading.className = 'sd-group';
        heading.textContent = group;
        list.appendChild(heading);
      }
      lastGroup = group;
      const el = document.createElement('div');
      el.className = 'sd-item';
      el.id = `sd-option-${items.length}`;
      el.setAttribute('role', 'option');
      const selected = option.selected;
      el.setAttribute('aria-selected', String(selected));
      if (option.disabled) el.setAttribute('aria-disabled', 'true');
      el.innerHTML = `<span class="sd-check">${selected ? CHECK : ''}</span><span class="sd-label"></span>`;
      el.querySelector('.sd-label').textContent = text || '—';
      el.dataset.index = String(items.length);
      list.appendChild(el);
      items.push({ el, option });
    }
    empty.hidden = items.length > 0;
    setActive(Math.max(0, items.findIndex(item => item.option.selected)), false);
  }

  function setActive(index, scroll = true) {
    if (!items.length) { active = -1; menu.removeAttribute('aria-activedescendant'); return; }
    active = Math.max(0, Math.min(items.length - 1, index));
    items.forEach((item, i) => item.el.classList.toggle('is-active', i === active));
    menu.setAttribute('aria-activedescendant', items[active].el.id);
    if (scroll) items[active].el.scrollIntoView({ block: 'nearest' });
  }

  function position() {
    const r = current.getBoundingClientRect();
    const gap = 6;
    const below = window.innerHeight - r.bottom - gap - 12;
    const above = r.top - gap - 12;
    const openUp = below < 220 && above > below;
    const room = Math.max(140, Math.min(360, openUp ? above : below));
    const width = Math.max(r.width, 200);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    Object.assign(menu.style, {
      left: `${Math.round(left)}px`,
      width: `${Math.round(width)}px`,
      maxHeight: `${Math.round(room)}px`,
      top: openUp ? 'auto' : `${Math.round(r.bottom + gap)}px`,
      bottom: openUp ? `${Math.round(window.innerHeight - r.top + gap)}px` : 'auto',
    });
    menu.dataset.side = openUp ? 'top' : 'bottom';
  }

  const motion = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches && typeof menu.animate === 'function';
  const SHIFT = side => side === 'top' ? 'translateY(6px) scale(0.98)' : 'translateY(-6px) scale(0.98)';
  let closing = null;   // the running close animation, if any
  let foldPoint = null; // where the menu unfolded from, so it folds back there

  function hideMenu() {
    if (usePopover) { if (menu.matches(':popover-open')) menu.hidePopover(); } else menu.hidden = true;
  }
  /** Ends a close that is still animating, hiding the menu at once. */
  function settleClose() {
    if (!closing) return;
    const anim = closing;
    closing = null;
    hideMenu();
    menu.classList.remove('is-closing');
    anim.cancel();
  }

  function open(select) {
    if (select.disabled) return;
    if (isOpen()) close(false);
    settleClose();
    current = select;
    // An open modal dialog makes everything outside it inert, so the menu must live inside the
    // dialog that holds the select (or back in <body> otherwise).
    const host = select.closest('dialog[open]') || document.body;
    if (menu.parentElement !== host) host.appendChild(menu);
    select.classList.add('sd-open');
    select.setAttribute('aria-expanded', 'true');
    menu.setAttribute('aria-label', select.getAttribute('aria-label') || select.labels?.[0]?.textContent?.trim() || 'Options');
    const showSearch = [...select.options].filter(o => !o.hidden).length >= SEARCH_MIN_OPTIONS;
    searchWrap.hidden = !showSearch;
    search.value = '';
    render();
    position();
    if (usePopover) menu.showPopover(); else menu.hidden = false;
    position(); // again, now that the menu has a size
    if (items[active]) items[active].el.scrollIntoView({ block: 'center' });
    (showSearch ? search : menu).focus({ preventScroll: true });
    if (motion()) {
      // Unfolds from the select's edge (scripts/motion.js); a plain slide if that isn't loaded.
      const r = select.getBoundingClientRect();
      foldPoint = { x: r.left + r.width / 2, y: menu.dataset.side === 'top' ? r.top : r.bottom };
      if (window.plaMotion) window.plaMotion.unfold(menu, foldPoint, 400);
      else menu.animate([{ opacity: 0, transform: SHIFT(menu.dataset.side) }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
    }
  }

  function close(refocus = true) {
    if (!isOpen()) return;
    const select = current;
    current = null;
    select.classList.remove('sd-open');
    select.setAttribute('aria-expanded', 'false');
    if (refocus) select.focus({ preventScroll: true });
    if (!motion()) { hideMenu(); return; }
    // The opening motion in reverse (folds back into the select); it ignores the pointer meanwhile.
    menu.getAnimations().forEach(a => a.finish());
    menu.classList.add('is-closing');
    const anim = window.plaMotion
      ? window.plaMotion.fold(menu, foldPoint, 240)
      : menu.animate(
        [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: SHIFT(menu.dataset.side) }],
        { duration: 200, easing: 'cubic-bezier(0.4, 0, 0.6, 1)', fill: 'forwards' }
      );
    closing = anim;
    anim.onfinish = () => { if (closing === anim) settleClose(); };
    setTimeout(() => { if (closing === anim) settleClose(); }, 400); // never left half-closed
  }

  function choose(index) {
    const item = items[index];
    if (!isOpen() || !item || item.option.disabled) return;
    const select = current;
    const changed = select.value !== item.option.value || select.selectedIndex !== item.option.index;
    select.selectedIndex = item.option.index;
    close();
    if (changed) {
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function typeAhead(char) {
    clearTimeout(typedTimer);
    typed += char.toLowerCase();
    typedTimer = setTimeout(() => { typed = ''; }, 700);
    const start = typed.length === 1 ? active + 1 : active;
    const order = [...items.slice(start), ...items.slice(0, start)];
    const hit = order.find(item => item.option.textContent.trim().toLowerCase().startsWith(typed));
    if (hit) setActive(items.indexOf(hit));
  }

  // Open instead of the native list: mouse.
  document.addEventListener('mousedown', event => {
    const select = event.target.closest?.('select');
    if (select && eligible(select)) {
      if (event.button !== 0) return;
      event.preventDefault();
      select.focus({ preventScroll: true });
      if (current === select) close(); else open(select);
      return;
    }
    if (isOpen() && !menu.contains(event.target)) close(false);
  }, true);

  // Open instead of the native list: keyboard on a focused select.
  document.addEventListener('keydown', event => {
    const select = event.target;
    if (isOpen() || !eligible(select)) return;
    const opens = [' ', 'Enter', 'ArrowDown', 'ArrowUp', 'F4'].includes(event.key) || (event.altKey && event.key === 'ArrowDown');
    if (!opens) return;
    event.preventDefault();
    open(select);
  }, true);

  // Keys inside the open menu (Escape must not also close a dialog behind it).
  menu.addEventListener('keydown', event => {
    if (!isOpen()) return;
    const key = event.key;
    if (key === 'ArrowDown') { event.preventDefault(); setActive(active + 1); }
    else if (key === 'ArrowUp') { event.preventDefault(); setActive(active - 1); }
    else if (key === 'Home' && event.target !== search) { event.preventDefault(); setActive(0); }
    else if (key === 'End' && event.target !== search) { event.preventDefault(); setActive(items.length - 1); }
    else if (key === 'PageDown') { event.preventDefault(); setActive(active + 8); }
    else if (key === 'PageUp') { event.preventDefault(); setActive(active - 8); }
    else if (key === 'Enter') { event.preventDefault(); choose(active); }
    else if (key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    else if (key === 'Tab') { close(); }
    else if (event.target !== search && key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) { typeAhead(key); }
  });

  search.addEventListener('input', () => render(search.value));
  list.addEventListener('mousemove', event => {
    const el = event.target.closest('.sd-item');
    if (el && Number(el.dataset.index) !== active) setActive(Number(el.dataset.index), false);
  });
  list.addEventListener('click', event => {
    const el = event.target.closest('.sd-item');
    if (el) choose(Number(el.dataset.index));
  });

  // The menu is placed under its select; if the page moves, close it rather than leave it floating.
  window.addEventListener('resize', () => close(false));
  document.addEventListener('scroll', event => { if (isOpen() && !menu.contains(event.target)) close(false); }, true);
  // A select removed or hidden while open (e.g. the upload list re-rendering) closes the menu.
  new MutationObserver(() => { if (isOpen() && (!current.isConnected || current.disabled || !current.offsetParent)) close(false); })
    .observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'disabled', 'class'] });
})();
