<?php
declare(strict_types=1);
require_once __DIR__ . '/lib.php';
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
$user = current_user();
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="theme-color" content="#0a090b">
    <title><?= htmlspecialchars(APP_NAME) ?></title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600;1,700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/app.css?v=20260922-ui-v10">
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
    <div id="appLoading" class="app-loading" role="status"><div class="loader-orbit"><span class="orbit-ring ring-1"></span><span class="orbit-ring ring-2"></span><span class="orbit-core"></span></div><strong>Loading price workspace</strong></div>
    <header class="topbar">
        <a class="brand" href="#" aria-label="LRN Price List home"><span>LRN</span><b>Price List Automation</b></a>
        <nav class="top-nav" aria-label="Primary">
            <button class="nav-item active" data-panel="workspacePanel"><span aria-hidden="true">▦</span><strong>Prices</strong></button>
            <button class="nav-item" data-panel="historyPanel"><span aria-hidden="true">◷</span><strong>History</strong></button>
        </nav>
        <div class="user-menu"><span id="userName"></span><span id="roleBadge" class="badge"></span><button id="logoutButton" class="text-button">Sign out</button></div>
    </header>

    <div class="workspace">
        <main class="content">
            <section id="workspacePanel" class="panel active">
                <div class="page-heading">
                    <div class="heading-left">
                        <p class="kicker">CURRENT FILE</p>
                        <div class="title-line"><h1 id="listTitle">Start with a workbook</h1><span id="activeBadge" class="status-badge" hidden><span class="pulse-dot" aria-hidden="true"><span class="pulse-ring"></span></span>Active</span></div>
                        <div class="meta-line"><span id="listMeta" class="list-subtitle">Upload an .xlsx or .xls file to map its products and prices.</span><span id="savedMeta" class="saved-meta"></span></div>
                    </div>
                    <div id="metricGroup" class="metric-group" hidden>
                        <div class="metric-item"><strong id="productCount">0</strong><span>Products</span></div>
                        <div class="metric-item"><strong id="categoryCount">0</strong><span>Categories</span></div>
                        <div class="metric-item"><strong id="priceColumnCount">0</strong><span>Auto price fields</span></div>
                        <div class="metric-item"><strong id="currentAdjustment">0%</strong><span>Adjustment</span></div>
                    </div>
                    <div class="heading-actions">
                        <div class="price-editor-wrap">
                            <button id="editButton" class="button secondary edit-only" aria-expanded="false" aria-controls="adjustmentBar" hidden>Edit prices</button>
                            <section id="adjustmentBar" class="adjustment-bar price-popover edit-only" role="dialog" aria-modal="false" aria-labelledby="adjustmentTitle" hidden>
                                <div class="edit-summary"><strong id="adjustmentTitle">Adjust all prices</strong><span>Use a positive or negative percentage.</span></div>
                                <div class="adjustment-control">
                                    <label for="percentage">Percentage</label>
                                    <div class="percentage-input"><input id="percentage" type="number" min="-100" max="10000" step="0.01" value="0"><span>%</span></div>
                                    <button id="previewButton" class="button primary">Preview</button>
                                </div>
                            </section>
                        </div>
                        <button id="discardDraftButton" class="button danger edit-only" hidden>Discard draft</button>
                        <button id="uploadButton" class="button secondary edit-only">Upload Excel</button>
                        <button id="saveButton" class="button primary edit-only" hidden>Save version</button>
                    </div>
                </div>
                <input id="fileInput" type="file" accept=".xlsx,.xls" hidden>

                <section id="emptyState" class="empty-state">
                    <div class="upload-icon-wrapper"><div class="upload-icon-glow"></div><div class="upload-icon">↗</div></div><h2>Import your current price list</h2><p>Drag and drop your Excel spreadsheet (.xlsx, .xls) here or browse your computer.</p><button id="emptyUploadButton" class="button primary edit-only">Choose Excel file</button>
                </section>

                <section id="dataView" hidden>
                    <div class="data-panel full-table">
                    <div class="table-tools">
                        <div class="filter-group">
                            <label class="search"><span>Search</span><svg class="search-icon" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><input id="searchInput" type="search" placeholder="Search products, codes, prices..."><kbd class="search-kbd">/</kbd></label>
                            <label class="select-control"><span>Category</span><select id="categorySelect"></select></label>
                        </div>
                        <div class="actions"><button id="excelButton" class="button secondary">Export Excel</button><button id="pdfButton" class="button secondary">Export PDF</button></div>
                    </div>
                    <div class="table-frame"><table id="priceTable"><colgroup><col class="col-photo"><col class="col-code"><col class="col-description"><col class="col-expiry"><col class="col-weight"><col class="col-pieces"><col class="col-box"><col class="col-unit-price"><col class="col-box-price"><col class="col-pallet"><col class="col-pallet"><col class="col-pallet"></colgroup><thead></thead><tbody></tbody></table><div id="noResults" class="no-results" hidden>No matching items.</div></div>
                    </div>
                </section>
            </section>

            <section id="historyPanel" class="panel" hidden>
                <div class="page-heading">
                    <div class="heading-left">
                        <p class="kicker">AUDIT TRAIL</p>
                        <h1>Saved versions</h1>
                        <p class="muted">Review when a price list was saved, by whom, and with which adjustment.</p>
                    </div>
                    <div class="heading-actions">
                        <button id="backToPricesBtn" class="button secondary">← Back to prices</button>
                    </div>
                </div>

                <div class="table-tools history-tools">
                    <div class="filter-group">
                        <label class="search"><span>Search</span><svg class="search-icon" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><input id="historySearchInput" type="search" placeholder="Search saved versions..."></label>
                        <label class="select-control"><span>Adjustment</span><select id="historyAdjustmentSelect"><option value="">All adjustments</option><option value="positive">Positive (+)</option><option value="zero">Zero (0%)</option><option value="negative">Negative (-)</option></select></label>
                    </div>
                    <div class="actions">
                        <span id="historyCount" class="history-count">0 versions</span>
                    </div>
                </div>

                <div class="data-panel history-data-panel">
                    <div class="table-frame">
                        <table id="historyTable">
                            <colgroup>
                                <col style="width: 12%;">
                                <col style="width: 32%;">
                                <col style="width: 16%;">
                                <col style="width: 16%;">
                                <col style="width: 12%;">
                                <col style="width: 12%;">
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>Version</th>
                                    <th>File name</th>
                                    <th>Saved by</th>
                                    <th>Saved on <span class="sort-arrow">↓</span></th>
                                    <th>Adjustment</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="historyTableBody">
                            </tbody>
                        </table>
                        <div id="historyEmpty" class="history-empty-card" hidden>
                            <div class="empty-archive-icon">
                                <svg viewBox="0 0 48 48" width="56" height="56" fill="none" stroke="currentColor" aria-hidden="true">
                                    <line x1="24" y1="6" x2="24" y2="11" stroke="#ff2a85" stroke-width="2.2" stroke-linecap="round"/>
                                    <line x1="14" y1="10" x2="17" y2="13.5" stroke="#ff2a85" stroke-width="2.2" stroke-linecap="round"/>
                                    <line x1="34" y1="10" x2="31" y2="13.5" stroke="#ff2a85" stroke-width="2.2" stroke-linecap="round"/>
                                    <rect x="9" y="17" width="30" height="7" rx="3.5" stroke="#68778b" stroke-width="2.2"/>
                                    <path d="M12 24 L14 37 C14.3 39 15.8 40 17.8 40 L30.2 40 C32.2 40 33.7 39 34 37 L36 24" stroke="#68778b" stroke-width="2.2" stroke-linejoin="round"/>
                                    <line x1="21" y1="30" x2="27" y2="30" stroke="#68778b" stroke-width="2.2" stroke-linecap="round"/>
                                </svg>
                            </div>
                            <h2>No saved versions yet</h2>
                            <p>Saved price lists will appear here with their date, editor, and adjustment.</p>
                            <button id="emptyGoToPricesBtn" class="button primary">Go to prices →</button>
                        </div>
                    </div>
                </div>
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

<dialog id="saveDialog">
    <form method="dialog" class="dialog-card" id="saveForm">
        <div class="dialog-heading"><div><p class="kicker">Version control</p><h2>Save price list version</h2></div><button value="cancel" class="icon-button" aria-label="Close">×</button></div>
        <p class="muted">Enter a name for this version to easily identify it in history.</p>
        <label>Version name<input id="versionNameInput" type="text" maxlength="160" placeholder="e.g. Updated price list file" required></label>
        <div class="dialog-actions"><button value="cancel" class="button secondary">Cancel</button><button id="confirmSave" value="default" class="button primary">Save version</button></div>
    </form>
</dialog>

<dialog id="deleteDialog">
    <form method="dialog" class="dialog-card delete-dialog" id="deleteForm">
        <div class="dialog-heading"><div><p class="kicker">Permanent action</p><h2>Delete saved version?</h2></div><button value="cancel" class="icon-button" aria-label="Close">×</button></div>
        <p>This removes <strong id="deleteVersionName"></strong> from history. This action cannot be undone.</p>
        <div class="dialog-actions"><button value="cancel" class="button secondary">Cancel</button><button id="confirmDelete" value="default" class="button danger">Delete version</button></div>
    </form>
</dialog>

<dialog id="discardDraftDialog">
    <form method="dialog" class="dialog-card delete-dialog" id="discardDraftForm">
        <div class="dialog-heading"><div><p class="kicker">Unsaved changes</p><h2>Discard unsaved draft?</h2></div><button value="cancel" class="icon-button" aria-label="Close">×</button></div>
        <p>This will discard your unsaved draft and revert to the last saved price list. This action cannot be undone.</p>
        <div class="dialog-actions"><button value="cancel" class="button secondary">Cancel</button><button id="confirmDiscardDraft" value="default" class="button danger">Discard draft</button></div>
    </form>
</dialog>

<dialog id="logoutDialog">
    <form method="dialog" class="dialog-card" id="logoutForm">
        <div class="dialog-heading"><div><p class="kicker">Session</p><h2>Sign out?</h2></div><button value="cancel" class="icon-button" aria-label="Close">×</button></div>
        <p class="muted">Are you sure you want to sign out? You will need to sign in again to access the workspace.</p>
        <div class="dialog-actions"><button value="cancel" class="button secondary">Cancel</button><button id="confirmLogout" value="default" class="button primary">Sign out</button></div>
    </form>
</dialog>

<div id="toast" class="toast" role="status" aria-live="polite"></div>
<script>window.__BOOT__ = <?= json_encode(['user' => $user, 'csrf' => $_SESSION['csrf']], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;</script>
<script src="assets/vendor/xlsx.full.min.js"></script>
<script src="assets/vendor/jspdf.umd.min.js"></script>
<script src="assets/vendor/jspdf.plugin.autotable.min.js"></script>
<script src="assets/app.js?v=20260922-ui-v10"></script>
</body>
</html>
