/**
 * Config › Display › Reduce motion: the app without its animations, for whoever prefers it.
 *
 * Loaded first in <head> (components/app_shell.php, pages/login.php) so nothing moves before it runs.
 * The app already follows the computer's own "reduce motion" setting everywhere (CSS and scripts ask
 * matchMedia('(prefers-reduced-motion: reduce)')). Switched on here, it acts as if that setting were on:
 *   - html.reduce-motion: CSS cuts every animation and transition short (styles/app.css, login.css);
 *   - matchMedia answers "reduce" to that question, so every existing check skips its animation;
 *   - element.animate() animations (the welcome, the bin, page swaps…) finish at once.
 * Saved per browser (localStorage 'pla_reduce_motion'), like the light/dark theme.
 */
(function () {
  var KEY = 'pla_reduce_motion';
  var root = document.documentElement;
  var realMatchMedia = window.matchMedia ? window.matchMedia.bind(window) : null;
  var realAnimate = window.Element && Element.prototype.animate;

  function reducedMatchMedia(query) {
    return /prefers-reduced-motion\s*:\s*reduce/.test(String(query)) ? realMatchMedia('all') : realMatchMedia(query);
  }
  function instantAnimate(keyframes, options) {
    var timing = { duration: 0, delay: 0, endDelay: 0, iterations: 1 };
    if (options && typeof options === 'object') {
      if (options.fill) timing.fill = options.fill;
      if (options.pseudoElement) timing.pseudoElement = options.pseudoElement;
      if (options.id) timing.id = options.id;
    }
    return realAnimate.call(this, keyframes, timing);
  }

  function apply(on) {
    root.classList.toggle('reduce-motion', on);
    if (realMatchMedia) window.matchMedia = on ? reducedMatchMedia : realMatchMedia;
    if (realAnimate) Element.prototype.animate = on ? instantAnimate : realAnimate;
  }

  /** Is it on? (Config shows the switch from this.) */
  window.plaReducedMotion = function () { return root.classList.contains('reduce-motion'); };
  /** Switches it on or off and remembers it in this browser. */
  window.plaSetReducedMotion = function (on) {
    try { if (on) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch (e) { }
    apply(!!on);
    // For what keeps running by itself (the pastry bits in the top bar, scripts/motion.js).
    window.dispatchEvent(new Event('pla:reduce-motion'));
  };

  var saved = false;
  try { saved = localStorage.getItem(KEY) === '1'; } catch (e) { }
  apply(saved);
})();
