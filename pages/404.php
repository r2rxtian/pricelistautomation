<?php
declare(strict_types=1);
http_response_code(404);
$base = '/pricelistautomation/';
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Page not found · LRN Price List Automation</title>
    <link rel="stylesheet" href="<?= $base ?>styles/app.css?v=99">
    <script>try { if (localStorage.getItem('pla_theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark'); } catch (e) {}</script>
    <style>
        .not-found { min-height: 100dvh; display: grid; place-content: center; gap: 12px; text-align: center; padding: 24px; background: var(--surface-page, #fffafb); }
        .not-found strong { font-size: 3rem; color: var(--pink); }
        .not-found p { color: var(--text-muted); margin: 0 0 8px; }
    </style>
</head>
<body class="is-ready">
<main class="not-found">
    <strong>404</strong>
    <h1>Page not found</h1>
    <p>The page you were looking for doesn't exist.</p>
    <a class="button primary" href="<?= $base ?>pages/prices.php">Back to price lists</a>
</main>
</body>
</html>
