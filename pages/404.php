<?php
declare(strict_types=1);
/**
 * 404 · Page not found, as a receipt for an item that isn't on any price list: it prints out of a
 * slot, lists the missing page on dotted leader lines, totals nothing found and ends with a barcode.
 * (Also Apache's 404/403 page, see .htaccess.)
 */
require_once __DIR__ . '/../components/logo.php';
http_response_code(404);
$base = '/pricelistautomation/';
$h = fn(string $text) => htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
$path = (string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH);
$path = preg_replace('#^/pricelistautomation#', '', $path) ?: '/';
if (mb_strlen($path) > 34) $path = '…' . mb_substr($path, -33);
$printed = date('M j · g:i A');
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Page not found · PLA · Price List Automation</title>
    <link rel="icon" type="image/svg+xml" href="<?= $base ?>assets/images/pla-mark.svg">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@700;800&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="<?= $base ?>styles/app.css?v=253">
    <script>try { if (localStorage.getItem('pla_theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark'); } catch (e) {}</script>
    <style>
        .lost {
            min-height: 100dvh; display: grid; grid-template-columns: auto auto; align-items: center; justify-content: center; gap: 64px; padding: 32px 24px;
            background-color: var(--bg);
            background-image: radial-gradient(color-mix(in srgb, var(--pink) 12%, transparent) 1px, transparent 1.4px);
            background-size: 18px 18px;
        }
        .lost-text { display: grid; justify-items: start; gap: 12px; max-width: 420px; }
        .lost-text .pla-lockup { margin-bottom: 18px; }
        .lost-code { color: var(--pink); font: 800 0.8rem/1 var(--sans); letter-spacing: .3em; }
        .lost-text h1 { margin: 0; color: var(--text-heading); font: 700 2.3rem/1.12 'Playfair Display', var(--display, serif); }
        .lost-text p { margin: 0 0 8px; color: var(--text-muted); line-height: 1.6; }
        .lost-text .button { text-decoration: none; }

        /* The printer slot and the receipt coming out of it. */
        .printer { position: relative; display: grid; justify-items: center; }
        .printer-slot { position: relative; z-index: 2; width: 300px; height: 18px; border-radius: 10px; background: linear-gradient(to bottom, #3a2a30, #1f1619); box-shadow: 0 8px 18px -8px rgba(40, 10, 25, .6), inset 0 -3px 0 rgba(255, 255, 255, .08); }
        .printer-slot::after { content: ""; position: absolute; right: 20px; bottom: 5px; left: 20px; height: 3px; border-radius: 2px; background: #0d090b; }
        .receipt-clip { margin: -9px -30px 0; overflow: hidden; padding: 0 42px 40px; }
        .receipt {
            --paper: #fffdfa; --ink: #3a2a30; --soft: #9a8a90;
            position: relative; width: 260px; padding: 22px 20px 26px; background: var(--paper); color: var(--ink);
            font: 500 0.74rem/1.55 ui-monospace, 'SFMono-Regular', Consolas, monospace;
            filter: drop-shadow(0 12px 16px rgba(40, 20, 30, .16));
            animation: print-out 1.6s steps(14, end) .3s both;
        }
        .receipt::after { content: ""; position: absolute; top: 100%; right: 0; left: 0; height: 8px; background: linear-gradient(135deg, var(--paper) 50%, transparent 50%) 0 0 / 12px 8px repeat-x, linear-gradient(225deg, var(--paper) 50%, transparent 50%) 0 0 / 12px 8px repeat-x; }
        @keyframes print-out { from { transform: translateY(-100%); } to { transform: none; } }
        .receipt-head { margin-bottom: 12px; text-align: center; }
        .receipt-head b { display: block; font: 800 0.86rem/1.2 'Montserrat', var(--sans); letter-spacing: .14em; }
        .receipt-head span { color: var(--soft); font-size: 0.66rem; }
        .rule { margin: 10px 0; border: 0; border-top: 1.5px dashed color-mix(in srgb, var(--soft) 55%, transparent); }
        .line { display: flex; align-items: baseline; }
        .line dt { display: flex; flex: 1 1 auto; align-items: baseline; color: var(--soft); }
        .line dt::after { content: ""; flex: 1; min-width: 10px; margin: 0 6px; border-bottom: 1.5px dotted color-mix(in srgb, var(--soft) 55%, transparent); transform: translateY(-3px); }
        .line dd { max-width: 60%; margin: 0; overflow: hidden; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
        .lines { display: grid; gap: 3px; margin: 0; }
        .total { display: flex; justify-content: space-between; font-weight: 800; font-size: 0.86rem; letter-spacing: .06em; }
        .total b { color: var(--pink); }
        .barcode { height: 38px; margin: 14px 10px 4px; background: repeating-linear-gradient(90deg, var(--ink) 0 2px, transparent 2px 4px, var(--ink) 4px 5px, transparent 5px 8px, var(--ink) 8px 11px, transparent 11px 12px, var(--ink) 12px 13px, transparent 13px 16px); }
        .barcode-no { color: var(--soft); font-size: 0.68rem; letter-spacing: .5em; text-align: center; }
        .thanks { margin-top: 12px; color: var(--soft); font-size: 0.66rem; text-align: center; }
        [data-theme="dark"] .receipt { --paper: #1f1d21; --ink: #ece6e9; --soft: #8e8288; filter: drop-shadow(0 12px 18px rgba(0, 0, 0, .7)); }
        [data-theme="dark"] .printer-slot { background: linear-gradient(to bottom, #2c2a2e, #121114); }
        @media (max-width: 760px) { .lost { grid-template-columns: 1fr; gap: 28px; justify-items: center; } .lost-text { justify-items: center; text-align: center; } }
        @media (prefers-reduced-motion: reduce) { .receipt { animation: none; } }
    </style>
</head>
<body class="is-ready">
<main class="lost">
    <div class="lost-text">
        <?= pla_logo_lockup() ?>
        <span class="lost-code">404 · Not found</span>
        <h1>This page isn’t on any price list</h1>
        <p>We checked every country, every price level and every category. The link may be mistyped, or the page has moved.</p>
        <a class="button primary" href="<?= $base ?>pages/files.php">Back to Files</a>
    </div>
    <div class="printer" aria-hidden="true">
        <div class="printer-slot"></div>
        <div class="receipt-clip">
            <div class="receipt">
                <div class="receipt-head"><b>PLA</b><span>Price List Automation · <?= $h($printed) ?></span></div>
                <hr class="rule">
                <dl class="lines">
                    <div class="line"><dt>Item</dt><dd><?= $h($path) ?></dd></div>
                    <div class="line"><dt>Code</dt><dd>404</dd></div>
                    <div class="line"><dt>Category</dt><dd>Not on any list</dd></div>
                    <div class="line"><dt>Qty</dt><dd>0</dd></div>
                    <div class="line"><dt>Price</dt><dd>N/A</dd></div>
                </dl>
                <hr class="rule">
                <div class="total"><span>TOTAL FOUND</span><b>0</b></div>
                <div class="barcode"></div>
                <div class="barcode-no">404 000 404</div>
                <div class="thanks">Thank you, come again (to the right page)</div>
            </div>
        </div>
    </div>
</main>
</body>
</html>
