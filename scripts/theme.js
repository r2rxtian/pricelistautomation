// theme.js — light/dark mode for every page. The page <head> applies the saved theme before first
// paint; this wires up the .theme-toggle-btn buttons and keeps their sun/moon icons in sync.
(() => {
  'use strict';
  const KEY = 'pla_theme';

  function applyTheme(theme) {
    const isDark = theme === 'dark';
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.body.removeAttribute('data-theme');
    }
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      const sun = btn.querySelector('.theme-icon-sun');
      const moon = btn.querySelector('.theme-icon-moon');
      // The icons are <svg> elements, which have no .hidden property: set the attribute itself.
      sun?.toggleAttribute('hidden', !isDark);
      moon?.toggleAttribute('hidden', isDark);
      btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      btn.setAttribute('title', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    });
  }

  // --- Sign-in / sign-out hand-off ---------------------------------------------------------------
  // Leaving the login page or the app, the page closes in a circle into the button that was clicked
  // and saves that point; the next page then opens in a circle from the same point. The page <head>
  // reads the point and hides the page (html.reveal-pending) so nothing flashes before this runs.
  window.plaHandOff = (x, y) => {
    try { sessionStorage.setItem('pla_reveal', JSON.stringify({ x: Math.round(x), y: Math.round(y), at: Date.now() })); } catch { }
  };
  (() => {
    const root = document.documentElement;
    if (!root.classList.contains('reveal-pending')) return;
    const page = document.querySelector('[data-reveal-root]');
    const x = parseFloat(root.style.getPropertyValue('--reveal-x')) || innerWidth / 2;
    const y = parseFloat(root.style.getPropertyValue('--reveal-y')) || innerHeight / 2;
    if (page?.animate) {
      const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      page.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 720, easing: 'cubic-bezier(.22, 1, .36, 1)' }
      );
    }
    root.classList.remove('reveal-pending');
  })();

  // --- Buttons: the soft light on primary/secondary buttons follows the cursor (styles/app.css) ---
  // Lives here because this script is loaded on every page, including sign-in.
  document.addEventListener('pointermove', event => {
    const button = event.target.closest?.('.button.primary, .button.secondary');
    if (!button) return;
    const box = button.getBoundingClientRect();
    button.style.setProperty('--mx', `${Math.round(event.clientX - box.left)}px`);
    button.style.setProperty('--my', `${Math.round(event.clientY - box.top)}px`);
  }, { passive: true });

  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));

  // Lamp pull: a little bead chain hangs under each theme toggle (it slides down on hover) and
  // gets a tug on click; then the light goes out into the toggle (dark) or flickers on (light).
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    if (btn.querySelector('.lamp-chain')) return;
    const chain = document.createElement('span');
    chain.className = 'lamp-chain';
    chain.setAttribute('aria-hidden', 'true');
    chain.innerHTML = '<i class="lamp-beads"></i><i class="lamp-knob"></i>';
    btn.append(chain);
  });
  function tugChain(btn) {
    const chain = btn.querySelector('.lamp-chain');
    if (!chain) return;
    chain.classList.remove('is-tugged');
    void chain.offsetWidth;
    chain.classList.add('is-tugged');
    clearTimeout(chain.tugTimer);
    chain.tugTimer = setTimeout(() => chain.classList.remove('is-tugged'), 900);
  }
  /** After the light goes out, a faint warm glow lingers at the lamp for a moment. */
  function afterglow(x, y) {
    const glow = document.createElement('div');
    glow.className = 'lamp-afterglow';
    glow.setAttribute('aria-hidden', 'true');
    glow.style.left = `${Math.round(x)}px`;
    glow.style.top = `${Math.round(y)}px`;
    document.body.append(glow);
    setTimeout(() => glow.remove(), 1300);
  }

  let running = null;
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const root = document.documentElement;
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      // Element transitions stay paused for the whole switch (until the reveal ends), so nothing on
      // the page changes underneath it. Decorative animations (the top bar's pastries) pause too.
      const settle = () => { root.classList.remove('theme-switching'); root.classList.remove('theme-busy'); };
      const swap = () => {
        root.classList.add('theme-switching');
        applyTheme(next);
      };
      root.classList.add('theme-busy');
      try { localStorage.setItem(KEY, next); } catch { }
      // Lamp pull: the chain is tugged; going dark, the pool of light shrinks back into the lamp (the
      // toggle) and leaves a faint warm afterglow; going light, the lamp flickers and the light spreads
      // out from it. (View Transitions; without support, or with reduced motion, the switch is instant.)
      tugChain(btn);
      const smooth = typeof document.startViewTransition === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!smooth) { swap(); requestAnimationFrame(() => requestAnimationFrame(settle)); }
      else {
        running?.skipTransition(); // a quick second click finishes the first switch at once
        const box = btn.getBoundingClientRect();
        const x = box.left + box.width / 2;
        const y = box.top + box.height / 2;
        // Big enough for the pool of light to cover the farthest corner, soft edge included.
        const reach = Math.ceil(Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) * 2 * 1.55);
        const at = size => `mask-size: ${size}px ${size}px; mask-position: ${Math.round(x - size / 2)}px ${Math.round(y - size / 2)}px; -webkit-mask-size: ${size}px ${size}px; -webkit-mask-position: ${Math.round(x - size / 2)}px ${Math.round(y - size / 2)}px;`;
        const pool = 'radial-gradient(circle closest-side, #000 62%, rgba(0, 0, 0, .55) 80%, transparent 100%)';
        const masked = `-webkit-mask-image: ${pool}; mask-image: ${pool}; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;`;
        // Written out in full (no CSS variables) so the first frame is already right: no flash.
        let lamp = document.getElementById('pla-theme-reveal');
        if (!lamp) { lamp = document.createElement('style'); lamp.id = 'pla-theme-reveal'; document.head.append(lamp); }
        lamp.textContent = next === 'dark'
          ? `@keyframes pla-lamp-off { 0%, 8% { ${at(reach)} } 100% { ${at(0)} } }
            ::view-transition-new(root) { animation: none; z-index: 1; }
            ::view-transition-old(root) { animation: pla-lamp-off 700ms cubic-bezier(.45, 0, .7, .45) both; z-index: 2; ${masked} }`
          : `@keyframes pla-lamp-on {
              0% { ${at(70)} opacity: 0; } 7% { ${at(150)} opacity: .9; } 12% { ${at(150)} opacity: .15; }
              19% { ${at(190)} opacity: 1; } 24% { ${at(190)} opacity: .45; } 30% { ${at(220)} opacity: 1; }
              100% { ${at(reach)} opacity: 1; } }
            ::view-transition-old(root) { animation: none; z-index: 1; }
            ::view-transition-new(root) { animation: pla-lamp-on 900ms cubic-bezier(.3, 0, .2, 1) both; z-index: 2; ${masked} }`;
        const transition = running = document.startViewTransition(swap);
        transition.ready.catch(() => { });
        transition.finished.catch(() => { }).finally(() => {
          if (running === transition) { running = null; settle(); }
          if (next === 'dark') afterglow(x, y);
        });
      }
      // Spin the new icon in (restarts if clicked again mid-animation).
      btn.classList.remove('is-switching');
      void btn.offsetWidth;
      btn.classList.add('is-switching');
      clearTimeout(btn.switchTimer);
      btn.switchTimer = setTimeout(() => btn.classList.remove('is-switching'), 480);
    });
  });
})();
