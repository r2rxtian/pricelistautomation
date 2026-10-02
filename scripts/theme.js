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

  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));

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
      // Cross-fade the whole page from the old theme to the new one (View Transitions; see the
      // ::view-transition rules in styles/app.css). Without support, or with reduced motion, it's instant.
      const smooth = typeof document.startViewTransition === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (smooth) document.startViewTransition(swap); else swap();
      // Spin the new icon in (restarts if clicked again mid-animation).
      btn.classList.remove('is-switching');
      void btn.offsetWidth;
      btn.classList.add('is-switching');
      clearTimeout(btn.switchTimer);
      btn.switchTimer = setTimeout(() => btn.classList.remove('is-switching'), 480);
    });
  });
})();
