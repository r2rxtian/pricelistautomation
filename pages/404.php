<?php
declare(strict_types=1);
require_once __DIR__ . '/../components/logo.php';
http_response_code(404);
$base = '/pricelistautomation/';
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
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="<?= $base ?>styles/app.css?v=109">
    <script>try { if (localStorage.getItem('pla_theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark'); } catch (e) {}</script>
    <style>
        .not-found { min-height: 100dvh; display: grid; place-content: center; justify-items: center; gap: 12px; text-align: center; padding: 24px; background: var(--surface-page, #fffafb); }
        .not-found .pla-lockup { margin-bottom: 18px; }
        .not-found strong { font-size: 3rem; color: var(--pink); }
        .not-found p { color: var(--text-muted); margin: 0 0 8px; }
    </style>
</head>
<body class="is-ready">
<main class="not-found">
    <?= pla_logo_lockup() ?>
    <strong>404</strong>
    <h1>Page not found</h1>
    <p>The page you were looking for doesn't exist.</p>
    <a class="button primary" href="<?= $base ?>pages/prices.php">Back to price lists</a>
</main>
</body>
</html>
