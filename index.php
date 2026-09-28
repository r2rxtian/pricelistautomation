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
    <meta name="theme-color" content="#fffafb">
    <title><?= htmlspecialchars(APP_NAME) ?></title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600;1,700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/app.css?v=20260928-audit-v1">
    <script>
    (function() {
        try {
            var theme = localStorage.getItem('pla_theme');
            if (!theme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                theme = 'dark';
            }
            if (theme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
            }

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
    <button id="loginThemeToggleBtn" class="theme-toggle-btn login-theme-toggle" type="button" aria-label="Toggle dark mode" title="Toggle dark mode">
        <svg class="theme-icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" hidden><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
        <svg class="theme-icon-moon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
    </button>
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
        <div class="topbar-left">
            <a class="brand" href="#" aria-label="LRN Price List home"><span>LRN</span><b>Price List Automation</b></a>
        </div>
        <nav class="top-nav" aria-label="Primary">
            <button class="nav-item active" data-panel="workspacePanel"><span aria-hidden="true">▦</span><strong>Prices</strong></button>
            <button class="nav-item" data-panel="historyPanel" id="auditLogsNav"><span aria-hidden="true">📋</span><strong>Audit Logs</strong></button>
            <button id="settingsNav" class="nav-item admin-only" data-panel="settingsPanel" hidden><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><circle cx="9" cy="7" r="2" fill="currentColor" stroke="none"/><line x1="4" y1="17" x2="20" y2="17"/><circle cx="15" cy="17" r="2" fill="currentColor" stroke="none"/></svg><strong>Settings</strong></button>
        </nav>
        <div class="topbar-right">
            <button id="themeToggleBtn" class="theme-toggle-btn" type="button" aria-label="Toggle dark mode" title="Toggle dark mode">
                <svg class="theme-icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" hidden><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                <svg class="theme-icon-moon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            </button>
            <div class="notifications-wrapper">
                <button id="notificationBtn" class="notification-bell-btn" type="button" aria-expanded="false" aria-controls="notificationsDropdown" aria-label="Activity & Audit Logs" title="Activity & Audit Logs">
                    <svg class="bell-icon" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                    <span id="notificationBadge" class="notification-badge" hidden>0</span>
                </button>
                <div id="notificationsDropdown" class="notifications-dropdown" hidden role="region" aria-label="Activity & Audit Logs">
                    <div class="notifications-header">
                        <div class="notifications-title">
                            <strong>Activity & Audit Logs</strong>
                            <span id="notificationsCountBadge" class="notifications-pill">0</span>
                        </div>
                        <div class="notifications-header-actions">
                            <button type="button" id="markAllReadBtn" class="text-button" title="Mark all notifications as read">Mark all as read</button>
                            <button type="button" id="clearLogsBtn" class="text-button text-muted-button admin-only" title="Clear activity log history" hidden>Clear</button>
                        </div>
                    </div>
                    <div id="notificationsList" class="notifications-list" role="log" aria-live="polite">
                        <!-- Notification items rendered here -->
                    </div>
                    <div id="notificationsEmpty" class="notifications-empty" hidden>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg>
                        <p>No recent activity or notifications yet.</p>
                    </div>
                    <div class="notifications-footer">
                        <button type="button" id="openAuditLogsFromBell" class="notifications-footer-btn">
                            <span>Open complete audit logs & history</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                        </button>
                    </div>
                </div>
            </div>
            <div class="user-menu"><span id="userName"></span><span id="roleBadge" class="badge"></span><button id="logoutButton" class="text-button">Sign out</button></div>
        </div>
    </header>

    <div class="workspace">
        <main class="content">
            <section id="workspacePanel" class="panel active">
                <div class="page-heading">
                    <div class="heading-left">
                        <p class="kicker">CURRENT FILE</p>
                        <div class="title-line"><h1 id="listTitle">Start with a workbook</h1><span id="activeBadge" class="status-badge" hidden><span class="pulse-dot" aria-hidden="true"><span class="pulse-ring"></span></span>Active</span></div>
                        <div class="meta-container">
                            <div class="file-identity-row">
                                <svg class="file-badge-icon" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                                    <polyline points="14 2 14 8 20 8"/>
                                    <line x1="8" y1="13" x2="16" y2="13"/>
                                    <line x1="8" y1="17" x2="16" y2="17"/>
                                </svg>
                                <span id="listMeta" class="list-subtitle">Upload an .xlsx or .xls file to map its products and prices.</span>
                            </div>
                            <div class="file-audit-row" id="savedMetaRow" hidden>
                                <svg class="audit-clock-icon" aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"/>
                                    <polyline points="12 6 12 12 16 14"/>
                                </svg>
                                <span id="savedMeta" class="saved-meta"></span>
                            </div>
                        </div>
                    </div>
                    <div id="metricGroup" class="metric-group" hidden>
                        <div class="metric-item"><strong id="productCount">0</strong><span>Products</span></div>
                        <div class="metric-item"><strong id="categoryCount">0</strong><span>Categories</span></div>
                        <div class="metric-item"><strong id="priceColumnCount">0</strong><span>Auto price fields</span></div>
                        <div class="metric-item"><strong id="currentAdjustment">0%</strong><span>Adjustment</span></div>
                    </div>
                    <div class="heading-actions">
                        <div class="main edit-only" id="cloverActions">
                            <div class="up">
                                <button id="editButton" class="card1 is-disabled" type="button" aria-expanded="false" aria-controls="adjustmentBar" title="Edit prices" aria-label="Edit prices" data-tooltip="Edit prices" aria-disabled="true">
                                    <svg class="icon-edit" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                        <line x1="4" y1="21" x2="4" y2="14"/>
                                        <line x1="4" y1="10" x2="4" y2="3"/>
                                        <line x1="12" y1="21" x2="12" y2="12"/>
                                        <line x1="12" y1="8" x2="12" y2="3"/>
                                        <line x1="20" y1="21" x2="20" y2="16"/>
                                        <line x1="20" y1="12" x2="20" y2="3"/>
                                        <line x1="1" y1="14" x2="7" y2="14"/>
                                        <line x1="9" y1="8" x2="15" y2="8"/>
                                        <line x1="17" y1="16" x2="23" y2="16"/>
                                    </svg>
                                </button>
                                <button id="resetPricesButton" class="card2 is-disabled" type="button" title="Reset prices" aria-label="Reset prices" data-tooltip="Reset prices" aria-disabled="true">
                                    <svg class="icon-reset" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                                        <path d="M3 3v5h5"/>
                                    </svg>
                                </button>
                            </div>
                            <div class="down">
                                <button id="uploadButton" class="card3" type="button" title="Upload Excel" aria-label="Upload Excel" data-tooltip="Upload Excel">
                                    <svg class="icon-upload" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                        <polyline points="14 2 14 8 20 8"/>
                                        <line x1="12" y1="18" x2="12" y2="12"/>
                                        <polyline points="9 15 12 12 15 15"/>
                                    </svg>
                                </button>
                                <button id="saveButton" class="card4 is-disabled" type="button" title="Save version" aria-label="Save version" data-tooltip="Save version" aria-disabled="true">
                                    <svg class="icon-save" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                        <polyline points="17 21 17 13 7 13 7 21"/>
                                        <polyline points="7 3 7 8 15 8"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <section id="adjustmentBar" class="adjustment-bar price-popover edit-only" role="dialog" aria-modal="false" aria-labelledby="adjustmentTitle" hidden>
                            <div class="edit-summary"><strong id="adjustmentTitle">Adjust all prices</strong><span>Use a positive or negative percentage.</span></div>
                            <form id="adjustmentForm" class="adjustment-form-wrap" onsubmit="return false;">
                                <label for="percentage">Percentage adjustment</label>
                                <div class="percentage-input-row">
                                    <div class="percentage-input"><input id="percentage" type="number" min="-100" max="10000" step="0.01" value="0"><span>%</span></div>
                                    <button id="previewButton" type="submit" class="button primary" title="Apply adjustment to current category (Press Enter)">Apply</button>
                                </div>
                                <div class="adjustment-divider"><span>or apply globally</span></div>
                                <button id="applyAllCategoriesButton" type="button" class="button secondary btn-apply-all-categories" title="Apply this percentage to all categories in the price list">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                        <rect x="3" y="3" width="7" height="7"></rect>
                                        <rect x="14" y="3" width="7" height="7"></rect>
                                        <rect x="14" y="14" width="7" height="7"></rect>
                                        <rect x="3" y="14" width="7" height="7"></rect>
                                    </svg>
                                    <span>Apply to all categories</span>
                                </button>
                            </form>
                        </section>
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
                        <div class="actions">
                            <button id="addRowBtn" class="button primary icon-button edit-only" type="button" title="Add new product row">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                                <span>Add row</span>
                            </button>
                            <button id="excelButton" class="button secondary">Export Excel</button>
                            <button id="pdfButton" class="button secondary">Export PDF</button>
                        </div>
                    </div>
                    <div id="excelFormulaBar" class="excel-formula-bar edit-only">
                        <div class="formula-cell-indicator" id="formulaCellIndicator" title="Selected Cell">A1</div>
                        <div class="formula-fx-label" aria-hidden="true">fx</div>
                        <input type="text" id="formulaInput" class="formula-input" placeholder="Click any cell or press Enter to edit..." autocomplete="off" spellcheck="false" aria-label="Cell value editor">
                        <div class="formula-bar-actions">
                            <button type="button" id="formulaCancelBtn" class="formula-btn" title="Cancel (Esc)" aria-label="Cancel">✕</button>
                            <button type="button" id="formulaConfirmBtn" class="formula-btn formula-btn-confirm" title="Confirm (Enter)" aria-label="Confirm">✓</button>
                        </div>
                        <div class="formula-bar-hints">
                            <span class="formula-hint-badge"><kbd>Enter</kbd> edit</span>
                            <span class="formula-hint-badge"><kbd>Tab</kbd> / <kbd>Arrows</kbd> navigate</span>
                            <span class="formula-hint-badge"><kbd>Esc</kbd> cancel</span>
                        </div>
                    </div>
                    <div class="table-frame"><table id="priceTable"><thead></thead><tbody></tbody></table><div id="noResults" class="no-results" hidden>No matching items.</div></div>
                    </div>
                </section>
            </section>

            <section id="historyPanel" class="panel" hidden>
                <div class="page-heading history-heading">
                    <div class="heading-left">
                        <p class="kicker history-kicker">COMPLIANCE & AUDIT TRAIL</p>
                        <h1 class="history-title">Audit Logs & Version History</h1>
                        <p class="muted history-subtitle">Real-time audit log tracking price modifications, cell edits, category adjustments, and saved workbook releases.</p>
                    </div>
                    <div class="heading-actions">
                        <button id="backToPricesBtn" class="button secondary history-back-btn"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg><span>Back to prices</span></button>
                    </div>
                </div>

                <div class="audit-tab-bar" role="tablist" aria-label="Audit log views">
                    <button type="button" class="audit-tab-btn active" data-audit-tab="all" role="tab" aria-selected="true">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        <span>All Activity</span>
                        <span id="auditAllCountBadge" class="audit-tab-count">0</span>
                    </button>
                    <button type="button" class="audit-tab-btn" data-audit-tab="edits" role="tab" aria-selected="false">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                        <span>Price & Cell Edits</span>
                        <span id="auditEditsCountBadge" class="audit-tab-count">0</span>
                    </button>
                    <button type="button" class="audit-tab-btn" data-audit-tab="versions" role="tab" aria-selected="false">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                        <span>Saved Versions</span>
                        <span id="auditVersionsCountBadge" class="audit-tab-count">0</span>
                    </button>
                </div>

                <div class="history-card">
                    <div class="history-tools">
                        <div class="history-filter-group">
                            <div class="history-search-control">
                                <svg class="history-search-icon" aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                <input id="historySearchInput" type="search" placeholder="Search audit logs, products, users..." autocomplete="off" aria-label="Search audit logs">
                            </div>
                            <div class="history-select-control" id="auditFileSelectWrapper">
                                <select id="auditFileSelect" aria-label="Filter by file">
                                    <option value="">All Files</option>
                                    <option value="__current__">Current File</option>
                                </select>
                                <svg class="history-chevron-icon" aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </div>
                            <div class="history-select-control" id="auditTypeSelectWrapper">
                                <select id="auditTypeSelect" aria-label="Filter by event type">
                                    <option value="">All Event Types</option>
                                    <option value="price_adjust">Price Adjustments</option>
                                    <option value="cell_edit">Cell Edits</option>
                                    <option value="save_version">Saved Versions</option>
                                    <option value="row_add">Added Products</option>
                                    <option value="row_delete">Deleted Products</option>
                                    <option value="reset_prices">Price Resets</option>
                                    <option value="import_workbook">Workbook Imports</option>
                                </select>
                                <svg class="history-chevron-icon" aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </div>
                            <div class="history-select-control" id="auditUserSelectWrapper">
                                <select id="auditUserSelect" aria-label="Filter by user">
                                    <option value="">All Users</option>
                                </select>
                                <svg class="history-chevron-icon" aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </div>
                            <div class="history-select-control" id="historyAdjustmentSelectWrapper" hidden>
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
                            <span id="historyCount" class="history-count">0 items</span>
                            <button type="button" id="refreshAuditLogsBtn" class="audit-refresh-btn" title="Refresh audit logs" aria-label="Refresh audit logs">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                            </button>
                        </div>
                    </div>

                    <div class="history-table-frame">
                        <table id="historyTable">
                            <thead id="auditTableHead">
                                <tr>
                                    <th style="width: 14%;">Timestamp <span class="sort-arrow">↓</span></th>
                                    <th style="width: 11%;">Actor</th>
                                    <th style="width: 11%;">Event</th>
                                    <th style="width: 20%;">Target File</th>
                                    <th style="width: 23%;">Activity & Details</th>
                                    <th style="width: 12%;">Diff / Change</th>
                                    <th style="width: 9%;">Action</th>
                                </tr>
                            </thead>
                            <thead id="versionsTableHead" hidden>
                                <tr>
                                    <th style="width: 11%;">Version</th>
                                    <th style="width: 29.5%;">File name</th>
                                    <th style="width: 12.5%;">Saved by</th>
                                    <th style="width: 16.5%;">Saved on <span class="sort-arrow">↓</span></th>
                                    <th style="width: 19%;">Adjustment</th>
                                    <th style="width: 11.5%;">Actions</th>
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
                            <h2 id="historyEmptyTitle">No audit log records yet</h2>
                            <p id="historyEmptySubtitle">Activity like price changes, cell edits, and workbook saves will appear here in chronological order.</p>
                            <button id="emptyGoToPricesBtn" class="button primary">Go to prices →</button>
                        </div>
                    </div>

                    <div id="historyFooter" class="history-footer">
                        <div class="history-footer-left">
                            <span id="historyShowingLabel" class="history-showing-text">Showing 0 of 0 items</span>
                            <div class="history-page-size-wrap">
                                <label for="historyPageSizeSelect" class="history-page-size-label">Per page:</label>
                                <div class="history-select-control history-page-size-control">
                                    <select id="historyPageSizeSelect" aria-label="Items per page">
                                        <option value="10" selected>10</option>
                                        <option value="20">20</option>
                                        <option value="50">50</option>
                                        <option value="100">100</option>
                                    </select>
                                    <svg class="history-chevron-icon" aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                </div>
                            </div>
                        </div>
                        <div class="history-pagination">
                            <button id="historyFirstBtn" class="history-page-nav-btn" aria-label="First page" title="First page" disabled>
                                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="11 17 6 12 11 7"></polyline><polyline points="18 17 13 12 18 7"></polyline></svg>
                            </button>
                            <button id="historyPrevBtn" class="history-page-nav-btn" aria-label="Previous page" title="Previous page" disabled>
                                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                            </button>
                            <div id="historyPageNumbers" class="history-page-numbers"></div>
                            <button id="historyNextBtn" class="history-page-nav-btn" aria-label="Next page" title="Next page" disabled>
                                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </button>
                            <button id="historyLastBtn" class="history-page-nav-btn" aria-label="Last page" title="Last page" disabled>
                                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg>
                            </button>
                        </div>
                    </div>
                </div>

                <dialog id="historyChangesDialog" class="history-details-dialog">
                    <form method="dialog" class="dialog-card history-changes-card">
                        <div class="dialog-heading">
                            <div>
                                <p class="kicker" id="historyChangesKicker">AUDIT RECORD DETAILS</p>
                                <h2 id="historyChangesTitle">Change details</h2>
                            </div>
                            <button value="cancel" class="icon-button" aria-label="Close">×</button>
                        </div>
                        <p id="historyChangesMeta" class="muted"></p>
                        <div id="historyChangesContent" class="history-changes-content"></div>
                        <div class="dialog-actions" id="historyChangesActions">
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

<dialog id="uploadModal" class="upload-modal-dialog">
    <div class="dialog-card upload-modal-card">
        <div class="dialog-heading">
            <div class="upload-modal-title-group">
                <span class="upload-modal-icon-badge" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </span>
                <div>
                    <p class="kicker">WORKBOOK IMPORT</p>
                    <h2>Upload Price List Excel File</h2>
                </div>
            </div>
            <button id="closeUploadModalBtn" type="button" class="icon-button" aria-label="Close">×</button>
        </div>

        <p class="muted upload-modal-desc">
            Upload an Excel workbook (<code>.xlsx</code> or <code>.xls</code>) to map product categories, descriptions, specifications, and prices directly into the spreadsheet editor.
        </p>

        <!-- Downloadable Official Template Card -->
        <div class="template-download-card">
            <div class="template-card-left">
                <div class="template-card-icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="12" y2="18"/><line x1="15" y1="15" x2="12" y2="18"/></svg>
                </div>
                <div class="template-card-info">
                    <strong>Need the exact Excel template?</strong>
                    <span>Download the official workbook pre-formatted with exact worksheets, columns, and sample products ready for input.</span>
                </div>
            </div>
            <button type="button" id="downloadTemplateBtn" class="button secondary download-template-btn" title="Download official Excel template">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span>Download Template (.xlsx)</span>
            </button>
        </div>

        <!-- Template Column Guide / Visual Layout Preview -->
        <div class="template-structure-preview">
            <div class="structure-preview-header">
                <strong>Exact Template Columns (12 Standard Fields)</strong>
                <span class="structure-badge">Matches Active Editor</span>
            </div>
            <div class="structure-columns-table-wrap">
                <table class="structure-mini-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Photo</th>
                            <th>Code No</th>
                            <th>Description</th>
                            <th>Expiry</th>
                            <th>Weight</th>
                            <th>Pcs/Box</th>
                            <th>Box Size</th>
                            <th>Price/pc</th>
                            <th>Price/Box</th>
                            <th>Pallet 40ft (L/S)</th>
                            <th>Pallet 20ft (L)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>1</td>
                            <td><em>[Image]</em></td>
                            <td><code>PRD-001</code></td>
                            <td>Mini Tart Shells Round</td>
                            <td>12 Mo</td>
                            <td>15g</td>
                            <td>120</td>
                            <td>Medium Box</td>
                            <td>$0.45</td>
                            <td>$54.00</td>
                            <td>16 Lrg / 2 Sml</td>
                            <td>8 Lrg</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- File Upload Area -->
        <div id="modalDropZone" class="modal-drop-zone">
            <input id="modalFileInput" type="file" accept=".xlsx,.xls" hidden>
            <div class="drop-zone-content">
                <div class="drop-zone-icon" aria-hidden="true">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg>
                </div>
                <div class="drop-zone-text">
                    <strong id="dropZonePrompt">Drag &amp; drop your Excel file here, or <button type="button" id="browseFileBtn" class="link-btn">browse files</button></strong>
                    <small>Supports Microsoft Excel (.xlsx, .xls) up to 25 MB</small>
                </div>
                <div id="selectedFileInfo" class="selected-file-info" hidden>
                    <span class="file-icon" aria-hidden="true">📄</span>
                    <div class="file-text">
                        <strong id="selectedFileName">filename.xlsx</strong>
                        <span id="selectedFileSize">0 KB</span>
                    </div>
                    <button type="button" id="removeSelectedFileBtn" class="icon-button" title="Remove selected file" aria-label="Remove selected file">×</button>
                </div>
            </div>
        </div>

        <div class="dialog-actions">
            <button id="cancelUploadBtn" type="button" class="button secondary">Cancel</button>
            <button id="submitUploadBtn" type="button" class="button primary" disabled>Upload &amp; Open Editor</button>
        </div>
    </div>
</dialog>

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

<dialog id="deleteRowDialog">
    <form method="dialog" class="dialog-card delete-dialog" id="deleteRowForm">
        <div class="dialog-heading"><div><p class="kicker">Delete row</p><h2>Remove product row?</h2></div><button value="cancel" class="icon-button" aria-label="Close">×</button></div>
        <p>Are you sure you want to remove <strong id="deleteRowProductName">this product</strong> from the price list?</p>
        <div class="dialog-actions"><button value="cancel" class="button secondary">Cancel</button><button id="confirmDeleteRow" value="default" class="button danger">Delete row</button></div>
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
<script src="assets/app.js?v=20260928-audit-v1"></script>
</body>
</html>
