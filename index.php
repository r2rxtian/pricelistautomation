<?php
declare(strict_types=1);
require_once __DIR__ . '/lib.php';
$user = current_user();
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="theme-color" content="#0a090b">
    <title><?= htmlspecialchars(APP_NAME) ?></title>
    <link rel="stylesheet" href="assets/app.css?v=20260921-zoom125">
</head>
<body class="<?= $user ? 'is-booting' : 'is-ready' ?>" data-authenticated="<?= $user ? 'true' : 'false' ?>">
<noscript>This application requires JavaScript for Excel import and export.</noscript>

<main id="loginView" class="login-shell" <?= $user ? 'hidden' : '' ?>>
    <section class="login-panel" aria-labelledby="loginTitle">
        <div class="brand-mark" aria-hidden="true">LRN</div>
        <p class="kicker">Export pricing operations</p>
        <h1 id="loginTitle">Price lists, without the spreadsheet drift.</h1>
        <p class="muted">Import a workbook, adjust every selected price by one percentage, and publish a clean export.</p>
        <form id="loginForm" class="login-form">
            <label>Email<input id="email" name="email" type="email" value="admin@lrn.local" autocomplete="username" required></label>
            <label>Password<input id="password" name="password" type="password" value="Admin123!" autocomplete="current-password" required></label>
            <button class="button primary" type="submit">Sign in</button>
            <p id="loginError" class="form-error" role="alert"></p>
        </form>
    </section>
    <aside class="login-art" aria-label="System capabilities">
        <div class="art-grid"></div>
        <div class="capability"><span>01</span><strong>Import</strong><small>Excel workbooks</small></div>
        <div class="capability"><span>02</span><strong>Adjust</strong><small>Bulk percentage</small></div>
        <div class="capability"><span>03</span><strong>Export</strong><small>Excel or PDF</small></div>
    </aside>
</main>

<div id="appView" class="app-shell" <?= !$user ? 'hidden' : '' ?>>
    <div id="appLoading" class="app-loading" role="status"><span></span><strong>Loading price workspace</strong></div>
    <header class="topbar">
        <a class="brand" href="#" aria-label="LRN Price List home"><span>LRN</span><b>Price List Automation</b></a>
        <div class="user-menu"><span id="userName"></span><span id="roleBadge" class="badge"></span><button id="logoutButton" class="text-button">Sign out</button></div>
    </header>

    <div class="workspace">
        <aside class="sidebar">
            <nav aria-label="Primary">
                <button class="nav-item active" data-panel="workspacePanel"><span aria-hidden="true">▦</span><small>Prices</small></button>
                <button class="nav-item" data-panel="historyPanel"><span aria-hidden="true">◷</span><small>History</small></button>
            </nav>
            <div class="sidebar-note"><strong>Pricing rule</strong><p>Every preview starts from the imported base price.</p></div>
        </aside>

        <main class="content">
            <section id="workspacePanel" class="panel active">
                <div class="page-heading"><div><div class="title-line"><h1 id="listTitle">Start with a workbook</h1><span id="activeBadge" class="status-badge" hidden>Active</span></div><p id="listMeta" class="list-subtitle">Upload an .xlsx or .xls file to map its products and prices.</p><p id="savedMeta" class="saved-meta"></p></div><div class="heading-actions"><button id="editButton" class="button secondary edit-only" hidden>Edit prices</button><button id="uploadButton" class="button secondary edit-only">Upload Excel</button><button id="saveButton" class="button primary edit-only" hidden>Save version</button></div></div>
                <input id="fileInput" type="file" accept=".xlsx,.xls" hidden>

                <section id="emptyState" class="empty-state">
                    <div class="upload-icon">↗</div><h2>Import your current price list</h2><p>The workbook stays intact until you confirm its header row and price columns.</p><button id="emptyUploadButton" class="button primary edit-only">Choose Excel file</button>
                </section>

                <section id="dataView" hidden>
                    <div class="metric-row">
                        <article><i aria-hidden="true">◇</i><div><span>Products</span><strong id="productCount">0</strong></div></article>
                        <article><i aria-hidden="true">□</i><div><span>Categories</span><strong id="categoryCount">0</strong></div></article>
                        <article><i aria-hidden="true">⚙</i><div><span>Automatic price fields</span><strong id="priceColumnCount">0</strong></div></article>
                        <article><i aria-hidden="true">▥</i><div><span>Current adjustment</span><strong id="currentAdjustment">0%</strong></div></article>
                    </div>

                    <section id="adjustmentBar" class="adjustment-bar edit-only" aria-labelledby="adjustmentTitle" hidden>
                        <div class="edit-summary"><strong id="adjustmentTitle">Bulk price adjustment</strong><span>Positive increases, negative decreases.</span></div>
                        <div class="adjustment-control"><label for="percentage">Percentage</label><div class="percentage-input"><input id="percentage" type="number" min="-100" max="10000" step="0.01" value="0"><span>%</span></div><button id="previewButton" class="button primary">Preview change</button></div>
                    </section>

                    <div class="data-panel full-table">
                    <div class="table-tools">
                        <div class="filter-group">
                            <label class="search"><span>Search</span><input id="searchInput" type="search" placeholder="Product, code, or price"></label>
                            <label class="select-control"><span>Category</span><select id="categorySelect"><option value="">All categories</option></select></label>
                        </div>
                        <div class="actions"><button id="excelButton" class="button secondary">Export Excel</button><button id="pdfButton" class="button secondary">Export PDF</button></div>
                    </div>
                    <div class="table-frame"><table id="priceTable"><colgroup><col class="col-photo"><col class="col-code"><col class="col-description"><col class="col-expiry"><col class="col-weight"><col class="col-pieces"><col class="col-box"><col class="col-unit-price"><col class="col-box-price"><col class="col-pallet"><col class="col-pallet"><col class="col-pallet"></colgroup><thead></thead><tbody></tbody></table><div id="noResults" class="no-results" hidden>No matching items.</div></div>
                    </div>
                    <div class="pagination"><span id="rangeLabel"></span><div class="pagination-controls"><label class="rows-control">Rows per page<select id="pageSizeSelect"><option selected>6</option><option>10</option><option>20</option><option>40</option><option>80</option></select></label><button id="previousPage" class="icon-button" aria-label="Previous page">‹</button><div id="pageNumbers" class="page-numbers"></div><button id="nextPage" class="icon-button" aria-label="Next page">›</button></div></div>
                </section>
            </section>

            <section id="historyPanel" class="panel" hidden>
                <div class="page-heading"><div><p class="kicker">Audit trail</p><h1>Saved versions</h1><p class="muted">Review when a list was saved, by whom, and with which adjustment.</p></div></div>
                <div id="historyList" class="history-list"></div>
            </section>
        </main>
    </div>
</div>

<dialog id="importDialog">
    <form method="dialog" class="dialog-card" id="importForm">
        <div class="dialog-heading"><div><p class="kicker">Import review</p><h2>Confirm workbook mapping</h2></div><button value="cancel" class="icon-button" aria-label="Close">×</button></div>
        <p id="importFileName" class="muted"></p>
        <div class="auto-mapping"><strong>Automatic price mapping</strong><p>Only price per piece and price per box values will be adjusted automatically. Product details and totals remain unchanged.</p></div>
        <div class="dialog-actions"><button value="cancel" class="button secondary">Cancel</button><button id="confirmImport" value="default" class="button primary">Import price list</button></div>
    </form>
</dialog>

<dialog id="deleteDialog">
    <form method="dialog" class="dialog-card delete-dialog" id="deleteForm">
        <div class="dialog-heading"><div><p class="kicker">Permanent action</p><h2>Delete saved version?</h2></div><button value="cancel" class="icon-button" aria-label="Close">×</button></div>
        <p>This removes <strong id="deleteVersionName"></strong> from history. This action cannot be undone.</p>
        <div class="dialog-actions"><button value="cancel" class="button secondary">Cancel</button><button id="confirmDelete" value="default" class="button danger">Delete version</button></div>
    </form>
</dialog>

<div id="toast" class="toast" role="status" aria-live="polite"></div>
<script>window.__BOOT__ = <?= json_encode(['user' => $user, 'csrf' => $_SESSION['csrf']], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;</script>
<script src="assets/vendor/xlsx.full.min.js"></script>
<script src="assets/vendor/jspdf.umd.min.js"></script>
<script src="assets/vendor/jspdf.plugin.autotable.min.js"></script>
<script src="assets/app.js"></script>
</body>
</html>
