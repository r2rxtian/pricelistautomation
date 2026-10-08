<?php
declare(strict_types=1);
/**
 * The signed-in app (top bar, the five pages and their dialogs). Rendered by the page files in
 * pages/ — prices.php, files.php, approvals.php, audit_logs.php, config.php — which set $page to the
 * page to open. Switching pages in the top bar happens in the browser (scripts/app.js) and updates
 * the address to that page's file, so a refresh or bookmark opens the same page.
 */
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../auth/csrf.php';

const APP_PAGES = [
    'prices' => ['panel' => 'workspacePanel', 'title' => 'Prices'],
    'files' => ['panel' => 'filesPanel', 'title' => 'Files'],
    'approvals' => ['panel' => 'listsPanel', 'title' => 'Approvals'],
    'audit_logs' => ['panel' => 'historyPanel', 'title' => 'Audit Logs'],
    'config' => ['panel' => 'settingsPanel', 'title' => 'Config'],
];
$page = isset($page) && array_key_exists($page, APP_PAGES) ? $page : 'prices';

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
// Signed-out visitors go to login.php.
$user = requireLogin();
$panel = APP_PAGES[$page]['panel'];
?>
<!doctype html>
<html lang="en"<?= $panel !== 'workspacePanel' ? ' data-initial-panel="' . $panel . '"' : '' ?>>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="theme-color" content="#fffafb">
    <title><?= htmlspecialchars(APP_PAGES[$page]['title'] . ' · ' . APP_NAME) ?></title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600;1,700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../styles/app.css?v=89">
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
        } catch (e) {}
    })();
    </script>
</head>
<body class="is-booting" data-authenticated="true" data-panel="<?= $panel ?>">
<noscript>This application requires JavaScript for Excel import and export.</noscript>

<div id="appView" class="app-shell">
    <div id="appLoading" class="app-loading" role="status"><div class="loader-orbit"><span class="orbit-ring ring-1"></span><span class="orbit-ring ring-2"></span><span class="orbit-core"></span></div><strong>Loading price workspace</strong></div>
    <header class="topbar">
        <div class="topbar-left">
            <a class="brand" href="#" aria-label="LRN Price List home"><span>LRN</span><b>Price List Automation</b></a>
        </div>
        <nav class="top-nav" aria-label="Primary">
            <button class="nav-item active" data-panel="workspacePanel"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/></svg><strong>Prices</strong></button>
            <button class="nav-item" data-panel="filesPanel" id="filesNav"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><strong>Files</strong></button>
            <button class="nav-item" data-panel="listsPanel" id="priceListsNav"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><strong>Approvals</strong><span id="pendingApprovalCount" class="nav-count" hidden>0</span></button>
            <button class="nav-item perm-viewAudit" data-panel="historyPanel" id="auditLogsNav" hidden><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg><strong>Audit Logs</strong></button>
            <button id="settingsNav" class="nav-item perm-manageImages" data-panel="settingsPanel" hidden><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><circle cx="9" cy="7" r="2" fill="currentColor" stroke="none"/><line x1="4" y1="17" x2="20" y2="17"/><circle cx="15" cy="17" r="2" fill="currentColor" stroke="none"/></svg><strong>Config</strong></button>
        </nav>
        <div class="topbar-right">
            <button id="themeToggleBtn" class="theme-toggle-btn" type="button" aria-label="Toggle dark mode" title="Toggle dark mode">
                <svg class="theme-icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" hidden><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                <svg class="theme-icon-moon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            </button>
            <div class="notifications-wrapper">
                <button id="notificationBtn" class="notification-bell-btn" type="button" aria-expanded="false" aria-controls="notificationsDropdown" aria-label="Notifications" title="Notifications">
                    <svg class="bell-icon" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                    <span id="notificationBadge" class="notification-badge" hidden>0</span>
                </button>
                <div id="notificationsDropdown" class="notifications-dropdown" hidden role="region" aria-label="Notifications">
                    <div class="notifications-header">
                        <div class="notifications-title">
                            <strong>Notifications</strong>
                            <span id="notificationsCountBadge" class="notifications-pill">0</span>
                        </div>
                        <div class="notifications-header-actions">
                            <button type="button" id="markAllReadBtn" class="text-button" title="Mark all notifications as read">Mark all as read</button>
                        </div>
                    </div>
                    <div id="notificationsList" class="notifications-list" role="log" aria-live="polite">
                        <!-- Notification items rendered here -->
                    </div>
                    <div id="notificationsEmpty" class="notifications-empty" hidden>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg>
                        <p>No notifications yet.</p>
                    </div>
                    <div class="notifications-footer">
                        <button type="button" id="openAuditLogsFromBell" class="notifications-footer-btn">
                            <span>Open approvals</span>
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
                        <div class="title-line"><h1 id="listTitle">Start with a workbook</h1><span id="activeBadge" class="status-badge" hidden><span class="pulse-dot" aria-hidden="true"><span class="pulse-ring"></span></span>Active</span><button type="button" id="closeFileBtn" class="close-file-btn" title="Close this file" aria-label="Close this file" hidden><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg><span>Close file</span></button></div>
                        <div class="meta-container">
                            <div class="file-identity-row">
                                <svg class="file-badge-icon" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                                    <polyline points="14 2 14 8 20 8"/>
                                    <line x1="8" y1="13" x2="16" y2="13"/>
                                    <line x1="8" y1="17" x2="16" y2="17"/>
                                </svg>
                                <span id="listMeta" class="list-subtitle">Upload an official .xlsx template to open and edit prices.</span>
                            </div>
                            <div class="file-audit-row" id="savedMetaRow" hidden>
                                <svg class="audit-clock-icon" aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"/>
                                    <polyline points="12 6 12 12 16 14"/>
                                </svg>
                                <span id="savedMeta" class="saved-meta"></span>
                            </div>
                            <div class="file-tags-row" id="listTagsRow" hidden>
                                <span class="list-tag list-tag-country" title="Country"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg><small>Country</small><strong id="listCountry">—</strong></span>
                                <span class="list-tag" title="Price level"><small>Price level</small><strong id="listPriceLevel">—</strong></span>
                                <span class="list-tag" id="listRevisionTag" hidden><small>Revision</small><strong id="listRevision">1</strong></span>
                                <span id="approvalBanner" class="workflow-note" role="status" aria-live="polite" hidden>
                                    <span id="approvalBannerIcon" class="workflow-note-icon" aria-hidden="true"></span>
                                    <span id="approvalBannerText" class="workflow-note-text"></span>
                                </span>
                                <span class="decision-actions">
                                    <button type="button" id="bannerApproveBtn" class="mini-action approve" hidden>Approve</button>
                                    <button type="button" id="bannerRejectBtn" class="mini-action reject" hidden>Reject</button>
                                </span>
                            </div>
                        </div>
                    </div>
                    <div id="metricGroup" class="metric-group" hidden>
                        <div class="metric-item"><strong id="productCount">0</strong><span>Products</span></div>
                        <div class="metric-item"><strong id="categoryCount">0</strong><span>Categories</span></div>
                        <div class="metric-item"><strong id="priceColumnCount">0</strong><span>Price columns</span></div>
                        <div class="metric-item"><strong id="currentAdjustment">0%</strong><span>Adjustment</span></div>
                    </div>
                    <div class="heading-actions">
                        <div class="main" id="cloverActions" hidden>
                            <div class="up">
                                <button id="excelButton" class="card1 export-icon export-excel" type="button" title="Export Excel" aria-label="Export Excel" data-tooltip="Export Excel">
                                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="12" x2="16" y2="18"/><line x1="16" y1="12" x2="8" y2="18"/></svg>
                                </button>
                                <button id="pdfButton" class="card2 export-icon export-pdf" type="button" title="Export PDF" aria-label="Export PDF" data-tooltip="Export PDF">
                                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="11" x2="12" y2="17"/><polyline points="9 14 12 17 15 14"/></svg>
                                </button>
                            </div>
                            <div class="down">
                                <button id="uploadButton" class="card3 perm-update" type="button" title="Upload Excel" aria-label="Upload Excel" data-tooltip="Upload Excel">
                                    <svg class="icon-upload" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                        <polyline points="14 2 14 8 20 8"/>
                                        <line x1="12" y1="18" x2="12" y2="12"/>
                                        <polyline points="9 15 12 12 15 15"/>
                                    </svg>
                                </button>
                                <button id="saveButton" class="card4 perm-update is-disabled" type="button" title="Save version" aria-label="Save version" data-tooltip="Save version" aria-disabled="true">
                                    <svg class="icon-save" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                        <polyline points="17 21 17 13 7 13 7 21"/>
                                        <polyline points="7 3 7 8 15 8"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <section id="adjustmentBar" class="adjustment-bar price-popover" role="dialog" aria-modal="false" aria-labelledby="adjustmentTitle" hidden>
                            <form id="adjustmentForm" class="adjustment-form-wrap" onsubmit="return false;">
                                <div class="adj-head">
                                    <strong id="adjustmentTitle">Adjust prices</strong>
                                    <button type="button" id="closeAdjustmentBarBtn" class="popover-close-btn" aria-label="Close" title="Close (Esc)">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    </button>
                                </div>

                                <div class="adj-amount">
                                    <label class="percentage-input" for="percentage" title="Percentage change, e.g. 5 or -10. Arrow keys step by 1 (Shift: 10).">
                                        <input id="percentage" type="number" min="-100" max="10000" step="0.01" value="0" placeholder="0" aria-label="Percentage adjustment">
                                        <span>%</span>
                                    </label>
                                    <div class="adj-presets" role="group" aria-label="Preset percentages">
                                        <button type="button" class="adj-preset-chip" data-preset="-10">−10</button>
                                        <button type="button" class="adj-preset-chip" data-preset="-5">−5</button>
                                        <button type="button" class="adj-preset-chip" data-preset="0">0</button>
                                        <button type="button" class="adj-preset-chip" data-preset="2">+2</button>
                                        <button type="button" class="adj-preset-chip" data-preset="5">+5</button>
                                        <button type="button" class="adj-preset-chip" data-preset="10">+10</button>
                                    </div>
                                </div>

                                <div class="adj-cats">
                                    <label class="adj-cat-row adj-cat-all">
                                        <input type="checkbox" id="adjAllCategories">
                                        <span class="cat-custom-checkbox" aria-hidden="true"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
                                        <span class="cat-name" id="adjAllLabel">All categories</span>
                                        <span class="cat-count" id="adjCategoryTotal"></span>
                                    </label>
                                    <div class="category-search-box" id="categoryAdjustSearchBox" hidden>
                                        <svg class="cat-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                        <input type="search" id="categoryAdjustSearch" placeholder="Search categories…" autocomplete="off">
                                    </div>
                                    <div class="category-checkboxes-container" id="categoryCheckboxesList" role="group" aria-label="Categories to adjust"></div>
                                </div>

                                <div class="adjustment-actions">
                                    <span id="adjPreviewSummary" class="adj-preview-summary"></span>
                                    <button id="previewButton" type="submit" class="button primary btn-apply-adjustment">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                                        <span id="applyButtonText">Apply</span>
                                    </button>
                                </div>
                            </form>
                        </section>
                    </div>
                </div>
                <input id="fileInput" type="file" accept=".xlsx" hidden>

                <section id="emptyState" class="empty-state">
                    <div class="upload-icon-wrapper"><div class="upload-icon-glow"></div><div class="upload-icon">↗</div></div>
                    <h2 id="emptyStateTitle">Import your current price list</h2>
                    <p id="emptyStateText">Drop an official .xlsx workbook here or browse your computer. Download the template from the upload window.</p>
                    <button id="emptyUploadButton" class="button primary edit-only">Upload Excel file</button>
                    <button id="emptyBrowseListsButton" class="button secondary" type="button" hidden>Browse approved price lists</button>
                    <div class="empty-open-saved" id="emptyOpenSaved" hidden>
                        <span class="empty-open-label">or</span>
                        <div class="nav-cascade" data-cascade="empty" role="group" aria-label="Open saved price list">
                            <label class="filter-field cascade-country"><span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> Select from existing files</span><select class="nav-country" aria-label="Country"></select></label>
                            <span class="cascade-arrow" aria-hidden="true">›</span>
                            <label class="filter-field"><span>Price Level</span><select class="nav-level" aria-label="Price level"></select></label>
                            <span class="cascade-arrow" aria-hidden="true">›</span>
                            <label class="filter-field cascade-list"><span>Price List</span><select class="nav-list" aria-label="Price list"></select></label>
                        </div>
                    </div>
                </section>

                <section id="dataView" hidden>
                    <div class="data-panel full-table">
                    <div class="table-tools">
                        <div class="filter-group filter-group-wide">
                            <button type="button" id="listSwitcher" class="list-switcher" aria-haspopup="dialog" aria-expanded="false" aria-controls="listSwitcherMenu" title="Switch price list">
                                <svg class="ls-globe" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                                <span class="ls-country" id="lsCountry">—</span><span class="ls-sep" aria-hidden="true">›</span>
                                <span class="ls-level" id="lsLevel">—</span><span class="ls-sep" aria-hidden="true">›</span>
                                <span class="ls-list" id="lsList">—</span>
                                <svg class="ls-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
                            </button>
                            <span class="filter-sep" aria-hidden="true"></span>
                            <select id="categorySelect" class="sr-only" tabindex="-1" aria-hidden="true"></select>
                            <button type="button" id="categoryPicker" class="list-switcher category-picker" aria-haspopup="listbox" aria-expanded="false" aria-controls="categoryMenu" title="Filter by product category"><svg class="cp-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg><span class="cp-label" id="cpLabel">All categories</span><span class="cp-count" id="cpCount">0</span><svg class="ls-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg></button>
                            <label class="filter-field"><span>LRN</span><input id="codeFilterInput" type="search" placeholder="Code" autocomplete="off" list="codeFilterOptions"><datalist id="codeFilterOptions"></datalist></label>
                            <label class="search"><span>Search</span><svg class="search-icon" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><input id="searchInput" type="search" placeholder="Search descriptions, prices..."><kbd class="search-kbd">/</kbd></label>
                            <button type="button" id="clearFiltersBtn" class="text-button clear-filters-btn" hidden>Clear filters</button>
                        </div>
                        <div class="actions">
                            <span id="exportLockNote" class="export-lock-note" hidden></span>
                            <button id="editButton" class="button primary toolbar-action perm-update is-disabled" type="button" aria-expanded="false" aria-controls="adjustmentBar" aria-disabled="true"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg><span>Edit prices</span></button>
                            <button id="resetPricesButton" class="button secondary toolbar-action perm-update is-disabled" type="button" aria-disabled="true"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg><span>Reset prices</span></button>
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

            <section id="listsPanel" class="panel management-page" hidden>
                <div class="page-heading history-heading">
                    <div class="heading-left">
                        <p class="kicker history-kicker">APPROVAL WORKFLOW</p>
                        <h1 class="history-title">Approvals</h1>
                        <p class="muted history-subtitle" id="listsSubtitle">Review saved price changes and approval decisions.</p>
                    </div>
                </div>

                <div class="audit-tab-bar" role="tablist" aria-label="Price list views" id="listTabBar">
                    <button type="button" class="list-tab-btn audit-tab-btn active" data-list-tab="all" role="tab" aria-selected="true"><span>All</span><span id="listAllCount" class="audit-tab-count">0</span></button>
                    <button type="button" class="list-tab-btn audit-tab-btn perm-approve" data-list-tab="mine" role="tab" aria-selected="false" hidden><span>Awaiting my approval</span><span id="listMineCount" class="audit-tab-count">0</span></button>
                    <button type="button" class="list-tab-btn audit-tab-btn" data-list-tab="approved" role="tab" aria-selected="false"><span>Approved</span><span id="listApprovedCount" class="audit-tab-count">0</span></button>
                </div>

                <div class="history-card">
                    <div class="history-tools">
                        <div class="history-filter-group">
                            <div class="history-search-control">
                                <svg class="history-search-icon" aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                <input id="listSearchInput" type="search" placeholder="Search price lists..." autocomplete="off" aria-label="Search price lists">
                            </div>
                            <div class="history-select-control">
                                <select id="listPriceLevelFilter" aria-label="Filter by price level"><option value="">All price levels</option></select>
                                <svg class="history-chevron-icon" aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </div>
                            <div class="history-select-control">
                                <select id="listCountryFilter" aria-label="Filter by country"><option value="">All countries</option></select>
                                <svg class="history-chevron-icon" aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </div>
                            <div class="history-select-control perm-update" hidden>
                                <select id="listStatusFilter" aria-label="Filter by status">
                                    <option value="">All statuses</option>
                                    <option value="pending">Pending approval</option>
                                    <option value="approved">Approved</option>
                                    <option value="rejected">Rejected</option>
                                    <option value="superseded">Superseded</option>
                                </select>
                                <svg class="history-chevron-icon" aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </div>
                        </div>
                        <div class="history-tools-meta">
                            <span id="listCount" class="history-count">0 price lists</span>
                            <button type="button" id="refreshListsBtn" class="audit-refresh-btn" title="Refresh" aria-label="Refresh price lists">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                            </button>
                        </div>
                    </div>
                    <div class="history-table-frame">
                        <table id="listsTable" class="lists-table">
                            <thead>
                                <tr>
                                    <th style="width: 25%;">Price list</th>
                                    <th style="width: 11%;">Price level</th>
                                    <th style="width: 10%;">Country</th>
                                    <th style="width: 14%;">Saved</th>
                                    <th style="width: 13%;">Adjustment</th>
                                    <th style="width: 14%;">Status</th>
                                    <th style="width: 13%;" class="col-actions"><span class="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody id="listsTableBody"></tbody>
                        </table>
                        <div id="listsEmpty" class="history-empty-card" hidden>
                            <h2 id="listsEmptyTitle">No price lists yet</h2>
                            <p id="listsEmptyText">Saved price lists will appear here.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section id="filesPanel" class="panel management-page" hidden>
                <div class="page-heading history-heading">
                    <div class="heading-left">
                        <p class="kicker history-kicker">UPLOADED PRICE LISTS</p>
                        <h1 class="history-title">Files</h1>
                        <p class="muted history-subtitle">Original uploaded price lists. Review price changes in Approvals.</p>
                    </div>
                </div>
                <div class="audit-tab-bar file-controls" aria-label="File actions">
                    <button type="button" id="filesUploadBtn" class="button primary perm-upload" hidden>Upload files</button>
                </div>
                <div class="history-card">
                    <div class="history-tools">
                        <div class="history-filter-group">
                            <div class="history-search-control">
                                <svg class="history-search-icon" aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                <input id="filesSearchInput" type="search" placeholder="Search files..." autocomplete="off" aria-label="Search files">
                            </div>
                            <div class="history-select-control"><select id="filesCountryFilter" aria-label="Filter by country"><option value="">All countries</option></select><svg class="history-chevron-icon" aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></div>
                            <div class="history-select-control"><select id="filesLevelFilter" aria-label="Filter by price level"><option value="">All price levels</option></select><svg class="history-chevron-icon" aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></div>
                        </div>
                        <div class="history-tools-meta"><span id="filesCount" class="history-count">0 files</span></div>
                    </div>
                    <div class="history-table-frame">
                        <table id="filesTable" class="lists-table">
                            <thead>
                                <tr>
                                    <th style="width: 28%;">File</th>
                                    <th style="width: 13%;">Country</th>
                                    <th style="width: 12%;">Price level</th>
                                    <th style="width: 17%;">Uploaded</th>
                                    <th style="width: 17%;">Status</th>
                                    <th style="width: 13%;" class="col-actions"><span class="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody id="filesTableBody"></tbody>
                        </table>
                        <div id="filesEmpty" class="history-empty-card" hidden>
                            <h2>No uploaded files yet</h2>
                            <p id="filesEmptyText">Uploaded price lists will appear here.</p>
                        </div>
                    </div>
                </div>
            </section>
            <section id="historyPanel" class="panel management-page" hidden>
                <div class="page-heading history-heading">
                    <div class="heading-left">
                        <p class="kicker history-kicker">COMPLIANCE & AUDIT TRAIL</p>
                        <h1 class="history-title">Audit Logs</h1>
                        <p class="muted history-subtitle">Review uploads, price changes, approvals, and exports.</p>
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
                    <button type="button" class="audit-tab-btn" data-audit-tab="workflow" role="tab" aria-selected="false">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        <span>Saves, Approvals &amp; Exports</span>
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
                                    <option value="import_workbook">Uploads</option>
                                    <option value="price_adjust">Price Adjustments</option>
                                    <option value="cell_edit">Cell Edits</option>
                                    <option value="reset_prices">Price Resets</option>
                                    <option value="save_version">Saves</option>
                                    <option value="approve_version">Approvals</option>
                                    <option value="reject_version">Rejections</option>
                                    <option value="export_excel">Excel Exports</option>
                                    <option value="export_pdf">PDF Exports</option>
                                    <option value="delete_version">Deletions</option>
                                    <option value="image_update">Photo Changes</option>
                                    <option value="login">Sign-ins</option>
                                </select>
                                <svg class="history-chevron-icon" aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </div>
                            <div class="history-select-control" id="auditUserSelectWrapper">
                                <select id="auditUserSelect" aria-label="Filter by user">
                                    <option value="">All Users</option>
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
                                    <th style="width: 11%;">Time <span class="sort-arrow">↓</span></th>
                                    <th style="width: 14%;">User</th>
                                    <th style="width: 13%;">Event</th>
                                    <th style="width: 38%;">Activity</th>
                                    <th style="width: 13%;">Change</th>
                                    <th style="width: 11%;"><span class="sr-only">Action</span></th>
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

            <section id="settingsPanel" class="panel management-page" hidden>
                <div class="page-heading settings-heading">
                    <div class="heading-left">
                        <p class="kicker">Config</p>
                        <h1>Product photos</h1>
                        <p class="muted">Organize category folders and choose photos for each product type.</p>
                    </div>
                </div>

                <div class="audit-tab-bar" role="tablist" aria-label="Photo settings">
                    <button type="button" class="config-tab-btn audit-tab-btn active" data-config-tab="library" role="tab" aria-selected="true"><span>Photo library</span><span id="libraryCountBadge" class="audit-tab-count">0</span></button>
                    <button type="button" class="config-tab-btn audit-tab-btn" data-config-tab="types" role="tab" aria-selected="false"><span>Product type photos</span><span id="typesCountBadge" class="audit-tab-count">0</span></button>
                </div>

                <div class="image-settings-card library-workspace" id="libraryCard">
                    <aside class="library-sidebar" aria-label="Photo folders">
                        <div class="library-sidebar-heading"><h2>Folders</h2><button type="button" id="libraryNewFolder" class="library-new-folder" aria-label="Create category folder" title="New category folder" aria-expanded="false" aria-controls="libraryFolderForm">+</button></div>
                        <form id="libraryFolderForm" class="library-folder-form" hidden>
                            <label for="libraryFolderName">Category name</label>
                            <input id="libraryFolderName" name="category" type="text" maxlength="120" placeholder="e.g. Chocolates" required autocomplete="off">
                            <p id="libraryFolderError" class="library-folder-error" role="alert" hidden></p>
                            <div class="library-folder-form-actions"><button type="submit" class="button primary">Create</button><button type="button" id="libraryFolderCancel" class="button secondary">Cancel</button></div>
                        </form>
                        <nav id="libraryFolders" class="library-folders" aria-label="Browse category folders"></nav>
                        <p class="library-sidebar-note">Category folders also appear automatically from your price lists.</p>
                    </aside>
                    <section class="library-content" aria-labelledby="libraryFolderTitle">
                        <div class="library-content-heading">
                            <div><p class="kicker">Photo library</p><h2 id="libraryFolderTitle">All photos</h2><p id="libraryFolderDescription" class="muted">Browse your library or open a category folder.</p></div>
                            <div class="library-upload-controls">
                                <label class="library-upload-destination" for="libraryUploadFolder"><span>Upload to</span><select id="libraryUploadFolder" aria-label="Upload destination folder"></select></label>
                                <button type="button" id="libraryUploadButton" class="button primary" title="JPG, PNG or WebP · up to 6 MB each">Upload photos</button>
                                <span id="libraryUploadStatus" class="library-upload-status" role="status" aria-live="polite"></span>
                            </div>
                        </div>
                    <div class="image-settings-toolbar">
                        <label class="search settings-search"><span>Search photos</span><input id="librarySearchInput" type="search" placeholder="Search photos by name..."></label>
                        <span id="libraryCount" class="history-count"></span>
                    </div>
                    <div id="libraryGrid" class="library-grid" aria-live="polite"></div>
                    <div id="libraryEmpty" class="settings-empty" hidden><h2>The library is empty</h2><p>Upload product photos above. You can then pick them for any product type.</p></div>
                    </section>
                </div>

                <div class="image-settings-card" id="typesCard" hidden>
                    <div class="image-settings-toolbar">
                        <label class="select-control settings-category-control"><span>Category</span><select id="imageCategoryFilter" aria-label="Filter image settings by category"></select></label>
                        <label class="search settings-search"><span>Search product types</span><input id="imageSearchInput" type="search" placeholder="Search product types..."></label>
                        <span id="imageSettingsCount" class="history-count"></span>
                    </div>
                    <div id="imageSettingsList" class="image-settings-list" aria-live="polite"></div>
                    <div id="imageSettingsEmpty" class="settings-empty" hidden><h2>No product types available</h2><p>Open a price list first. Its categories and product groups will appear here.</p></div>
                </div>
                <input id="groupImageInput" type="file" accept="image/jpeg,image/png,image/webp" hidden>
                <input id="libraryFileInput" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden>
            </section>
        </main>
    </div>
</div>

<dialog id="uploadModal" class="upload-modal-dialog" aria-labelledby="uploadModalTitle" aria-describedby="uploadModalDescription">
    <div class="dialog-card upload-modal-card">
        <header class="dialog-heading upload-heading">
            <div>
                <h2 id="uploadModalTitle" tabindex="-1">Upload price lists</h2>
                <p id="uploadModalDescription">Choose your workbook. We’ll validate it before saving.</p>
            </div>
            <button id="closeUploadModalBtn" type="button" class="icon-button" aria-label="Close upload window">×</button>
        </header>

        <div id="uploadMainView" class="upload-step upload-main-view">
            <div class="upload-template-tools">
                <span>Use the official workbook</span>
                <div class="upload-help-actions">
                    <button type="button" id="downloadTemplateBtn" class="upload-text-button">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/></svg>
                        Download template
                    </button>
                    <button type="button" id="uploadTemplateRulesBtn" class="upload-text-button" aria-controls="uploadGuideView">
                        Template rules <span aria-hidden="true">↗</span>
                    </button>
                </div>
            </div>

            <div id="modalDropZone" class="modal-drop-zone" role="group" aria-label="Choose or drop Excel workbooks">
                <input id="modalFileInput" type="file" accept=".xlsx" multiple hidden>
                <div class="drop-zone-content">
                    <svg class="drop-zone-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6m-3 3 3-3 3 3"/></svg>
                    <div class="drop-zone-text">
                        <strong id="dropZonePrompt">Drop your workbook here</strong>
                        <small>.xlsx only · 10 MB per file · up to 5 files</small>
                    </div>
                    <button type="button" id="browseFileBtn" class="button secondary upload-browse-button" autofocus>Browse files</button>
                </div>
            </div>

            <div id="uploadValidationErrors" class="upload-validation-errors" role="alert" hidden></div>

            <section id="stagedFilesPanel" class="staged-files" aria-label="Selected workbooks" hidden>
                <div class="staged-apply-all">
                    <span class="staged-apply-label">Set all files</span>
                    <select id="applyAllCountry" aria-label="Country for all files"><option value="">Country…</option></select>
                    <select id="applyAllPriceLevel" aria-label="Price level for all files"><option value="">Price level…</option></select>
                    <button type="button" id="applyAllBtn" class="button secondary">Apply</button>
                </div>
                <div class="staged-table" role="table" aria-label="Files to upload">
                    <div class="staged-row staged-head" role="row">
                        <span role="columnheader">Workbook</span>
                        <span role="columnheader">List name</span>
                        <span role="columnheader">Country</span>
                        <span role="columnheader">Price level</span>
                        <span role="columnheader"><span class="sr-only">Remove</span></span>
                    </div>
                    <div id="stagedFilesList"></div>
                </div>
                <p id="stagedFilesHint" class="upload-meta-hint"></p>
            </section>
        </div>

        <section id="uploadGuideView" class="upload-step upload-guide-view" hidden aria-label="Official template requirements">
            <div class="template-guide-intro">
                <span id="templateVersionLabel" class="template-version">PLA-2</span>
                <p>You don’t need every category. Keep the complete template headers on every sheet you include.</p>
            </div>
            <div class="template-layout-tabs" role="tablist" aria-label="Worksheet layout">
                <button type="button" id="templateStandardTab" role="tab" class="template-layout-tab" data-template-layout="standard" aria-selected="true" aria-controls="templateLayout-standard">Standard products</button>
                <button type="button" id="templatePresentationTab" role="tab" class="template-layout-tab" data-template-layout="presentation" aria-selected="false" aria-controls="templateLayout-presentation" tabindex="-1">Presentation Stands</button>
            </div>
            <div class="template-guide-content">
                <section class="template-workbook-rules" aria-labelledby="templateWorkbookRulesTitle">
                    <h3 id="templateWorkbookRulesTitle">Before you upload</h3>
                    <ul>
                        <li><strong>Use the official .xlsx</strong><span id="templateFileLimits">10 MB maximum · 15,000 products</span></li>
                        <li><strong>Keep the Instructions sheet</strong><span>Use the current version without changing its contents.</span></li>
                        <li><strong>Include at least one product</strong><span>Replace or delete the sample rows. Enter values, not formulas.</span></li>
                    </ul>
                </section>
                <div class="template-guide-workspace">
                    <div id="templateLayouts"></div>
                    <aside class="template-validity" aria-labelledby="templateValidityTitle">
                        <h3 id="templateValidityTitle">Presentation Stands rules</h3>
                        <p class="template-validity-summary">The sheet is optional. Its headers are not.</p>
                        <section class="template-validity-group is-accepted" aria-labelledby="templateAcceptedTitle">
                            <h4 id="templateAcceptedTitle"><span aria-hidden="true">✓</span> Accepted</h4>
                            <ul>
                                <li><strong>No Stands sheet</strong><span>Another category has at least one valid product.</span></li>
                                <li><strong>All headers, no stand products</strong><span>Keep the headers and remove the sample rows. Another category must contain products.</span></li>
                                <li><strong>Only some stand products</strong><span>Any number is fine. Every listed stand must have its required values.</span></li>
                            </ul>
                        </section>
                        <section class="template-validity-group is-rejected" aria-labelledby="templateRejectedTitle">
                            <h4 id="templateRejectedTitle"><span aria-hidden="true">×</span> Rejected</h4>
                            <ul>
                                <li><strong>Missing or changed headers</strong><span>Don’t add, remove, rename, reorder or move columns—even optional-value columns.</span></li>
                                <li><strong>An incomplete product row</strong><span>A required value is blank or invalid.</span></li>
                                <li><strong>A completely blank Stands sheet</strong><span>Delete the unused sheet, or restore its complete headers.</span></li>
                            </ul>
                        </section>
                    </aside>
                </div>
                <div class="template-validation-outcome" role="note">
                    <strong>One invalid sheet rejects the whole workbook.</strong>
                    <span>Nothing from that workbook is saved. The error explains what to fix; product-row errors include the sheet and cell.</span>
                </div>
                <div class="template-guide-notes">
                    <p><strong>Approved categories:</strong> <span id="templateCategoryNames"></span>. Don’t add other sheets. Macros, hyperlinks, external links and hidden sheets are not accepted.</p>
                </div>
            </div>
        </section>

        <footer class="upload-footer">
            <div id="uploadMainActions" class="upload-footer-actions">
                <span class="upload-footer-note">Nothing is saved until validation passes.</span>
                <div class="dialog-actions">
                    <button id="cancelUploadBtn" type="button" class="button secondary">Cancel</button>
                    <button id="submitUploadBtn" type="button" class="button primary" disabled>Upload &amp; open</button>
                </div>
            </div>
            <div id="uploadGuideActions" class="upload-footer-actions" hidden>
                <button id="uploadGuideBackBtn" type="button" class="upload-text-button"><span aria-hidden="true">←</span> Back to upload</button>
                <button id="guideDownloadTemplateBtn" type="button" class="button secondary">Download template</button>
            </div>
        </footer>
        <datalist id="priceLevelOptions"></datalist>
        <datalist id="countryOptions"></datalist>
    </div>
</dialog>


<dialog id="saveDialog">
    <form method="dialog" class="dialog-card save-version-dialog" id="saveForm">
        <div class="dialog-heading"><div><p class="kicker">Review before saving</p><h2>Review and save price list</h2></div><button value="cancel" class="icon-button" aria-label="Close">×</button></div>
        <p class="muted">Check the adjustments and edits below. Saving sends this price list for approval. It can be exported once it is approved.</p>
        <div id="saveChangeSummary" class="save-change-summary" aria-label="Price adjustment summary"></div>
        <div id="saveEditsSummary" class="save-edits-summary" hidden></div>
        <label>Price list name<input id="versionNameInput" type="text" maxlength="160" placeholder="e.g. LRN Export PL - FOB Subic" required></label>
        <div class="save-meta-readonly" id="saveMetaReadonly">
            <span class="list-tag"><small>Price level</small><strong id="saveMetaPriceLevel">—</strong></span>
            <span class="list-tag"><small>Country</small><strong id="saveMetaCountry">—</strong></span>
            <button type="button" class="text-button" id="editSaveMetaBtn">Edit</button>
        </div>
        <div class="upload-meta-grid" id="saveMetaEdit" hidden>
            <label class="form-field">Price level<select id="savePriceLevel" required></select></label>
            <label class="form-field">Country<select id="saveCountry" required></select></label>
        </div>
        <p id="saveApproversNote" class="save-approvers-note"></p>
        <label class="confirm-check"><input type="checkbox" id="saveConfirmCheck"> I have reviewed the prices and confirm they are correct.</label>
        <div class="dialog-actions"><button value="cancel" class="button secondary">Cancel</button><button id="confirmSave" value="default" class="button primary" disabled>Save &amp; submit for approval</button></div>
    </form>
</dialog>

<dialog id="approveDialog">
    <form method="dialog" class="dialog-card" id="approveForm">
        <div class="dialog-heading"><div><p class="kicker">Approval</p><h2 id="approveDialogTitle">Approve price list?</h2></div><button value="cancel" class="icon-button" aria-label="Close">×</button></div>
        <p class="muted" id="approveDialogText">Once approved, this price list becomes available for export.</p>
        <div id="approveDialogSummary" class="save-change-summary"></div>
        <label>Remarks <small class="muted">(optional)</small><textarea id="approveRemarks" maxlength="500" rows="3"></textarea></label>
        <div class="dialog-actions"><button value="cancel" class="button secondary">Cancel</button><button id="confirmApprove" value="default" class="button primary">Approve</button></div>
    </form>
</dialog>

<dialog id="rejectDialog">
    <form method="dialog" class="dialog-card" id="rejectForm">
        <div class="dialog-heading"><div><p class="kicker">Approval</p><h2 id="rejectDialogTitle">Reject price list?</h2></div><button value="cancel" class="icon-button" aria-label="Close">×</button></div>
        <p class="muted">The person who saved it will be notified with your reason so they can correct and resubmit it.</p>
        <label>Reason for rejection<textarea id="rejectRemarks" maxlength="500" rows="3" required></textarea></label>
        <div class="dialog-actions"><button value="cancel" class="button secondary">Cancel</button><button id="confirmReject" value="default" class="button danger">Reject</button></div>
    </form>
</dialog>

<dialog id="photoPickerDialog" class="photo-picker-dialog">
    <div class="dialog-card photo-picker-card">
        <div class="dialog-heading">
            <div><p class="kicker">Photo library</p><h2 id="photoPickerTitle">Choose a photo</h2></div>
            <button type="button" class="icon-button" id="photoPickerClose" aria-label="Close">×</button>
        </div>
        <div class="photo-picker-tools">
            <label class="photo-picker-folder"><span>Folder</span><select id="photoPickerFolder" aria-label="Browse photo folder"></select></label>
            <label class="search"><span class="sr-only">Search photos</span><input id="photoPickerSearch" type="search" placeholder="Search photos..." autocomplete="off"></label>
            <button type="button" id="photoPickerUpload" class="button secondary">+ Upload new photos</button>
        </div>
        <div class="photo-picker-context"><span id="photoPickerFolderSummary"></span><span id="photoPickerStatus" role="status" aria-live="polite"></span></div>
        <div id="photoPickerGrid" class="library-grid picker-grid" role="listbox" aria-label="Library photos"></div>
        <div id="photoPickerEmpty" class="settings-empty" hidden><h2>No photos yet</h2><p>Use “Upload new photos” to add some to the library.</p></div>
        <div class="dialog-actions">
            <button type="button" id="photoPickerRemove" class="button danger picker-remove" hidden>Remove current photo</button>
            <button type="button" id="photoPickerCancel" class="button secondary">Cancel</button>
            <button type="button" id="photoPickerConfirm" class="button primary" disabled>Use this photo</button>
        </div>
    </div>
</dialog>

<dialog id="confirmDialog">
    <form method="dialog" class="dialog-card confirm-dialog" id="confirmDialogForm">
        <div class="dialog-heading">
            <div><p class="kicker" id="confirmDialogKicker">Unsaved changes</p><h2 id="confirmDialogTitle">Discard unsaved changes?</h2></div>
            <button value="cancel" class="icon-button" aria-label="Close">×</button>
        </div>
        <p class="muted" id="confirmDialogText"></p>
        <div class="dialog-actions">
            <button value="cancel" class="button secondary" id="confirmDialogCancel">Keep editing</button>
            <button value="confirm" class="button danger" id="confirmDialogOk">Discard changes</button>
        </div>
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
        <div class="dialog-heading"><div><p class="kicker">Remove photo</p><h2>Remove custom photo?</h2></div><button value="cancel" class="icon-button" aria-label="Close">&times;</button></div>
        <p>The custom photo for <strong id="deleteImageName"></strong> will be removed.</p>
        <div class="dialog-actions"><button value="cancel" class="button secondary">Cancel</button><button id="confirmDeleteImage" value="default" class="button danger">Remove photo</button></div>
    </form>
</dialog>

<div id="devTools" class="dev-tools" hidden>
    <button type="button" id="devToolsToggle" class="dev-tools-toggle" aria-expanded="false" aria-controls="devToolsPanel" title="Developer tools">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        <span>Dev tools</span>
    </button>
    <section id="devToolsPanel" class="dev-tools-panel" role="dialog" aria-labelledby="devToolsTitle" hidden>
        <header class="dev-tools-head">
            <div><strong id="devToolsTitle">Clear test data</strong><small>For testing only. Turn off before go-live in config.local.php:<br><code>'dev_tools' =&gt; false</code></small></div>
            <button type="button" id="devToolsClose" class="icon-button" aria-label="Close developer tools">×</button>
        </header>
        <div class="dev-tools-options">
            <label><input type="checkbox" value="draft" checked><span><strong>Uploaded file / draft</strong><small>Unsaved file open in this browser</small></span></label>
            <label><input type="checkbox" value="versions" checked><span><strong>Saved price lists</strong><small id="devCountVersions">All versions, pending and approved</small></span></label>
            <label><input type="checkbox" value="notifications" checked><span><strong>Notifications</strong><small>For every user</small></span></label>
            <label><input type="checkbox" value="audit"><span><strong>Audit logs</strong><small id="devCountAudit">Every recorded event</small></span></label>
            <label><input type="checkbox" value="images"><span><strong>Product photos</strong><small>Uploaded group images</small></span></label>
        </div>
        <button type="button" id="devToolsClear" class="button danger dev-tools-clear">Clear selected</button>
    </section>
</div>
<div id="listSwitcherMenu" class="list-switcher-menu" role="dialog" aria-label="Switch price list" hidden>
    <div class="lsm-search"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="search" id="lsmSearch" placeholder="Search country or price list…" autocomplete="off" aria-label="Search country or price list"></div>
    <div class="lsm-columns">
        <div class="lsm-col"><p class="lsm-heading">Country</p><div id="lsmCountries" role="listbox" aria-label="Countries"></div></div>
        <div class="lsm-col"><p class="lsm-heading">Price level</p><div id="lsmLevels" role="listbox" aria-label="Price levels"></div></div>
        <div class="lsm-col lsm-col-lists"><p class="lsm-heading">Price list</p><div id="lsmLists" role="listbox" aria-label="Price lists"></div></div>
    </div>
</div>
<div id="categoryMenu" class="list-switcher-menu category-menu" role="dialog" aria-label="Product category" hidden>
    <div class="lsm-search" id="categoryMenuSearchWrap"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="search" id="categoryMenuSearch" placeholder="Search categories…" autocomplete="off" aria-label="Search categories"></div>
    <p class="lsm-heading">Product category</p>
    <div id="categoryMenuList" class="cm-list" role="listbox" aria-label="Product categories"></div>
</div>
<div id="rowMenu" class="row-menu" role="menu" hidden></div>
<div id="toast" class="toast" role="status" aria-live="polite"></div>
<script>window.__BOOT__ = <?= json_encode(['user' => $user, 'csrf' => csrfToken()], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;</script>
<script src="../assets/vendor/xlsx.full.min.js"></script>
<script src="../assets/vendor/jspdf.umd.min.js"></script>
<script src="../assets/vendor/jspdf.plugin.autotable.min.js"></script>
<script src="../scripts/theme.js?v=4"></script>
<script src="../scripts/app.js?v=80"></script>
<script src="../assets/vendor/gsap.min.js"></script>
<script src="../scripts/motion.js?v=4"></script>
<script src="../scripts/select-dropdown.js?v=2"></script>
</body>
</html>
