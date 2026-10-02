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

  // --- Pages: the page being opened glides up and fades in -----------------------------------
  const panelObserver = new MutationObserver(records => {
    for (const record of records) {
      const panel = record.target;
      // Only when it goes from hidden (oldValue "") to shown; skip while the app is still loading.
      if (panel.hidden || record.oldValue === null || document.body.classList.contains('is-booting')) continue;
      animateIn(panel, 'translateY(14px)', { duration: 550 });
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
      // Runs after the app has positioned the popup, so its measurements are unaffected.
      animateIn(el, 'translateY(-6px) scale(0.96)', { duration: 420, origin: el.dataset.motionOrigin });
    }
  });
  for (const [selector, origin] of POPUPS) {
    document.querySelectorAll(selector).forEach(el => {
      el.dataset.motionOrigin = origin;
      popupObserver.observe(el, { attributes: true, attributeFilter: ['hidden'], attributeOldValue: true });
    });
  }

  // --- Dialogs: scale in on open, quick fade out on close ------------------------------------
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
      animateIn(this, 'translateY(12px) scale(0.94)', { duration: 500 });
    };

    proto.close = function (returnValue) {
      if (!this.open || !animate()) return nativeClose.call(this, returnValue);
      if (this.__closing) return;
      this.classList.add('is-closing');
      const anim = this.animate(
        [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(6px) scale(0.97)' }],
        { duration: 180, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' }
      );
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
