(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { user: window.__BOOT__.user, csrf: window.__BOOT__.csrf, permissions: [], canEdit: false, active: null, rows: [], headers: [], priceColumns: [], adjustment: 0, categoryAdjustments: {}, search: '', category: '', codeFilter: '', priceLevelFilter: '', countryFilter: '', pending: null, pendingDelete: null, pendingDecision: null, versions: [], directory: [], approvers: [], approvalMode: 'any', notifications: [], unreadCount: 0, productImages: [], imageCategory: '', imageSearch: '', pendingImageGroup: null, pendingImageDelete: null, activeCell: { rowIdx: null, colIdx: null, td: null }, isEditing: false, auditLogs: [], auditTab: 'all', auditSearch: '', auditFile: '', auditType: '', auditUser: '', auditPage: 1, historyPage: 1, historyPageSize: 10, listTab: 'all', listSearch: '', listPriceLevel: '', listCountry: '', listStatus: '', photoLibrary: [], configTab: 'library', librarySearch: '' };
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
  const dom = {
    loginView: $('#loginView'), appView: $('#appView'), loginForm: $('#loginForm'), loginError: $('#loginError'), userName: $('#userName'), roleBadge: $('#roleBadge'), emptyState: $('#emptyState'), dataView: $('#dataView'), listTitle: $('#listTitle'), listMeta: $('#listMeta'), savedMeta: $('#savedMeta'), savedMetaRow: $('#savedMetaRow'), activeBadge: $('#activeBadge'), productCount: $('#productCount'), categoryCount: $('#categoryCount'), priceColumnCount: $('#priceColumnCount'), currentAdjustment: $('#currentAdjustment'), percentage: $('#percentage'), applyAllCategoriesButton: $('#applyAllCategoriesButton'), search: $('#searchInput'), category: $('#categorySelect'), table: $('#priceTable'), noResults: $('#noResults'), saveDialog: $('#saveDialog'), saveForm: $('#saveForm'), versionNameInput: $('#versionNameInput'), deleteDialog: $('#deleteDialog'), deleteVersionName: $('#deleteVersionName'), resetPricesDialog: $('#resetPricesDialog'), resetPricesForm: $('#resetPricesForm'), confirmResetPrices: $('#confirmResetPrices'), resetPricesButton: $('#resetPricesButton'), logoutDialog: $('#logoutDialog'), logoutForm: $('#logoutForm'), historyTable: $('#historyTable'), historyTableBody: $('#historyTableBody'), historyEmpty: $('#historyEmpty'), historyCount: $('#historyCount'), historySearchInput: $('#historySearchInput'), historyAdjustmentSelect: $('#historyAdjustmentSelect'), backToPricesBtn: $('#backToPricesBtn'), emptyGoToPricesBtn: $('#emptyGoToPricesBtn'), toast: $('#toast'), fileInput: $('#fileInput'), settingsNav: $('#settingsNav'), settingsPanel: $('#settingsPanel'), settingsBackButton: $('#settingsBackButton'), imageCategoryFilter: $('#imageCategoryFilter'), imageSearchInput: $('#imageSearchInput'), imageSettingsList: $('#imageSettingsList'), imageSettingsEmpty: $('#imageSettingsEmpty'), imageSettingsCount: $('#imageSettingsCount'), groupImageInput: $('#groupImageInput'), deleteImageDialog: $('#deleteImageDialog'), deleteImageForm: $('#deleteImageForm'), deleteImageName: $('#deleteImageName'), addRowBtn: $('#addRowBtn'), excelFormulaBar: $('#excelFormulaBar'), formulaCellIndicator: $('#formulaCellIndicator'), formulaInput: $('#formulaInput'), formulaCancelBtn: $('#formulaCancelBtn'), formulaConfirmBtn: $('#formulaConfirmBtn'), deleteRowDialog: $('#deleteRowDialog'), deleteRowForm: $('#deleteRowForm'), deleteRowProductName: $('#deleteRowProductName'), confirmDeleteRow: $('#confirmDeleteRow'),
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
    categoryCheckboxesList: $('#categoryCheckboxesList'), categoryAdjustSearch: $('#categoryAdjustSearch'), selectAllCategoriesBtn: $('#selectAllCategoriesBtn'), deselectAllCategoriesBtn: $('#deselectAllCategoriesBtn'), selectedCategoryCountBadge: $('#selectedCategoryCountBadge'), applyButtonText: $('#applyButtonText'), adjPreviewSummary: $('#adjPreviewSummary'), closeAdjustmentBarBtn: $('#closeAdjustmentBarBtn')
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

    if (dom.selectedCategoryCountBadge) {
      dom.selectedCategoryCountBadge.textContent = `${selectedCount} of ${totalCategories} selected`;
      dom.selectedCategoryCountBadge.classList.toggle('has-selection', selectedCount > 0);
    }

    $$('.adj-preset-chip').forEach(chip => {
      const presetVal = Number(chip.dataset.preset);
      chip.classList.toggle('active', isValidPct && pct === presetVal);
    });

    const btn = $('#previewButton');
    const btnText = $('#applyButtonText');
    const summary = $('#adjPreviewSummary');

    if (selectedCount === 0) {
      if (btnText) btnText.textContent = 'Select categories to apply';
      if (btn) {
        btn.disabled = true;
        btn.classList.add('is-disabled');
      }
      if (summary) summary.textContent = 'Please check at least one category above.';
    } else {
      if (btn) {
        btn.disabled = !isValidPct;
        btn.classList.toggle('is-disabled', !isValidPct);
      }
      const pctDisplay = isValidPct ? `${sign}${pct}%` : '%';
      if (selectedCount === totalCategories) {
        if (btnText) btnText.textContent = `Apply ${pctDisplay} to all categories`;
        if (summary) summary.textContent = `Will update all ${totalCategories} categories (${affectedProducts.toLocaleString()} products) by ${pctDisplay}.`;
      } else if (selectedCount === 1) {
        const singleCat = [...selectedAdjustmentCategories][0];
        if (btnText) btnText.textContent = `Apply ${pctDisplay} to ${singleCat}`;
        if (summary) summary.textContent = `Will update ${singleCat} (${affectedProducts.toLocaleString()} products) by ${pctDisplay}.`;
      } else {
        if (btnText) btnText.textContent = `Apply ${pctDisplay} to ${selectedCount} categories`;
        if (summary) summary.textContent = `Will update ${selectedCount} categories (${affectedProducts.toLocaleString()} products) by ${pctDisplay}.`;
      }
    }
  }

  function renderCategoryAdjustmentList(filterQuery = '') {
    if (!dom.categoryCheckboxesList) return;
    const categories = getPriceCategories();
    const query = String(filterQuery || '').trim().toLowerCase();
    const filtered = query ? categories.filter(c => c.name.toLowerCase().includes(query)) : categories;

    if (!categories.length) {
      dom.categoryCheckboxesList.innerHTML = '<div class="category-checkboxes-empty">No categories available in this workbook.</div>';
      updateAdjustmentUI();
      return;
    }

    if (!filtered.length) {
      dom.categoryCheckboxesList.innerHTML = `<div class="category-checkboxes-empty">No categories match "${escapeHtml(filterQuery)}"</div>`;
      return;
    }

    dom.categoryCheckboxesList.innerHTML = filtered.map(cat => {
      const isChecked = selectedAdjustmentCategories.has(cat.name);
      const num = Number(cat.adjustment || 0);
      const sign = num > 0 ? '+' : '';
      const adjCls = num > 0 ? 'pos' : num < 0 ? 'neg' : 'zero';
      return `
        <label class="category-checkbox-item ${isChecked ? 'checked' : ''}" data-category="${escapeHtml(cat.name)}">
          <input type="checkbox" class="category-adjust-checkbox" value="${escapeHtml(cat.name)}" ${isChecked ? 'checked' : ''}>
          <span class="cat-custom-checkbox" aria-hidden="true">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </span>
          <div class="cat-checkbox-content">
            <span class="cat-name" title="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</span>
            <div class="cat-meta-pills">
              <span class="cat-count-pill">${cat.count} ${cat.count === 1 ? 'item' : 'items'}</span>
              <span class="cat-adj-pill ${adjCls}" title="Current adjustment: ${sign}${num}%">${sign}${num}%</span>
            </div>
          </div>
        </label>
      `;
    }).join('');

    updateAdjustmentUI();
  }

  async function api(action, options = {}) {
    const response = await fetch(`api.php?action=${encodeURIComponent(action)}`, { headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': state.csrf || '' }, ...options });
    const data = await response.json().catch(() => ({ ok: false, message: 'Invalid server response.' }));
    if (!response.ok || !data.ok) throw new Error(data.message || 'Request failed.');
    return data;
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
    if (cluster) cluster.hidden = !can('update') || !state.active;
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
    toast(`Closed ${name}.`);
  }
  function userName(username) {
    return state.directory.find(entry => entry.username === username)?.name || username || '';
  }
  function statusLabel(status) {
    return { pending: 'Pending approval', approved: 'Approved', rejected: 'Rejected', superseded: 'Superseded', draft: 'Draft (unsaved)' }[status] || 'Draft (unsaved)';
  }
  function activeStatus() {
    if (!state.active) return null;
    if (state.active.isDraft || !state.active.id) return 'draft';
    return state.active.status || 'pending';
  }
  function canExportActive() {
    return can('export') && activeStatus() === 'approved';
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
    return [...new Set(values.map(value => String(value ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }
  function fillSelect(select, values, allLabel, current) {
    if (!select) return '';
    select.innerHTML = `<option value="">${escapeHtml(allLabel)}</option>` + values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
    const next = values.includes(current) ? current : '';
    select.value = next;
    return next;
  }
  function fillDatalists() {
    const levels = uniqueValues([...(state.versions || []).map(v => v.priceLevel), state.active?.priceLevel, 'FOB Subic', 'FOB Manila', 'Ex-Works', 'CIF', 'CFR']);
    const countries = uniqueValues([...(state.versions || []).map(v => v.country), state.active?.country, 'All Countries']);
    if (dom.priceLevelOptions) dom.priceLevelOptions.innerHTML = levels.map(value => `<option value="${escapeHtml(value)}"></option>`).join('');
    if (dom.countryOptions) dom.countryOptions.innerHTML = countries.map(value => `<option value="${escapeHtml(value)}"></option>`).join('');
  }
  function guessPriceLevel(fileName) {
    const match = String(fileName || '').match(/\b(FOB|FCA|EXW|Ex-?Works|CIF|CFR|CPT|CIP|DAP|DDP)\b[\s-]*([A-Za-z]+)?/i);
    if (!match) return '';
    const term = match[1].toUpperCase().replace('EX-WORKS', 'Ex-Works').replace('EXWORKS', 'Ex-Works');
    const place = match[2] && !/^(port|price|list|pl)$/i.test(match[2]) ? ` ${match[2][0].toUpperCase()}${match[2].slice(1).toLowerCase()}` : '';
    return `${term}${place}`;
  }
  function setAppLoading(loading) { document.body.classList.toggle('is-booting', loading); document.body.classList.toggle('is-ready', !loading); }
  function showApp() {
    dom.loginView.hidden = true; dom.appView.hidden = false;
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
      renderCategoryAdjustmentList('');
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
      approvers: data.approvers || [], approvalMode: data.approvalMode || 'any', autoApprove: Boolean(data.autoApprove),
      versions: data.versions || [], productImages: data.productImages || [], auditLogs: data.auditLogs || [], photoLibrary: data.photoLibrary || [],
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
  /** Reloads versions, notifications and audit logs; keeps the open price list unless it changed on the server. */
  async function refreshState() {
    const data = await api('state');
    applyStatePayload(data);
    applyPermissions();
    const open = state.active?.id && !state.active.isDraft ? versionSummaryById(state.active.id) : null;
    if (state.active?.id && !state.active.isDraft && (!open || open.status !== state.active.status || (open.approvals || []).length !== (state.active.approvals || []).length)) {
      if (open) await openVersion(open.id, { silent: true, stay: true });
      else loadActive(null);
    } else {
      renderWorkflowState();
    }
    fillDatalists(); renderLists(); renderHistory(); renderNotifications();
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
      const remembered = rememberedId ? versionSummaryById(rememberedId) : null;
      if (remembered) {
        try { targetActive = (await api('open', { method: 'POST', body: JSON.stringify({ id: remembered.id }) })).active; } catch { targetActive = null; }
      }
    }
    showApp(); fillDatalists(); loadActive(targetActive); renderLists(); renderHistory(); renderImageSettings(); renderNotifications();
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
      dom.listMeta.textContent = canUpload ? 'Upload an .xlsx or .xls file to open and edit prices.' : 'Choose an approved price list to view and export.';
      if (dom.emptyStateTitle) dom.emptyStateTitle.textContent = canUpload ? 'Import your current price list' : 'No price list open';
      if (dom.emptyStateText) dom.emptyStateText.textContent = canUpload ? 'Drag and drop your Excel spreadsheet (.xlsx, .xls) here or browse your computer.' : 'Approved price lists are listed under Approvals, where you can open or export them.';
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
    const badgeClass = { draft: 'draft-badge', pending: 'pending-badge', approved: '', rejected: 'rejected-badge', superseded: 'superseded-badge' }[status] ?? '';
    const dotClass = status === 'approved' ? '' : 'warning';
    dom.activeBadge.className = `status-badge ${badgeClass}`.trim();
    dom.activeBadge.innerHTML = `<span class="pulse-dot ${dotClass}" aria-hidden="true"><span class="pulse-ring"></span></span>${escapeHtml(statusLabel(status))}`;

    if (status === 'draft') {
      const edits = (active.pendingChanges || []).length;
      setSavedMeta(active.id ? `Unsaved edits to the version saved by ${active.savedBy || 'a user'}${edits ? ` · ${edits} cell edit${edits === 1 ? '' : 's'}` : ''}` : 'Imported workbook · Unsaved');
    } else {
      setSavedMeta(active.savedAt ? `Saved ${displayDate(active.savedAt)} by ${active.savedBy}` : 'Saved');
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
      dom.approvalBannerIcon.textContent = { pending: '⏳', approved: '✓', rejected: '✕', superseded: '↻' }[status] || '';
      dom.approvalBannerText.textContent = text;
      dom.bannerApproveBtn.hidden = !canDecide;
      dom.bannerRejectBtn.hidden = !canDecide;
    }

    const exportable = canExportActive();
    ['#excelButton', '#pdfButton'].forEach(selector => {
      const button = $(selector);
      if (!button) return;
      button.hidden = !can('export');
      button.disabled = !exportable;
      button.title = exportable ? '' : 'Only approved price lists can be exported.';
    });
    if (dom.exportLockNote) {
      dom.exportLockNote.hidden = exportable || !can('export');
      dom.exportLockNote.textContent = status === 'draft' ? 'Save and get approval to export' : status === 'pending' ? 'Export unlocks after approval' : status === 'rejected' ? 'Rejected lists cannot be exported' : status === 'superseded' ? 'Superseded by a newer approved list' : '';
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
        <img class="group-photo-img" src="${escapeHtml(custom.imagePath)}" alt="${escapeHtml(label)}" loading="lazy">
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
          <span class="group-add-photo-label">+ Add photo</span>
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
        ? `<img class="image-setting-preview" src="${escapeHtml(custom.imagePath)}" alt="${escapeHtml(group.groupName)} preview">`
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
      </tr>`;
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
      </tr>`;
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
    const showCategoryDividers = !state.category && new Set(groups.map(group => group.category)).size > 1;
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

  function updateFormulaBar(force = false) {
    const ind = dom.formulaCellIndicator;
    const input = dom.formulaInput;
    if (!ind || !input) return;
    if (!state.activeCell.td) {
      ind.textContent = '–';
      input.value = '';
      input.disabled = true;
      return;
    }
    input.disabled = !state.canEdit;
    const rowIdx = state.activeCell.rowIdx;
    const colIdx = state.activeCell.colIdx;
    const letter = getColumnLetter(colIdx);
    const colName = state.headers[colIdx] || '';
    ind.textContent = `${letter}${rowIdx + 1}`;
    ind.title = `${colName ? colName + ' · ' : ''}Cell ${letter}${rowIdx + 1}`;

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
      return `<span class="diff-chip neutral">${escapeHtml(parts.join(' · ') || 'No price changes')}</span>`;
    }
    if (log.type === 'row_add') {
      return `<span class="diff-chip new">+ Added product</span>`;
    }
    if (log.type === 'row_delete') {
      return `<span class="diff-chip old">- Removed product</span>`;
    }
    if (log.type === 'reset_prices') {
      return `<span class="diff-chip neutral">Reset to 0%</span>`;
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
              <span class="history-adj-pill neutral">0% Baseline Prices</span>
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
  function navigableVersions() {
    return (state.versions || []).filter(version => version.status !== 'superseded' && version.country);
  }
  function renderNavigator() {
    const lists = navigableVersions();
    const active = state.active;
    const isDraft = Boolean(active && (active.isDraft || !active.id));
    const option = (value, label) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
    const countries = uniqueValues([...lists.map(version => version.country), active?.country]);
    $$('.nav-cascade').forEach(box => {
      const countrySelect = box.querySelector('.nav-country');
      const levelSelect = box.querySelector('.nav-level');
      const listSelect = box.querySelector('.nav-list');
      const country = box.dataset.cascade === 'empty' ? '' : (active?.country || '');
      const level = country ? (active?.priceLevel || '') : '';
      countrySelect.innerHTML = (country ? '' : option('', 'Choose country…')) + countries.map(value => option(value, value)).join('');
      countrySelect.value = country;
      const levels = uniqueValues([...lists.filter(version => version.country === country).map(version => version.priceLevel), level]);
      levelSelect.innerHTML = levels.length ? levels.map(value => option(value, value)).join('') : option('', '—');
      levelSelect.value = level;
      levelSelect.disabled = !country;
      const files = lists.filter(version => version.country === country && version.priceLevel === level);
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
      const forCountry = lists.filter(version => version.country === select.value);
      const target = forCountry.find(version => version.priceLevel === state.active?.priceLevel) || forCountry[0];
      openFromNavigator(target?.id);
    } else if (select.classList.contains('nav-level')) {
      const country = box.querySelector('.nav-country').value;
      openFromNavigator(lists.find(version => version.country === country && version.priceLevel === select.value)?.id);
    } else if (select.classList.contains('nav-list')) {
      openFromNavigator(select.value);
    }
  });

  // --- Approvals panel ---
  function statusPill(status) {
    return `<span class="list-status-pill status-${escapeHtml(status || 'pending')}">${escapeHtml(statusLabel(status))}</span>`;
  }
  function adjustmentPill(version) {
    const adjusted = version.summary?.adjustedCategories || [];
    if (!adjusted.length) return '<span class="history-adj-pill neutral">No adjustment</span>';
    const rates = [...new Set(adjusted.map(item => Number(item.adjustment || 0)))];
    const text = rates.length === 1 ? `${rates[0] > 0 ? '+' : ''}${rates[0]}% · ${adjusted.length} categor${adjusted.length === 1 ? 'y' : 'ies'}` : `Varies · ${adjusted.length} categories`;
    return `<span class="history-adj-pill has-adj ${rates.every(rate => rate < 0) ? 'neg' : ''}">${escapeHtml(text)}</span>`;
  }
  function renderLists() {
    if (!dom.listsTableBody) return;
    const versions = state.versions || [];
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
        ? 'Saved price lists need approval from their assigned approvers before anyone can export them.'
        : 'Approved price lists you can view and export.';
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
      dom.listsEmptyTitle.textContent = state.listTab === 'mine' ? 'Nothing waiting for your approval' : versions.length ? 'No matching price lists' : (can('update') ? 'No saved price lists yet' : 'No approved price lists yet');
      dom.listsEmptyText.textContent = state.listTab === 'mine' ? 'New approval requests will appear here and in your notifications.' : versions.length ? 'Try different filters.' : (can('update') ? 'Upload a workbook, adjust prices, then save it to send it for approval.' : 'Approved price lists will appear here once an approver signs off.');
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
        : `<button type="button" class="row-primary" data-action="open" data-id="${vid}">${isOpen ? 'View' : 'Open'}</button>`;
      const actions = `${primary}<button type="button" class="kebab-btn" data-id="${vid}" aria-haspopup="menu" aria-expanded="false" aria-label="More actions for ${escapeHtml(version.name)}" title="More actions"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="12" cy="19" r="1.9"/></svg></button>`;
      return `
        <tr class="history-data-row ${isOpen ? 'is-open-row' : ''}">
          <td class="history-name-cell">
            <strong class="list-name">${escapeHtml(version.name)}</strong>
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

  let stagedUploadFile = null;

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function stageFileForUpload(file) {
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      return toast('Please select a valid Excel workbook (.xlsx or .xls).');
    }
    stagedUploadFile = file;
    if (dom.uploadPriceLevel && !dom.uploadPriceLevel.value.trim()) dom.uploadPriceLevel.value = guessPriceLevel(file.name);
    if (dom.selectedFileName) dom.selectedFileName.textContent = file.name;
    if (dom.selectedFileSize) dom.selectedFileSize.textContent = formatBytes(file.size);
    if (dom.selectedFileInfo) dom.selectedFileInfo.hidden = false;
    if (dom.dropZonePrompt) dom.dropZonePrompt.hidden = true;
    if (dom.submitUploadBtn) dom.submitUploadBtn.disabled = false;
  }

  function clearStagedFile() {
    stagedUploadFile = null;
    if (dom.modalFileInput) dom.modalFileInput.value = '';
    if (dom.selectedFileInfo) dom.selectedFileInfo.hidden = true;
    if (dom.dropZonePrompt) dom.dropZonePrompt.hidden = false;
    if (dom.submitUploadBtn) dom.submitUploadBtn.disabled = true;
  }

  async function openUploadModal() {
    if (!can('upload')) return toast('Your role cannot upload price lists.');
    if (state.active?.isDraft && !(await confirmDiscardDraft('Uploading a new file'))) return false;
    clearStagedFile();
    fillDatalists();
    if (dom.uploadPriceLevel) dom.uploadPriceLevel.value = '';
    if (dom.uploadCountry) dom.uploadCountry.value = '';
    if (!dom.uploadModal?.open) dom.uploadModal?.showModal();
    return true;
  }

  function closeUploadModal() {
    clearStagedFile();
    dom.uploadModal?.close();
  }

  function downloadExcelTemplate() {
    if (!window.XLSX) return toast('Excel tools are not available.');
    const wb = XLSX.utils.book_new();

    const standardHeaderRow1 = ['Code No', 'Description', 'Expiry Date', 'Weight gr/pc', 'Pcs /box', 'Box Size', 'Price/pc USD', 'Price/box In USD', 'PALLET PER CONTAINER', '', '', 'NW(KG) / Box', 'GW(KG) / Box', 'MOQ', 'Total Price Based on MOQ', 'Product Group'];
    const standardHeaderRow2 = ['', '', '', '', '', '', '', '', '40ft Container', '', '20ft Container', '', '', '', '', ''];
    const standardHeaderRow3 = ['', '', '', '', '', '', '', '', 'Large Pallet (16 pallets)', 'Small Pallet (2 pallets)', 'Large Pallet (8 pallets)', '', '', '', '', ''];
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
      { s: { r: 1, c: 10 }, e: { r: 1, c: 10 } },
      { s: { r: 0, c: 11 }, e: { r: 2, c: 11 } },
      { s: { r: 0, c: 12 }, e: { r: 2, c: 12 } },
      { s: { r: 0, c: 13 }, e: { r: 2, c: 13 } },
      { s: { r: 0, c: 14 }, e: { r: 2, c: 14 } },
      { s: { r: 0, c: 15 }, e: { r: 2, c: 15 } }
    ];

    const sheets = [
      {
        name: 'Tart Shells',
        rows: [
          ['LRN-TRT-001', 'Sweet Round Tart Shell 50mm', '18 Months', '15', '120', 'Medium Box', 0.38, 45.60, '168 Boxes/Pallet', '126 Boxes/Pallet', '144 Boxes/Pallet', '1.8', '2.4', '60 Boxes', 2736.00, 'Round Tart Shells'],
          ['LRN-TRT-002', 'Chocolate Square Tart Shell 45mm', '18 Months', '14', '96', 'Medium Box', 0.42, 40.32, '168 Boxes/Pallet', '126 Boxes/Pallet', '144 Boxes/Pallet', '1.5', '2.1', '60 Boxes', 2419.20, 'Square Tart Shells'],
          ['LRN-TRT-003', 'Vanilla Tartlet 80mm', '18 Months', '25', '72', 'Large Box', 0.58, 41.76, '120 Boxes/Pallet', '90 Boxes/Pallet', '100 Boxes/Pallet', '2.0', '2.7', '45 Boxes', 1879.20, 'Large Tartlets']
        ]
      },
      {
        name: 'Pastries',
        rows: [
          ['LRN-PST-001', 'Mini Butter Croissant 30g', '12 Months', '30', '120', 'Medium Box', 0.48, 57.60, '120 Boxes/Pallet', '90 Boxes/Pallet', '100 Boxes/Pallet', '3.6', '4.2', '50 Boxes', 2880.00, 'Croissants'],
          ['LRN-PST-002', 'Pain Au Chocolat 35g', '12 Months', '35', '96', 'Medium Box', 0.54, 51.84, '120 Boxes/Pallet', '90 Boxes/Pallet', '100 Boxes/Pallet', '3.4', '4.0', '50 Boxes', 2592.00, 'Croissants'],
          ['LRN-PST-003', 'Apple Cinnamon Danish', '12 Months', '40', '80', 'Large Box', 0.62, 49.60, '100 Boxes/Pallet', '75 Boxes/Pallet', '80 Boxes/Pallet', '3.2', '3.9', '40 Boxes', 1984.00, 'Danishes']
        ]
      },
      {
        name: 'Cones & Baskets',
        rows: [
          ['LRN-CON-001', 'Sweet Mini Waffle Cone 75mm', '12 Months', '10', '180', 'Medium Box', 0.32, 57.60, '140 Boxes/Pallet', '105 Boxes/Pallet', '120 Boxes/Pallet', '1.8', '2.5', '50 Boxes', 2880.00, 'Sweet Cones'],
          ['LRN-CON-002', 'Savory Sesame Cone 75mm', '12 Months', '10', '180', 'Medium Box', 0.34, 61.20, '140 Boxes/Pallet', '105 Boxes/Pallet', '120 Boxes/Pallet', '1.8', '2.5', '50 Boxes', 3060.00, 'Savory Cones']
        ]
      },
      {
        name: 'Chocolates',
        rows: [
          ['LRN-CHO-001', 'Dark Chocolate Truffle 70%', '9 Months', '12', '144', 'Small Box', 0.65, 93.60, '180 Boxes/Pallet', '135 Boxes/Pallet', '150 Boxes/Pallet', '1.7', '2.2', '30 Boxes', 2808.00, 'Truffles'],
          ['LRN-CHO-002', 'Praline Hazelnut Bonbon', '9 Months', '11', '144', 'Small Box', 0.68, 97.92, '180 Boxes/Pallet', '135 Boxes/Pallet', '150 Boxes/Pallet', '1.6', '2.1', '30 Boxes', 2937.60, 'Bonbons']
        ]
      },
      {
        name: 'Presentation Stands',
        isPresentation: true,
        headers: ['LRN code', 'Item Name', 'PC/Set Per Box', 'Price/pc in USD', 'Price/Box USD', 'NW(KG) / Box', 'GW(KG) / Box', 'Box size', 'MOQ', 'Total Price Based on MOQ', 'Product Group'],
        rows: [
          ['LRN-STD-001', 'Acrylic 3-Tier Tart Stand', '4', 18.50, 74.00, '3.4', '4.2', 'Display Box', '10 Sets', 740.00, 'Acrylic Displays']
        ]
      }
    ];

    sheets.forEach(sheet => {
      let wsData;
      let ws;
      if (sheet.isPresentation) {
        wsData = [sheet.headers, ...sheet.rows];
        ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!freeze'] = { xSplit: 0, ySplit: 1 };
      } else {
        wsData = [standardHeaderRow1, standardHeaderRow2, standardHeaderRow3, ...sheet.rows];
        ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!merges'] = standardMerges;
        ws['!freeze'] = { xSplit: 0, ySplit: 3 };
      }
      XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    });

    XLSX.writeFile(wb, 'LRN_Price_List_Template.xlsx');
    toast('Downloaded official Excel template: LRN_Price_List_Template.xlsx');
  }

  async function parseWorkbook(file, meta = {}) {
    if (!can('upload')) throw new Error('Your role cannot upload price lists.');
    const listPriceLevel = String(meta.priceLevel || '').trim();
    const listCountry = String(meta.country || '').trim();
    if (!listPriceLevel || !listCountry) throw new Error('Enter the price level and country for this price list.');
    if (!file || !/\.(xlsx|xls)$/i.test(file.name)) {
      throw new Error('Please select a valid Excel file (.xlsx or .xls).');
    }
    if (!window.XLSX) throw new Error('Excel tools did not load. Check the internet connection and refresh.');
    let workbook;
    try {
      workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    } catch {
      throw new Error('Unable to read this file as an Excel workbook.');
    }
    const headers = ['Category', 'Code No', 'Description', '', 'Expiry Date', 'Weight   gr/pc', 'Pcs\n/box', 'Box Size', 'Price/pc    USD', 'Price/box in USD', 'Large Pallet\n(16 pallets)', 'Small Pallet\n(2 pallets)', 'Large Pallet\n(8 pallets)', 'NW(KG) / Box', 'GW(KG) / Box', 'MOQ', '', 'Total Price Based on MOQ', 'Product Group', 'Price Level', 'Country'];
    const products = [];
    const usedSheets = new Set();
    for (const sheetName of workbook.SheetNames) {
      const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: true });
      if (!matrix || !matrix.length) continue;
      let map = null;
      let currentSection = sheetName;
      for (let rIdx = 0; rIdx < matrix.length; rIdx++) {
        const row = matrix[rIdx];
        const labels = row.map(value => String(value ?? '').replace(/[\r\n]+/g, ' ').trim());
        const nonEmptyLabels = labels.filter(Boolean);
        if (nonEmptyLabels.length === 1 && nonEmptyLabels[0].length > 2 && !/price list|don't miss|la rose noire|homepage|facebook|instagram|twitter|tel:/i.test(nonEmptyLabels[0])) {
          currentSection = nonEmptyLabels[0];
        }
        const codeIndex = labels.findIndex(value => /(^|\s)(code no|lrn code|code)(\s|$)/i.test(value));
        const hasPrice = labels.some(value => /price\s*\/\s*(pc|box)|total price/i.test(value));
        if (codeIndex >= 0 && hasPrice) {
          const findInRow = (r, pattern) => (r || []).findIndex(value => pattern.test(String(value ?? '').replace(/[\r\n]+/g, ' ').trim()));
          const find = pattern => findInRow(row, pattern);

          // Find pallet columns across current row and neighboring rows (up to 3 rows above or below)
          let p40L = find(/16\s*pallet|large.*16|40ft.*large/i);
          let p40S = find(/2\s*pallet|small.*2|40ft.*small/i);
          let p20L = find(/8\s*pallet|large.*8|20ft.*large/i);

          for (let offset = -3; offset <= 3; offset++) {
            if (offset === 0) continue;
            const neighborRow = matrix[rIdx + offset];
            if (!neighborRow || !Array.isArray(neighborRow)) continue;
            if (p40L < 0) p40L = findInRow(neighborRow, /16\s*pallet|large.*16|40ft.*large/i);
            if (p40S < 0) p40S = findInRow(neighborRow, /2\s*pallet|small.*2|40ft.*small/i);
            if (p20L < 0) p20L = findInRow(neighborRow, /8\s*pallet|large.*8|20ft.*large/i);
          }

          if (p40L < 0) {
            let palletContainerIdx = find(/pallet\s*per\s*container|pallet.*container|container.*pallet/i);
            if (palletContainerIdx < 0) {
              for (let offset = -3; offset <= 3; offset++) {
                const neighborRow = matrix[rIdx + offset];
                if (!neighborRow || !Array.isArray(neighborRow)) continue;
                const testIdx = findInRow(neighborRow, /pallet\s*per\s*container|pallet.*container|container.*pallet/i);
                if (testIdx >= 0) { palletContainerIdx = testIdx; break; }
              }
            }
            if (palletContainerIdx >= 0) {
              p40L = palletContainerIdx;
              if (p40S < 0) p40S = palletContainerIdx + 1;
              if (p20L < 0) p20L = palletContainerIdx + 2;
            }
          }

          const boxPriceIdx = find(/price\s*\/\s*box/i);
          if (p40L < 0 && boxPriceIdx >= 0 && !/presentation stands/i.test(sheetName)) {
            p40L = boxPriceIdx + 1;
            p40S = boxPriceIdx + 2;
            p20L = boxPriceIdx + 3;
          } else {
            if (p40S < 0 && p40L >= 0) p40S = p40L + 1;
            if (p20L < 0 && p40L >= 0) p20L = p40L + 2;
          }

          const catColIdx = labels.findIndex(value => /^(worksheet|category|section)$/i.test(value));

          map = {
            code: codeIndex,
            categoryCol: catColIdx,
            description: find(/description|item name/i),
            details: /presentation stands/i.test(sheetName) ? find(/item name/i) + 1 : -1,
            expiry: find(/expiry/i),
            weight: find(/weight/i),
            pieces: find(/pcs\s*\/\s*box|pc\s*\/\s*set/i),
            boxSize: find(/^box size$/i),
            unitPrice: find(/price\s*\/\s*pc/i),
            boxPrice: boxPriceIdx,
            pallet40Large: p40L,
            pallet40Small: p40S,
            pallet20Large: p20L,
            netWeight: find(/^nw/i),
            grossWeight: find(/^gw/i),
            moq: find(/^moq$/i),
            moqQuantity: find(/^moq$/i) >= 0 ? find(/^moq$/i) + 1 : -1,
            totalPrice: find(/total price/i),
            productGroup: find(/product group/i),
            priceLevel: find(/^price\s*level$/i),
            country: find(/^(country|market|destination)$/i)
          };
          continue;
        }

        if (!map) continue;
        const code = String(row[map.code] ?? '').trim();
        if (!code || /^(code no|lrn code|code|description|item name|total)$/i.test(code)) continue;

        const unitPrice = map.unitPrice >= 0 ? row[map.unitPrice] : '';
        const boxPrice = map.boxPrice >= 0 ? row[map.boxPrice] : '';
        const totalPrice = map.totalPrice >= 0 ? row[map.totalPrice] : '';
        if (![unitPrice, boxPrice, totalPrice].some(isNumeric)) continue;

        const take = index => (index !== null && index !== undefined && index >= 0) ? (row[index] ?? '') : '';
        const groupFromRow = map.productGroup >= 0 ? String(row[map.productGroup] ?? '').trim() : '';
        const catFromRow = map.categoryCol >= 0 ? String(row[map.categoryCol] ?? '').trim() : '';
        const categoryName = catFromRow || sheetName;

        products.push([
          categoryName, code, take(map.description), take(map.details), take(map.expiry), take(map.weight),
          take(map.pieces), take(map.boxSize), unitPrice, boxPrice, take(map.pallet40Large),
          take(map.pallet40Small), take(map.pallet20Large), take(map.netWeight), take(map.grossWeight),
          take(map.moq), take(map.moqQuantity), totalPrice, groupFromRow || currentSection,
          String(take(map.priceLevel)).trim() || listPriceLevel, String(take(map.country)).trim() || listCountry
        ]);
        usedSheets.add(sheetName);
      }
    }
    if (!products.length) throw new Error('No product rows with price values were detected in this workbook.');
    const normalized = [headers, ...products];
    const headerIndex = 0;
    const rawHeaders = normalized[headerIndex] || [];
    const width = Math.max(rawHeaders.length, ...normalized.slice(headerIndex + 1).map(row => row.length));
    const finalHeaders = Array.from({ length: width }, (_, index) => String(rawHeaders[index] || `Column ${index + 1}`).trim());
    const priceColumns = finalHeaders.map((header, index) => /price\s*\/\s*(pc|box)/i.test(header) ? index : -1).filter(index => index >= 0);
    const rows = normalized.slice(headerIndex + 1).filter(row => row.some(value => value !== '')).map(row => Array.from({ length: width }, (_, index) => row[index] ?? ''));

    const listName = file.name.replace(/\.(xlsx|xls)$/i, '');
    state.active = {
      id: '',
      name: listName,
      priceLevel: listPriceLevel,
      country: listCountry,
      revision: 1,
      headers: finalHeaders,
      rows,
      priceColumns,
      adjustment: 0,
      categoryAdjustments: {},
      savedAt: null,
      savedBy: state.user.name,
      isDraft: true,
      pendingChanges: []
    };
    state.adjustment = 0;
    state.categoryAdjustments = {};
    resetFilters();
    state.category = '';
    rememberCategory('');

    loadActive(state.active);
    await setDraft(draftKey(), state.active);
    const categoryCount = new Set(rows.map(row => row[COL.category])).size;
    logActivity('import_workbook', `Uploaded "${listName}"`, `${rows.length.toLocaleString()} products across ${categoryCount} categories · ${listPriceLevel} · ${listCountry}.`, {
      fileName: listName, rowCount: rows.length, categoryCount, priceLevel: listPriceLevel, country: listCountry, sourceFile: file.name
    });

    toast(`${rows.length.toLocaleString()} products loaded into the editor.`);
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
          <span class="save-summary-badge neutral">No adjustments (0%)</span>
        </div>
        <div class="save-summary-empty">
          All <strong>${summary.totalProducts.toLocaleString()}</strong> products across <strong>${summary.items.length}</strong> categories will be saved with baseline prices (0% adjustment).
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

    const standardHeaderRow1 = ['Code No', 'Description', 'Expiry Date', 'Weight gr/pc', 'Pcs /box', 'Box Size', 'Price/pc USD', 'Price/box In USD', 'PALLET PER CONTAINER', '', '', 'NW(KG) / Box', 'GW(KG) / Box', 'MOQ', 'Total Price Based on MOQ', 'Product Group'];
    const standardHeaderRow2 = ['', '', '', '', '', '', '', '', '40ft Container', '', '20ft Container', '', '', '', '', ''];
    const standardHeaderRow3 = ['', '', '', '', '', '', '', '', 'Large Pallet (16 pallets)', 'Small Pallet (2 pallets)', 'Large Pallet (8 pallets)', '', '', '', '', ''];
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
      { s: { r: 1, c: 10 }, e: { r: 1, c: 10 } },
      { s: { r: 0, c: 11 }, e: { r: 2, c: 11 } },
      { s: { r: 0, c: 12 }, e: { r: 2, c: 12 } },
      { s: { r: 0, c: 13 }, e: { r: 2, c: 13 } },
      { s: { r: 0, c: 14 }, e: { r: 2, c: 14 } },
      { s: { r: 0, c: 15 }, e: { r: 2, c: 15 } }
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
            row[13],
            row[14],
            row[15],
            isNumeric(row[17]) ? Number(row[17]) : row[17],
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
  async function loadPdfImages() {
    const urls = {};
    state.productImages.forEach(image => {
      if (image.key && image.imagePath) urls[`custom:${image.key}`] = image.imagePath;
    });
    for (const [key, url] of Object.entries(urls)) {
      if (!pdfImageCache[key]) {
        try {
          const res = await fetch(url);
          if (!res.ok) {
            pdfImageCache[key] = null;
            continue;
          }
          const blob = await res.blob();
          pdfImageCache[key] = await new Promise(resolve => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
        } catch {
          pdfImageCache[key] = null;
        }
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
      const { jsPDF } = window.jspdf;
      const rateFor = adjustmentFor(version);
      const adjusted = (value, category) => adjustedWith(rateFor(category), value);
      const getCategoryAdjustment = category => rateFor(category);
      toast('Generating PDF...');
      const pdfImages = await loadPdfImages();

      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      if (typeof doc.autoTable !== 'function') return toast('PDF table tools are unavailable.');

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 18;

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

      if (!targetRows.length) return toast('No products to export.');

      const categoriesMap = new Map();
      targetRows.forEach(row => {
        const category = String(row[0] || 'Products').trim();
        const groupName = String(row[18] || row[0] || 'Other products').trim();
        if (!categoriesMap.has(category)) {
          categoriesMap.set(category, new Map());
        }
        const groupsMap = categoriesMap.get(category);
        if (!groupsMap.has(groupName)) {
          groupsMap.set(groupName, []);
        }
        groupsMap.get(groupName).push(row);
      });

      let currentY = 46;

      for (const [category, groupsMap] of categoriesMap.entries()) {
        const isPresentation = category.toLowerCase() === 'presentation stands';

        // 3-Tier Excel Header
        const standardHead = [
          [
            { content: '', rowSpan: 3, styles: { cellWidth: 93 } },
            { content: 'Code No', rowSpan: 3, styles: { cellWidth: 60 } },
            { content: 'Description', rowSpan: 3, styles: { cellWidth: 152 } },
            { content: 'Expiry\nDate', rowSpan: 3, styles: { cellWidth: 48 } },
            { content: 'Weight\ngr/pc', rowSpan: 3, styles: { cellWidth: 45 } },
            { content: 'Pcs\n/box', rowSpan: 3, styles: { cellWidth: 38 } },
            { content: 'Box Size', rowSpan: 3, styles: { cellWidth: 55 } },
            { content: 'Price/pc\nUSD', rowSpan: 3, styles: { cellWidth: 52 } },
            { content: 'Price/box\nIn USD', rowSpan: 3, styles: { cellWidth: 55 } },
            { content: 'PALLET PER CONTAINER', colSpan: 3, styles: { halign: 'center' } }
          ],
          [
            { content: '40ft Container', colSpan: 2, styles: { halign: 'center' } },
            { content: '20ft Container', colSpan: 1, styles: { halign: 'center' } }
          ],
          [
            { content: 'Large Pallet\n(16 pallets)', styles: { cellWidth: 66, halign: 'center' } },
            { content: 'Small Pallet\n(2 pallets)', styles: { cellWidth: 66, halign: 'center' } },
            { content: 'Large Pallet\n(8 pallets)', styles: { cellWidth: 65, halign: 'center' } }
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

        // Build body rows with product group titles and rowspan photo cells
        const body = [];
        const colCount = 12;

        for (const [groupName, rows] of groupsMap.entries()) {
          // Product group title row uses the pink table header surface.
          body.push([
            {
              content: groupName,
              colSpan: colCount,
              styles: {
                fillColor: [241, 184, 192],
                textColor: [23, 20, 23],
                fontStyle: 'bold',
                fontSize: 8.5,
                halign: 'left',
                cellPadding: { top: 4, bottom: 4, left: 6, right: 6 },
                lineColor: [201, 143, 152],
                lineWidth: 0.65
              }
            }
          ]);

          const imageKey = getPdfGroupImageKey(category, groupName);
          const isAdj = getCategoryAdjustment(category) !== 0;

          rows.forEach((row, rIdx) => {
            const isFirstInGroup = rIdx === 0;

            if (isPresentation) {
              const rowCells = [];
              if (isFirstInGroup) {
                rowCells.push({
                  content: '',
                  rowSpan: rows.length,
                  imageKey,
                  styles: { fillColor: [255, 250, 249], cellPadding: 2, lineColor: [216, 167, 174], lineWidth: 0.65 }
                });
              }
              const itemName = [row[2], row[3]].filter(v => String(v ?? '').trim()).join('\n');
              const moq = [row[15], row[16]].filter(v => String(v ?? '').trim()).join('\n');
              rowCells.push(
                { content: String(row[1] ?? ''), styles: { halign: 'center', fontStyle: 'bold', fontSize: 6.5 } },
                { content: itemName, colSpan: 2, styles: { halign: 'left', fontSize: 6 } },
                { content: String(row[6] ?? ''), styles: { halign: 'center', fontSize: 6 } },
                { content: formatPdfPrice(row[8], category), styles: { halign: 'right', textColor: [23, 20, 23], fontStyle: isAdj ? 'bold' : 'normal', fontSize: 6.5 } },
                { content: formatPdfPrice(row[9], category), styles: { halign: 'right', textColor: [23, 20, 23], fontStyle: isAdj ? 'bold' : 'normal', fontSize: 6.5 } },
                { content: String(row[13] ?? ''), styles: { halign: 'center', fontSize: 6 } },
                { content: String(row[14] ?? ''), styles: { halign: 'center', fontSize: 6 } },
                { content: String(row[7] ?? ''), styles: { halign: 'center', fontSize: 6 } },
                { content: moq, styles: { halign: 'center', fontSize: 6 } },
                { content: String(row[17] ?? ''), styles: { halign: 'right', textColor: [23, 20, 23], fontStyle: isAdj ? 'bold' : 'normal', fontSize: 6 } }
              );
              body.push(rowCells);
            } else {
              const rowCells = [];
              if (isFirstInGroup) {
                rowCells.push({
                  content: '',
                  rowSpan: rows.length,
                  imageKey,
                  styles: { fillColor: [255, 250, 249], cellPadding: 2, lineColor: [216, 167, 174], lineWidth: 0.65 }
                });
              }
              const desc = String(row[2] ?? '').replace(/\r?\n/g, '\n');
              rowCells.push(
                { content: String(row[1] ?? ''), styles: { halign: 'center', fontStyle: 'bold', fontSize: 6.5 } },
                { content: desc, styles: { halign: 'left', fontSize: 6.5, cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 } } },
                { content: String(row[4] ?? ''), styles: { halign: 'center', fontSize: 6 } },
                { content: String(row[5] ?? ''), styles: { halign: 'center', fontSize: 6 } },
                { content: String(row[6] ?? ''), styles: { halign: 'center', fontSize: 6 } },
                { content: String(row[7] ?? ''), styles: { halign: 'center', fontSize: 6 } },
                { content: formatPdfPrice(row[8], category), styles: { halign: 'right', textColor: [23, 20, 23], fontStyle: isAdj ? 'bold' : 'normal', fontSize: 6.5 } },
                { content: formatPdfPrice(row[9], category), styles: { halign: 'right', textColor: [23, 20, 23], fontStyle: isAdj ? 'bold' : 'normal', fontSize: 6.5 } },
                { content: formatPallet(row[10]), styles: { halign: 'center', fontSize: 6 } },
                { content: formatPallet(row[11]), styles: { halign: 'center', fontSize: 6 } },
                { content: formatPallet(row[12]), styles: { halign: 'center', fontSize: 6 } }
              );
              body.push(rowCells);
            }
          });
        }

        // If switching to a new category and not the first page, start on a new page
        if (currentY > 46 && doc.getNumberOfPages() > 0) {
          doc.addPage();
          currentY = 46;
        }

        doc.autoTable({
          head: isPresentation ? presentationHead : standardHead,
          body,
          startY: currentY,
          theme: 'grid',
          showHead: 'everyPage',
          margin: { top: 46, right: margin, bottom: 26, left: margin },
          styles: {
            font: 'helvetica',
            fontSize: 6,
            cellPadding: 2.5,
            overflow: 'linebreak',
            valign: 'middle',
            fillColor: [255, 255, 255],
            textColor: [20, 13, 18],
            lineColor: [216, 180, 188],
            lineWidth: 0.5
          },
          headStyles: {
            fillColor: [244, 216, 222],
            textColor: [20, 13, 18],
            fontStyle: 'bold',
            fontSize: 6.5,
            halign: 'center',
            valign: 'middle',
            lineColor: [203, 157, 168],
            lineWidth: 0.65
          },
          columnStyles: isPresentation ? {
            0: { cellWidth: 93, halign: 'center' },
            1: { cellWidth: 60, halign: 'center', fontStyle: 'bold' },
            2: { cellWidth: 95, halign: 'left' },
            3: { cellWidth: 77, halign: 'left' },
            4: { cellWidth: 55, halign: 'center' },
            5: { cellWidth: 55, halign: 'right' },
            6: { cellWidth: 55, halign: 'right' },
            7: { cellWidth: 55, halign: 'center' },
            8: { cellWidth: 55, halign: 'center' },
            9: { cellWidth: 65, halign: 'center' },
            10: { cellWidth: 65, halign: 'center' },
            11: { cellWidth: 65, halign: 'right' }
          } : {
            0: { cellWidth: 85, halign: 'center' },
            1: { cellWidth: 65, halign: 'center', fontStyle: 'bold' },
            2: { cellWidth: 180, halign: 'left' },
            3: { cellWidth: 46, halign: 'center' },
            4: { cellWidth: 44, halign: 'center' },
            5: { cellWidth: 42, halign: 'center' },
            6: { cellWidth: 56, halign: 'center' },
            7: { cellWidth: 58, halign: 'right' },
            8: { cellWidth: 60, halign: 'right' },
            9: { cellWidth: 56, halign: 'center' },
            10: { cellWidth: 56, halign: 'center' },
            11: { cellWidth: 56, halign: 'center' }
          },
          alternateRowStyles: {
            fillColor: [253, 248, 249]
          },
          didDrawCell: function (data) {
            if (data.section === 'body' && data.column.index === 0 && data.cell.raw && data.cell.raw.imageKey && pdfImages[data.cell.raw.imageKey]) {
              const imgData = pdfImages[data.cell.raw.imageKey];
              const pad = 2;
              const cellX = data.cell.x + pad;
              const cellY = data.cell.y + pad;
              const cellW = data.cell.width - pad * 2;
              const cellH = data.cell.height - pad * 2;
              try {
                doc.addImage(imgData, 'JPEG', cellX, cellY, cellW, cellH, undefined, 'FAST');
              } catch {
                // fallback
              }
            }
          },
          willDrawPage: function () {
            doc.setFillColor(255, 255, 255);
            doc.rect(0, 0, pageWidth, pageHeight, 'F');
          }
        });

        currentY = (doc.lastAutoTable?.finalY || currentY) + 20;
      }

      // Now loop over every generated page to draw the top header and bottom footer
      const pageCount = doc.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);

        // Top Header
        doc.setFillColor(25, 24, 25);
        doc.roundedRect(margin, 12, 22, 22, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('LRN', margin + 11, 26, { align: 'center' });

        doc.setFontSize(11);
        doc.setTextColor(23, 20, 23);
        doc.text(doc.splitTextToSize(version.name || 'Price List', pageWidth * 0.55)[0], margin + 28, 23);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(113, 98, 103);
        const subtitle = ['LA ROSE NOIRE', version.priceLevel, version.country, 'Export Pricing'].filter(Boolean).join(' · ');
        doc.text(subtitle + (scope ? `  ·  ${scope}` : ''), margin + 28, 32);

        // Right side: approval stamp
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(23, 20, 23);
        const approvalText = `Approved by ${version.approvedBy || '—'}${version.approvedAt ? ` · ${displayDate(version.approvedAt)}` : ''}`;
        doc.text(approvalText, pageWidth - margin, 23, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(113, 98, 103);
        doc.text(`Revision ${version.revision || 1} · Exported ${new Date().toLocaleString()} by ${state.user?.name || ''}`, pageWidth - margin, 32, { align: 'right' });

        // Bottom Footer
        doc.setFontSize(6.5);
        doc.setTextColor(113, 98, 103);
        doc.text('LA ROSE NOIRE · Commercial Price List · Strictly Confidential', margin, pageHeight - 12);
        doc.text(`Page ${p} of ${pageCount}`, pageWidth - margin, pageHeight - 12, { align: 'right' });
      }

      doc.save(exportFileName(version, 'pdf'));
      toast('PDF exported.');
    } catch (err) {
      console.error('PDF Export Error:', err);
      toast('Failed to generate PDF: ' + (err.message || 'Unknown error'));
    }
  }

  dom.loginForm.addEventListener('submit', async event => { event.preventDefault(); dom.loginError.textContent = ''; try { const data = await api('login', { method: 'POST', body: JSON.stringify({ email: $('#email').value, password: $('#password').value }) }); state.user = data.user; state.csrf = data.csrf; state.category = ''; rememberCategory(''); setAppLoading(true); await loadState(); } catch (error) { setAppLoading(false); dom.loginError.textContent = error.message; } });
  $('#logoutButton').addEventListener('click', () => dom.logoutDialog.showModal());
  dom.logoutForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (event.submitter && event.submitter.value === 'cancel') {
      dom.logoutDialog.close();
      return;
    }
    dom.logoutDialog.close();

    // Immediately hide the workspace and reveal the login view smoothly
    dom.appView.hidden = true;
    dom.loginView.hidden = false;
    document.body.dataset.authenticated = 'false';
    document.body.classList.remove('is-booting');
    document.body.classList.add('is-ready');

    const csrf = state.csrf;
    state.user = null;
    state.csrf = '';
    state.permissions = [];
    state.canEdit = false;
    state.devTools = false;
    if ($('#devTools')) $('#devTools').hidden = true;
    state.notifications = [];
    state.unreadCount = 0;
    state.auditLogs = [];
    lastSeenNotificationId = null;
    state.category = '';
    rememberCategory('');
    state.active = null;
    state.rows = [];
    state.headers = [];
    state.versions = [];
    state.productImages = [];
    state.imageCategory = '';
    state.imageSearch = '';
    state.pendingImageGroup = null;
    state.pendingImageDelete = null;
    if (dom.imageSearchInput) dom.imageSearchInput.value = '';
    $$('.nav-item')[0]?.click();
    window.__BOOT__ = { user: null, csrf: '' };

    try {
      await fetch('api.php?action=logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf || '' },
        body: '{}'
      });
    } catch {
      // Session destroyed on server
    }
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
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    if (!can('upload')) return toast('Your role cannot upload price lists.');
    if (!/\.(xlsx|xls)$/i.test(file.name)) return toast('Please drop an Excel file (.xlsx or .xls).');
    if (await openUploadModal()) stageFileForUpload(file);
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
    const file = dom.fileInput.files[0];
    if (!file) return;
    dom.fileInput.value = '';
    if (!/\.(xlsx|xls)$/i.test(file.name)) return toast('Please select a valid Excel file (.xlsx or .xls).');
    if (await openUploadModal()) stageFileForUpload(file);
  });

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
    setPriceEditor(false);

    const scopeText = isAll ? 'all categories' : selectedCats.length === 1 ? selectedCats[0] : `${selectedCats.length} categories`;
    logActivity('price_adjust', `Applied ${sign}${value}% to ${scopeText}`, `${sign}${value}% applied to ${affectedProducts.toLocaleString()} products (${selectedCats.join(', ')}). Calculated from the uploaded prices.`, {
      percentage: value, applyAll: isAll, categories: selectedCats, category: selectedCats.length === 1 ? selectedCats[0] : '', adjustedProducts: affectedProducts
    });
    toast(`Applied ${sign}${value}% to ${scopeText}. Save to submit for approval.`);
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
    cb.closest('.category-checkbox-item')?.classList.toggle('checked', cb.checked);
    updateAdjustmentUI();
  });
  dom.selectAllCategoriesBtn?.addEventListener('click', () => {
    getPriceCategories().forEach(c => selectedAdjustmentCategories.add(c.name));
    renderCategoryAdjustmentList(dom.categoryAdjustSearch?.value || '');
  });
  dom.deselectAllCategoriesBtn?.addEventListener('click', () => {
    selectedAdjustmentCategories.clear();
    renderCategoryAdjustmentList(dom.categoryAdjustSearch?.value || '');
  });
  dom.categoryAdjustSearch?.addEventListener('input', () => {
    renderCategoryAdjustmentList(dom.categoryAdjustSearch.value);
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
    if (!state.active.isDraft && state.active.status === 'approved') return toast('No changes to save. Edit prices first to create a new revision.');
    dom.versionNameInput.value = state.active.name || '';
    dom.savePriceLevel.value = state.active.priceLevel || '';
    dom.saveCountry.value = state.active.country || '';
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
        : '<div class="save-summary-empty">No percentage adjustments (baseline prices).</div>')
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
  async function submitDecision(kind, remarks) {
    const decision = state.pendingDecision;
    if (!decision || decision.kind !== kind) return;
    try {
      const data = await api(kind, { method: 'POST', body: JSON.stringify({ id: decision.id, remarks }) });
      state.pendingDecision = null;
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
      state.pendingDelete = id;
      dom.deleteVersionName.textContent = version.name;
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
    const exportable = version.status === 'approved' && can('export');
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
      can('update') ? [item('delete', 'Delete', { danger: true })] : []
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
  $('#listsTable')?.addEventListener('click', async event => {
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
  });
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
  document.addEventListener('scroll', closeRowMenu, true);
  $$('.list-tab-btn').forEach(button => button.addEventListener('click', () => { state.listTab = button.dataset.listTab; renderLists(); }));
  dom.listSearchInput?.addEventListener('input', () => { state.listSearch = dom.listSearchInput.value; renderLists(); });
  dom.listPriceLevelFilter?.addEventListener('change', () => { state.listPriceLevel = dom.listPriceLevelFilter.value; renderLists(); });
  dom.listCountryFilter?.addEventListener('change', () => { state.listCountry = dom.listCountryFilter.value; renderLists(); });
  dom.listStatusFilter?.addEventListener('change', () => { state.listStatus = dom.listStatusFilter.value; renderLists(); });
  $('#refreshListsBtn')?.addEventListener('click', async () => {
    try { await refreshState(); toast('Approvals refreshed.'); } catch (error) { toast(error.message); }
  });
  $('#listsBackBtn')?.addEventListener('click', () => switchPanel('workspacePanel', true));
  dom.bannerApproveBtn?.addEventListener('click', () => state.active?.id && openDecisionDialog('approve', state.active.id));
  dom.bannerRejectBtn?.addEventListener('click', () => state.active?.id && openDecisionDialog('reject', state.active.id));
  function getInitialPanelId() {
    const hash = (location.hash || '').replace(/^#/, '').toLowerCase();
    if (hash === 'approvals' || hash === 'lists' || hash === 'listspanel') return 'listsPanel';
    if (hash === 'history' || hash === 'historypanel') return 'historyPanel';
    if (hash === 'config' || hash === 'settings' || hash === 'settingspanel') return 'settingsPanel';
    if (hash === 'prices' || hash === 'workspace' || hash === 'workspacepanel') return 'workspacePanel';
    try {
      const saved = localStorage.getItem('pla_active_panel');
      if (saved && ['workspacePanel', 'listsPanel', 'historyPanel', 'settingsPanel'].includes(saved)) {
        return saved;
      }
    } catch { }
    return 'workspacePanel';
  }

  function switchPanel(panelId, updateHash = true) {
    let targetButton = $$('.nav-item').find(btn => btn.dataset.panel === panelId);
    if (!targetButton || targetButton.hidden) {
      targetButton = $$('.nav-item')[0];
    }
    if (!targetButton) return;
    const finalPanelId = targetButton.dataset.panel;
    setPriceEditor(false);

    document.documentElement.removeAttribute('data-initial-panel');

    $$('.nav-item').forEach(item => item.classList.toggle('active', item === targetButton));
    $$('.panel').forEach(panel => {
      const isTarget = panel.id === finalPanelId;
      panel.hidden = !isTarget;
      panel.classList.toggle('active', isTarget);
    });
    document.querySelector('.content')?.classList.toggle('history-active', finalPanelId === 'historyPanel' || finalPanelId === 'listsPanel');

    if (finalPanelId === 'settingsPanel') switchConfigTab(state.configTab || 'library');
    if (finalPanelId === 'historyPanel') renderHistory();
    if (finalPanelId === 'listsPanel') renderLists();

    try {
      localStorage.setItem('pla_active_panel', finalPanelId);
    } catch { }

    if (updateHash) {
      const hashMap = {
        workspacePanel: 'prices',
        listsPanel: 'approvals',
        historyPanel: 'history',
        settingsPanel: 'config'
      };
      const hashName = hashMap[finalPanelId] || finalPanelId;
      if (location.hash !== `#${hashName}`) {
        history.replaceState(null, '', `#${hashName}`);
      }
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

  dom.backToPricesBtn?.addEventListener('click', () => $$('.nav-item')[0].click());
  dom.emptyGoToPricesBtn?.addEventListener('click', () => $$('.nav-item')[0].click());
  dom.settingsBackButton?.addEventListener('click', () => $$('.nav-item')[0].click());
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
    dom.resetPricesDialog.showModal();
    requestAnimationFrame(() => $('#confirmResetPrices')?.focus());
  });
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
    state.adjustment = 0;
    state.categoryAdjustments = {};
    if (state.active) {
      markDraft();
      logActivity('reset_prices', 'Reset price adjustments to 0%', previous.length ? `Cleared: ${previous.join(', ')}.` : 'All adjustments cleared.', { cleared: previous });
    }
    dom.percentage.value = 0;
    const title = $('#adjustmentTitle');
    const subtitle = document.querySelector('#adjustmentBar .edit-summary span');
    if (title && state.category) title.textContent = `Adjust ${state.category} prices`;
    if (subtitle) subtitle.textContent = state.category ? `Adjust ${state.category} or apply globally to all categories.` : 'Adjust prices for current category or apply globally.';
    updateMetrics();
    renderTable();
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
  dom.closeUploadModalBtn?.addEventListener('click', closeUploadModal);
  dom.cancelUploadBtn?.addEventListener('click', closeUploadModal);
  dom.downloadTemplateBtn?.addEventListener('click', downloadExcelTemplate);
  dom.browseFileBtn?.addEventListener('click', () => dom.modalFileInput?.click());
  dom.modalDropZone?.addEventListener('click', event => {
    if (event.target !== dom.removeSelectedFileBtn && !event.target.closest('#removeSelectedFileBtn') && event.target !== dom.browseFileBtn) {
      dom.modalFileInput?.click();
    }
  });
  dom.modalFileInput?.addEventListener('change', () => {
    const file = dom.modalFileInput.files?.[0];
    if (file) stageFileForUpload(file);
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
    const file = event.dataTransfer?.files?.[0];
    if (file) stageFileForUpload(file);
  });
  dom.removeSelectedFileBtn?.addEventListener('click', event => {
    event.stopPropagation();
    clearStagedFile();
  });
  dom.submitUploadBtn?.addEventListener('click', async () => {
    if (!stagedUploadFile) return;
    const meta = { priceLevel: dom.uploadPriceLevel.value.trim(), country: dom.uploadCountry.value.trim() };
    if (!meta.priceLevel) { dom.uploadPriceLevel.focus(); return toast('Enter the price level for this price list.'); }
    if (!meta.country) { dom.uploadCountry.focus(); return toast('Enter the country for this price list.'); }
    const fileToParse = stagedUploadFile;
    closeUploadModal();
    try {
      await parseWorkbook(fileToParse, meta);
    } catch (err) {
      toast(err.message || 'Failed to process Excel workbook.');
    }
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

  // --- Photo library ("drawer") and photo picker ---
  function photoUsage(photoId) {
    return (state.productImages || []).filter(image => image.libraryId === photoId);
  }
  function photoCardMarkup(photo, { selected = false, current = false, deletable = false } = {}) {
    const usage = photoUsage(photo.id).length;
    return `<div class="library-card ${selected ? 'is-selected' : ''} ${current ? 'is-current' : ''}" data-photo-id="${escapeHtml(photo.id)}" role="option" tabindex="0" aria-selected="${selected}" title="${escapeHtml(photo.name)}">
      <div class="library-thumb"><img src="${escapeHtml(photo.imagePath)}" alt="${escapeHtml(photo.name)}" loading="lazy"></div>
      <div class="library-meta">
        <strong>${escapeHtml(photo.name)}</strong>
        <small>${current ? 'Current photo' : usage ? `Used by ${usage} product type${usage === 1 ? '' : 's'}` : 'Not used yet'}</small>
      </div>
      ${deletable ? `<button type="button" class="library-delete" data-photo-id="${escapeHtml(photo.id)}" aria-label="Delete ${escapeHtml(photo.name)}" title="Delete photo">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>` : ''}
      ${selected ? '<span class="library-check" aria-hidden="true">✓</span>' : ''}
    </div>`;
  }
  function filteredLibrary(query) {
    const q = String(query || '').trim().toLowerCase();
    return (state.photoLibrary || []).filter(photo => !q || photo.name.toLowerCase().includes(q));
  }
  function renderLibrary() {
    const grid = $('#libraryGrid');
    if (!grid) return;
    const all = state.photoLibrary || [];
    const visible = filteredLibrary(state.librarySearch);
    $('#libraryCountBadge').textContent = String(all.length);
    $('#libraryCount').textContent = `${visible.length} photo${visible.length === 1 ? '' : 's'}`;
    $('#libraryEmpty').hidden = visible.length > 0;
    if (!visible.length && all.length) $('#libraryEmpty').innerHTML = '<h2>No matching photos</h2><p>Try a different search.</p>';
    else if (!all.length) $('#libraryEmpty').innerHTML = '<h2>The library is empty</h2><p>Upload product photos above. You can then pick them for any product type.</p>';
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

  /** Uploads several files to the library; resolves with the newly added photos. */
  let libraryUploadTarget = null;
  async function uploadLibraryFiles(fileList) {
    const files = [...(fileList || [])].filter(file => /^image\/(jpeg|png|webp)$/.test(file.type));
    const skipped = (fileList?.length || 0) - files.length;
    if (!files.length) { toast('Choose JPG, PNG, or WebP images.'); return []; }
    const status = $('#libraryUploadStatus');
    const added = [];
    const errors = [];
    // Send in batches so very large selections stay under the server's upload limits.
    for (let start = 0; start < files.length; start += 10) {
      const batch = files.slice(start, start + 10);
      if (status) status.textContent = `Uploading ${Math.min(start + batch.length, files.length)} of ${files.length}…`;
      const form = new FormData();
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
    state.photoLibrary = [...added, ...(state.photoLibrary || [])];
    renderLibrary();
    const problems = errors.length + skipped;
    toast(added.length ? `${added.length} photo${added.length === 1 ? '' : 's'} added to the library${problems ? ` · ${problems} skipped` : ''}.` : (errors[0] || 'No photos were added.'));
    return added;
  }
  const libraryInput = $('#libraryFileInput');
  const libraryDrop = $('#libraryDropZone');
  libraryDrop?.addEventListener('click', () => { libraryUploadTarget = 'library'; libraryInput.value = ''; libraryInput.click(); });
  libraryDrop?.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); libraryDrop.click(); } });
  libraryDrop?.addEventListener('dragover', event => { event.preventDefault(); libraryDrop.classList.add('dragover'); });
  libraryDrop?.addEventListener('dragleave', () => libraryDrop.classList.remove('dragover'));
  libraryDrop?.addEventListener('drop', async event => {
    event.preventDefault();
    libraryDrop.classList.remove('dragover');
    await uploadLibraryFiles(event.dataTransfer?.files);
  });
  libraryInput?.addEventListener('change', async () => {
    const target = libraryUploadTarget;
    const added = await uploadLibraryFiles(libraryInput.files);
    libraryInput.value = '';
    if (target === 'picker') {
      if (added.length) picker.selectedId = added[0].id;
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
  const picker = { category: '', groupName: '', selectedId: '', currentId: '', currentKey: '' };
  function renderPicker() {
    const grid = $('#photoPickerGrid');
    const visible = filteredLibrary($('#photoPickerSearch').value);
    $('#photoPickerEmpty').hidden = visible.length > 0;
    grid.hidden = !visible.length;
    grid.innerHTML = visible.map(photo => photoCardMarkup(photo, { selected: photo.id === picker.selectedId, current: photo.id === picker.currentId })).join('');
    $('#photoPickerConfirm').disabled = !picker.selectedId || picker.selectedId === picker.currentId;
    $('#photoPickerRemove').hidden = !picker.currentKey;
  }
  function openPhotoPicker(category, groupName) {
    if (!can('manageImages')) return toast('You do not have permission to manage product photos.');
    const current = imageOverride(category, groupName);
    Object.assign(picker, { category, groupName, currentId: current?.libraryId || '', currentKey: current?.key || '', selectedId: current?.libraryId || '' });
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
  $('#photoPickerConfirm')?.addEventListener('click', confirmPicker);
  $('#photoPickerCancel')?.addEventListener('click', () => $('#photoPickerDialog').close());
  $('#photoPickerClose')?.addEventListener('click', () => $('#photoPickerDialog').close());
  $('#photoPickerUpload')?.addEventListener('click', () => { libraryUploadTarget = 'picker'; libraryInput.value = ''; libraryInput.click(); });
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

  function initTheme() {
    let savedTheme = null;
    try {
      savedTheme = localStorage.getItem('pla_theme');
    } catch { }
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    applyTheme(currentTheme);

    $$('.theme-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const nextTheme = isDark ? 'light' : 'dark';
        applyTheme(nextTheme);
        try {
          localStorage.setItem('pla_theme', nextTheme);
        } catch { }
      });
    });
  }

  function applyTheme(theme) {
    const isDark = theme === 'dark';
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.body.removeAttribute('data-theme');
    }

    $$('.theme-toggle-btn').forEach(btn => {
      const sun = btn.querySelector('.theme-icon-sun');
      const moon = btn.querySelector('.theme-icon-moon');
      if (sun) sun.hidden = !isDark;
      if (moon) moon.hidden = isDark;
      btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      btn.setAttribute('title', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    });
  }

  initTheme();

  if (state.user) loadState().catch(error => { setAppLoading(false); toast(error.message); });
})();
