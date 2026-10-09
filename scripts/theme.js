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

  let running = null;
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const root = document.documentElement;
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      const swap = () => {
        // Pause every element transition for the switch so the page changes in one step underneath.
        root.classList.add('theme-switching');
        applyTheme(next);
        requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
      };
      try { localStorage.setItem(KEY, next); } catch { }
      // The new theme spreads out in a circle from this button over the old one (View Transitions;
      // see the ::view-transition rules in styles/app.css). Without support, or with reduced motion, it's instant.
      const smooth = typeof document.startViewTransition === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!smooth) swap();
      else {
        running?.skipTransition(); // a quick second click finishes the first switch at once
        const box = btn.getBoundingClientRect();
        const x = box.left + box.width / 2;
        const y = box.top + box.height / 2;
        const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
        const transition = running = document.startViewTransition(swap);
        transition.ready.then(() => {
          root.animate(
            { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
            { duration: 650, easing: 'cubic-bezier(.65, 0, .25, 1)', pseudoElement: '::view-transition-new(root)' }
          );
        }).catch(() => { });
        transition.finished.finally(() => { if (running === transition) running = null; });
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
