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
    <meta name="theme-color" content="#f7cbd2">
    <title><?= htmlspecialchars(APP_NAME) ?></title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600;1,700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/app.css?v=20260924-history-ui-v3">
    <script>
    (function() {
        try {
            var hash = (location.hash || '').replace(/^#/, '').toLowerCase();
            var panel = '';
            if (hash === 'history' || hash === 'historypanel') panel = 'historyPanel';
            else if (hash === 'settings' || hash === 'settingspanel') panel = 'settingsPanel';
            else if (hash === 'prices' || hash === 'workspace' || hash === 'workspacepanel') panel = 'workspacePanel';
            else panel = localStorage.getItem('pla_active_panel') || 'workspacePanel';

            if (panel && panel !== 'workspacePanel') {
                document.documentElement.setAttribute('data-initial-panel', panel);
            }
        } catch (e) {}
    })();
    </script>
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
            <button id="settingsNav" class="nav-item admin-only" data-panel="settingsPanel" hidden><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><circle cx="9" cy="7" r="2" fill="currentColor" stroke="none"/><line x1="4" y1="17" x2="20" y2="17"/><circle cx="15" cy="17" r="2" fill="currentColor" stroke="none"/></svg><strong>Settings</strong></button>
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
                        <button id="resetPricesButton" class="button secondary edit-only" hidden>Reset prices</button>
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
                <div class="page-heading history-heading">
                    <div class="heading-left">
                        <p class="kicker history-kicker">AUDIT TRAIL</p>
                        <h1 class="history-title">Saved versions</h1>
                        <p class="muted history-subtitle">Review when a price list was saved, by whom, and with which adjustment.</p>
                    </div>
                    <div class="heading-actions">
                        <button id="backToPricesBtn" class="button secondary history-back-btn"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg><span>Back to prices</span></button>
                    </div>
                </div>

                <div class="history-card">
                    <div class="history-tools">
                        <div class="history-filter-group">
                            <div class="history-search-control">
                                <svg class="history-search-icon" aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                <input id="historySearchInput" type="search" placeholder="Search saved versions..." autocomplete="off" aria-label="Search saved versions">
                            </div>
                            <div class="history-select-control">
                                <select id="historyAdjustmentSelect" aria-label="Filter by adjustment">
                                    <option value="">All adjustments</option>
                                    <option value="positive">Positive (+)</option>
                                    <option value="zero">Zero (0%)</option>
                                    <option value="negative">Negative (-)</option>
                                </select>
                                <svg class="history-chevron-icon" aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </div>
                        </div>
                        <div class="history-tools-meta">
                            <span id="historyCount" class="history-count">0 versions</span>
                        </div>
                    </div>

                    <div class="history-table-frame">
                        <table id="historyTable">
                            <colgroup>
                                <col style="width: 11%;">
                                <col style="width: 29.5%;">
                                <col style="width: 12.5%;">
                                <col style="width: 16.5%;">
                                <col style="width: 19%;">
                                <col style="width: 11.5%;">
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
                                    <line x1="24" y1="6" x2="24" y2="11" stroke="#dc7e8a" stroke-width="2.2" stroke-linecap="round"/>
                                    <line x1="14" y1="10" x2="17" y2="13.5" stroke="#dc7e8a" stroke-width="2.2" stroke-linecap="round"/>
                                    <line x1="34" y1="10" x2="31" y2="13.5" stroke="#dc7e8a" stroke-width="2.2" stroke-linecap="round"/>
                                    <rect x="9" y="17" width="30" height="7" rx="3.5" stroke="#716267" stroke-width="2.2"/>
                                    <path d="M12 24 L14 37 C14.3 39 15.8 40 17.8 40 L30.2 40 C32.2 40 33.7 39 34 37 L36 24" stroke="#716267" stroke-width="2.2" stroke-linejoin="round"/>
                                    <line x1="21" y1="30" x2="27" y2="30" stroke="#716267" stroke-width="2.2" stroke-linecap="round"/>
                                </svg>
                            </div>
                            <h2>No saved versions yet</h2>
                            <p>Saved price lists will appear here with their date, editor, and adjustment.</p>
                            <button id="emptyGoToPricesBtn" class="button primary">Go to prices →</button>
                        </div>
                    </div>

                    <div id="historyFooter" class="history-footer">
                        <span id="historyShowingLabel" class="history-showing-text">Showing 0 of 0 versions</span>
                        <div class="history-pagination">
                            <button id="historyPrevBtn" class="history-page-nav-btn" aria-label="Previous page" title="Previous page" disabled><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
                            <span id="historyPageLabel" class="history-page-info">Page 1 of 1</span>
                            <button id="historyNextBtn" class="history-page-nav-btn" aria-label="Next page" title="Next page" disabled><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
                        </div>
                    </div>
                </div>

                <dialog id="historyChangesDialog" class="history-details-dialog">
                    <form method="dialog" class="dialog-card history-changes-card">
                        <div class="dialog-heading">
                            <div>
                                <p class="kicker">ADJUSTMENT BREAKDOWN</p>
                                <h2 id="historyChangesTitle">Version adjustments</h2>
                            </div>
                            <button value="cancel" class="icon-button" aria-label="Close">×</button>
                        </div>
                        <p id="historyChangesMeta" class="muted"></p>
                        <div id="historyChangesContent" class="history-changes-content"></div>
                        <div class="dialog-actions">
                            <button value="cancel" class="button secondary">Close</button>
                        </div>
                    </form>
                </dialog>
            </section>

            <section id="settingsPanel" class="panel" hidden>
                <div class="page-heading settings-heading">
                    <div class="heading-left">
                        <p class="kicker">Admin settings</p>
                        <h1>Product type images</h1>
                        <p class="muted">Choose the image shown for each product type inside a category. Changes apply to the table and PDF exports.</p>
                    </div>
                    <div class="heading-actions"><button id="settingsBackButton" class="button secondary">Back to prices</button></div>
                </div>
                <div class="image-settings-card">
                    <div class="image-settings-toolbar">
                        <label class="select-control settings-category-control"><span>Category</span><select id="imageCategoryFilter" aria-label="Filter image settings by category"></select></label>
                        <label class="search settings-search"><span>Search product types</span><input id="imageSearchInput" type="search" placeholder="Search product types..."></label>
                        <span id="imageSettingsCount" class="history-count"></span>
                    </div>
                    <div id="imageSettingsList" class="image-settings-list" aria-live="polite"></div>
                    <div id="imageSettingsEmpty" class="settings-empty" hidden><h2>No product types available</h2><p>Upload a workbook first. Its categories and product groups will appear here.</p></div>
                </div>
                <input id="groupImageInput" type="file" accept="image/jpeg,image/png,image/webp" hidden>
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
    <form method="dialog" class="dialog-card save-version-dialog" id="saveForm">
        <div class="dialog-heading"><div><p class="kicker">Version control</p><h2>Save price list version</h2></div><button value="cancel" class="icon-button" aria-label="Close">×</button></div>
        <p class="muted">Review your price adjustments and enter a version name to save to history.</p>
        <div id="saveChangeSummary" class="save-change-summary" aria-label="Price adjustment summary"></div>
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

<dialog id="resetPricesDialog">
    <form method="dialog" class="dialog-card" id="resetPricesForm">
        <div class="dialog-heading"><div><p class="kicker">Reset adjustments</p><h2>Reset prices to 0%?</h2></div><button value="cancel" class="icon-button" aria-label="Close">×</button></div>
        <p class="muted">This will reset all category percentage adjustments back to 0% and restore the original prices from your uploaded file. Your file and products will stay loaded.</p>
        <div class="dialog-actions"><button value="cancel" class="button secondary">Cancel</button><button id="confirmResetPrices" value="default" class="button danger">Reset to original prices</button></div>
    </form>
</dialog>

<dialog id="logoutDialog">
    <form method="dialog" class="dialog-card" id="logoutForm">
        <div class="dialog-heading"><div><p class="kicker">Session</p><h2>Sign out?</h2></div><button value="cancel" class="icon-button" aria-label="Close">×</button></div>
        <p class="muted">Are you sure you want to sign out? You will need to sign in again to access the workspace.</p>
        <div class="dialog-actions"><button value="cancel" class="button secondary">Cancel</button><button id="confirmLogout" value="default" class="button primary">Sign out</button></div>
    </form>
</dialog>

<dialog id="deleteImageDialog">
    <form method="dialog" class="dialog-card" id="deleteImageForm">
        <div class="dialog-heading"><div><p class="kicker">Restore default</p><h2>Remove custom image?</h2></div><button value="cancel" class="icon-button" aria-label="Close">&times;</button></div>
        <p>The custom image for <strong id="deleteImageName"></strong> will be removed and the built-in category image will be used again.</p>
        <div class="dialog-actions"><button value="cancel" class="button secondary">Cancel</button><button id="confirmDeleteImage" value="default" class="button danger">Restore default</button></div>
    </form>
</dialog>

<div id="toast" class="toast" role="status" aria-live="polite"></div>
<script>window.__BOOT__ = <?= json_encode(['user' => $user, 'csrf' => $_SESSION['csrf']], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;</script>
<script src="assets/vendor/xlsx.full.min.js"></script>
<script src="assets/vendor/jspdf.umd.min.js"></script>
<script src="assets/vendor/jspdf.plugin.autotable.min.js"></script>
<script src="assets/app.js?v=20260924-history-ui-v3"></script>
</body>
</html>
