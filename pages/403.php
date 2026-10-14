<?php
declare(strict_types=1);
/**
 * 403 · No access. Shown (with a real 403 status) when a signed-in user opens a page their role
 * doesn't include, e.g. an export-only user typing config.php. Your own access keycard (the same
 * card as on the Users page) is tapped on a reader that blinks red and says DENIED.
 * components/app_shell.php sets $deniedPage (the page's title) and $user before including this file.
 */
require_once __DIR__ . '/../components/logo.php';
http_response_code(403);
header('Cache-Control: no-store');
$base = '/pricelistautomation/';
$h = fn(string $text) => htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
$deniedPage = isset($deniedPage) && is_string($deniedPage) ? $deniedPage : 'this page';
$isAdmin = ($user['roleName'] ?? '') === 'Admin';
$roleLabel = $isAdmin ? 'Admin access' : 'Export only';
$fullName = trim((string) ($user['name'] ?? ''));
$firstName = $fullName !== '' ? explode(' ', $fullName)[0] : '';
$initials = implode('', array_map(fn($part) => mb_strtoupper(mb_substr($part, 0, 1)), array_slice(preg_split('/\s+/', $fullName) ?: [], 0, 2)));
$employee = trim((string) ($user['employeeId'] ?? ''));
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
    <link rel="stylesheet" href="<?= $base ?>styles/app.css?v=209">
    <script>try { if (localStorage.getItem('pla_theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark'); } catch (e) {}</script>
    <style>
        .denied {
            min-height: 100dvh; display: grid; grid-template-columns: auto auto; align-items: center; justify-content: center; gap: 72px; padding: 32px 24px;
            background-color: var(--bg);
            background-image: radial-gradient(color-mix(in srgb, var(--pink) 12%, transparent) 1px, transparent 1.4px);
            background-size: 18px 18px;
        }
        .denied-text { display: grid; justify-items: start; gap: 12px; max-width: 430px; }
        .denied-text .pla-lockup { margin-bottom: 18px; }
        .denied-code { color: var(--pink); font: 800 0.8rem/1 var(--sans); letter-spacing: .3em; }
        .denied-text h1 { margin: 0; color: var(--text-heading); font: 700 2.3rem/1.12 'Playfair Display', var(--display, serif); }
        .denied-text p { margin: 0 0 8px; color: var(--text-muted); line-height: 1.6; }
        .denied-text .button { text-decoration: none; }

        /* The scene: a wall reader, and your keycard tapping it. */
        .scene { position: relative; width: 350px; height: 250px; }
        .reader { position: absolute; top: 22px; right: 18px; display: grid; justify-items: center; gap: 12px; width: 92px; padding: 16px 0 18px; border: 1px solid var(--line-panel); border-radius: 16px; background: var(--surface-card); box-shadow: 0 18px 30px -22px rgba(60, 20, 40, .6); }
        .reader-led { width: 12px; height: 12px; border-radius: 50%; background: color-mix(in srgb, var(--text-subtle) 40%, transparent); animation: led-denied 3.2s ease-in-out .9s infinite; }
        .reader-wave { color: var(--text-subtle); opacity: .6; }
        .reader-screen { width: 64px; padding: 4px 0; border-radius: 6px; background: color-mix(in srgb, var(--text-subtle) 10%, transparent); color: transparent; font: 800 0.6rem/1.2 ui-monospace, Consolas, monospace; letter-spacing: .14em; text-align: center; animation: screen-denied 3.2s ease-in-out .9s infinite; }
        @keyframes led-denied { 0%, 18%, 62%, 100% { background: color-mix(in srgb, var(--text-subtle) 40%, transparent); box-shadow: none; } 24%, 34%, 44% { background: #ef4444; box-shadow: 0 0 0 4px rgba(239, 68, 68, .2), 0 0 12px #ef4444; } 29%, 39% { background: #7f1d1d; box-shadow: none; } }
        @keyframes screen-denied { 0%, 18%, 62%, 100% { color: transparent; background: color-mix(in srgb, var(--text-subtle) 10%, transparent); } 22%, 58% { color: #ef4444; background: rgba(239, 68, 68, .1); } }
        .keycard {
            --lane: #b52042;
            position: absolute; left: -10px; top: 70px; width: 256px; padding: 12px 14px 0; overflow: hidden;
            border: 1px solid color-mix(in srgb, var(--lane) 22%, var(--line-soft)); border-radius: 14px;
            background: color-mix(in srgb, var(--lane) 5%, var(--surface-card));
            box-shadow: 0 2px 4px rgba(40, 20, 30, .06), 0 16px 26px -18px rgba(40, 20, 30, .55);
            transform-origin: 80% 50%;
            animation: tap 3.2s cubic-bezier(.4, 0, .2, 1) .9s infinite;
        }
        .keycard.is-export { --lane: #475569; }
        @keyframes tap {
            0%, 100% { transform: translate(0, 0) rotate(-4deg); }
            16% { transform: translate(64px, -38px) rotate(2deg); }
            22% { transform: translate(64px, -38px) rotate(2deg); }
            26% { transform: translate(58px, -38px) rotate(2deg); }
            30% { transform: translate(68px, -38px) rotate(2deg); }
            34% { transform: translate(62px, -38px) rotate(2deg); }
            58% { transform: translate(0, 0) rotate(-4deg); }
        }
        .kc-top { display: flex; justify-content: space-between; color: var(--lane); font: 800 0.56rem/1 var(--sans); letter-spacing: .16em; text-transform: uppercase; }
        .kc-main { display: flex; align-items: center; gap: 10px; margin: 12px 0 10px; }
        .kc-chip { flex: none; width: 26px; height: 20px; border-radius: 5px; background: color-mix(in srgb, var(--lane) 14%, transparent); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--lane) 45%, transparent); }
        .kc-avatar { display: grid; flex: none; place-items: center; width: 32px; height: 32px; border-radius: 50%; background: color-mix(in srgb, var(--lane) 12%, var(--surface-card)); color: var(--lane); font: 700 0.66rem var(--sans); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--lane) 22%, transparent); }
        .kc-name { min-width: 0; overflow: hidden; color: var(--text-heading); font: 700 0.84rem/1.2 var(--sans); text-overflow: ellipsis; white-space: nowrap; }
        .kc-stripe { margin: 0 -14px; padding: 6px 14px 8px; border-top: 1px dashed color-mix(in srgb, var(--lane) 25%, var(--line-soft)); box-shadow: inset 0 -3px 0 color-mix(in srgb, var(--lane) 55%, transparent); color: var(--text-muted); font: 600 0.62rem/1.2 ui-monospace, Consolas, monospace; letter-spacing: .08em; }
        .role { display: inline-flex; padding: 3px 10px; border: 1px solid color-mix(in srgb, var(--pink) 35%, var(--line-panel)); border-radius: 999px; color: var(--pink); font-size: 0.72rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
        [data-theme="dark"] .keycard { background: color-mix(in srgb, var(--lane) 8%, #18191e); border-color: color-mix(in srgb, var(--lane) 28%, #2a2d34); }
        [data-theme="dark"] .keycard:not(.is-export) { --lane: #fabbcb; }
        [data-theme="dark"] .keycard.is-export { --lane: #94a3b8; }
        @media (max-width: 780px) { .denied { grid-template-columns: 1fr; gap: 24px; justify-items: center; } .denied-text { justify-items: center; text-align: center; } .scene { order: -1; transform: scale(.85); } }
        @media (prefers-reduced-motion: reduce) { .keycard, .reader-led, .reader-screen { animation: none; } .reader-led { background: #ef4444; } .reader-screen { color: #ef4444; } }
    </style>
</head>
<body class="is-ready">
<main class="denied">
    <div class="denied-text">
        <?= pla_logo_lockup() ?>
        <span class="denied-code">403 · No access</span>
        <h1>Your card doesn’t open <?= $h($deniedPage) ?></h1>
        <p><?= $firstName !== '' ? $h($firstName) . ', ' : '' ?><?= $h($deniedPage) ?> is only for admins. If you need it, ask an admin to move your card to the Admins rack on the Users page.</p>
        <span class="role">Your access: <?= $h($isAdmin ? 'Admin' : 'Export only') ?></span>
        <a class="button primary" href="<?= $base ?>pages/files.php">Back to Files</a>
    </div>
    <div class="scene" aria-hidden="true">
        <div class="reader">
            <span class="reader-led"></span>
            <svg class="reader-wave" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8.5 7.5a6 6 0 0 1 0 9"/><path d="M12 5a9.5 9.5 0 0 1 0 14"/><path d="M15.5 2.5a13 13 0 0 1 0 19"/></svg>
            <span class="reader-screen">DENIED</span>
        </div>
        <div class="keycard <?= $isAdmin ? '' : 'is-export' ?>">
            <div class="kc-top"><span>LRN · <?= $h($roleLabel) ?></span><span>)))</span></div>
            <div class="kc-main"><span class="kc-chip"></span><span class="kc-avatar"><?= $h($initials ?: '?') ?></span><span class="kc-name"><?= $h($fullName ?: 'Your card') ?></span></div>
            <div class="kc-stripe"><?= $employee !== '' ? 'EMP ' . $h($employee) : 'LRN ACCESS' ?></div>
        </div>
    </div>
</main>
</body>
</html>
