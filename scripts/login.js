// login.js — sign-in form (posts to auth/login_handler.php), show/hide password, and the spotlight
// on the right half that follows the mouse.
(() => {
  'use strict';
  const form = document.getElementById('loginForm');
  const button = document.getElementById('loginSubmitBtn');
  const message = document.getElementById('authMessage');
  const password = document.getElementById('login_password');
  const eye = document.getElementById('eyeToggleBtn');

  function showMessage(text, type) {
    message.textContent = text;
    message.className = `auth-message visible ${type}`;
  }

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
    message.className = 'auth-message';
    button.disabled = true;
    button.textContent = 'Signing in…';
    try {
      const response = await fetch('../auth/login_handler.php', { method: 'POST', body: new FormData(form) });
      const data = await response.json();
      if (data.success) {
        showMessage(data.message, 'success');
        // A fresh sign-in starts on "All categories".
        try { sessionStorage.removeItem('pla_view_category'); } catch { }
        window.location.href = data.data && data.data.redirect ? data.data.redirect : 'dashboard.php';
        return;
      }
      showMessage(data.message || 'Sign-in failed. Please try again.', 'error');
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
