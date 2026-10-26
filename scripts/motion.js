// motion.js — iOS-style motion for the app pages.
//
// It hooks into what the app already does instead of changing app.js:
//   • the active top-nav item      → a sliding underline that stretches between tabs (GSAP)
//   • a page picked in the top menu → the old page swings away, the new one swings in (pageSwap)
//   • any other page (.panel) shown → the page glides into place
//   • <dialog> showModal / close    → scale and fade in on open, quick fade out on close
//   • popups whose `hidden` is removed (notifications, Edit prices, switchers, row menus,
//     dev tools) → they grow out from where they open
//
// Pages, dialogs and popups use the browser's own Web Animations API, not GSAP: when GSAP first
// measures an element it thinks isn't displayed (an open modal dialog looks like that to it), it
// briefly takes the element out of the page and puts it back, and a dialog put back loses its
// modal "top layer" — it stays open but drops below the page, blocking every click.
//
// Everything is skipped when the computer asks for reduced motion.
(() => {
  'use strict';
  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Asked each time, so Config › Display › Reduce motion (scripts/reduce-motion.js) counts at once.
  const animate = () => !window.plaReducedMotion?.() && !reducedMotion.matches && typeof Element.prototype.animate === 'function';
  // Lets styles/app.css switch off the plain CSS keyframes for the elements animated here.
  root.classList.add('gsap-motion');

  // iOS motion: a fast start that settles slowly.
  const IOS_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
  // Closing: the same path in reverse, easing out of view without a hard stop.
  const CLOSE_EASE = 'cubic-bezier(0.4, 0, 0.6, 1)';

  /**
   * Plays a short entrance from `from` (opacity/transform) to the element's normal look.
   * The element's own styles are never changed, so if the browser pauses animation frames the
   * element is simply shown as normal once the timer below finishes the animation.
   */
  function animateIn(el, from, { duration = 500, origin = '' } = {}) {
    if (!animate()) return null;
    el.getAnimations?.().forEach(a => a.id === 'pla-motion' && a.cancel());
    const anim = el.animate(
      [{ opacity: 0, transform: from, transformOrigin: origin || 'center' }, { opacity: 1, transform: 'none', transformOrigin: origin || 'center' }],
      { duration, easing: IOS_EASE }
    );
    anim.id = 'pla-motion';
    setTimeout(() => { if (anim.playState === 'running') anim.finish(); }, duration + 150);
    return anim;
  }

  // --- Unfold / fold: a box grows out of a point, or shrinks back into it ---------------------
  // Dialogs and popups open and close this way instead of fading: the content stays in place while
  // the box's rounded edges move, like the upload window resizing between its two views.
  let lastPointer = null;
  document.addEventListener('pointerdown', event => { lastPointer = { x: event.clientX, y: event.clientY, at: performance.now() }; }, true);
  /** Where the person just acted: a click in the last moment, else the focused control. */
  function actionPoint() {
    if (lastPointer && performance.now() - lastPointer.at < 1500) return lastPointer;
    const active = document.activeElement;
    if (active && active !== document.body && active.getBoundingClientRect) {
      const r = active.getBoundingClientRect();
      if (r.width || r.height) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    return null;
  }
  /** A corner or edge of the element ('top right', 'bottom left', …). */
  function cornerPoint(el, origin = 'center') {
    const r = el.getBoundingClientRect();
    return {
      x: /left/.test(origin) ? r.left : /right/.test(origin) ? r.right : r.left + r.width / 2,
      y: /top/.test(origin) ? r.top : /bottom/.test(origin) ? r.bottom : r.top + r.height / 2,
    };
  }
  /** Clip shapes: a small box at the point nearest `point` inside the element, the element, and the
   *  element plus room for its shadow. */
  function clipBoxes(el, point) {
    const r = el.getBoundingClientRect();
    const W = r.width, H = r.height;
    const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    const w = Math.min(W, Math.max(64, W * 0.24)), h = Math.min(H, Math.max(32, H * 0.14));
    const p = point || { x: r.left + W / 2, y: r.top + H / 2 };
    const cx = Math.min(Math.max(p.x - r.left, w / 2), W - w / 2);
    const cy = Math.min(Math.max(p.y - r.top, h / 2), H - h / 2);
    const px = value => `${Math.round(value * 10) / 10}px`;
    return {
      small: `inset(${px(cy - h / 2)} ${px(W - cx - w / 2)} ${px(H - cy - h / 2)} ${px(cx - w / 2)} round ${px(Math.min(radius, h / 2))})`,
      full: `inset(0px 0px 0px 0px round ${px(radius)})`,
      shadow: `inset(-90px -90px -90px -90px round ${px(radius)})`,
    };
  }
  function unfold(el, point, duration = 480) {
    if (!animate()) return null;
    el.getAnimations().forEach(a => (a.id === 'pla-motion' || a.id === 'pla-fold') && a.cancel());
    const box = clipBoxes(el, point);
    const anim = el.animate(
      [{ clipPath: box.small, opacity: 0 }, { opacity: 1, offset: 0.1 }, { clipPath: box.full, offset: 0.8 }, { clipPath: box.shadow, opacity: 1 }],
      { duration, easing: IOS_EASE }
    );
    anim.id = 'pla-motion';
    setTimeout(() => { if (anim.playState === 'running') anim.finish(); }, duration + 150);
    return anim;
  }
  function fold(el, point, duration = 300) {
    const box = clipBoxes(el, point);
    const anim = el.animate(
      [{ clipPath: box.shadow, opacity: 1 }, { clipPath: box.full, offset: 0.12 }, { clipPath: box.small, opacity: 1, offset: 0.88 }, { clipPath: box.small, opacity: 0 }],
      { duration, easing: CLOSE_EASE, fill: 'forwards' }
    );
    anim.id = 'pla-fold';
    return anim;
  }
  // The select menus (scripts/select-dropdown.js) use the same motion.
  window.plaMotion = { unfold, fold, animate };

  // --- Top nav: one underline that slides to the active page (GSAP) --------------------------
  const nav = document.querySelector('.top-nav');
  if (nav) {
    const bar = document.createElement('span');
    bar.className = 'nav-indicator';
    bar.setAttribute('aria-hidden', 'true');
    nav.appendChild(bar);
    let placed = false;
    const place = (withMotion = true) => {
      const active = nav.querySelector('.nav-item.active:not([hidden])');
      // No page lit (an open file: its tab under the bar is the one highlighted), so the underline fades.
      if (!active) {
        if (window.gsap && placed && animate()) window.gsap.to(bar, { opacity: 0, duration: 0.25, ease: 'power2.out', overwrite: true });
        else bar.style.opacity = '0';
        return;
      }
      const target = { x: active.offsetLeft, width: active.offsetWidth, opacity: 1 };
      if (!window.gsap) {
        Object.assign(bar.style, { transform: `translateX(${target.x}px)`, width: `${target.width}px`, opacity: '1' });
        return;
      }
      if (!placed || !withMotion || !animate()) {
        window.gsap.set(bar, target);
        placed = true;
        return;
      }
      // Moving to another page the underline stretches like taffy: its far edge reaches the new tab
      // first, then the near edge catches up. (Coming back from an open file it just slides in.)
      const fromX = Number(window.gsap.getProperty(bar, 'x')) || 0;
      const fromW = Number(window.gsap.getProperty(bar, 'width')) || 0;
      const shown = Number(window.gsap.getProperty(bar, 'opacity')) > 0.5;
      if (Math.round(fromX) === Math.round(target.x) && Math.round(fromW) === Math.round(target.width)) return;
      window.gsap.killTweensOf(bar);
      if (!shown || !fromW) { window.gsap.to(bar, { ...target, duration: 0.55, ease: 'expo.out' }); return; }
      const left = Math.min(fromX, target.x);
      window.gsap.timeline()
        .to(bar, { x: left, width: Math.max(fromX + fromW, target.x + target.width) - left, opacity: 1, duration: 0.17, ease: 'power2.in' })
        .to(bar, { ...target, duration: 0.45, ease: 'expo.out' });
    };
    new MutationObserver(() => place(true)).observe(nav, { attributes: true, subtree: true, attributeFilter: ['class', 'hidden'] });
    window.addEventListener('resize', () => place(false));
    document.fonts?.ready.then(() => place(false));
    place(false);
  }

  // --- Pages: the new page glides in from the side of the tab you moved to (iOS-style) --------
  // Its sections (title, tabs, cards) follow one another a beat apart. Only position, depth and a
  // brief opacity ramp change, so the graphics card runs it without repainting the page each frame.
  // Nothing stays on the page afterwards, so menus and filters are unaffected.
  const PAGE_ORDER = [...document.querySelectorAll('.nav-item')].map(item => item.dataset.panel);
  let shownPanel = document.querySelector('.panel:not([hidden])')?.id || null;
  const PAGE_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
  function glideIn(panel, fromRight) {
    const parts = [...panel.children]
      .filter(el => !el.hidden && el.offsetParent !== null && el.tagName !== 'DIALOG')
      .slice(0, 5);
    const shift = fromRight ? 34 : -34;
    parts.forEach((el, index) => {
      el.getAnimations().forEach(a => a.id === 'pla-page' && a.cancel());
      const delay = index * 55;
      const anim = el.animate(
        [
          { opacity: 0, transform: `translate3d(${shift}px, 0, 0) scale(0.99)` },
          { opacity: 1, offset: 0.35 },
          { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
        ],
        { duration: 680, delay, easing: PAGE_EASE, fill: 'backwards' }
      );
      anim.id = 'pla-page';
      setTimeout(() => { if (anim.playState === 'running') anim.finish(); }, 680 + delay + 200);
    });
  }
  /** During a page swap (below) the page's sections are dealt onto it from below, one after another. */
  function dealIn(panel) {
    [...panel.children]
      .filter(el => !el.hidden && el.offsetParent !== null && el.tagName !== 'DIALOG')
      .slice(0, 5)
      .forEach((el, index) => {
        el.getAnimations().forEach(a => a.id === 'pla-page' && a.cancel());
        const delay = 110 + index * 40;
        const anim = el.animate(
          [
            { opacity: 0, transform: 'translate3d(0, 22px, 0) scale(0.985)' },
            { opacity: 1, offset: 0.4 },
            { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
          ],
          { duration: 460, delay, easing: PAGE_EASE, fill: 'backwards' }
        );
        anim.id = 'pla-page';
        setTimeout(() => { if (anim.playState === 'running') anim.finish(); }, 460 + delay + 200);
      });
  }
  const panelObserver = new MutationObserver(records => {
    for (const record of records) {
      const panel = record.target;
      // Only when it goes from hidden (oldValue "") to shown.
      if (panel.hidden || record.oldValue === null) continue;
      const previous = shownPanel;
      shownPanel = panel.id;
      // Skip while the app is still loading, and when nothing changed.
      if (!previous || previous === panel.id || document.body.classList.contains('is-booting') || !animate()) continue;
      // Leftover motion on the page being left stops at once.
      document.getElementById(previous)?.querySelectorAll(':scope > *').forEach(el => el.getAnimations().forEach(a => a.id === 'pla-page' && a.finish()));
      if (root.classList.contains('pla-page-vt')) dealIn(panel);
      else glideIn(panel, PAGE_ORDER.indexOf(panel.id) >= PAGE_ORDER.indexOf(previous));
    }
  });
  document.querySelectorAll('.panel').forEach(panel => panelObserver.observe(panel, { attributes: true, attributeFilter: ['hidden'], attributeOldValue: true }));

  // --- Page changes from the top menu (a view transition, styles/app.css › "Page changes"): the
  // page you leave swings back and away like a card in a carousel, and the new one swings in from
  // the side of the tab you picked. Only the page area moves; the top bar stays put. About half a
  // second. ---
  let swapping = null;
  /**
   * Shows page `targetId` with the swap; `update` is what actually switches the page (called by the
   * browser a moment later). Returns false when it doesn't animate, so the caller switches at once.
   */
  function pageSwap(targetId, update) {
    const current = document.querySelector('.panel:not([hidden])')?.id;
    if (!animate() || typeof document.startViewTransition !== 'function' || !current || current === targetId || document.body.classList.contains('is-booting')) return false;
    // The open file sits between Files and the pages after it.
    const order = id => (id === 'workspacePanel' ? PAGE_ORDER.indexOf('filesPanel') + 0.5 : PAGE_ORDER.indexOf(id));
    const forward = order(targetId) >= order(current);
    swapping?.skipTransition();
    root.classList.remove('pla-page-fwd', 'pla-page-back');
    root.classList.add('pla-page-vt', forward ? 'pla-page-fwd' : 'pla-page-back');
    const transition = swapping = document.startViewTransition(update);
    transition.ready.catch(() => { });
    transition.finished.catch(() => { }).finally(() => {
      if (swapping !== transition) return; // a newer swap took over
      swapping = null;
      root.classList.remove('pla-page-vt', 'pla-page-fwd', 'pla-page-back');
    });
    return true;
  }
  window.plaMotion.pageSwap = pageSwap;

  // --- Popups: grow out from where they open -------------------------------------------------
  const POPUPS = [
    ['#notificationsDropdown', 'top right'],
    ['#adjustmentBar', 'top right'],
    ['#listSwitcherMenu', 'top left'],
    ['#categoryMenu', 'top left'],
    ['#codeSuggest', 'top left'],
    ['#rowMenu', 'top right'],
    ['#exportMenu', 'top right'],
    ['.dev-tools-panel', 'bottom left'],
  ];
  const popupObserver = new MutationObserver(records => {
    for (const record of records) {
      const el = record.target;
      if (el.hidden || record.oldValue === null) continue;
      // Runs after the app has positioned the popup. It unfolds from the button that opened it
      // (or its anchored corner) and later folds back into the same spot.
      el.__foldPoint = actionPoint() || cornerPoint(el, el.dataset.motionOrigin);
      unfold(el, el.__foldPoint, 440);
    }
  });
  for (const [selector, origin] of POPUPS) {
    document.querySelectorAll(selector).forEach(el => {
      el.dataset.motionOrigin = origin;
      popupObserver.observe(el, { attributes: true, attributeFilter: ['hidden'], attributeOldValue: true });
      animateClosing(el);
    });
  }

  /**
   * Popups close with their opening motion in reverse. The app hides them with `el.hidden = true`:
   * from that moment `el.hidden` reads true (so the app's open/closed checks stay right), while the
   * popup stays on screen, ignoring clicks, until the motion ends. Reopened mid-close, it glides back.
   */
  function animateClosing(el) {
    const prop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'hidden');
    if (!prop?.get || !prop.set || Object.prototype.hasOwnProperty.call(el, 'hidden')) return;
    let closing = null;
    const done = anim => {
      if (closing !== anim) return;
      closing = null;
      prop.set.call(el, true);
      el.style.pointerEvents = '';
      anim.cancel();
    };
    Object.defineProperty(el, 'hidden', {
      configurable: true,
      get() { return closing ? true : prop.get.call(el); },
      set(value) {
        const hide = Boolean(value);
        if (closing && !hide) {
          // Reopened while closing: play the close backwards to fully open.
          const anim = closing;
          closing = null;
          el.style.pointerEvents = '';
          anim.onfinish = () => anim.cancel();
          anim.reverse();
          setTimeout(() => anim.cancel(), 400);
          return;
        }
        if (closing) return; // already on its way out
        if (!hide || prop.get.call(el) || !animate()) { prop.set.call(el, hide); return; }
        el.getAnimations().forEach(a => a.id === 'pla-motion' && a.finish());
        el.style.pointerEvents = 'none';
        const anim = fold(el, el.__foldPoint || cornerPoint(el, el.dataset.motionOrigin), 260);
        closing = anim;
        anim.onfinish = () => done(anim);
        setTimeout(() => done(anim), 420); // never left half-closed if frames stall
      },
    });
  }

  // --- Dialogs: unfold on open, fold back on close -------------------------------------------
  const proto = window.HTMLDialogElement?.prototype;
  if (proto && !proto.__plaMotion) {
    proto.__plaMotion = true;
    const nativeShowModal = proto.showModal;
    const nativeClose = proto.close;

    proto.showModal = function (...args) {
      if (this.__closing) {
        // Reopened while closing: cancel the close and stay open.
        this.__closing.cancel();
        this.__closing = null;
        clearTimeout(this.__closingTimer);
        this.classList.remove('is-closing');
      }
      if (!this.open) nativeShowModal.apply(this, args);
      if (!this.__motionCancel) {
        // Escape: let the app's own cancel handlers run first; if none stopped it, close with motion.
        this.__motionCancel = true;
        this.addEventListener('cancel', event => {
          if (event.defaultPrevented || !animate()) return;
          event.preventDefault();
          this.close();
        });
      }
      // Unfolds from the button that opened it; closing folds it back into the same spot.
      this.__foldPoint = actionPoint();
      unfold(this, this.__foldPoint, 520);
    };

    proto.close = function (returnValue) {
      if (!this.open || !animate()) return nativeClose.call(this, returnValue);
      if (this.__closing) return;
      this.classList.add('is-closing');
      this.getAnimations().forEach(a => a.id === 'pla-motion' && a.finish());
      const anim = fold(this, this.__foldPoint, 280);
      this.__closing = anim;
      const finish = () => {
        if (this.__closing !== anim) return;
        this.__closing = null;
        clearTimeout(this.__closingTimer);
        this.classList.remove('is-closing');
        returnValue === undefined ? nativeClose.call(this) : nativeClose.call(this, returnValue);
        anim.cancel();
      };
      anim.onfinish = finish;
      // Animation frames pause in background tabs; never leave a dialog half-closed because of that.
      this.__closingTimer = setTimeout(finish, 400);
    };

    // <form method="dialog"> closes its dialog without calling close(); route it through close()
    // so it animates too. Runs after the app's own submit handlers (bubble phase on document).
    document.addEventListener('submit', event => {
      const form = event.target;
      if (event.defaultPrevented || !(form instanceof HTMLFormElement) || form.method !== 'dialog' || !animate()) return;
      const dialog = form.closest('dialog');
      if (!dialog?.open) return;
      event.preventDefault();
      dialog.close(event.submitter?.value ?? '');
    });
  }

  // --- The logo: "Fresh prices, baked daily." slides out on hover while PLA rises like dough (CSS).
  // Hover it five times in a row and the mark does one full spin: "Okay, okay, you found it. 🥐"
  // Once per page load, so it never gets in the way. ---
  const brand = document.querySelector('.topbar .brand');
  const quip = brand?.querySelector('.brand-quip');
  if (brand && quip) {
    const QUIP = quip.textContent;
    let hovers = 0;
    let lastLeave = 0;
    let found = false;
    brand.addEventListener('mouseenter', () => {
      if (found) return;
      hovers = Date.now() - lastLeave < 1500 ? hovers + 1 : 1; // only quick hovers in a row count
      if (hovers < 5) return;
      found = true;
      quip.textContent = 'Okay, okay, you found it. 🥐';
      brand.classList.add('is-found');
      const mark = brand.querySelector('.pla-mark');
      if (mark && animate()) mark.animate([{ transform: 'rotate(0deg) scale(1)' }, { transform: 'rotate(-200deg) scale(1.12)', offset: 0.55 }, { transform: 'rotate(-360deg) scale(1)' }], { duration: 900, easing: IOS_EASE });
    });
    brand.addEventListener('mouseleave', () => {
      lastLeave = Date.now();
      if (!brand.classList.contains('is-found')) return;
      setTimeout(() => { brand.classList.remove('is-found'); quip.textContent = QUIP; }, 350); // back to the usual line once it has faded
    });
  }

  // --- Little pastries: tiny croissants and waffle cones (with a pink scoop) float down the top bar,
  // swaying as they go, and specks of sugar twinkle here and there. The pointer is a whisk: pastries
  // near it get stirred into a little swirl around it, then drift on. One canvas behind the bar's contents; it pauses while the
  // tab is hidden and stays off with reduced motion. ---
  const topbar = document.querySelector('.topbar');
  if (topbar && typeof HTMLCanvasElement !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.className = 'flour-dust';
    canvas.setAttribute('aria-hidden', 'true');
    topbar.prepend(canvas);
    const ctx = canvas.getContext('2d');
    let width = 0, height = 0, ratio = 1, frame = 0, running = false;
    const pointer = { x: -999, y: -999, active: false };
    const bits = [];
    const PASTRIES = 9, SUGAR = 6;
    // Each pastry is drawn once into a small sprite (per theme, at screen resolution), then stamped.
    const SPRITE_SCALE = 3;
    function makeSprite(w, h, paint) {
      const sprite = document.createElement('canvas');
      sprite.width = w * SPRITE_SCALE; sprite.height = h * SPRITE_SCALE;
      const c = sprite.getContext('2d');
      c.scale(SPRITE_SCALE, SPRITE_SCALE);
      paint(c);
      return { canvas: sprite, w, h };
    }
    // A croissant: five golden layers in a crescent, darker between the layers.
    const croissant = () => makeSprite(20, 13, c => {
      const layers = [[3.2, 8.6, 2.6, 2.0, -0.7], [6.4, 6.4, 3.4, 2.9, -0.35], [10, 5.6, 4.2, 3.6, 0], [13.6, 6.4, 3.4, 2.9, 0.35], [16.8, 8.6, 2.6, 2.0, 0.7]];
      layers.forEach(([x, y, rx, ry, rot], i) => {
        const g = c.createLinearGradient(x, y - ry, x, y + ry);
        g.addColorStop(0, i === 2 ? '#f6c879' : '#f0bd6c');
        g.addColorStop(1, '#c47a2c');
        c.fillStyle = g;
        c.strokeStyle = 'rgba(122, 64, 18, .55)';
        c.lineWidth = 0.6;
        c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); c.fill(); c.stroke();
      });
      c.fillStyle = 'rgba(255, 244, 214, .7)'; // the glaze shine on top
      c.beginPath(); c.ellipse(9.2, 3.6, 2.2, 0.8, -0.15, 0, Math.PI * 2); c.fill();
    });
    // A waffle cone with a scoop: a crosshatched cone under a pink scoop with a little shine.
    const cone = scoop => makeSprite(12, 18, c => {
      c.fillStyle = '#e3ae67';
      c.beginPath(); c.moveTo(1.6, 7.4); c.lineTo(10.4, 7.4); c.lineTo(6, 17.2); c.closePath(); c.fill();
      c.save(); c.clip();
      c.strokeStyle = 'rgba(150, 92, 34, .7)'; c.lineWidth = 0.55;
      for (let i = -12; i < 14; i += 2.4) { c.beginPath(); c.moveTo(i, 7); c.lineTo(i + 10, 18); c.stroke(); c.beginPath(); c.moveTo(i + 10, 7); c.lineTo(i, 18); c.stroke(); }
      c.restore();
      c.fillStyle = scoop;
      c.beginPath(); c.arc(6, 5.6, 4.6, Math.PI * 0.95, Math.PI * 2.05); c.lineTo(10.6, 7.6);
      for (let x = 10.6; x > 1.4; x -= 2.3) c.quadraticCurveTo(x - 1.15, 9.2, x - 2.3, 7.6); // the drippy rim
      c.closePath(); c.fill();
      c.fillStyle = 'rgba(255, 255, 255, .6)';
      c.beginPath(); c.ellipse(4.3, 3.6, 1.4, 0.8, -0.5, 0, Math.PI * 2); c.fill();
    });
    const SPRITES = {
      light: { croissant: croissant(), cone: cone('#f29bb6') },
      dark: { croissant: croissant(), cone: cone('#fabbcb') },
    };
    const rand = (min, max) => min + Math.random() * (max - min);
    const seed = (bit, kind, top = false) => Object.assign(bit, {
      kind, x: rand(0, width), y: top ? rand(-22, -12) : rand(0, height),
      scale: rand(0.85, 1.15), angle: rand(-0.4, 0.4), spin: 0, sway: rand(0.25, 0.45),
      fall: kind === 'sugar' ? rand(0.01, 0.04) : rand(0.1, 0.2), drift: rand(0.05, 0.16),
      size: rand(1.6, 2.8), phase: rand(0, Math.PI * 2), vx: 0, vy: 0,
    });
    function resize() {
      const box = topbar.getBoundingClientRect();
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = box.width; height = box.height;
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (!bits.length) {
        for (let i = 0; i < PASTRIES; i++) bits.push(seed({}, i % 2 ? 'cone' : 'croissant'));
        for (let i = 0; i < SUGAR; i++) bits.push(seed({}, 'sugar'));
      }
      bits.forEach(bit => { if (bit.x > width + 10) bit.x = rand(0, width); });
    }
    function pastry(bit, time, dark) {
      // A gentle pendulum sway while falling, plus any spin from the whisk; it turns a little in depth too.
      const sprite = SPRITES[dark ? 'dark' : 'light'][bit.kind];
      const rotation = bit.angle + Math.sin(time / 1400 + bit.phase) * bit.sway;
      const depth = 0.8 + Math.abs(Math.cos(time / 2200 + bit.phase)) * 0.2;
      ctx.save();
      ctx.translate(bit.x, bit.y);
      ctx.rotate(rotation);
      ctx.scale(bit.scale * depth, bit.scale);
      ctx.globalAlpha = dark ? 0.92 : 0.95;
      ctx.drawImage(sprite.canvas, -sprite.w / 2, -sprite.h / 2, sprite.w, sprite.h);
      ctx.restore();
    }
    function sugar(bit, time, dark) {
      // A four-point glint that swells and fades.
      const glint = Math.max(0, Math.sin(time / 900 + bit.phase));
      if (glint < 0.05) return;
      const s = bit.size * (0.6 + glint * 0.9);
      ctx.save();
      ctx.translate(bit.x, bit.y);
      ctx.rotate(Math.PI / 4 * glint);
      ctx.globalAlpha = glint * (dark ? 0.85 : 0.7);
      ctx.fillStyle = dark ? '#fff1f4' : '#d9839d';
      ctx.beginPath();
      ctx.moveTo(0, -s * 2); ctx.quadraticCurveTo(0, 0, s * 2, 0); ctx.quadraticCurveTo(0, 0, 0, s * 2);
      ctx.quadraticCurveTo(0, 0, -s * 2, 0); ctx.quadraticCurveTo(0, 0, 0, -s * 2);
      ctx.fill();
      ctx.restore();
    }
    function draw(time) {
      if (root.classList.contains('theme-busy')) { frame = requestAnimationFrame(draw); return; } // held still during a theme switch
      ctx.clearRect(0, 0, width, height);
      const dark = root.dataset.theme === 'dark';
      bits.forEach(bit => {
        if (bit.kind !== 'sugar' && pointer.active) {
          // A light stir: pastries right by the pointer drift a little around it, nothing more.
          const dx = bit.x - pointer.x, dy = bit.y - pointer.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 55 && dist > 0.5) {
            const strength = (1 - dist / 55);
            bit.vx += (-dy / dist) * strength * 0.1 + (dx / dist) * strength * 0.04;
            bit.vy += (dx / dist) * strength * 0.1 + (dy / dist) * strength * 0.04;
            bit.spin += strength * 0.0012;
          }
        }
        bit.vx *= 0.88; bit.vy *= 0.88; // settles quickly
        bit.spin = Math.min(0.02, bit.spin * 0.9); // at most a slight turn, then back to swaying
        bit.x += bit.drift + bit.vx;
        bit.y += bit.fall + bit.vy;
        bit.angle += bit.spin;
        if (bit.kind !== 'sugar') bit.angle = Math.atan2(Math.sin(bit.angle), Math.cos(bit.angle)) * 0.985; // turns back upright
        if (bit.y > height + 14) seed(bit, bit.kind, true);
        if (bit.y < -14) bit.y = height + 8;
        if (bit.x > width + 10) bit.x = -10; else if (bit.x < -12) bit.x = width + 8;
        if (bit.kind === 'sugar') sugar(bit, time, dark); else pastry(bit, time, dark);
      });
      frame = requestAnimationFrame(draw);
    }
    const start = () => { if (running || !animate() || document.hidden) return; running = true; resize(); frame = requestAnimationFrame(draw); };
    const stop = () => { running = false; cancelAnimationFrame(frame); ctx.clearRect(0, 0, width, height); };
    topbar.addEventListener('pointermove', event => { const box = topbar.getBoundingClientRect(); pointer.x = event.clientX - box.left; pointer.y = event.clientY - box.top; pointer.active = true; });
    topbar.addEventListener('pointerleave', () => { pointer.active = false; });
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    reducedMotion.addEventListener?.('change', () => (animate() ? start() : stop()));
    window.addEventListener('pla:reduce-motion', () => (animate() ? start() : stop()));
    new ResizeObserver(() => running && resize()).observe(topbar);
    start();
  }
})();
