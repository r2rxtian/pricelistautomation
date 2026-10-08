<?php
declare(strict_types=1);
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../auth/csrf.php';
require_once __DIR__ . '/../components/logo.php';

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

try {
    if (isLoggedIn()) {
        header('Location: prices.php');
        exit;
    }
} catch (Throwable $error) {
    // Database unreachable: still show the form; the sign-in itself reports the problem.
    error_log('Login page: ' . $error->getMessage());
}
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="theme-color" content="#fffafb">
    <title>Sign in · <?= htmlspecialchars(APP_NAME) ?></title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Montserrat:wght@700;800&family=Playfair+Display:ital,wght@0,600;0,700;1,600;1,700&display=swap" rel="stylesheet">
    <link rel="icon" type="image/svg+xml" href="../assets/images/pla-mark.svg">
    <link rel="stylesheet" href="../styles/app.css?v=100">
    <link rel="stylesheet" href="../styles/login.css?v=2">
    <script>
    (function () {
        try {
            var theme = localStorage.getItem('pla_theme');
            if (!theme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) theme = 'dark';
            if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
        } catch (e) {}
    })();
    </script>
    <script>
    // Opened by signing in or out: start hidden; scripts/theme.js grows the page from the button's spot.
    (function () {
        try {
            var hand = JSON.parse(sessionStorage.getItem('pla_reveal') || 'null');
            sessionStorage.removeItem('pla_reveal');
            var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (!hand || reduced || Date.now() - hand.at > 15000) return;
            var root = document.documentElement;
            root.classList.add('reveal-pending');
            root.style.setProperty('--reveal-x', hand.x + 'px');
            root.style.setProperty('--reveal-y', hand.y + 'px');
            setTimeout(function () { root.classList.remove('reveal-pending'); }, 3000);
        } catch (e) {}
    })();
    </script>
</head>
<body class="is-ready">
<main class="login-shell" data-reveal-root>
    <button class="theme-toggle-btn login-theme-toggle" type="button" aria-label="Toggle dark mode" title="Toggle dark mode">
        <svg class="theme-icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" hidden><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
        <svg class="theme-icon-moon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
    </button>
    <section class="login-panel" aria-labelledby="loginTitle">
        <div class="login-logo" role="img" aria-label="PLA Price List Automation"><?= pla_logo_lockup() ?></div>
        <p class="kicker">Export pricing operations</p>
        <h1 id="loginTitle">Price lists, without the spreadsheet drift.</h1>
        <p class="muted">Upload a price list, adjust prices by category, get it approved, then export it to Excel or PDF.</p>
        <form id="loginForm" class="login-form" novalidate>
            <?= csrfField() ?>
            <label for="login_id">Biometrics number<input id="login_id" name="login_id" type="text" inputmode="numeric" placeholder="e.g. 1652" autocomplete="username" required></label>
            <div class="login-field">
                <label for="login_password">Password</label>
                <span class="password-field">
                    <input id="login_password" name="login_password" type="password" autocomplete="current-password" placeholder="Your company password" required>
                    <button type="button" class="eye-toggle-btn" id="eyeToggleBtn" aria-label="Show password" aria-pressed="false" title="Show password">
                        <svg class="eye-open" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        <svg class="eye-closed" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" hidden><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    </button>
                </span>
            </div>
            <div class="auth-message" id="authMessage" role="alert"></div>
            <button class="button primary" id="loginSubmitBtn" type="submit">Sign in</button>
        </form>
    </section>
    <aside class="login-art" id="loginArt" aria-label="System capabilities">
        <div class="art-grid"></div>
        <div class="capability"><span>01</span><strong>Upload</strong><small>Excel price list</small></div>
        <div class="capability"><span>02</span><strong>Adjust</strong><small>By category or all</small></div>
        <div class="capability"><span>03</span><strong>Approve</strong><small>Assigned approvers</small></div>
        <div class="capability"><span>04</span><strong>Export</strong><small>Excel or PDF</small></div>
    </aside>
</main>
<script src="../scripts/theme.js?v=6"></script>
<script src="../scripts/login.js?v=3"></script>
</body>
</html>
