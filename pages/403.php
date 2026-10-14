<?php
declare(strict_types=1);
/**
 * 403 · No access. Shown (with a real 403 status) when a signed-in user opens a page their role
 * doesn't include, e.g. an export-only user typing config.php. components/app_shell.php sets
 * $deniedPage (the page's title) and $user before including this file.
 */
require_once __DIR__ . '/../components/logo.php';
http_response_code(403);
header('Cache-Control: no-store');
$base = '/pricelistautomation/';
$deniedPage = isset($deniedPage) && is_string($deniedPage) ? $deniedPage : 'this page';
$roleLabel = isset($user['roleName']) ? ($user['roleName'] === 'Admin' ? 'Admin' : 'Export only') : '';
$firstName = isset($user['name']) ? explode(' ', trim((string) $user['name']))[0] : '';
$h = fn(string $text) => htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>No access · PLA · Price List Automation</title>
    <link rel="icon" type="image/svg+xml" href="<?= $base ?>assets/images/pla-mark.svg">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@700;800&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="<?= $base ?>styles/app.css?v=207">
    <script>try { if (localStorage.getItem('pla_theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark'); } catch (e) {}</script>
    <style>
        .no-access {
            min-height: 100dvh; display: grid; place-content: center; justify-items: center; gap: 10px; padding: 24px; text-align: center;
            background-color: var(--bg);
            background-image: radial-gradient(color-mix(in srgb, var(--pink) 12%, transparent) 1px, transparent 1.4px);
            background-size: 18px 18px;
        }
        .no-access .pla-lockup { margin-bottom: 22px; }
        /* A door with a card reader whose light blinks red once, like a card that didn't open it. */
        .door { position: relative; width: 104px; height: 128px; margin-bottom: 8px; border: 2px solid color-mix(in srgb, var(--pink) 35%, var(--line-panel)); border-bottom: 0; border-radius: 10px 10px 0 0; background: var(--surface-card); box-shadow: 0 18px 30px -22px rgba(60, 20, 40, .6); }
        .door::before { content: ""; position: absolute; right: -26px; bottom: 0; left: -26px; height: 2px; border-radius: 2px; background: color-mix(in srgb, var(--pink) 30%, var(--line-panel)); }
        .door-knob { position: absolute; top: 64px; right: 14px; width: 9px; height: 9px; border-radius: 50%; background: color-mix(in srgb, var(--pink) 45%, var(--line-panel)); }
        .door-reader { position: absolute; top: 46px; right: -40px; display: grid; justify-items: center; gap: 5px; width: 22px; padding: 6px 0; border: 1.5px solid var(--line-panel); border-radius: 6px; background: var(--surface-card); }
        .door-reader i { width: 7px; height: 7px; border-radius: 50%; background: #ef4444; box-shadow: 0 0 0 3px rgba(239, 68, 68, .18); animation: denied 2.4s ease-in-out .5s 2; }
        .door-reader b { width: 10px; height: 2px; border-radius: 1px; background: var(--line-panel); }
        .door-lock { position: absolute; top: 50%; left: 50%; display: grid; place-items: center; width: 42px; height: 42px; margin: -30px 0 0 -21px; border-radius: 50%; background: var(--pink-subtle); color: var(--pink); }
        @keyframes denied { 0%, 100% { opacity: 1; } 10%, 30% { opacity: .2; } 20%, 40% { opacity: 1; box-shadow: 0 0 0 5px rgba(239, 68, 68, .25), 0 0 12px #ef4444; } }
        .no-access .code { color: var(--pink); font: 800 0.8rem/1 var(--sans); letter-spacing: .3em; }
        .no-access h1 { margin: 0; color: var(--text-heading); font: 700 2rem/1.15 'Playfair Display', var(--display, serif); }
        .no-access p { max-width: 44ch; margin: 0 0 10px; color: var(--text-muted); line-height: 1.55; }
        .no-access .role { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border: 1px solid color-mix(in srgb, var(--pink) 35%, var(--line-panel)); border-radius: 999px; color: var(--pink); font-size: 0.72rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
        .no-access .actions a { text-decoration: none; }
        .no-access .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 6px; }
        @media (prefers-reduced-motion: reduce) { .door-reader i { animation: none; } }
    </style>
</head>
<body class="is-ready">
<main class="no-access">
    <?= pla_logo_lockup() ?>
    <div class="door" aria-hidden="true">
        <span class="door-lock"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></span>
        <span class="door-knob"></span>
        <span class="door-reader"><i></i><b></b><b></b></span>
    </div>
    <span class="code">403 · No access</span>
    <h1>Your card doesn’t open this door</h1>
    <p><?= $firstName !== '' ? $h($firstName) . ', ' : '' ?><?= $h($deniedPage) ?> is only for admins. If you need it, ask an admin to change your access on the Users page.</p>
    <?php if ($roleLabel !== ''): ?><span class="role">Your access: <?= $h($roleLabel) ?></span><?php endif; ?>
    <div class="actions">
        <a class="button primary" href="<?= $base ?>pages/files.php">Back to Files</a>
    </div>
</main>
</body>
</html>
