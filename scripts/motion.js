// motion.js — iOS-style motion for the app pages.
//
// It hooks into what the app already does instead of changing app.js:
//   • the active top-nav item      → a sliding underline (GSAP)
//   • a page (.panel) being shown   → the page glides up into place
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
  const animate = () => !reducedMotion.matches && typeof Element.prototype.animate === 'function';
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
      if (!active) return;
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
      window.gsap.to(bar, { ...target, duration: 0.55, ease: 'expo.out', overwrite: true });
    };
    new MutationObserver(() => place(true)).observe(nav, { attributes: true, subtree: true, attributeFilter: ['class', 'hidden'] });
    window.addEventListener('resize', () => place(false));
    document.fonts?.ready.then(() => place(false));
    place(false);
  }

  // --- Pages: the new page sweeps in from the side of the tab you moved to --------------------
  // A soft-edged mask sweeps across it while it slides a little the same way (no fade). Only the
  // page being shown animates, and nothing stays on it afterwards, so menus and filters are unaffected.
  const PAGE_ORDER = [...document.querySelectorAll('.nav-item')].map(item => item.dataset.panel);
  let shownPanel = document.querySelector('.panel:not([hidden])')?.id || null;
  function sweepIn(panel, fromRight) {
    panel.getAnimations().forEach(a => a.id === 'pla-page' && a.cancel());
    const mask = `linear-gradient(${fromRight ? 'to left' : 'to right'}, #000 42%, transparent 58%)`;
    const base = { maskImage: mask, webkitMaskImage: mask, maskSize: '300% 100%', webkitMaskSize: '300% 100%', maskRepeat: 'no-repeat', webkitMaskRepeat: 'no-repeat' };
    const [from, to] = fromRight ? ['0% 0%', '100% 0%'] : ['100% 0%', '0% 0%'];
    const anim = panel.animate([
      { ...base, maskPosition: from, webkitMaskPosition: from, transform: `translateX(${fromRight ? 36 : -36}px)` },
      { ...base, maskPosition: to, webkitMaskPosition: to, transform: 'none' },
    ], { duration: 640, easing: IOS_EASE });
    anim.id = 'pla-page';
    setTimeout(() => { if (anim.playState === 'running') anim.finish(); }, 800);
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
      sweepIn(panel, PAGE_ORDER.indexOf(panel.id) >= PAGE_ORDER.indexOf(previous));
    }
  });
  document.querySelectorAll('.panel').forEach(panel => panelObserver.observe(panel, { attributes: true, attributeFilter: ['hidden'], attributeOldValue: true }));

  // --- Popups: grow out from where they open -------------------------------------------------
  const POPUPS = [
    ['#notificationsDropdown', 'top right'],
    ['#adjustmentBar', 'top right'],
    ['#listSwitcherMenu', 'top left'],
    ['#categoryMenu', 'top left'],
    ['#rowMenu', 'top right'],
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
})();
