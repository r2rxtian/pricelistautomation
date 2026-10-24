// login.js — sign-in form (posts to auth/login_handler.php), show/hide password, and the spotlight
// on the right half that follows the mouse.
(() => {
  'use strict';
  // Entrance: once the fonts are ready (so the headline doesn't change font mid-motion; at most
  // 0.9 s), swap the page's waiting state for the entrance animation (styles/login.css).
  const root = document.documentElement;
  if (root.classList.contains('login-wait')) {
    const enter = () => {
      if (!root.classList.contains('login-wait')) return;
      root.classList.remove('login-wait');
      root.classList.add('login-enter');
    };
    Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(resolve => setTimeout(resolve, 900))])
      .then(() => requestAnimationFrame(enter));
  }

  const form = document.getElementById('loginForm');
  const button = document.getElementById('loginSubmitBtn');
  const message = document.getElementById('authMessage');
  const password = document.getElementById('login_password');
  const eye = document.getElementById('eyeToggleBtn');

  const loginId = document.getElementById('login_id');
  const meter = document.getElementById('attemptMeter');
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function showMessage(text, type) {
    message.textContent = text;
    message.className = `auth-message visible ${type}`;
  }

  // --- A wrong password crumbles away: the dots in the box break into crumbs that fall and fade,
  // the box gives a short spring shake and flashes rose. ---
  function crumble() {
    const field = password.closest('.password-field');
    const count = Math.min(16, Math.max(4, password.value.length));
    if (!reduced() && field) {
      const box = password.getBoundingClientRect();
      const style = getComputedStyle(password);
      const left = box.left + parseFloat(style.paddingLeft);
      const tones = ['#c8955c', '#b5793f', '#e3b98a', '#b52042'];
      for (let i = 0; i < count; i++) {
        const crumb = document.createElement('span');
        crumb.className = 'login-crumb';
        const size = 3 + Math.random() * 4;
        Object.assign(crumb.style, {
          left: `${left + i * 9 + Math.random() * 3}px`, top: `${box.top + box.height / 2 - size / 2}px`,
          width: `${size}px`, height: `${size * (0.7 + Math.random() * 0.5)}px`, background: tones[i % tones.length],
        });
        document.body.append(crumb);
        const drift = (Math.random() - 0.5) * 46, fall = 70 + Math.random() * 70, spin = (Math.random() - 0.5) * 540;
        crumb.animate([
          { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
          { transform: `translate(${drift * 0.4}px, -${8 + Math.random() * 10}px) rotate(${spin * 0.2}deg)`, opacity: 1, offset: 0.18 },
          { transform: `translate(${drift}px, ${fall}px) rotate(${spin}deg)`, opacity: 0 },
        ], { duration: 720 + Math.random() * 380, delay: i * 18, easing: 'cubic-bezier(.45, 0, .85, .55)', fill: 'forwards' })
          .finished.then(() => crumb.remove(), () => crumb.remove());
      }
      field.animate([
        { transform: 'translateX(0)' }, { transform: 'translateX(-10px)' }, { transform: 'translateX(8px)' },
        { transform: 'translateX(-5px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' },
      ], { duration: 460, easing: 'cubic-bezier(.36, .07, .19, .97)' });
      field.classList.remove('is-wrong');
      void field.offsetWidth;
      field.classList.add('is-wrong');
      setTimeout(() => field.classList.remove('is-wrong'), 1100);
    }
    password.value = '';
    password.focus();
  }

  // --- Attempts: one pip per wrong password, then a 15-minute lock. ---
  function showAttempts(left, max, lockMinutes) {
    if (!meter || !Number.isFinite(left) || !Number.isFinite(max)) return;
    const used = max - left;
    const pips = meter.querySelector('.attempt-pips');
    pips.innerHTML = Array.from({ length: max }, (_, i) => `<i class="${i < used ? 'is-used' : ''}${i === used - 1 ? ' is-new' : ''}"></i>`).join('');
    meter.hidden = false;
    meter.classList.toggle('is-last', left === 1);
    document.getElementById('attemptText').textContent = left === 1
      ? `Last attempt before a ${lockMinutes || 15}-minute lock`
      : `${left} attempts left before a ${lockMinutes || 15}-minute lock`;
  }

  // --- Locked: the fields close and the button counts down (a ring that empties). The lock is kept
  // in this browser, so reloading the page doesn't hide it; it applies to that biometrics number. ---
  const LOCK_KEY = 'pla_login_lock';
  let lockTimer = 0;
  const readLock = () => { try { const lock = JSON.parse(localStorage.getItem(LOCK_KEY) || 'null'); return lock && lock.until > Date.now() ? lock : null; } catch { return null; } };
  function lockUi(lock) {
    clearInterval(lockTimer);
    const total = Math.max(1, lock.total || 900);
    const ring = 2 * Math.PI * 9;
    form.classList.add('is-locked');
    password.disabled = true;
    button.disabled = true;
    button.innerHTML = `<svg class="lock-ring" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="9" class="lock-ring-track"/><circle cx="11" cy="11" r="9" class="lock-ring-fill" style="stroke-dasharray:${ring.toFixed(1)}"/></svg><span class="lock-text"></span>`;
    if (meter) meter.hidden = true;
    const tick = () => {
      const left = Math.max(0, Math.round((lock.until - Date.now()) / 1000));
      if (!left) return unlockUi(true);
      const time = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      button.querySelector('.lock-text').textContent = `Locked · ${time}`;
      button.querySelector('.lock-ring-fill').style.strokeDashoffset = (ring * (1 - left / total)).toFixed(2);
      showMessage(`Too many failed attempts for ${lock.id}. Try again in ${time}.`, 'locked');
    };
    tick();
    lockTimer = setInterval(tick, 1000);
  }
  function unlockUi(expired) {
    clearInterval(lockTimer);
    form.classList.remove('is-locked');
    password.disabled = false;
    button.disabled = false;
    button.textContent = 'Sign in';
    if (expired) {
      try { localStorage.removeItem(LOCK_KEY); } catch { }
      if (meter) meter.hidden = true;
      showMessage('You can try again now: 5 fresh attempts.', 'info');
      button.animate?.([{ transform: 'scale(.96)' }, { transform: 'scale(1.03)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' });
    } else {
      message.className = 'auth-message';
    }
  }
  function startLock(id, seconds) {
    const lock = { id, until: Date.now() + seconds * 1000, total: seconds };
    try { localStorage.setItem(LOCK_KEY, JSON.stringify(lock)); } catch { }
    // The padlock drops shut into the message, then the countdown runs.
    lockUi(lock);
    if (!reduced()) message.animate([{ transform: 'translateY(-6px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.22, 1, .36, 1)' });
  }
  // Another biometrics number isn't locked: typing one opens the form; the locked one closes it again.
  loginId?.addEventListener('input', () => {
    const lock = readLock();
    if (!lock) return;
    if (loginId.value.trim() === lock.id) lockUi(lock); else if (form.classList.contains('is-locked')) unlockUi(false);
  });
  const startingLock = readLock();
  if (startingLock && loginId) { loginId.value = startingLock.id; lockUi(startingLock); }

  eye?.addEventListener('click', () => {
    const reveal = password.type === 'password';
    password.type = reveal ? 'text' : 'password';
    eye.setAttribute('aria-pressed', String(reveal));
    eye.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
    eye.title = reveal ? 'Hide password' : 'Show password';
    eye.querySelector('.eye-open').hidden = reveal;
    eye.querySelector('.eye-closed').hidden = !reveal;
    password.focus();
  });

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    if (form.classList.contains('is-locked')) return;
    message.className = 'auth-message';
    button.disabled = true;
    button.textContent = 'Signing in…';
    try {
      const response = await fetch('../auth/login_handler.php', { method: 'POST', body: new FormData(form) });
      const data = await response.json();
      if (data.success) {
        showMessage(data.message, 'success');
        try { localStorage.removeItem(LOCK_KEY); } catch { }
        // A fresh sign-in starts on "All categories".
        try { sessionStorage.removeItem('pla_view_category'); } catch { }
        const target = data.data && data.data.redirect ? data.data.redirect : 'dashboard.php';
        let left = false;
        const go = () => { if (!left) { left = true; window.location.href = target; } };
        const shell = document.querySelector('.login-shell');
        if (reduced() || !shell?.animate) return go();
        // The welcome: the form fades away, a check draws itself in a rose circle, and "Welcome back,"
        // rises with the first name letter by letter. Then the page closes in a circle into the check,
        // and the app opens from that same point (the reverse of signing out, see scripts/theme.js).
        const first = String(data.data?.firstName || '').trim();
        const panel = document.querySelector('.login-panel');
        const welcome = document.createElement('div');
        welcome.className = 'login-welcome';
        welcome.setAttribute('aria-live', 'polite');
        welcome.innerHTML = `<span class="welcome-seal" aria-hidden="true"><svg viewBox="0 0 52 52" width="64" height="64"><circle cx="26" cy="26" r="24" class="welcome-seal-ring"/><path d="M15 27.5l7.2 7.2L37.5 19" class="welcome-seal-check"/></svg></span>
          <p class="welcome-kicker">Welcome back,</p>
          <h2 class="welcome-name">${[...(first || 'there')].map((char, i) => `<span style="--i:${i}">${char === ' ' ? '&nbsp;' : char.replace(/[<>&"]/g, '')}</span>`).join('')}</h2>
          <p class="welcome-sub">Opening your dashboard…</p>`;
        // In the form's place (the panel is its positioned parent).
        Object.assign(welcome.style, { top: `${form.offsetTop}px`, left: `${form.offsetLeft}px`, width: `${form.offsetWidth}px`, minHeight: `${form.offsetHeight}px` });
        form.classList.add('is-welcoming');
        message.className = 'auth-message';
        setTimeout(() => { panel.append(welcome); requestAnimationFrame(() => welcome.classList.add('is-in')); }, 180);
        setTimeout(() => {
          const seal = welcome.querySelector('.welcome-seal')?.getBoundingClientRect() || button.getBoundingClientRect();
          const x = seal.left + seal.width / 2, y = seal.top + seal.height / 2;
          const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
          window.plaHandOff?.(x, y);
          shell.animate(
            { clipPath: [`circle(${radius}px at ${x}px ${y}px)`, `circle(0px at ${x}px ${y}px)`] },
            { duration: 560, easing: 'cubic-bezier(.55, 0, .75, .1)', fill: 'forwards' }
          ).finished.then(go, go);
          setTimeout(go, 900); // in case frames stall
        }, 1500);
        return;
      }
      const info = data.data || {};
      if (info.locked) {
        crumble();
        startLock(loginId.value.trim(), Number(info.lockedSeconds) || 900);
        return;
      }
      showMessage(data.message || 'Sign-in failed. Please try again.', 'error');
      if (response.status === 401) {
        crumble();
        showAttempts(Number(info.attemptsLeft), Number(info.maxAttempts), Number(info.lockMinutes));
      }
    } catch {
      showMessage('Could not reach the server. Please try again.', 'error');
    }
    button.disabled = false;
    button.textContent = 'Sign in';
  });

  const art = document.getElementById('loginArt');
  art?.addEventListener('mousemove', event => {
    const rect = art.getBoundingClientRect();
    art.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    art.style.setProperty('--my', `${event.clientY - rect.top}px`);
  });
})();
