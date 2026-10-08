(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { user: window.__BOOT__.user, csrf: window.__BOOT__.csrf, permissions: [], canEdit: false, active: null, rows: [], headers: [], priceColumns: [], adjustment: 0, categoryAdjustments: {}, search: '', category: '', codeFilter: '', priceLevelFilter: '', countryFilter: '', pending: null, pendingDelete: null, pendingDecision: null, versions: [], directory: [], approvers: [], approvalMode: 'any', notifications: [], unreadCount: 0, productImages: [], imageCategory: '', imageSearch: '', pendingImageGroup: null, pendingImageDelete: null, activeCell: { rowIdx: null, colIdx: null, td: null }, isEditing: false, auditLogs: [], auditTab: 'all', auditSearch: '', auditFile: '', auditType: '', auditUser: '', auditPage: 1, historyPage: 1, historyPageSize: 10, listTab: 'all', listSearch: '', listPriceLevel: '', listCountry: '', listStatus: '', photoLibrary: [], photoFolders: [], libraryFolder: null, configTab: 'library', librarySearch: '' };
  // Normalised row layout (see parseWorkbook): 0 category … 18 product group, 19 price level, 20 country.
  const COL = { category: 0, code: 1, description: 2, priceLevel: 19, country: 20 };
  const ROW_WIDTH = 21;
  const can = permission => (state.permissions || []).includes(permission);
  // The chosen category survives a page refresh (sessionStorage), but a fresh login, new upload or closed file starts on "All categories".
  const CATEGORY_KEY = 'pla_view_category';
  function rememberCategory(category) {
    try { category ? sessionStorage.setItem(CATEGORY_KEY, category) : sessionStorage.removeItem(CATEGORY_KEY); } catch { }
  }
  function rememberedCategory() {
    try { return sessionStorage.getItem(CATEGORY_KEY) || ''; } catch { return ''; }
  }
  const money = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  let suppressRowEnter = false; // set while a price roll re-renders the table (see rollPrices)
  const dom = {
    appView: $('#appView'), userName: $('#userName'), roleBadge: $('#roleBadge'), emptyState: $('#emptyState'), dataView: $('#dataView'), listTitle: $('#listTitle'), listMeta: $('#listMeta'), savedMeta: $('#savedMeta'), savedMetaRow: $('#savedMetaRow'), activeBadge: $('#activeBadge'), productCount: $('#productCount'), categoryCount: $('#categoryCount'), priceColumnCount: $('#priceColumnCount'), currentAdjustment: $('#currentAdjustment'), percentage: $('#percentage'), applyAllCategoriesButton: $('#applyAllCategoriesButton'), search: $('#searchInput'), category: $('#categorySelect'), table: $('#priceTable'), noResults: $('#noResults'), saveDialog: $('#saveDialog'), saveForm: $('#saveForm'), versionNameInput: $('#versionNameInput'), deleteDialog: $('#deleteDialog'), deleteVersionName: $('#deleteVersionName'), resetPricesDialog: $('#resetPricesDialog'), resetPricesForm: $('#resetPricesForm'), confirmResetPrices: $('#confirmResetPrices'), resetPricesButton: $('#resetPricesButton'), logoutDialog: $('#logoutDialog'), logoutForm: $('#logoutForm'), historyTable: $('#historyTable'), historyTableBody: $('#historyTableBody'), historyEmpty: $('#historyEmpty'), historyCount: $('#historyCount'), historySearchInput: $('#historySearchInput'), historyAdjustmentSelect: $('#historyAdjustmentSelect'), emptyGoToPricesBtn: $('#emptyGoToPricesBtn'), toast: $('#toast'), fileInput: $('#fileInput'), settingsNav: $('#settingsNav'), settingsPanel: $('#settingsPanel'), imageCategoryFilter: $('#imageCategoryFilter'), imageSearchInput: $('#imageSearchInput'), imageSettingsList: $('#imageSettingsList'), imageSettingsEmpty: $('#imageSettingsEmpty'), imageSettingsCount: $('#imageSettingsCount'), groupImageInput: $('#groupImageInput'), deleteImageDialog: $('#deleteImageDialog'), deleteImageForm: $('#deleteImageForm'), deleteImageName: $('#deleteImageName'), addRowBtn: $('#addRowBtn'), excelFormulaBar: $('#excelFormulaBar'), formulaCellIndicator: $('#formulaCellIndicator'), formulaInput: $('#formulaInput'), formulaCancelBtn: $('#formulaCancelBtn'), formulaConfirmBtn: $('#formulaConfirmBtn'), deleteRowDialog: $('#deleteRowDialog'), deleteRowForm: $('#deleteRowForm'), deleteRowProductName: $('#deleteRowProductName'), confirmDeleteRow: $('#confirmDeleteRow'),
    auditLogsNav: $('#auditLogsNav'), openAuditLogsFromBell: $('#openAuditLogsFromBell'), auditAllCountBadge: $('#auditAllCountBadge'), auditEditsCountBadge: $('#auditEditsCountBadge'), auditVersionsCountBadge: $('#auditVersionsCountBadge'), auditFileSelect: $('#auditFileSelect'), auditFileSelectWrapper: $('#auditFileSelectWrapper'), auditTypeSelect: $('#auditTypeSelect'), auditTypeSelectWrapper: $('#auditTypeSelectWrapper'), auditUserSelect: $('#auditUserSelect'), auditUserSelectWrapper: $('#auditUserSelectWrapper'), historyAdjustmentSelectWrapper: $('#historyAdjustmentSelectWrapper'), refreshAuditLogsBtn: $('#refreshAuditLogsBtn'), auditTableHead: $('#auditTableHead'), versionsTableHead: $('#versionsTableHead'), historyEmptyTitle: $('#historyEmptyTitle'), historyEmptySubtitle: $('#historyEmptySubtitle'), historyChangesKicker: $('#historyChangesKicker'), historyChangesActions: $('#historyChangesActions'),
    notificationBtn: $('#notificationBtn'), notificationBadge: $('#notificationBadge'), notificationsDropdown: $('#notificationsDropdown'), notificationsList: $('#notificationsList'), notificationsEmpty: $('#notificationsEmpty'), notificationsCountBadge: $('#notificationsCountBadge'), markAllReadBtn: $('#markAllReadBtn'), clearLogsBtn: $('#clearLogsBtn'),
    uploadModal: $('#uploadModal'), closeUploadModalBtn: $('#closeUploadModalBtn'), cancelUploadBtn: $('#cancelUploadBtn'), submitUploadBtn: $('#submitUploadBtn'), downloadTemplateBtn: $('#downloadTemplateBtn'), modalDropZone: $('#modalDropZone'), modalFileInput: $('#modalFileInput'), browseFileBtn: $('#browseFileBtn'), dropZonePrompt: $('#dropZonePrompt'), selectedFileInfo: $('#selectedFileInfo'), selectedFileName: $('#selectedFileName'), selectedFileSize: $('#selectedFileSize'), removeSelectedFileBtn: $('#removeSelectedFileBtn'),
    codeFilterInput: $('#codeFilterInput'), codeFilterOptions: $('#codeFilterOptions'), priceLevelSelect: $('#priceLevelSelect'), countrySelect: $('#countrySelect'), clearFiltersBtn: $('#clearFiltersBtn'), exportLockNote: $('#exportLockNote'),
    listTagsRow: $('#listTagsRow'), listPriceLevel: $('#listPriceLevel'), listCountry: $('#listCountry'), listRevisionTag: $('#listRevisionTag'), listRevision: $('#listRevision'),
    approvalBanner: $('#approvalBanner'), approvalBannerIcon: $('#approvalBannerIcon'), approvalBannerTitle: $('#approvalBannerTitle'), approvalBannerText: $('#approvalBannerText'), bannerApproveBtn: $('#bannerApproveBtn'), bannerRejectBtn: $('#bannerRejectBtn'),
    emptyStateTitle: $('#emptyStateTitle'), emptyStateText: $('#emptyStateText'), emptyBrowseListsButton: $('#emptyBrowseListsButton'),
    uploadPriceLevel: $('#uploadPriceLevel'), uploadCountry: $('#uploadCountry'), priceLevelOptions: $('#priceLevelOptions'), countryOptions: $('#countryOptions'),
    savePriceLevel: $('#savePriceLevel'), saveCountry: $('#saveCountry'), saveApproversNote: $('#saveApproversNote'), saveConfirmCheck: $('#saveConfirmCheck'), saveEditsSummary: $('#saveEditsSummary'), confirmSave: $('#confirmSave'),
    approveDialog: $('#approveDialog'), approveForm: $('#approveForm'), approveDialogTitle: $('#approveDialogTitle'), approveDialogText: $('#approveDialogText'), approveDialogSummary: $('#approveDialogSummary'), approveRemarks: $('#approveRemarks'),
    rejectDialog: $('#rejectDialog'), rejectForm: $('#rejectForm'), rejectDialogTitle: $('#rejectDialogTitle'), rejectRemarks: $('#rejectRemarks'),
    listsTableBody: $('#listsTableBody'), listsEmpty: $('#listsEmpty'), listsEmptyTitle: $('#listsEmptyTitle'), listsEmptyText: $('#listsEmptyText'), listCount: $('#listCount'), listSearchInput: $('#listSearchInput'), listPriceLevelFilter: $('#listPriceLevelFilter'), listCountryFilter: $('#listCountryFilter'), listStatusFilter: $('#listStatusFilter'), listAllCount: $('#listAllCount'), listMineCount: $('#listMineCount'), listApprovedCount: $('#listApprovedCount'), pendingApprovalCount: $('#pendingApprovalCount'), listsSubtitle: $('#listsSubtitle'),
    categoryCheckboxesList: $('#categoryCheckboxesList'), categoryAdjustSearch: $('#categoryAdjustSearch'), categoryAdjustSearchBox: $('#categoryAdjustSearchBox'), adjAllCategories: $('#adjAllCategories'), adjAllLabel: $('#adjAllLabel'), adjCategoryTotal: $('#adjCategoryTotal'), applyButtonText: $('#applyButtonText'), adjPreviewSummary: $('#adjPreviewSummary'), closeAdjustmentBarBtn: $('#closeAdjustmentBarBtn')
  };

  const selectedAdjustmentCategories = new Set();

  /** In-app replacement for window.confirm(); resolves true only when the confirm button is chosen. */
  function confirmModal({ kicker = 'Please confirm', title, text, confirmLabel = 'Continue', cancelLabel = 'Cancel', danger = true }) {
    const dialog = $('#confirmDialog');
    if (!dialog) return Promise.resolve(window.confirm(text));
    $('#confirmDialogKicker').textContent = kicker;
    $('#confirmDialogTitle').textContent = title;
    $('#confirmDialogText').textContent = text;
    $('#confirmDialogCancel').textContent = cancelLabel;
    const ok = $('#confirmDialogOk');
    ok.textContent = confirmLabel;
    ok.className = `button ${danger ? 'danger' : 'primary'}`;
    dialog.returnValue = '';
    return new Promise(resolve => {
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
      dialog.showModal();
      requestAnimationFrame(() => $('#confirmDialogCancel').focus());
    });
  }
  function confirmDiscardDraft(action) {
    return confirmModal({
      kicker: 'Unsaved changes',
      title: 'Discard unsaved changes?',
      text: `You have unsaved changes in the editor. ${action} will discard them. Save first if you want to keep them.`,
      confirmLabel: 'Discard changes',
      cancelLabel: 'Keep editing'
    });
  }

  function getPriceCategories() {
    const map = new Map();
    state.rows.forEach(row => {
      const cat = String(row[0] ?? '').trim();
      if (cat) {
        map.set(cat, (map.get(cat) || 0) + 1);
      }
    });
    return [...map.entries()].map(([name, count]) => ({
      name,
      count,
      adjustment: getCategoryAdjustment(name)
    })).sort((a, b) => a.name.localeCompare(b.name));
  }

  function updateAdjustmentUI() {
    const categories = getPriceCategories();
    const totalCategories = categories.length;
    const selectedCount = selectedAdjustmentCategories.size;
    const rawVal = String(dom.percentage?.value ?? '').trim();
    const pct = Number(rawVal);
    const isValidPct = rawVal !== '' && Number.isFinite(pct) && pct >= -100 && pct <= 10000;
    const sign = pct > 0 ? '+' : '';

    let affectedProducts = 0;
    categories.forEach(c => {
      if (selectedAdjustmentCategories.has(c.name)) affectedProducts += c.count;
    });

    // The "All" checkbox covers whatever the list shows: every category, or the search matches.
    if (dom.adjAllCategories) {
      const listed = listedAdjustmentCategories();
      const listedChecked = listed.filter(c => selectedAdjustmentCategories.has(c.name)).length;
      dom.adjAllCategories.checked = listed.length > 0 && listedChecked === listed.length;
      dom.adjAllCategories.indeterminate = listedChecked > 0 && listedChecked < listed.length;
      dom.adjAllCategories.disabled = !listed.length;
      if (dom.adjAllLabel) dom.adjAllLabel.textContent = adjustmentSearchQuery() ? 'All matches' : 'All categories';
    }

    dom.percentage?.closest('.percentage-input')?.setAttribute('data-sign', isValidPct && pct > 0 ? 'pos' : isValidPct && pct < 0 ? 'neg' : 'zero');
    $$('.adj-preset-chip').forEach(chip => {
      const presetVal = Number(chip.dataset.preset);
      chip.classList.toggle('active', isValidPct && pct === presetVal);
    });

    const btn = $('#previewButton');
    const btnText = $('#applyButtonText');
    const summary = $('#adjPreviewSummary');
    const canApply = selectedCount > 0 && isValidPct;
    if (btn) {
      btn.disabled = !canApply;
      btn.classList.toggle('is-disabled', !canApply);
    }
    if (btnText) btnText.textContent = canApply ? `Apply ${sign}${pct}%` : 'Apply';
    if (summary) {
      const products = `${affectedProducts.toLocaleString()} ${affectedProducts === 1 ? 'product' : 'products'}`;
      const scope = selectedCount === 1 ? [...selectedAdjustmentCategories][0]
        : selectedCount === totalCategories ? `All ${totalCategories} categories`
        : `${selectedCount} categories`;
      summary.textContent = selectedCount ? `${scope} · ${products}` : 'No categories selected';
      summary.title = summary.textContent;
    }
  }

  // The category search only shows once the list is long enough to scroll.
  const ADJUST_SEARCH_MIN_CATEGORIES = 8;
  function adjustmentSearchQuery() {
    return dom.categoryAdjustSearchBox?.hidden ? '' : String(dom.categoryAdjustSearch?.value || '').trim().toLowerCase();
  }
  function listedAdjustmentCategories() {
    const query = adjustmentSearchQuery();
    return getPriceCategories().filter(c => !query || c.name.toLowerCase().includes(query));
  }

  function renderCategoryAdjustmentList() {
    if (!dom.categoryCheckboxesList) return;
    const categories = getPriceCategories();
    if (dom.categoryAdjustSearchBox) dom.categoryAdjustSearchBox.hidden = categories.length < ADJUST_SEARCH_MIN_CATEGORIES;
    const filtered = listedAdjustmentCategories();
    const listedItems = filtered.reduce((sum, c) => sum + c.count, 0);
    if (dom.adjCategoryTotal) dom.adjCategoryTotal.textContent = categories.length ? `${listedItems} ${listedItems === 1 ? 'item' : 'items'}` : '';

    if (!categories.length) {
      dom.categoryCheckboxesList.innerHTML = '<div class="category-checkboxes-empty">No categories in this price list.</div>';
    } else if (!filtered.length) {
      dom.categoryCheckboxesList.innerHTML = `<div class="category-checkboxes-empty">No categories match "${escapeHtml(dom.categoryAdjustSearch.value.trim())}"</div>`;
    } else {
      dom.categoryCheckboxesList.innerHTML = filtered.map(cat => {
        const isChecked = selectedAdjustmentCategories.has(cat.name);
        const num = Number(cat.adjustment || 0);
        const sign = num > 0 ? '+' : '';
        // Only categories that already carry an adjustment get a pill, so the list stays quiet.
        const pill = num ? `<span class="cat-adj-pill ${num > 0 ? 'pos' : 'neg'}" title="Currently ${sign}${num}%">${sign}${num}%</span>` : '';
        return `
          <label class="adj-cat-row ${isChecked ? 'checked' : ''}" data-category="${escapeHtml(cat.name)}">
            <input type="checkbox" class="category-adjust-checkbox" value="${escapeHtml(cat.name)}" ${isChecked ? 'checked' : ''}>
            <span class="cat-custom-checkbox" aria-hidden="true"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
            <span class="cat-name" title="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</span>
            ${pill}
            <span class="cat-count">${cat.count} ${cat.count === 1 ? 'item' : 'items'}</span>
          </label>`;
      }).join('');
    }

    updateAdjustmentUI();
  }

  // Each action is its own endpoint under api/ (paths are relative to the page files in pages/).
  const API_ROUTES = {
    'state': 'app/state',
    'open': 'versions/open', 'save': 'versions/save', 'approve': 'versions/approve', 'reject': 'versions/reject',
    'export': 'versions/export', 'delete-version': 'versions/delete',
    'audit-logs': 'audit/list', 'log-activity': 'audit/log_activity',
    'notifications': 'notifications/list', 'notifications-read': 'notifications/mark_read',
    'library-upload': 'photos/library_upload', 'library-delete': 'photos/library_delete',
    'library-folder': 'photos/library_folder', 'library-move': 'photos/library_move',
    'assign-group-image': 'photos/assign_group_image', 'upload-group-image': 'photos/upload_group_image', 'delete-group-image': 'photos/delete_group_image',
    'dev-reset': 'dev/reset'
  };
  async function api(action, options = {}) {
    const route = API_ROUTES[action];
    if (!route) throw new Error(`Unknown action: ${action}`);
    const response = await fetch(`../api/${route}.php`, { headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': state.csrf || '' }, ...options });
    if (response.status === 401) {
      window.location.href = 'login.php';
      throw new Error('Please sign in again.');
    }
    const data = await response.json().catch(() => ({ ok: false, message: 'Invalid server response.' }));
    if (!response.ok || !data.ok) throw new Error(data.message || 'Request failed.');
    return data;
  }
  /** Stored file paths (storage/…) are relative to the project root; this page lives in pages/. */
  function mediaUrl(path) {
    const value = String(path || '');
    return !value || /^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(value) ? value : `../${value}`;
  }
  function toast(message) { dom.toast.textContent = message; dom.toast.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => dom.toast.classList.remove('show'), 2600); }
  function escapeHtml(value) { const node = document.createElement('div'); node.textContent = String(value ?? ''); return node.innerHTML; }
  function displayDate(value) { if (!value) return 'Not saved'; return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  function getCategoryAdjustment(category) {
    const cat = String(category ?? '').trim();
    if (cat && state.categoryAdjustments && state.categoryAdjustments[cat] !== undefined) {
      return Number(state.categoryAdjustments[cat]);
    }
    return Number(state.adjustment || 0);
  }
  function adjusted(value, category = state.category) {
    const rawNum = typeof value === 'number' ? value : Number(String(value ?? '').replace(/,/g, '').trim());
    if (!Number.isFinite(rawNum)) return value;
    const adj = getCategoryAdjustment(category);
    if (!adj || !Number.isFinite(adj)) return rawNum;
    const computed = rawNum * (1 + adj / 100);
    return Math.max(0, Math.round(computed * 10000) / 10000);
  }
  function isNumeric(value) { return value !== '' && value !== null && Number.isFinite(Number(String(value).replace(/,/g, ''))); }
  function numeric(value) { return Number(String(value).replace(/,/g, '')); }
  function productVisual(row) {
    const category = String(row[0] || '').toLowerCase();
    const description = String(row[2] || row[1] || 'Product').trim();
    const text = description.toLowerCase();
    let fill = '#3a2014'; // chocolate default
    if (/strawberry|raspberry|pink/.test(text)) fill = '#a63354';
    else if (/green tea|matcha|pesto/.test(text)) fill = '#4a6730';
    else if (/vanilla|white/.test(text)) fill = '#d4c19c';
    else if (/charcoal|black|squid/.test(text)) fill = '#1c191e';
    else if (/oatmeal|dark/.test(text)) fill = '#2e190e';
    else if (/lemon|mango|pineapple|curry/.test(text)) fill = '#b88628';

    const svg = `<svg class="tart-svg" viewBox="0 0 44 44" width="34" height="34" aria-hidden="true">
      <ellipse cx="22" cy="27" rx="15" ry="7" fill="rgba(0,0,0,0.45)"/>
      <path d="M 7 21 C 7 28.5, 37 28.5, 37 21 L 35 23.5 C 35 29.5, 9 29.5, 9 23.5 Z" fill="#7a3a1d"/>
      <ellipse cx="22" cy="20.5" rx="15" ry="8" fill="#a85928"/>
      <ellipse cx="22" cy="21" rx="13" ry="6.8" fill="#5c2b12"/>
      <ellipse cx="22" cy="21.5" rx="11.8" ry="6" fill="${fill}"/>
      <ellipse cx="18.5" cy="19.8" rx="6.5" ry="2.6" fill="rgba(255,255,255,0.18)"/>
      <path d="M 8 20.5 C 12 25.5, 32 25.5, 36 20.5" stroke="#cc7a42" stroke-width="1.2" fill="none" opacity="0.65"/>
    </svg>`;

    return { tone: fill, kind: 'tart', initials: '', description, svg };
  }

  function openDraftDb() {
    return new Promise(resolve => {
      if (!window.indexedDB) return resolve(null);
      const request = indexedDB.open('lrn_pricelist_cache', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('drafts')) {
          db.createObjectStore('drafts', { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
  }

  async function setDraft(key, data) {
    try {
      const db = await openDraftDb();
      if (!db) return false;
      return new Promise(resolve => {
        const tx = db.transaction('drafts', 'readwrite');
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.objectStore('drafts').put({ key, data, updatedAt: Date.now() });
      });
    } catch {
      return false;
    }
  }

  async function getDraft(key) {
    try {
      const db = await openDraftDb();
      if (!db) return null;
      return new Promise(resolve => {
        const tx = db.transaction('drafts', 'readonly');
        const req = tx.objectStore('drafts').get(key);
        req.onsuccess = () => resolve(req.result?.data || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  async function removeDraft(key) {
    try {
      const db = await openDraftDb();
      if (!db) return false;
      return new Promise(resolve => {
        const tx = db.transaction('drafts', 'readwrite');
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.objectStore('drafts').delete(key);
      });
    } catch {
      return false;
    }
  }

  const draftKey = () => (state.user ? `draft_${state.user.username}` : 'draft_current');

  function applyPermissions() {
    $$('.edit-only').forEach(element => element.hidden = !can('update'));
    $$('.admin-only').forEach(element => element.hidden = !can('manageImages'));
    ['update', 'approve', 'viewAudit', 'manageImages', 'upload'].forEach(permission => {
      $$(`.perm-${permission}`).forEach(element => element.hidden = !can(permission));
    });
    updateEditorActions();
    const devToolsRoot = $('#devTools');
    if (devToolsRoot) devToolsRoot.hidden = !state.devTools;
  }
  /** The adjust / reset / upload / save cluster only appears once a price list is open. */
  function updateEditorActions() {
    const cluster = $('#cloverActions');
    // Header icons: export (anyone with export access) plus upload/save (editors only, via .perm-update).
    if (cluster) cluster.hidden = !state.active || (!can('update') && !can('export'));
    const closeButton = $('#closeFileBtn');
    if (closeButton) closeButton.hidden = !state.active;
    renderNavigator();
  }
  /** Closes the open price list and returns the editor to its empty state. */
  async function closeActiveFile() {
    if (!state.active) return;
    if (state.active.isDraft && !(await confirmDiscardDraft('Closing this file'))) return;
    const name = state.active.name;
    if (state.isEditing && state.activeCell.td) cancelCellEdit(state.activeCell.td);
    setPriceEditor(false);
    if (can('update')) await removeDraft(draftKey());
    resetFilters();
    state.category = '';
    state.categoryChosen = false;
    rememberCategory('');
    state.rows = []; state.headers = []; state.priceColumns = [];
    state.adjustment = 0; state.categoryAdjustments = {};
    loadActive(null);
    renderLists();
    renderFiles();
    toast(`Closed ${name}.`);
  }
  function userName(username) {
    return state.directory.find(entry => entry.username === username)?.name || username || '';
  }
  function statusLabel(status) {
    return { uploaded: 'Uploaded', pending: 'Pending approval', approved: 'Approved', rejected: 'Rejected', superseded: 'Superseded', draft: 'Draft (unsaved)' }[status] || 'Draft (unsaved)';
  }
  function activeStatus() {
    if (!state.active) return null;
    if (state.active.isDraft || !state.active.id) return 'draft';
    return state.active.status || 'pending';
  }
  function canExportActive() {
    return can('export') && ['approved', 'uploaded'].includes(activeStatus());
  }
  function versionSummaryById(id) {
    return (state.versions || []).find(version => String(version.id) === String(id)) || null;
  }
  function approvalProgress(version) {
    const approved = (version.approvals || []).map(approval => approval.name || userName(approval.username));
    const waiting = (version.requiredApprovers || []).filter(username => !(version.approvals || []).some(approval => approval.username === username)).map(userName);
    return { approved, waiting };
  }
  /** Pads legacy rows to the current width and fills price level / country from the list defaults. */
  function normalizeRows(rows, priceLevel, country) {
    return (rows || []).map(row => {
      const copy = Array.from({ length: Math.max(ROW_WIDTH, row.length) }, (_, index) => row[index] ?? '');
      if (!String(copy[COL.priceLevel] ?? '').trim()) copy[COL.priceLevel] = priceLevel || '';
      if (!String(copy[COL.country] ?? '').trim()) copy[COL.country] = country || '';
      return copy;
    });
  }
  function normalizeHeaders(headers) {
    const copy = [...(headers || [])];
    while (copy.length < ROW_WIDTH) copy.push('');
    copy[COL.priceLevel] = 'Price Level';
    copy[COL.country] = 'Country';
    return copy;
  }
  function uniqueValues(values) {
    return [...new Set(values.map(value => String(value ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }
  function fillSelect(select, values, allLabel, current) {
    if (!select) return '';
    select.innerHTML = `<option value="">${escapeHtml(allLabel)}</option>` + values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
    const next = values.includes(current) ? current : '';
    select.value = next;
    return next;
  }
  function fillDatalists() {
    // Country and price level are fixed dropdown lists now; nothing to suggest.
    if (dom.priceLevelOptions) dom.priceLevelOptions.innerHTML = '';
    if (dom.countryOptions) dom.countryOptions.innerHTML = '';
  }
  /** "1", "level 2", "PL3" or "Price Level 4" → "Price Level 4" when it is a configured level, else ''. */
  function canonicalPriceLevel(value) {
    const match = String(value || '').match(/^\s*(?:price\s*level|level|pl|lvl)?\s*#?\s*(\d{1,3})\s*$/i);
    const level = match ? `Price Level ${Number(match[1])}` : '';
    return (state.priceLevels || []).includes(level) ? level : '';
  }
  function priceLevelOptionsHtml(selected, placeholder = 'Select level…') {
    const current = canonicalPriceLevel(selected) || String(selected || '').trim();
    const list = state.priceLevels || [];
    const extra = current && !list.includes(current) ? [current] : [];
    return `<option value="">${escapeHtml(placeholder)}</option>`
      + [...extra, ...list].map(level => `<option value="${escapeHtml(level)}"${level === current ? ' selected' : ''}>${escapeHtml(level)}${extra.includes(level) ? ' (not in list)' : ''}</option>`).join('');
  }
  /** Picks up "Price Level 2", "Level 2" or "PL2" from a file name. */
  function guessPriceLevel(fileName) {
    const match = String(fileName || '').match(/\b(?:price\s*level|level|pl)\s*[-_ #]?\s*(\d{1,2})\b/i);
    return match ? canonicalPriceLevel(match[1]) : '';
  }
  function setAppLoading(loading) {
    document.body.classList.toggle('is-booting', loading);
    document.body.classList.toggle('is-ready', !loading);
    // Take the loading screen away once its fade-out is due, even if the browser never ran the fade.
    const loader = $('#appLoading');
    if (!loader) return;
    clearTimeout(setAppLoading.timer);
    if (loading) loader.style.display = '';
    else setAppLoading.timer = setTimeout(() => { if (document.body.classList.contains('is-ready')) loader.style.display = 'none'; }, 350);
  }
  function showApp() {
    dom.userName.textContent = state.user.name; dom.roleBadge.textContent = can('update') ? 'Admin' : 'Export only'; applyPermissions();
    switchPanel(getInitialPanelId(), true);
  }
  function setPriceEditor(open) {
    const button = $('#editButton');
    const popover = $('#adjustmentBar');
    if (!button || !popover) return;
    popover.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('data-tooltip', open ? 'Close editor' : 'Edit prices');
    button.title = open ? 'Close editor' : 'Edit prices';
    if (open) {
      // The table panel clips overflow, so the popover is placed (fixed) right under the toolbar button.
      const rect = button.getBoundingClientRect();
      popover.style.position = 'fixed';
      popover.style.top = `${Math.round(rect.bottom + 8)}px`;
      popover.style.right = `${Math.max(16, Math.round(window.innerWidth - rect.right))}px`;
      const allCategories = getPriceCategories();
      const cat = String(state.category || '').trim();
      selectedAdjustmentCategories.clear();
      if (cat && allCategories.some(c => c.name === cat)) {
        selectedAdjustmentCategories.add(cat);
        dom.percentage.value = getCategoryAdjustment(cat);
      } else {
        allCategories.forEach(c => selectedAdjustmentCategories.add(c.name));
        dom.percentage.value = state.adjustment || 0;
      }
      if (dom.categoryAdjustSearch) dom.categoryAdjustSearch.value = '';
      renderCategoryAdjustmentList();
      requestAnimationFrame(() => {
        dom.percentage.focus();
        dom.percentage.select();
      });
    } else if (popover.contains(document.activeElement)) {
      button.focus();
    }
  }
  function applyStatePayload(data) {
    Object.assign(state, {
      user: data.user, csrf: data.csrf, permissions: data.permissions || [], directory: data.directory || [],
      approvers: data.approvers || [], approvalMode: data.approvalMode || 'any', autoApprove: Boolean(data.autoApprove), countries: data.countries || [], priceLevels: data.priceLevels || [],
      versions: data.versions || [], productImages: data.productImages || [], auditLogs: data.auditLogs || [], photoLibrary: data.photoLibrary || [],
      photoFolders: data.photoFolders || [],
      importTemplate: data.importTemplate || null,
      notifications: data.notifications || [], unreadCount: Number(data.unreadCount || 0),
      devTools: Boolean(data.devTools)
    });
    state.canEdit = can('update');
  }
  function rememberOpenVersion(id) {
    try { id ? localStorage.setItem(`pla_open_version_${state.user?.username}`, id) : localStorage.removeItem(`pla_open_version_${state.user?.username}`); } catch { }
  }
  function rememberedVersionId() {
    try { return localStorage.getItem(`pla_open_version_${state.user?.username}`) || ''; } catch { return ''; }
  }
  /** The live (approved or uploaded) revision of the same price list: same name, country and price level. */
  function liveRevisionOf(version) {
    const key = v => [v.name, v.country, v.priceLevel].map(part => String(part || '').trim().toLowerCase()).join('|');
    return (state.versions || [])
      .filter(v => key(v) === key(version) && ['approved', 'uploaded'].includes(v.status))
      .sort((a, b) => (b.revision || 0) - (a.revision || 0))[0] || null;
  }
  /** Reloads versions, notifications and audit logs; keeps the open price list unless it changed on the server. */
  async function refreshState() {
    const data = await api('state');
    applyStatePayload(data);
    applyPermissions();
    const open = state.active?.id && !state.active.isDraft ? versionSummaryById(state.active.id) : null;
    // The open revision was replaced (e.g. a change to it was just approved): move to the live one.
    const live = open?.status === 'superseded' ? liveRevisionOf(open) : null;
    if (live && live.id !== open.id) {
      await openVersion(live.id, { silent: true, stay: true });
      toast(`Opened revision ${live.revision}, the current version of ${live.name}.`);
    } else if (state.active?.id && !state.active.isDraft && (!open || open.status !== state.active.status || (open.approvals || []).length !== (state.active.approvals || []).length)) {
      if (open) await openVersion(open.id, { silent: true, stay: true });
      else loadActive(null);
    } else {
      renderWorkflowState();
    }
    fillDatalists(); renderLists(); renderFiles(); renderHistory(); renderNotifications(); renderLibrary();
  }
  async function loadState(skipDraftCheck = false) {
    const data = await api('state');
    applyStatePayload(data);
    let targetActive = null;
    let isRestoredDraft = false;
    if (!skipDraftCheck && can('update')) {
      const draft = await getDraft(draftKey());
      if (draft && draft.rows && draft.rows.length) {
        targetActive = draft;
        isRestoredDraft = true;
      }
    }
    if (!targetActive) {
      const rememberedId = rememberedVersionId();
      let remembered = rememberedId ? versionSummaryById(rememberedId) : null;
      // Reopen the current revision rather than one that has since been replaced.
      if (remembered?.status === 'superseded') remembered = liveRevisionOf(remembered) || remembered;
      if (remembered) {
        try { targetActive = (await api('open', { method: 'POST', body: JSON.stringify({ id: remembered.id }) })).active; } catch { targetActive = null; }
      }
    }
    showApp(); fillDatalists(); loadActive(targetActive); renderLists(); renderFiles(); renderHistory(); renderImageSettings(); renderNotifications();
    setAppLoading(false);
    if (isRestoredDraft) toast('Restored your unsaved draft.');
  }
  async function openVersion(id, { silent = false, stay = false } = {}) {
    if (!silent && state.active?.isDraft && String(state.active.id || '') !== String(id) && !(await confirmDiscardDraft('Opening another price list'))) return null;
    const data = await api('open', { method: 'POST', body: JSON.stringify({ id }) });
    if (can('update')) await removeDraft(draftKey());
    loadActive(data.active);
    if (!stay) switchPanel('workspacePanel', true);
    if (!silent) toast(`Opened ${data.active.name}.`);
    return data.active;
  }
  function setSavedMeta(text) {
    if (!dom.savedMeta) return;
    dom.savedMeta.textContent = text || '';
    if (dom.savedMetaRow) dom.savedMetaRow.hidden = !text;
  }

  function loadActive(active) {
    state.active = active;
    state.activeCell = { rowIdx: null, colIdx: null, td: null };
    updateEditorActions();
    const metricGroup = $('#metricGroup');
    if (!active) {
      rememberOpenVersion('');
      $('#workspacePanel')?.classList.remove('has-file');
      dom.listTitle.title = '';
      setPriceEditor(false); dom.emptyState.hidden = false; dom.dataView.hidden = true;
      if (metricGroup) metricGroup.hidden = true;
      if (dom.listTagsRow) dom.listTagsRow.hidden = true;
      if (dom.approvalBanner) dom.approvalBanner.hidden = true;
      if (dom.bannerApproveBtn) dom.bannerApproveBtn.hidden = true;
      if (dom.bannerRejectBtn) dom.bannerRejectBtn.hidden = true;
      const canUpload = can('upload');
      dom.listTitle.textContent = canUpload ? 'Start with a workbook' : 'Open an approved price list';
      dom.listMeta.textContent = canUpload ? 'Upload an official .xlsx template to open and edit prices.' : 'Choose an approved price list to view and export.';
      if (dom.emptyStateTitle) dom.emptyStateTitle.textContent = canUpload ? 'Import your current price list' : 'No price list open';
      if (dom.emptyStateText) dom.emptyStateText.textContent = canUpload ? 'Drop an official .xlsx workbook here or browse your computer. Download the template from the upload window.' : 'Approved price lists are listed under Approvals, where you can open or export them.';
      if (dom.emptyBrowseListsButton) dom.emptyBrowseListsButton.hidden = canUpload;
      dom.listMeta.title = '';
      setSavedMeta(''); dom.activeBadge.hidden = true;
      $('#editButton').classList.add('is-disabled');
      $('#editButton').setAttribute('aria-disabled', 'true');
      $('#saveButton').classList.add('is-disabled');
      $('#saveButton').setAttribute('aria-disabled', 'true');
      if (dom.resetPricesButton) {
        dom.resetPricesButton.classList.add('is-disabled');
        dom.resetPricesButton.setAttribute('aria-disabled', 'true');
      }
      renderImageSettings();
      return;
    }
    if (metricGroup) metricGroup.hidden = false;
    active.priceLevel = String(active.priceLevel || '');
    active.country = String(active.country || '');
    active.changes = Array.isArray(active.changes) ? active.changes : [];
    if (active.isDraft) active.pendingChanges = Array.isArray(active.pendingChanges) ? active.pendingChanges : [];
    state.headers = normalizeHeaders(active.headers);
    state.rows = normalizeRows(active.rows, active.priceLevel, active.country);
    active.headers = state.headers;
    active.rows = state.rows;
    state.priceColumns = (active.priceColumns || []).filter(index => /price\s*\/\s*(pc|box)/i.test(String(state.headers[index] || '')));
    state.adjustment = Number(active.adjustment || 0);
    state.categoryAdjustments = active.categoryAdjustments ? { ...active.categoryAdjustments } : {};
    const canEdit = Boolean(state.canEdit);
    $('#editButton').classList.toggle('is-disabled', !canEdit);
    $('#editButton').setAttribute('aria-disabled', String(!canEdit));
    setPriceEditor(false);

    const categories = uniqueValues(state.rows.map(row => row[COL.category]));
    dom.category.innerHTML = `<option value="">All categories</option>` + categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
    // "All categories" is the default view; after a refresh the previously chosen category is restored.
    if (!state.category) state.category = rememberedCategory();
    if (!categories.includes(state.category)) state.category = '';
    dom.category.value = state.category;
    dom.percentage.value = getCategoryAdjustment(state.category);
    // Country / price level / price list are chosen with the navigator cascade (one file per country).
    state.priceLevelFilter = '';
    state.countryFilter = '';
    if (dom.codeFilterOptions) dom.codeFilterOptions.innerHTML = uniqueValues(state.rows.map(row => row[COL.code])).slice(0, 2000).map(code => `<option value="${escapeHtml(code)}"></option>`).join('');

    dom.emptyState.hidden = true; dom.dataView.hidden = false; dom.listTitle.textContent = active.name; dom.listMeta.textContent = active.name;
    dom.listTitle.title = active.name;
    dom.listMeta.title = active.name;
    $('#workspacePanel')?.classList.add('has-file');
    if (dom.listTagsRow) {
      dom.listTagsRow.hidden = false;
      dom.listPriceLevel.textContent = active.priceLevel || 'Not set';
      dom.listCountry.textContent = active.country || 'Not set';
      dom.listRevisionTag.hidden = !(active.revision > 1);
      dom.listRevision.textContent = String(active.revision || 1);
    }
    if (!active.isDraft && active.id) rememberOpenVersion(active.id);

    dom.activeBadge.hidden = false;
    $('#saveButton').classList.toggle('is-disabled', !canEdit);
    $('#saveButton').setAttribute('aria-disabled', String(!canEdit));
    renderWorkflowState();
    updateMetrics(); renderTable(); renderImageSettings();
  }

  /** Status badge, approval banner and export lock for the open price list. */
  function renderWorkflowState() {
    const active = state.active;
    const status = activeStatus();
    if (!active || !status) return;
    const badgeClass = { draft: 'draft-badge', uploaded: 'uploaded-badge', pending: 'pending-badge', approved: '', rejected: 'rejected-badge', superseded: 'superseded-badge' }[status] ?? '';
    const dotClass = status === 'approved' || status === 'uploaded' ? '' : 'warning';
    dom.activeBadge.className = `status-badge ${badgeClass}`.trim();
    dom.activeBadge.innerHTML = `<span class="pulse-dot ${dotClass}" aria-hidden="true"><span class="pulse-ring"></span></span>${escapeHtml(statusLabel(status))}`;

    if (status === 'draft') {
      const edits = (active.pendingChanges || []).length;
      setSavedMeta(active.id ? `Unsaved edits to the version saved by ${active.savedBy || 'a user'}${edits ? ` · ${edits} cell edit${edits === 1 ? '' : 's'}` : ''}` : 'Imported workbook · Unsaved');
    } else {
      // An uploaded file's status note already says who uploaded it and when.
      setSavedMeta(status === 'uploaded' ? '' : active.savedAt ? `Saved ${displayDate(active.savedAt)} by ${active.savedBy}` : 'Saved');
    }

    // Compact one-line status note beside the price level / country tags (no extra row above the table).
    const note = dom.approvalBanner;
    if (note) {
      let text = '';
      const { approved, waiting } = approvalProgress(active);
      const canDecide = Boolean(active.canApprove) && status === 'pending';
      if (status === 'pending') {
        text = canDecide
          ? 'Waiting for your approval'
          : `Awaiting approval${waiting.length ? ` from ${waiting.join(state.approvalMode === 'all' ? ' & ' : ' or ')}` : ''}`;
        if (approved.length) text += ` · approved by ${approved.join(', ')}`;
      } else if (status === 'uploaded') {
        text = `Uploaded by ${active.savedBy || 'a user'}${active.savedAt ? ` · ${displayDate(active.savedAt)}` : ''} · original prices`;
      } else if (status === 'approved') {
        text = `Approved by ${active.approvedBy || approved.join(' & ')}${active.approvedAt ? ` · ${displayDate(active.approvedAt)}` : ''}`;
      } else if (status === 'rejected') {
        text = `Rejected by ${active.rejectedBy || 'an approver'}${active.rejectionRemarks ? `: ${active.rejectionRemarks}` : ''}`;
      } else if (status === 'superseded') {
        text = 'Superseded by a newer approved revision';
      }
      note.hidden = !text;
      note.dataset.tone = status;
      note.title = text;
      dom.approvalBannerIcon.textContent = { uploaded: '⬆', pending: '⏳', approved: '✓', rejected: '✕', superseded: '↻' }[status] || '';
      dom.approvalBannerText.textContent = text;
      dom.bannerApproveBtn.hidden = !canDecide;
      dom.bannerRejectBtn.hidden = !canDecide;
    }

    const exportable = canExportActive();
    // Why export is locked, worded for the user's role (top approvers like Ms. Gen just need to save).
    const lockReason = status === 'draft' ? (state.autoApprove ? 'Save your changes to make them exportable' : 'Save your changes and get approval to export them')
      : status === 'pending' ? 'Export unlocks after approval'
      : status === 'rejected' ? 'Rejected lists cannot be exported'
      : status === 'superseded' ? 'Superseded by a newer approved list' : '';
    ['#excelButton', '#pdfButton'].forEach(selector => {
      const button = $(selector);
      if (!button) return;
      button.hidden = !can('export');
      button.disabled = !exportable;
      button.title = exportable ? '' : lockReason || 'Only approved price lists can be exported.';
    });
    if (dom.exportLockNote) {
      dom.exportLockNote.hidden = exportable || !can('export');
      dom.exportLockNote.textContent = lockReason;
    }
  }

  /** Marks the open list as an unsaved draft and stores it locally. */
  function markDraft() {
    if (!state.active) return;
    state.active.rows = state.rows;
    state.active.categoryAdjustments = { ...state.categoryAdjustments };
    state.active.adjustment = state.adjustment;
    if (!state.active.isDraft) {
      state.active.isDraft = true;
      state.active.pendingChanges = [];
    }
    setDraft(draftKey(), state.active);
    renderWorkflowState();
  }
  function hasPriceAdjustments() {
    if (Number(state.adjustment || 0) !== 0) return true;
    return Object.values(state.categoryAdjustments || {}).some(v => Number(v || 0) !== 0);
  }
  function updateMetrics() {
    dom.productCount.textContent = state.rows.length.toLocaleString();
    dom.categoryCount.textContent = new Set(state.rows.map(row => row[0]).filter(Boolean)).size;
    dom.priceColumnCount.textContent = state.priceColumns.length;
    const catAdj = getCategoryAdjustment(state.category);
    dom.currentAdjustment.textContent = `${catAdj > 0 ? '+' : ''}${catAdj}%`;
    const adjLabel = dom.currentAdjustment.nextElementSibling;
    if (adjLabel) {
      adjLabel.textContent = state.category ? `${state.category} Adj.` : 'Adjustment';
    }
    if (dom.resetPricesButton) {
      const canReset = state.canEdit && Boolean(state.active) && hasPriceAdjustments();
      dom.resetPricesButton.classList.toggle('is-disabled', !canReset);
      dom.resetPricesButton.setAttribute('aria-disabled', String(!canReset));
    }
  }
  function hasActiveFilters() {
    return Boolean(state.search.trim() || state.codeFilter.trim() || state.priceLevelFilter || state.countryFilter);
  }
  function filterDescription() {
    return [
      state.category ? `Category: ${state.category}` : '',
      state.codeFilter.trim() ? `LRN code: ${state.codeFilter.trim()}` : '',
      state.priceLevelFilter ? `Price level: ${state.priceLevelFilter}` : '',
      state.countryFilter ? `Country: ${state.countryFilter}` : '',
      state.search.trim() ? `Search: "${state.search.trim()}"` : ''
    ].filter(Boolean).join(', ');
  }
  function filteredRows() {
    const query = state.search.trim().toLowerCase();
    const code = state.codeFilter.trim().toLowerCase();
    return state.rows.map((row, index) => ({ row, index })).filter(({ row }) =>
      (!state.category || String(row[COL.category] ?? '') === state.category) &&
      (!code || String(row[COL.code] ?? '').toLowerCase().includes(code)) &&
      (!state.priceLevelFilter || String(row[COL.priceLevel] ?? '') === state.priceLevelFilter) &&
      (!state.countryFilter || String(row[COL.country] ?? '') === state.countryFilter) &&
      (!query || row.some(value => String(value ?? '').toLowerCase().includes(query))));
  }
  function groupLookupKey(category, groupName) {
    return `${String(category || '').trim().toLowerCase()}\u241f${String(groupName || '').trim().toLowerCase()}`;
  }
  function imageOverride(category, groupName) {
    const key = groupLookupKey(category, groupName);
    return state.productImages.find(image => groupLookupKey(image.category, image.groupName) === key) || null;
  }
  function defaultGroupImagePath(category, groupName) {
    return null;
  }
  function groupImagePath(category, groupName) {
    return imageOverride(category, groupName)?.imagePath || null;
  }
  function groupVisual(category, groupName, items) {
    const custom = imageOverride(category, groupName);
    if (custom?.imagePath) {
      const label = custom.altText || groupName || category || 'Product group';
      return `<div class="group-photo-wrap has-photo">
        <img class="group-photo-img" src="${escapeHtml(mediaUrl(custom.imagePath))}" alt="${escapeHtml(label)}" loading="lazy">
        ${state.canEdit ? `<button type="button" class="group-photo-change-btn edit-only choose-group-image" data-category="${escapeHtml(category)}" data-group="${escapeHtml(groupName)}" title="Change photo for ${escapeHtml(groupName)}">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          Change
        </button>` : ''}
      </div>`;
    }
    return `<div class="group-photo-empty-container">
      ${state.canEdit ? `
        <button type="button" class="group-add-photo-btn edit-only choose-group-image" data-category="${escapeHtml(category)}" data-group="${escapeHtml(groupName)}" title="Upload custom photo for ${escapeHtml(groupName)}">
          <div class="group-add-photo-icon-box">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
          <span class="group-add-photo-label">Add</span>
        </button>
      ` : `
        <div class="group-no-photo-readonly" title="No photo uploaded">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <span>No photo</span>
        </div>
      `}
    </div>`;
  }

  function productGroups() {
    const groups = new Map();
    state.rows.forEach(row => {
      const category = String(row[0] || 'Products').trim();
      const groupName = String(row[18] || row[0] || 'Other products').trim();
      const key = groupLookupKey(category, groupName);
      const current = groups.get(key) || { category, groupName, productCount: 0 };
      current.productCount += 1;
      groups.set(key, current);
    });
    return [...groups.values()].sort((a, b) => a.category.localeCompare(b.category) || a.groupName.localeCompare(b.groupName));
  }

  function renderImageSettings() {
    if (!dom.imageSettingsList || !can('manageImages')) return;
    const groups = productGroups();
    const categories = [...new Set(groups.map(group => group.category))];
    if (!state.imageCategory || !categories.includes(state.imageCategory)) state.imageCategory = categories[0] || '';
    dom.imageCategoryFilter.innerHTML = categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
    dom.imageCategoryFilter.value = state.imageCategory;
    const query = state.imageSearch.trim().toLowerCase();
    const visible = groups.filter(group => (!state.imageCategory || group.category === state.imageCategory) && (!query || group.groupName.toLowerCase().includes(query)));
    dom.imageSettingsCount.textContent = `${visible.length} product type${visible.length === 1 ? '' : 's'}`;
    dom.imageSettingsEmpty.hidden = visible.length > 0;
    dom.imageSettingsList.hidden = visible.length === 0;
    if (!visible.length) {
      dom.imageSettingsEmpty.innerHTML = groups.length
        ? '<h2>No matching product types</h2><p>Try a different search or category.</p>'
        : '<h2>No product types available</h2><p>Upload a workbook first. Its categories and product groups will appear here.</p>';
    }
    dom.imageSettingsList.innerHTML = visible.map(group => {
      const custom = imageOverride(group.category, group.groupName);
      const previewMarkup = custom?.imagePath
        ? `<img class="image-setting-preview" src="${escapeHtml(mediaUrl(custom.imagePath))}" alt="${escapeHtml(group.groupName)} preview">`
        : `<div class="image-setting-preview empty-preview" title="No photo set">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
           </div>`;
      return `<article class="image-setting-row">
        ${previewMarkup}
        <div class="image-setting-copy">
          <span>${escapeHtml(group.category)}</span>
          <strong>${escapeHtml(group.groupName)}</strong>
          <small>${group.productCount} product${group.productCount === 1 ? '' : 's'} · ${custom ? escapeHtml(libraryPhotoName(custom.libraryId) || 'Custom photo') : 'No photo set yet'}</small>
        </div>
        <div class="image-setting-actions">
          <button class="button ${custom ? 'secondary' : 'primary'} choose-group-image" data-category="${escapeHtml(group.category)}" data-group="${escapeHtml(group.groupName)}">${custom ? 'Change photo' : 'Choose from library'}</button>
          ${custom ? `<button class="button danger delete-group-image" data-key="${escapeHtml(custom.key)}" data-name="${escapeHtml(group.groupName)}">Remove photo</button>` : ''}
        </div>
      </article>`;
    }).join('');
    if ($('#typesCountBadge')) $('#typesCountBadge').textContent = String(groups.length);
  }
  function libraryPhotoName(id) {
    return (state.photoLibrary || []).find(photo => photo.id === id)?.name || '';
  }
  function renderTable() {
    renderCategoryPicker();
    const visible = filteredRows();
    const valueMarkup = (row, column) => { const raw = row[column] ?? '', price = state.priceColumns.includes(column) && isNumeric(raw), value = price ? adjusted(numeric(raw), String(row[0] ?? '')) : raw; return price ? money.format(value) : escapeHtml(raw).replace(/\r?\n/g, '<br>'); };
    const standardHeader = () => `
      <tr class="excel-header excel-header-primary">
        <th rowspan="3" class="col-row-num">#</th>
        <th rowspan="3" class="col-photo-th">Photo</th>
        <th rowspan="3" class="col-code-th">Code No</th>
        <th rowspan="3" class="col-desc-th">Description</th>
        <th rowspan="3">Expiry<br>Date</th>
        <th rowspan="3">Weight<br>gr/pc</th>
        <th rowspan="3">Pcs<br>/box</th>
        <th rowspan="3">Box Size</th>
        <th rowspan="3">Price/pc<br>USD</th>
        <th rowspan="3">Price/box<br>In USD</th>
        <th colspan="3" class="col-pallet-header">PALLET PER CONTAINER</th>
      </tr>
      <tr class="excel-header excel-header-sub">
        <th colspan="2">40ft Container</th>
        <th>20ft Container</th>
      </tr>
      <tr class="excel-header excel-header-secondary">
        <th>Large Pallet<br>(16 pallets)</th>
        <th>Small Pallet<br>(2 pallets)</th>
        <th>Large Pallet<br>(8 pallets)</th>
      </tr>
      <tr class="excel-header col-letter-row"><th class="col-row-num"></th><th></th>${Array.from({ length: 11 }, (_, i) => `<th data-col-letter="${i}">${getColumnLetter(i)}</th>`).join('')}</tr>`;
    const presentationHeader = () => `
      <tr class="excel-header excel-header-primary presentation-header">
        <th class="col-row-num">#</th>
        <th>Photo</th>
        <th>LRN code</th>
        <th colspan="2">Item Name</th>
        <th>PC/Set Per Box</th>
        <th>Price/pc in USD</th>
        <th>Price/Box USD</th>
        <th>NW(KG) / Box</th>
        <th>GW(KG) / Box</th>
        <th>Box size</th>
        <th>MOQ</th>
        <th>Total Price Based on MOQ</th>
      </tr>
      <tr class="excel-header col-letter-row"><th class="col-row-num"></th><th></th>${Array.from({ length: 10 }, (_, i) => `<th data-col-letter="${i}"${i === 1 ? ' colspan="2"' : ''}>${getColumnLetter(i)}</th>`).join('')}</tr>`;
    const standardRow = (row, actualIndex, visibleIndex, isFirstInGroup, groupLength, category, groupName, groupItems) => {
      const formatPallet = val => {
        const s = String(val ?? '').trim();
        if (!s) return '';
        if (/pallet|box/i.test(s)) return escapeHtml(s);
        return isNumeric(s) ? `${s} Boxes/Pallet` : escapeHtml(s);
      };
      const photoCell = isFirstInGroup
        ? `<td class="group-photo-cell" rowspan="${groupLength}"><div class="group-photo-wrap">${groupVisual(category, groupName, groupItems)}</div></td>`
        : '';
      return `<tr class="excel-data-row" data-row="${actualIndex}" style="--row-delay:${Math.min(visibleIndex, 8) * 18}ms">
        <td class="col-row-num">${visibleIndex + 1}</td>
        ${photoCell}
        <td class="excel-cell code-cell" data-row="${actualIndex}" data-col="1" tabindex="0">${valueMarkup(row, 1)}</td>
        <td class="excel-cell full-description" data-row="${actualIndex}" data-col="2" tabindex="0">${valueMarkup(row, 2)}</td>
        <td class="excel-cell" data-row="${actualIndex}" data-col="4" tabindex="0">${valueMarkup(row, 4)}</td>
        <td class="excel-cell" data-row="${actualIndex}" data-col="5" tabindex="0">${valueMarkup(row, 5)}</td>
        <td class="excel-cell" data-row="${actualIndex}" data-col="6" tabindex="0">${valueMarkup(row, 6)}</td>
        <td class="excel-cell" data-row="${actualIndex}" data-col="7" tabindex="0">${valueMarkup(row, 7)}</td>
        <td class="excel-cell price-cell changed" data-row="${actualIndex}" data-col="8" tabindex="0">${valueMarkup(row, 8)}</td>
        <td class="excel-cell price-cell changed" data-row="${actualIndex}" data-col="9" tabindex="0">${valueMarkup(row, 9)}</td>
        <td class="excel-cell col-pallet" data-row="${actualIndex}" data-col="10" tabindex="0">${formatPallet(row[10])}</td>
        <td class="excel-cell col-pallet" data-row="${actualIndex}" data-col="11" tabindex="0">${formatPallet(row[11])}</td>
        <td class="excel-cell col-pallet" data-row="${actualIndex}" data-col="12" tabindex="0">${formatPallet(row[12])}</td>
      </tr>`;
    };
    const presentationRow = (row, actualIndex, visibleIndex, isFirstInGroup, groupLength, category, groupName, groupItems) => {
      const itemName = [row[2], row[3]].filter(value => String(value ?? '').trim()).map(value => escapeHtml(value).replace(/\r?\n/g, '<br>')).join('<br>');
      const moq = [row[15], row[16]].filter(value => String(value ?? '').trim()).map(value => escapeHtml(value).replace(/\r?\n/g, '<br>')).join('<br>');
      const photoCell = isFirstInGroup
        ? `<td class="group-photo-cell" rowspan="${groupLength}"><div class="group-photo-wrap">${groupVisual(category, groupName, groupItems)}</div></td>`
        : '';
      return `<tr class="excel-data-row presentation-row" data-row="${actualIndex}" style="--row-delay:${Math.min(visibleIndex, 8) * 18}ms">
        <td class="col-row-num">${visibleIndex + 1}</td>
        ${photoCell}
        <td class="excel-cell code-cell" data-row="${actualIndex}" data-col="1" tabindex="0">${valueMarkup(row, 1)}</td>
        <td class="excel-cell full-description" colspan="2" data-row="${actualIndex}" data-col="2" tabindex="0">${itemName}</td>
        <td class="excel-cell" data-row="${actualIndex}" data-col="6" tabindex="0">${valueMarkup(row, 6)}</td>
        <td class="excel-cell price-cell changed" data-row="${actualIndex}" data-col="8" tabindex="0">${valueMarkup(row, 8)}</td>
        <td class="excel-cell price-cell changed" data-row="${actualIndex}" data-col="9" tabindex="0">${valueMarkup(row, 9)}</td>
        <td class="excel-cell" data-row="${actualIndex}" data-col="13" tabindex="0">${valueMarkup(row, 13)}</td>
        <td class="excel-cell" data-row="${actualIndex}" data-col="14" tabindex="0">${valueMarkup(row, 14)}</td>
        <td class="excel-cell" data-row="${actualIndex}" data-col="7" tabindex="0">${valueMarkup(row, 7)}</td>
        <td class="excel-cell" data-row="${actualIndex}" data-col="15" tabindex="0">${moq}</td>
        <td class="excel-cell" data-row="${actualIndex}" data-col="17" tabindex="0">${valueMarkup(row, 17)}</td>
      </tr>`;
    };

    const groups = [];
    let curGroup = null;
    visible.forEach(({ row, index }, visibleIndex) => {
      const groupName = String(row[18] || row[0] || 'Other products').trim();
      const groupKey = `${row[0]}|${groupName}`;
      if (!curGroup || curGroup.key !== groupKey) {
        curGroup = {
          key: groupKey,
          category: row[0],
          groupName: groupName,
          rows: []
        };
        groups.push(curGroup);
      }
      curGroup.rows.push({ row, index, visibleIndex });
    });

    const firstIsPresentation = visible.length > 0 && String(visible[0].row[0] || '').toLowerCase() === 'presentation stands';
    $('thead', dom.table).innerHTML = firstIsPresentation ? presentationHeader() : standardHeader();
    let currentLayoutIsPresentation = firstIsPresentation;
    let previousCategory = null;
    // Every view shows the category strip, including a single selected category.
    const showCategoryDividers = groups.length > 0;
    // A price roll re-renders the same rows; they stay put instead of sliding in again.
    $('tbody', dom.table).toggleAttribute('data-still', suppressRowEnter);
    $('tbody', dom.table).innerHTML = groups.map(group => {
      const isPresentation = String(group.category || '').toLowerCase() === 'presentation stands';
      const columnCount = 13;
      let prefix = '';
      if (showCategoryDividers && group.category !== previousCategory) {
        prefix += `<tr class="category-divider-row"><td colspan="${columnCount}">${escapeHtml(group.category)}</td></tr>`;
      }
      if (isPresentation !== currentLayoutIsPresentation) {
        // Presentation Stands use a different column layout, so repeat the matching header inline.
        prefix += (isPresentation ? presentationHeader() : standardHeader()).replace(/<th/g, '<th scope="col"');
        currentLayoutIsPresentation = isPresentation;
      }
      previousCategory = group.category;
      const groupHeader = prefix + (group.groupName
        ? `<tr class="product-group-row"><td colspan="${columnCount}" class="group-title-cell"><strong class="group-title-text">${escapeHtml(group.groupName)}</strong></td></tr>`
        : '');
      const rowsHtml = group.rows.map(({ row, index: actualIndex, visibleIndex }, indexInGroup) => {
        const isFirst = indexInGroup === 0;
        return isPresentation
          ? presentationRow(row, actualIndex, visibleIndex, isFirst, group.rows.length, group.category, group.groupName, group.rows)
          : standardRow(row, actualIndex, visibleIndex, isFirst, group.rows.length, group.category, group.groupName, group.rows);
      }).join('');
      return `${groupHeader}${rowsHtml}`;
    }).join('');
    dom.noResults.hidden = visible.length > 0;
    if (dom.clearFiltersBtn) dom.clearFiltersBtn.hidden = !hasActiveFilters();

    // Restore active cell selection if any
    if (state.activeCell.rowIdx !== null && state.activeCell.colIdx !== null) {
      const cell = dom.table.querySelector(`.excel-cell[data-row="${state.activeCell.rowIdx}"][data-col="${state.activeCell.colIdx}"]`);
      if (cell) {
        state.activeCell.td = cell;
        cell.classList.add('is-active-cell');
      } else {
        state.activeCell.td = null;
      }
    }
    updateFormulaBar();
  }

  // --- Excel Spreadsheet Editor Engine ---
  function getColumnLetter(colIdx) {
    let temp = colIdx + 1;
    let letter = '';
    while (temp > 0) {
      let rem = (temp - 1) % 26;
      letter = String.fromCharCode(65 + rem) + letter;
      temp = Math.floor((temp - 1) / 26);
    }
    return letter;
  }

  function formatCellDisplay(rowIdx, colIdx) {
    const row = state.rows[rowIdx];
    if (!row) return '';
    const raw = row[colIdx] ?? '';
    if (state.priceColumns.includes(colIdx) && isNumeric(raw)) {
      return money.format(adjusted(numeric(raw), String(row[0] ?? '')));
    }
    const isPresentation = String(row[0] || '').toLowerCase() === 'presentation stands';
    if (isPresentation && colIdx === 2) {
      return [row[2], row[3]].filter(v => String(v ?? '').trim()).map(v => escapeHtml(v).replace(/\r?\n/g, '<br>')).join('<br>');
    }
    if (isPresentation && colIdx === 15) {
      return [row[15], row[16]].filter(v => String(v ?? '').trim()).map(v => escapeHtml(v).replace(/\r?\n/g, '<br>')).join('<br>');
    }
    const s = String(raw ?? '').trim();
    if ((colIdx === 10 || colIdx === 11 || colIdx === 12) && s) {
      if (!/pallet|box/i.test(s) && isNumeric(s)) {
        return `${escapeHtml(s)} Boxes/Pallet`;
      }
    }
    return escapeHtml(raw).replace(/\r?\n/g, '<br>');
  }

  function selectCell(td, startEditMode = false, initialChar = null, selectAll = false) {
    if (!td || !td.classList.contains('excel-cell')) return;
    if (state.activeCell.td && state.activeCell.td !== td) {
      if (state.isEditing) commitCellEdit(state.activeCell.td);
      state.activeCell.td.classList.remove('is-active-cell');
    }
    state.activeCell.td = td;
    state.activeCell.rowIdx = Number(td.dataset.row);
    state.activeCell.colIdx = Number(td.dataset.col);
    td.classList.add('is-active-cell');
    td.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    updateFormulaBar();

    if (startEditMode && state.canEdit) {
      startCellEdit(td, initialChar, selectAll);
    } else {
      td.focus();
    }
  }

  function deselectCell() {
    if (!state.activeCell.td) return;
    if (state.isEditing) {
      commitCellEdit(state.activeCell.td);
    }
    state.activeCell.td.classList.remove('is-active-cell');
    state.activeCell = { rowIdx: null, colIdx: null, td: null };
    updateFormulaBar();
  }

  /** Excel-style reference for a cell as shown: columns count only the sheet columns (not # or Photo), rows use the # column. */
  function cellReference(td, rowIdx, colIdx) {
    const tr = td?.closest('tr');
    const cells = tr ? [...tr.querySelectorAll('.excel-cell')] : [];
    const position = cells.indexOf(td);
    const rowNumber = tr?.querySelector('.col-row-num')?.textContent.trim() || String(rowIdx + 1);
    return { letter: getColumnLetter(position >= 0 ? position : colIdx), position, rowNumber };
  }
  /** Column hover: tints every cell in the hovered sheet column (and its letter), like the row hover. */
  let hoveredColumn = -1;
  function setColumnHover(position) {
    if (position === hoveredColumn) return;
    $$('#priceTable .col-hover').forEach(el => el.classList.remove('col-hover'));
    hoveredColumn = position;
    if (position < 0) return;
    $$('#priceTable tr.excel-data-row').forEach(tr => tr.querySelectorAll('.excel-cell')[position]?.classList.add('col-hover'));
    $$(`#priceTable th[data-col-letter="${position}"]`).forEach(th => th.classList.add('col-hover'));
  }
  dom.table?.addEventListener('mouseover', event => {
    const td = event.target.closest('.excel-cell');
    if (!td) return setColumnHover(-1);
    setColumnHover([...td.closest('tr').querySelectorAll('.excel-cell')].indexOf(td));
  });
  dom.table?.addEventListener('mouseleave', () => setColumnHover(-1));
  /** Highlights the active cell's column letter and row number, like Excel's headings. */
  function highlightCellGuides(td) {
    $$('#priceTable .is-guide-active').forEach(el => el.classList.remove('is-guide-active'));
    if (!td) return;
    const { position } = cellReference(td, 0, 0);
    if (position >= 0) $$(`#priceTable th[data-col-letter="${position}"]`).forEach(th => th.classList.add('is-guide-active'));
    td.closest('tr')?.querySelector('.col-row-num')?.classList.add('is-guide-active');
  }
  function updateFormulaBar(force = false) {
    const ind = dom.formulaCellIndicator;
    const input = dom.formulaInput;
    if (!ind || !input) return;
    highlightCellGuides(state.activeCell.td);
    if (!state.activeCell.td) {
      ind.textContent = '–';
      input.value = '';
      input.disabled = true;
      return;
    }
    input.disabled = !state.canEdit;
    const rowIdx = state.activeCell.rowIdx;
    const colIdx = state.activeCell.colIdx;
    const { letter, rowNumber } = cellReference(state.activeCell.td, rowIdx, colIdx);
    const colName = String(state.headers[colIdx] || '').replace(/\s+/g, ' ').trim();
    ind.textContent = `${letter}${rowNumber}`;
    ind.title = `${colName ? colName + ' · ' : ''}Cell ${letter}${rowNumber}`;

    if (!force && document.activeElement === input) {
      return;
    }

    const raw = state.rows[rowIdx]?.[colIdx] ?? '';
    if (state.priceColumns.includes(colIdx) && isNumeric(raw)) {
      const cat = String(state.rows[rowIdx][0] ?? '');
      input.value = Number(adjusted(numeric(raw), cat)).toFixed(2);
    } else {
      input.value = String(raw);
    }
  }

  function startCellEdit(td, initialChar = null, selectAll = false) {
    if (!state.canEdit || !td || state.isEditing) return;
    state.isEditing = true;
    const rowIdx = Number(td.dataset.row);
    const colIdx = Number(td.dataset.col);
    const rawVal = state.rows[rowIdx]?.[colIdx] ?? '';
    let editVal = String(rawVal);
    if (state.priceColumns.includes(colIdx) && isNumeric(rawVal)) {
      const cat = String(state.rows[rowIdx][0] ?? '');
      editVal = Number(adjusted(numeric(rawVal), cat)).toFixed(2);
    }
    if (initialChar !== null) {
      editVal = initialChar;
    }

    td.dataset.originalHtml = td.innerHTML;
    td.classList.add('is-editing');
    td.innerHTML = '';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'excel-cell-editor';
    input.value = editVal;
    input.autocomplete = 'off';
    input.spellcheck = false;
    td.appendChild(input);

    requestAnimationFrame(() => {
      input.focus();
      if (initialChar !== null) {
        input.setSelectionRange(input.value.length, input.value.length);
      } else if (selectAll) {
        input.select();
      } else {
        input.setSelectionRange(input.value.length, input.value.length);
      }
    });

    // Prevent mouse clicks inside the input from bubbling to table or document
    input.addEventListener('mousedown', event => event.stopPropagation());
    input.addEventListener('click', event => event.stopPropagation());
    input.addEventListener('mouseup', event => event.stopPropagation());
    input.addEventListener('dblclick', event => event.stopPropagation());

    input.addEventListener('input', () => {
      if (dom.formulaInput) dom.formulaInput.value = input.value;
    });

    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        commitCellEdit(td, input.value);
        navigateCell(event.shiftKey ? -1 : 1, 0);
      } else if (event.key === 'Tab') {
        event.preventDefault();
        event.stopPropagation();
        commitCellEdit(td, input.value);
        navigateCell(0, event.shiftKey ? -1 : 1);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        cancelCellEdit(td);
      }
    });

    input.addEventListener('blur', event => {
      if (event.relatedTarget === dom.formulaConfirmBtn || event.relatedTarget === dom.formulaCancelBtn) {
        return;
      }
      if (state.isEditing && state.activeCell.td === td) {
        commitCellEdit(td, input.value);
      }
    });
  }

  function commitCellEdit(td, newValue = null) {
    if (!td) return;
    const wasEditing = state.isEditing;
    if (!wasEditing && newValue === null) return;

    state.isEditing = false;
    td.classList.remove('is-editing');
    const rowIdx = Number(td.dataset.row);
    const colIdx = Number(td.dataset.col);
    if (!Number.isFinite(rowIdx) || !Number.isFinite(colIdx)) return;

    const input = td.querySelector('.excel-cell-editor');
    const finalVal = newValue !== null ? newValue : (input ? input.value : '');

    const oldRaw = state.rows[rowIdx]?.[colIdx] ?? '';
    let valChanged = false;

    if (state.rows[rowIdx]) {
      if (state.priceColumns.includes(colIdx)) {
        const cleanNum = Number(String(finalVal).replace(/[^0-9.-]/g, ''));
        if (Number.isFinite(cleanNum) && cleanNum >= 0 && String(finalVal).trim() !== '') {
          const cat = String(state.rows[rowIdx][0] ?? '').trim();
          const catAdj = getCategoryAdjustment(cat);
          const divisor = 1 + catAdj / 100;
          const baseVal = (catAdj !== 0 && divisor > 0) ? (cleanNum / divisor) : cleanNum;
          const newNumericVal = Number(baseVal.toFixed(4));
          if (Number(oldRaw) !== newNumericVal) {
            state.rows[rowIdx][colIdx] = newNumericVal;
            valChanged = true;
          }
        } else if (String(finalVal).trim() === '') {
          if (oldRaw !== '') {
            state.rows[rowIdx][colIdx] = '';
            valChanged = true;
          }
        }
      } else {
        const trimmed = String(finalVal).trim();
        if (String(oldRaw).trim() !== trimmed) {
          state.rows[rowIdx][colIdx] = trimmed;
          if (colIdx === 2 && !state.rows[rowIdx][18]) {
            state.rows[rowIdx][18] = state.rows[rowIdx][0];
          }
          valChanged = true;
        }
      }

      if (valChanged && state.active) {
        const row = state.rows[rowIdx];
        const isPrice = state.priceColumns.includes(colIdx);
        const cat = String(row[COL.category] ?? '');
        const shown = value => (isPrice && isNumeric(value) ? money.format(adjusted(numeric(value), cat)) : String(value ?? ''));
        const change = {
          code: String(row[COL.code] ?? ''),
          product: String(row[COL.description] ?? '').split(/\r?\n/)[0].slice(0, 200),
          category: cat,
          column: String(state.headers[colIdx] || getColumnLetter(colIdx)).replace(/\s+/g, ' ').trim(),
          oldValue: shown(oldRaw),
          newValue: shown(row[colIdx])
        };
        markDraft();
        state.active.pendingChanges.push(change);
        setDraft(draftKey(), state.active);
        renderWorkflowState();
        logActivity('cell_edit', `Edited ${change.column} of ${change.code || 'a product'}`, `${change.product || change.code}: ${change.oldValue || 'empty'} → ${change.newValue || 'empty'}`, {
          productCode: change.code, productName: change.product, category: change.category, column: change.column, oldValue: change.oldValue, newValue: change.newValue
        });
      }
    }

    td.innerHTML = formatCellDisplay(rowIdx, colIdx);
    delete td.dataset.originalHtml;
    updateFormulaBar(true);
    updateMetrics();
  }

  function cancelCellEdit(td) {
    if (!td) return;
    state.isEditing = false;
    td.classList.remove('is-editing');
    const rowIdx = Number(td.dataset.row);
    const colIdx = Number(td.dataset.col);
    if (td.dataset.originalHtml) {
      td.innerHTML = td.dataset.originalHtml;
      delete td.dataset.originalHtml;
    } else if (Number.isFinite(rowIdx) && Number.isFinite(colIdx)) {
      td.innerHTML = formatCellDisplay(rowIdx, colIdx);
    }
    updateFormulaBar(true);
    td.focus();
  }

  function confirmFormulaEdit() {
    if (!state.activeCell.td || !state.canEdit) return;
    const val = dom.formulaInput ? dom.formulaInput.value : '';
    commitCellEdit(state.activeCell.td, val);
    if (state.activeCell.td) {
      state.activeCell.td.focus();
    }
  }

  function cancelFormulaEdit() {
    if (!state.activeCell.td) return;
    if (state.isEditing) {
      cancelCellEdit(state.activeCell.td);
    } else {
      const rowIdx = state.activeCell.rowIdx;
      const colIdx = state.activeCell.colIdx;
      if (Number.isFinite(rowIdx) && Number.isFinite(colIdx)) {
        state.activeCell.td.innerHTML = formatCellDisplay(rowIdx, colIdx);
      }
      updateFormulaBar(true);
    }
    state.activeCell.td.focus();
  }

  function navigateCell(rowDelta, colDelta) {
    if (!state.activeCell.td) return;
    const allRows = [...dom.table.querySelectorAll('tbody tr.excel-data-row')];
    const currentTr = state.activeCell.td.closest('tr.excel-data-row');
    const currentRowIndex = allRows.indexOf(currentTr);
    if (currentRowIndex === -1) return;

    const rowCells = [...currentTr.querySelectorAll('.excel-cell')];
    const currentColIndex = rowCells.indexOf(state.activeCell.td);
    if (currentColIndex === -1) return;

    let nextRowIndex = currentRowIndex + rowDelta;
    let nextColIndex = currentColIndex + colDelta;

    if (colDelta > 0 && nextColIndex >= rowCells.length) {
      nextRowIndex++;
      nextColIndex = 0;
    } else if (colDelta < 0 && nextColIndex < 0) {
      nextRowIndex--;
      const prevRowCells = allRows[nextRowIndex]?.querySelectorAll('.excel-cell');
      nextColIndex = prevRowCells ? prevRowCells.length - 1 : 0;
    }

    if (nextRowIndex >= 0 && nextRowIndex < allRows.length) {
      const targetRow = allRows[nextRowIndex];
      const targetCells = [...targetRow.querySelectorAll('.excel-cell')];
      const targetCell = targetCells[Math.min(nextColIndex, targetCells.length - 1)];
      if (targetCell) {
        selectCell(targetCell, false);
      }
    }
  }


  function getHistoryPageSize() {
    const select = $('#historyPageSizeSelect');
    const val = Number(state.historyPageSize || (select ? select.value : 10));
    return Number.isFinite(val) && val > 0 ? val : 10;
  }

  function updatePaginationControls(totalItems, currentPage, pageSize, pluralNoun = 'items', singleNoun = 'item') {
    const showingLabel = $('#historyShowingLabel');
    const firstBtn = $('#historyFirstBtn');
    const prevBtn = $('#historyPrevBtn');
    const nextBtn = $('#historyNextBtn');
    const lastBtn = $('#historyLastBtn');
    const pageNumbers = $('#historyPageNumbers');
    const sizeSelect = $('#historyPageSizeSelect');

    if (sizeSelect && String(sizeSelect.value) !== String(pageSize)) {
      sizeSelect.value = String(pageSize);
    }

    if (!totalItems || totalItems <= 0) {
      if (showingLabel) showingLabel.textContent = `Showing 0 of 0 ${pluralNoun}`;
      if (firstBtn) firstBtn.disabled = true;
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      if (lastBtn) lastBtn.disabled = true;
      if (pageNumbers) pageNumbers.innerHTML = '';
      return { totalPages: 1, startIdx: 0, endIdx: 0, pageSize };
    }

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const validPage = Math.min(Math.max(1, currentPage || 1), totalPages);
    state.historyPage = validPage;

    const startIdx = (validPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalItems);

    const noun = totalItems === 1 ? singleNoun : pluralNoun;
    if (showingLabel) {
      showingLabel.textContent = `Showing ${startIdx + 1}–${endIdx} of ${totalItems} ${noun}`;
    }

    if (firstBtn) firstBtn.disabled = validPage <= 1;
    if (prevBtn) prevBtn.disabled = validPage <= 1;
    if (nextBtn) nextBtn.disabled = validPage >= totalPages;
    if (lastBtn) lastBtn.disabled = validPage >= totalPages;

    if (pageNumbers) {
      const pages = [];
      if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        let left = Math.max(2, validPage - 1);
        let right = Math.min(totalPages - 1, validPage + 1);

        if (validPage <= 3) {
          left = 2;
          right = 4;
        } else if (validPage >= totalPages - 2) {
          left = totalPages - 3;
          right = totalPages - 1;
        }

        if (left > 2) pages.push('ellipsis-left');
        for (let i = left; i <= right; i++) pages.push(i);
        if (right < totalPages - 1) pages.push('ellipsis-right');
        pages.push(totalPages);
      }

      pageNumbers.innerHTML = pages.map(p => {
        if (typeof p === 'string' && p.startsWith('ellipsis')) {
          return `<span class="history-page-ellipsis" aria-hidden="true">…</span>`;
        }
        const isActive = p === validPage;
        return `<button type="button" class="history-page-btn ${isActive ? 'active' : ''}" data-page="${p}" aria-label="Page ${p}" ${isActive ? 'aria-current="page"' : ''}>${p}</button>`;
      }).join('');
    }

    return { totalPages, startIdx, endIdx, pageSize };
  }

  function getLogFileName(log) {
    if (log?.metadata?.fileName) return log.metadata.fileName;
    if (log?.metadata?.versionName) return log.metadata.versionName;
    if (log?.metadata?.file) return log.metadata.file;
    return ['login', 'image_update', 'image_delete'].includes(log?.type) ? '—' : 'Unknown file';
  }

  function isLogCurrentFile(log) {
    const fileName = getLogFileName(log);
    const currentName = state.active?.name || 'Current file';
    return Boolean(fileName && currentName && fileName.trim().toLowerCase() === currentName.trim().toLowerCase());
  }

  function getAuditTypeLabel(type) {
    switch (type) {
      case 'price_adjust': return 'Price Adjust';
      case 'cell_edit': return 'Cell Edit';
      case 'save_version': return 'Saved Version';
      case 'row_add': return 'Added Row';
      case 'row_delete': return 'Deleted Row';
      case 'reset_prices': return 'Reset Prices';
      case 'import_workbook': return 'Upload';
      case 'delete_version': return 'Deleted';
      case 'approve_version': return 'Approved';
      case 'reject_version': return 'Rejected';
      case 'export_excel': return 'Excel Export';
      case 'export_pdf': return 'PDF Export';
      case 'image_update': return 'Photo Update';
      case 'image_delete': return 'Photo Removed';
      case 'login': return 'Sign-in';
      case 'dev_reset': return 'Data Reset';
      default: return 'Activity';
    }
  }

  /** 'changes' when the event altered prices/data, 'details' when there is more to show, null when the row says it all. */
  function auditInspectKind(type) {
    if (['cell_edit', 'price_adjust', 'reset_prices', 'save_version', 'row_add', 'row_delete'].includes(type)) return 'changes';
    if (['import_workbook', 'approve_version', 'reject_version', 'delete_version'].includes(type)) return 'details';
    return null;
  }
  function auditDayLabel(iso) {
    if (!iso) return 'Earlier';
    const date = new Date(iso);
    const startOf = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diffDays = Math.round((startOf(new Date()) - startOf(date)) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  }
  function getAuditDiffMarkup(log) {
    const meta = log.metadata || {};
    if (log.type === 'cell_edit') {
      const oldVal = String(meta.oldValue ?? '');
      const newVal = String(meta.newValue ?? '');
      return `
        <div class="audit-diff-pill">
          <span class="diff-chip old">${escapeHtml(oldVal || 'empty')}</span>
          <span class="diff-arrow">→</span>
          <span class="diff-chip new">${escapeHtml(newVal || 'empty')}</span>
        </div>`;
    }
    if (log.type === 'price_adjust') {
      const pct = Number(meta.percentage || 0);
      const sign = pct > 0 ? '+' : '';
      return `
        <div class="audit-diff-pill">
          <span class="history-adj-pill has-adj ${pct < 0 ? 'neg' : ''}">
            <span>${sign}${pct}%</span>
          </span>
          ${meta.category ? `<span class="diff-chip neutral">${escapeHtml(meta.category)}</span>` : ''}
        </div>`;
    }
    if (log.type === 'save_version') {
      const cats = Array.isArray(meta.adjustedCategories) ? meta.adjustedCategories.length : 0;
      const edits = Number(meta.changeCount || 0);
      const parts = [cats ? `${cats} categor${cats === 1 ? 'y' : 'ies'} adjusted` : '', edits ? `${edits} edit${edits === 1 ? '' : 's'}` : ''].filter(Boolean);
      return `<span class="diff-chip neutral">${escapeHtml(parts.join(' · ') || 'Original prices')}</span>`;
    }
    if (log.type === 'row_add') {
      return `<span class="diff-chip new">+ Added product</span>`;
    }
    if (log.type === 'row_delete') {
      return `<span class="diff-chip old">- Removed product</span>`;
    }
    if (log.type === 'reset_prices') {
      return `<span class="diff-chip neutral">Reset to original</span>`;
    }
    if (log.type === 'import_workbook') {
      return `<span class="diff-chip neutral">${Number(meta.rowCount || meta.productCount || 0).toLocaleString()} products</span>`;
    }
    if (log.type === 'approve_version') return `<span class="list-status-pill status-approved">Approved</span>`;
    if (log.type === 'reject_version') return `<span class="list-status-pill status-rejected">Rejected</span>`;
    if (log.type === 'export_excel' || log.type === 'export_pdf') return `<span class="diff-chip neutral">${log.type === 'export_pdf' ? 'PDF' : 'Excel'}</span>`;
    if (log.type === 'delete_version') return `<span class="diff-chip old">Removed</span>`;
    return '<span class="audit-no-action" aria-hidden="true">—</span>';
  }

  function showAuditLogModal(log) {
    const dialog = $('#historyChangesDialog');
    const kicker = $('#historyChangesKicker');
    const title = $('#historyChangesTitle');
    const meta = $('#historyChangesMeta');
    const content = $('#historyChangesContent');
    const actions = $('#historyChangesActions');
    if (!dialog || !title || !meta || !content) return;

    if (kicker) kicker.textContent = 'AUDIT EVENT INSPECTOR';
    title.textContent = log.title || 'Event Details';
    meta.textContent = `Action by ${log.actor || 'User'} (${log.role || 'user'}) • ${displayDate(log.timestamp)} (${formatRelativeTime(log.timestamp)})`;

    const logMeta = log.metadata || {};
    const fileName = getLogFileName(log);
    const isCurrent = isLogCurrentFile(log);
    const fileHeaderField = `
      <div class="audit-modal-field audit-modal-field-file">
        <span class="audit-modal-label">Target File / Workbook</span>
        <div class="audit-modal-file-box">
          <svg class="audit-file-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
          <strong class="audit-modal-file-name">${escapeHtml(fileName)}</strong>
          ${isCurrent ? `<span class="audit-current-file-badge"><span class="pulse-dot tiny"></span>Current file</span>` : ''}
        </div>
      </div>`;

    let bodyHtml = '';

    if (log.type === 'cell_edit') {
      const prodName = logMeta.productName || logMeta.product || 'Product';
      const prodCode = logMeta.productCode || logMeta.code || 'N/A';
      bodyHtml = `
        <div class="audit-modal-diff-card">
          <div class="audit-modal-grid">
            ${fileHeaderField}
            <div class="audit-modal-field">
              <span class="audit-modal-label">Product Name</span>
              <strong>${escapeHtml(prodName)}</strong>
            </div>
            <div class="audit-modal-field">
              <span class="audit-modal-label">Product Code</span>
              <code>${escapeHtml(prodCode)}</code>
            </div>
            <div class="audit-modal-field">
              <span class="audit-modal-label">Modified Column</span>
              <strong>${escapeHtml(logMeta.column || 'Spreadsheet Cell')}</strong>
            </div>
          </div>
          <div class="audit-diff-compare-box">
            <div class="audit-diff-side before">
              <span class="audit-diff-label">Previous Value</span>
              <div class="audit-diff-val old">${escapeHtml(String(logMeta.oldValue ?? '—'))}</div>
            </div>
            <div class="audit-diff-divider">➔</div>
            <div class="audit-diff-side after">
              <span class="audit-diff-label">New Value</span>
              <div class="audit-diff-val new">${escapeHtml(String(logMeta.newValue ?? '—'))}</div>
            </div>
          </div>
        </div>`;
    } else if (log.type === 'price_adjust') {
      const pct = Number(logMeta.percentage || 0);
      const sign = pct > 0 ? '+' : '';
      bodyHtml = `
        <div class="audit-modal-diff-card">
          <div class="audit-modal-grid">
            ${fileHeaderField}
            <div class="audit-modal-field">
              <span class="audit-modal-label">Scope</span>
              <strong>${escapeHtml(logMeta.category || (logMeta.isAllCategories || logMeta.applyAll ? 'All Categories' : 'Category Adjustment'))}</strong>
            </div>
            <div class="audit-modal-field">
              <span class="audit-modal-label">Adjustment Rate</span>
              <span class="history-adj-pill has-adj ${pct < 0 ? 'neg' : ''}" style="width:fit-content;"><strong>${sign}${pct}%</strong></span>
            </div>
            <div class="audit-modal-field">
              <span class="audit-modal-label">Affected Count</span>
              <strong>${Number(logMeta.adjustedProducts || logMeta.productCount || 0).toLocaleString()} products</strong>
            </div>
          </div>
          <div class="audit-modal-note">${escapeHtml(log.details || 'Percentage adjustment applied to active price list.')}</div>
        </div>`;
    } else if (log.type === 'save_version') {
      const targetVersion = (state.versions || []).find(v => String(v.id) === String(logMeta.versionId));
      if (targetVersion && targetVersion.summary && Array.isArray(targetVersion.summary.adjustedCategories) && targetVersion.summary.adjustedCategories.length > 0) {
        const catRows = targetVersion.summary.adjustedCategories.map(cat => {
          const num = Number(cat.adjustment || 0);
          const sign = num > 0 ? '+' : '';
          const cls = num > 0 ? 'pos' : num < 0 ? 'neg' : 'zero';
          return `
            <div class="history-change-item">
              <div>
                <strong>${escapeHtml(cat.category)}</strong>
                ${cat.productCount ? `<div class="history-change-subtext">${cat.productCount} pcs</div>` : ''}
              </div>
              <span class="change-badge ${cls}">${sign}${num}%</span>
            </div>`;
        }).join('');
        bodyHtml = `
          <div class="audit-modal-diff-card">
            <div class="audit-modal-grid">
              ${fileHeaderField}
            </div>
            <div class="history-changes-content">${catRows}</div>
          </div>`;
      } else {
        bodyHtml = `
          <div class="audit-modal-diff-card">
            <div class="audit-modal-grid">
              ${fileHeaderField}
            </div>
            <div class="audit-modal-note">${escapeHtml(log.details || 'Saved price list snapshot created.')}</div>
          </div>`;
      }
    } else if (log.type === 'row_add' || log.type === 'row_delete') {
      bodyHtml = `
        <div class="audit-modal-diff-card">
          <div class="audit-modal-grid">
            ${fileHeaderField}
            <div class="audit-modal-field">
              <span class="audit-modal-label">Product Name</span>
              <strong>${escapeHtml(logMeta.product || logMeta.productName || 'Product')}</strong>
            </div>
            <div class="audit-modal-field">
              <span class="audit-modal-label">Product Code</span>
              <code>${escapeHtml(logMeta.code || logMeta.productCode || 'N/A')}</code>
            </div>
            <div class="audit-modal-field">
              <span class="audit-modal-label">Category</span>
              <strong>${escapeHtml(logMeta.category || 'Price list')}</strong>
            </div>
          </div>
          <div class="audit-modal-note">${escapeHtml(log.details || '')}</div>
        </div>`;
    } else if (log.type === 'import_workbook') {
      bodyHtml = `
        <div class="audit-modal-diff-card">
          <div class="audit-modal-grid">
            ${fileHeaderField}
            <div class="audit-modal-field">
              <span class="audit-modal-label">Spreadsheet File</span>
              <strong>${escapeHtml(logMeta.fileName || 'Excel Workbook')}</strong>
            </div>
            <div class="audit-modal-field">
              <span class="audit-modal-label">Imported Rows</span>
              <strong>${Number(logMeta.rowCount || 0).toLocaleString()} products</strong>
            </div>
            <div class="audit-modal-field">
              <span class="audit-modal-label">Category Count</span>
              <strong>${Number(logMeta.categoryCount || 0).toLocaleString()} categories</strong>
            </div>
          </div>
          <div class="audit-modal-note">${escapeHtml(log.details || 'New spreadsheet imported into editor.')}</div>
        </div>`;
    } else if (log.type === 'reset_prices') {
      bodyHtml = `
        <div class="audit-modal-diff-card">
          <div class="audit-modal-grid">
            ${fileHeaderField}
            <div class="audit-modal-field">
              <span class="audit-modal-label">Action</span>
              <strong>Reset Price Adjustments</strong>
            </div>
            <div class="audit-modal-field">
              <span class="audit-modal-label">Resulting State</span>
              <span class="history-adj-pill neutral">Original prices</span>
            </div>
          </div>
          <div class="audit-modal-note">${escapeHtml(log.details || 'All category and product percentage adjustments cleared.')}</div>
        </div>`;
    } else {
      bodyHtml = `
        <div class="audit-modal-diff-card">
          <div class="audit-modal-grid">
            ${fileHeaderField}
          </div>
          <div class="audit-modal-note">${escapeHtml(log.details || log.title || 'Audit event record.')}</div>
        </div>`;
    }

    content.innerHTML = bodyHtml;

    if (actions) {
      if (logMeta.versionId && versionSummaryById(logMeta.versionId)) {
        actions.innerHTML = `
          <button type="button" class="button primary open-version" data-id="${escapeHtml(logMeta.versionId)}">Open in workspace</button>
          <button value="cancel" class="button secondary">Close</button>`;
      } else {
        actions.innerHTML = `<button value="cancel" class="button secondary">Close</button>`;
      }
    }

    dialog.showModal();
  }

  function renderHistory() {
    if (!dom.historyTableBody) return;

    // 1. Update tab count badges
    const allLogs = state.auditLogs || [];
    const editLogs = allLogs.filter(l => ['cell_edit', 'price_adjust', 'row_add', 'row_delete', 'reset_prices'].includes(l.type));
    const workflowLogs = allLogs.filter(l => ['import_workbook', 'save_version', 'approve_version', 'reject_version', 'export_excel', 'export_pdf', 'delete_version'].includes(l.type));
    const versionItems = [];

    if (dom.auditAllCountBadge) dom.auditAllCountBadge.textContent = String(allLogs.length);
    if (dom.auditEditsCountBadge) dom.auditEditsCountBadge.textContent = String(editLogs.length);
    if (dom.auditVersionsCountBadge) dom.auditVersionsCountBadge.textContent = String(workflowLogs.length);

    // 2. Update active tab button style
    $$('.audit-tab-btn[data-audit-tab]').forEach(btn => {
      const isActive = (btn.dataset.auditTab || 'all') === (state.auditTab || 'all');
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    // 3. Populate unique users and files in filter dropdowns
    const userSelect = $('#auditUserSelect');
    if (userSelect) {
      const currentUserVal = state.auditUser || '';
      const actors = new Set();
      allLogs.forEach(l => { if (l.actor) actors.add(l.actor); });
      versionItems.forEach(v => { if (v.savedBy) actors.add(v.savedBy); });
      const sortedActors = [...actors].sort();
      let optionsHtml = '<option value="">All Users</option>';
      sortedActors.forEach(actor => {
        optionsHtml += `<option value="${escapeHtml(actor)}" ${actor === currentUserVal ? 'selected' : ''}>${escapeHtml(actor)}</option>`;
      });
      userSelect.innerHTML = optionsHtml;
    }

    const fileSelect = $('#auditFileSelect');
    if (fileSelect) {
      const currentVal = state.auditFile || '';
      const files = new Set();
      const currentActiveName = state.active?.name || '';
      allLogs.forEach(l => {
        const fn = getLogFileName(l);
        if (fn) files.add(fn);
      });
      if (currentActiveName) files.add(currentActiveName);
      versionItems.forEach(v => {
        if (v.name) files.add(v.name);
      });

      let optionsHtml = '<option value="">All Files</option>';
      if (currentActiveName) {
        optionsHtml += `<option value="__current__" ${currentVal === '__current__' ? 'selected' : ''}>📍 Current file: ${escapeHtml(currentActiveName)}</option>`;
      }
      [...files].sort().forEach(fn => {
        if (fn === currentActiveName) return;
        optionsHtml += `<option value="${escapeHtml(fn)}" ${fn === currentVal ? 'selected' : ''}>${escapeHtml(fn)}</option>`;
      });
      fileSelect.innerHTML = optionsHtml;
    }

    const query = (state.historySearch || '').trim().toLowerCase();
    const showingLabel = $('#historyShowingLabel');
    const prevBtn = $('#historyPrevBtn');
    const nextBtn = $('#historyNextBtn');
    const pageLabel = $('#historyPageLabel');
    const auditHead = $('#auditTableHead');
    const versionsHead = $('#versionsTableHead');
    const emptyTitle = $('#historyEmptyTitle');
    const emptySubtitle = $('#historyEmptySubtitle');
    const fileWrapper = $('#auditFileSelectWrapper');
    const typeWrapper = $('#auditTypeSelectWrapper');
    const userWrapper = $('#auditUserSelectWrapper');
    const adjWrapper = $('#historyAdjustmentSelectWrapper');

    // 5. Handle "All Activity" and "Price & Cell Edits" mode
    if (auditHead) auditHead.hidden = false;
    if (versionsHead) versionsHead.hidden = true;
    if (fileWrapper) fileWrapper.hidden = false;
    if (typeWrapper) typeWrapper.hidden = false;
    if (userWrapper) userWrapper.hidden = false;
    if (adjWrapper) adjWrapper.hidden = true;

    const baseList = state.auditTab === 'edits' ? editLogs : state.auditTab === 'workflow' ? workflowLogs : allLogs;
    const typeFilter = state.auditType || '';
    const userFilter = state.auditUser || '';
    const fileFilter = state.auditFile || '';

    const filteredLogs = baseList.filter(log => {
      const logFile = getLogFileName(log);
      const isCurrent = isLogCurrentFile(log);

      let matchesFile = true;
      if (fileFilter === '__current__') {
        matchesFile = isCurrent;
      } else if (fileFilter) {
        matchesFile = logFile === fileFilter;
      }

      const matchesQuery = !query ||
        String(log.title || '').toLowerCase().includes(query) ||
        String(log.details || '').toLowerCase().includes(query) ||
        String(log.actor || '').toLowerCase().includes(query) ||
        String(log.metadata?.product || '').toLowerCase().includes(query) ||
        String(log.metadata?.productName || '').toLowerCase().includes(query) ||
        String(log.metadata?.category || '').toLowerCase().includes(query) ||
        String(logFile).toLowerCase().includes(query) ||
        (isCurrent && 'current file'.includes(query));

      const matchesType = !typeFilter || log.type === typeFilter;
      const matchesUser = !userFilter || String(log.actor || '') === userFilter;
      return matchesQuery && matchesType && matchesUser && matchesFile;
    });

    if (dom.historyCount) dom.historyCount.textContent = `${filteredLogs.length} item${filteredLogs.length === 1 ? '' : 's'}`;

    const pageSize = getHistoryPageSize();

    if (!filteredLogs.length) {
      dom.historyTableBody.innerHTML = '';
      if (dom.historyEmpty) dom.historyEmpty.hidden = false;
      if (emptyTitle) emptyTitle.textContent = 'No audit log records found';
      if (emptySubtitle) emptySubtitle.textContent = 'Activity matching your filters will appear here in chronological order.';
      updatePaginationControls(0, 1, pageSize, 'items', 'item');
      return;
    }

    if (dom.historyEmpty) dom.historyEmpty.hidden = true;

    const { startIdx, endIdx } = updatePaginationControls(filteredLogs.length, state.historyPage, pageSize, 'items', 'item');
    const pageItems = filteredLogs.slice(startIdx, endIdx);

    let previousDay = '';
    dom.historyTableBody.innerHTML = pageItems.map(log => {
      const typeLabel = getAuditTypeLabel(log.type);
      const icon = getAuditTypeIcon(log.type);
      const inspect = auditInspectKind(log.type);
      const role = String(log.role || 'user').toLowerCase();
      const roleLabel = role === 'admin' ? 'Admin' : role === 'user' ? 'Export only' : role;
      const fileName = getLogFileName(log);
      const hasFile = !['login', 'image_update', 'image_delete'].includes(log.type) && fileName && fileName !== 'Unknown file';
      const isCurrent = hasFile && isLogCurrentFile(log);
      const day = auditDayLabel(log.timestamp);
      const divider = day !== previousDay ? `<tr class="audit-day-row"><td colspan="6">${escapeHtml(day)}</td></tr>` : '';
      previousDay = day;
      const time = log.timestamp ? new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' }).format(new Date(log.timestamp)) : '';

      return `${divider}
        <tr class="history-data-row audit-event-row ${inspect ? 'is-inspectable' : ''}" ${inspect ? `data-log-id="${escapeHtml(log.id)}"` : ''}>
          <td class="history-date-cell">
            <div class="audit-time-main">${escapeHtml(time)}</div>
            <div class="audit-time-relative">${formatRelativeTime(log.timestamp)}</div>
          </td>
          <td class="history-by-cell">
            <div class="audit-actor-wrap">
              <span class="audit-actor-name">${escapeHtml(log.actor || 'User')}</span>
              <span class="audit-role-pill ${role}">${escapeHtml(roleLabel)}</span>
            </div>
          </td>
          <td class="audit-type-cell">
            <span class="audit-type-badge type-${escapeHtml(log.type || 'info')}">
              ${icon}
              <span>${typeLabel}</span>
            </span>
          </td>
          <td class="audit-desc-cell">
            <div class="audit-title-text">${escapeHtml(log.title || 'Price List Event')}</div>
            ${log.details ? `<div class="audit-details-text">${escapeHtml(log.details)}</div>` : ''}
            ${hasFile ? `<div class="audit-file-tag" title="${escapeHtml(fileName)}">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
              <span>${escapeHtml(fileName)}</span>${isCurrent ? '<em>Open now</em>' : ''}
            </div>` : ''}
          </td>
          <td class="audit-diff-cell">
            ${getAuditDiffMarkup(log)}
          </td>
          <td class="history-actions-cell">
            ${inspect
              ? `<button type="button" class="history-view-changes-btn view-audit-diff-btn" data-log-id="${escapeHtml(log.id)}">${inspect === 'changes' ? 'View changes' : 'View details'} ›</button>`
              : '<span class="audit-no-action" aria-hidden="true">—</span>'}
          </td>
        </tr>`;
    }).join('');
  }
  // --- Country › Price level › Price list navigator (one saved price list per country) ---
  function sameText(a, b) {
    return String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
  }
  function navigableVersions() {
    return (state.versions || []).filter(version => version.status !== 'superseded' && version.country);
  }
  function renderNavigator() {
    const lists = navigableVersions();
    const active = state.active;
    const isDraft = Boolean(active && (active.isDraft || !active.id));
    const option = (value, label) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
    // Group countries case-insensitively so older lists with different spelling share one entry.
    const countries = [];
    [...lists.map(version => version.country), active?.country].forEach(value => {
      const text = String(value || '').trim();
      if (text && !countries.some(country => sameText(country, text))) countries.push(canonicalCountry(text) || text);
    });
    countries.sort((a, b) => a.localeCompare(b));
    $$('.nav-cascade').forEach(box => {
      const countrySelect = box.querySelector('.nav-country');
      const levelSelect = box.querySelector('.nav-level');
      const listSelect = box.querySelector('.nav-list');
      const country = box.dataset.cascade === 'empty' ? '' : (active?.country || '');
      const level = country ? (active?.priceLevel || '') : '';
      countrySelect.innerHTML = (country ? '' : option('', 'Choose country…')) + countries.map(value => option(value, value)).join('');
      countrySelect.value = countries.find(value => sameText(value, country)) || country;
      const levels = uniqueValues([...lists.filter(version => sameText(version.country, country)).map(version => version.priceLevel), level]);
      levelSelect.innerHTML = levels.length ? levels.map(value => option(value, value)).join('') : option('', '—');
      levelSelect.value = level;
      levelSelect.disabled = !country;
      const files = lists.filter(version => sameText(version.country, country) && sameText(version.priceLevel, level));
      listSelect.innerHTML = (isDraft && country ? option('__draft__', `Unsaved: ${active.name}`) : '')
        + files.map(version => option(version.id, `${version.name}${version.revision > 1 ? ` (rev ${version.revision})` : ''}${box.dataset.cascade === 'empty' ? ` · ${statusLabel(version.status)}` : ''}`)).join('')
        || option('', '—');
      listSelect.value = isDraft ? '__draft__' : String(active?.id || '');
      listSelect.disabled = !country;
    });
    // Pills have fixed widths, so long values are truncated; the full text is shown on hover.
    $$('.nav-cascade select').forEach(select => { select.title = select.selectedOptions[0]?.textContent || ''; });
    if (dom.category) dom.category.title = dom.category.selectedOptions[0]?.textContent || '';
    const emptyOpen = $('#emptyOpenSaved');
    if (emptyOpen) emptyOpen.hidden = Boolean(active) || !lists.length;
    renderSwitcherButton();
    if (!$('#listSwitcherMenu')?.hidden) renderSwitcherMenu();
  }
  async function openFromNavigator(id) {
    if (!id || id === '__draft__') return renderNavigator();
    if (String(id) === String(state.active?.id) && !state.active?.isDraft) return renderNavigator();
    try {
      const opened = await openVersion(id, { stay: true });
      if (!opened) renderNavigator();
    } catch (error) {
      toast(error.message);
      renderNavigator();
    }
  }
  document.addEventListener('change', event => {
    const select = event.target.closest('.nav-cascade select');
    if (!select) return;
    const box = select.closest('.nav-cascade');
    const lists = navigableVersions();
    if (select.classList.contains('nav-country')) {
      // Newest list for that country, keeping the current price level when that country has it.
      const forCountry = lists.filter(version => sameText(version.country, select.value));
      const target = forCountry.find(version => version.priceLevel === state.active?.priceLevel) || forCountry[0];
      openFromNavigator(target?.id);
    } else if (select.classList.contains('nav-level')) {
      const country = box.querySelector('.nav-country').value;
      openFromNavigator(lists.find(version => sameText(version.country, country) && sameText(version.priceLevel, select.value))?.id);
    } else if (select.classList.contains('nav-list')) {
      openFromNavigator(select.value);
    }
  });

  // --- Files panel: every uploaded price list (no approval needed) ---
  const filesView = { search: '', country: '', level: '' };
  function renderFiles() {
    const body = $('#filesTableBody');
    if (!body) return;
    const files = (state.versions || []).filter(version => version.source === 'upload');
    filesView.country = fillSelect($('#filesCountryFilter'), uniqueValues(files.map(v => v.country)), 'All countries', filesView.country);
    filesView.level = fillSelect($('#filesLevelFilter'), uniqueValues(files.map(v => v.priceLevel)), 'All price levels', filesView.level);
    const query = filesView.search.trim().toLowerCase();
    const visible = files.filter(version =>
      (!filesView.country || version.country === filesView.country) &&
      (!filesView.level || version.priceLevel === filesView.level) &&
      (!query || [version.name, version.savedBy, version.country, version.priceLevel].some(value => String(value || '').toLowerCase().includes(query))));
    $('#filesCount').textContent = `${visible.length} file${visible.length === 1 ? '' : 's'}`;
    $('#filesEmpty').hidden = visible.length > 0;
    $('#filesEmptyText').textContent = files.length ? 'No files match these filters.' : (can('upload') ? 'Use “Upload files” to add price lists. Uploads need no approval.' : 'Uploaded price lists will appear here.');
    body.innerHTML = visible.map(version => {
      const vid = escapeHtml(version.id);
      const isOpen = String(state.active?.id) === String(version.id);
      const live = version.status === 'uploaded';
      // A newer revision (another upload or approved price changes) replaces this one.
      const newer = live ? null : (state.versions || []).find(other => other.id !== version.id && ['approved', 'uploaded'].includes(other.status)
        && sameText(other.name, version.name) && sameText(other.country, version.country) && sameText(other.priceLevel, version.priceLevel));
      const statusDetail = live ? 'Original prices · exportable' : newer ? (newer.source === 'upload' ? `Replaced by a newer upload (rev ${newer.revision})` : `Price changes approved (rev ${newer.revision})`) : 'Replaced by a newer revision';
      return `<tr class="history-data-row ${isOpen ? 'is-open-row' : ''}">
        <td class="history-name-cell"><strong class="list-name">${escapeHtml(version.name)}${isOpen ? ' <span class="open-now-tag">Open in editor</span>' : ''}</strong><div class="list-sub">${version.revision > 1 ? `Revision ${version.revision} · ` : ''}${Number(version.productCount || 0).toLocaleString()} products</div></td>
        <td>${escapeHtml(version.country || '—')}</td>
        <td>${escapeHtml(version.priceLevel || '—')}</td>
        <td class="history-date-cell"><div class="audit-time-main">${displayDate(version.savedAt)}</div><div class="audit-time-relative">by ${escapeHtml(version.savedBy || '')}</div></td>
        <td><span class="list-status-pill status-${live ? 'uploaded' : 'superseded'}">${live ? 'Uploaded' : 'Replaced'}</span><div class="list-sub">${escapeHtml(statusDetail)}</div></td>
        <td class="col-actions"><div class="list-actions"><button type="button" class="row-primary" data-action="open" data-id="${vid}">${isOpen ? 'Go to editor' : 'Open'}</button><button type="button" class="kebab-btn" data-id="${vid}" aria-haspopup="menu" aria-expanded="false" aria-label="More actions for ${escapeHtml(version.name)}" title="More actions"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="12" cy="19" r="1.9"/></svg></button></div></td>
      </tr>`;
    }).join('');
  }
  $('#filesSearchInput')?.addEventListener('input', event => { filesView.search = event.target.value; renderFiles(); });
  $('#filesCountryFilter')?.addEventListener('change', event => { filesView.country = event.target.value; renderFiles(); });
  $('#filesLevelFilter')?.addEventListener('change', event => { filesView.level = event.target.value; renderFiles(); });
  $('#filesUploadBtn')?.addEventListener('click', () => openUploadModal());

  // --- Price list switcher: one pill that opens a Country › Price level › Price list cascade ---
  const switcher = { country: '', level: '', query: '' };
  const switcherMenu = $('#listSwitcherMenu');
  const switcherButton = $('#listSwitcher');
  function switcherCountries(lists) {
    const countries = [];
    lists.forEach(version => {
      const text = String(version.country || '').trim();
      const existing = countries.find(entry => sameText(entry.name, text));
      if (existing) existing.count++;
      else if (text) countries.push({ name: canonicalCountry(text) || text, count: 1 });
    });
    return countries.sort((a, b) => a.name.localeCompare(b.name));
  }
  function renderSwitcherButton() {
    if (!switcherButton) return;
    const active = state.active;
    const isDraft = Boolean(active && (active.isDraft || !active.id));
    const country = active?.country || '—';
    const level = active?.priceLevel || '—';
    const list = active ? `${active.name}${active.revision > 1 ? ` (rev ${active.revision})` : ''}${isDraft ? ' · unsaved' : ''}` : '—';
    $('#lsCountry').textContent = country;
    $('#lsLevel').textContent = level;
    $('#lsList').textContent = list;
    switcherButton.title = `${country} › ${level} › ${list}. Click to switch price list.`;
  }
  function renderSwitcherMenu() {
    if (!switcherMenu) return;
    const lists = navigableVersions();
    const query = switcher.query.trim().toLowerCase();
    // Search matches the country name, a price level, or a price list name.
    const matches = version => !query || [version.country, version.priceLevel, version.name].some(value => String(value || '').toLowerCase().includes(query));
    const visibleLists = lists.filter(matches);
    const countries = switcherCountries(visibleLists);
    if (!countries.some(entry => sameText(entry.name, switcher.country))) switcher.country = countries[0]?.name || '';
    const forCountry = visibleLists.filter(version => sameText(version.country, switcher.country));
    const levels = uniqueValues(forCountry.map(version => version.priceLevel));
    if (!levels.some(level => sameText(level, switcher.level))) switcher.level = levels[0] || '';
    const files = forCountry.filter(version => sameText(version.priceLevel, switcher.level));
    const active = state.active;
    const item = (kind, value, label, { meta = '', highlight = false, current = false, arrow = false } = {}) =>
      `<button type="button" class="lsm-item ${highlight ? 'is-highlight' : ''} ${current ? 'is-current' : ''}" data-kind="${kind}" data-value="${escapeHtml(value)}" role="option" aria-selected="${highlight || current}">
        <span class="lsm-label">${escapeHtml(label)}</span>${meta ? `<span class="lsm-meta">${escapeHtml(meta)}</span>` : ''}${arrow ? '<span class="lsm-arrow" aria-hidden="true">›</span>' : ''}</button>`;
    $('#lsmCountries').innerHTML = countries.map(entry => item('country', entry.name, entry.name, {
      meta: String(entry.count), highlight: sameText(entry.name, switcher.country), current: sameText(entry.name, active?.country), arrow: true
    })).join('') || '<p class="lsm-empty">No matches</p>';
    $('#lsmLevels').innerHTML = levels.map(level => item('level', level, level, {
      meta: String(forCountry.filter(version => sameText(version.priceLevel, level)).length),
      highlight: sameText(level, switcher.level),
      current: sameText(level, active?.priceLevel) && sameText(switcher.country, active?.country), arrow: true
    })).join('') || '<p class="lsm-empty">—</p>';
    $('#lsmLists').innerHTML = files.map(version => item('list', version.id, `${version.name}${version.revision > 1 ? ` (rev ${version.revision})` : ''}`, {
      meta: statusLabel(version.status), current: String(version.id) === String(active?.id)
    })).join('') || '<p class="lsm-empty">—</p>';
  }
  function positionSwitcherMenu() {
    const rect = switcherButton.getBoundingClientRect();
    const width = Math.min(680, window.innerWidth - 32);
    switcherMenu.style.width = `${width}px`;
    switcherMenu.style.top = `${Math.round(rect.bottom + 6)}px`;
    switcherMenu.style.left = `${Math.round(Math.max(16, Math.min(rect.left, window.innerWidth - width - 16)))}px`;
  }
  function toggleSwitcher(open) {
    if (!switcherMenu || !switcherButton) return;
    if (open) {
      if (typeof toggleCategoryMenu === 'function') toggleCategoryMenu(false);
      switcher.country = state.active?.country || '';
      switcher.level = state.active?.priceLevel || '';
      switcher.query = '';
      $('#lsmSearch').value = '';
      renderSwitcherMenu();
      switcherMenu.hidden = false;
      positionSwitcherMenu();
      requestAnimationFrame(() => $('#lsmSearch').focus());
    } else {
      switcherMenu.hidden = true;
    }
    switcherButton.setAttribute('aria-expanded', String(open));
    switcherButton.classList.toggle('is-open', open);
  }
  switcherButton?.addEventListener('click', event => {
    event.stopPropagation();
    toggleSwitcher(switcherMenu.hidden);
  });
  // Hovering a country or level previews the next column; clicking works too (touch, keyboard).
  const pickSwitcherItem = (button, fromHover) => {
    const { kind, value } = button.dataset;
    if (kind === 'country' && !sameText(switcher.country, value)) { switcher.country = value; switcher.level = ''; renderSwitcherMenu(); }
    else if (kind === 'level' && !sameText(switcher.level, value)) { switcher.level = value; renderSwitcherMenu(); }
    else if (kind === 'list' && !fromHover) { toggleSwitcher(false); openFromNavigator(value); }
  };
  switcherMenu?.addEventListener('mouseover', event => {
    const button = event.target.closest('.lsm-item');
    if (button && button.dataset.kind !== 'list') pickSwitcherItem(button, true);
  });
  switcherMenu?.addEventListener('click', event => {
    event.stopPropagation();
    const button = event.target.closest('.lsm-item');
    if (button) pickSwitcherItem(button, false);
  });
  $('#lsmSearch')?.addEventListener('input', event => { switcher.query = event.target.value; renderSwitcherMenu(); });
  $('#lsmSearch')?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const first = $('#lsmLists .lsm-item');
      if (first) pickSwitcherItem(first, false);
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && switcherMenu && !switcherMenu.hidden) { event.preventDefault(); toggleSwitcher(false); switcherButton.focus(); }
  });
  document.addEventListener('click', event => {
    if (switcherMenu && !switcherMenu.hidden && !event.target.closest('#listSwitcherMenu') && !event.target.closest('#listSwitcher')) toggleSwitcher(false);
  });
  window.addEventListener('resize', () => { if (!switcherMenu?.hidden) toggleSwitcher(false); });

  // --- Category picker: styled button + menu; the hidden #categorySelect stays the source of truth ---
  const categoryMenu = $('#categoryMenu');
  const categoryPicker = $('#categoryPicker');
  let categoryQuery = '';
  function categoryCounts() {
    const counts = new Map();
    (state.rows || []).forEach(row => {
      const name = String(row[COL.category] ?? '').trim();
      if (name) counts.set(name, (counts.get(name) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }
  function renderCategoryPicker() {
    if (!categoryPicker) return;
    const counts = categoryCounts();
    const current = state.category || '';
    const count = current ? (counts.find(([name]) => name === current)?.[1] || 0) : (state.rows || []).length;
    $('#cpLabel').textContent = current || 'All categories';
    $('#cpCount').textContent = String(count);
    categoryPicker.classList.toggle('is-filtered', Boolean(current));
    categoryPicker.title = `${current || 'All categories'} · ${count} product${count === 1 ? '' : 's'}`;
    if (!categoryMenu?.hidden) renderCategoryMenu();
  }
  function renderCategoryMenu() {
    const counts = categoryCounts();
    const query = categoryQuery.trim().toLowerCase();
    const current = state.category || '';
    const entries = [['', 'All categories', (state.rows || []).length], ...counts.map(([name, count]) => [name, name, count])]
      .filter(([value, label]) => !query || !value || label.toLowerCase().includes(query));
    $('#categoryMenuSearchWrap').hidden = counts.length < 7;
    $('#categoryMenuList').innerHTML = entries.map(([value, label, count]) =>
      `<button type="button" class="lsm-item ${value === current ? 'is-highlight is-current' : ''} ${value ? '' : 'cm-all'}" data-category="${escapeHtml(value)}" role="option" aria-selected="${value === current}">
        <span class="lsm-label">${escapeHtml(label)}</span><span class="lsm-meta">${count}</span></button>`).join('')
      || '<p class="lsm-empty">No matching categories</p>';
  }
  function toggleCategoryMenu(open) {
    if (!categoryMenu || !categoryPicker) return;
    if (open) {
      if (typeof toggleSwitcher === 'function') toggleSwitcher(false);
      categoryQuery = '';
      $('#categoryMenuSearch').value = '';
      renderCategoryMenu();
      categoryMenu.hidden = false;
      const rect = categoryPicker.getBoundingClientRect();
      const width = Math.max(rect.width, 260);
      categoryMenu.style.width = `${width}px`;
      categoryMenu.style.top = `${Math.round(rect.bottom + 6)}px`;
      categoryMenu.style.left = `${Math.round(Math.max(16, Math.min(rect.left, window.innerWidth - width - 16)))}px`;
      requestAnimationFrame(() => ($('#categoryMenuSearchWrap').hidden ? categoryMenu.querySelector('.lsm-item.is-current, .lsm-item') : $('#categoryMenuSearch'))?.focus());
    } else {
      categoryMenu.hidden = true;
    }
    categoryPicker.setAttribute('aria-expanded', String(open));
    categoryPicker.classList.toggle('is-open', open);
  }
  function chooseCategory(value) {
    toggleCategoryMenu(false);
    if (value === (state.category || '')) return;
    dom.category.value = value;
    dom.category.dispatchEvent(new Event('change'));
  }
  categoryPicker?.addEventListener('click', event => { event.stopPropagation(); toggleCategoryMenu(categoryMenu.hidden); });
  categoryMenu?.addEventListener('click', event => {
    event.stopPropagation();
    const item = event.target.closest('.lsm-item');
    if (item) chooseCategory(item.dataset.category || '');
  });
  categoryMenu?.addEventListener('keydown', event => {
    const items = [...categoryMenu.querySelectorAll('.lsm-item')];
    const index = items.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') { event.preventDefault(); items[Math.min(items.length - 1, index + 1)]?.focus(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); (index <= 0 ? $('#categoryMenuSearch') : items[index - 1])?.focus(); }
  });
  $('#categoryMenuSearch')?.addEventListener('input', event => { categoryQuery = event.target.value; renderCategoryMenu(); });
  $('#categoryMenuSearch')?.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); const first = [...categoryMenu.querySelectorAll('.lsm-item')].find(item => item.dataset.category) || categoryMenu.querySelector('.lsm-item'); if (first) chooseCategory(first.dataset.category || ''); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); categoryMenu.querySelector('.lsm-item')?.focus(); }
  });
  document.addEventListener('click', event => {
    if (categoryMenu && !categoryMenu.hidden && !event.target.closest('#categoryMenu') && !event.target.closest('#categoryPicker')) toggleCategoryMenu(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && categoryMenu && !categoryMenu.hidden) { event.preventDefault(); toggleCategoryMenu(false); categoryPicker.focus(); }
  });
  window.addEventListener('resize', () => { if (!categoryMenu?.hidden) toggleCategoryMenu(false); });

  // --- Approvals panel ---
  function statusPill(status) {
    return `<span class="list-status-pill status-${escapeHtml(status || 'pending')}">${escapeHtml(statusLabel(status))}</span>`;
  }
  function adjustmentPill(version) {
    const adjusted = version.summary?.adjustedCategories || [];
    if (!adjusted.length) return '<span class="history-adj-pill neutral" title="Prices as uploaded, no percentage adjustment">Original prices</span>';
    const rates = [...new Set(adjusted.map(item => Number(item.adjustment || 0)))];
    const text = rates.length === 1 ? `${rates[0] > 0 ? '+' : ''}${rates[0]}% · ${adjusted.length} categor${adjusted.length === 1 ? 'y' : 'ies'}` : `Varies · ${adjusted.length} categories`;
    return `<span class="history-adj-pill has-adj ${rates.every(rate => rate < 0) ? 'neg' : ''}">${escapeHtml(text)}</span>`;
  }
  /** Saved by a top approver (e.g. Ms. Gen) and approved on the spot, so it never went through the approval workflow. */
  function isAutoApproved(version) {
    return (version.approvals || []).some(approval => approval.auto);
  }
  function renderLists() {
    if (!dom.listsTableBody) return;
    // The Approvals page only shows price lists that go through approval. Auto-approved lists are
    // opened from Prices › Country and recorded in the Audit Logs.
    // Approvals = price changes only. Uploads live on the Files page; Ms. Gen's changes are approved on save.
    const versions = (state.versions || []).filter(version => version.source !== 'upload' && !isAutoApproved(version));
    const awaitingMine = versions.filter(version => version.canApprove);
    const approved = versions.filter(version => version.status === 'approved');
    dom.listAllCount.textContent = String(versions.length);
    dom.listMineCount.textContent = String(awaitingMine.length);
    dom.listApprovedCount.textContent = String(approved.length);
    if (dom.pendingApprovalCount) {
      dom.pendingApprovalCount.hidden = !awaitingMine.length;
      dom.pendingApprovalCount.textContent = String(awaitingMine.length);
    }
    if (dom.listsSubtitle) {
      dom.listsSubtitle.textContent = can('update')
        ? 'Review saved price changes and approval decisions.'
        : 'View and export approved price changes.';
    }
    $$('.list-tab-btn').forEach(button => {
      const active = button.dataset.listTab === state.listTab;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    state.listPriceLevel = fillSelect(dom.listPriceLevelFilter, uniqueValues(versions.map(v => v.priceLevel)), 'All price levels', state.listPriceLevel);
    state.listCountry = fillSelect(dom.listCountryFilter, uniqueValues(versions.map(v => v.country)), 'All countries', state.listCountry);

    const base = state.listTab === 'mine' ? awaitingMine : state.listTab === 'approved' ? approved : versions;
    const query = state.listSearch.trim().toLowerCase();
    const visible = base.filter(version =>
      (!state.listPriceLevel || version.priceLevel === state.listPriceLevel) &&
      (!state.listCountry || version.country === state.listCountry) &&
      (!state.listStatus || version.status === state.listStatus) &&
      (!query || [version.name, version.savedBy, version.priceLevel, version.country, ...(version.categories || [])].some(value => String(value || '').toLowerCase().includes(query))));

    dom.listCount.textContent = `${visible.length} price list${visible.length === 1 ? '' : 's'}`;
    dom.listsEmpty.hidden = visible.length > 0;
    if (!visible.length) {
      dom.listsEmptyTitle.textContent = state.listTab === 'mine' ? 'Nothing waiting for your approval' : versions.length ? 'No matching price lists' : 'No price lists in approval';
      dom.listsEmptyText.textContent = state.listTab === 'mine'
        ? 'New approval requests will appear here and in your notifications.'
        : versions.length ? 'Try different filters.'
        : state.autoApprove ? 'Your saves are approved immediately, so they don’t appear here. Open them from Prices › Country; every change is in the Audit Logs.'
        : can('update') ? 'Lists saved by Chelsea or Margaret appear here while they wait for approval.'
        : 'Approved price lists appear here once an approver signs off. Ms. Gen’s lists are under Prices › Country.';
    }
    dom.listsTableBody.innerHTML = visible.map(version => {
      const { approved: approvedBy, waiting } = approvalProgress(version);
      const isOpen = String(state.active?.id) === String(version.id);
      let statusDetail = '';
      if (version.status === 'pending') statusDetail = waiting.length ? `Waiting: ${waiting.join(state.approvalMode === 'all' ? ' & ' : ' or ')}` : '';
      else if (version.status === 'approved') statusDetail = `By ${version.approvedBy || approvedBy.join(' & ')}`;
      else if (version.status === 'rejected') statusDetail = `By ${version.rejectedBy || ''}${version.rejectionRemarks ? `: ${version.rejectionRemarks}` : ''}`;
      const vid = escapeHtml(version.id);
      // One contextual action per row; everything else lives in the kebab menu.
      const primary = version.canApprove
        ? `<button type="button" class="row-primary is-approve" data-action="approve" data-id="${vid}">Approve</button>`
        : `<button type="button" class="row-primary" data-action="open" data-id="${vid}">${isOpen ? 'Go to editor' : 'Open'}</button>`;
      const actions = `${primary}<button type="button" class="kebab-btn" data-id="${vid}" aria-haspopup="menu" aria-expanded="false" aria-label="More actions for ${escapeHtml(version.name)}" title="More actions"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="12" cy="19" r="1.9"/></svg></button>`;
      return `
        <tr class="history-data-row ${isOpen ? 'is-open-row' : ''}">
          <td class="history-name-cell">
            <strong class="list-name">${escapeHtml(version.name)}${isOpen ? ' <span class="open-now-tag">Open in editor</span>' : ''}</strong>
            <div class="list-sub">${version.revision > 1 ? `Revision ${version.revision} · ` : ''}${Number(version.productCount || 0).toLocaleString()} products${version.changeCount ? ` · ${Number(version.changeCount).toLocaleString()} cell edits` : ''}</div>
          </td>
          <td>${escapeHtml(version.priceLevel || '—')}</td>
          <td>${escapeHtml(version.country || '—')}</td>
          <td class="history-date-cell"><div class="audit-time-main">${displayDate(version.savedAt)}</div><div class="audit-time-relative">by ${escapeHtml(version.savedBy || '')}</div></td>
          <td>${adjustmentPill(version)}</td>
          <td>${version.canApprove ? '<span class="list-status-pill status-mine">Needs your approval</span>' : statusPill(version.status)}${statusDetail ? `<div class="list-sub" title="${escapeHtml(statusDetail)}">${escapeHtml(statusDetail)}</div>` : ''}</td>
          <td class="col-actions"><div class="list-actions">${actions}</div></td>
        </tr>`;
    }).join('');
  }

  function openFilePicker() { dom.fileInput.value = ''; dom.fileInput.click(); }

  // Files waiting in the upload modal: [{ file, name, country, priceLevel, status, message }]
  let stagedFiles = [];
  let bulkImporting = false;
  const MAX_BULK_FILES = 5;

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /** Country <option>s from the configured list; a legacy value not in the list is kept so it can be seen and changed. */
  function canonicalCountry(value) {
    const key = String(value || '').trim().toLowerCase();
    if (!key) return '';
    return (state.countries || []).find(country => country.toLowerCase() === key) || '';
  }
  function countryOptionsHtml(selected, placeholder = 'Select country…') {
    const current = canonicalCountry(selected) || String(selected || '').trim();
    const list = state.countries || [];
    const extra = current && !list.includes(current) ? [current] : [];
    return `<option value="">${escapeHtml(placeholder)}</option>`
      + [...extra, ...list].map(country => `<option value="${escapeHtml(country)}"${country === current ? ' selected' : ''}>${escapeHtml(country)}${extra.includes(country) ? ' (not in list)' : ''}</option>`).join('');
  }

  /** Adds Excel files to the upload list (accepts a FileList, an array or a single file). */
  function stageFilesForUpload(input) {
    if (bulkImporting) return;
    const files = input instanceof File ? [input] : [...(input || [])];
    const excel = files.filter(file => /\.xlsx$/i.test(file.name) && file.size <= (state.importTemplate?.maxFileBytes || 10485760));
    if (files.length && !excel.length) return toast('Choose official .xlsx workbooks, no more than 10 MB each. Legacy .xls files are not accepted.');
    if (excel.length < files.length) toast(`${files.length - excel.length} unsupported or oversized file(s) skipped. Only .xlsx up to 10 MB is accepted.`);
    if (stagedFiles.some(item => item.status)) stagedFiles = []; // start fresh after a finished batch
    let overLimit = 0;
    excel.forEach(file => {
      if (stagedFiles.some(item => item.file.name === file.name && item.file.size === file.size)) return;
      if (stagedFiles.length >= MAX_BULK_FILES) { overLimit++; return; }
      stagedFiles.push({ file, name: file.name.replace(/\.xlsx$/i, ''), country: '', priceLevel: guessPriceLevel(file.name), status: '', message: '' });
    });
    if (overLimit) toast(`Up to ${MAX_BULK_FILES} files per batch. ${overLimit} file${overLimit === 1 ? ' was' : 's were'} not added.`);
    renderStagedFiles();
  }
  function renderStagedFiles() {
    const panel = $('#stagedFilesPanel');
    const list = $('#stagedFilesList');
    if (!panel || !list) return;
    panel.hidden = !stagedFiles.length;
    // The batch counts as finished only once the import loop is over (not when the first file completes).
    const finished = !bulkImporting && stagedFiles.some(item => item.status === 'saved' || item.status === 'failed');
    const failed = stagedFiles.filter(item => item.status === 'failed');
    const attr = value => escapeHtml(value).replace(/"/g, '&quot;');
    list.innerHTML = stagedFiles.map((item, index) => {
      const locked = bulkImporting || finished;
      const statusMarkup = item.status
        ? `<span class="staged-status status-${item.status}" title="${attr(item.message)}">${{ working: '…', saved: '✓', failed: '✕' }[item.status] || ''}</span>`
        : `<button type="button" class="icon-button staged-remove" data-index="${index}" aria-label="Remove ${attr(item.file.name)}" title="Remove">×</button>`;
      return `<div class="staged-row ${item.status ? `is-${item.status}` : ''}" role="row" data-index="${index}">
        <span class="staged-file" role="cell" title="${attr(item.file.name)}"><strong>${escapeHtml(item.file.name)}</strong><small>${formatBytes(item.file.size)}${item.message ? ` · ${item.status === 'failed' ? 'Upload failed' : escapeHtml(item.message)}` : ''}</small></span>
        <span role="cell"><input type="text" maxlength="160" data-field="name" value="${attr(item.name)}" aria-label="Price list name" ${locked ? 'disabled' : ''}></span>
        <span role="cell"><select data-field="country" aria-label="Country" ${locked ? 'disabled' : ''}>${countryOptionsHtml(item.country, 'Select country…')}</select></span>
        <span role="cell"><select data-field="priceLevel" aria-label="Price level" ${locked ? 'disabled' : ''}>${priceLevelOptionsHtml(item.priceLevel)}</select></span>
        <span role="cell" class="staged-action">${statusMarkup}</span>
      </div>`;
    }).join('');
    const count = stagedFiles.length;
    dom.uploadModal?.classList.toggle('has-files', count > 0);
    dom.uploadModal?.setAttribute('aria-busy', String(bulkImporting));
    const button = dom.submitUploadBtn;
    if (button) {
      button.disabled = !count || bulkImporting;
      button.textContent = finished ? 'Close' : bulkImporting ? 'Uploading…' : count > 1 ? `Upload ${count} files` : 'Upload & open';
    }
    $('.staged-apply-all')?.toggleAttribute('hidden', count < 2 || finished);
    const hint = $('#stagedFilesHint');
    if (hint) {
      hint.textContent = finished
        ? `${stagedFiles.filter(item => item.status === 'saved').length} of ${count} saved. Correct rejected files and select them again.`
        : count > 1
          ? 'Each workbook becomes a separate price list.'
          : 'Choose the country and price level for this workbook.';
    }
    if (dom.cancelUploadBtn) dom.cancelUploadBtn.hidden = finished;
    if (dom.modalDropZone) dom.modalDropZone.hidden = finished && !failed.length;
    const errors = $('#uploadValidationErrors');
    if (errors) {
      errors.hidden = !failed.length;
      errors.innerHTML = failed.length ? `<strong>${failed.length === 1 ? 'Workbook not accepted' : `${failed.length} workbooks not accepted`}</strong><ul>${failed.map(item => `<li><strong>${escapeHtml(item.file.name)}</strong>: ${escapeHtml(item.message)}</li>`).join('')}</ul><p>Correct the file and select it again. Validation failures save no products.</p>` : '';
    }
    if (dom.dropZonePrompt) {
      const full = count >= MAX_BULK_FILES;
      dom.dropZonePrompt.textContent = finished ? 'Choose corrected files' : full ? `${MAX_BULK_FILES} workbooks selected` : count ? 'Add another workbook' : 'Drop your workbook here';
      if (dom.browseFileBtn) {
        dom.browseFileBtn.hidden = full && !finished;
        dom.browseFileBtn.disabled = bulkImporting;
        dom.browseFileBtn.textContent = finished ? 'Browse files' : count ? 'Add files' : 'Browse files';
      }
      dom.modalDropZone?.classList.toggle('is-full', full);
      dom.modalDropZone?.setAttribute('aria-disabled', String(bulkImporting || (full && !finished)));
    }
    $$('#uploadTemplateRulesBtn, #downloadTemplateBtn, .staged-apply-all select, #applyAllBtn').forEach(control => { control.disabled = bulkImporting; });
  }
  function clearStagedFile() {
    stagedFiles = [];
    bulkImporting = false;
    if (dom.modalFileInput) dom.modalFileInput.value = '';
    if ($('#applyAllCountry')) $('#applyAllCountry').value = '';
    if ($('#applyAllPriceLevel')) $('#applyAllPriceLevel').value = '';
    renderStagedFiles();
  }
  /** Returns the first validation problem in the upload list (and marks the field), or ''. */
  function validateStagedFiles() {
    $$('#stagedFilesList [data-field]').forEach(input => input.classList.remove('is-invalid'));
    const seen = new Map();
    for (const [index, item] of stagedFiles.entries()) {
      for (const field of ['name', 'country', 'priceLevel']) {
        if (!String(item[field] || '').trim()) {
          const input = $(`#stagedFilesList .staged-row[data-index="${index}"] [data-field="${field}"]`);
          input?.classList.add('is-invalid');
          input?.focus();
          return `Enter the ${field === 'priceLevel' ? 'price level' : field === 'name' ? 'price list name' : 'country'} for ${item.file.name}.`;
        }
      }
      // Same rule as the server: one price list per name + country + price level.
      const key = [item.name, item.country, item.priceLevel].map(value => value.trim().toLowerCase()).join('|');
      if (seen.has(key)) {
        $(`#stagedFilesList .staged-row[data-index="${index}"] input[data-field="name"]`)?.classList.add('is-invalid');
        return `Two files are both "${item.name.trim()}" for ${item.country} · ${item.priceLevel.trim()}. Change the name or price level of one.`;
      }
      seen.set(key, index);
    }
    return '';
  }
  /** Reads and saves every staged file as its own price list, showing a status per row. */
  async function importStagedFiles() {
    bulkImporting = true;
    renderStagedFiles();
    for (const item of stagedFiles) {
      item.status = 'working'; item.message = 'Reading…';
      renderStagedFiles();
      try {
        item.message = 'Validating the complete workbook…';
        renderStagedFiles();
        const data = await uploadList(item.file, { name: item.name, country: item.country, priceLevel: item.priceLevel });
        item.status = 'saved';
        item.message = `${Number(data.active?.productCount || data.active?.rows?.length || 0).toLocaleString()} products · ${statusLabel(data.active?.status)}`;
      } catch (error) {
        item.status = 'failed';
        item.message = error.message || 'Could not import this file.';
      }
      renderStagedFiles();
    }
    bulkImporting = false;
    renderStagedFiles();
    await refreshState();
    const saved = stagedFiles.filter(item => item.status === 'saved').length;
    if (saved === stagedFiles.length) {
      // Everything saved: close the window and show the new lists, no extra click needed.
      closeUploadModal();
      switchPanel('filesPanel', true);
      toast(`${saved} file${saved === 1 ? '' : 's'} uploaded.`);
      return;
    }
    toast(`${saved} of ${stagedFiles.length} files uploaded. Check the files marked ✕.`);
  }

  async function openUploadModal() {
    if (!can('upload')) return toast('Your role cannot upload price lists.');
    if (state.active?.isDraft && !(await confirmDiscardDraft('Uploading a new file'))) return false;
    clearStagedFile();
    fillDatalists();
    renderTemplateGuide();
    setUploadGuide(false, false);
    if ($('#applyAllCountry')) $('#applyAllCountry').innerHTML = countryOptionsHtml('', 'Country…');
    if ($('#applyAllPriceLevel')) $('#applyAllPriceLevel').innerHTML = priceLevelOptionsHtml('', 'Price level…');
    if (!dom.uploadModal?.open) dom.uploadModal?.showModal();
    return true;
  }

  function closeUploadModal() {
    if (bulkImporting) return toast('Please wait until the files finish saving.');
    clearStagedFile();
    setUploadGuide(false, false);
    dom.uploadModal?.close();
  }

  /**
   * Switches the upload window between the upload view and Template rules. While open, the window
   * glides to its new size and the new view slides in (rules from the right, upload from the left).
   */
  let uploadGuideSwap = 0;
  function setUploadGuide(show, focus = true) {
    if (bulkImporting) return;
    const dialog = dom.uploadModal;
    const changing = show === $('#uploadGuideView').hidden;
    const smooth = changing && dialog?.open && typeof dialog.animate === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const from = smooth ? dialog.getBoundingClientRect() : null;
    applyUploadGuide(show);
    if (smooth) {
      const swap = ++uploadGuideSwap;
      const to = dialog.getBoundingClientRect();
      const ease = 'cubic-bezier(0.16, 1, 0.3, 1)';
      dialog.getAnimations().forEach(a => a.id === 'upload-swap' && a.cancel());
      dialog.classList.add('is-resizing');
      const resize = dialog.animate(
        [{ width: `${from.width}px`, height: `${from.height}px` }, { width: `${to.width}px`, height: `${to.height}px` }],
        { duration: 460, easing: ease }
      );
      resize.id = 'upload-swap';
      const settle = () => { if (swap === uploadGuideSwap) dialog.classList.remove('is-resizing'); };
      resize.finished.then(settle, () => { });
      setTimeout(settle, 700); // never left clipped if frames stall
      const shift = show ? 22 : -22;
      [show ? '#uploadGuideView' : '#uploadMainView', show ? '#uploadGuideActions' : '#uploadMainActions'].forEach((selector, index) => {
        const el = $(selector);
        el?.animate(
          [{ opacity: 0, transform: `translateX(${shift}px)` }, { opacity: 1, transform: 'none' }],
          { duration: 420, delay: 70 + index * 40, easing: ease, fill: 'backwards' }
        );
      });
      $('.upload-heading > div')?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
    }
    if (focus) requestAnimationFrame(() => (show ? $('.template-layout-tab[aria-selected="true"]') : $('#uploadTemplateRulesBtn'))?.focus());
  }
  function applyUploadGuide(show) {
    $('#uploadMainView').hidden = show;
    $('#uploadGuideView').hidden = !show;
    $('#uploadMainActions').hidden = show;
    $('#uploadGuideActions').hidden = !show;
    dom.uploadModal.classList.toggle('showing-guide', show);
    $('#uploadModalTitle').textContent = show ? 'Template requirements' : 'Upload price lists';
    $('#uploadModalDescription').textContent = show ? 'See the worksheet layouts and what makes an upload valid.' : 'Choose your workbook. We’ll validate it before saving.';
    $('#uploadTemplateRulesBtn').setAttribute('aria-expanded', String(show));
    dom.closeUploadModalBtn?.setAttribute('aria-label', show ? 'Back to upload' : 'Close upload window');
    if (dom.closeUploadModalBtn) dom.closeUploadModalBtn.title = show ? 'Back to upload' : 'Close';
  }

  function selectTemplateLayout(key, focus = false) {
    $$('.template-layout-tab').forEach(tab => {
      const selected = tab.dataset.templateLayout === key;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    });
    $$('#templateLayouts [role="tabpanel"]').forEach(panel => { panel.hidden = panel.dataset.templateLayout !== key; });
  }

  function renderTemplateSheet(layout, category) {
    if (!window.XLSX) return '<p class="template-layout-description">The worksheet preview could not be loaded. Refresh the page to load the Excel tools.</p>';
    const merges = new Map(), covered = new Set();
    layout.merges.forEach(address => {
      const range = XLSX.utils.decode_range(address);
      merges.set(`${range.s.r}:${range.s.c}`, range);
      for (let row = range.s.r; row <= range.e.r; row++) {
        for (let column = range.s.c; column <= range.e.c; column++) {
          if (row !== range.s.r || column !== range.s.c) covered.add(`${row}:${column}`);
        }
      }
    });
    const widths = layout.widths.map(width => Math.round(width * 6 + 8));
    const headerRows = layout.headerRows.map((row, rowIndex) => `<tr>
      <th class="template-row-number" scope="row">${rowIndex + 1}</th>
      ${layout.columns.map((_, columnIndex) => {
        const position = `${rowIndex}:${columnIndex}`;
        if (covered.has(position)) return '';
        const range = merges.get(position);
        const spans = range ? ` rowspan="${range.e.r - range.s.r + 1}" colspan="${range.e.c - range.s.c + 1}"` : '';
        return `<th data-cell="${XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })}"${spans}>${escapeHtml(row[columnIndex] || '')}</th>`;
      }).join('')}
    </tr>`).join('');
    const sampleRows = category.samples.map((row, rowIndex) => `<tr>
      <th class="template-row-number" scope="row">${layout.headerRows.length + rowIndex + 1}</th>
      ${layout.columns.map((column, columnIndex) => {
        const value = row[columnIndex] ?? '';
        const numeric = typeof value === 'number' && column.type !== 'text';
        const display = numeric ? value.toFixed(column.type === 'integer' ? 0 : 2) : value;
        return `<td data-cell="${XLSX.utils.encode_cell({ r: layout.headerRows.length + rowIndex, c: columnIndex })}"${numeric ? ' class="template-number-cell"' : ''}>${escapeHtml(display)}</td>`;
      }).join('')}
    </tr>`).join('');
    const blankRows = Array.from({ length: 2 }, (_, rowIndex) => `<tr aria-hidden="true">
      <th class="template-row-number">${layout.headerRows.length + category.samples.length + rowIndex + 1}</th>
      ${layout.columns.map(() => '<td></td>').join('')}
    </tr>`).join('');
    return `<div class="template-sheet">
      <div class="template-sheet-heading"><strong>${escapeHtml(category.name)}</strong><span>Worksheet preview</span></div>
      <div class="template-sheet-scroll" role="region" tabindex="0" aria-label="${escapeHtml(category.name)} worksheet preview. Scroll horizontally to see all columns.">
        <table class="template-sheet-table" style="width:${34 + widths.reduce((total, width) => total + width, 0)}px">
          <caption class="sr-only">${escapeHtml(category.name)}: exact template headers and example product row.</caption>
          <colgroup><col style="width:34px">${widths.map(width => `<col style="width:${width}px">`).join('')}</colgroup>
          <thead>
            <tr class="template-column-ruler"><th class="template-row-number"><span class="sr-only">Row</span></th>${layout.columns.map((_, index) => `<th scope="col">${XLSX.utils.encode_col(index)}</th>`).join('')}</tr>
            ${headerRows}
          </thead>
          <tbody>${sampleRows}${blankRows}</tbody>
        </table>
      </div>
      <div class="template-sheet-footer"><span class="template-sheet-name">${escapeHtml(category.name)}</span><span>Scroll sideways for all ${layout.columns.length} columns <span aria-hidden="true">↔</span></span></div>
    </div>`;
  }

  function renderTemplateGuide() {
    const template = state.importTemplate;
    const guide = $('#templateLayouts');
    if (!template || !guide) return;
    $('#templateVersionLabel').textContent = template.version;
    $('#templateFileLimits').textContent = `${template.maxFileBytes / 1048576} MB maximum · ${Number(template.maxProducts).toLocaleString()} products`;
    guide.innerHTML = Object.entries(template.layouts).map(([key, layout]) => {
      const category = template.categories.find(category => category.layout === key);
      const required = layout.columns.filter(column => column.required).map(column => column.name);
      const optional = layout.columns.filter(column => !column.required).map(column => column.name);
      return `<section id="templateLayout-${key}" role="tabpanel" aria-labelledby="${key === 'standard' ? 'templateStandardTab' : 'templatePresentationTab'}" data-template-layout="${key}" tabindex="0"${key !== 'standard' ? ' hidden' : ''}>
        <p class="template-layout-description">${layout.columns.length} fixed columns · ${layout.headerRows.length} header row${layout.headerRows.length === 1 ? '' : 's'} · products start on row ${layout.headerRows.length + 1}${key === 'presentation' ? '. This worksheet is optional.' : '.'}</p>
        ${renderTemplateSheet(layout, category)}
        <dl class="template-field-rules">
          <div><dt>Required in each product row</dt><dd class="template-required-values">${required.map(escapeHtml).join(', ')}.</dd></div>
          <div><dt>Values may be blank</dt><dd class="template-optional-values">${optional.map(escapeHtml).join(', ')}. <strong>Keep these headers, even when their values are blank.</strong></dd></div>
        </dl>
        <p class="template-value-rules">Pieces per box must be a positive whole number. Prices must be numbers greater than or equal to zero.${key === 'standard' ? ' Weight must be greater than zero.' : ' NW, GW and Total Price must also be non-negative numbers when filled.'} Product Group identifies the product type for grouping and photos.</p>
      </section>`;
    }).join('');
    $('#templateCategoryNames').textContent = template.categories.map(category => category.name).join(', ');
    selectTemplateLayout('standard');
  }

  function downloadExcelTemplate() {
    if (!window.XLSX) return toast('Excel tools are not available.');
    const template = state.importTemplate;
    if (!template) return toast('The template could not be loaded. Refresh the page.');
    const wb = XLSX.utils.book_new();
    const instructions = XLSX.utils.aoa_to_sheet(template.instructions);
    instructions['!cols'] = [{ wch: 26 }, { wch: 110 }];
    instructions['!rows'] = template.instructions.map(() => ({ hpt: 24 }));
    XLSX.utils.book_append_sheet(wb, instructions, template.instructionsSheet);
    template.categories.forEach(category => {
      const layout = template.layouts[category.layout];
      const ws = XLSX.utils.aoa_to_sheet([...layout.headerRows, ...category.samples]);
      ws['!merges'] = layout.merges.map(range => XLSX.utils.decode_range(range));
      ws['!cols'] = layout.widths.map(wch => ({ wch }));
      ws['!rows'] = [...layout.headerRows.map(() => ({ hpt: 26 })), ...category.samples.map(() => ({ hpt: 24 }))];
      layout.columns.forEach((column, columnIndex) => {
        if (column.type === 'text') return;
        category.samples.forEach((_, rowIndex) => {
          const cell = ws[XLSX.utils.encode_cell({ r: layout.headerRows.length + rowIndex, c: columnIndex })];
          if (cell) cell.z = column.type === 'integer' ? '0' : '0.00';
        });
      });
      XLSX.utils.book_append_sheet(wb, ws, category.name);
    });
    XLSX.writeFile(wb, template.filename, { bookType: 'xlsx', compression: true });
    toast(`Downloaded official template ${template.version}. Replace or delete the sample rows before uploading.`);
  }

  /** Send the original workbook, never browser-derived headers/rows, for strict server validation. */
  async function uploadList(file, meta = {}) {
    if (!can('upload')) throw new Error('Your role cannot upload price lists.');
    if (!file || !/\.xlsx$/i.test(file.name)) throw new Error('Only the official .xlsx template is accepted. Legacy .xls files are not supported.');
    if (!file.size || file.size > (state.importTemplate?.maxFileBytes || 10485760)) throw new Error('Workbook must be no more than 10 MB.');
    if (!String(meta.country || '').trim() || !String(meta.priceLevel || '').trim()) throw new Error('Choose the country and price level for this price list.');
    const body = new FormData();
    body.append('kind', 'upload');
    body.append('name', String(meta.name || '').trim() || file.name.replace(/\.xlsx$/i, ''));
    body.append('country', String(meta.country).trim());
    body.append('priceLevel', String(meta.priceLevel).trim());
    body.append('workbook', file);
    return api('save', { method: 'POST', headers: { 'X-CSRF-Token': state.csrf || '' }, body });
  }

  /** A failed validation never changes the active file or discards its draft. */
  async function parseWorkbook(file, meta = {}) {
    const data = await uploadList(file, meta);
    if (can('update')) await removeDraft(draftKey());
    resetFilters();
    state.category = '';
    rememberCategory('');
    loadActive(data.active);
    switchPanel('workspacePanel', true);
    refreshState().catch(() => { });
    toast(`Uploaded ${data.active.name} (${Number(data.active.productCount || data.active.rows.length).toLocaleString()} products). ${state.autoApprove ? 'Price changes you save are approved right away.' : 'Price changes you save will go for approval.'}`);
  }
  function resetFilters() {
    state.search = ''; state.codeFilter = ''; state.priceLevelFilter = ''; state.countryFilter = '';
    if (dom.search) dom.search.value = '';
    if (dom.codeFilterInput) dom.codeFilterInput.value = '';
    if (dom.priceLevelSelect) dom.priceLevelSelect.value = '';
    if (dom.countrySelect) dom.countrySelect.value = '';
  }
  function getChangeSummary() {
    const categories = [...new Set(state.rows.map(row => String(row[0] ?? '')).filter(Boolean))].sort();
    const items = categories.map(category => {
      const adj = getCategoryAdjustment(category);
      const count = state.rows.filter(row => String(row[0] ?? '') === category).length;
      return {
        category,
        adjustment: adj,
        productCount: count,
        isAdjusted: adj !== 0
      };
    });

    const adjustedItems = items.filter(i => i.isAdjusted);
    const unchangedItems = items.filter(i => !i.isAdjusted);
    const totalAdjustedProducts = adjustedItems.reduce((sum, i) => sum + i.productCount, 0);

    return {
      items,
      adjustedItems,
      unchangedItems,
      totalProducts: state.rows.length,
      totalAdjustedProducts
    };
  }

  function renderSaveSummary() {
    const container = $('#saveChangeSummary');
    if (!container) return;
    const summary = getChangeSummary();

    if (summary.adjustedItems.length === 0) {
      container.innerHTML = `
        <div class="save-summary-header">
          <div class="save-summary-title">
            <span class="save-summary-icon" aria-hidden="true">ℹ</span>
            <strong>Price Adjustment Summary</strong>
          </div>
          <span class="save-summary-badge neutral">Original prices (0%)</span>
        </div>
        <div class="save-summary-empty">
          All <strong>${summary.totalProducts.toLocaleString()}</strong> products across <strong>${summary.items.length}</strong> categories will be saved at their original prices (0% adjustment).
        </div>`;
      return;
    }

    const rowsHtml = summary.adjustedItems.map(item => {
      const sign = item.adjustment > 0 ? '+' : '';
      const cls = item.adjustment > 0 ? 'pos' : 'neg';
      return `
        <div class="save-summary-row">
          <div class="save-summary-cat-info">
            <span class="save-summary-bullet ${cls}">●</span>
            <strong class="save-summary-cat-name">${escapeHtml(item.category)}</strong>
            <span class="save-summary-cat-count">${item.productCount.toLocaleString()} product${item.productCount === 1 ? '' : 's'}</span>
          </div>
          <span class="adjustment-pill ${cls}">${sign}${item.adjustment}%</span>
        </div>`;
    }).join('');

    const unchangedHtml = summary.unchangedItems.length > 0
      ? `<div class="save-summary-unchanged">
          <strong>Unchanged (0%):</strong> ${summary.unchangedItems.map(i => `${escapeHtml(i.category)} (${i.productCount.toLocaleString()})`).join(', ')}
        </div>`
      : '';

    container.innerHTML = `
      <div class="save-summary-header">
        <div class="save-summary-title">
          <span class="save-summary-icon" aria-hidden="true">✎</span>
          <strong>Price Adjustment Summary</strong>
        </div>
        <span class="save-summary-badge">${summary.adjustedItems.length} ${summary.adjustedItems.length === 1 ? 'category' : 'categories'} · ${summary.totalAdjustedProducts.toLocaleString()} products</span>
      </div>
      <div class="save-summary-list">
        ${rowsHtml}
      </div>
      ${unchangedHtml}`;
  }

  function changeListMarkup(changes, limit = 40) {
    if (!changes || !changes.length) return '';
    const rows = changes.slice(0, limit).map(change => `
      <div class="edit-change-row">
        <span class="edit-change-code">${escapeHtml(change.code || '—')}</span>
        <span class="edit-change-col">${escapeHtml(change.column || '')}</span>
        <span class="diff-chip old">${escapeHtml(change.oldValue || 'empty')}</span>
        <span class="diff-arrow">→</span>
        <span class="diff-chip new">${escapeHtml(change.newValue || 'empty')}</span>
      </div>`).join('');
    const more = changes.length > limit ? `<div class="edit-change-more">+ ${(changes.length - limit).toLocaleString()} more edit${changes.length - limit === 1 ? '' : 's'}</div>` : '';
    return `<div class="save-summary-header"><div class="save-summary-title"><span class="save-summary-icon" aria-hidden="true">✎</span><strong>Cell edits</strong></div><span class="save-summary-badge">${changes.length.toLocaleString()} edit${changes.length === 1 ? '' : 's'}</span></div><div class="edit-change-list">${rows}${more}</div>`;
  }
  function renderSaveEdits() {
    if (!dom.saveEditsSummary) return;
    const changes = state.active?.isDraft ? (state.active.pendingChanges || []) : [];
    dom.saveEditsSummary.hidden = !changes.length;
    dom.saveEditsSummary.innerHTML = changeListMarkup(changes);
  }
  async function save(customName) {
    const name = (customName || '').trim() || state.active?.name || 'Untitled price list';
    const priceLevel = dom.savePriceLevel.value.trim();
    const country = dom.saveCountry.value.trim();
    // Rows that inherited the old list-level defaults follow the new values.
    const previousLevel = state.active.priceLevel, previousCountry = state.active.country;
    const rows = state.rows.map(row => {
      const copy = [...row];
      if (!copy[COL.priceLevel] || copy[COL.priceLevel] === previousLevel) copy[COL.priceLevel] = priceLevel;
      if (!copy[COL.country] || copy[COL.country] === previousCountry) copy[COL.country] = country;
      return copy;
    });
    const data = await api('save', {
      method: 'POST',
      body: JSON.stringify({
        id: state.active?.id || null,
        name,
        priceLevel,
        country,
        headers: state.headers,
        rows,
        priceColumns: state.priceColumns,
        adjustment: state.adjustment,
        categoryAdjustments: state.categoryAdjustments,
        changes: state.active?.pendingChanges || []
      })
    });
    await removeDraft(draftKey());
    // Auto-approvers' saves are approved on the spot, so they get the stamp too.
    if (data.active?.status === 'approved') stampDecision('approve');
    loadActive(data.active);
    await refreshState();
    toast(data.message);
  }

  // --- Exports (approved price lists only; the server re-checks approval and logs every export) ---
  function adjustmentFor(version) {
    const map = version.categoryAdjustments || {};
    const fallback = Number(version.adjustment || 0);
    return category => {
      const key = String(category ?? '').trim();
      return map[key] !== undefined ? Number(map[key]) : fallback;
    };
  }
  function adjustedWith(rate, value) {
    const rawNum = typeof value === 'number' ? value : Number(String(value ?? '').replace(/,/g, '').trim());
    if (!Number.isFinite(rawNum)) return value;
    if (!rate || !Number.isFinite(rate)) return rawNum;
    return Math.max(0, Math.round(rawNum * (1 + rate / 100) * 10000) / 10000);
  }
  function exportFileName(version, extension) {
    const parts = [version.name || 'LRN Price List'];
    if (version.revision > 1) parts.push(`rev ${version.revision}`);
    return `${parts.join(' - ').replace(/[\\/:*?"<>|%]/g, '_')}.${extension}`;
  }
  /**
   * Asks the server for the approved version (which logs the export), then builds the file from it.
   * From the editor, the active filters limit the exported rows.
   */
  async function requestExport(format, versionId = null) {
    const fromEditor = !versionId;
    const id = versionId || state.active?.id;
    if (!id) return toast('Open an approved price list first.');
    if (fromEditor && !canExportActive()) return toast('Only approved price lists can be exported.');
    const scope = fromEditor && (hasActiveFilters() || state.category) ? filterDescription() : '';
    let version;
    try {
      version = (await api('export', { method: 'POST', body: JSON.stringify({ id, format, scope }) })).version;
    } catch (error) {
      return toast(error.message);
    }
    version.rows = normalizeRows(version.rows, version.priceLevel, version.country);
    let rows = version.rows;
    if (fromEditor && String(version.id) === String(state.active?.id)) {
      rows = filteredRows().map(item => item.row);
      if (!rows.length) return toast('No products match the current filters.');
    }
    if (format === 'excel') exportExcel(version, rows);
    else await exportPdf(version, rows, scope);
    if (can('viewAudit')) api('audit-logs').then(res => { state.auditLogs = res.auditLogs || []; renderHistory(); }).catch(() => { });
  }
  function exportExcel(version, rows) {
    if (!window.XLSX) return toast('Excel tools are unavailable.');
    const wb = XLSX.utils.book_new();
    const rateFor = adjustmentFor(version);
    const adjusted = (value, category) => adjustedWith(rateFor(category), value);

    const categoryMap = new Map();
    rows.forEach(row => {
      const cat = String(row[0] || 'Price List').trim();
      if (!categoryMap.has(cat)) categoryMap.set(cat, []);
      categoryMap.get(cat).push(row);
    });

    const standardHeaderRow1 = ['Code No', 'Description', 'Expiry Date', 'Weight gr/pc', 'Pcs /box', 'Box Size', 'Price/pc USD', 'Price/box In USD', 'PALLET PER CONTAINER', '', '', 'Product Group'];
    const standardHeaderRow2 = ['', '', '', '', '', '', '', '', '40ft Container', '', '20ft Container', ''];
    const standardHeaderRow3 = ['', '', '', '', '', '', '', '', 'Large Pallet (16 pallets)', 'Small Pallet (2 pallets)', 'Large Pallet (8 pallets)', ''];
    const standardMerges = [
      { s: { r: 0, c: 0 }, e: { r: 2, c: 0 } },
      { s: { r: 0, c: 1 }, e: { r: 2, c: 1 } },
      { s: { r: 0, c: 2 }, e: { r: 2, c: 2 } },
      { s: { r: 0, c: 3 }, e: { r: 2, c: 3 } },
      { s: { r: 0, c: 4 }, e: { r: 2, c: 4 } },
      { s: { r: 0, c: 5 }, e: { r: 2, c: 5 } },
      { s: { r: 0, c: 6 }, e: { r: 2, c: 6 } },
      { s: { r: 0, c: 7 }, e: { r: 2, c: 7 } },
      { s: { r: 0, c: 8 }, e: { r: 0, c: 10 } },
      { s: { r: 1, c: 8 }, e: { r: 1, c: 9 } },
      { s: { r: 0, c: 11 }, e: { r: 2, c: 11 } }
    ];

    const presentationHeaders = ['LRN code', 'Item Name', 'PC/Set Per Box', 'Price/pc in USD', 'Price/Box USD', 'NW(KG) / Box', 'GW(KG) / Box', 'Box size', 'MOQ', 'Total Price Based on MOQ', 'Product Group'];

    categoryMap.forEach((catRows, catName) => {
      const isPresentation = /presentation stands/i.test(catName);
      const wsData = [];
      if (isPresentation) {
        wsData.push(presentationHeaders);
        catRows.forEach(row => {
          const itemName = [row[2], row[3]].filter(Boolean).join(' ');
          const moq = [row[15], row[16]].filter(Boolean).join(' ');
          wsData.push([
            row[1],
            itemName,
            row[6],
            isNumeric(row[8]) ? Number(adjusted(numeric(row[8]), catName).toFixed(2)) : row[8],
            isNumeric(row[9]) ? Number(adjusted(numeric(row[9]), catName).toFixed(2)) : row[9],
            row[13],
            row[14],
            row[7],
            moq,
            isNumeric(row[17]) ? Number(row[17]) : row[17],
            row[18] || catName
          ]);
        });
      } else {
        wsData.push(standardHeaderRow1, standardHeaderRow2, standardHeaderRow3);
        catRows.forEach(row => {
          wsData.push([
            row[1],
            row[2],
            row[4],
            row[5],
            row[6],
            row[7],
            isNumeric(row[8]) ? Number(adjusted(numeric(row[8]), catName).toFixed(2)) : row[8],
            isNumeric(row[9]) ? Number(adjusted(numeric(row[9]), catName).toFixed(2)) : row[9],
            row[10],
            row[11],
            row[12],
            row[18] || catName
          ]);
        });
      }

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      if (!isPresentation) {
        ws['!merges'] = standardMerges;
        ws['!freeze'] = { xSplit: 0, ySplit: 3 };
      } else {
        ws['!freeze'] = { xSplit: 0, ySplit: 1 };
      }
      const safeSheetName = catName.substring(0, 31).replace(/[\\/?*[\]]/g, '');
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName || 'Sheet');
    });

    XLSX.writeFile(wb, exportFileName(version, 'xlsx'));
    toast('Excel workbook exported.');
  }
  const pdfImageCache = {};
  function clearPdfImageCache() {
    Object.keys(pdfImageCache).forEach(key => delete pdfImageCache[key]);
  }
  /**
   * Product photos for the PDF as { data, width, height }: every format (JPG, PNG, WebP) is redrawn
   * as a JPEG of at most 640px, which jsPDF always accepts and which keeps the file small.
   */
  async function loadPdfImages(rows = null) {
    const wanted = rows ? new Set(rows.map(row => groupLookupKey(String(row[0] || ''), String(row[18] || row[0] || '')))) : null;
    const urls = {};
    state.productImages.forEach(image => {
      if (!image.key || !image.imagePath) return;
      if (wanted && !wanted.has(groupLookupKey(image.category, image.groupName))) return;
      urls[`custom:${image.key}`] = mediaUrl(image.imagePath);
    });
    for (const [key, url] of Object.entries(urls)) {
      if (pdfImageCache[key]) continue;
      try {
        const res = await fetch(url);
        if (!res.ok) { pdfImageCache[key] = null; continue; }
        const bitmap = await createImageBitmap(await res.blob());
        const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close?.();
        pdfImageCache[key] = { data: canvas.toDataURL('image/jpeg', 0.86), width: canvas.width, height: canvas.height };
      } catch {
        pdfImageCache[key] = null;
      }
    }
    return pdfImageCache;
  }

  function getPdfGroupImageKey(category, groupName) {
    const custom = imageOverride(category, groupName);
    return custom?.key ? `custom:${custom.key}` : null;
  }

  async function exportPdf(version, targetRows, scope = '') {
    try {
      if (!window.jspdf?.jsPDF) return toast('PDF tools are unavailable.');
      if (!targetRows.length) return toast('No products to export.');
      const { jsPDF } = window.jspdf;
      const rateFor = adjustmentFor(version);
      const adjusted = (value, category) => adjustedWith(rateFor(category), value);
      toast('Generating PDF...');
      const pdfImages = await loadPdfImages(targetRows);

      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      if (typeof doc.autoTable !== 'function') return toast('PDF table tools are unavailable.');

      // Page frame: header band on top, footer at the bottom, tables in between.
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 22;
      const TOP = 60;
      const BOTTOM = 36;
      const printableWidth = pageWidth - margin * 2;
      const INK = [23, 20, 23], MUTED = [113, 98, 103], ROSE = [181, 32, 66];
      const PHOTO_HEIGHT = 54;

      const formatPallet = val => {
        const s = String(val ?? '').trim();
        if (!s) return '';
        if (/pallet|box/i.test(s)) return s;
        return isNumeric(s) ? `${s} Boxes/Pallet` : s;
      };
      const formatPdfPrice = (raw, cat) => {
        if (!isNumeric(raw)) return String(raw ?? '');
        const val = adjusted(numeric(raw), cat);
        const numStr = String(raw).trim();
        const decimals = numStr.includes('.') ? numStr.split('.')[1].length : 2;
        return Number(val).toFixed(Math.max(2, Math.min(4, decimals)));
      };
      // Shrinks the column widths proportionally if they add up to more than the printable width.
      const fitColumnsToPage = columns => {
        const total = Object.values(columns).reduce((sum, col) => sum + (col.cellWidth || 0), 0);
        if (total <= printableWidth) return columns;
        const scale = printableWidth / total;
        return Object.fromEntries(Object.entries(columns).map(([key, col]) => [key, { ...col, cellWidth: Math.floor(col.cellWidth * scale * 10) / 10 }]));
      };

      const categoriesMap = new Map();
      targetRows.forEach(row => {
        const category = String(row[0] || 'Products').trim();
        const groupName = String(row[18] || row[0] || 'Other products').trim();
        if (!categoriesMap.has(category)) categoriesMap.set(category, new Map());
        const groupsMap = categoriesMap.get(category);
        if (!groupsMap.has(groupName)) groupsMap.set(groupName, []);
        groupsMap.get(groupName).push(row);
      });

      // A dark bar with a rose edge naming the category, above its table.
      const drawCategoryBar = (y, name, count) => {
        doc.setFillColor(...INK);
        doc.roundedRect(margin, y, printableWidth, 20, 3, 3, 'F');
        doc.setFillColor(...ROSE);
        doc.rect(margin, y, 4, 20, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(name.toUpperCase(), margin + 14, y + 13.4, { charSpace: 0.6 });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(236, 214, 220);
        doc.text(`${count.toLocaleString()} product${count === 1 ? '' : 's'}`, pageWidth - margin - 10, y + 13.2, { align: 'right' });
      };

      let currentY = TOP;
      for (const [category, groupsMap] of categoriesMap.entries()) {
        const isPresentation = category.toLowerCase() === 'presentation stands';
        const isAdj = rateFor(category) !== 0;

        // 3-Tier Excel Header. Column widths come only from columnStyles below: widths set on header
        // cells win over them and pushed the table past the page edge.
        const standardHead = [
          [
            { content: 'Photo', rowSpan: 3 },
            { content: 'Code No', rowSpan: 3 },
            { content: 'Description', rowSpan: 3 },
            { content: 'Expiry\nDate', rowSpan: 3 },
            { content: 'Weight\ngr/pc', rowSpan: 3 },
            { content: 'Pcs\n/box', rowSpan: 3 },
            { content: 'Box Size', rowSpan: 3 },
            { content: 'Price/pc\nUSD', rowSpan: 3 },
            { content: 'Price/box\nIn USD', rowSpan: 3 },
            { content: 'PALLET PER CONTAINER', colSpan: 3, styles: { halign: 'center' } }
          ],
          [
            { content: '40ft Container', colSpan: 2, styles: { halign: 'center' } },
            { content: '20ft Container', colSpan: 1, styles: { halign: 'center' } }
          ],
          [
            { content: 'Large Pallet\n(16 pallets)', styles: { halign: 'center' } },
            { content: 'Small Pallet\n(2 pallets)', styles: { halign: 'center' } },
            { content: 'Large Pallet\n(8 pallets)', styles: { halign: 'center' } }
          ]
        ];
        const presentationHead = [
          [
            { content: 'Photo' },
            { content: 'LRN code' },
            { content: 'Item Name', colSpan: 2 },
            { content: 'PC/Set Per Box' },
            { content: 'Price/pc in USD' },
            { content: 'Price/Box USD' },
            { content: 'NW(KG) / Box' },
            { content: 'GW(KG) / Box' },
            { content: 'Box size' },
            { content: 'MOQ' },
            { content: 'Total Price Based on MOQ' }
          ]
        ];

        // Body: a title row per product group, then its products with one shared photo cell.
        const body = [];
        const colCount = 12;
        let productCount = 0;
        for (const [groupName, rows] of groupsMap.entries()) {
          productCount += rows.length;
          body.push([{
            content: groupName,
            colSpan: colCount,
            styles: {
              fillColor: [249, 226, 231], textColor: INK, fontStyle: 'bold', fontSize: 8, halign: 'left',
              cellPadding: { top: 4, bottom: 4, left: 7, right: 6 }, lineColor: [221, 178, 188], lineWidth: 0.5
            }
          }]);
          const imageKey = getPdfGroupImageKey(category, groupName);
          // A group with a photo gets enough height to show it; the rows share it.
          const rowMin = imageKey && pdfImages[imageKey] ? Math.ceil(PHOTO_HEIGHT / rows.length) : 0;
          const price = raw => ({ content: formatPdfPrice(raw, category), styles: { halign: 'right', textColor: INK, fontStyle: isAdj ? 'bold' : 'normal', fontSize: 7 } });

          rows.forEach((row, rIdx) => {
            const rowCells = [];
            if (rIdx === 0) {
              rowCells.push({ content: '', rowSpan: rows.length, imageKey, styles: { fillColor: [255, 255, 255], cellPadding: 2, lineColor: [221, 178, 188], lineWidth: 0.5 } });
            }
            if (isPresentation) {
              const itemName = [row[2], row[3]].filter(v => String(v ?? '').trim()).join('\n');
              const moq = [row[15], row[16]].filter(v => String(v ?? '').trim()).join('\n');
              rowCells.push(
                { content: String(row[1] ?? ''), styles: { halign: 'center', fontStyle: 'bold', fontSize: 6.8, minCellHeight: rowMin } },
                { content: itemName, colSpan: 2, styles: { halign: 'left', fontSize: 6.8 } },
                { content: String(row[6] ?? ''), styles: { halign: 'center' } },
                price(row[8]),
                price(row[9]),
                { content: String(row[13] ?? ''), styles: { halign: 'center' } },
                { content: String(row[14] ?? ''), styles: { halign: 'center' } },
                { content: String(row[7] ?? ''), styles: { halign: 'center' } },
                { content: moq, styles: { halign: 'center' } },
                { content: isNumeric(row[17]) ? Number(numeric(row[17])).toFixed(2) : String(row[17] ?? ''), styles: { halign: 'right', textColor: INK, fontStyle: isAdj ? 'bold' : 'normal' } }
              );
            } else {
              rowCells.push(
                { content: String(row[1] ?? ''), styles: { halign: 'center', fontStyle: 'bold', fontSize: 6.8, minCellHeight: rowMin } },
                { content: String(row[2] ?? '').replace(/\r?\n/g, '\n'), styles: { halign: 'left', fontSize: 6.8, cellPadding: { top: 3, bottom: 3, left: 5, right: 5 } } },
                { content: String(row[4] ?? ''), styles: { halign: 'center' } },
                { content: String(row[5] ?? ''), styles: { halign: 'center' } },
                { content: String(row[6] ?? ''), styles: { halign: 'center' } },
                { content: String(row[7] ?? ''), styles: { halign: 'center' } },
                price(row[8]),
                price(row[9]),
                { content: formatPallet(row[10]), styles: { halign: 'center' } },
                { content: formatPallet(row[11]), styles: { halign: 'center' } },
                { content: formatPallet(row[12]), styles: { halign: 'center' } }
              );
            }
            body.push(rowCells);
          });
        }

        // Categories follow on from each other; a new page only when this one's bar, header and
        // first products would not fit.
        const needed = 24 + (isPresentation ? 20 : 46) + 18 + PHOTO_HEIGHT;
        if (currentY > TOP && currentY + needed > pageHeight - BOTTOM) {
          doc.addPage();
          currentY = TOP;
        }
        drawCategoryBar(currentY, category, productCount);

        doc.autoTable({
          head: isPresentation ? presentationHead : standardHead,
          body,
          startY: currentY + 24,
          theme: 'grid',
          showHead: 'everyPage',
          rowPageBreak: 'avoid',
          margin: { top: TOP, right: margin, bottom: BOTTOM, left: margin },
          styles: {
            font: 'helvetica', fontSize: 6.5, cellPadding: 3, overflow: 'linebreak', valign: 'middle',
            fillColor: [255, 255, 255], textColor: [40, 33, 38], lineColor: [226, 196, 204], lineWidth: 0.5
          },
          headStyles: {
            fillColor: [244, 216, 222], textColor: INK, fontStyle: 'bold', fontSize: 6.8,
            halign: 'center', valign: 'middle', lineColor: [214, 170, 181], lineWidth: 0.5
          },
          alternateRowStyles: { fillColor: [253, 249, 250] },
          columnStyles: fitColumnsToPage(isPresentation ? {
            0: { cellWidth: 86, halign: 'center' },
            1: { cellWidth: 64, halign: 'center', fontStyle: 'bold' },
            2: { cellWidth: 100, halign: 'left' },
            3: { cellWidth: 80, halign: 'left' },
            4: { cellWidth: 54, halign: 'center' },
            5: { cellWidth: 56, halign: 'right' },
            6: { cellWidth: 56, halign: 'right' },
            7: { cellWidth: 54, halign: 'center' },
            8: { cellWidth: 54, halign: 'center' },
            9: { cellWidth: 62, halign: 'center' },
            10: { cellWidth: 62, halign: 'center' },
            11: { cellWidth: 70, halign: 'right' }
          } : {
            0: { cellWidth: 82, halign: 'center' },
            1: { cellWidth: 64, halign: 'center', fontStyle: 'bold' },
            2: { cellWidth: 172, halign: 'left' },
            3: { cellWidth: 48, halign: 'center' },
            4: { cellWidth: 44, halign: 'center' },
            5: { cellWidth: 40, halign: 'center' },
            6: { cellWidth: 56, halign: 'center' },
            7: { cellWidth: 52, halign: 'right' },
            8: { cellWidth: 56, halign: 'right' },
            9: { cellWidth: 61, halign: 'center' },
            10: { cellWidth: 61, halign: 'center' },
            11: { cellWidth: 62, halign: 'center' }
          }),
          // The group photo, fitted inside its cell without stretching.
          didDrawCell: data => {
            const raw = data.cell.raw;
            if (data.section !== 'body' || data.column.index !== 0 || !raw || !('imageKey' in raw)) return;
            const img = raw.imageKey ? pdfImages[raw.imageKey] : null;
            if (!img) {
              // No photo for this group: a quiet dash instead of an empty box.
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(8);
              doc.setTextColor(205, 182, 189);
              doc.text('—', data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 2.5, { align: 'center' });
              return;
            }
            const pad = 3;
            const boxW = data.cell.width - pad * 2, boxH = data.cell.height - pad * 2;
            if (boxW <= 4 || boxH <= 4) return;
            const scale = Math.min(boxW / img.width, boxH / img.height);
            const w = img.width * scale, h = img.height * scale;
            try {
              doc.addImage(img.data, 'JPEG', data.cell.x + (data.cell.width - w) / 2, data.cell.y + (data.cell.height - h) / 2, w, h, raw.imageKey, 'FAST');
            } catch { /* a photo that can't be drawn leaves the cell empty */ }
          }
        });

        currentY = (doc.lastAutoTable?.finalY || currentY) + 18;
      }

      // Header and footer on every page.
      const exported = `Exported ${displayDate(new Date().toISOString())} by ${state.user?.name || ''}`;
      const approved = version.status === 'approved';
      const facts = [
        ['Country', version.country || '—'],
        ['Price level', version.priceLevel || '—'],
        ['Revision', String(version.revision || 1)],
        approved
          ? ['Approved', `${version.approvedBy || '—'}${version.approvedAt ? ` · ${new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(version.approvedAt))}` : ''}`]
          : ['Prices', 'Original upload'],
      ];
      const pageCount = doc.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);

        // Brand mark, title and subtitle.
        doc.setFillColor(...INK);
        doc.roundedRect(margin, 14, 28, 28, 5, 5, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text('LRN', margin + 14, 31, { align: 'center' });
        doc.setTextColor(...INK);
        doc.setFontSize(13);
        doc.text(doc.splitTextToSize(version.name || 'Price List', pageWidth * 0.42)[0], margin + 38, 27);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...MUTED);
        doc.text(`La Rose Noire · Export price list${scope ? `  ·  Filtered: ${scope}` : ''}`, margin + 38, 38);

        // Facts on the right, right to left: label above, value below.
        let right = pageWidth - margin;
        for (const [label, value] of [...facts].reverse()) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          const width = Math.max(doc.getTextWidth(value), (doc.setFontSize(6), doc.getTextWidth(label.toUpperCase()) + 4));
          const x = right - width;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6);
          doc.setTextColor(...MUTED);
          doc.text(label.toUpperCase(), x, 25, { charSpace: 0.4 });
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(...(label === 'Approved' ? ROSE : INK));
          doc.text(value, x, 37);
          right = x - 22;
        }
        doc.setDrawColor(...ROSE);
        doc.setLineWidth(1.1);
        doc.line(margin, 49, pageWidth - margin, 49);

        // Footer.
        doc.setDrawColor(232, 210, 216);
        doc.setLineWidth(0.5);
        doc.line(margin, pageHeight - 26, pageWidth - margin, pageHeight - 26);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...MUTED);
        doc.text('La Rose Noire · Commercial price list · Strictly confidential', margin, pageHeight - 14);
        doc.text(`All prices in USD  ·  ${exported}`, pageWidth / 2, pageHeight - 14, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...INK);
        doc.text(`Page ${p} of ${pageCount}`, pageWidth - margin, pageHeight - 14, { align: 'right' });
      }

      doc.save(exportFileName(version, 'pdf'));
      toast('PDF exported.');
    } catch (err) {
      console.error('PDF Export Error:', err);
      toast('Failed to generate PDF: ' + (err.message || 'Unknown error'));
    }
  }

  $('#logoutButton').addEventListener('click', () => dom.logoutDialog.showModal());
  dom.logoutForm.addEventListener('submit', event => {
    event.preventDefault();
    dom.logoutDialog.close();
    if (event.submitter && event.submitter.value === 'cancel') return;
    // A fresh sign-in starts on "All categories".
    rememberCategory('');
    const leave = () => { window.location.href = '../auth/logout.php'; };
    const app = dom.appView;
    if (reducedMotion() || !app?.animate) return leave();
    // The page closes in a circle into the Sign out button (the reverse of the theme switch).
    const box = $('#logoutButton').getBoundingClientRect();
    const x = box.left + box.width / 2, y = box.top + box.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.body.classList.add('is-signing-out');
    window.plaHandOff?.(x, y); // the sign-in page opens from this same point
    const shrink = app.animate(
      { clipPath: [`circle(${radius}px at ${x}px ${y}px)`, `circle(0px at ${x}px ${y}px)`] },
      { duration: 560, easing: 'cubic-bezier(.55, 0, .75, .1)', fill: 'forwards' }
    );
    shrink.finished.then(leave, leave);
    setTimeout(leave, 900); // in case frames stall
  });
  $('#uploadButton').addEventListener('click', openUploadModal); $('#emptyUploadButton').addEventListener('click', openUploadModal);
  dom.emptyState.addEventListener('dragover', event => {
    event.preventDefault();
    dom.emptyState.classList.add('dragover');
  });
  dom.emptyState.addEventListener('dragleave', () => {
    dom.emptyState.classList.remove('dragover');
  });
  dom.emptyState.addEventListener('drop', async event => {
    event.preventDefault();
    dom.emptyState.classList.remove('dragover');
    const files = [...(event.dataTransfer?.files || [])];
    if (!files.length) return;
    if (!can('upload')) return toast('Your role cannot upload price lists.');
    if (!files.some(file => /\.xlsx$/i.test(file.name))) return toast('Please drop official .xlsx workbooks. Legacy .xls files are not accepted.');
    if (await openUploadModal()) stageFilesForUpload(files);
  });
  $('#editButton').addEventListener('click', event => {
    event.stopPropagation();
    if (!state.canEdit) return toast('You do not have permission to edit prices.');
    if (!state.active) return toast('Please upload or open a price list first before adjusting prices.');
    setPriceEditor($('#adjustmentBar').hidden);
  });
  $('#adjustmentBar')?.addEventListener('click', event => {
    event.stopPropagation();
  });
  dom.fileInput.addEventListener('change', async () => {
    const files = [...(dom.fileInput.files || [])];
    dom.fileInput.value = '';
    if (!files.length) return;
    if (await openUploadModal()) stageFilesForUpload(files);
  });

  // --- Price roll: after Apply or Reset, every changed digit on screen rolls like an odometer
  // wheel to its new value (up when the price rises, down when it falls), in a wave down the
  // table, with a green or red flash behind the price. ---
  const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let rollTimer = 0;
  function priceValueOf(td) {
    const row = state.rows[Number(td.dataset.row)];
    const raw = row?.[Number(td.dataset.col)];
    return isNumeric(raw) ? adjusted(numeric(raw), String(row[0] ?? '')) : null;
  }
  /** Remembers the prices on screen and keeps the next re-render from replaying the row entrance. */
  function capturePrices() {
    if (reducedMotion() || !dom.table) return null;
    const before = new Map();
    dom.table.querySelectorAll('td.price-cell').forEach(td => before.set(`${td.dataset.row}:${td.dataset.col}`, priceValueOf(td)));
    suppressRowEnter = true;
    return before;
  }
  /** One price as odometer wheels: unchanged characters stay still, changed digits get a strip. */
  function odometerMarkup(fromText, toText, rising) {
    const width = Math.max(fromText.length, toText.length);
    const from = fromText.padStart(width, ' '), to = toText.padStart(width, ' ');
    let spinsLeft = 0;
    return [...to].map((char, index) => {
      const old = from[index];
      if (old === char) return `<span class="odo-char">${char === ' ' ? '' : escapeHtml(char)}</span>`;
      if (!/\d/.test(char)) return `<span class="odo-char odo-new">${escapeHtml(char)}</span>`;
      // Count through the digits in between; the last two wheels also spin one extra turn.
      const start = /\d/.test(old) ? Number(old) : 0;
      const end = Number(char);
      const extra = index >= width - 2 ? 10 : 0;
      const steps = (rising ? (end - start + 10) % 10 : (start - end + 10) % 10) + extra || 10;
      const digits = Array.from({ length: steps + 1 }, (_, i) => (rising ? start + i : start - i + 100) % 10);
      if (!/\d/.test(old)) digits[0] = '';
      const strip = rising ? digits : [...digits].reverse();
      spinsLeft++;
      return `<span class="odo-wheel" data-steps="${steps}" style="--odo-order:${width - index}"><span class="odo-strip">${strip.map(d => `<span>${d}</span>`).join('')}</span><span class="odo-sizer">${char}</span></span>`;
    }).join('');
  }
  function rollPrices(before) {
    suppressRowEnter = false;
    if (!before) return;
    clearTimeout(rollTimer);
    const frame = dom.table.closest('.table-frame')?.getBoundingClientRect();
    const top = Math.max(0, frame?.top || 0), bottom = Math.min(innerHeight, frame?.bottom ?? innerHeight);
    let longest = 0;
    const rolled = [];
    dom.table.querySelectorAll('td.price-cell').forEach(td => {
      const from = before.get(`${td.dataset.row}:${td.dataset.col}`);
      const to = priceValueOf(td);
      if (from == null || to == null || from === to) return;
      const box = td.getBoundingClientRect();
      // Only prices in view roll; the rest already show their new value.
      if (box.bottom < top || box.top > bottom) return;
      const rising = to > from;
      const delay = Math.round(Math.min(450, Math.max(0, box.top - top) * 0.5));
      td.style.setProperty('--roll-delay', `${delay}ms`);
      td.classList.remove('price-rise', 'price-fall');
      void td.offsetWidth;
      td.classList.add(rising ? 'price-rise' : 'price-fall');
      td.innerHTML = `<span class="odo" aria-label="${money.format(to)}">${odometerMarkup(money.format(from), money.format(to), rising)}</span>`;
      td.querySelectorAll('.odo-wheel').forEach(wheel => {
        const steps = Number(wheel.dataset.steps);
        const duration = 650 + Math.min(steps, 20) * 22 + (Number(wheel.style.getPropertyValue('--odo-order')) < 3 ? 120 : 0);
        const travel = `${-steps * 1.25}em`;
        const strip = wheel.firstElementChild;
        strip.animate(
          rising ? [{ transform: 'translateY(0)' }, { transform: `translateY(${travel})` }] : [{ transform: `translateY(${travel})` }, { transform: 'translateY(0)' }],
          { duration, delay, easing: 'cubic-bezier(.2, .75, .25, 1.03)', fill: 'both' }
        );
        longest = Math.max(longest, delay + duration);
      });
      rolled.push({ td, to });
    });
    // Afterwards the cells hold plain text again, as the editor expects.
    if (rolled.length) rollTimer = setTimeout(() => rolled.forEach(({ td, to }) => { if (td.isConnected && td.querySelector('.odo')) td.textContent = money.format(to); }), longest + 80);
  }

  async function applyPriceAdjustment() {
    const rawVal = String(dom.percentage.value ?? '').trim();
    if (rawVal === '') {
      return toast('Please enter a percentage adjustment (e.g. 5 for +5%, -10 for -10%).');
    }
    const value = Number(rawVal);
    if (!Number.isFinite(value) || value < -100 || value > 10000) {
      return toast('Enter a percentage from -100 to 10,000.');
    }
    const allCategories = getPriceCategories();
    if (!allCategories.length) {
      return toast('No categories available in the active price list.');
    }
    const selectedCats = [...selectedAdjustmentCategories];
    if (!selectedCats.length) {
      return toast('Please select at least one category to apply the adjustment.');
    }

    const pricesBefore = capturePrices();
    selectedCats.forEach(cat => {
      state.categoryAdjustments[cat] = value;
    });

    const isAll = selectedCats.length === allCategories.length;
    if (isAll) {
      state.adjustment = value;
    }

    const sign = value > 0 ? '+' : '';
    let affectedProducts = 0;
    allCategories.forEach(c => {
      if (selectedAdjustmentCategories.has(c.name)) affectedProducts += c.count;
    });

    if (state.active) {
      markDraft();
      loadActive(state.active);
    } else {
      updateMetrics();
      renderTable();
    }
    rollPrices(pricesBefore);
    setPriceEditor(false);

    const scopeText = isAll ? 'all categories' : selectedCats.length === 1 ? selectedCats[0] : `${selectedCats.length} categories`;
    logActivity('price_adjust', `Applied ${sign}${value}% to ${scopeText}`, `${sign}${value}% applied to ${affectedProducts.toLocaleString()} products (${selectedCats.join(', ')}). Calculated from the uploaded prices.`, {
      percentage: value, applyAll: isAll, categories: selectedCats, category: selectedCats.length === 1 ? selectedCats[0] : '', adjustedProducts: affectedProducts
    });
    toast(`Applied ${sign}${value}% to ${scopeText}. ${state.autoApprove ? 'Save to approve it and make it exportable.' : 'Save to submit for approval.'}`);
  }

  $('#previewButton')?.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    applyPriceAdjustment();
  });
  $('#adjustmentForm')?.addEventListener('submit', event => {
    event.preventDefault();
    event.stopPropagation();
    applyPriceAdjustment();
  });
  dom.percentage?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      applyPriceAdjustment();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      // The field accepts cents (step 0.01), but arrows step by whole percents.
      event.preventDefault();
      const delta = (event.key === 'ArrowUp' ? 1 : -1) * (event.shiftKey ? 10 : 1);
      const next = Math.round(((Number(dom.percentage.value) || 0) + delta) * 100) / 100;
      dom.percentage.value = Math.min(10000, Math.max(-100, next));
      updateAdjustmentUI();
    }
  });
  dom.percentage?.addEventListener('input', () => {
    updateAdjustmentUI();
  });
  dom.closeAdjustmentBarBtn?.addEventListener('click', () => {
    setPriceEditor(false);
  });
  dom.categoryCheckboxesList?.addEventListener('change', event => {
    const cb = event.target.closest('.category-adjust-checkbox');
    if (!cb) return;
    const cat = cb.value;
    if (cb.checked) {
      selectedAdjustmentCategories.add(cat);
    } else {
      selectedAdjustmentCategories.delete(cat);
    }
    cb.closest('.adj-cat-row')?.classList.toggle('checked', cb.checked);
    updateAdjustmentUI();
  });
  dom.adjAllCategories?.addEventListener('change', () => {
    const listed = listedAdjustmentCategories();
    const selectAll = listed.some(c => !selectedAdjustmentCategories.has(c.name));
    listed.forEach(c => selectAll ? selectedAdjustmentCategories.add(c.name) : selectedAdjustmentCategories.delete(c.name));
    renderCategoryAdjustmentList();
  });
  dom.categoryAdjustSearch?.addEventListener('input', () => {
    renderCategoryAdjustmentList();
  });
  $$('.adj-preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      dom.percentage.value = chip.dataset.preset;
      updateAdjustmentUI();
      dom.percentage.focus();
    });
  });
  dom.search.addEventListener('input', () => { state.search = dom.search.value; renderTable(); });
  dom.category.addEventListener('change', () => {
    state.category = dom.category.value;
    state.categoryChosen = true;
    rememberCategory(state.category);
    dom.category.title = dom.category.selectedOptions[0]?.textContent || '';
    const cat = String(state.category || '').trim();
    dom.percentage.value = getCategoryAdjustment(cat);
    updateMetrics();
    renderTable();
  });
  $('#saveButton').addEventListener('click', event => {
    event.stopPropagation();
    if (!can('save')) return toast('You do not have permission to save price lists.');
    if (!state.active) return toast('Please upload or open a price list first before saving.');
    if (!state.active.isDraft && state.active.status === 'pending') return toast('This price list is already saved and waiting for approval. Make changes first to save a new version.');
    if (!state.active.isDraft && ['approved', 'uploaded'].includes(state.active.status)) return toast('No changes to save. Adjust prices or edit cells first, then save to send the changes for approval.');
    dom.versionNameInput.value = state.active.name || '';
    dom.savePriceLevel.innerHTML = priceLevelOptionsHtml(state.active.priceLevel);
    dom.savePriceLevel.value = canonicalPriceLevel(state.active.priceLevel) || '';
    dom.saveCountry.innerHTML = countryOptionsHtml(state.active.country, 'Select country…');
    dom.saveCountry.value = canonicalCountry(state.active.country) || '';
    // Price level and country are chosen at upload; show them read-only unless one is missing (older lists).
    const metaMissing = !dom.savePriceLevel.value.trim() || !dom.saveCountry.value.trim();
    $('#saveMetaPriceLevel').textContent = state.active.priceLevel || 'Not set';
    $('#saveMetaCountry').textContent = state.active.country || 'Not set';
    $('#saveMetaReadonly').hidden = metaMissing;
    $('#saveMetaEdit').hidden = !metaMissing;
    dom.saveApproversNote.textContent = state.autoApprove
      ? 'As the approver, your save is approved immediately and is ready for export.'
      : state.approvers.length
        ? `Approval request goes to ${state.approvers.join(state.approvalMode === 'all' ? ' and ' : ' or ')}${state.approvalMode === 'all' ? ' (all must approve)' : ''}.`
        : 'No approver is configured for your account. Ask an administrator to update the approval routing.';
    dom.confirmSave.textContent = state.autoApprove ? 'Save & approve' : 'Save & submit for approval';
    $('#saveDialog .save-version-dialog > p.muted').textContent = state.autoApprove
      ? 'Check the adjustments and edits below. Your save is approved right away and can be exported immediately.'
      : 'Check the adjustments and edits below. Saving sends this price list for approval. It can be exported once it is approved.';
    dom.saveConfirmCheck.checked = false;
    dom.confirmSave.disabled = true;
    renderSaveSummary();
    renderSaveEdits();
    dom.saveDialog.showModal();
    requestAnimationFrame(() => {
      dom.versionNameInput.focus();
      dom.versionNameInput.select();
    });
  });
  dom.saveForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (event.submitter && event.submitter.value === 'cancel') {
      dom.saveDialog.close();
      return;
    }
    const name = dom.versionNameInput.value.trim();
    if (!name) {
      dom.versionNameInput.focus();
      return toast('Please enter a price list name.');
    }
    if (!dom.savePriceLevel.value.trim() || !dom.saveCountry.value.trim()) {
      return toast('Enter the price level and country.');
    }
    if (!dom.saveConfirmCheck.checked) return toast('Confirm that you have reviewed the prices.');
    dom.saveDialog.close();
    try {
      await save(name);
    } catch (error) {
      toast(error.message);
    }
  });
  dom.saveConfirmCheck?.addEventListener('change', () => { dom.confirmSave.disabled = !dom.saveConfirmCheck.checked; });
  $('#closeFileBtn')?.addEventListener('click', closeActiveFile);
  $('#editSaveMetaBtn')?.addEventListener('click', () => {
    $('#saveMetaReadonly').hidden = true;
    $('#saveMetaEdit').hidden = false;
    dom.savePriceLevel.focus();
  });
  $('#excelButton').addEventListener('click', () => requestExport('excel'));
  $('#pdfButton').addEventListener('click', () => requestExport('pdf'));

  // --- Workspace filters ---
  dom.codeFilterInput?.addEventListener('input', () => { state.codeFilter = dom.codeFilterInput.value; renderTable(); });
  dom.priceLevelSelect?.addEventListener('change', () => { state.priceLevelFilter = dom.priceLevelSelect.value; renderTable(); });
  dom.countrySelect?.addEventListener('change', () => { state.countryFilter = dom.countrySelect.value; renderTable(); });
  dom.clearFiltersBtn?.addEventListener('click', () => { resetFilters(); renderTable(); });
  dom.emptyBrowseListsButton?.addEventListener('click', () => switchPanel('listsPanel', true));

  // --- Approval decisions ---
  function openDecisionDialog(kind, versionId) {
    const summary = versionSummaryById(versionId) || (String(state.active?.id) === String(versionId) ? state.active : null);
    if (!summary) return toast('Price list not found. Refresh and try again.');
    state.pendingDecision = { kind, id: versionId };
    const label = `${summary.name}${summary.revision > 1 ? ` (rev ${summary.revision})` : ''}`;
    if (kind === 'approve') {
      dom.approveDialogTitle.textContent = `Approve ${label}?`;
      dom.approveDialogText.textContent = `Saved by ${summary.savedBy} on ${displayDate(summary.savedAt)} · ${summary.priceLevel || '—'} · ${summary.country || '—'}. Once approved, it becomes available for export.`;
      const adjusted = summary.summary?.adjustedCategories || [];
      dom.approveDialogSummary.innerHTML = (adjusted.length
        ? adjusted.map(item => `<div class="save-summary-row"><div class="save-summary-cat-info"><strong class="save-summary-cat-name">${escapeHtml(item.category)}</strong><span class="save-summary-cat-count">${Number(item.productCount || 0).toLocaleString()} products</span></div><span class="adjustment-pill ${item.adjustment > 0 ? 'pos' : 'neg'}">${item.adjustment > 0 ? '+' : ''}${item.adjustment}%</span></div>`).join('')
        : '<div class="save-summary-empty">Original prices (no percentage adjustment).</div>')
        + (summary.changeCount ? `<div class="save-summary-unchanged"><strong>${Number(summary.changeCount).toLocaleString()}</strong> individual cell edit(s). Open the price list to review them.</div>` : '');
      dom.approveRemarks.value = '';
      dom.approveDialog.showModal();
    } else {
      dom.rejectDialogTitle.textContent = `Reject ${label}?`;
      dom.rejectRemarks.value = '';
      dom.rejectDialog.showModal();
      requestAnimationFrame(() => dom.rejectRemarks.focus());
    }
  }
  /** A rubber stamp lands mid-screen after a decision: APPROVED (pink) or RETURNED (red). */
  function stampDecision(kind) {
    if (reducedMotion()) return;
    const approved = kind === 'approve';
    const today = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date());
    const stamp = document.createElement('div');
    stamp.className = `decision-stamp ${approved ? 'is-approved' : 'is-returned'}`;
    stamp.setAttribute('aria-hidden', 'true');
    stamp.innerHTML = `<div class="decision-stamp-body"><div class="decision-stamp-ink"><strong>${approved ? 'Approved' : 'Returned'}</strong><span>${escapeHtml(today)} · ${escapeHtml(state.user?.name || '')}</span></div></div>`;
    document.body.appendChild(stamp);
    // The page takes the hit as the stamp lands.
    setTimeout(() => $('.content')?.animate(
      [{ transform: 'translateY(0)' }, { transform: 'translateY(3px)' }, { transform: 'translateY(-1px)' }, { transform: 'translateY(0)' }],
      { duration: 240, easing: 'ease-out' }
    ), 300);
    setTimeout(() => stamp.remove(), 1900);
  }
  async function submitDecision(kind, remarks) {
    const decision = state.pendingDecision;
    if (!decision || decision.kind !== kind) return;
    try {
      const data = await api(kind, { method: 'POST', body: JSON.stringify({ id: decision.id, remarks }) });
      state.pendingDecision = null;
      stampDecision(kind);
      if (String(state.active?.id) === String(decision.id) && !state.active.isDraft) loadActive(data.active);
      await refreshState();
      toast(data.message);
    } catch (error) {
      toast(error.message);
    }
  }
  dom.approveForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (event.submitter?.value === 'cancel') { dom.approveDialog.close(); return; }
    dom.approveDialog.close();
    await submitDecision('approve', dom.approveRemarks.value.trim());
  });
  dom.rejectForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (event.submitter?.value === 'cancel') { dom.rejectDialog.close(); return; }
    const remarks = dom.rejectRemarks.value.trim();
    if (!remarks) { dom.rejectRemarks.focus(); return toast('Enter the reason for rejecting.'); }
    dom.rejectDialog.close();
    await submitDecision('reject', remarks);
  });
  async function runListAction(action, id) {
    const version = versionSummaryById(id);
    if (!version) return toast('Price list not found. Refresh and try again.');
    if (action === 'open') {
      if (String(state.active?.id) === String(id)) return switchPanel('workspacePanel', true);
      try { await openVersion(id); } catch (error) { toast(error.message); }
    } else if (action === 'approve' || action === 'reject') {
      openDecisionDialog(action, id);
    } else if (action === 'export-excel' || action === 'export-pdf') {
      await requestExport(action === 'export-pdf' ? 'pdf' : 'excel', id);
    } else if (action === 'delete') {
      if (!version.canDelete) return toast('Approved price lists are kept as the record of published prices.');
      const withdraw = version.status === 'pending';
      state.pendingDelete = id;
      $('#deleteDialogKicker').textContent = withdraw ? 'Approval request' : 'Permanent action';
      $('#deleteDialogTitle').textContent = withdraw ? 'Withdraw approval request?' : version.source === 'upload' ? 'Delete uploaded file?' : 'Delete rejected price list?';
      $('#deleteDialogText').innerHTML = withdraw
        ? 'This withdraws <strong id="deleteVersionName"></strong> from approval. Approvers will no longer see it. This cannot be undone.'
        : 'This removes <strong id="deleteVersionName"></strong>. This action cannot be undone.';
      dom.deleteVersionName = $('#deleteVersionName');
      dom.deleteVersionName.textContent = version.name;
      $('#confirmDelete').textContent = withdraw ? 'Withdraw request' : 'Delete';
      dom.deleteDialog.showModal();
    }
  }

  // --- Row kebab menu (single shared, fixed-position element so the scrolling table cannot clip it) ---
  const rowMenu = $('#rowMenu');
  const menuIcons = {
    open: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    approve: '<polyline points="20 6 9 17 4 12"/>',
    reject: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    'export-excel': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    'export-pdf': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    delete: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'
  };
  let rowMenuTrigger = null;
  function closeRowMenu() {
    if (!rowMenu || rowMenu.hidden) return;
    rowMenu.hidden = true;
    rowMenuTrigger?.setAttribute('aria-expanded', 'false');
    rowMenuTrigger?.classList.remove('is-open');
    rowMenuTrigger = null;
  }
  function openRowMenu(trigger) {
    const version = versionSummaryById(trigger.dataset.id);
    if (!rowMenu || !version) return;
    const isOpen = String(state.active?.id) === String(version.id);
    const exportable = ['approved', 'uploaded'].includes(version.status) && can('export');
    const item = (action, label, { danger = false, disabled = false, hint = '' } = {}) =>
      `<button type="button" role="menuitem" class="row-menu-item ${danger ? 'danger' : ''}" data-action="${action}" ${disabled ? 'disabled' : ''}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${menuIcons[action]}</svg>
        <span>${label}</span>${hint ? `<small>${hint}</small>` : ''}</button>`;
    const groups = [
      [item('open', isOpen ? 'Go to editor' : 'Open in editor', { hint: isOpen ? 'Already open' : '' })],
      version.canApprove ? [item('approve', 'Approve'), item('reject', 'Reject', { danger: true })] : [],
      can('export') ? [
        item('export-excel', 'Export Excel', { disabled: !exportable, hint: exportable ? '.xlsx' : 'After approval' }),
        item('export-pdf', 'Export PDF', { disabled: !exportable, hint: exportable ? '.pdf' : 'After approval' })
      ] : [],
      // Approved lists are the record of published prices; only pending, rejected and unused uploads go.
      version.canDelete ? [item('delete', version.status === 'pending' ? 'Withdraw request' : 'Delete', { danger: true })] : []
    ].filter(group => group.length);
    rowMenu.innerHTML = groups.map(group => group.join('')).join('<div class="row-menu-sep" role="separator"></div>');
    rowMenu.dataset.id = version.id;
    rowMenu.hidden = false;
    const rect = trigger.getBoundingClientRect();
    const menuRect = rowMenu.getBoundingClientRect();
    const top = rect.bottom + 6 + menuRect.height > window.innerHeight ? rect.top - menuRect.height - 6 : rect.bottom + 6;
    rowMenu.style.top = `${Math.max(8, top)}px`;
    rowMenu.style.left = `${Math.max(8, Math.min(rect.right - menuRect.width, window.innerWidth - menuRect.width - 8))}px`;
    rowMenuTrigger = trigger;
    trigger.setAttribute('aria-expanded', 'true');
    trigger.classList.add('is-open');
    rowMenu.querySelector('.row-menu-item:not([disabled])')?.focus();
  }
  ['#listsTable', '#filesTable'].forEach(selector => $(selector)?.addEventListener('click', async event => {
    const kebab = event.target.closest('.kebab-btn');
    if (kebab) {
      event.stopPropagation();
      const wasOpen = rowMenuTrigger === kebab;
      closeRowMenu();
      if (!wasOpen) openRowMenu(kebab);
      return;
    }
    const primary = event.target.closest('.row-primary');
    if (primary && !primary.disabled) await runListAction(primary.dataset.action, primary.dataset.id);
  }));
  rowMenu?.addEventListener('click', async event => {
    const itemButton = event.target.closest('.row-menu-item');
    if (!itemButton || itemButton.disabled) return;
    const id = rowMenu.dataset.id;
    const trigger = rowMenuTrigger;
    closeRowMenu();
    await runListAction(itemButton.dataset.action, id);
    trigger?.isConnected && trigger.focus();
  });
  rowMenu?.addEventListener('keydown', event => {
    const items = $$('.row-menu-item:not([disabled])', rowMenu);
    const index = items.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') { event.preventDefault(); items[(index + 1) % items.length]?.focus(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); items[(index - 1 + items.length) % items.length]?.focus(); }
    else if (event.key === 'Escape' || event.key === 'Tab') { const trigger = rowMenuTrigger; closeRowMenu(); if (event.key === 'Escape') trigger?.focus(); }
  });
  document.addEventListener('click', event => { if (!event.target.closest('#rowMenu')) closeRowMenu(); });
  window.addEventListener('resize', closeRowMenu);
  window.addEventListener('resize', () => { if (!$('#adjustmentBar')?.hidden) setPriceEditor(false); });
  document.addEventListener('scroll', closeRowMenu, true);
  $$('.list-tab-btn').forEach(button => button.addEventListener('click', () => { state.listTab = button.dataset.listTab; renderLists(); }));
  dom.listSearchInput?.addEventListener('input', () => { state.listSearch = dom.listSearchInput.value; renderLists(); });
  dom.listPriceLevelFilter?.addEventListener('change', () => { state.listPriceLevel = dom.listPriceLevelFilter.value; renderLists(); });
  dom.listCountryFilter?.addEventListener('change', () => { state.listCountry = dom.listCountryFilter.value; renderLists(); });
  dom.listStatusFilter?.addEventListener('change', () => { state.listStatus = dom.listStatusFilter.value; renderLists(); });
  $('#refreshListsBtn')?.addEventListener('click', async () => {
    try { await refreshState(); toast('Approvals refreshed.'); } catch (error) { toast(error.message); }
  });
  dom.bannerApproveBtn?.addEventListener('click', () => state.active?.id && openDecisionDialog('approve', state.active.id));
  dom.bannerRejectBtn?.addEventListener('click', () => state.active?.id && openDecisionDialog('reject', state.active.id));
  // The tab title is "<page> · <app name>" (set by components/app_shell.php).
  const APP_TITLE = document.title.split(' · ').slice(1).join(' · ') || document.title;
  // Each page has its own file in pages/; the page file tells the shell which panel to open.
  const PANEL_PAGES = {
    workspacePanel: 'prices.php',
    filesPanel: 'files.php',
    listsPanel: 'approvals.php',
    historyPanel: 'audit_logs.php',
    settingsPanel: 'config.php'
  };
  function getInitialPanelId() {
    const panel = document.body.dataset.panel;
    return PANEL_PAGES[panel] ? panel : 'workspacePanel';
  }

  function switchPanel(panelId, updateUrl = true) {
    let targetButton = $$('.nav-item').find(btn => btn.dataset.panel === panelId);
    if (!targetButton || targetButton.hidden) {
      targetButton = $$('.nav-item')[0];
    }
    if (!targetButton) return;
    const finalPanelId = targetButton.dataset.panel;
    setPriceEditor(false);
    // Nothing from the page being left stays floating over the next one.
    toggleSwitcher(false);
    toggleCategoryMenu(false);
    closeRowMenu();
    toggleNotifications(false);

    document.documentElement.removeAttribute('data-initial-panel');

    $$('.nav-item').forEach(item => item.classList.toggle('active', item === targetButton));
    $$('.panel').forEach(panel => {
      const isTarget = panel.id === finalPanelId;
      panel.hidden = !isTarget;
      panel.classList.toggle('active', isTarget);
    });
    document.querySelector('.content')?.classList.toggle('history-active', ['historyPanel', 'listsPanel', 'filesPanel'].includes(finalPanelId));

    if (finalPanelId === 'settingsPanel') switchConfigTab(state.configTab || 'library');
    if (finalPanelId === 'historyPanel') renderHistory();
    if (finalPanelId === 'listsPanel') renderLists();
    if (finalPanelId === 'filesPanel') renderFiles();

    // Show the page's own file in the address bar, so a refresh or bookmark opens this page.
    const pageFile = PANEL_PAGES[finalPanelId];
    const pageName = targetButton.querySelector('strong')?.textContent.trim();
    if (pageName) document.title = `${pageName} · ${APP_TITLE}`;
    if (updateUrl && pageFile && !location.pathname.endsWith(`/${pageFile}`)) {
      history.replaceState(null, '', pageFile);
    }
  }

  $$('.nav-item').forEach(button => button.addEventListener('click', () => {
    switchPanel(button.dataset.panel, true);
  }));

  window.addEventListener('hashchange', () => {
    switchPanel(getInitialPanelId(), false);
  });
  document.addEventListener('click', event => {
    if (!$('#adjustmentBar').hidden && !event.target.closest('#adjustmentBar') && !event.target.closest('#editButton')) {
      setPriceEditor(false);
    }
  });

  ['#editButton', '#resetPricesButton', '#uploadButton', '#saveButton'].forEach(selector => {
    const button = $(selector);
    if (!button) return;
    button.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        button.click();
      }
    });
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('#adjustmentBar').hidden) { setPriceEditor(false); $('#editButton').focus(); }
    if (event.key === '/' && document.activeElement !== dom.search && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      event.preventDefault();
      dom.search.focus();
    }
  });
  dom.historyTable?.addEventListener('click', async event => {
    const viewAuditDiffBtn = event.target.closest('.view-audit-diff-btn');
    if (viewAuditDiffBtn) {
      event.stopPropagation();
      const logId = viewAuditDiffBtn.dataset.logId;
      const log = (state.auditLogs || []).find(l => String(l.id) === String(logId));
      if (log) {
        showAuditLogModal(log);
      }
      return;
    }

    const auditRow = event.target.closest('.audit-event-row');
    if (auditRow && !event.target.closest('button') && !event.target.closest('a') && !event.target.closest('.history-dropdown-menu')) {
      const viewBtn = auditRow.querySelector('.view-audit-diff-btn');
      if (viewBtn) {
        viewBtn.click();
        return;
      }
    }

    const openButton = event.target.closest('.open-version');
    if (openButton) {
      try {
        await openVersion(openButton.dataset.id);
      } catch (error) {
        toast(error.message);
      }
      return;
    }

    const moreTrigger = event.target.closest('.more-menu-trigger');
    if (moreTrigger) {
      event.stopPropagation();
      const wrapper = moreTrigger.closest('.history-more-wrapper');
      const dropdown = wrapper?.querySelector('.history-dropdown-menu');
      const isHidden = dropdown?.hidden ?? true;
      $$('.history-dropdown-menu').forEach(m => m.hidden = true);
      if (dropdown) dropdown.hidden = !isHidden;
      return;
    }

    const copyBtn = event.target.closest('.copy-version-id');
    if (copyBtn) {
      event.stopPropagation();
      const id = copyBtn.dataset.id;
      if (id) {
        navigator.clipboard?.writeText(id).then(() => {
          toast('Version ID copied to clipboard.');
        }).catch(() => {
          toast(`Version ID: ${id}`);
        });
      }
      $$('.history-dropdown-menu').forEach(m => m.hidden = true);
      return;
    }

    const viewChangesBtn = event.target.closest('.view-changes-link');
    if (viewChangesBtn) {
      event.stopPropagation();
      const versionId = viewChangesBtn.dataset.id;
      const version = (state.versions || []).find(v => String(v.id) === String(versionId));
      if (version && version.summary) {
        const dialog = $('#historyChangesDialog');
        const title = $('#historyChangesTitle');
        const meta = $('#historyChangesMeta');
        const content = $('#historyChangesContent');
        if (dialog && title && meta && content) {
          title.textContent = version.name || 'Adjustment breakdown';
          const affected = version.summary.totalAdjustedProducts ?? 0;
          meta.textContent = `${Number(affected).toLocaleString()} products affected across ${(version.summary.adjustedCategories || []).length} categories`;
          content.innerHTML = (version.summary.adjustedCategories || []).map(cat => {
            const num = Number(cat.adjustment || 0);
            const sign = num > 0 ? '+' : '';
            const cls = num > 0 ? 'pos' : num < 0 ? 'neg' : 'zero';
            return `
              <div class="history-change-item">
                <div>
                  <strong>${escapeHtml(cat.category)}</strong>
                  ${cat.productCount ? `<div class="history-change-subtext">${cat.productCount} pcs</div>` : ''}
                </div>
                <span class="change-badge ${cls}">${sign}${num}%</span>
              </div>`;
          }).join('') || '<div class="history-change-empty">No specific category adjustments recorded.</div>';
          dialog.showModal();
        }
      }
      $$('.history-dropdown-menu').forEach(m => m.hidden = true);
      return;
    }

    const deleteButton = event.target.closest('.delete-version');
    if (!deleteButton) return;
    $$('.history-dropdown-menu').forEach(m => m.hidden = true);
    state.pendingDelete = deleteButton.dataset.id;
    dom.deleteVersionName.textContent = deleteButton.dataset.name;
    dom.deleteDialog.showModal();
  });

  document.addEventListener('click', event => {
    if (!event.target.closest('.history-more-wrapper')) {
      $$('.history-dropdown-menu').forEach(m => m.hidden = true);
    }
  });

  $('#historyFirstBtn')?.addEventListener('click', () => {
    if (state.historyPage !== 1) {
      state.historyPage = 1;
      renderHistory();
    }
  });

  $('#historyPrevBtn')?.addEventListener('click', () => {
    if (state.historyPage > 1) {
      state.historyPage--;
      renderHistory();
    }
  });

  $('#historyNextBtn')?.addEventListener('click', () => {
    state.historyPage = (state.historyPage || 1) + 1;
    renderHistory();
  });

  $('#historyLastBtn')?.addEventListener('click', () => {
    state.historyPage = 999999;
    renderHistory();
  });

  $('#historyPageNumbers')?.addEventListener('click', event => {
    const btn = event.target.closest('.history-page-btn');
    if (!btn || btn.classList.contains('active')) return;
    const targetPage = Number(btn.dataset.page);
    if (Number.isFinite(targetPage) && targetPage > 0) {
      state.historyPage = targetPage;
      renderHistory();
    }
  });

  $('#historyPageSizeSelect')?.addEventListener('change', event => {
    const newSize = Number(event.target.value);
    if (Number.isFinite(newSize) && newSize > 0) {
      state.historyPageSize = newSize;
      state.historyPage = 1;
      renderHistory();
    }
  });

  $('#confirmDelete').addEventListener('click', async event => {
    event.preventDefault();
    if (!state.pendingDelete) return;
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const deletedId = state.pendingDelete;
      const data = await api('delete-version', { method: 'POST', body: JSON.stringify({ id: deletedId }) });
      state.pendingDelete = null;
      dom.deleteDialog.close();
      if (String(state.active?.id) === String(deletedId) && !state.active.isDraft) loadActive(null);
      await refreshState();
      toast(data.message);
    } catch (error) {
      toast(error.message);
    } finally {
      button.disabled = false;
    }
  });

  dom.emptyGoToPricesBtn?.addEventListener('click', () => $$('.nav-item')[0].click());
  dom.imageCategoryFilter?.addEventListener('change', () => {
    state.imageCategory = dom.imageCategoryFilter.value;
    renderImageSettings();
  });
  dom.imageSearchInput?.addEventListener('input', () => {
    state.imageSearch = dom.imageSearchInput.value;
    renderImageSettings();
  });
  dom.imageSettingsList?.addEventListener('click', event => {
    const chooseButton = event.target.closest('.choose-group-image');
    if (chooseButton) {
      openPhotoPicker(chooseButton.dataset.category || '', chooseButton.dataset.group || '');
      return;
    }
    const deleteButton = event.target.closest('.delete-group-image');
    if (!deleteButton) return;
    state.pendingImageDelete = {
      key: deleteButton.dataset.key || '',
      name: deleteButton.dataset.name || 'this product type'
    };
    dom.deleteImageName.textContent = state.pendingImageDelete.name;
    dom.deleteImageDialog.showModal();
  });
  dom.groupImageInput?.addEventListener('change', async () => {
    const file = dom.groupImageInput.files?.[0];
    const target = state.pendingImageGroup;
    if (!file || !target) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      dom.groupImageInput.value = '';
      return toast('Use a JPG, PNG, or WebP image.');
    }
    if (file.size > 6 * 1024 * 1024) {
      dom.groupImageInput.value = '';
      return toast('Images must be smaller than 6 MB.');
    }
    const form = new FormData();
    form.append('category', target.category);
    form.append('groupName', target.groupName);
    form.append('image', file);
    const activeButton = target.button;
    if (activeButton) {
      activeButton.disabled = true;
      activeButton.textContent = 'Uploading...';
    }
    try {
      const data = await api('upload-group-image', {
        method: 'POST',
        headers: { 'X-CSRF-Token': state.csrf || '' },
        body: form
      });
      const lookup = groupLookupKey(data.image.category, data.image.groupName);
      state.productImages = state.productImages.filter(image => groupLookupKey(image.category, image.groupName) !== lookup);
      state.productImages.push(data.image);
      clearPdfImageCache();
      renderImageSettings();
      renderTable();
      toast(data.message);
    } catch (error) {
      toast(error.message);
    } finally {
      state.pendingImageGroup = null;
      dom.groupImageInput.value = '';
      if (activeButton?.isConnected) {
        activeButton.disabled = false;
        if (!activeButton.classList.contains('group-add-photo-btn') && !activeButton.classList.contains('group-photo-change-btn')) {
          activeButton.textContent = 'Change photo';
        }
      }
    }
  });
  dom.deleteImageForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (event.submitter?.value === 'cancel') {
      state.pendingImageDelete = null;
      dom.deleteImageDialog.close();
      return;
    }
    if (!state.pendingImageDelete?.key) return;
    const button = $('#confirmDeleteImage');
    button.disabled = true;
    try {
      const data = await api('delete-group-image', {
        method: 'POST',
        body: JSON.stringify({ key: state.pendingImageDelete.key })
      });
      state.productImages = state.productImages.filter(image => image.key !== state.pendingImageDelete.key);
      state.pendingImageDelete = null;
      clearPdfImageCache();
      dom.deleteImageDialog.close();
      renderImageSettings();
      renderTable();
      toast(data.message);
    } catch (error) {
      toast(error.message);
    } finally {
      button.disabled = false;
    }
  });
  dom.historySearchInput?.addEventListener('input', () => {
    state.historySearch = dom.historySearchInput.value;
    state.historyPage = 1;
    renderHistory();
  });
  dom.historyAdjustmentSelect?.addEventListener('change', () => {
    state.historyAdjustment = dom.historyAdjustmentSelect.value;
    state.historyPage = 1;
    renderHistory();
  });

  // Audit Hub Segmented Tabs
  $$('.audit-tab-btn[data-audit-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.auditTab = btn.dataset.auditTab || 'all';
      state.historyPage = 1;
      renderHistory();
    });
  });

  // Audit Hub Filters & Refresh
  dom.auditFileSelect?.addEventListener('change', () => {
    state.auditFile = dom.auditFileSelect.value;
    state.historyPage = 1;
    renderHistory();
  });
  dom.auditTypeSelect?.addEventListener('change', () => {
    state.auditType = dom.auditTypeSelect.value;
    state.historyPage = 1;
    renderHistory();
  });
  dom.auditUserSelect?.addEventListener('change', () => {
    state.auditUser = dom.auditUserSelect.value;
    state.historyPage = 1;
    renderHistory();
  });
  dom.refreshAuditLogsBtn?.addEventListener('click', async () => {
    if (dom.refreshAuditLogsBtn) dom.refreshAuditLogsBtn.disabled = true;
    try {
      const res = await api('audit-logs');
      if (res.ok && Array.isArray(res.auditLogs)) {
        state.auditLogs = res.auditLogs;
        renderHistory();
        toast('Audit trail refreshed.');
      }
    } catch {
      toast('Failed to refresh audit trail.');
    } finally {
      if (dom.refreshAuditLogsBtn) dom.refreshAuditLogsBtn.disabled = false;
    }
  });

  // Notification Bell -> Audit Hub Navigation
  dom.openAuditLogsFromBell?.addEventListener('click', () => {
    toggleNotifications(false);
    switchPanel('listsPanel', true);
  });
  async function activateNotification(item) {
    if (!item) return;
    toggleNotifications(false);
    if (item.classList.contains('is-unread')) markNotificationsRead([item.dataset.id]);
    const versionId = item.dataset.versionId;
    if (versionId && versionSummaryById(versionId)) {
      try { await openVersion(versionId); } catch (error) { toast(error.message); }
    } else {
      switchPanel('listsPanel', true);
    }
  }
  dom.notificationsList?.addEventListener('click', event => activateNotification(event.target.closest('.notification-item')));
  dom.notificationsList?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activateNotification(event.target.closest('.notification-item'));
    }
  });

  // Audit / History modal dialog action delegation (e.g. open version in workspace)
  $('#historyChangesDialog')?.addEventListener('click', async event => {
    const openBtn = event.target.closest('.open-version');
    if (openBtn) {
      const versionId = openBtn.dataset.id;
      if (versionId) {
        $('#historyChangesDialog')?.close();
        try {
          await openVersion(versionId);
        } catch (error) {
          toast(error.message);
        }
      }
    }
  });

  dom.resetPricesButton?.addEventListener('click', event => {
    event.stopPropagation();
    if (!state.canEdit) return toast('You do not have permission to reset prices.');
    if (!state.active) return toast('Please upload or open a price list first.');
    if (!hasPriceAdjustments()) return toast('No price adjustments to reset (already at 0%).');
    // A small confirm card hanging from the Reset prices button, not a full-screen modal.
    const box = dom.resetPricesButton.getBoundingClientRect();
    dom.resetPricesDialog.style.top = `${Math.round(box.bottom + 10)}px`;
    dom.resetPricesDialog.style.right = `${Math.max(12, Math.round(innerWidth - box.right))}px`;
    dom.resetPricesDialog.showModal();
    requestAnimationFrame(() => $('#confirmResetPrices')?.focus());
  });
  // Clicking outside the card (its transparent backdrop) or resizing cancels it.
  dom.resetPricesDialog?.addEventListener('click', event => { if (event.target === dom.resetPricesDialog) dom.resetPricesDialog.close(); });
  window.addEventListener('resize', () => { if (dom.resetPricesDialog?.open) dom.resetPricesDialog.close(); });
  dom.resetPricesDialog?.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target !== dom.resetPricesDialog.querySelector('button[value="cancel"]')) {
      event.preventDefault();
      $('#confirmResetPrices')?.click();
    }
  });
  dom.saveDialog?.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target !== dom.saveDialog.querySelector('button[value="cancel"]')) {
      event.preventDefault();
      $('#confirmSave')?.click();
    }
  });
  dom.deleteDialog?.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target !== dom.deleteDialog.querySelector('button[value="cancel"]')) {
      event.preventDefault();
      $('#confirmDelete')?.click();
    }
  });
  dom.resetPricesForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (event.submitter && event.submitter.value === 'cancel') {
      dom.resetPricesDialog.close();
      return;
    }
    dom.resetPricesDialog.close();
    const previous = Object.entries(state.categoryAdjustments || {}).filter(([, v]) => Number(v) !== 0).map(([c, v]) => `${c} ${Number(v) > 0 ? '+' : ''}${v}%`);
    const pricesBefore = capturePrices();
    state.adjustment = 0;
    state.categoryAdjustments = {};
    if (state.active) {
      markDraft();
      logActivity('reset_prices', 'Reset price adjustments to 0%', previous.length ? `Cleared: ${previous.join(', ')}.` : 'All adjustments cleared.', { cleared: previous });
    }
    dom.percentage.value = 0;
    updateMetrics();
    renderTable();
    rollPrices(pricesBefore);
    toast('All price adjustments reset to original (0%). Uploaded file retained.');
  });

  // --- Spreadsheet Event Listeners ---
  dom.table?.addEventListener('click', event => {
    const chooseButton = event.target.closest('.choose-group-image');
    if (chooseButton) {
      if (!can('manageImages')) return;
      openPhotoPicker(chooseButton.dataset.category || '', chooseButton.dataset.group || '');
      return;
    }
    if (event.target.closest('.excel-cell-editor')) {
      return;
    }
    const td = event.target.closest('.excel-cell');
    if (td) {
      if (state.activeCell.td === td && !state.isEditing && state.canEdit) {
        startCellEdit(td, null, false);
      } else {
        selectCell(td, false);
      }
    } else {
      deselectCell();
    }
  });

  document.addEventListener('click', event => {
    if (state.activeCell.td) {
      const inTable = event.target.closest('#priceTable');
      const inFormula = event.target.closest('#excelFormulaBar');
      const inDialog = event.target.closest('dialog');
      if (!inTable && !inFormula && !inDialog) {
        deselectCell();
      }
    }
  });

  dom.table?.addEventListener('dblclick', event => {
    if (event.target.closest('.excel-cell-editor')) return;
    const td = event.target.closest('.excel-cell');
    if (td && state.canEdit && !state.isEditing) {
      startCellEdit(td, null, false);
    }
  });

  dom.table?.addEventListener('keydown', event => {
    if (state.isEditing) return;
    const activeTd = state.activeCell.td;
    if (!activeTd || !activeTd.isConnected) return;

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      navigateCell(-1, 0);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      navigateCell(1, 0);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      navigateCell(0, -1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      navigateCell(0, 1);
    } else if (event.key === 'Tab') {
      event.preventDefault();
      navigateCell(0, event.shiftKey ? -1 : 1);
    } else if (event.key === 'Enter' || event.key === 'F2') {
      event.preventDefault();
      if (state.canEdit) startCellEdit(activeTd, null, false);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      deselectCell();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      if (state.canEdit) {
        event.preventDefault();
        commitCellEdit(activeTd, '');
      }
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (state.canEdit) {
        event.preventDefault();
        startCellEdit(activeTd, event.key);
      }
    }
  });

  dom.formulaInput?.addEventListener('input', () => {
    if (!state.activeCell.td) return;
    if (state.isEditing) {
      const cellInput = state.activeCell.td.querySelector('.excel-cell-editor');
      if (cellInput) cellInput.value = dom.formulaInput.value;
    } else {
      state.activeCell.td.textContent = dom.formulaInput.value;
    }
  });

  dom.formulaInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      confirmFormulaEdit();
      navigateCell(1, 0);
    } else if (event.key === 'Tab') {
      event.preventDefault();
      confirmFormulaEdit();
      navigateCell(0, event.shiftKey ? -1 : 1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelFormulaEdit();
    }
  });

  dom.formulaConfirmBtn?.addEventListener('mousedown', event => {
    event.preventDefault();
  });
  dom.formulaConfirmBtn?.addEventListener('click', () => {
    confirmFormulaEdit();
  });

  dom.formulaCancelBtn?.addEventListener('mousedown', event => {
    event.preventDefault();
  });
  dom.formulaCancelBtn?.addEventListener('click', () => {
    cancelFormulaEdit();
  });

  dom.formulaCellIndicator?.addEventListener('click', () => {
    if (state.canEdit && !dom.formulaInput?.disabled) {
      dom.formulaInput?.focus();
      dom.formulaInput?.select();
    }
  });
  const fxLabel = $('#excelFormulaBar .formula-fx-label');
  fxLabel?.addEventListener('click', () => {
    if (state.canEdit && !dom.formulaInput?.disabled) {
      dom.formulaInput?.focus();
      dom.formulaInput?.select();
    }
  });


  // Upload Modal Listeners
  // In the Template rules view the × goes back to the upload view (like Esc) instead of closing.
  dom.closeUploadModalBtn?.addEventListener('click', () => {
    if (!$('#uploadGuideView').hidden) setUploadGuide(false);
    else closeUploadModal();
  });
  dom.cancelUploadBtn?.addEventListener('click', closeUploadModal);
  dom.downloadTemplateBtn?.addEventListener('click', downloadExcelTemplate);
  $('#guideDownloadTemplateBtn')?.addEventListener('click', downloadExcelTemplate);
  $('#uploadTemplateRulesBtn')?.addEventListener('click', () => setUploadGuide(true));
  $('#uploadGuideBackBtn')?.addEventListener('click', () => setUploadGuide(false));
  $('.template-layout-tabs')?.addEventListener('click', event => {
    const tab = event.target.closest('[data-template-layout]');
    if (tab) selectTemplateLayout(tab.dataset.templateLayout);
  });
  $('.template-layout-tabs')?.addEventListener('keydown', event => {
    const tabs = $$('.template-layout-tab');
    const current = tabs.indexOf(document.activeElement);
    if (current < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    selectTemplateLayout(tabs[next].dataset.templateLayout, true);
  });
  dom.browseFileBtn?.addEventListener('click', () => { if (!bulkImporting) dom.modalFileInput?.click(); });
  dom.modalDropZone?.addEventListener('click', event => {
    if (!event.target.closest('button, input') && !bulkImporting && (stagedFiles.length < MAX_BULK_FILES || stagedFiles.some(item => item.status))) dom.modalFileInput?.click();
  });
  dom.modalFileInput?.addEventListener('change', () => {
    stageFilesForUpload(dom.modalFileInput.files);
    dom.modalFileInput.value = '';
  });
  $('#stagedFilesList')?.addEventListener('input', event => {
    const input = event.target.closest('[data-field]');
    const row = event.target.closest('.staged-row');
    if (!input || !row) return;
    stagedFiles[Number(row.dataset.index)][input.dataset.field] = input.value;
    input.classList.remove('is-invalid');
  });
  $('#stagedFilesList')?.addEventListener('click', event => {
    const remove = event.target.closest('.staged-remove');
    if (!remove) return;
    stagedFiles.splice(Number(remove.dataset.index), 1);
    renderStagedFiles();
  });
  $('#applyAllBtn')?.addEventListener('click', () => {
    const country = $('#applyAllCountry').value.trim();
    const priceLevel = $('#applyAllPriceLevel').value.trim();
    if (!country && !priceLevel) return toast('Enter a country or price level to apply to every file.');
    stagedFiles.forEach(item => {
      if (country) item.country = country;
      if (priceLevel) item.priceLevel = priceLevel;
    });
    renderStagedFiles();
  });
  dom.uploadModal?.addEventListener('cancel', event => {
    if (bulkImporting || !$('#uploadGuideView').hidden) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!bulkImporting) setUploadGuide(false);
    }
  });
  dom.modalDropZone?.addEventListener('dragover', event => {
    event.preventDefault();
    dom.modalDropZone.classList.add('dragover');
  });
  dom.modalDropZone?.addEventListener('dragleave', () => {
    dom.modalDropZone.classList.remove('dragover');
  });
  dom.modalDropZone?.addEventListener('drop', event => {
    event.preventDefault();
    dom.modalDropZone.classList.remove('dragover');
    if (!bulkImporting) stageFilesForUpload(event.dataTransfer?.files);
  });
  dom.submitUploadBtn?.addEventListener('click', async () => {
    if (!stagedFiles.length || bulkImporting) return;
    if (stagedFiles.every(item => item.status === 'saved' || item.status === 'failed')) {
      const hasSaved = stagedFiles.some(item => item.status === 'saved');
      closeUploadModal();
      if (hasSaved) switchPanel('filesPanel', true);
      return;
    }
    const problem = validateStagedFiles();
    if (problem) return toast(problem);
    if (stagedFiles.length === 1) {
      const [item] = stagedFiles;
      bulkImporting = true;
      item.status = 'working'; item.message = 'Validating the complete workbook…';
      renderStagedFiles();
      try {
        await parseWorkbook(item.file, { name: item.name, country: item.country, priceLevel: item.priceLevel });
        bulkImporting = false;
        closeUploadModal();
      } catch (err) {
        bulkImporting = false;
        item.status = 'failed'; item.message = err.message || 'Failed to process Excel workbook.';
        renderStagedFiles();
      }
      return;
    }
    await importStagedFiles();
  });

  // --- Audit Logs & Notification System ---
  function formatRelativeTime(isoString) {
    if (!isoString) return 'Just now';
    const date = new Date(isoString);
    const diffMs = Date.now() - date.getTime();
    if (isNaN(diffMs)) return 'Recently';
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 30) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  }

  function getAuditTypeIcon(type) {
    switch (type) {
      case 'cell_edit':
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;
      case 'row_add':
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
      case 'row_delete':
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
      case 'price_adjust':
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>`;
      case 'reset_prices':
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`;
      case 'save_version':
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;
      case 'delete_version':
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
      default:
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }
  }

  function getNotificationIcon(type) {
    switch (type) {
      case 'approval_request': return getAuditTypeIcon('save_version');
      case 'approved':
      case 'available':
      case 'partial_approval':
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
      case 'rejected': return getAuditTypeIcon('delete_version');
      default: return getAuditTypeIcon('info');
    }
  }

  function renderNotifications() {
    const items = state.notifications || [];
    const unread = Number(state.unreadCount || 0);
    if (dom.notificationBadge) {
      dom.notificationBadge.hidden = unread === 0;
      dom.notificationBadge.textContent = unread > 99 ? '99+' : String(unread);
    }
    if (dom.notificationsCountBadge) dom.notificationsCountBadge.textContent = unread ? `${unread} unread` : `${items.length} ${items.length === 1 ? 'item' : 'items'}`;
    if (!dom.notificationsList) return;
    if (!items.length) {
      dom.notificationsList.innerHTML = '';
      if (dom.notificationsEmpty) dom.notificationsEmpty.hidden = false;
      return;
    }
    if (dom.notificationsEmpty) dom.notificationsEmpty.hidden = true;
    dom.notificationsList.innerHTML = items.map(item => `
        <div class="notification-item ${item.read ? '' : 'is-unread'}" data-type="${escapeHtml(item.type || 'info')}" data-id="${escapeHtml(item.id || '')}" data-version-id="${escapeHtml(item.versionId || '')}" role="button" tabindex="0">
          <div class="notification-icon-wrap" aria-hidden="true">${getNotificationIcon(item.type)}</div>
          <div class="notification-content">
            <div class="notification-row-top">
              <span class="notification-actor">${escapeHtml(item.title || 'Notification')}</span>
              <time class="notification-time" datetime="${escapeHtml(item.createdAt || '')}">${formatRelativeTime(item.createdAt)}</time>
            </div>
            ${item.message ? `<div class="notification-details-text">${escapeHtml(item.message)}</div>` : ''}
          </div>
        </div>`).join('');
  }

  async function markNotificationsRead(ids = null) {
    try {
      const data = await api('notifications-read', { method: 'POST', body: JSON.stringify({ ids }) });
      state.notifications = data.notifications || [];
      state.unreadCount = Number(data.unreadCount || 0);
      renderNotifications();
    } catch { }
  }

  async function logActivity(type, title, details = '', metadata = {}) {
    if (!state.user || !can('update')) return;
    const payloadMeta = {
      fileName: state.active?.name || 'Current file',
      versionId: state.active?.id || '',
      ...metadata
    };
    try {
      const res = await api('log-activity', {
        method: 'POST',
        body: JSON.stringify({ type, title, details, metadata: payloadMeta })
      });
      if (res.ok && res.log && can('viewAudit')) {
        state.auditLogs = [res.log, ...(state.auditLogs || [])];
        if ($('#historyPanel') && !$('#historyPanel').hidden) renderHistory();
      }
    } catch (err) {
      console.warn('Audit log error:', err);
    }
  }

  function toggleNotifications(force) {
    if (!dom.notificationsDropdown || !dom.notificationBtn) return;
    const shouldOpen = force !== undefined ? force : dom.notificationsDropdown.hidden;
    dom.notificationsDropdown.hidden = !shouldOpen;
    dom.notificationBtn.setAttribute('aria-expanded', String(shouldOpen));
    if (shouldOpen) renderNotifications();
  }

  dom.notificationBtn?.addEventListener('click', event => {
    event.stopPropagation();
    toggleNotifications();
  });

  dom.notificationsDropdown?.addEventListener('click', event => {
    event.stopPropagation();
  });

  dom.markAllReadBtn?.addEventListener('click', async event => {
    event.stopPropagation();
    await markNotificationsRead(null);
    toast('All notifications marked as read.');
  });

  document.addEventListener('click', event => {
    if (dom.notificationsDropdown && !dom.notificationsDropdown.hidden) {
      if (!event.target.closest('.notifications-wrapper')) {
        toggleNotifications(false);
      }
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && dom.notificationsDropdown && !dom.notificationsDropdown.hidden) {
      toggleNotifications(false);
      dom.notificationBtn?.focus();
    }
  });

  /** Picks up new approval requests and decisions made by other users. */
  let lastSeenNotificationId = null;
  async function pollUpdates() {
    if (!state.user || document.hidden) return;
    try {
      const res = await api('notifications');
      const newestId = res.notifications?.[0]?.id || null;
      const changed = newestId !== lastSeenNotificationId && lastSeenNotificationId !== null;
      lastSeenNotificationId = newestId;
      state.notifications = res.notifications || [];
      state.unreadCount = Number(res.unreadCount || 0);
      renderNotifications();
      if (changed) {
        await refreshState();
        const latest = state.notifications[0];
        if (latest && !latest.read) toast(latest.title);
      }
    } catch { }
  }
  window.addEventListener('focus', pollUpdates);
  setInterval(pollUpdates, 20000);

  // --- Category folders, reusable photo library and photo picker ---
  const libraryFolderIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path d="M3 7h18"/></svg>';
  function photoAttr(value) { return escapeHtml(value).replace(/"/g, '&quot;'); }
  function folderKey(value) { return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase(); }
  function folderValue(folder) { return folder === null ? 'all' : `folder:${folder}`; }
  function folderFromValue(value) { return value === 'all' ? null : String(value || '').replace(/^folder:/, ''); }
  function folderLabel(folder) { return folder === null ? 'All photos' : folder || 'Unfiled'; }
  function libraryFolderNames(extra = '') {
    const names = new Map();
    const categories = [
      ...(state.photoFolders || []),
      ...state.versions.flatMap(version => Array.isArray(version.categories) ? version.categories : []),
      ...state.rows.map(row => row[COL.category]),
      ...state.productImages.map(image => image.category),
      ...state.photoLibrary.map(photo => photo.category), extra,
    ];
    categories.forEach(value => {
      const name = String(value || '').trim().replace(/\s+/g, ' ');
      if (name && !names.has(folderKey(name))) names.set(folderKey(name), name);
    });
    return [...names.values()].sort((a, b) => a.localeCompare(b));
  }
  function folderOptions(folder, { includeAll = false, extra = '' } = {}) {
    const names = [...(includeAll ? [null] : []), '', ...libraryFolderNames(extra)];
    return names.map(name => {
      const selected = name === null ? folder === null : folder !== null && folderKey(name) === folderKey(folder);
      return `<option value="${photoAttr(folderValue(name))}"${selected ? ' selected' : ''}>${escapeHtml(folderLabel(name))}</option>`;
    }).join('');
  }
  function renderLibraryFolders() {
    const folders = $('#libraryFolders');
    if (!folders) return;
    folders.innerHTML = [null, ...libraryFolderNames(), ''].map(folder => {
      const count = filteredLibrary('', folder).length;
      const active = folder === null ? state.libraryFolder === null : state.libraryFolder !== null && folderKey(folder) === folderKey(state.libraryFolder);
      return `<button type="button" class="library-folder${active ? ' is-active' : ''}" data-library-folder="${photoAttr(folderValue(folder))}"${active ? ' aria-current="true"' : ''}>${libraryFolderIcon}<span>${escapeHtml(folderLabel(folder))}</span><small>${count}</small></button>`;
    }).join('');
    const destination = $('#libraryUploadFolder');
    const currentDestination = destination.value ? folderFromValue(destination.value) : '';
    destination.innerHTML = folderOptions(currentDestination);
    updateLibraryUploadLabel();
    placeFolderIndicator(folderMoveQueued);
    folderMoveQueued = false;
  }

  // --- Folder sidebar motion: it behaves like its own nav. A highlight slides to the folder you
  // pick, and that folder's title, search and photos glide in from the direction you moved. ---
  const folderIndicator = document.createElement('span');
  folderIndicator.className = 'library-folder-indicator';
  folderIndicator.setAttribute('aria-hidden', 'true');
  let folderIndicatorBox = null; // where the highlight sits now, to glide from on the next change
  let folderMoveQueued = false;  // set by a folder pick so the next render animates the highlight
  const FOLDER_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
  function placeFolderIndicator(glide = false) {
    const nav = $('#libraryFolders');
    if (!nav) return;
    const active = nav.querySelector('.library-folder.is-active');
    // Hidden (another page or tab): plain highlight on the button until it can be measured.
    if (!active || !active.offsetParent) {
      folderIndicator.remove();
      nav.classList.remove('has-indicator');
      folderIndicatorBox = null;
      return;
    }
    if (folderIndicator.parentElement !== nav) nav.prepend(folderIndicator);
    nav.classList.add('has-indicator');
    const box = { x: active.offsetLeft, y: active.offsetTop, w: active.offsetWidth, h: active.offsetHeight };
    const frame = b => ({ width: `${b.w}px`, height: `${b.h}px`, transform: `translate(${b.x}px, ${b.y}px)` });
    Object.assign(folderIndicator.style, frame(box));
    const from = folderIndicatorBox;
    folderIndicatorBox = box;
    if (glide && from && !reducedMotion()) {
      const anim = folderIndicator.animate([frame(from), frame(box)], { duration: 520, easing: FOLDER_EASE });
      setTimeout(() => { if (anim.playState === 'running') anim.finish(); }, 720); // lands even if frames pause
    }
  }
  window.addEventListener('resize', () => placeFolderIndicator(false));
  function folderPosition(folder) {
    return [...($('#libraryFolders')?.querySelectorAll('[data-library-folder]') || [])].findIndex(button => button.dataset.libraryFolder === folderValue(folder));
  }
  /** After picking a folder: its contents glide in, up from below or down from above. */
  function glideFolderContent(fromBelow) {
    if (reducedMotion()) return;
    const grid = $('#libraryGrid');
    const parts = [$('.library-content-heading > div'), $('#libraryCard .image-settings-toolbar'), grid?.hidden ? $('#libraryEmpty') : grid].filter(Boolean);
    const shift = fromBelow ? 20 : -20;
    parts.forEach((el, index) => {
      el.getAnimations().forEach(a => a.id === 'pla-folder' && a.cancel());
      const anim = el.animate(
        [{ opacity: 0, transform: `translate3d(0, ${shift}px, 0)` }, { opacity: 1, offset: 0.35 }, { opacity: 1, transform: 'translate3d(0, 0, 0)' }],
        { duration: 580, delay: index * 50, easing: FOLDER_EASE, fill: 'backwards' }
      );
      anim.id = 'pla-folder';
      setTimeout(() => { if (anim.playState === 'running') anim.finish(); }, 580 + index * 50 + 200);
    });
  }
  /** Shows another folder with the sidebar motion (used by folder clicks and new folders). */
  function openLibraryFolder(folder) {
    const fromIndex = folderPosition(state.libraryFolder);
    const changed = folder !== state.libraryFolder;
    state.libraryFolder = folder;
    state.librarySearch = '';
    $('#librarySearchInput').value = '';
    folderMoveQueued = changed;
    renderLibrary();
    if (changed) glideFolderContent(folderPosition(folder) >= fromIndex);
  }
  function updateLibraryUploadLabel() {
    const folder = folderFromValue($('#libraryUploadFolder')?.value);
    $('#libraryUploadButton').setAttribute('aria-label', `Upload photos to ${folderLabel(folder)}`);
  }
  function photoUsage(photoId) {
    return (state.productImages || []).filter(image => image.libraryId === photoId);
  }
  function photoCardMarkup(photo, { selected = false, current = false, deletable = false } = {}) {
    const usage = photoUsage(photo.id).length;
    return `<div class="library-card ${selected ? 'is-selected' : ''} ${current ? 'is-current' : ''}" data-photo-id="${photoAttr(photo.id)}" ${deletable ? 'role="group"' : `role="option" tabindex="0" aria-selected="${selected}"`} aria-label="${photoAttr(photo.name)}" title="${photoAttr(photo.name)}">
      <div class="library-thumb"><img src="${photoAttr(mediaUrl(photo.imagePath))}" alt="${photoAttr(photo.name)}" loading="lazy"></div>
      <div class="library-meta">
        <strong>${escapeHtml(photo.name)}</strong>
        <small>${current ? 'Current photo' : usage ? `Used by ${usage} product type${usage === 1 ? '' : 's'}` : 'Not used yet'}</small>
        ${deletable ? `<label class="library-photo-folder-control"><span>Folder</span><select class="library-photo-folder" data-photo-id="${photoAttr(photo.id)}" aria-label="Move ${photoAttr(photo.name)} to folder">${folderOptions(photo.category || '')}</select></label>` : `<small class="library-photo-category">${escapeHtml(folderLabel(photo.category || ''))}</small>`}
      </div>
      ${deletable ? `<button type="button" class="library-delete" data-photo-id="${photoAttr(photo.id)}" aria-label="Delete ${photoAttr(photo.name)}" title="Delete photo">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>` : ''}
      ${selected ? '<span class="library-check" aria-hidden="true">✓</span>' : ''}
    </div>`;
  }
  function filteredLibrary(query, folder = null) {
    const q = String(query || '').trim().toLowerCase();
    return (state.photoLibrary || []).filter(photo =>
      (folder === null || folderKey(photo.category) === folderKey(folder)) &&
      (!q || String(photo.name || '').toLowerCase().includes(q)));
  }
  function renderLibrary() {
    const grid = $('#libraryGrid');
    if (!grid) return;
    const all = state.photoLibrary || [];
    const visible = filteredLibrary(state.librarySearch, state.libraryFolder);
    renderLibraryFolders();
    $('#libraryFolderTitle').textContent = folderLabel(state.libraryFolder);
    $('#libraryFolderDescription').textContent = state.libraryFolder === null
      ? 'Browse every photo, or open a category folder on the left.'
      : state.libraryFolder === '' ? 'Photos without a category. Use the folder control on each photo to organize them.'
      : `Photos for ${state.libraryFolder}. Upload here or move existing photos into this folder.`;
    $('#libraryCountBadge').textContent = String(all.length);
    $('#libraryCount').textContent = `${visible.length} photo${visible.length === 1 ? '' : 's'}`;
    $('#libraryEmpty').hidden = visible.length > 0;
    if (!visible.length) $('#libraryEmpty').innerHTML = state.librarySearch.trim()
      ? '<h2>No matching photos</h2><p>Try another name or browse a different folder.</p>'
      : '<h2>No photos in this folder yet</h2><p>Choose an upload destination above, then select Upload photos.</p>';
    grid.hidden = !visible.length;
    grid.innerHTML = visible.map(photo => photoCardMarkup(photo, { deletable: true })).join('');
  }
  function switchConfigTab(tab) {
    state.configTab = tab;
    $$('.config-tab-btn').forEach(button => {
      const active = button.dataset.configTab === tab;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    $('#libraryCard').hidden = tab !== 'library';
    $('#typesCard').hidden = tab !== 'types';
    if (tab === 'library') renderLibrary(); else renderImageSettings();
  }
  $$('.config-tab-btn').forEach(button => button.addEventListener('click', () => switchConfigTab(button.dataset.configTab)));
  $('#librarySearchInput')?.addEventListener('input', event => { state.librarySearch = event.target.value; renderLibrary(); });
  $('#libraryFolders')?.addEventListener('click', event => {
    const button = event.target.closest('[data-library-folder]');
    if (!button) return;
    openLibraryFolder(folderFromValue(button.dataset.libraryFolder));
    if (state.libraryFolder !== null) {
      $('#libraryUploadFolder').value = folderValue(state.libraryFolder);
      updateLibraryUploadLabel();
    }
    [...$('#libraryFolders').querySelectorAll('button')].find(item => item.dataset.libraryFolder === button.dataset.libraryFolder)?.focus();
  });
  $('#libraryUploadFolder')?.addEventListener('change', updateLibraryUploadLabel);
  function toggleFolderForm(open) {
    $('#libraryFolderForm').hidden = !open;
    $('#libraryNewFolder').setAttribute('aria-expanded', String(open));
    $('#libraryFolderError').hidden = true;
    if (open) $('#libraryFolderName').focus(); else $('#libraryNewFolder').focus();
  }
  $('#libraryNewFolder')?.addEventListener('click', () => toggleFolderForm($('#libraryFolderForm').hidden));
  $('#libraryFolderCancel')?.addEventListener('click', () => toggleFolderForm(false));
  $('#libraryFolderForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('[type="submit"]');
    button.disabled = true;
    $('#libraryFolderError').hidden = true;
    try {
      const data = await api('library-folder', { method: 'POST', body: JSON.stringify({ category: $('#libraryFolderName').value.trim() }) });
      if (!state.photoFolders.some(folder => folderKey(folder) === folderKey(data.folder))) state.photoFolders.push(data.folder);
      $('#libraryFolderName').value = '';
      toggleFolderForm(false);
      openLibraryFolder(data.folder);
      $('#libraryUploadFolder').value = folderValue(data.folder);
      updateLibraryUploadLabel();
      toast(`Folder ${data.folder} is ready for photos.`);
    } catch (error) {
      $('#libraryFolderError').textContent = error.message;
      $('#libraryFolderError').hidden = false;
    } finally { button.disabled = false; }
  });
  $('#libraryGrid')?.addEventListener('change', async event => {
    const select = event.target.closest('.library-photo-folder');
    if (!select) return;
    select.disabled = true;
    try {
      const data = await api('library-move', { method: 'POST', body: JSON.stringify({ id: select.dataset.photoId, category: folderFromValue(select.value) }) });
      state.photoLibrary = state.photoLibrary.map(photo => photo.id === data.photo.id ? data.photo : photo);
      renderLibrary();
      toast(data.message);
    } catch (error) { renderLibrary(); toast(error.message); }
  });

  /** Uploads several files to the library; resolves with the newly added photos. */
  let libraryUploadContext = { target: 'library', category: '' };
  let libraryUploading = false;
  async function uploadLibraryFiles(fileList, { target = 'library', category = '' } = {}) {
    if (libraryUploading) { toast('Wait for the current upload to finish.'); return []; }
    const files = [...(fileList || [])].filter(file => /^image\/(jpeg|png|webp)$/.test(file.type));
    const skipped = (fileList?.length || 0) - files.length;
    if (!files.length) { toast('Choose JPG, PNG, or WebP images.'); return []; }
    libraryUploading = true;
    $('#libraryUploadButton').disabled = true;
    $('#photoPickerUpload').disabled = true;
    const status = target === 'picker' ? $('#photoPickerStatus') : $('#libraryUploadStatus');
    const added = [];
    const errors = [];
    // Send in batches so very large selections stay under the server's upload limits.
    for (let start = 0; start < files.length; start += 10) {
      const batch = files.slice(start, start + 10);
      if (status) status.textContent = `Uploading ${Math.min(start + batch.length, files.length)} of ${files.length}…`;
      const form = new FormData();
      form.append('category', category);
      batch.forEach(file => form.append('images[]', file));
      try {
        const data = await api('library-upload', { method: 'POST', headers: { 'X-CSRF-Token': state.csrf || '' }, body: form });
        added.push(...(data.photos || []));
        errors.push(...(data.errors || []));
      } catch (error) {
        errors.push(error.message);
      }
    }
    if (status) status.textContent = '';
    libraryUploading = false;
    $('#libraryUploadButton').disabled = false;
    $('#photoPickerUpload').disabled = false;
    state.photoLibrary = [...added, ...(state.photoLibrary || [])];
    renderLibrary();
    const problems = errors.length + skipped;
    toast(added.length ? `${added.length} photo${added.length === 1 ? '' : 's'} added to ${folderLabel(category)}${problems ? ` · ${problems} skipped` : ''}.` : (errors[0] || 'No photos were added.'));
    return added;
  }
  const libraryInput = $('#libraryFileInput');
  $('#libraryUploadButton')?.addEventListener('click', () => {
    if (libraryUploading) return;
    libraryUploadContext = { target: 'library', category: folderFromValue($('#libraryUploadFolder').value) };
    libraryInput.value = ''; libraryInput.click();
  });
  libraryInput?.addEventListener('change', async () => {
    const context = { ...libraryUploadContext };
    const added = await uploadLibraryFiles(libraryInput.files, context);
    libraryInput.value = '';
    if (context.target === 'picker') {
      if (added.length) { picker.selectedId = added[0].id; $('#photoPickerSearch').value = ''; }
      renderPicker();
    }
  });
  $('#libraryGrid')?.addEventListener('click', async event => {
    const deleteButton = event.target.closest('.library-delete');
    if (!deleteButton) return;
    const photo = (state.photoLibrary || []).find(item => item.id === deleteButton.dataset.photoId);
    if (!photo) return;
    const usage = photoUsage(photo.id);
    const ok = await confirmModal({
      kicker: 'Photo library',
      title: `Delete "${photo.name}"?`,
      text: usage.length
        ? `This photo is used by ${usage.length} product type${usage.length === 1 ? '' : 's'} (${usage.slice(0, 3).map(image => image.groupName).join(', ')}${usage.length > 3 ? '…' : ''}). They will show no photo until you choose another.`
        : 'This removes the photo from the library.',
      confirmLabel: 'Delete photo',
      cancelLabel: 'Keep it'
    });
    if (!ok) return;
    try {
      const data = await api('library-delete', { method: 'POST', body: JSON.stringify({ id: photo.id }) });
      state.photoLibrary = state.photoLibrary.filter(item => item.id !== photo.id);
      state.productImages = state.productImages.filter(image => image.libraryId !== photo.id);
      clearPdfImageCache();
      renderLibrary(); renderImageSettings();
      if (state.active) renderTable();
      toast(data.message);
    } catch (error) {
      toast(error.message);
    }
  });

  // Picker modal: used from the price table ("+ Add photo" / "Change") and from Config › Product type photos.
  const picker = { category: '', folder: '', groupName: '', selectedId: '', currentId: '', currentKey: '' };
  function renderPicker() {
    const grid = $('#photoPickerGrid');
    const visible = filteredLibrary($('#photoPickerSearch').value, picker.folder);
    $('#photoPickerFolder').innerHTML = folderOptions(picker.folder, { includeAll: true, extra: picker.category });
    $('#photoPickerFolderSummary').textContent = `${folderLabel(picker.folder)} · ${visible.length} photo${visible.length === 1 ? '' : 's'}`;
    $('#photoPickerUpload').textContent = `+ Upload to ${folderLabel(picker.folder === null ? picker.category : picker.folder)}`;
    if (picker.selectedId && !visible.some(photo => photo.id === picker.selectedId)) picker.selectedId = '';
    $('#photoPickerEmpty').hidden = visible.length > 0;
    $('#photoPickerEmpty').innerHTML = $('#photoPickerSearch').value.trim()
      ? '<h2>No matching photos</h2><p>Try another name or choose a different folder.</p>'
      : `<h2>No photos in ${escapeHtml(folderLabel(picker.folder))}</h2><p>Upload photos to this folder, or use the folder selector to browse another category.</p>`;
    grid.hidden = !visible.length;
    grid.innerHTML = visible.map(photo => photoCardMarkup(photo, { selected: photo.id === picker.selectedId, current: photo.id === picker.currentId })).join('');
    $('#photoPickerConfirm').disabled = !picker.selectedId || picker.selectedId === picker.currentId;
    $('#photoPickerRemove').hidden = !picker.currentKey;
  }
  function openPhotoPicker(category, groupName) {
    if (!can('manageImages')) return toast('You do not have permission to manage product photos.');
    const current = imageOverride(category, groupName);
    Object.assign(picker, { category, folder: category, groupName, currentId: current?.libraryId || '', currentKey: current?.key || '', selectedId: current?.libraryId || '' });
    $('#photoPickerTitle').textContent = `Choose a photo for ${groupName}`;
    $('#photoPickerSearch').value = '';
    renderPicker();
    $('#photoPickerDialog').showModal();
  }
  async function confirmPicker() {
    if (!picker.selectedId || picker.selectedId === picker.currentId) return;
    const button = $('#photoPickerConfirm');
    button.disabled = true;
    try {
      const data = await api('assign-group-image', { method: 'POST', body: JSON.stringify({ category: picker.category, groupName: picker.groupName, libraryId: picker.selectedId }) });
      const lookup = groupLookupKey(data.image.category, data.image.groupName);
      state.productImages = state.productImages.filter(image => groupLookupKey(image.category, image.groupName) !== lookup);
      state.productImages.push(data.image);
      clearPdfImageCache();
      $('#photoPickerDialog').close();
      renderImageSettings(); renderLibrary();
      if (state.active) renderTable();
      toast(`Photo set for ${picker.groupName}.`);
    } catch (error) {
      toast(error.message);
      button.disabled = false;
    }
  }
  $('#photoPickerGrid')?.addEventListener('click', event => {
    const card = event.target.closest('.library-card');
    if (!card) return;
    picker.selectedId = card.dataset.photoId;
    renderPicker();
  });
  $('#photoPickerGrid')?.addEventListener('dblclick', event => {
    const card = event.target.closest('.library-card');
    if (!card) return;
    picker.selectedId = card.dataset.photoId;
    confirmPicker();
  });
  $('#photoPickerGrid')?.addEventListener('keydown', event => {
    const card = event.target.closest('.library-card');
    if (card && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      picker.selectedId = card.dataset.photoId;
      if (event.key === 'Enter') confirmPicker(); else renderPicker();
    }
  });
  $('#photoPickerSearch')?.addEventListener('input', renderPicker);
  $('#photoPickerFolder')?.addEventListener('change', event => {
    picker.folder = folderFromValue(event.target.value);
    picker.selectedId = '';
    $('#photoPickerSearch').value = '';
    renderPicker();
  });
  $('#photoPickerConfirm')?.addEventListener('click', confirmPicker);
  $('#photoPickerCancel')?.addEventListener('click', () => $('#photoPickerDialog').close());
  $('#photoPickerClose')?.addEventListener('click', () => $('#photoPickerDialog').close());
  $('#photoPickerUpload')?.addEventListener('click', () => {
    if (libraryUploading) return;
    libraryUploadContext = { target: 'picker', category: picker.folder === null ? picker.category : picker.folder };
    libraryInput.value = ''; libraryInput.click();
  });
  $('#photoPickerRemove')?.addEventListener('click', async () => {
    if (!picker.currentKey) return;
    try {
      const data = await api('delete-group-image', { method: 'POST', body: JSON.stringify({ key: picker.currentKey }) });
      state.productImages = state.productImages.filter(image => image.key !== picker.currentKey);
      clearPdfImageCache();
      $('#photoPickerDialog').close();
      renderImageSettings(); renderLibrary();
      if (state.active) renderTable();
      toast(`Photo removed from ${picker.groupName}. It stays in the library.`);
    } catch (error) {
      toast(error.message);
    }
  });

  // --- Developer tools: floating panel for wiping test data (admins only, when enabled in config) ---
  const devTools = $('#devTools');
  const devPanel = $('#devToolsPanel');
  const devToggle = $('#devToolsToggle');
  function toggleDevTools(open) {
    if (!devPanel) return;
    devPanel.hidden = !open;
    devToggle.setAttribute('aria-expanded', String(open));
    if (open) {
      const versions = (state.versions || []).length;
      $('#devCountVersions').textContent = `${versions} saved version${versions === 1 ? '' : 's'}, pending and approved`;
      $('#devCountAudit').textContent = `${(state.auditLogs || []).length} recorded event${(state.auditLogs || []).length === 1 ? '' : 's'}`;
    }
  }
  devToggle?.addEventListener('click', event => { event.stopPropagation(); toggleDevTools(devPanel.hidden); });
  $('#devToolsClose')?.addEventListener('click', () => toggleDevTools(false));
  document.addEventListener('click', event => { if (devPanel && !devPanel.hidden && !event.target.closest('#devTools') && !event.target.closest('dialog')) toggleDevTools(false); });
  $('#devToolsClear')?.addEventListener('click', async () => {
    const selected = $$('.dev-tools-options input:checked').map(input => input.value);
    if (!selected.length) return toast('Choose what to clear.');
    const names = { draft: 'the uploaded file / draft in this browser', versions: 'all saved price lists', notifications: 'all notifications', audit: 'the audit logs', images: 'all product photos' };
    const ok = await confirmModal({
      kicker: 'Developer tools',
      title: 'Clear test data?',
      text: `This permanently deletes ${selected.map(key => names[key]).join(', ')}. This cannot be undone.`,
      confirmLabel: 'Clear data',
      cancelLabel: 'Cancel'
    });
    if (!ok) return;
    const button = $('#devToolsClear');
    button.disabled = true;
    try {
      const serverTargets = selected.filter(key => key !== 'draft');
      let message = '';
      if (selected.includes('draft')) {
        await removeDraft(draftKey());
        if (state.active?.isDraft) loadActive(null);
        rememberCategory('');
        message = 'Cleared the local draft.';
      }
      if (serverTargets.length) {
        const data = await api('dev-reset', { method: 'POST', body: JSON.stringify({ targets: serverTargets }) });
        if (serverTargets.includes('versions') && state.active && !state.active.isDraft) loadActive(null);
        if (serverTargets.includes('images')) { state.productImages = []; clearPdfImageCache(); }
        message = [message, data.message].filter(Boolean).join(' ');
      }
      await refreshState();
      renderImageSettings();
      if (state.active) renderTable();
      toggleDevTools(false);
      toast(message || 'Done.');
    } catch (error) {
      toast(error.message);
    } finally {
      button.disabled = false;
    }
  });

  if (state.user) loadState().catch(error => { setAppLoading(false); toast(error.message); });
})();
