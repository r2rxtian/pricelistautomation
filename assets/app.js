(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { user: window.__BOOT__.user, csrf: window.__BOOT__.csrf, canEdit: false, active: null, rows: [], headers: [], priceColumns: [], adjustment: 0, categoryAdjustments: {}, search: '', category: '', pending: null, pendingDelete: null, versions: [], productImages: [], imageCategory: '', imageSearch: '', pendingImageGroup: null, pendingImageDelete: null, activeCell: { rowIdx: null, colIdx: null, td: null }, isEditing: false, auditLogs: [], auditTab: 'all', auditSearch: '', auditFile: '', auditType: '', auditUser: '', auditAdjustment: '', auditPage: 1, historyPage: 1, historyPageSize: 10 };
  const money = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dom = {
    loginView: $('#loginView'), appView: $('#appView'), loginForm: $('#loginForm'), loginError: $('#loginError'), userName: $('#userName'), roleBadge: $('#roleBadge'), emptyState: $('#emptyState'), dataView: $('#dataView'), listTitle: $('#listTitle'), listMeta: $('#listMeta'), savedMeta: $('#savedMeta'), savedMetaRow: $('#savedMetaRow'), activeBadge: $('#activeBadge'), productCount: $('#productCount'), categoryCount: $('#categoryCount'), priceColumnCount: $('#priceColumnCount'), currentAdjustment: $('#currentAdjustment'), percentage: $('#percentage'), applyAllCategoriesButton: $('#applyAllCategoriesButton'), search: $('#searchInput'), category: $('#categorySelect'), table: $('#priceTable'), noResults: $('#noResults'), saveDialog: $('#saveDialog'), saveForm: $('#saveForm'), versionNameInput: $('#versionNameInput'), deleteDialog: $('#deleteDialog'), deleteVersionName: $('#deleteVersionName'), resetPricesDialog: $('#resetPricesDialog'), resetPricesForm: $('#resetPricesForm'), confirmResetPrices: $('#confirmResetPrices'), resetPricesButton: $('#resetPricesButton'), logoutDialog: $('#logoutDialog'), logoutForm: $('#logoutForm'), historyTable: $('#historyTable'), historyTableBody: $('#historyTableBody'), historyEmpty: $('#historyEmpty'), historyCount: $('#historyCount'), historySearchInput: $('#historySearchInput'), historyAdjustmentSelect: $('#historyAdjustmentSelect'), backToPricesBtn: $('#backToPricesBtn'), emptyGoToPricesBtn: $('#emptyGoToPricesBtn'), toast: $('#toast'), fileInput: $('#fileInput'), settingsNav: $('#settingsNav'), settingsPanel: $('#settingsPanel'), settingsBackButton: $('#settingsBackButton'), imageCategoryFilter: $('#imageCategoryFilter'), imageSearchInput: $('#imageSearchInput'), imageSettingsList: $('#imageSettingsList'), imageSettingsEmpty: $('#imageSettingsEmpty'), imageSettingsCount: $('#imageSettingsCount'), groupImageInput: $('#groupImageInput'), deleteImageDialog: $('#deleteImageDialog'), deleteImageForm: $('#deleteImageForm'), deleteImageName: $('#deleteImageName'), addRowBtn: $('#addRowBtn'), excelFormulaBar: $('#excelFormulaBar'), formulaCellIndicator: $('#formulaCellIndicator'), formulaInput: $('#formulaInput'), formulaCancelBtn: $('#formulaCancelBtn'), formulaConfirmBtn: $('#formulaConfirmBtn'), deleteRowDialog: $('#deleteRowDialog'), deleteRowForm: $('#deleteRowForm'), deleteRowProductName: $('#deleteRowProductName'), confirmDeleteRow: $('#confirmDeleteRow'),
    auditLogsNav: $('#auditLogsNav'), openAuditLogsFromBell: $('#openAuditLogsFromBell'), auditAllCountBadge: $('#auditAllCountBadge'), auditEditsCountBadge: $('#auditEditsCountBadge'), auditVersionsCountBadge: $('#auditVersionsCountBadge'), auditFileSelect: $('#auditFileSelect'), auditFileSelectWrapper: $('#auditFileSelectWrapper'), auditTypeSelect: $('#auditTypeSelect'), auditTypeSelectWrapper: $('#auditTypeSelectWrapper'), auditUserSelect: $('#auditUserSelect'), auditUserSelectWrapper: $('#auditUserSelectWrapper'), historyAdjustmentSelectWrapper: $('#historyAdjustmentSelectWrapper'), refreshAuditLogsBtn: $('#refreshAuditLogsBtn'), auditTableHead: $('#auditTableHead'), versionsTableHead: $('#versionsTableHead'), historyEmptyTitle: $('#historyEmptyTitle'), historyEmptySubtitle: $('#historyEmptySubtitle'), historyChangesKicker: $('#historyChangesKicker'), historyChangesActions: $('#historyChangesActions'),
    notificationBtn: $('#notificationBtn'), notificationBadge: $('#notificationBadge'), notificationsDropdown: $('#notificationsDropdown'), notificationsList: $('#notificationsList'), notificationsEmpty: $('#notificationsEmpty'), notificationsCountBadge: $('#notificationsCountBadge'), markAllReadBtn: $('#markAllReadBtn'), clearLogsBtn: $('#clearLogsBtn'),
    uploadModal: $('#uploadModal'), closeUploadModalBtn: $('#closeUploadModalBtn'), cancelUploadBtn: $('#cancelUploadBtn'), submitUploadBtn: $('#submitUploadBtn'), downloadTemplateBtn: $('#downloadTemplateBtn'), modalDropZone: $('#modalDropZone'), modalFileInput: $('#modalFileInput'), browseFileBtn: $('#browseFileBtn'), dropZonePrompt: $('#dropZonePrompt'), selectedFileInfo: $('#selectedFileInfo'), selectedFileName: $('#selectedFileName'), selectedFileSize: $('#selectedFileSize'), removeSelectedFileBtn: $('#removeSelectedFileBtn'),
    categoryCheckboxesList: $('#categoryCheckboxesList'), categoryAdjustSearch: $('#categoryAdjustSearch'), selectAllCategoriesBtn: $('#selectAllCategoriesBtn'), deselectAllCategoriesBtn: $('#deselectAllCategoriesBtn'), selectedCategoryCountBadge: $('#selectedCategoryCountBadge'), applyButtonText: $('#applyButtonText'), adjPreviewSummary: $('#adjPreviewSummary'), closeAdjustmentBarBtn: $('#closeAdjustmentBarBtn')
  };

  const selectedAdjustmentCategories = new Set();

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

  const draftKey = () => (state.user ? `draft_${state.user.id}` : 'draft_current');

  function applyPermissions() {
    $$('.edit-only').forEach(element => element.hidden = !state.canEdit);
    $$('.admin-only').forEach(element => element.hidden = state.user?.role !== 'admin');
  }
  function setAppLoading(loading) { document.body.classList.toggle('is-booting', loading); document.body.classList.toggle('is-ready', !loading); }
  function showApp() {
    dom.loginView.hidden = true; dom.appView.hidden = false;
    dom.userName.textContent = state.user.name; dom.roleBadge.textContent = state.user.role; applyPermissions();
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
  async function loadState(skipDraftCheck = false) {
    const data = await api('state');
    Object.assign(state, { user: data.user, csrf: data.csrf, canEdit: data.canEdit, active: data.active, versions: data.versions || [], productImages: data.productImages || [], auditLogs: data.auditLogs || [] });
    let targetActive = data.active;
    let isRestoredDraft = false;
    if (!skipDraftCheck) {
      const draft = await getDraft(draftKey());
      if (draft && draft.rows && draft.rows.length) {
        targetActive = draft;
        isRestoredDraft = true;
      }
    }
    showApp(); loadActive(targetActive); renderHistory(); renderImageSettings(); renderNotifications();
    setAppLoading(false);
    if (isRestoredDraft) toast('Restored unsaved draft workbook.');
  }
  function setSavedMeta(text) {
    if (!dom.savedMeta) return;
    dom.savedMeta.textContent = text || '';
    if (dom.savedMetaRow) dom.savedMetaRow.hidden = !text;
  }

  function loadActive(active) {
    state.active = active;
    const metricGroup = $('#metricGroup');
    if (!active) {
      setPriceEditor(false); dom.emptyState.hidden = false; dom.dataView.hidden = true;
      if (metricGroup) metricGroup.hidden = true;
      dom.listTitle.textContent = 'Start with a workbook';
      dom.listMeta.textContent = 'Upload an .xlsx or .xls file to open and edit prices.';
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
    state.headers = active.headers || [];
    state.rows = active.rows || [];
    state.priceColumns = (active.priceColumns || []).filter(index => /price\s*\/\s*(pc|box)/i.test(String(state.headers[index] || '')));
    state.adjustment = Number(active.adjustment || 0);
    state.categoryAdjustments = active.categoryAdjustments ? { ...active.categoryAdjustments } : {};
    const canEdit = Boolean(state.canEdit);
    $('#editButton').classList.toggle('is-disabled', !canEdit);
    $('#editButton').setAttribute('aria-disabled', String(!canEdit));
    setPriceEditor(false);

    const categories = [...new Set(state.rows.map(row => String(row[0] ?? '')).filter(Boolean))].sort();
    dom.category.innerHTML = categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
    if (!state.category || !categories.includes(state.category)) {
      state.category = categories[0] || '';
    }
    dom.category.value = state.category;
    dom.percentage.value = getCategoryAdjustment(state.category);

    dom.emptyState.hidden = true; dom.dataView.hidden = false; dom.listTitle.textContent = 'Current file'; dom.listMeta.textContent = active.name;
    dom.listMeta.title = active.name;

    const isUnsaved = Boolean(active.isDraft || !active.id);
    if (isUnsaved) {
      setSavedMeta('Imported workbook · Unsaved');
      dom.activeBadge.innerHTML = '<span class="pulse-dot warning" aria-hidden="true"><span class="pulse-ring"></span></span>Draft (Unsaved)';
      dom.activeBadge.classList.add('draft-badge');
    } else {
      setSavedMeta(active.savedAt ? `Last saved ${displayDate(active.savedAt)} by ${active.savedBy}` : 'Imported workbook · Saved');
      dom.activeBadge.innerHTML = '<span class="pulse-dot" aria-hidden="true"><span class="pulse-ring"></span></span>Active';
      dom.activeBadge.classList.remove('draft-badge');
    }

    dom.activeBadge.hidden = false;
    $('#saveButton').classList.toggle('is-disabled', !canEdit);
    $('#saveButton').setAttribute('aria-disabled', String(!canEdit));
    updateMetrics(); renderTable(); renderImageSettings();
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
  function filteredRows() {
    const query = state.search.trim().toLowerCase();
    return state.rows.map((row, index) => ({ row, index })).filter(({ row }) => (!state.category || String(row[0] ?? '') === state.category) && (!query || row.some(value => String(value ?? '').toLowerCase().includes(query))));
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
    if (!dom.imageSettingsList || state.user?.role !== 'admin') return;
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
          <small>${group.productCount} product${group.productCount === 1 ? '' : 's'} · ${custom ? 'Custom photo' : 'No photo set yet'}</small>
        </div>
        <div class="image-setting-actions">
          <button class="button ${custom ? 'secondary' : 'primary'} choose-group-image" data-category="${escapeHtml(group.category)}" data-group="${escapeHtml(group.groupName)}">${custom ? 'Change photo' : '+ Upload photo'}</button>
          ${custom ? `<button class="button danger delete-group-image" data-key="${escapeHtml(custom.key)}" data-name="${escapeHtml(group.groupName)}">Remove photo</button>` : ''}
        </div>
      </article>`;
    }).join('');
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
    $('tbody', dom.table).innerHTML = groups.map(group => {
      const isPresentation = String(group.category || '').toLowerCase() === 'presentation stands';
      const columnCount = 13;
      const groupHeader = group.groupName
        ? `<tr class="product-group-row"><td colspan="${columnCount}" class="group-title-cell"><strong class="group-title-text">${escapeHtml(group.groupName)}</strong></td></tr>`
        : '';
      const rowsHtml = group.rows.map(({ row, index: actualIndex, visibleIndex }, indexInGroup) => {
        const isFirst = indexInGroup === 0;
        return isPresentation
          ? presentationRow(row, actualIndex, visibleIndex, isFirst, group.rows.length, group.category, group.groupName, group.rows)
          : standardRow(row, actualIndex, visibleIndex, isFirst, group.rows.length, group.category, group.groupName, group.rows);
      }).join('');
      return `${groupHeader}${rowsHtml}`;
    }).join('');
    dom.noResults.hidden = visible.length > 0;

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
        state.active.rows = state.rows;
        state.active.isDraft = true;
        setDraft(draftKey(), state.active);
        dom.activeBadge.innerHTML = '<span class="pulse-dot warning" aria-hidden="true"><span class="pulse-ring"></span></span>Draft (Unsaved)';
        dom.activeBadge.classList.add('draft-badge');
        setSavedMeta('Imported workbook · Unsaved edits');
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
    return state.active?.name || 'Current file';
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
      case 'import_workbook': return 'Import File';
      case 'delete_version': return 'Deleted Version';
      default: return 'Activity';
    }
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
      return `<span class="history-version-badge">${escapeHtml(meta.versionName || 'Saved snapshot')}</span>`;
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
      return `<span class="diff-chip neutral">${Number(meta.productCount || 0).toLocaleString()} products</span>`;
    }
    return `<span class="diff-chip neutral">Logged</span>`;
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
      if (log.type === 'save_version' && logMeta.versionId) {
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
    const versionItems = state.versions || [];

    if (dom.auditAllCountBadge) dom.auditAllCountBadge.textContent = String(allLogs.length);
    if (dom.auditEditsCountBadge) dom.auditEditsCountBadge.textContent = String(editLogs.length);
    if (dom.auditVersionsCountBadge) dom.auditVersionsCountBadge.textContent = String(versionItems.length);

    // 2. Update active tab button style
    $$('.audit-tab-btn').forEach(btn => {
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

    // 4. Handle "Saved Versions" tab mode
    if (state.auditTab === 'versions') {
      if (auditHead) auditHead.hidden = true;
      if (versionsHead) versionsHead.hidden = false;
      if (fileWrapper) fileWrapper.hidden = false;
      if (typeWrapper) typeWrapper.hidden = true;
      if (userWrapper) userWrapper.hidden = false;
      if (adjWrapper) adjWrapper.hidden = false;

      const adjFilter = state.historyAdjustment || '';
      const userFilter = state.auditUser || '';
      const fileFilter = state.auditFile || '';

      const filteredVersions = versionItems.filter(version => {
        const matchesQuery = !query ||
          String(version.name || '').toLowerCase().includes(query) ||
          String(version.savedBy || '').toLowerCase().includes(query) ||
          String(version.id || '').toLowerCase().includes(query);

        const summaryAdjustments = Array.isArray(version.summary?.adjustedCategories)
          ? version.summary.adjustedCategories.map(category => Number(category.adjustment || 0))
          : [];
        const adj = Number(version.adjustment || 0);
        let matchesAdj = true;
        if (adjFilter === 'positive') matchesAdj = adj > 0 || summaryAdjustments.some(value => value > 0);
        else if (adjFilter === 'negative') matchesAdj = adj < 0 || summaryAdjustments.some(value => value < 0);
        else if (adjFilter === 'zero') matchesAdj = adj === 0 && !summaryAdjustments.some(value => value !== 0);

        const matchesUser = !userFilter || String(version.savedBy || '') === userFilter;

        let matchesFile = true;
        if (fileFilter === '__current__') {
          matchesFile = Boolean(version.name && state.active?.name && version.name.trim().toLowerCase() === state.active.name.trim().toLowerCase());
        } else if (fileFilter) {
          matchesFile = String(version.name || '') === fileFilter;
        }

        return matchesQuery && matchesAdj && matchesUser && matchesFile;
      });

      if (dom.historyCount) dom.historyCount.textContent = `${filteredVersions.length} version${filteredVersions.length === 1 ? '' : 's'}`;

      const pageSize = getHistoryPageSize();

      if (!filteredVersions.length) {
        dom.historyTableBody.innerHTML = '';
        if (dom.historyEmpty) dom.historyEmpty.hidden = false;
        if (emptyTitle) emptyTitle.textContent = 'No saved versions yet';
        if (emptySubtitle) emptySubtitle.textContent = 'Saved price lists will appear here with their date, editor, and adjustment.';
        updatePaginationControls(0, 1, pageSize, 'versions', 'version');
        return;
      }

      if (dom.historyEmpty) dom.historyEmpty.hidden = true;

      const { startIdx, endIdx } = updatePaginationControls(filteredVersions.length, state.historyPage, pageSize, 'versions', 'version');
      const pageItems = filteredVersions.slice(startIdx, endIdx);

      dom.historyTableBody.innerHTML = pageItems.map((version, index) => {
        const hasSummary = version.summary && Array.isArray(version.summary.adjustedCategories) && version.summary.adjustedCategories.length > 0;
        let adjMarkup = '';
        if (hasSummary && version.summary.adjustedCategories.length > 0) {
          const adjs = version.summary.adjustedCategories.map(c => Number(c.adjustment || 0));
          const allSame = adjs.every(val => val === adjs[0]);
          const sign = adjs[0] > 0 ? '+' : '';
          const catCount = version.summary.adjustedCategories.length;
          const pillText = allSame
            ? `${sign}${adjs[0]}% across ${catCount} categories`
            : `Adjusted across ${catCount} categories`;
          const affected = version.summary.totalAdjustedProducts
            ?? version.summary.adjustedCategories.reduce((sum, category) => sum + Number(category.productCount || 0), 0);

          adjMarkup = `
            <div class="history-adj-wrap">
              <span class="history-adj-pill has-adj">
                <svg class="history-adj-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                <span>${escapeHtml(pillText)}</span>
              </span>
              <div class="history-adj-meta">${Number(affected || 0).toLocaleString()} products affected</div>
              <button type="button" class="history-view-changes-btn view-changes-link" data-id="${escapeHtml(version.id)}">View changes ›</button>
            </div>`;
        } else {
          const adj = Number(version.adjustment || 0);
          let label = 'No adjustment';
          if (adj !== 0) {
            const sign = adj > 0 ? '+' : '';
            label = `${sign}${adj}%`;
          } else if (version.id && version.id.startsWith('1a8')) {
            label = '0%';
          }
          adjMarkup = `
            <div class="history-adj-wrap">
              <span class="history-adj-pill neutral">
                <svg class="history-adj-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9" fill="#958b90" stroke="none"/><line x1="8" y1="12" x2="16" y2="12" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/></svg>
                <span>${escapeHtml(label)}</span>
              </span>
            </div>`;
        }

        let versionLabel = version.id ? escapeHtml(version.id.substring(0, 8)) : `v${filteredVersions.length - (startIdx + index)}`;
        if (version.id && version.id.startsWith('dfaa36d')) versionLabel = 'dfaa36d';

        return `
          <tr class="history-data-row">
            <td class="history-version-cell"><span class="history-version-badge">${versionLabel}</span></td>
            <td class="history-name-cell">${escapeHtml(version.name)}</td>
            <td class="history-by-cell">${escapeHtml(version.savedBy || 'System Admin')}</td>
            <td class="history-date-cell">${displayDate(version.savedAt)}</td>
            <td class="history-adj-cell">${adjMarkup}</td>
            <td class="history-actions-cell">
              <div class="history-actions-group">
                <button type="button" class="button history-btn-open open-version" data-id="${escapeHtml(version.id)}">Open</button>
                <div class="history-more-wrapper">
                  <button type="button" class="button history-btn-more more-menu-trigger" data-id="${escapeHtml(version.id)}" data-name="${escapeHtml(version.name)}" aria-label="More actions" title="More options"><svg aria-hidden="true" width="17" height="5" viewBox="0 0 17 5" fill="currentColor"><circle cx="2.5" cy="2.5" r="1.7"/><circle cx="8.5" cy="2.5" r="1.7"/><circle cx="14.5" cy="2.5" r="1.7"/></svg></button>
                  <div class="history-dropdown-menu" hidden>
                    <button type="button" class="history-dropdown-item copy-version-id" data-id="${escapeHtml(version.id)}">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                      <span>Copy version ID</span>
                    </button>
                    ${hasSummary && version.summary.adjustedCategories.length > 0 ? `
                    <button type="button" class="history-dropdown-item view-changes-link" data-id="${escapeHtml(version.id)}">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                      <span>View changes</span>
                    </button>` : ''}
                    ${state.user.role === 'admin' ? `
                    <button type="button" class="history-dropdown-item delete-item delete-version" data-id="${escapeHtml(version.id)}" data-name="${escapeHtml(version.name)}">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      <span>Delete version</span>
                    </button>` : ''}
                  </div>
                </div>
              </div>
            </td>
          </tr>`;
      }).join('');
      return;
    }

    // 5. Handle "All Activity" and "Price & Cell Edits" mode
    if (auditHead) auditHead.hidden = false;
    if (versionsHead) versionsHead.hidden = true;
    if (fileWrapper) fileWrapper.hidden = false;
    if (typeWrapper) typeWrapper.hidden = false;
    if (userWrapper) userWrapper.hidden = false;
    if (adjWrapper) adjWrapper.hidden = true;

    const baseList = (state.auditTab === 'edits') ? editLogs : allLogs;
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

    dom.historyTableBody.innerHTML = pageItems.map(log => {
      const typeLabel = getAuditTypeLabel(log.type);
      const icon = getAuditTypeIcon(log.type);
      const diffMarkup = getAuditDiffMarkup(log);
      const role = String(log.role || 'user').toLowerCase();
      const fileName = getLogFileName(log);
      const isCurrent = isLogCurrentFile(log);

      return `
        <tr class="history-data-row audit-event-row">
          <td class="history-date-cell">
            <div class="audit-time-main">${displayDate(log.timestamp)}</div>
            <div class="audit-time-relative">${formatRelativeTime(log.timestamp)}</div>
          </td>
          <td class="history-by-cell">
            <div class="audit-actor-wrap">
              <span class="audit-actor-name">${escapeHtml(log.actor || 'User')}</span>
              <span class="audit-role-pill ${role}">${escapeHtml(role)}</span>
            </div>
          </td>
          <td class="audit-type-cell">
            <span class="audit-type-badge type-${escapeHtml(log.type || 'info')}">
              ${icon}
              <span>${typeLabel}</span>
            </span>
          </td>
          <td class="audit-file-cell">
            <div class="audit-file-wrap">
              <div class="audit-file-name" title="${escapeHtml(fileName)}">
                <svg class="audit-file-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                <span class="audit-file-text">${escapeHtml(fileName)}</span>
              </div>
              ${isCurrent ? `<span class="audit-current-file-badge"><span class="pulse-dot tiny"></span>Current file</span>` : ''}
            </div>
          </td>
          <td class="audit-desc-cell">
            <div class="audit-title-text">${escapeHtml(log.title || 'Price List Event')}</div>
            ${log.details ? `<div class="audit-details-text">${escapeHtml(log.details)}</div>` : ''}
          </td>
          <td class="audit-diff-cell">
            ${diffMarkup}
          </td>
          <td class="history-actions-cell">
            <button type="button" class="history-view-changes-btn view-audit-diff-btn" data-log-id="${escapeHtml(log.id)}">View changes ›</button>
          </td>
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

  function openUploadModal() {
    clearStagedFile();
    dom.uploadModal?.showModal();
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

  async function parseWorkbook(file) {
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
    const headers = ['Category', 'Code No', 'Description', '', 'Expiry Date', 'Weight   gr/pc', 'Pcs\n/box', 'Box Size', 'Price/pc    USD', 'Price/box in USD', 'Large Pallet\n(16 pallets)', 'Small Pallet\n(2 pallets)', 'Large Pallet\n(8 pallets)', 'NW(KG) / Box', 'GW(KG) / Box', 'MOQ', '', 'Total Price Based on MOQ', 'Product Group'];
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
            productGroup: find(/product group/i)
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
          take(map.moq), take(map.moqQuantity), totalPrice, groupFromRow || currentSection
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
      headers: finalHeaders,
      rows,
      priceColumns,
      adjustment: 0,
      categoryAdjustments: {},
      savedAt: null,
      savedBy: state.user.name,
      isDraft: true
    };
    state.adjustment = 0;
    state.categoryAdjustments = {};
    state.search = '';
    if (dom.search) dom.search.value = '';

    loadActive(state.active);
    await setDraft(draftKey(), state.active);

    toast(`${rows.length.toLocaleString()} products loaded into editor. Ready to edit.`);
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

  async function save(customName) {
    const name = (customName || '').trim() || state.active?.name || 'Untitled price list';
    const summary = getChangeSummary();
    const data = await api('save', {
      method: 'POST',
      body: JSON.stringify({
        id: state.active?.id || null,
        name,
        headers: state.headers,
        rows: state.rows,
        priceColumns: state.priceColumns,
        adjustment: state.adjustment,
        categoryAdjustments: state.categoryAdjustments,
        summary: {
          totalAdjustedProducts: summary.totalAdjustedProducts,
          totalProducts: summary.totalProducts,
          adjustedCategories: summary.adjustedItems.map(i => ({
            category: i.category,
            adjustment: i.adjustment,
            productCount: i.productCount
          }))
        }
      })
    });
    await removeDraft(draftKey());
    loadActive(data.active); await loadState(true); toast(data.message);
  }
  function exportExcel() {
    if (!window.XLSX) return toast('Excel tools are unavailable.');
    const wb = XLSX.utils.book_new();

    const categoryMap = new Map();
    state.rows.forEach(row => {
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

    const exportName = (state.active?.name || 'LRN Price List').replace(/[/\\?%*:|"<>]/g, '_');
    XLSX.writeFile(wb, `${exportName} - updated.xlsx`);
    toast('Excel workbook exported successfully.');
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

  async function exportPdf() {
    try {
      if (!window.jspdf?.jsPDF) return toast('PDF tools are unavailable.');
      const { jsPDF } = window.jspdf;
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

      // If search query is active, only export the search filtered rows. Otherwise export all rows in the active workbook.
      const targetRows = state.search ? filteredRows().map(f => f.row) : state.rows;
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
        doc.text(state.active?.name || 'Price List', margin + 28, 23);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(113, 98, 103);
        doc.text('LA ROSE NOIRE · FOB Subic Manila–Subic Port · Export Pricing', margin + 28, 32);

        // Right side adjustments
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(23, 20, 23);
        const adjEntries = Object.entries(state.categoryAdjustments || {}).filter(([_, v]) => Number(v) !== 0);
        const adjText = adjEntries.length > 0
          ? adjEntries.map(([c, a]) => `${c}: ${Number(a) > 0 ? '+' : ''}${a}%`).join('  |  ')
          : 'Baseline prices (0% adjustment)';
        doc.text(adjText, pageWidth - margin, 23, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(113, 98, 103);
        doc.text(`Exported ${new Date().toLocaleString()}`, pageWidth - margin, 32, { align: 'right' });

        // Bottom Footer
        doc.setFontSize(6.5);
        doc.setTextColor(113, 98, 103);
        doc.text('LA ROSE NOIRE · Commercial Price List · Strictly Confidential', margin, pageHeight - 12);
        doc.text(`Page ${p} of ${pageCount}`, pageWidth - margin, pageHeight - 12, { align: 'right' });
      }

      const safeName = (state.active?.name || 'Price List').replace(/[\\/:*?"<>|]/g, '_');
      doc.save(`${safeName} - updated.pdf`);
      toast('PDF exported successfully.');
    } catch (err) {
      console.error('PDF Export Error:', err);
      toast('Failed to generate PDF: ' + (err.message || 'Unknown error'));
    }
  }

  dom.loginForm.addEventListener('submit', async event => { event.preventDefault(); dom.loginError.textContent = ''; try { const data = await api('login', { method: 'POST', body: JSON.stringify({ email: $('#email').value, password: $('#password').value }) }); state.user = data.user; state.csrf = data.csrf; setAppLoading(true); await loadState(); } catch (error) { setAppLoading(false); dom.loginError.textContent = error.message; } });
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
    if (!/\.(xlsx|xls)$/i.test(file.name)) return toast('Please drop an Excel file (.xlsx or .xls).');
    try {
      await parseWorkbook(file);
    } catch (error) {
      toast(error.message);
    }
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
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      dom.fileInput.value = '';
      return toast('Please select a valid Excel file (.xlsx or .xls).');
    }
    try {
      await parseWorkbook(file);
    } catch (error) {
      toast(error.message);
    } finally {
      dom.fileInput.value = '';
    }
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

    if (state.active) {
      if (isAll) state.active.adjustment = value;
      state.active.categoryAdjustments = { ...state.categoryAdjustments };
      state.active.isDraft = true;
      await setDraft(draftKey(), state.active);
      loadActive(state.active);
    } else {
      updateMetrics();
      renderTable();
    }
    setPriceEditor(false);

    const sign = value > 0 ? '+' : '';
    let affectedProducts = 0;
    allCategories.forEach(c => {
      if (selectedAdjustmentCategories.has(c.name)) affectedProducts += c.count;
    });

    toast(`Applied ${sign}${value}% adjustment to ${selectedCats.length} category/categories & draft saved.`);
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
    const cat = String(state.category || '').trim();
    dom.percentage.value = getCategoryAdjustment(cat);
    updateMetrics();
    renderTable();
  });
  $('#saveButton').addEventListener('click', event => {
    event.stopPropagation();
    if (!state.canEdit) return toast('You do not have permission to save versions.');
    if (!state.active) return toast('Please upload or open a price list first before saving.');
    dom.versionNameInput.value = state.active.name || '';
    renderSaveSummary();
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
      return toast('Please enter a version name.');
    }
    dom.saveDialog.close();
    try {
      await save(name);
    } catch (error) {
      toast(error.message);
    }
  });
  $('#excelButton').addEventListener('click', exportExcel); $('#pdfButton').addEventListener('click', exportPdf);
  function getInitialPanelId() {
    const hash = (location.hash || '').replace(/^#/, '').toLowerCase();
    if (hash === 'history' || hash === 'historypanel') return 'historyPanel';
    if (hash === 'settings' || hash === 'settingspanel') return 'settingsPanel';
    if (hash === 'prices' || hash === 'workspace' || hash === 'workspacepanel') return 'workspacePanel';
    try {
      const saved = localStorage.getItem('pla_active_panel');
      if (saved && ['workspacePanel', 'historyPanel', 'settingsPanel'].includes(saved)) {
        return saved;
      }
    } catch { }
    return 'workspacePanel';
  }

  function switchPanel(panelId, updateHash = true) {
    let targetButton = $$('.nav-item').find(btn => btn.dataset.panel === panelId);
    if (!targetButton || (targetButton.classList.contains('admin-only') && state.user?.role !== 'admin')) {
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
    document.querySelector('.content')?.classList.toggle('history-active', finalPanelId === 'historyPanel');

    if (finalPanelId === 'settingsPanel') renderImageSettings();
    if (finalPanelId === 'historyPanel') renderHistory();

    try {
      localStorage.setItem('pla_active_panel', finalPanelId);
    } catch { }

    if (updateHash) {
      const hashMap = {
        workspacePanel: 'prices',
        historyPanel: 'history',
        settingsPanel: 'settings'
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
        const data = await api('open', { method: 'POST', body: JSON.stringify({ id: openButton.dataset.id }) });
        await removeDraft(draftKey());
        loadActive(data.active);
        $$('.nav-item')[0].click();
        toast('Saved version opened without changing history.');
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

  $('#confirmDelete').addEventListener('click', async event => { event.preventDefault(); if (!state.pendingDelete) return; const button = event.currentTarget; button.disabled = true; try { const data = await api('delete-version', { method: 'POST', body: JSON.stringify({ id: state.pendingDelete }) }); state.pendingDelete = null; dom.deleteDialog.close(); await loadState(); toast(data.message); } catch (error) { toast(error.message); } finally { button.disabled = false; } });

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
      state.pendingImageGroup = {
        category: chooseButton.dataset.category || '',
        groupName: chooseButton.dataset.group || '',
        button: chooseButton
      };
      dom.groupImageInput.value = '';
      dom.groupImageInput.click();
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
  $$('.audit-tab-btn').forEach(btn => {
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
      const res = await api('get-audit-logs');
      if (res.ok && Array.isArray(res.auditLogs)) {
        state.auditLogs = res.auditLogs;
        renderNotifications();
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
    switchPanel('historyPanel', true);
  });
  dom.notificationsList?.addEventListener('click', event => {
    const item = event.target.closest('.notification-item');
    if (item) {
      toggleNotifications(false);
      switchPanel('historyPanel', true);
      const logId = item.dataset.id;
      if (logId) {
        const log = (state.auditLogs || []).find(l => String(l.id) === String(logId));
        if (log) {
          showAuditLogModal(log);
        }
      }
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
          const data = await api('open', { method: 'POST', body: JSON.stringify({ id: versionId }) });
          await removeDraft(draftKey());
          loadActive(data.active);
          switchPanel('workspacePanel', true);
          toast('Saved version opened in workspace.');
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
    state.adjustment = 0;
    state.categoryAdjustments = {};
    if (state.active) {
      state.active.adjustment = 0;
      state.active.categoryAdjustments = {};
      state.active.isDraft = true;
      await setDraft(draftKey(), state.active);
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
      if (!state.canEdit) return;
      state.pendingImageGroup = {
        category: chooseButton.dataset.category || '',
        groupName: chooseButton.dataset.group || '',
        button: chooseButton
      };
      dom.groupImageInput.value = '';
      dom.groupImageInput.click();
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
    const fileToParse = stagedUploadFile;
    closeUploadModal();
    try {
      await parseWorkbook(fileToParse);
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

  function getLastReadTimestamp() {
    try {
      return Number(localStorage.getItem('pla_last_read_audit_ts') || '0');
    } catch {
      return 0;
    }
  }

  function setLastReadTimestamp(ts = Date.now()) {
    try {
      localStorage.setItem('pla_last_read_audit_ts', String(ts));
    } catch { }
  }

  function renderNotifications() {
    const logs = state.auditLogs || [];
    const lastReadTs = getLastReadTimestamp();
    let unreadCount = 0;

    logs.forEach(log => {
      const logTs = new Date(log.timestamp || 0).getTime();
      if (logTs > lastReadTs) unreadCount++;
    });

    if (dom.notificationBadge) {
      if (unreadCount > 0) {
        dom.notificationBadge.hidden = false;
        dom.notificationBadge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
      } else {
        dom.notificationBadge.hidden = true;
      }
    }

    if (dom.notificationsCountBadge) {
      dom.notificationsCountBadge.textContent = `${logs.length} ${logs.length === 1 ? 'item' : 'items'}`;
    }

    if (!dom.notificationsList) return;

    if (!logs.length) {
      dom.notificationsList.innerHTML = '';
      if (dom.notificationsEmpty) dom.notificationsEmpty.hidden = false;
      return;
    }

    if (dom.notificationsEmpty) dom.notificationsEmpty.hidden = true;

    dom.notificationsList.innerHTML = logs.map(log => {
      const logTs = new Date(log.timestamp || 0).getTime();
      const isUnread = logTs > lastReadTs;
      const type = escapeHtml(log.type || 'info');
      const icon = getAuditTypeIcon(log.type);
      const actor = escapeHtml(log.actor || log.user || 'User');
      const time = formatRelativeTime(log.timestamp);
      const title = escapeHtml(log.title || 'Price List Activity');
      const details = log.details ? `<div class="notification-details-text">${escapeHtml(log.details)}</div>` : '';
      const fileName = getLogFileName(log);
      const isCurrent = isLogCurrentFile(log);
      const fileBadge = isCurrent
        ? '<span class="notification-file-tag">Current file</span>'
        : (fileName ? `<span class="notification-file-tag" title="${escapeHtml(fileName)}">${escapeHtml(fileName.length > 22 ? fileName.slice(0, 20) + '…' : fileName)}</span>` : '');

      return `
        <div class="notification-item ${isUnread ? 'is-unread' : ''}" data-type="${type}" data-id="${escapeHtml(log.id || '')}">
          <div class="notification-icon-wrap" aria-hidden="true">
            ${icon}
          </div>
          <div class="notification-content">
            <div class="notification-row-top">
              <span class="notification-actor">${actor}</span>
              ${fileBadge}
              <time class="notification-time" datetime="${escapeHtml(log.timestamp || '')}">${time}</time>
            </div>
            <div class="notification-title-text">${title}</div>
            ${details}
          </div>
        </div>`;
    }).join('');
  }

  async function logActivity(type, title, details = '', metadata = {}) {
    if (!state.user) return;
    const currentFileName = state.active?.name || state.pending?.name || 'Current file';
    const payloadMeta = {
      fileName: metadata.fileName || currentFileName,
      ...metadata
    };
    try {
      const res = await api('log-activity', {
        method: 'POST',
        body: JSON.stringify({ type, title, details, metadata: payloadMeta })
      });
      if (res.ok && res.auditLogs) {
        state.auditLogs = res.auditLogs;
        renderNotifications();
        if ($('#historyPanel') && !$('#historyPanel').hidden) {
          renderHistory();
        }
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
    if (shouldOpen) {
      setLastReadTimestamp();
      renderNotifications();
    }
  }

  dom.notificationBtn?.addEventListener('click', event => {
    event.stopPropagation();
    toggleNotifications();
  });

  dom.notificationsDropdown?.addEventListener('click', event => {
    event.stopPropagation();
  });

  dom.markAllReadBtn?.addEventListener('click', event => {
    event.stopPropagation();
    setLastReadTimestamp();
    renderNotifications();
    toast('All notifications marked as read.');
  });

  dom.clearLogsBtn?.addEventListener('click', async event => {
    event.stopPropagation();
    if (state.user?.role !== 'admin') return;
    if (!confirm('Are you sure you want to clear all audit logs? This action cannot be undone.')) return;
    try {
      await api('clear-audit-logs', { method: 'POST' });
      state.auditLogs = [];
      setLastReadTimestamp();
      renderNotifications();
      toast('Audit logs cleared.');
    } catch (err) {
      toast(err.message || 'Failed to clear logs.');
    }
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

  window.addEventListener('focus', async () => {
    if (state.user && !document.hidden) {
      try {
        const res = await api('get-audit-logs');
        if (res.ok && Array.isArray(res.auditLogs)) {
          state.auditLogs = res.auditLogs;
          renderNotifications();
        }
      } catch { }
    }
  });

  setInterval(async () => {
    if (state.user && !document.hidden) {
      try {
        const res = await api('get-audit-logs');
        if (res.ok && Array.isArray(res.auditLogs)) {
          state.auditLogs = res.auditLogs;
          renderNotifications();
        }
      } catch { }
    }
  }, 25000);

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
