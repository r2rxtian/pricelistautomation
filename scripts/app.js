(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { user: window.__BOOT__.user, csrf: window.__BOOT__.csrf, permissions: [], canEdit: false, active: null, rows: [], headers: [], priceColumns: [], adjustment: 0, categoryAdjustments: {}, search: '', category: '', codeFilter: '', priceLevelFilter: '', countryFilter: '', pending: null, pendingDelete: null, pendingDecision: null, versions: [], directory: [], approvers: [], approvalMode: 'any', notifications: [], unreadCount: 0, productImages: [], imageCategory: '', imageSearch: '', pendingImageGroup: null, pendingImageDelete: null, activeCell: { rowIdx: null, colIdx: null, td: null }, isEditing: false, auditLogs: [], auditTab: 'all', auditSearch: '', auditFile: '', auditType: '', auditUser: '', auditPage: 1, historyPage: 1, historyPageSize: 10, listTab: 'all', listSearch: '', listPriceLevel: '', listCountry: '', listStatus: '', photoLibrary: [], photoFolders: [], libraryFolder: null, configTab: rememberedConfigTab(), librarySearch: '' };
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
  // The Config tab (photo library, product type photos, search keywords) also survives a refresh.
  const CONFIG_TAB_KEY = 'pla_config_tab';
  function rememberedConfigTab() {
    try { const tab = sessionStorage.getItem('pla_config_tab'); return ['library', 'types', 'lists'].includes(tab) ? tab : 'library'; } catch { return 'library'; }
  }
  const money = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  let suppressRowEnter = false; // set while a price roll re-renders the table (see rollPrices)
  const dom = {
    appView: $('#appView'), userName: $('#userName'), roleBadge: $('#roleBadge'), emptyState: $('#emptyState'), dataView: $('#dataView'), listTitle: $('#listTitle'), listMeta: $('#listMeta'), savedMeta: $('#savedMeta'), savedMetaRow: $('#savedMetaRow'), activeBadge: $('#activeBadge'), productCount: $('#productCount'), categoryCount: $('#categoryCount'), priceColumnCount: $('#priceColumnCount'), currentAdjustment: $('#currentAdjustment'), percentage: $('#percentage'), applyAllCategoriesButton: $('#applyAllCategoriesButton'), search: $('#searchInput'), category: $('#categorySelect'), table: $('#priceTable'), noResults: $('#noResults'), saveDialog: $('#saveDialog'), saveForm: $('#saveForm'), versionNameInput: $('#versionNameInput'), deleteDialog: $('#deleteDialog'), deleteVersionName: $('#deleteVersionName'), resetPricesDialog: $('#resetPricesDialog'), resetPricesForm: $('#resetPricesForm'), confirmResetPrices: $('#confirmResetPrices'), resetPricesButton: $('#resetPricesButton'), logoutDialog: $('#logoutDialog'), logoutForm: $('#logoutForm'), historyTable: $('#historyTable'), historyTableBody: $('#historyTableBody'), historyEmpty: $('#historyEmpty'), historyCount: $('#historyCount'), historySearchInput: $('#historySearchInput'), historyAdjustmentSelect: $('#historyAdjustmentSelect'), emptyGoToPricesBtn: $('#emptyGoToPricesBtn'), toast: $('#toast'), fileInput: $('#fileInput'), settingsNav: $('#settingsNav'), settingsPanel: $('#settingsPanel'), imageCategoryFilter: $('#imageCategoryFilter'), imageSearchInput: $('#imageSearchInput'), imageSettingsList: $('#imageSettingsList'), imageSettingsEmpty: $('#imageSettingsEmpty'), imageSettingsCount: $('#imageSettingsCount'), groupImageInput: $('#groupImageInput'), deleteImageDialog: $('#deleteImageDialog'), deleteImageForm: $('#deleteImageForm'), deleteImageName: $('#deleteImageName'), addRowBtn: $('#addRowBtn'), excelFormulaBar: $('#excelFormulaBar'), formulaCellIndicator: $('#formulaCellIndicator'), formulaInput: $('#formulaInput'), formulaCancelBtn: $('#formulaCancelBtn'), formulaConfirmBtn: $('#formulaConfirmBtn'), deleteRowDialog: $('#deleteRowDialog'), deleteRowForm: $('#deleteRowForm'), deleteRowProductName: $('#deleteRowProductName'), confirmDeleteRow: $('#confirmDeleteRow'),
    auditLogsNav: $('#auditLogsNav'), openAuditLogsFromBell: $('#openAuditLogsFromBell'), auditAllCountBadge: $('#auditAllCountBadge'), auditEditsCountBadge: $('#auditEditsCountBadge'), auditVersionsCountBadge: $('#auditVersionsCountBadge'), auditFileSelect: $('#auditFileSelect'), auditFileSelectWrapper: $('#auditFileSelectWrapper'), auditTypeSelect: $('#auditTypeSelect'), auditTypeSelectWrapper: $('#auditTypeSelectWrapper'), auditUserSelect: $('#auditUserSelect'), auditUserSelectWrapper: $('#auditUserSelectWrapper'), historyAdjustmentSelectWrapper: $('#historyAdjustmentSelectWrapper'), refreshAuditLogsBtn: $('#refreshAuditLogsBtn'), auditTableHead: $('#auditTableHead'), versionsTableHead: $('#versionsTableHead'), historyEmptyTitle: $('#historyEmptyTitle'), historyEmptySubtitle: $('#historyEmptySubtitle'), historyChangesKicker: $('#historyChangesKicker'), historyChangesActions: $('#historyChangesActions'),
    notificationBtn: $('#notificationBtn'), notificationBadge: $('#notificationBadge'), notificationsDropdown: $('#notificationsDropdown'), notificationsList: $('#notificationsList'), notificationsEmpty: $('#notificationsEmpty'), notificationsCountBadge: $('#notificationsCountBadge'), markAllReadBtn: $('#markAllReadBtn'), clearLogsBtn: $('#clearLogsBtn'),
    uploadModal: $('#uploadModal'), closeUploadModalBtn: $('#closeUploadModalBtn'), cancelUploadBtn: $('#cancelUploadBtn'), submitUploadBtn: $('#submitUploadBtn'), downloadTemplateBtn: $('#downloadTemplateBtn'), modalDropZone: $('#modalDropZone'), modalFileInput: $('#modalFileInput'), browseFileBtn: $('#browseFileBtn'), dropZonePrompt: $('#dropZonePrompt'), selectedFileInfo: $('#selectedFileInfo'), selectedFileName: $('#selectedFileName'), selectedFileSize: $('#selectedFileSize'), removeSelectedFileBtn: $('#removeSelectedFileBtn'),
    codeFilterInput: $('#codeFilterInput'), codeFilterOptions: $('#codeFilterOptions'), priceLevelSelect: $('#priceLevelSelect'), countrySelect: $('#countrySelect'), clearFiltersBtn: $('#clearFiltersBtn'), exportLockNote: $('#exportLockNote'),
    listTagsRow: $('#listTagsRow'), listPriceLevel: $('#listPriceLevel'), listCountry: $('#listCountry'),
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
      summary.textContent = selectedCount ? `${scope} · ${products}` : 'Choose categories to adjust';
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
    'open': 'versions/open', 'save': 'versions/save', 'check-workbook': 'versions/check', 'approve': 'versions/approve', 'reject': 'versions/reject',
    'export': 'versions/export', 'delete-version': 'versions/delete',
    'audit-logs': 'audit/list', 'log-activity': 'audit/log_activity',
    'notifications': 'notifications/list', 'notifications-read': 'notifications/mark_read',
    'library-upload': 'photos/library_upload', 'library-delete': 'photos/library_delete',
    'library-folder': 'photos/library_folder', 'library-move': 'photos/library_move', 'library-rename': 'photos/library_rename',
    'search-keywords': 'search/keywords_save', 'list-options': 'config/list_options_save',
    'users-list': 'users/list', 'users-create': 'users/create', 'users-update': 'users/update',
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
    if (!response.ok || !data.ok) {
      const error = new Error(data.message || 'Request failed.');
      if (Array.isArray(data.problems)) error.problems = data.problems; // e.g. every issue in a rejected workbook
      throw error;
    }
    return data;
  }
  /** Stored file paths (storage/…) are relative to the project root; this page lives in pages/. */
  function mediaUrl(path) {
    const value = String(path || '');
    return !value || /^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(value) ? value : `../${value}`;
  }
  function toast(message) { dom.toast.classList.remove('is-trash'); dom.toast.textContent = message; dom.toast.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => dom.toast.classList.remove('show'), 2600); }
  // --- Deleting: the thing crumples into a paper ball and is tossed into a little bin in the toast,
  // whose lid flips open to catch it and snaps shut. Quick, never in the way, off with reduced motion.
  /** Takes a picture of an element about to be deleted (call before it is re-rendered away). */
  function snapForTrash(el) {
    if (!el?.isConnected || reducedMotion()) return null;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > innerHeight) return null;
    const node = el.cloneNode(true);
    node.removeAttribute('id');
    node.querySelectorAll('[id]').forEach(child => child.removeAttribute('id'));
    return { node, rect, radius: getComputedStyle(el).borderRadius };
  }
  const BIN_ICON = '<span class="toast-bin" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><g class="bin-lid"><line x1="3" y1="6" x2="21" y2="6"/><path d="M9 6V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6"/></g><path d="M19 6l-1 13.5A2 2 0 0 1 16 21.5H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></span>';
  /** A toast with a bin; when given a snap (from snapForTrash), the item is tossed into it. */
  function trashToast(message, snap = null) {
    toast(message);
    dom.toast.insertAdjacentHTML('afterbegin', BIN_ICON);
    dom.toast.classList.add('is-trash');
    if (reducedMotion()) return;
    const bin = dom.toast.querySelector('.toast-bin');
    const lid = bin.querySelector('.bin-lid');
    const flick = (el, frames, options) => { try { return el.animate(frames, options); } catch { return null; } };
    if (!snap) { // nothing to throw: the lid just flips
      flick(lid, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-32deg) translateY(-1px)', offset: 0.4 }, { transform: 'rotate(0deg)' }], { duration: 520, delay: 250, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
      return;
    }
    // Where the bin will be once the toast has settled (offsets ignore its entrance transform).
    const toX = dom.toast.offsetLeft + bin.offsetLeft + bin.offsetWidth / 2;
    const toY = dom.toast.offsetTop + bin.offsetTop + bin.offsetHeight / 2 - 2;
    const { node, rect } = snap;
    const ghost = document.createElement('div');
    ghost.className = 'trash-ghost';
    Object.assign(ghost.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, borderRadius: snap.radius || '10px' });
    Object.assign(node.style, { margin: '0', width: '100%', height: '100%', transform: 'none', translate: 'none', rotate: 'none', scale: 'none', animation: 'none', pointerEvents: 'none' });
    ghost.append(node);
    document.body.append(ghost);
    const ball = 22;
    const sx = ball / rect.width, sy = ball / rect.height;
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const dx = toX - cx, dy = toY - cy;
    const lift = Math.min(160, Math.max(70, Math.abs(dx) * 0.25)); // a little arc over to the bin
    const at = (x, y, scaleX, scaleY, turn) => `translate(${x}px, ${y}px) scale(${scaleX}, ${scaleY}) rotate(${turn}deg)`;
    const flight = flick(ghost, [
      { transform: at(0, 0, 1, 1, 0), borderRadius: snap.radius || '10px', offset: 0 },
      { transform: at(0, -6, 1.02, 1.02, -2), offset: 0.1, easing: 'cubic-bezier(0.5, 0, 0.75, 0)' },
      { transform: at(0, 0, sx, sy, -40), borderRadius: '50%', offset: 0.34, easing: 'cubic-bezier(0.33, 0, 0.67, 0.4)' },
      { transform: at(dx * 0.55, Math.min(0, dy) * 0.55 - lift, sx, sy, 160), borderRadius: '50%', offset: 0.7, easing: 'cubic-bezier(0.33, 0.6, 0.67, 1)' },
      { transform: at(dx, dy, sx * 0.55, sy * 0.55, 320), borderRadius: '50%', opacity: 1, offset: 0.97 },
      { transform: at(dx, dy + 4, sx * 0.4, sy * 0.4, 330), borderRadius: '50%', opacity: 0, offset: 1 },
    ], { duration: 900, fill: 'forwards' });
    // The crumple: a paper-ball texture fades in as it shrinks.
    flick(ghost, [{ opacity: 0 }, { opacity: 0, offset: 0.12 }, { opacity: 1, offset: 0.34 }, { opacity: 1 }], { duration: 900, fill: 'forwards', pseudoElement: '::after' });
    // The lid opens as the ball comes over and snaps shut when it lands; the bin gives a tiny jolt.
    flick(lid, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-38deg) translateY(-1px)', offset: 0.3 }, { transform: 'rotate(-38deg) translateY(-1px)', offset: 0.72 }, { transform: 'rotate(4deg)', offset: 0.86 }, { transform: 'rotate(0deg)' }], { duration: 640, delay: 430, easing: 'ease-out' });
    flick(bin, [{ transform: 'none' }, { transform: 'translateY(1.5px) rotate(-7deg)', offset: 0.35 }, { transform: 'rotate(5deg)', offset: 0.65 }, { transform: 'none' }], { duration: 380, delay: 880, easing: 'ease-out' });
    const done = () => ghost.remove();
    flight ? flight.finished.then(done, done) : done();
    setTimeout(done, 1400);
  }
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

  /** A price list's identity (name + country + price level): stays the same across its versions. */
  const tabKeyOf = list => (list ? [list.name, list.country, list.priceLevel].map(part => String(part || '').trim().toLowerCase()).join('|') : '');
  /** Each open price list (tab) keeps its own unsaved draft, so switching tabs never loses changes. */
  const draftKey = (list = state.active) => (state.user ? `draft_${state.user.username}_${tabKeyOf(list) || 'current'}` : 'draft_current');
  const legacyDraftKey = () => (state.user ? `draft_${state.user.username}` : 'draft_current'); // the one draft of earlier builds
  async function clearAllDrafts() {
    try {
      const db = await openDraftDb();
      if (!db) return false;
      return new Promise(resolve => {
        const tx = db.transaction('drafts', 'readwrite');
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.objectStore('drafts').clear();
      });
    } catch {
      return false;
    }
  }

  function applyPermissions() {
    $$('.edit-only').forEach(element => element.hidden = !can('update'));
    $$('.admin-only').forEach(element => element.hidden = !can('manageImages'));
    ['update', 'approve', 'viewAudit', 'manageImages', 'upload', 'manageUsers'].forEach(permission => {
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
    const exportWrap = $('.export-menu-wrap');
    if (exportWrap) exportWrap.hidden = !can('export');
    if (!state.active) closeExportMenu();
    const closeButton = $('#closeFileBtn');
    if (closeButton) closeButton.hidden = !state.active;
    renderTabs();
    renderNavigator();
  }
  // --- Open price lists as tabs (a strip under the top bar), like browser tabs. Each tab is one price
  // list (name + country + price level) and remembers the version it shows; unsaved changes stay in
  // that list's own draft. The tabs are remembered per user, so they survive a refresh. ---
  let openTabs = [];
  const tabsStorageKey = () => `pla_tabs_${state.user?.username || 'user'}`;
  function loadTabs() {
    try { openTabs = JSON.parse(localStorage.getItem(tabsStorageKey()) || '[]').filter(tab => tab && tab.key); } catch { openTabs = []; }
  }
  function saveTabs() {
    try { localStorage.setItem(tabsStorageKey(), JSON.stringify(openTabs.map(({ key, id, name, country, priceLevel, dirty }) => ({ key, id, name, country, priceLevel, dirty })))); } catch { }
  }
  /** Adds the list as a tab (or refreshes its tab: a save makes a new version). */
  function upsertTab(list, { quiet = false } = {}) {
    const key = tabKeyOf(list);
    if (!key) return;
    let tab = openTabs.find(item => item.key === key);
    if (!tab) { tab = { key }; openTabs.push(tab); }
    Object.assign(tab, { id: list.id || tab.id || '', name: list.name, country: list.country, priceLevel: list.priceLevel, dirty: Boolean(list.isDraft) });
    saveTabs();
    if (!quiet) renderTabs();
  }
  /** The version a tab should open: its own, or the list's current revision if that one was replaced. */
  function tabTargetId(tab) {
    const own = versionSummaryById(tab.id);
    if (own && own.status !== 'superseded') return own.id;
    const sameList = (state.versions || []).filter(version => tabKeyOf(version) === tab.key);
    return (liveRevisionOf(own || sameList[0] || {}) || sameList.find(version => version.status === 'pending') || own || {}).id || tab.id;
  }
  const TAB_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
  function tabInnerMarkup(tab) {
    const name = escapeHtml(tab.name || 'Price list');
    return `<button type="button" class="file-tab-open" role="tab">
        <span class="country-flag" aria-hidden="true">${flagMarkup(tab.country, countryCodeOf(tab.country))}</span>
        <span class="file-tab-name">${name}</span>
        <span class="file-tab-meta">${escapeHtml([tab.country, tab.priceLevel].filter(Boolean).join(' · '))}</span>
        <span class="file-tab-return" aria-hidden="true">Back to editor<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg></span>
      </button>
      <span class="file-tab-dot" aria-hidden="true"></span>
      <button type="button" class="file-tab-close" aria-label="Close ${name}" title="Close"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
  }
  /**
   * Draws the tab strip by updating the tabs already there (so colours ease instead of flashing),
   * popping new tabs in and shrinking closed ones away. A pink underline glides to the tab shown
   * in the editor.
   */
  function renderTabs() {
    const bar = $('#fileTabs');
    const list = bar?.querySelector('.file-tabs-list');
    if (!list) return;
    const activeKey = state.active ? tabKeyOf(state.active) : '';
    // One file is open at a time, so the bar holds just that file (with its unsaved dot).
    openTabs = state.active ? [{ key: activeKey, id: state.active.id || '', name: state.active.name, country: state.active.country, priceLevel: state.active.priceLevel, dirty: Boolean(state.active.isDraft) }] : [];
    saveTabs();
    const inEditor = !$('#workspacePanel')?.hidden;
    bar.hidden = !openTabs.length;
    document.body.classList.toggle('has-file-tabs', openTabs.length > 0);
    const animate = state.booted && !reducedMotion();
    let indicator = list.querySelector('.file-tab-indicator');
    if (!indicator) {
      indicator = document.createElement('span');
      indicator.className = 'file-tab-indicator';
      indicator.setAttribute('aria-hidden', 'true');
      list.append(indicator);
    }
    const existing = new Map([...list.querySelectorAll('.file-tab:not(.is-leaving)')].map(el => [el.dataset.tab, el]));
    // The bar shows one file: a different file takes over the same tab (its contents cross-fade).
    if (openTabs.length === 1 && !existing.has(openTabs[0].key) && existing.size === 1) {
      const [[oldKey, el]] = [...existing];
      existing.delete(oldKey);
      el.dataset.tab = openTabs[0].key;
      existing.set(openTabs[0].key, el);
    }
    openTabs.forEach((tab, index) => {
      let el = existing.get(tab.key);
      const signature = [tab.name, tab.country, tab.priceLevel].join('|');
      if (!el) {
        el = document.createElement('div');
        el.className = 'file-tab';
        el.dataset.tab = tab.key;
        el.innerHTML = tabInnerMarkup(tab);
        el.dataset.signature = signature;
        list.insertBefore(el, list.querySelectorAll('.file-tab:not(.is-leaving)')[index] || indicator);
        if (animate) el.animate([{ opacity: 0, maxWidth: '0px', minWidth: '0px', transform: 'translateY(8px)' }, { opacity: 1, maxWidth: '236px', minWidth: '140px', transform: 'none' }], { duration: 420, easing: TAB_EASE });
      } else {
        existing.delete(tab.key);
        if (el.dataset.signature !== signature) {
          el.innerHTML = tabInnerMarkup(tab);
          el.dataset.signature = signature;
          if (animate) [...el.children].forEach((child, i) => child.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: i * 40, easing: TAB_EASE, fill: 'backwards' }));
        }
      }
      const current = tab.key === activeKey;
      el.classList.toggle('is-current', current);
      el.classList.toggle('is-active', current && inEditor);
      el.classList.toggle('is-dirty', Boolean(tab.dirty));
      const open = el.querySelector('.file-tab-open');
      open.setAttribute('aria-selected', String(current && inEditor));
      open.title = `${[tab.name, tab.country, tab.priceLevel].filter(Boolean).join(' · ')}${tab.dirty ? ' · unsaved changes' : ''}`;
    });
    // Closed tabs shrink away.
    existing.forEach(el => {
      if (!animate) return el.remove();
      el.classList.add('is-leaving');
      const out = el.animate([{ opacity: 1, maxWidth: `${el.offsetWidth}px`, minWidth: '0px' }, { opacity: 0, maxWidth: '0px', minWidth: '0px', paddingLeft: '0px', paddingRight: '0px' }], { duration: 260, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' });
      const gone = () => { el.remove(); placeTabIndicator(false); };
      out.finished.then(gone, () => { });
      setTimeout(() => el.isConnected && gone(), 420);
    });
    requestAnimationFrame(() => placeTabIndicator(animate));
    list.querySelector('.file-tab.is-current')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: animate ? 'smooth' : 'auto' });
  }
  /** The pink underline under the tab shown in the editor; it glides from tab to tab. */
  let tabIndicatorBox = null;
  function placeTabIndicator(glide = true) {
    const list = $('#fileTabs .file-tabs-list');
    const indicator = list?.querySelector('.file-tab-indicator');
    if (!indicator) return;
    const active = list.querySelector('.file-tab.is-active');
    if (!active) { indicator.style.opacity = '0'; tabIndicatorBox = null; return; }
    const box = { x: active.offsetLeft + 12, w: Math.max(0, active.offsetWidth - 24) };
    const frame = b => ({ transform: `translateX(${b.x}px)`, width: `${b.w}px` });
    const from = tabIndicatorBox;
    Object.assign(indicator.style, frame(box), { opacity: '1' });
    tabIndicatorBox = box;
    if (glide && from && (from.x !== box.x || from.w !== box.w) && !reducedMotion()) {
      const anim = indicator.animate([frame(from), frame(box)], { duration: 460, easing: TAB_EASE });
      setTimeout(() => { if (anim.playState === 'running') anim.finish(); }, 700);
    }
  }
  window.addEventListener('resize', () => placeTabIndicator(false));
  /**
   * Closes a tab. Unsaved changes ask first. Closing the list that is open moves to its neighbour
   * (like a browser); with no tabs left, the editor goes back to Files.
   */
  async function closeTab(key) {
    const index = openTabs.findIndex(tab => tab.key === key);
    const tab = openTabs[index];
    const isOpen = Boolean(state.active && tabKeyOf(state.active) === key);
    if (!tab && !isOpen) return false;
    const name = tab?.name || state.active?.name || 'this price list';
    let discarded = null;
    if (isOpen) {
      if (state.active.isDraft && !(await confirmDiscardDraft(`Closing ${name}`))) return false;
      if (state.active.isDraft) discarded = state.active;
      if (state.isEditing && state.activeCell.td) cancelCellEdit(state.activeCell.td);
      setPriceEditor(false);
    } else if (can('update')) {
      const draft = await getDraft(draftKey(tab));
      if (tab.dirty || draft) {
        if (!(await confirmDiscardDraft(`Closing ${name}`))) return false;
        discarded = draft;
      }
    }
    logDiscardedChanges(discarded);
    if (can('update')) await removeDraft(draftKey(isOpen ? state.active : tab));
    if (index >= 0) openTabs.splice(index, 1);
    saveTabs();
    if (!isOpen) { renderTabs(); toast(`Closed ${name}.`); return true; }
    const next = openTabs[index] || openTabs[index - 1];
    const inEditor = !$('#workspacePanel')?.hidden;
    if (next) {
      try {
        if (inEditor) await switchToTab(next); else await openVersion(tabTargetId(next), { silent: true, stay: true });
        toast(`Closed ${name}.`);
        return true;
      } catch { /* the neighbour could not be opened: fall back to closing everything below */ }
    }
    resetFilters();
    state.category = '';
    state.categoryChosen = false;
    rememberCategory('');
    state.rows = []; state.headers = []; state.priceColumns = [];
    state.adjustment = 0; state.categoryAdjustments = {};
    const leaving = await foldAwayOpenFile();
    loadActive(null); // with no list open, this goes back to Files
    leaving.forEach(animation => animation.cancel()); // the hidden parts must not stay faded for the next file
    renderLists();
    renderFiles();
    renderTabs();
    toast(`Closed ${name}.`);
    return true;
  }
  /** "Close file" in the editor = closing the open list's tab. */
  function closeActiveFile() {
    return state.active ? closeTab(tabKeyOf(state.active)) : Promise.resolve(false);
  }
  $('#fileTabs')?.addEventListener('click', async event => {
    const tabEl = event.target.closest('.file-tab');
    if (!tabEl) return;
    const key = tabEl.dataset.tab;
    if (event.target.closest('.file-tab-close')) return closeTab(key);
    if (state.active && tabKeyOf(state.active) === key) return switchPanel('workspacePanel', true);
    const tab = openTabs.find(item => item.key === key);
    if (!tab) return;
    try { await switchToTab(tab); } catch (error) { toast(error.message); }
  });
  /**
   * Switching tabs while in the editor: the list you leave slides out toward its tab's side while
   * the next one loads, then the next list slides in from the other side (no row-by-row replay).
   */
  let tabSwitching = 0;
  async function switchToTab(tab) {
    const id = tabTargetId(tab);
    const inEditor = !$('#workspacePanel')?.hidden;
    if (!inEditor || reducedMotion()) return openVersion(id, { silent: true });
    const turn = ++tabSwitching;
    const keys = openTabs.map(item => item.key);
    const direction = keys.indexOf(tab.key) >= keys.indexOf(tabKeyOf(state.active)) ? 1 : -1;
    const parts = [$('#workspacePanel .page-heading'), dom.dataView].filter(el => el && !el.hidden);
    parts.forEach(el => el.getAnimations().forEach(anim => anim.id === 'tab-swap' && anim.cancel()));
    const out = parts.map(el => {
      const anim = el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translate3d(${-22 * direction}px, 0, 0)` }], { duration: 170, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' });
      anim.id = 'tab-swap';
      return anim;
    });
    const hasDraft = can('update') && Boolean((await getDraft(draftKey(tab)))?.rows?.length);
    const [preloaded] = await Promise.all([
      hasDraft ? null : fetchVersion(id).catch(() => null),
      Promise.race([Promise.all(out.map(anim => anim.finished.catch(() => { }))), new Promise(resolve => setTimeout(resolve, 260))]),
    ]);
    if (turn !== tabSwitching) return; // another tab was clicked meanwhile
    suppressRowEnter = true; // the whole list slides in, so its rows don't replay their own entrance
    try {
      await openVersion(id, { silent: true, preloaded });
    } finally {
      suppressRowEnter = false;
      out.forEach(anim => anim.cancel());
    }
    parts.forEach((el, index) => {
      const anim = el.animate([{ opacity: 0, transform: `translate3d(${26 * direction}px, 0, 0)` }, { opacity: 1, transform: 'translate3d(0, 0, 0)' }], { duration: 440, delay: index * 50, easing: TAB_EASE, fill: 'backwards' });
      anim.id = 'tab-swap';
      setTimeout(() => { if (anim.playState === 'running') anim.finish(); }, 700);
    });
  }
  // Middle-click closes a tab, as in a browser.
  $('#fileTabs')?.addEventListener('auxclick', event => {
    const tabEl = event.button === 1 && event.target.closest('.file-tab');
    if (tabEl) { event.preventDefault(); closeTab(tabEl.dataset.tab); }
  });
  /**
   * Closing a file: the table card shrinks back toward the "Close file" button and fades while the
   * file's actions and stats slide away. Resolves once that has played (at most ~0.4 s).
   */
  async function foldAwayOpenFile() {
    if (reducedMotion() || dom.dataView.hidden) return [];
    const card = dom.dataView;
    const box = card.getBoundingClientRect();
    const button = $('#closeFileBtn')?.getBoundingClientRect();
    const origin = button ? `${Math.round(button.left + button.width / 2 - box.left)}px ${Math.round(button.top + button.height / 2 - box.top)}px` : 'top left';
    const ease = 'cubic-bezier(0.4, 0, 0.9, 0.6)';
    const animations = [
      card.animate([{ opacity: 1, transform: 'none', transformOrigin: origin }, { opacity: 0, transform: 'scale(0.9)', transformOrigin: origin }], { duration: 300, easing: ease, fill: 'forwards' }),
      ...[$('#cloverActions'), $('#metricGroup'), dom.listTagsRow, dom.savedMetaRow].filter(el => el && !el.hidden).map((el, index) =>
        el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-6px)' }], { duration: 220, delay: index * 30, easing: ease, fill: 'forwards' })),
    ];
    await Promise.race([Promise.all(animations.map(animation => animation.finished.catch(() => { }))), new Promise(resolve => setTimeout(resolve, 420))]);
    return animations;
  }
  function userName(username) {
    return state.directory.find(entry => entry.username === username)?.name || username || '';
  }
  function statusLabel(status) {
    return { uploaded: 'Uploaded', pending: 'Pending approval', approved: 'Approved', rejected: 'Rejected', superseded: 'Older version', draft: 'Draft (unsaved)' }[status] || 'Draft (unsaved)';
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
    const named = (state.priceLevels || []).find(level => level.toLowerCase() === String(value || '').trim().toLowerCase());
    if (named) return named;
    const match = String(value || '').match(/^\s*(?:price\s*level|level|pl|lvl)?\s*#?\s*(\d{1,3})\s*$/i);
    const level = match ? `Price Level ${Number(match[1])}` : '';
    return (state.priceLevels || []).includes(level) ? level : '';
  }
  function priceLevelOptionsHtml(selected, placeholder = 'Select level…') {
    const current = canonicalPriceLevel(selected) || String(selected || '').trim();
    const list = state.priceLevels || [];
    const extra = current && !list.includes(current) ? [current] : [];
    return `<option value="">${escapeHtml(placeholder)}</option>`
      + [...extra, ...list].map(level => `<option value="${escapeHtml(level)}"${level === current ? ' selected' : ''}>${escapeHtml(level)}${extra.includes(level) ? ' (switched off)' : ''}</option>`).join('');
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
  }
  function setPriceEditor(open) {
    const button = $('#editButton');
    const popover = $('#adjustmentBar');
    if (!button || !popover) return;
    popover.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('data-tooltip', open ? 'Close editor' : 'Edit prices');
    button.title = open ? 'Close editor' : (button.dataset.adjustTitle || 'Edit prices');
    if (open) {
      // The table panel clips overflow, so the popover is placed (fixed) right under the toolbar button.
      const rect = button.getBoundingClientRect();
      popover.style.position = 'fixed';
      popover.style.top = `${Math.round(rect.bottom + 8)}px`;
      popover.style.right = `${Math.max(16, Math.round(window.innerWidth - rect.right))}px`;
      // Nothing is pre-selected: choose the categories to adjust (or tick "All categories").
      selectedAdjustmentCategories.clear();
      dom.percentage.value = 0;
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
      searchKeywords: data.searchKeywords || [],
      listOptions: data.listOptions || null, priceLevelInfo: data.priceLevelInfo || [],
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
      toast(`Opened the current version of ${live.name}.`);
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
    loadTabs();
    // The single draft of earlier builds moves under its list's own key (one draft per tab now).
    let legacyDraft = null;
    if (can('update')) {
      legacyDraft = await getDraft(legacyDraftKey());
      if (legacyDraft?.rows?.length) { await setDraft(draftKey(legacyDraft), legacyDraft); await removeDraft(legacyDraftKey()); upsertTab(legacyDraft, { quiet: true }); }
      else legacyDraft = null;
    }
    // files.php?list=<id> opens that list; otherwise the one open last time.
    const fromUrl = urlListId();
    const rememberedId = (fromUrl && fromUrl !== 'open' && versionSummaryById(fromUrl) ? fromUrl : '') || rememberedVersionId();
    let remembered = rememberedId ? versionSummaryById(rememberedId) : null;
    // Reopen the current revision rather than one that has since been replaced.
    if (remembered?.status === 'superseded') remembered = liveRevisionOf(remembered) || remembered;
    const rememberedList = remembered || legacyDraft;
    if (!skipDraftCheck && can('update') && rememberedList) {
      const draft = await getDraft(draftKey(rememberedList)); // its unsaved changes, if any
      if (draft?.rows?.length) { targetActive = draft; isRestoredDraft = true; }
    }
    if (!targetActive && remembered) {
      try { targetActive = (await api('open', { method: 'POST', body: JSON.stringify({ id: remembered.id }) })).active; } catch { targetActive = null; }
    }
    showApp(); fillDatalists(); loadActive(targetActive); renderLists(); renderFiles(); renderHistory(); renderImageSettings(); renderNotifications();
    renderTabs();
    switchPanel(getInitialPanelId(), true); // after the list is loaded, so a ?list= address can open the editor
    state.booted = true;
    setAppLoading(false);
    if (isRestoredDraft) toast('Restored your unsaved draft.');
  }
  /**
   * Opens a price list in the editor (as its tab). Other lists keep their unsaved changes in their own
   * tabs; opening a list that has unsaved changes brings them back. Only opening a different version
   * of the list you are editing would replace its changes, so that asks first.
   */
  async function openVersion(id, { silent = false, stay = false, preloaded = null } = {}) {
    const summary = versionSummaryById(id);
    const sameList = Boolean(summary && state.active && tabKeyOf(summary) === tabKeyOf(state.active));
    if (sameList && String(state.active.id || '') === String(id)) {
      if (!stay) switchPanel('workspacePanel', true); // already open (with any unsaved changes): just show it
      return state.active;
    }
    // One file is open at a time: opening another one replaces it, so its unsaved changes are asked about first.
    if (state.active?.isDraft) {
      if (!silent && !(await confirmDiscardDraft(sameList ? 'Opening another version of this price list' : 'Opening another price list'))) return null;
      logDiscardedChanges(state.active);
      if (can('update')) await removeDraft(draftKey());
    }
    let active = null;
    if (summary && can('update') && !sameList) {
      const draft = await getDraft(draftKey(summary));
      if (draft?.rows?.length) active = draft;
    }
    const restored = Boolean(active);
    // (A copy of a version fetched ahead, e.g. while the tab switch slides out: opening changes it.)
    if (!active) active = preloaded ? structuredClone(preloaded) : (await api('open', { method: 'POST', body: JSON.stringify({ id }) })).active;
    loadActive(active);
    if (!stay) switchPanel('workspacePanel', true);
    if (!silent) toast(restored ? `Opened ${active.name} with your unsaved changes.` : `Opened ${active.name}.`);
    return active;
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
      loadChangeMarks(null);
      // No list open: the editor has nothing to show, so Files takes over (where lists are opened).
      if (state.booted && !$('#workspacePanel')?.hidden) switchPanel('filesPanel', true);
      const canUpload = can('upload');
      dom.listTitle.textContent = canUpload ? 'Start with a workbook' : 'Open an approved price list';
      dom.listMeta.textContent = canUpload ? 'Upload an official .xlsx template to open and edit prices.' : 'Choose an approved price list to view and export.';
      if (dom.emptyStateTitle) dom.emptyStateTitle.textContent = canUpload ? 'Import your current price list' : 'No price list open';
      if (dom.emptyStateText) dom.emptyStateText.textContent = canUpload ? 'Drop an official .xlsx workbook here or browse your computer. Download the template from the upload window.' : 'Price lists are on the Files page, where you can open or export them.';
      if (dom.emptyBrowseListsButton) dom.emptyBrowseListsButton.hidden = canUpload;
      dom.listMeta.title = '';
      setSavedMeta(''); dom.activeBadge.hidden = true;
      $('#editButton').classList.add('is-disabled');
      $('#editButton').setAttribute('aria-disabled', 'true');
      $('#saveButton').classList.add('is-disabled');
      $('#saveButton').classList.remove('has-unsaved');
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
    // Opening a saved list: its prices (with any approved % already applied) simply become the current
    // prices, shown without a "+10%". A new % then applies on top of them, so +5% means 5% more than
    // now, not "+5% instead of +10%". Saves say so (adjustBase: 'current'). Unsaved drafts keep theirs.
    if (!active.isDraft) {
      foldAdjustments(state.rows, active, state.priceColumns);
      active.adjustment = 0;
      active.categoryAdjustments = {};
      active.pricesBaked = true;
      // How the list looks as opened, so undoing every change (or "Reset prices") is not an unsaved edit.
      openedSnapshot = { id: active.id, rows: JSON.stringify(state.rows) };
    } else if (active.id && active.pricesBaked && openedSnapshot?.id !== active.id) {
      // A draft restored after a refresh: rebuild the opened state from the saved version.
      openedSnapshot = null;
      fetchVersion(active.id).then(saved => {
        if (!saved || state.active !== active) return;
        const rows = normalizeRows(saved.rows || [], saved.priceLevel, saved.country);
        const headers = normalizeHeaders(saved.headers);
        foldAdjustments(rows, saved, (saved.priceColumns || []).filter(index => /price\s*\/\s*(pc|box)/i.test(String(headers[index] || ''))));
        openedSnapshot = { id: active.id, rows: JSON.stringify(rows) };
      }).catch(() => {});
    }
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
    dom.listTitle.title = ''; // the switcher's tooltip shows the full Country › Level › List path
    dom.listMeta.title = active.name;
    $('#workspacePanel')?.classList.add('has-file');
    if (dom.listTagsRow) {
      dom.listTagsRow.hidden = false;
      dom.listPriceLevel.textContent = active.priceLevel || 'Not set';
      dom.listCountry.textContent = active.country || 'Not set';
    }
    if (!active.isDraft && active.id) rememberOpenVersion(active.id);
    // In the editor, the address follows the open list (a save makes a new version).
    if (state.booted && !$('#workspacePanel')?.hidden && active.id) {
      history.replaceState({ panel: 'workspacePanel' }, '', `files.php?list=${encodeURIComponent(active.id)}`);
      document.title = `${active.name} · ${APP_TITLE}`;
    }

    $('#saveButton').classList.toggle('is-disabled', !canEdit);
    $('#saveButton').setAttribute('aria-disabled', String(!canEdit));
    renderWorkflowState();
    updateMetrics(); renderTable(); renderImageSettings();
    loadChangeMarks(active);
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
    // An approved or freshly uploaded list is the normal state, so the header stays quiet: who saved
    // or approved it, and what changed, are in Files, the notifications and Audit Logs. A status shows
    // only when it needs attention (unsaved, waiting for approval, rejected, replaced).
    const settled = status === 'approved' || status === 'uploaded';
    dom.activeBadge.hidden = settled;

    if (settled) {
      setSavedMeta('');
    } else if (status === 'draft') {
      const edits = (active.pendingChanges || []).length;
      setSavedMeta(active.id ? `Unsaved edits to the version saved by ${active.savedBy || 'a user'}${edits ? ` · ${edits} cell edit${edits === 1 ? '' : 's'}` : ''}` : 'Imported workbook · Unsaved');
    } else {
      // One plain sentence after the status badge: who saved it and when.
      setSavedMeta(active.savedAt ? `Saved by ${active.savedBy || 'a user'} · ${displayDate(active.savedAt)}` : 'Saved');
    }

    // A coloured note after the sentence only when something needs attention (pending, rejected, older).
    renderTabs(); // the unsaved dot on the list's tab
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
      } else if (status === 'rejected') {
        text = `Rejected by ${active.rejectedBy || 'an approver'}${active.rejectionRemarks ? `: ${active.rejectionRemarks}` : ''}`;
      } else if (status === 'superseded') {
        text = 'A newer version of this price list has been approved';
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
      : status === 'superseded' ? 'A newer version is available' : '';
    // Export: one button with an Excel / PDF menu. Locked, it shows a padlock and stays clickable so
    // a click can explain why (the padlock wiggles).
    const reason = lockReason || 'Only approved price lists can be exported';
    ['#exportMenuBtn', '#excelButton', '#pdfButton'].forEach(selector => {
      const button = $(selector);
      if (!button) return;
      button.disabled = false;
      button.classList.toggle('is-locked', !exportable);
      button.setAttribute('aria-disabled', String(!exportable));
      button.dataset.lockReason = exportable ? '' : reason;
    });
    $('#exportMenuBtn')?.setAttribute('aria-label', exportable ? 'Export this price list' : `Export (locked: ${reason})`);
    const exportWrap = $('.export-menu-wrap');
    if (exportWrap) {
      exportWrap.classList.toggle('is-locked', !exportable);
      exportWrap.dataset.tooltip = reason;
    }
    if (!exportable) closeExportMenu();
    // Save: "Save changes" with a dot while there are unsaved changes, a quiet "Saved" otherwise.
    const saveButton = $('#saveButton');
    if (saveButton) {
      const unsaved = status === 'draft';
      saveButton.classList.toggle('has-unsaved', unsaved);
      saveButton.classList.toggle('is-clean', !unsaved);
      if (!saveButton.dataset.saveState) saveButton.querySelector('.save-label').textContent = unsaved ? 'Save changes' : 'Saved';
      saveButton.setAttribute('aria-label', unsaved ? 'Save changes (Ctrl+S), unsaved changes' : 'Saved, no unsaved changes');
    }
    if (dom.exportLockNote) {
      dom.exportLockNote.hidden = exportable || !can('export');
      dom.exportLockNote.textContent = lockReason;
    }
  }

  /** Applies a version's % adjustments to its price cells (rows are changed in place). */
  function foldAdjustments(rows, version, priceColumns) {
    const rateFor = category => Number(version.categoryAdjustments?.[String(category ?? '').trim()] ?? version.adjustment ?? 0) || 0;
    rows.forEach(row => {
      const rate = rateFor(row[COL.category]);
      if (!rate) return;
      priceColumns.forEach(col => {
        if (isNumeric(row[col])) row[col] = Math.max(0, Math.round(numeric(row[col]) * (1 + rate / 100) * 10000) / 10000);
      });
    });
  }
  let openedSnapshot = null; // { id, rows } of the list as it was opened
  /** True when the open list is exactly as it was opened: same cells, no % adjustment. */
  function matchesOpenedList() {
    return Boolean(state.active?.id && openedSnapshot && openedSnapshot.id === state.active.id && !hasPriceAdjustments() && JSON.stringify(state.rows) === openedSnapshot.rows);
  }
  /** Marks the open list as an unsaved draft and stores it locally (or clears it when nothing differs any more). */
  function markDraft() {
    if (!state.active) return;
    state.active.rows = state.rows;
    state.active.categoryAdjustments = { ...state.categoryAdjustments };
    state.active.adjustment = state.adjustment;
    if (matchesOpenedList()) {
      // Every change was undone (or "Reset prices" brought it back): nothing to save.
      state.active.isDraft = false;
      state.active.pendingChanges = [];
      removeDraft(draftKey());
      renderWorkflowState();
      return;
    }
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
    // The current adjustment shows on "Edit prices": one percentage when every category has the
    // same, "mixed" when they differ (hover lists each category), nothing at original prices.
    const tag = $('#editAdjustment');
    if (tag) {
      const categories = [...new Set(state.rows.map(row => String(row[COL.category] ?? '').trim()).filter(Boolean))];
      const rates = categories.map(category => ({ category, rate: Number(getCategoryAdjustment(category) || 0) }));
      const distinct = [...new Set(rates.map(item => item.rate))];
      const format = rate => `${rate > 0 ? '+' : ''}${rate}%`;
      tag.hidden = !rates.length || (distinct.length === 1 && distinct[0] === 0);
      tag.textContent = distinct.length === 1 ? format(distinct[0]) : 'mixed';
      tag.classList.toggle('is-down', distinct.length === 1 && distinct[0] < 0);
      const editButton = $('#editButton');
      editButton.dataset.adjustTitle = tag.hidden ? 'Adjust prices by category' : `Current adjustments: ${rates.map(item => `${item.category} ${format(item.rate)}`).join(', ')}`;
      if (editButton.getAttribute('aria-expanded') !== 'true') editButton.title = editButton.dataset.adjustTitle;
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
    const code = state.codeFilter.trim().toLowerCase();
    const base = state.rows.map((row, index) => ({ row, index })).filter(({ row }) =>
      (!state.category || String(row[COL.category] ?? '') === state.category) &&
      (!code || String(row[COL.code] ?? '').toLowerCase().includes(code)) &&
      (!state.priceLevelFilter || String(row[COL.priceLevel] ?? '') === state.priceLevelFilter) &&
      (!state.countryFilter || String(row[COL.country] ?? '') === state.countryFilter));
    const tokens = normalizeSearch(state.search).split(' ').filter(Boolean);
    if (!tokens.length) return base;
    // Smart search: every typed word must match. When some rows match clearly (keyword, word start,
    // text, initials), loose "letters in order" matches are left out so the clear ones stand alone.
    const scored = base.map(item => ({ item, score: rowSearchScore(item.row, tokens) })).filter(entry => entry.score > 0);
    const clear = scored.some(entry => entry.score >= SEARCH_CLEAR_MATCH);
    return scored.filter(entry => !clear || entry.score >= SEARCH_CLEAR_MATCH).map(entry => entry.item);
  }

  // --- Smart search -------------------------------------------------------------------------
  // Works for every product automatically (also newly uploaded ones), from the code, name,
  // category and product group, plus the admins' search keywords (Config › Search keywords) for
  // the product group or code. Scores per typed word:
  //   100 exact keyword or code · 80 start of a word / keyword · 60 text anywhere (codes, prices…)
  //    50 first letters ("pac" → Pain Au Chocolat) · 30 letters in order within a word ("ct" → croissant)
  const SEARCH_CLEAR_MATCH = 50;
  function normalizeSearch(text) {
    return String(text ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9.]+/g, ' ').trim();
  }
  let searchKeywordCache = { source: null, map: new Map(), version: 0 };
  function refreshSearchKeywords() {
    if (searchKeywordCache.source !== state.searchKeywords) {
      const map = new Map();
      (state.searchKeywords || []).forEach(entry => {
        const key = entry.scope === 'product' ? `p|${normalizeSearch(entry.code)}` : `g|${normalizeSearch(entry.category)}|${normalizeSearch(entry.group)}`;
        map.set(key, (entry.keywords || []).map(normalizeSearch).filter(Boolean));
      });
      searchKeywordCache = { source: state.searchKeywords, map, version: searchKeywordCache.version + 1 };
    }
  }
  function searchKeywordsFor(row) {
    const groupName = row[18] || row[COL.category];
    return [
      ...(searchKeywordCache.map.get(`g|${normalizeSearch(row[COL.category])}|${normalizeSearch(groupName)}`) || []),
      ...(searchKeywordCache.map.get(`p|${normalizeSearch(row[COL.code])}`) || []),
    ];
  }
  const searchIndexCache = new WeakMap();
  function searchIndex(row) {
    refreshSearchKeywords();
    const signature = `${row.join('\u0001')}\u0002${searchKeywordCache.version}`;
    const cached = searchIndexCache.get(row);
    if (cached && cached.signature === signature) return cached.index;
    const named = [row[COL.description], row[3], row[18], row[COL.category]].map(normalizeSearch).filter(Boolean);
    const code = normalizeSearch(row[COL.code]);
    const words = [...new Set([...named.join(' ').split(' '), ...code.split(' ')].filter(Boolean))];
    const index = {
      code,
      codeCompact: code.replace(/ /g, ''),
      keywords: searchKeywordsFor(row),
      words,
      initials: named.map(text => text.split(' ').map(word => word[0]).join('')),
      all: row.map(normalizeSearch).join(' '),
    };
    searchIndexCache.set(row, { signature, index });
    return index;
  }
  function inOrder(token, word) {
    let at = 0;
    for (const letter of word) if (letter === token[at] && ++at === token.length) return true;
    return false;
  }
  function tokenScore(token, index) {
    if (index.keywords.includes(token) || index.code === token || index.codeCompact === token) return 100;
    if (index.keywords.some(keyword => keyword.startsWith(token)) || index.words.some(word => word.startsWith(token)) || index.codeCompact.startsWith(token)) return 80;
    if (index.all.includes(token)) return 60;
    if (token.length >= 2 && index.initials.some(initials => initials.startsWith(token))) return 50;
    if (token.length >= 2 && /[a-z]/.test(token) && index.words.some(word => word[0] === token[0] && inOrder(token, word))) return 30;
    return 0;
  }
  /** The row's weakest word score (0 when some typed word doesn't match at all). */
  function rowSearchScore(row, tokens) {
    const index = searchIndex(row);
    let score = 100;
    for (const token of tokens) {
      score = Math.min(score, tokenScore(token, index));
      if (!score) return 0;
    }
    return score;
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
    // How many product types (in every category) have a photo, as a small ring beside the count.
    const withPhoto = groups.filter(group => imageOverride(group.category, group.groupName)?.imagePath).length;
    if (groups.length) {
      const share = withPhoto / groups.length;
      dom.imageSettingsCount.innerHTML = `<span class="plate-progress" title="${withPhoto} of ${groups.length} product types have a photo"><svg viewBox="0 0 36 36" width="22" height="22" aria-hidden="true"><circle cx="18" cy="18" r="15" class="plate-progress-track"/><circle cx="18" cy="18" r="15" class="plate-progress-fill" style="stroke-dasharray: ${(share * 94.25).toFixed(2)} 94.25"/></svg><span><strong>${withPhoto} of ${groups.length}</strong> have a photo</span></span>`;
    }
    // Each product type is a card with its photo served on a round plate; no photo = an empty dashed plate.
    dom.imageSettingsList.innerHTML = visible.map(group => {
      const custom = imageOverride(group.category, group.groupName);
      const name = escapeHtml(group.groupName);
      const chooseData = `data-category="${escapeHtml(group.category)}" data-group="${name}"`;
      return `<article class="plate-card ${custom?.imagePath ? 'has-photo' : 'is-empty'}" data-key="type-${escapeHtml(group.category)}|${name}">
        <button type="button" class="plate choose-group-image" ${chooseData} aria-label="${custom ? 'Change' : 'Choose'} photo for ${name}" title="${custom ? 'Change photo' : 'Choose a photo from the library'}">
          ${custom?.imagePath ? `<img src="${escapeHtml(mediaUrl(custom.imagePath))}" alt="" loading="lazy">` : '<span class="plate-empty" aria-hidden="true"><span>+</span>Choose photo</span>'}
        </button>
        <span class="plate-category">${escapeHtml(group.category)}</span>
        <strong class="plate-name" title="${name}">${name}</strong>
        <small class="plate-meta">${group.productCount} product${group.productCount === 1 ? '' : 's'}${custom ? ` · ${escapeHtml(libraryPhotoName(custom.libraryId) || 'custom photo')}` : ''}</small>
        ${custom ? `<div class="plate-actions"><button type="button" class="button secondary choose-group-image" ${chooseData}>Change</button><button type="button" class="option-icon danger delete-group-image" data-key="${escapeHtml(custom.key)}" data-name="${name}" aria-label="Remove photo for ${name}" title="Remove photo">×</button></div>` : ''}
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
      const formatPallet = palletMarkup;
      const photoCell = isFirstInGroup
        ? `<td class="group-photo-cell" rowspan="${groupLength}"><div class="group-photo-wrap">${groupVisual(category, groupName, groupItems)}</div></td>`
        : '';
      return `<tr class="excel-data-row" data-row="${actualIndex}" data-key="row-${actualIndex}" style="--row-delay:${Math.min(visibleIndex, 8) * 18}ms">
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
      return `<tr class="excel-data-row presentation-row" data-row="${actualIndex}" data-key="row-${actualIndex}" style="--row-delay:${Math.min(visibleIndex, 8) * 18}ms">
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
    // Both layouts use 13 columns. Fixed proportions that add up to 100% keep the table exactly
    // as wide as its frame, so no column is ever pushed past the right edge. Row number, photo,
    // code and description get the room their content needs; the other nine columns (expiry,
    // weight, pcs/box, box size, both prices, the three pallets) share the rest equally.
    if (!dom.table.querySelector('colgroup')) {
      const fixed = [2.6, 9, 8.5, 17];
      const even = (100 - fixed.reduce((sum, width) => sum + width, 0)) / 9;
      const widths = [...fixed, ...Array(9).fill(Math.floor(even * 1000) / 1000)];
      dom.table.insertAdjacentHTML('afterbegin', `<colgroup>${widths.map(width => `<col style="width:${width}%">`).join('')}</colgroup>`);
    }
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
        ? `<tr class="product-group-row"><td colspan="${columnCount}" class="group-title-cell"><strong class="group-title-text">${escapeHtml(group.groupName)}</strong>${groupKeywordsMarkup(group.category, group.groupName)}</td></tr>`
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
    // "6 products", or "2 of 6 products" while searching or filtering.
    const countNote = $('#productCountNote');
    if (countNote) {
      const total = state.rows.length;
      countNote.textContent = visible.length === total ? `${total.toLocaleString()} product${total === 1 ? '' : 's'}` : `${visible.length.toLocaleString()} of ${total.toLocaleString()} products`;
      countNote.classList.toggle('is-filtered', visible.length !== total);
    }
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
    // The rows were just replaced: forget the old hover so the next mouse move draws it fresh.
    hoveredCell = null;
    applyChangeMarks(); // a change under review shows what it changed ("was 1.25")
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
    if (colIdx === 10 || colIdx === 11 || colIdx === 12) return palletMarkup(raw);
    return escapeHtml(raw).replace(/\r?\n/g, '<br>');
  }

  /**
   * A pallet cell: "120" or "120 Boxes/Pallet" shows as the number with a small unit underneath
   * (it fits its column); any other text is shown as typed. Used by the table and by cell edits.
   */
  function palletMarkup(value) {
    const s = String(value ?? '').trim();
    if (!s) return '';
    const match = s.match(/^([\d.,]+)\s*(?:boxes?\s*\/\s*pallets?)?$/i);
    if (match) return `<span class="pallet-qty">${escapeHtml(match[1])}</span><span class="pallet-unit">boxes / pallet</span>`;
    return escapeHtml(s).replace(/\r?\n/g, '<br>');
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
  /**
   * The block a row belongs to: the data rows under one header (the table header, or a repeated
   * header such as Presentation Stands' own layout) and that header's rows. Column highlights stay
   * inside the block, so they always sit under the header they belong to.
   */
  function headerBlock(tr) {
    const isHeader = row => row.classList.contains('excel-header');
    const rows = [];
    let header = [];
    let row = tr;
    while (row && !isHeader(row)) { if (row.classList.contains('excel-data-row')) rows.unshift(row); row = row.previousElementSibling; }
    while (row && isHeader(row)) { header.unshift(row); row = row.previousElementSibling; }
    if (!header.length) header = [...(dom.table.tHead?.rows || [])];
    for (row = tr.nextElementSibling; row && !isHeader(row); row = row.nextElementSibling) {
      if (row.classList.contains('excel-data-row')) rows.push(row);
    }
    return { rows, header };
  }
  /** A column's letter and named header cells (e.g. "PRICE/PC USD") within one header, found by where its letter sits. */
  function headerCells(headerRows, position) {
    const letter = headerRows.map(row => row.querySelector(`th[data-col-letter="${position}"]`)).find(Boolean);
    if (!letter) return [];
    const box = letter.getBoundingClientRect();
    const middle = (box.left + box.right) / 2;
    const named = headerRows.filter(row => !row.classList.contains('col-letter-row')).flatMap(row => [...row.children]).filter(th => {
      if (th.colSpan > 1) return false;
      const rect = th.getBoundingClientRect();
      return rect.left <= middle && middle <= rect.right;
    });
    return [letter, ...named];
  }
  /** Hover: only the cell under the pointer lights up (no row or column tint). */
  let hoveredCell = null;
  function setCellHover(td) {
    if (td === hoveredCell && td?.classList.contains('is-cell-hover')) return;
    hoveredCell?.classList.remove('is-cell-hover');
    hoveredCell = td;
    td?.classList.add('is-cell-hover');
  }
  dom.table?.addEventListener('mouseover', event => setCellHover(event.target.closest('#priceTable tbody .excel-cell')));
  const clearTableHover = () => setCellHover(null);
  dom.table?.addEventListener('mouseleave', clearTableHover);
  // Safety nets: the browser can miss the table's mouseleave (a popup opening over it, the window
  // losing focus, fast moves), so any pointer outside the table also clears the tint.
  document.addEventListener('pointerover', event => {
    if (hoveredCell && !dom.table?.contains(event.target)) clearTableHover();
  }, { passive: true });
  window.addEventListener('blur', clearTableHover);
  document.addEventListener('mouseleave', clearTableHover);
  /** Highlights the active cell's column letter and header, and its row number, like Excel's headings. */
  function highlightCellGuides(td) {
    $$('#priceTable .is-guide-active').forEach(el => el.classList.remove('is-guide-active'));
    if (!td) return;
    const { position } = cellReference(td, 0, 0);
    if (position >= 0) headerCells(headerBlock(td.closest('tr')).header, position).forEach(th => th.classList.add('is-guide-active'));
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
        if (state.active.isDraft) { // still different from the list as opened
          state.active.pendingChanges.push(change);
          setDraft(draftKey(), state.active);
        }
        renderWorkflowState(); // not logged here: the save records every edit, so unsaved edits never reach the audit log
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
      case 'discard_changes': return 'Not Saved';
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
    if (['import_workbook', 'approve_version', 'reject_version', 'delete_version', 'discard_changes'].includes(type)) return 'details';
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
          <span class="history-adj-pill ${pct > 0 ? 'has-adj pos' : pct < 0 ? 'has-adj neg' : 'neutral'}">
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

  /** A log title without the status tacked on ("Saved 'X' (approved)" → "Saved “X”" + approved). */
  function cleanLogTitle(log) {
    let text = String(log.title || getAuditTypeLabel(log.type));
    let status = '';
    if (/\s*\(approved\)\s*$/i.test(text)) { status = 'approved'; text = text.replace(/\s*\(approved\)\s*$/i, ''); }
    else if (/\s+for approval\s*$/i.test(text)) { status = 'pending'; text = text.replace(/\s+for approval\s*$/i, ''); }
    else if (/\s*\(partial\)\s*$/i.test(text)) { status = 'partial'; text = text.replace(/\s*\(partial\)\s*$/i, ''); }
    return { text: text.replace(/'([^']+)'/g, (_, name) => `“${name}”`), status };
  }

  /**
   * One audit event, laid out like its logbook entry: who did what and when on top, the file it was
   * done to, then exactly what happened (for a saved version, every price before → after, as in the
   * approval review). Only the body scrolls.
   */
  let inspectingLogId = null;
  async function showAuditLogModal(log) {
    const dialog = $('#historyChangesDialog');
    const content = $('#historyChangesContent');
    const actions = $('#historyChangesActions');
    if (!dialog || !content) return;
    inspectingLogId = log.id;
    const logMeta = log.metadata || {};
    const version = logMeta.versionId ? versionSummaryById(logMeta.versionId) : null;
    const { text: titleText, status: titleStatus } = cleanLogTitle(log);
    const initials = String(log.actor || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    const role = String(log.role || 'user').toLowerCase() === 'admin' ? 'Admin' : 'Export only';

    dialog.dataset.type = log.type || 'info'; // colours the node like the logbook
    $('#auditEntryNode').innerHTML = getAuditTypeIcon(log.type);
    $('#historyChangesKicker').textContent = getAuditTypeLabel(log.type);
    $('#historyChangesTitle').textContent = titleText;
    $('#historyChangesMeta').innerHTML = `<span class="user-avatar log-avatar" aria-hidden="true">${escapeHtml(initials)}</span>
      <span><strong>${escapeHtml(log.actor || 'Someone')}</strong> · ${role}</span>
      <span class="audit-entry-when" title="${escapeHtml(displayDate(log.timestamp))}">${escapeHtml(displayDate(log.timestamp))} · ${escapeHtml(formatRelativeTime(log.timestamp))}</span>`;

    // The file it was done to: flag, name, country · price level, and its status at the time.
    const fileName = getLogFileName(log);
    const hasFile = fileName && !['—', 'Unknown file'].includes(fileName);
    const country = logMeta.country || version?.country || '';
    const level = logMeta.priceLevel || version?.priceLevel || '';
    const fileStatus = titleStatus === 'partial' ? '<span class="list-status-pill status-pending">Partly approved</span>'
      : titleStatus ? statusPill(titleStatus) : '';
    const fileStrip = hasFile ? `<div class="audit-entry-file">
        ${country ? `<span class="country-flag" aria-hidden="true">${flagMarkup(country, countryCodeOf(country))}</span>` : '<svg class="audit-entry-file-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>'}
        <span class="audit-entry-file-text"><strong>${escapeHtml(fileName)}</strong>${country || level ? `<small>${escapeHtml([country, level].filter(Boolean).join(' · '))}</small>` : ''}</span>
        ${fileStatus}${isLogCurrentFile(log) ? '<span class="audit-entry-open-now">Open now</span>' : ''}
      </div>` : '';

    const fact = (label, value) => `<div><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`;
    const facts = items => `<dl class="audit-facts">${items.filter(Boolean).join('')}</dl>`;
    const note = textValue => (textValue ? `<p class="audit-entry-note">${escapeHtml(textValue)}</p>` : '');
    const plural = (count, word) => `${Number(count || 0).toLocaleString()} ${word}${Number(count) === 1 ? '' : 's'}`;
    const pctChip = pct => `<span class="adj-chip ${pct > 0 ? 'up' : pct < 0 ? 'down' : ''}"><b>${pct > 0 ? '▲ +' : pct < 0 ? '▼ ' : ''}${pct}%</b></span>`;

    let body = '';
    let loadReview = null;
    if (log.type === 'cell_edit') {
      body = facts([
        fact('Product', `<strong>${escapeHtml(logMeta.productName || logMeta.product || 'Product')}</strong>${logMeta.productCode || logMeta.code ? ` <code>${escapeHtml(logMeta.productCode || logMeta.code)}</code>` : ''}`),
        fact('Column', escapeHtml(logMeta.column || 'Cell')),
        logMeta.category ? fact('Category', escapeHtml(logMeta.category)) : '',
      ]) + `<div class="audit-compare">
          <div class="audit-compare-side is-before"><span>Before</span><p>${escapeHtml(String(logMeta.oldValue ?? '') || '(empty)')}</p></div>
          <span class="audit-compare-arrow" aria-hidden="true">→</span>
          <div class="audit-compare-side is-after"><span>After</span><p>${escapeHtml(String(logMeta.newValue ?? '') || '(empty)')}</p></div>
        </div>`;
    } else if (log.type === 'price_adjust') {
      const pct = Number(logMeta.percentage || 0);
      const categories = Array.isArray(logMeta.categories) ? logMeta.categories : (logMeta.category ? [logMeta.category] : []);
      body = facts([
        fact('Change', pctChip(pct)),
        fact('Applied to', escapeHtml(logMeta.applyAll || logMeta.isAllCategories ? 'All categories' : logMeta.category || `${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}`)),
        fact('Products', plural(logMeta.adjustedProducts || logMeta.productCount, 'product')),
      ]) + (categories.length ? `<section class="review-section"><h3>Categories <small>${categories.length}</small></h3><div class="review-chips">${categories.map(name => `<span class="adj-chip">${escapeHtml(name)}</span>`).join('')}</div></section>` : '')
        + note('Made in the editor. It takes effect for everyone when the file is saved.');
    } else if (log.type === 'save_version') {
      const approvers = (logMeta.approvers || []).filter(Boolean);
      body = facts([
        fact('Approval', logMeta.autoApproved ? 'Approved on save (no approval needed)' : approvers.length ? `Sent to ${escapeHtml(approvers.join(' & '))}` : 'Sent for approval'),
        logMeta.revision ? fact('Revision', `#${escapeHtml(String(logMeta.revision))}`) : '',
      ]) + '<div class="audit-entry-review"><p class="review-loading">Comparing with the version before it…</p></div>';
      loadReview = async () => {
        const change = await fetchVersion(logMeta.versionId);
        const base = change?.basedOn ? await fetchVersion(change.basedOn).catch(() => null) : null;
        return reviewMarkup(change, compareVersions(change, base), base);
      };
    } else if (log.type === 'import_workbook') {
      body = facts([
        fact('Workbook', escapeHtml(logMeta.sourceFile || logMeta.fileName || 'Excel workbook')),
        fact('Products', plural(logMeta.rowCount || logMeta.productCount, 'product')),
        fact('Categories', escapeHtml(String(Number(logMeta.categoryCount || 0)))),
      ]) + note('Original prices from the uploaded workbook.');
    } else if (log.type === 'row_add' || log.type === 'row_delete') {
      body = facts([
        fact('Product', `<strong>${escapeHtml(logMeta.product || logMeta.productName || 'Product')}</strong>${logMeta.code || logMeta.productCode ? ` <code>${escapeHtml(logMeta.code || logMeta.productCode)}</code>` : ''}`),
        fact('Category', escapeHtml(logMeta.category || '—')),
      ]);
    } else if (log.type === 'reset_prices') {
      body = note('All price adjustments in the editor were cleared, back to the prices the file was opened with.');
    } else if (log.type === 'discard_changes') {
      const adjustments = (Array.isArray(logMeta.adjustments) ? logMeta.adjustments : []).filter(Boolean);
      body = facts([
        fact('Price adjustments', adjustments.length ? String(adjustments.length) : 'None'),
        fact('Cell edits', String(Number(logMeta.cellEdits || 0))),
      ]) + (adjustments.length ? `<section class="review-section"><h3>Adjustments not saved</h3><div class="review-chips">${adjustments.map(item => `<span class="adj-chip">${escapeHtml(item)}</span>`).join('')}</div></section>` : '')
        + note('These changes were thrown away without saving, so the price list did not change.');
    } else if (log.type === 'approve_version' || log.type === 'reject_version') {
      body = facts([
        fact('Decision', log.type === 'reject_version' ? statusPill('rejected') : titleStatus === 'partial' ? '<span class="list-status-pill status-pending">Partly approved</span>' : statusPill('approved')),
        logMeta.remarks ? fact('Remarks', `“${escapeHtml(logMeta.remarks)}”`) : '',
      ]) + note(log.details);
    } else {
      body = note(log.details || titleText);
    }

    content.innerHTML = fileStrip + body;
    content.scrollTop = 0;
    // Audit Logs is a record to read: files are opened from Files, not from here.
    if (actions) actions.innerHTML = '<button value="cancel" class="button secondary">Close</button>';
    if (!dialog.open) dialog.showModal();
    content.tabIndex = -1;
    content.focus({ preventScroll: true }); // not the × (it would show a focus ring on open)

    if (loadReview) {
      const slot = content.querySelector('.audit-entry-review');
      let markup;
      try {
        markup = await loadReview();
      } catch (error) {
        // The version is gone: what the log itself recorded is all there is.
        const items = (logMeta.adjustedCategories || []).filter(item => Number(item.adjustment));
        markup = `<p class="review-note">This version is no longer available, so prices can't be compared side by side.</p>`
          + (items.length ? `<section class="review-section"><h3>Category adjustments</h3><div class="review-chips">${items.map(item => `<span class="adj-chip ${item.adjustment > 0 ? 'up' : 'down'}">${escapeHtml(item.category)} <b>${item.adjustment > 0 ? '▲ +' : '▼ '}${item.adjustment}%</b></span>`).join('')}</div></section>` : '')
          + (logMeta.changeCount ? note(`${plural(logMeta.changeCount, 'cell edit')} were saved with it.`) : '');
      }
      if (inspectingLogId !== log.id || !slot.isConnected) return;
      growTo(slot, () => { slot.innerHTML = markup; });
    }
  }

  function renderHistory() {
    if (!dom.historyTableBody) return;

    // 1. Update tab count badges
    const allLogs = state.auditLogs || [];
    // (Edits are logged when saved, so there is no separate "edits" view; older edit entries show under All.)
    const editLogs = [];
    const workflowLogs = allLogs.filter(l => ['import_workbook', 'save_version', 'discard_changes', 'approve_version', 'reject_version', 'export_excel', 'export_pdf', 'delete_version'].includes(l.type));
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

    // Logbook: back-and-forth edits by one person on one file within 15 minutes fold into one
    // "editing session"; everything else is its own entry. Pages count entries.
    const EDIT_TYPES = ['price_adjust', 'reset_prices', 'cell_edit', 'row_add', 'row_delete'];
    const entries = [];
    filteredLogs.forEach(log => {
      const last = entries[entries.length - 1];
      const lastLog = last?.logs[last.logs.length - 1];
      const sameSession = last && EDIT_TYPES.includes(log.type) && EDIT_TYPES.includes(lastLog.type) &&
        log.actor === lastLog.actor && getLogFileName(log) === getLogFileName(lastLog) &&
        auditDayLabel(log.timestamp) === auditDayLabel(lastLog.timestamp) &&
        Math.abs(new Date(lastLog.timestamp) - new Date(log.timestamp)) <= 15 * 60000;
      if (sameSession) last.logs.push(log); else entries.push({ logs: [log] });
    });
    const { startIdx, endIdx } = updatePaginationControls(entries.length, state.historyPage, pageSize, 'entries', 'entry');
    const pageEntries = entries.slice(startIdx, endIdx);
    const dayCounts = new Map();
    entries.forEach(entry => { const day = auditDayLabel(entry.logs[0].timestamp); dayCounts.set(day, (dayCounts.get(day) || 0) + entry.logs.length); });
    const timeOf = iso => (iso ? new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso)) : '');
    const initialsOfActor = name => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    const fileChip = log => {
      const fileName = getLogFileName(log);
      if (['login', 'image_update', 'image_delete', 'user_access', 'list_options'].includes(log.type) || !fileName || fileName === 'Unknown file' || fileName === '—') return '';
      return `<span class="audit-file-tag" title="${escapeHtml(fileName)}"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg><span>${escapeHtml(fileName)}</span>${isLogCurrentFile(log) ? '<em>Open now</em>' : ''}</span>`;
    };
    /** One event as a timeline entry: time, a coloured node, and a short card with the sentence. */
    const entryMarkup = (log, { nested = false } = {}) => {
      const inspect = auditInspectKind(log.type);
      const role = String(log.role || 'user').toLowerCase();
      return `<li class="log-entry audit-event-row type-${escapeHtml(log.type || 'info')} ${inspect ? 'is-inspectable' : ''} ${nested ? 'is-nested' : ''}" ${nested ? '' : `data-key="log-${escapeHtml(log.id)}"`} ${inspect ? `data-log-id="${escapeHtml(log.id)}"` : ''}>
        <time class="log-time" datetime="${escapeHtml(log.timestamp || '')}" title="${escapeHtml(displayDate(log.timestamp))}">${escapeHtml(timeOf(log.timestamp))}</time>
        <span class="log-node" aria-hidden="true">${getAuditTypeIcon(log.type)}</span>
        <div class="log-card">
          <div class="log-head">
            ${nested ? '' : `<span class="user-avatar log-avatar" aria-hidden="true">${escapeHtml(initialsOfActor(log.actor))}</span>`}
            <p class="log-sentence">${nested ? '' : `<strong>${escapeHtml(log.actor || 'Someone')}</strong> · `}${escapeHtml(cleanLogTitle(log).text)}</p>
            <span class="log-type">${escapeHtml(getAuditTypeLabel(log.type))}</span>
          </div>
          ${log.details ? `<p class="log-details" title="${escapeHtml(log.details)}">${escapeHtml(log.details)}</p>` : ''}
          <div class="log-foot">
            ${nested ? '' : fileChip(log)}
            ${log.type === 'save_version' && cleanLogTitle(log).status ? statusPill(cleanLogTitle(log).status) : ''}
            <span class="log-change">${getAuditDiffMarkup(log).includes('audit-no-action') ? '' : getAuditDiffMarkup(log)}</span>
            ${nested ? '' : `<span class="log-ago">${escapeHtml(formatRelativeTime(log.timestamp))}${role === 'admin' ? '' : ' · Export only'}</span>`}
            ${inspect ? `<button type="button" class="history-view-changes-btn view-audit-diff-btn" data-log-id="${escapeHtml(log.id)}">${inspect === 'changes' ? 'View changes' : 'View details'} ›</button>` : ''}
          </div>
        </div>
      </li>`;
    };
    /** Several quick edits by one person on one file: one entry with a strip of the steps, expandable. */
    const sessionMarkup = logs => {
      const first = logs[logs.length - 1];
      const last = logs[0];
      const step = log => {
        const meta = log.metadata || {};
        if (log.type === 'price_adjust') { const pct = Number(meta.percentage || 0); return `<span class="log-step ${pct > 0 ? 'up' : 'down'}">${pct > 0 ? '▲ +' : '▼ '}${pct}%${meta.category ? ` ${escapeHtml(meta.category)}` : ''}</span>`; }
        if (log.type === 'reset_prices') return '<span class="log-step reset">↺ reset</span>';
        if (log.type === 'cell_edit') return `<span class="log-step edit">✎ ${escapeHtml(meta.column || 'cell')}</span>`;
        if (log.type === 'row_add') return '<span class="log-step up">+ product</span>';
        if (log.type === 'row_delete') return '<span class="log-step down">− product</span>';
        return `<span class="log-step">${escapeHtml(getAuditTypeLabel(log.type))}</span>`;
      };
      const span = timeOf(first.timestamp) === timeOf(last.timestamp) ? timeOf(last.timestamp) : `${timeOf(first.timestamp)}–${timeOf(last.timestamp)}`;
      return `<li class="log-entry log-session" data-key="session-${escapeHtml(last.id)}">
        <time class="log-time" title="${escapeHtml(displayDate(last.timestamp))}">${escapeHtml(timeOf(last.timestamp))}</time>
        <span class="log-node is-session" aria-hidden="true">${logs.length}</span>
        <div class="log-card">
          <div class="log-head">
            <span class="user-avatar log-avatar" aria-hidden="true">${escapeHtml(initialsOfActor(last.actor))}</span>
            <p class="log-sentence"><strong>${escapeHtml(last.actor || 'Someone')}</strong> · edited prices ${logs.length} times</p>
            <span class="log-type">Editing session</span>
          </div>
          <div class="log-steps">${[...logs].reverse().map(step).join('<span class="log-step-sep" aria-hidden="true">→</span>')}</div>
          <div class="log-foot">
            ${fileChip(last)}
            <span class="log-ago">${escapeHtml(span)} · ${escapeHtml(formatRelativeTime(last.timestamp))}</span>
            <button type="button" class="log-session-toggle" aria-expanded="false">Show each step <span aria-hidden="true">▾</span></button>
          </div>
          <ol class="log-session-items" hidden>${logs.map(log => entryMarkup(log, { nested: true })).join('')}</ol>
        </div>
      </li>`;
    };
    let previousDay = '';
    dom.historyTableBody.innerHTML = pageEntries.map(entry => {
      const day = auditDayLabel(entry.logs[0].timestamp);
      const header = day !== previousDay ? `${previousDay ? '</ol></section>' : ''}<section class="log-day"><h3 class="log-day-head" data-key="day-${escapeHtml(day)}"><span>${escapeHtml(day)}</span><small>${dayCounts.get(day)} event${dayCounts.get(day) === 1 ? '' : 's'}</small></h3><ol class="log-list">` : '';
      previousDay = day;
      return header + (entry.logs.length > 1 ? sessionMarkup(entry.logs) : entryMarkup(entry.logs[0]));
    }).join('') + (pageEntries.length ? '</ol></section>' : '');
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
        + files.map(version => option(version.id, `${version.name}${box.dataset.cascade === 'empty' ? ` · ${statusLabel(version.status)}` : ''}`)).join('')
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
    // One row per file: its latest upload, acting on the price list's current prices. Saved and
    // approved price changes update the file (they don't make it "older").
    const listKey = v => [v.name, v.country, v.priceLevel].map(part => String(part || '').trim().toLowerCase()).join('|');
    const latest = new Map();
    (state.versions || []).filter(version => version.source === 'upload').forEach(version => {
      const key = listKey(version);
      if (!latest.has(key) || (version.revision || 0) > (latest.get(key).revision || 0)) latest.set(key, version);
    });
    // Export-only users only receive live lists, so a list whose upload was replaced by an approved
    // change has no upload here: its live version stands in as the file.
    (state.versions || []).filter(version => ['approved', 'uploaded'].includes(version.status)).forEach(version => {
      if (!latest.has(listKey(version))) latest.set(listKey(version), version);
    });
    const files = [...latest.values()];
    filesView.country = fillSelect($('#filesCountryFilter'), uniqueValues(files.map(v => v.country)), 'All countries', filesView.country);
    filesView.level = fillSelect($('#filesLevelFilter'), uniqueValues(files.map(v => v.priceLevel)), 'All price levels', filesView.level);
    const query = filesView.search.trim().toLowerCase();
    const visible = files.filter(version =>
      (!filesView.country || version.country === filesView.country) &&
      (!filesView.level || version.priceLevel === filesView.level) &&
      (!query || [version.name, version.savedBy, version.country, version.priceLevel].some(value => String(value || '').toLowerCase().includes(query))));
    $('#filesCount').textContent = `${visible.length} file${visible.length === 1 ? '' : 's'}`;
    const filtering = Boolean(query || filesView.country || filesView.level);
    const showUpload = can('upload') && !filtering;
    // Approvals (merged into this page): price changes waiting for approval and rejected ones sit in
    // the tray at the top; approved changes are simply each file's current prices.
    const changes = (state.versions || []).filter(version => version.source !== 'upload' && version.status !== 'superseded');
    const trayItems = changes.filter(version => ['pending', 'rejected'].includes(version.status) &&
      (!filesView.country || version.country === filesView.country) &&
      (!filesView.level || version.priceLevel === filesView.level) &&
      (!query || [version.name, version.savedBy, version.country, version.priceLevel].some(value => String(value || '').toLowerCase().includes(query))))
      .sort((a, b) => Number(Boolean(b.canApprove)) - Number(Boolean(a.canApprove)) || Number(a.status !== 'pending') - Number(b.status !== 'pending') || String(b.savedAt || '').localeCompare(String(a.savedAt || '')));
    const latestChange = key => changes.filter(version => listKey(version) === key).sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')))[0];
    $('#filesEmpty').hidden = visible.length > 0 || showUpload || trayItems.length > 0;
    $('#filesEmptyText').textContent = files.length ? 'No files match these filters.' : (can('upload') ? 'Use “Upload files” to add price lists. Uploads need no approval.' : 'Uploaded price lists will appear here.');
    // Files are grouped by country (with its flag), each group sorted by price level. Every file is a
    // small sheet of paper: price level and status on top, the name, then products, when it last
    // changed and who uploaded it. The list open in the editor wears a pink bookmark.
    const levelNumber = level => Number((String(level || '').match(/\d+/) || [Infinity])[0]);
    const levelMark = level => (String(level || '').match(/\d+/) || [String(level || '?').trim().charAt(0).toUpperCase()])[0];
    const groups = new Map();
    visible.forEach(version => {
      const country = String(version.country || '').trim() || 'No country';
      const key = country.toLowerCase();
      if (!groups.has(key)) groups.set(key, { country, files: [] });
      groups.get(key).files.push(version);
    });
    const sheet = version => {
      const current = liveRevisionOf(version) || version;
      const updated = current.id !== version.id || current.source !== 'upload';
      const waiting = (state.versions || []).some(other => other.status === 'pending' && listKey(other) === listKey(version));
      const cid = escapeHtml(current.id);
      const name = escapeHtml(version.name);
      const isOpen = [current.id, version.id].some(id => String(state.active?.id) === String(id));
      const versions = listHistory(version).length;
      const products = Number(current.productCount || version.productCount || 0);
      const changedAt = updated ? (current.approvedAt || current.savedAt) : version.savedAt;
      const detail = updated ? `Prices changed ${displayDate(changedAt)}` : `Original prices, uploaded ${displayDate(version.savedAt)}`;
      const last = latestChange(listKey(version));
      const rejected = last?.status === 'rejected' ? last : null;
      const stamp = waiting ? ['is-pending', 'Pending', 'A price change is waiting for approval (see the tray above)'] : updated ? ['is-updated', 'Updated', detail] : ['is-uploaded', 'Uploaded', detail];
      // A receipt: level and menu on top, the name, details on dotted leader lines, then the status
      // stamp and "Open" above a torn edge. The whole receipt opens the list.
      const line = (label, value, extra = '') => `<div class="sheet-line${extra}"><dt>${label}</dt><dd>${value}</dd></div>`;
      return `<article class="file-sheet is-receipt ${updated ? 'is-updated' : 'is-uploaded'} ${waiting ? 'is-pending' : ''} ${isOpen ? 'is-open' : ''}" role="listitem" data-key="${escapeHtml(listKey(version))}" aria-label="${name}, ${escapeHtml(version.priceLevel || '')}">
        <div class="sheet-paper">
          <div class="sheet-top">
            <span class="sheet-level" title="Price level"><b aria-hidden="true">${escapeHtml(levelMark(version.priceLevel))}</b>${escapeHtml(version.priceLevel || 'No price level')}</span>
            ${isOpen ? '<span class="sheet-open-tag" title="This list is open in the editor">In editor</span>' : ''}
            <button type="button" class="kebab-btn" data-id="${cid}" aria-haspopup="menu" aria-expanded="false" aria-label="More actions for ${name}" title="More actions"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></button>
          </div>
          <strong class="sheet-name" title="${name}">${name}</strong>
          <dl class="sheet-lines" title="${escapeHtml(detail)}">
            ${line('Products', products.toLocaleString())}
            ${line(updated ? 'Changed' : 'Uploaded', escapeHtml(formatRelativeTime(changedAt)))}
            ${line('By', `<span title="${escapeHtml(version.savedBy || 'Unknown')}">${escapeHtml(version.savedBy || 'Unknown')}</span>`)}
            ${versions > 1 ? line('Versions', `<button type="button" class="version-history-link sheet-history" data-id="${cid}" title="See all ${versions} versions">${versions}<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V5a2 2 0 0 1 2-2h11"/></svg></button>`) : ''}
          </dl>
          ${isOpen && state.active?.isDraft ? '<small class="sheet-unsaved">Unsaved changes in the editor</small>' : ''}
          ${waiting ? '<small class="sheet-waiting">Change waiting for approval</small>' : ''}
          ${rejected ? `<small class="sheet-rejected" title="${escapeHtml(rejected.rejectionRemarks || 'No remarks')}">Last change rejected${rejected.rejectedBy ? ` by ${escapeHtml(rejected.rejectedBy)}` : ''}</small>` : ''}
          <div class="sheet-foot">
            <span class="sheet-stamp ${stamp[0]}" title="${escapeHtml(stamp[2])}">${stamp[1]}</span>
            <button type="button" class="row-primary sheet-open" data-action="open" data-id="${cid}">${isOpen ? 'Back to editor' : 'Open'}<span aria-hidden="true">›</span></button>
          </div>
        </div>
      </article>`;
    };
    const uploadTile = showUpload ? `<button type="button" class="sheet-upload" data-key="upload"><span class="sheet-upload-plus" aria-hidden="true">+</span><strong>Upload files</strong><small>Excel price lists · uploads need no approval</small></button>` : '';
    // The approval tray: each change is a paper-clipped slip. Approvers get Approve / Reject / Review
    // right on it; everyone else can review it. Rejected changes stay until they're deleted.
    const slip = version => {
      const vid = escapeHtml(version.id);
      const name = escapeHtml(version.name);
      const pending = version.status === 'pending';
      const { waiting: waitingOn } = approvalProgress(version);
      const note = pending
        ? `Saved by ${version.savedBy || 'someone'} · ${formatRelativeTime(version.savedAt)}${waitingOn.length ? ` · waiting for ${waitingOn.join(state.approvalMode === 'all' ? ' & ' : ' or ')}` : ''}`
        : `Rejected by ${version.rejectedBy || 'an approver'}${version.rejectionRemarks ? `: “${version.rejectionRemarks}”` : ''}`;
      const stampText = version.canApprove ? 'Needs you' : pending ? 'Pending' : 'Rejected';
      const actions = version.canApprove
        ? `<button type="button" class="row-primary is-approve" data-action="approve" data-id="${vid}">Approve</button><button type="button" class="row-primary slip-reject" data-action="reject" data-id="${vid}">Reject</button><button type="button" class="row-primary slip-review" data-action="review" data-id="${vid}" title="See every price this change makes">Review</button>`
        : `<button type="button" class="row-primary" data-action="review" data-id="${vid}">Review changes</button>`;
      const edits = Number(version.changeCount || 0);
      const what = adjustmentChips(version) + (edits ? `<span class="adj-chip edits">${edits} cell edit${edits === 1 ? '' : 's'}</span>` : '') || '<span class="adj-chip edits">No price adjustments</span>';
      return `<article class="approval-slip ${pending ? 'is-pending' : 'is-rejected'} ${version.canApprove ? 'is-mine' : ''}" role="listitem" data-key="change-${vid}" aria-label="${name}, ${escapeHtml(stampText)}">
        <svg class="slip-clip" width="16" height="34" viewBox="0 0 16 34" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 24V7a3 3 0 0 1 6 0v19a5 5 0 0 1-10 0V9"/></svg>
        <div class="slip-head">
          <span class="country-flag" aria-hidden="true">${flagMarkup(version.country, countryCodeOf(version.country))}</span>
          <strong class="slip-name" title="${name}">${name}</strong>
          <span class="slip-stamp">${stampText}</span>
        </div>
        <div class="slip-tags"><span class="sheet-level"><b aria-hidden="true">${escapeHtml(levelMark(version.priceLevel))}</b>${escapeHtml(version.priceLevel || 'No price level')}</span></div>
        <div class="slip-what">${what}</div>
        <small class="slip-note" title="${escapeHtml(note)}">${escapeHtml(note)}</small>
        <div class="slip-actions">${actions}<button type="button" class="kebab-btn" data-id="${vid}" aria-haspopup="menu" aria-expanded="false" aria-label="More actions for ${name}" title="More actions"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="12" cy="19" r="1.9"/></svg></button></div>
      </article>`;
    };
    const pendingCount = trayItems.filter(version => version.status === 'pending').length;
    const mineCount = trayItems.filter(version => version.canApprove).length;
    const rejectedCount = trayItems.length - pendingCount;
    const tray = trayItems.length ? `<section class="approval-tray" id="approvalTray" aria-label="Approvals">
        <header class="tray-head">
          <span class="tray-label">Approvals</span>
          <span class="tray-summary">${[pendingCount ? `${pendingCount} waiting` : '', rejectedCount ? `${rejectedCount} rejected` : ''].filter(Boolean).join(' · ')}</span>
          ${mineCount ? `<span class="tray-mine">${mineCount} need${mineCount === 1 ? 's' : ''} your approval</span>` : ''}
        </header>
        <div class="tray-slips" role="list">${trayItems.map(slip).join('')}</div>
      </section>` : '';
    // No price lists at all (and not just filtered away): a friendly starting point instead of an empty board.
    const nothingYet = !files.length && !trayItems.length && !filtering;
    $('#filesPanel')?.classList.toggle('is-empty', nothingYet);
    if (nothingYet) {
      $('#filesEmpty').hidden = true;
      body.innerHTML = `<div class="files-empty">
        <div class="files-empty-art" aria-hidden="true"><span class="ghost-sheet is-back"></span><span class="ghost-sheet is-middle"></span><span class="ghost-sheet is-front"><span class="ghost-lines"></span><span class="ghost-plus">+</span></span></div>
        <h2>No price lists yet</h2>
        <p>${can('upload') ? 'Upload an official Excel price list to get started. Uploads are live straight away; only later price changes need approval.' : 'Price lists will appear here once an admin uploads one. You can then open and export them.'}</p>
        ${can('upload') ? '<button type="button" class="button primary files-empty-upload"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Upload a price list</button>' : ''}
        <ol class="files-empty-steps">
          <li><b>1</b><span><strong>Upload</strong> the Excel template</span></li>
          <li><b>2</b><span><strong>Adjust</strong> prices by category</span></li>
          <li><b>3</b><span><strong>Approve &amp; export</strong> to Excel or PDF</span></li>
        </ol>
      </div>`;
      return;
    }
    flipMove(body, () => {
      body.innerHTML = tray + uploadTile + [...groups.values()]
        .sort((a, b) => a.country.localeCompare(b.country))
        .map(({ country, files: list }) => {
          const code = countryCodeOf(country);
          list.sort((a, b) => levelNumber(a.priceLevel) - levelNumber(b.priceLevel) || String(a.priceLevel).localeCompare(String(b.priceLevel)) || String(a.name).localeCompare(String(b.name)));
          return `<section class="sheet-group" aria-label="${escapeHtml(country)}">
            <header class="sheet-group-head">
              <span class="country-flag" aria-hidden="true">${flagMarkup(country, code)}</span>
              <h3>${escapeHtml(country)}</h3>
              <span class="sheet-group-count">${list.length} file${list.length === 1 ? '' : 's'}</span>
            </header>
            <div class="sheet-grid" role="list">${list.map(sheet).join('')}</div>
          </section>`;
        }).join('');
    });
  }
  // The blank sheet opens the upload dialog (same as the "Upload files" button).
  $('#filesTable')?.addEventListener('click', event => {
    if (event.target.closest('.sheet-upload, .files-empty-upload')) return openUploadModal();
    // Opening a list from its sheet (or slip): remember where, so the editor unfolds out of it.
    // (Capture phase: this runs before the shared handler that opens the list.)
    const opener = event.target.closest('.row-primary[data-action="open"]');
    if (opener) openOriginRect = (opener.closest('.file-sheet, .approval-slip') || opener).getBoundingClientRect();
  }, true);
  $('#filesTable')?.addEventListener('click', event => {
    const receipt = event.target.closest('.file-sheet');
    if (!receipt || event.target.closest('button, a, input, select, [role="menu"]')) return;
    receipt.querySelector('.sheet-open')?.click();
  });
  const searchFiles = searchAfterPause(() => renderFiles());
  $('#filesSearchInput')?.addEventListener('input', event => { filesView.search = event.target.value; searchFiles(); });
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
    const list = active ? `${active.name}${isDraft ? ' · unsaved' : ''}` : '—';
    // The list name in the file header is the switcher; it only opens while a list is open.
    switcherButton.disabled = !active;
    switcherButton.title = active ? `${country} › ${level} › ${list}. Click to switch price list.` : '';
    switcherButton.setAttribute('aria-label', active ? `${active.name}: switch price list` : 'No price list open');
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
    $('#lsmLists').innerHTML = files.map(version => item('list', version.id, version.name, {
      // Like the header, only a status that needs attention is named; approved lists are the norm.
      meta: ['approved', 'uploaded'].includes(version.status) ? '' : statusLabel(version.status), current: String(version.id) === String(active?.id)
    })).join('') || '<p class="lsm-empty">—</p>';
  }
  let switcherAnchor = null; // what opened the switcher (the title or the country/level chip)
  function positionSwitcherMenu() {
    const rect = (switcherAnchor || switcherButton).getBoundingClientRect();
    const width = Math.min(680, window.innerWidth - 32);
    switcherMenu.style.width = `${width}px`;
    switcherMenu.style.top = `${Math.round(rect.bottom + 6)}px`;
    switcherMenu.style.maxHeight = `${Math.max(220, Math.round(window.innerHeight - rect.bottom - 18))}px`; // its columns scroll inside, never past the window
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
    switcherButton.classList.toggle('is-open', open && switcherAnchor !== $('.list-context'));
    $('.list-context')?.classList.toggle('is-open', open && switcherAnchor === $('.list-context'));
    $('.list-context')?.setAttribute('aria-expanded', String(open && switcherAnchor === $('.list-context')));
  }
  switcherButton?.addEventListener('click', event => {
    event.stopPropagation();
    switcherAnchor = switcherButton;
    toggleSwitcher(switcherMenu.hidden);
  });
  // The country and price level in the header line open the same switcher.
  $$('.switch-trigger').forEach(trigger => {
    trigger.addEventListener('click', event => {
      event.stopPropagation();
      if (!state.active) return;
      const reopen = !switcherMenu.hidden && switcherAnchor !== trigger;
      switcherAnchor = trigger;
      toggleSwitcher(reopen || switcherMenu.hidden);
    });
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
      categoryMenu.style.maxHeight = `${Math.max(200, Math.round(window.innerHeight - rect.bottom - 18))}px`;
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
    const tone = rates.every(rate => rate > 0) ? 'pos' : rates.every(rate => rate < 0) ? 'neg' : '';
    return `<span class="history-adj-pill has-adj ${tone}">${escapeHtml(text)}</span>`;
  }
  /** Saved by a top approver (e.g. Ms. Gen) and approved on the spot, so it never went through the approval workflow. */
  function isAutoApproved(version) {
    return (version.approvals || []).some(approval => approval.auto);
  }
  function renderLists() {
    // Approvals now live on the Files page (its approval tray). This keeps the "waiting for you"
    // count on the Files nav item up to date; the old table below only runs if its markup exists.
    const allVersions = (state.versions || []).filter(version => version.source !== 'upload');
    const versions = allVersions.filter(version => version.status !== 'superseded');
    const awaitingMine = versions.filter(version => version.canApprove);
    const approved = versions.filter(version => version.status === 'approved');
    const badge = dom.pendingApprovalCount || $('#pendingApprovalCount');
    if (badge) {
      badge.hidden = !awaitingMine.length;
      badge.textContent = String(awaitingMine.length);
    }
    if (!dom.listsTableBody) return;
    dom.listAllCount.textContent = String(versions.length);
    dom.listMineCount.textContent = String(awaitingMine.length);
    dom.listApprovedCount.textContent = String(approved.length);
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
        : state.autoApprove ? 'Price changes you save are approved right away and will be listed here.'
        : can('update') ? 'Saved price changes appear here while they wait for approval.'
        : 'Approved price changes appear here once an approver signs off.';
    }
    dom.listsTableBody.innerHTML = visible.map(version => {
      const { approved: approvedBy, waiting } = approvalProgress(version);
      const isOpen = String(state.active?.id) === String(version.id);
      let statusDetail = '';
      if (version.status === 'pending') statusDetail = waiting.length ? `Waiting: ${waiting.join(state.approvalMode === 'all' ? ' & ' : ' or ')}` : '';
      else if (version.status === 'approved') statusDetail = isAutoApproved(version) ? `Approved on save by ${version.approvedBy || version.savedBy || ''}` : `By ${version.approvedBy || approvedBy.join(' & ')}`;
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
            <div class="list-sub">${Number(version.productCount || 0).toLocaleString()} products${version.changeCount ? ` · ${Number(version.changeCount).toLocaleString()} cell edits` : ''}</div>
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
      + [...extra, ...list].map(country => `<option value="${escapeHtml(country)}"${country === current ? ' selected' : ''}>${escapeHtml(country)}${extra.includes(country) ? ' (switched off)' : ''}</option>`).join('');
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
      const item = { file, name: file.name.replace(/\.xlsx$/i, ''), country: '', priceLevel: guessPriceLevel(file.name), status: '', message: '', check: 'checking', problems: [] };
      stagedFiles.push(item);
      checkStagedFile(item);
    });
    if (overLimit) toast(`Up to ${MAX_BULK_FILES} files per batch. ${overLimit} file${overLimit === 1 ? ' was' : 's were'} not added.`);
    const before = $$('#stagedFilesList .staged-row').length;
    const panelWasHidden = $('#stagedFilesPanel')?.hidden;
    // The first file: the list grows open as the drop area shrinks. More files: the new rows rise in.
    morphUploadWindow(renderStagedFiles, () => (panelWasHidden ? [] : $$('#stagedFilesList .staged-row').slice(before)));
  }
  /**
   * Attaching or removing workbooks: the upload window glides to its new size (like the Template
   * rules switch). Inside it, the drop area, the file list and the error box ease between their old
   * and new heights together, so nothing jumps; new file rows rise in.
   */
  let uploadMorph = 0;
  function morphUploadWindow(update, entering = () => []) {
    const dialog = dom.uploadModal;
    const smooth = Boolean(dialog?.open) && typeof dialog.animate === 'function' && !reducedMotion();
    const parts = [dom.modalDropZone, $('#stagedFilesPanel'), $('#uploadValidationErrors')].filter(Boolean);
    const heights = smooth ? parts.map(el => (el.hidden ? 0 : el.getBoundingClientRect().height)) : [];
    const from = smooth ? dialog.getBoundingClientRect() : null;
    update();
    if (!smooth) return;
    parts.forEach((el, index) => {
      if (el.hidden) return;
      const was = heights[index];
      const now = el.getBoundingClientRect().height;
      if (Math.abs(now - was) < 1) return;
      el.getAnimations().forEach(anim => anim.id === 'upload-part' && anim.cancel());
      el.style.overflow = 'hidden';
      const grow = el.animate([{ height: `${was}px`, opacity: was ? 1 : 0 }, { height: `${now}px`, opacity: 1 }], { duration: 480, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
      grow.id = 'upload-part';
      const clear = () => { el.style.overflow = ''; };
      grow.finished.then(clear, clear);
      setTimeout(() => { if (grow.playState === 'running') grow.finish(); }, 720);
      // The drop area's own text and button cross-fade into their new layout.
      if (el === dom.modalDropZone && was) [...el.children].forEach(child => child.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, delay: 120, easing: 'ease-out', fill: 'backwards' }));
    });
    const to = dialog.getBoundingClientRect();
    const ease = 'cubic-bezier(0.16, 1, 0.3, 1)';
    const turn = ++uploadMorph;
    if (Math.abs(from.height - to.height) > 1 || Math.abs(from.width - to.width) > 1) {
      dialog.getAnimations().forEach(anim => anim.id === 'upload-swap' && anim.cancel());
      dialog.classList.add('is-resizing');
      const resize = dialog.animate([{ width: `${from.width}px`, height: `${from.height}px` }, { width: `${to.width}px`, height: `${to.height}px` }], { duration: 480, easing: ease });
      resize.id = 'upload-swap';
      const settle = () => { if (turn === uploadMorph) dialog.classList.remove('is-resizing'); };
      resize.finished.then(settle, () => { });
      setTimeout(settle, 720); // never left clipped if frames stall
    }
    entering().filter(Boolean).forEach((el, index) => el.animate(
      [{ opacity: 0, transform: 'translateY(10px) scale(0.985)' }, { opacity: 1, transform: 'none' }],
      { duration: 440, delay: 90 + index * 60, easing: ease, fill: 'backwards' }
    ));
  }
  /**
   * Checks an attached workbook against the template straight away (nothing is saved), so a wrong
   * file is explained before anyone picks a country or price level. The upload checks it again.
   */
  async function checkStagedFile(item) {
    const body = new FormData();
    body.append('workbook', item.file);
    try {
      const data = await api('check-workbook', { method: 'POST', headers: { 'X-CSRF-Token': state.csrf || '' }, body });
      const categories = (data.categories || []).length;
      item.check = 'ok';
      item.summary = `${Number(data.productCount || 0).toLocaleString()} product${data.productCount === 1 ? '' : 's'} · ${categories} categor${categories === 1 ? 'y' : 'ies'}`;
      item.problems = [];
    } catch (error) {
      item.check = 'bad';
      item.message = error.message || 'This workbook could not be checked.';
      item.problems = error.problems || [];
    }
    if (!stagedFiles.includes(item)) return; // removed while it was being checked
    morphUploadWindow(renderStagedFiles);
  }
  function renderStagedFiles() {
    const panel = $('#stagedFilesPanel');
    const list = $('#stagedFilesList');
    if (!panel || !list) return;
    panel.hidden = !stagedFiles.length;
    // The batch counts as finished only once the import loop is over (not when the first file completes).
    const finished = !bulkImporting && stagedFiles.some(item => item.status === 'saved' || item.status === 'failed');
    const failed = stagedFiles.filter(item => item.status === 'failed' || item.check === 'bad');
    const checking = stagedFiles.some(item => item.check === 'checking');
    const ready = stagedFiles.filter(item => item.check === 'ok' && !item.status);
    const attr = value => escapeHtml(value).replace(/"/g, '&quot;');
    list.innerHTML = stagedFiles.map((item, index) => {
      const rejected = item.check === 'bad' && !item.status;
      const locked = bulkImporting || finished || rejected || item.check === 'checking';
      const statusMarkup = item.status
        ? `<span class="staged-status status-${item.status}" title="${attr(item.message)}">${{ working: '…', saved: '✓', failed: '✕' }[item.status] || ''}</span>`
        : `<button type="button" class="icon-button staged-remove" data-index="${index}" aria-label="Remove ${attr(item.file.name)}" title="Remove">×</button>`;
      const note = item.status ? (item.message ? ` · ${item.status === 'failed' ? 'Upload failed' : escapeHtml(item.message)}` : '')
        : item.check === 'checking' ? ' · <span class="staged-checking">Checking the workbook…</span>'
        : rejected ? ' · Not accepted, see below'
        : item.summary ? ` · ✓ ${escapeHtml(item.summary)}` : '';
      return `<div class="staged-row ${item.status ? `is-${item.status}` : rejected ? 'is-failed' : item.check === 'ok' ? 'is-checked' : 'is-checking'}" role="row" data-index="${index}">
        <span class="staged-file" role="cell" title="${attr(item.file.name)}"><strong>${escapeHtml(item.file.name)}</strong><small>${formatBytes(item.file.size)}${note}</small></span>
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
      button.disabled = finished ? false : (!ready.length || checking || bulkImporting);
      button.textContent = finished ? 'Close' : bulkImporting ? 'Uploading…' : checking && !ready.length ? 'Checking…' : count > 1 ? `Upload ${ready.length} file${ready.length === 1 ? '' : 's'}` : 'Upload & open';
    }
    $('.staged-apply-all')?.toggleAttribute('hidden', count < 2 || finished);
    const hint = $('#stagedFilesHint');
    if (hint) {
      hint.textContent = finished
        ? `${stagedFiles.filter(item => item.status === 'saved').length} of ${count} saved. Correct rejected files and select them again.`
        : checking
          ? 'Checking the workbook against the official template…'
          : !ready.length
            ? (count > 1 ? 'None of these workbooks can be uploaded. Remove them and choose corrected files.' : 'This workbook can\'t be uploaded. Remove it and choose the corrected file.')
            : failed.length
              ? `${failed.length} workbook${failed.length === 1 ? ' is' : 's are'} not accepted and will be skipped. Choose the country and price level for the rest.`
              : count > 1
                ? 'Each workbook becomes a separate price list.'
                : 'Choose the country and price level for this workbook.';
    }
    if (dom.cancelUploadBtn) dom.cancelUploadBtn.hidden = finished;
    if (dom.modalDropZone) dom.modalDropZone.hidden = finished && !failed.length;
    const errors = $('#uploadValidationErrors');
    if (errors) {
      errors.hidden = !failed.length;
      errors.innerHTML = failed.length ? `<strong>${failed.length === 1 ? 'Workbook not accepted' : `${failed.length} workbooks not accepted`}</strong><ul>${failed.map(item => `<li><strong>${escapeHtml(item.file.name)}</strong>: ${escapeHtml(item.message)}${(item.problems || []).length ? `<ol class="upload-problems">${item.problems.map(problem => `<li>${escapeHtml(problem)}</li>`).join('')}</ol>` : ''}</li>`).join('')}</ul><p>${finished ? 'Correct the file and select it again. Validation failures save no products.' : 'Nothing has been uploaded. Correct the file, then remove it here and choose it again.'}</p>` : '';
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
      if (item.check !== 'ok') continue; // rejected files are skipped
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
      if (item.check !== 'ok') continue; // rejected when attached: not uploaded
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
        item.problems = error.problems || [];
      }
      renderStagedFiles();
    }
    bulkImporting = false;
    renderStagedFiles();
    await refreshState();
    const saved = stagedFiles.filter(item => item.status === 'saved').length;
    const tried = stagedFiles.filter(item => item.status).length;
    if (saved === stagedFiles.length) {
      // Everything saved: close the window and show the new lists, no extra click needed.
      closeUploadModal();
      switchPanel('filesPanel', true);
      toast(`${saved} file${saved === 1 ? '' : 's'} uploaded.`);
      return;
    }
    const skipped = stagedFiles.length - tried;
    const failedNow = tried - saved;
    toast([`${saved} file${saved === 1 ? '' : 's'} uploaded`, failedNow ? `${failedNow} failed` : '', skipped ? `${skipped} skipped (not the template)` : ''].filter(Boolean).join(' · ') + '.');
  }

  async function openUploadModal() {
    if (!can('upload')) return toast('Your role cannot upload price lists.');
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
    if (can('update')) await removeDraft(draftKey(data.active)); // a fresh upload replaces that list's old unsaved changes
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
    updateCodeFilterUI();
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
        // 'current': the rows are the prices as they were when opened, and the % applies on top of them.
        adjustBase: state.active?.pricesBaked ? 'current' : 'original',
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
    // Named by the date its prices are from (approval, or upload), e.g. "… - 2026-10-08.pdf".
    const parts = [version.name || 'LRN Price List'];
    const asOf = version.approvedAt || version.savedAt;
    if (asOf) parts.push(new Intl.DateTimeFormat('en-CA').format(new Date(asOf)));
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
      const asOf = version.approvedAt || version.savedAt;
      const facts = [
        ['Country', version.country || '—'],
        ['Price level', version.priceLevel || '—'],
        ['Prices as of', asOf ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(asOf)) : '—'],
        approved ? ['Approved by', version.approvedBy || '—'] : ['Prices', 'Original upload'],
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
          doc.setTextColor(...(label === 'Approved by' ? ROSE : INK));
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
  // "Upload a new price list" sits in the price list switcher, beside opening another list.
  $('#uploadButton').addEventListener('click', event => { event.stopPropagation(); toggleSwitcher(false); openUploadModal(); });
  $('#emptyUploadButton').addEventListener('click', openUploadModal);
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

    // Nothing to do (e.g. 0% on prices already at 0%): no draft, no audit entry.
    if (selectedCats.every(cat => getCategoryAdjustment(cat) === value)) {
      setPriceEditor(false);
      const already = selectedCats.length === allCategories.length ? 'All categories are' : selectedCats.length === 1 ? `${selectedCats[0]} is` : 'These categories are';
      return toast(`${already} already at ${value > 0 ? '+' : ''}${value}%.`);
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
  // Rows that still match glide into place; the table's own row entrance doesn't replay for a search.
  const searchTable = searchAfterPause(() => {
    suppressRowEnter = true;
    flipMove(dom.table, () => renderTable(), { exits: false });
    suppressRowEnter = false;
  });
  dom.search.addEventListener('input', () => { state.search = dom.search.value; searchTable(); });
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
    if ($('#saveButton').dataset.saveState === 'saving') return; // already saving
    if (!can('save')) return toast('You do not have permission to save price lists.');
    if (!state.active) return toast('Please upload or open a price list first before saving.');
    if (!state.active.isDraft && state.active.status === 'pending') return toast('This price list is already saved and waiting for approval. Make changes first to save a new version.');
    if (!state.active.isDraft && ['approved', 'uploaded'].includes(state.active.status)) return toast('No changes to save. Adjust prices or edit cells first, then save to send the changes for approval.');
    dom.versionNameInput.value = state.active.name || '';
    dom.savePriceLevel.innerHTML = priceLevelOptionsHtml(state.active.priceLevel);
    // The list keeps its own country and level, even one switched off in Config since.
    dom.savePriceLevel.value = canonicalPriceLevel(state.active.priceLevel) || String(state.active.priceLevel || '').trim();
    dom.saveCountry.innerHTML = countryOptionsHtml(state.active.country, 'Select country…');
    dom.saveCountry.value = canonicalCountry(state.active.country) || String(state.active.country || '').trim();
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
    setSaveButtonState('saving');
    try {
      await save(name);
      setSaveButtonState('done');
    } catch (error) {
      setSaveButtonState('error');
      toast(error.message);
    }
  });
  /**
   * The Save button shows the save: its icon becomes a spinning ring while the server works, then a
   * check draws itself (or the button shakes on an error) before the save icon comes back.
   */
  let saveFeedbackTimer = 0;
  function setSaveButtonState(next) {
    const button = $('#saveButton');
    if (!button) return;
    clearTimeout(saveFeedbackTimer);
    const label = button.querySelector('.save-label');
    if (!next) {
      delete button.dataset.saveState;
      button.removeAttribute('aria-busy');
      if (label) label.textContent = button.classList.contains('has-unsaved') ? 'Save changes' : 'Saved';
      return;
    }
    if (label) label.textContent = next === 'saving' ? 'Saving…' : next === 'done' ? 'Saved' : label.textContent;
    button.dataset.saveState = next;
    button.setAttribute('aria-busy', String(next === 'saving'));
    if (next === 'done') saveFeedbackTimer = setTimeout(() => setSaveButtonState(''), 1600);
    if (next === 'error') {
      if (!reducedMotion()) {
        button.animate(
          [{ translate: '0 0' }, { translate: '-4px 0' }, { translate: '4px 0' }, { translate: '-3px 0' }, { translate: '2px 0' }, { translate: '0 0' }],
          { duration: 420, easing: 'ease-out' }
        );
      }
      saveFeedbackTimer = setTimeout(() => setSaveButtonState(''), 480);
    }
  }
  dom.saveConfirmCheck?.addEventListener('change', () => { dom.confirmSave.disabled = !dom.saveConfirmCheck.checked; });
  $('#closeFileBtn')?.addEventListener('click', closeActiveFile);
  /** A locked export explains itself: the padlock wiggles and the reason shows. */
  function lockedExport(button) {
    if (!button.classList.contains('is-locked')) return false;
    if (!reducedMotion()) {
      ($('#exportMenuBtn .lock-icon') || button.querySelector('.lock-badge'))?.animate(
        [{ transform: 'rotate(0)' }, { transform: 'rotate(-18deg)' }, { transform: 'rotate(14deg)' }, { transform: 'rotate(-8deg)' }, { transform: 'rotate(0)' }],
        { duration: 480, easing: 'ease-out' }
      );
    }
    toast(`${button.dataset.lockReason || 'Only approved price lists can be exported'}.`);
    return true;
  }
  $('#excelButton').addEventListener('click', event => { closeExportMenu(); if (!lockedExport(event.currentTarget)) requestExport('excel'); });
  $('#pdfButton').addEventListener('click', event => { closeExportMenu(); if (!lockedExport(event.currentTarget)) requestExport('pdf'); });

  // --- Export menu: one "Export" button opens Excel / PDF ---
  function closeExportMenu(refocus = false) {
    const menu = $('#exportMenu');
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    $('#exportMenuBtn')?.setAttribute('aria-expanded', 'false');
    if (refocus) $('#exportMenuBtn')?.focus();
  }
  function openExportMenu() {
    const menu = $('#exportMenu');
    if (!menu) return;
    menu.hidden = false;
    $('#exportMenuBtn').setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => menu.querySelector('.export-menu-item')?.focus());
  }
  $('#exportMenuBtn')?.addEventListener('click', event => {
    event.stopPropagation();
    if (lockedExport(event.currentTarget)) return;
    if ($('#exportMenu').hidden) openExportMenu(); else closeExportMenu();
  });
  document.addEventListener('click', event => {
    if (!event.composedPath().some(node => node.classList?.contains('export-menu-wrap'))) closeExportMenu();
  });
  $('#exportMenu')?.addEventListener('keydown', event => {
    const items = $$('#exportMenu .export-menu-item');
    const index = items.indexOf(document.activeElement);
    if (event.key === 'Escape') { event.preventDefault(); closeExportMenu(true); }
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    }
  });
  // Ctrl+S (⌘S on Mac) saves, like everywhere else; a cell being edited is kept first.
  document.addEventListener('keydown', event => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 's') return;
    event.preventDefault(); // never the browser's "Save page as…"
    if (document.querySelector('dialog[open]') || $('#workspacePanel').hidden || !state.active) return;
    if (state.isEditing && state.activeCell.td) commitCellEdit(state.activeCell.td);
    $('#saveButton')?.click();
  });

  // --- Workspace filters ---
  // --- LRN code filter: a pill like the category picker, with its own suggestions (code +
  // description) instead of the browser's plain list. ---
  const codeSuggest = $('#codeSuggest');
  let codeActive = -1;
  function updateCodeFilterUI() {
    const value = dom.codeFilterInput?.value.trim() || '';
    $('#codeFilter')?.classList.toggle('is-filtered', Boolean(value));
    const clear = $('#codeFilterClear');
    if (clear) clear.hidden = !value;
  }
  function closeCodeSuggest() {
    if (!codeSuggest || codeSuggest.hidden) return;
    codeSuggest.hidden = true;
    dom.codeFilterInput?.setAttribute('aria-expanded', 'false');
    $('#codeFilter')?.classList.remove('is-open');
  }
  function renderCodeSuggest() {
    if (!codeSuggest || !dom.codeFilterInput) return;
    const query = dom.codeFilterInput.value.trim().toLowerCase();
    const seen = new Map();
    state.rows.forEach(row => {
      const code = String(row[COL.code] ?? '').trim();
      // Matches on the code only, like the table filter, so every suggestion has rows behind it.
      if (code && !seen.has(code) && (!query || code.toLowerCase().includes(query))) {
        seen.set(code, String(row[COL.description] ?? ''));
      }
    });
    const matches = [...seen].slice(0, 8);
    if (!matches.length || (matches.length === 1 && matches[0][0].toLowerCase() === query)) return closeCodeSuggest();
    codeActive = Math.min(codeActive, matches.length - 1);
    const mark = text => {
      const at = query ? text.toLowerCase().indexOf(query) : -1;
      return at < 0 ? escapeHtml(text) : `${escapeHtml(text.slice(0, at))}<mark>${escapeHtml(text.slice(at, at + query.length))}</mark>${escapeHtml(text.slice(at + query.length))}`;
    };
    codeSuggest.innerHTML = `<p class="lsm-heading">${query ? 'Matching codes' : 'LRN codes'}${seen.size > matches.length ? ` <span>${matches.length} of ${seen.size}</span>` : ''}</p>`
      + matches.map(([code, description], index) => `<button type="button" class="lsm-item cs-item ${index === codeActive ? 'is-highlight' : ''}" role="option" aria-selected="${index === codeActive}" data-code="${escapeHtml(code)}"><span class="cs-code">${mark(code)}</span><span class="lsm-label cs-desc">${escapeHtml(description)}</span></button>`).join('');
    const box = $('#codeFilter').getBoundingClientRect();
    const width = Math.max(box.width, 300);
    Object.assign(codeSuggest.style, { width: `${width}px`, top: `${Math.round(box.bottom + 6)}px`, left: `${Math.round(Math.max(16, Math.min(box.left, innerWidth - width - 16)))}px` });
    if (codeSuggest.hidden) {
      codeSuggest.hidden = false;
      dom.codeFilterInput.setAttribute('aria-expanded', 'true');
      $('#codeFilter')?.classList.add('is-open');
    }
  }
  function applyCodeFilter(value) {
    dom.codeFilterInput.value = value;
    state.codeFilter = value;
    updateCodeFilterUI();
    renderTable();
  }
  dom.codeFilterInput?.addEventListener('input', () => {
    codeActive = -1;
    applyCodeFilter(dom.codeFilterInput.value);
    renderCodeSuggest();
  });
  dom.codeFilterInput?.addEventListener('focus', () => { codeActive = -1; renderCodeSuggest(); });
  dom.codeFilterInput?.addEventListener('keydown', event => {
    const items = codeSuggest && !codeSuggest.hidden ? $$('.cs-item', codeSuggest) : [];
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && items.length) {
      event.preventDefault();
      codeActive = (codeActive + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      renderCodeSuggest();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (items[codeActive]) applyCodeFilter(items[codeActive].dataset.code);
      closeCodeSuggest();
    } else if (event.key === 'Escape') {
      if (!codeSuggest.hidden) { event.stopPropagation(); closeCodeSuggest(); }
      else if (dom.codeFilterInput.value) applyCodeFilter('');
    }
  });
  codeSuggest?.addEventListener('mousedown', event => event.preventDefault()); // keep focus in the field
  codeSuggest?.addEventListener('click', event => {
    const item = event.target.closest('.cs-item');
    if (!item) return;
    applyCodeFilter(item.dataset.code);
    closeCodeSuggest();
  });
  $('#codeFilterClear')?.addEventListener('click', () => { applyCodeFilter(''); dom.codeFilterInput.focus(); });
  $('#codeFilter')?.addEventListener('click', event => { if (event.target === event.currentTarget || event.target.closest('.cf-icon')) dom.codeFilterInput.focus(); });
  dom.codeFilterInput?.addEventListener('blur', () => setTimeout(closeCodeSuggest, 120));
  window.addEventListener('resize', closeCodeSuggest);
  document.addEventListener('scroll', event => { if (!codeSuggest?.contains(event.target)) closeCodeSuggest(); }, true);
  dom.priceLevelSelect?.addEventListener('change', () => { state.priceLevelFilter = dom.priceLevelSelect.value; renderTable(); });
  dom.countrySelect?.addEventListener('change', () => { state.countryFilter = dom.countrySelect.value; renderTable(); });
  dom.clearFiltersBtn?.addEventListener('click', () => { resetFilters(); renderTable(); });
  // With no file open, saved price lists are opened from the Files page.
  dom.emptyBrowseListsButton?.addEventListener('click', () => switchPanel('filesPanel', true));
  $('#emptyOpenFilesBtn')?.addEventListener('click', () => switchPanel('filesPanel', true));

  // --- Approval decisions ---
  function openDecisionDialog(kind, versionId) {
    const summary = versionSummaryById(versionId) || (String(state.active?.id) === String(versionId) ? state.active : null);
    if (!summary) return toast('Price list not found. Refresh and try again.');
    state.pendingDecision = { kind, id: versionId };
    const label = summary.name;
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
  // --- Version history: every saved version of one price list (same name, country and price
  // level), newest first, opened from a row's menu or the Files row. ---
  function listHistory(version) {
    const key = item => [item.name, item.country, item.priceLevel].map(part => String(part || '').trim().toLowerCase()).join('|');
    return (state.versions || []).filter(item => key(item) === key(version))
      .sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')));
  }
  /** Opens or closes a "What changed" panel by easing its height, with its content fading in. */
  const DETAIL_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
  function slideDetail(detail, open) {
    detail.getAnimations().forEach(anim => anim.cancel());
    if (reducedMotion()) { detail.hidden = !open; return; }
    if (open) detail.hidden = false;
    const full = detail.scrollHeight;
    const closed = { height: '0px', paddingTop: '0px', paddingBottom: '0px', borderTopWidth: '0px', borderBottomWidth: '0px', opacity: 0, marginTop: '-8px' };
    const shown = { height: `${full}px`, opacity: 1 };
    detail.style.overflow = 'hidden';
    const anim = detail.animate(open ? [closed, shown] : [{ height: `${detail.getBoundingClientRect().height}px`, opacity: 1 }, closed], { duration: open ? 420 : 300, easing: DETAIL_EASE, fill: open ? 'none' : 'forwards' });
    const done = () => { detail.style.overflow = ''; if (!open) { detail.hidden = true; anim.cancel(); } };
    anim.finished.then(done).catch(() => {});
    setTimeout(() => { if (anim.playState === 'running') anim.finish(); }, open ? 600 : 450); // lands even if frames pause
    if (open) [...detail.children].forEach((child, index) => child.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: 80 + index * 40, easing: DETAIL_EASE, fill: 'backwards' }));
  }
  /** Swaps a panel's content and eases it from its old height to the new one. */
  function growTo(detail, update) {
    if (detail.hidden || reducedMotion()) return update();
    const from = detail.getBoundingClientRect().height;
    detail.getAnimations().forEach(anim => anim.finish());
    update();
    const to = detail.getBoundingClientRect().height;
    detail.style.overflow = 'hidden';
    const anim = detail.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: 460, easing: DETAIL_EASE });
    anim.finished.then(() => { detail.style.overflow = ''; }).catch(() => {});
    setTimeout(() => { if (anim.playState === 'running') anim.finish(); }, 650);
    [...detail.children].forEach((child, index) => child.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: 60 + Math.min(index, 6) * 45, easing: DETAIL_EASE, fill: 'backwards' }));
  }
  function openVersionHistory(version) {
    const history = listHistory(version);
    const current = liveRevisionOf(version) || history.find(item => ['approved', 'uploaded'].includes(item.status));
    $('#versionHistoryTitle').textContent = version.name;
    $('#versionHistoryMeta').textContent = `${[version.country, version.priceLevel].filter(Boolean).join(' · ')} · ${history.length} version${history.length === 1 ? '' : 's'}`;
    $('#versionHistoryList').innerHTML = history.map(item => {
      const isCurrent = current && item.id === current.id;
      const upload = item.source === 'upload';
      const edits = Number(item.changeCount || 0);
      // What this version did: each category's real price effect, and how many cells were edited.
      const what = upload
        ? `<span class="adj-chip">Uploaded file</span><span class="adj-chip">${Number(item.productCount || 0).toLocaleString()} products${(item.categories || []).length ? ` · ${item.categories.length} categories` : ''}</span>`
        : (adjustmentSummaryChip(item) + (edits ? `<span class="adj-chip edits">${edits.toLocaleString()} cell edit${edits === 1 ? '' : 's'}</span>` : '')) || '<span class="adj-chip">No price changes</span>';
      const status = isCurrent ? '<span class="list-status-pill status-approved">Current</span>'
        : item.status === 'superseded' ? '<span class="list-status-pill status-superseded">Older</span>'
        : statusPill(item.status);
      const isOpen = String(state.active?.id) === String(item.id);
      return `<li class="version-entry ${isCurrent ? 'is-current' : ''}">
        <span class="version-dot" aria-hidden="true"></span>
        <div class="version-main">
          <strong>${displayDate(item.savedAt)}</strong>
          <small>${upload ? 'Uploaded' : 'Saved'} by ${escapeHtml(item.savedBy || 'a user')}${item.approvedBy && item.status !== 'pending' && item.approvedBy !== item.savedBy ? ` · approved by ${escapeHtml(item.approvedBy)}` : ''}${item.status === 'rejected' && item.rejectedBy ? ` · rejected by ${escapeHtml(item.rejectedBy)}` : ''}</small>
        </div>
        <div class="version-side">${status}<button type="button" class="button secondary version-open" data-id="${escapeHtml(item.id)}">${isOpen ? 'Open now' : 'Open'}</button></div>
        <div class="version-what">${what}${upload ? '' : `<button type="button" class="version-details-toggle" data-id="${escapeHtml(item.id)}" aria-expanded="false">What changed <span aria-hidden="true">▾</span></button>`}</div>
        ${upload ? '' : '<div class="version-detail" hidden></div>'}
      </li>`;
    }).join('');
    $('#versionHistoryDialog').showModal();
  }
  $('#versionHistoryList')?.addEventListener('click', async event => {
    // "What changed": every price before → after, the category adjustments and any other cell edits.
    const toggle = event.target.closest('.version-details-toggle');
    if (toggle) {
      const detail = toggle.closest('.version-entry').querySelector('.version-detail');
      const open = detail.hidden;
      toggle.setAttribute('aria-expanded', String(open));
      if (!open) return slideDetail(detail, false);
      if (!detail.dataset.loaded) detail.innerHTML = '<p class="review-loading">Comparing with the version before it…</p>';
      slideDetail(detail, true);
      if (!detail.dataset.loaded) {
        detail.dataset.loaded = '1';
        let markup;
        try {
          const change = await fetchVersion(toggle.dataset.id);
          const base = change?.basedOn ? await fetchVersion(change.basedOn).catch(() => null) : null;
          markup = reviewMarkup(change, compareVersions(change, base), base);
        } catch (error) {
          delete detail.dataset.loaded;
          markup = `<p class="review-note is-rejected">${escapeHtml(error.message || 'Could not load this version.')}</p>`;
        }
        growTo(detail, () => { detail.innerHTML = markup; }); // the loading line grows into the full detail
      }
      return;
    }
    const button = event.target.closest('.version-open');
    if (!button) return;
    $('#versionHistoryDialog').close();
    if (String(state.active?.id) === String(button.dataset.id)) return switchPanel('workspacePanel', true);
    try { await openVersion(button.dataset.id); } catch (error) { toast(error.message); }
  });

  // --- Change review: exactly what a saved price change does, compared with the version it was made
  // from (its "basedOn"). Prices are compared as people see them (with each version's % adjustments),
  // other columns as text. Used by the review window and to mark changed cells in the editor. ---
  const versionCache = new Map(); // "id|savedAt" -> promise of the full version (versions/open has no side effects)
  function fetchVersion(id) {
    if (!id) return Promise.resolve(null);
    const key = `${id}|${versionSummaryById(id)?.savedAt || ''}`;
    if (!versionCache.has(key)) {
      versionCache.set(key, api('open', { method: 'POST', body: JSON.stringify({ id }) }).then(data => data.active).catch(error => { versionCache.delete(key); throw error; }));
    }
    return versionCache.get(key);
  }
  const pricedColumns = (version, headers) => (version?.priceColumns || []).filter(index => /price\s*\/\s*(pc|box)/i.test(String(headers[index] || '')));
  function shownValue(version, row, col, priceCols) {
    const raw = row?.[col];
    if (!priceCols.includes(col) || !isNumeric(raw)) return String(raw ?? '').trim();
    const category = String(row[0] ?? '').trim();
    const rate = Number(version.categoryAdjustments?.[category] ?? version.adjustment ?? 0) || 0;
    const value = numeric(raw);
    return rate ? Math.max(0, Math.round(value * (1 + rate / 100) * 10000) / 10000) : value;
  }
  function compareVersions(change, base) {
    const headers = normalizeHeaders(change.headers);
    const rows = normalizeRows(change.rows || [], change.priceLevel, change.country);
    const priceCols = pricedColumns(change, headers);
    const result = { prices: [], edits: [], cells: new Map(), added: 0, removed: 0, compared: Boolean(base) };
    if (!base) return result;
    const baseHeaders = normalizeHeaders(base.headers);
    const baseRows = normalizeRows(base.rows || [], base.priceLevel, base.country);
    const basePriceCols = pricedColumns(base, baseHeaders);
    const keyOf = (row, index) => String(row?.[COL.code] ?? '').trim().toLowerCase() || `#${index}`;
    const baseByKey = new Map(baseRows.map((row, index) => [keyOf(row, index), row]));
    const seen = new Set();
    rows.forEach((row, index) => {
      const key = keyOf(row, index);
      seen.add(key);
      const old = baseByKey.get(key);
      if (!old) { result.added++; return; }
      const product = { index, code: row[COL.code], name: row[2] || row[1], category: row[0], cols: [] };
      headers.forEach((header, col) => {
        if (col === 0 || !String(header || '').trim()) return;
        const isPrice = priceCols.includes(col);
        const before = isPrice ? shownValue(base, old, col, basePriceCols.length ? basePriceCols : priceCols) : String(old[col] ?? '').trim();
        const after = isPrice ? shownValue(change, row, col, priceCols) : String(row[col] ?? '').trim();
        const same = isPrice && isNumeric(before) && isNumeric(after) ? Math.abs(numeric(before) - numeric(after)) < 0.00005 : String(before) === String(after);
        if (same) return;
        result.cells.set(`${index}|${col}`, { before, isPrice });
        if (isPrice) product.cols.push({ col, header: String(header).replace(/\s+/g, ' ').trim(), before, after });
        else result.edits.push({ code: row[COL.code], name: product.name, header: String(header).replace(/\s+/g, ' ').trim(), before, after });
      });
      if (product.cols.length) result.prices.push(product);
    });
    baseRows.forEach((row, index) => { if (!seen.has(keyOf(row, index))) result.removed++; });
    return result;
  }
  const priceText = value => (isNumeric(value) ? money.format(numeric(value)) : escapeHtml(value || '—'));
  function deltaMarkup(before, after) {
    if (!isNumeric(before) || !isNumeric(after) || !numeric(before)) return '';
    const pct = (numeric(after) - numeric(before)) / numeric(before) * 100;
    const rounded = Math.round(pct * 10) / 10;
    return `<span class="review-delta ${rounded > 0 ? 'up' : rounded < 0 ? 'down' : ''}">${rounded > 0 ? '▲' : rounded < 0 ? '▼' : ''} ${rounded > 0 ? '+' : ''}${rounded}%</span>`;
  }
  /**
   * What a change really does to each category's prices, compared with the version it was made from.
   * Percentages always apply to the original uploaded prices, so going from +10% to +5% is a 4.5%
   * price cut, not "+5%". Without the earlier version, the plain percentage is all we know.
   */
  function netAdjustments(change, base) {
    const rate = (version, category) => Number(version?.categoryAdjustments?.[category] ?? version?.adjustment ?? 0) || 0;
    const categories = uniqueValues([...(change.categories || []), ...(change.summary?.adjustedCategories || []).map(item => item.category)]);
    const counts = new Map((change.summary?.adjustedCategories || []).map(item => [item.category, item.productCount]));
    // Saved with the newer logic: the % was applied on top of the prices at the time, so it is the change.
    if (change.adjustOnCurrent) {
      return categories.map(category => ({ category, net: rate(change, category), onCurrent: true, productCount: counts.get(category) })).filter(item => item.net !== 0);
    }
    return categories.map(category => {
      const to = rate(change, category);
      const from = base ? rate(base, category) : 0;
      const net = Math.round(((1 + to / 100) / (1 + from / 100) - 1) * 1000) / 10;
      return { category, from, to, net, known: Boolean(base), productCount: counts.get(category) };
    }).filter(item => item.net !== 0);
  }
  const signed = value => `${value > 0 ? '+' : ''}${value}%`;
  function netChip(item, large = false) {
    const how = item.onCurrent
      ? `${item.category}: ${signed(item.net)} on the current prices${item.productCount ? ` (${item.productCount} product${item.productCount === 1 ? '' : 's'})` : ''}`
      : item.known
        ? `${item.category}: was ${signed(item.from)}, now ${signed(item.to)} of the original prices, so prices go ${item.net > 0 ? 'up' : 'down'} ${Math.abs(item.net)}%`
        : `${item.category}: ${signed(item.to)} on the original prices`;
    return `<span class="adj-chip ${item.net > 0 ? 'up' : 'down'}" title="${escapeHtml(how)}">${escapeHtml(item.category)} <b>${item.net > 0 ? '▲' : '▼'} ${Math.abs(item.net)}%</b>${large && item.known ? `<small>${signed(item.from)} → ${signed(item.to)}</small>` : ''}</span>`;
  }
  /** One short chip for a change: "6 categories ▲ 5%" (or "6 categories adjusted" when rates differ); hover lists them. */
  function adjustmentSummaryChip(version) {
    const items = netAdjustments(version, versionSummaryById(version.basedOn));
    if (!items.length) return '';
    const list = items.map(item => `${item.category} ${item.net > 0 ? '▲' : '▼'} ${Math.abs(item.net)}%`).join(', ');
    const same = items.every(item => item.net === items[0].net);
    const up = items.every(item => item.net > 0) ? 'up' : items.every(item => item.net < 0) ? 'down' : '';
    const label = items.length === 1 ? escapeHtml(list)
      : same ? `${items.length} categories <b>${items[0].net > 0 ? '▲' : '▼'} ${Math.abs(items[0].net)}%</b>`
      : `${items.length} categories adjusted`;
    return `<span class="adj-chip ${up}" title="${escapeHtml(list)}">${label}</span>`;
  }
  /** Category chips for a change: "Breads ▼ 4.5%" (up to `limit`, then "+3 more"). */
  function adjustmentChips(version, limit = 3) {
    const items = netAdjustments(version, versionSummaryById(version.basedOn));
    if (!items.length) return '';
    const more = items.length - limit;
    return items.slice(0, limit).map(item => netChip(item)).join('') + (more > 0 ? `<span class="adj-chip more" title="${escapeHtml(items.slice(limit).map(item => `${item.category} ${item.net > 0 ? '▲' : '▼'} ${Math.abs(item.net)}%`).join(', '))}">+${more} more</span>` : '');
  }
  function reviewMarkup(change, diff, base) {
    const adjusted = netAdjustments(change, base);
    const stat = (value, label) => `<div class="review-stat"><strong>${value}</strong><span>${label}</span></div>`;
    const priceCount = diff.prices.reduce((sum, product) => sum + product.cols.length, 0);
    const stats = `<div class="review-stats">${stat(diff.compared ? diff.prices.length : '—', `product${diff.prices.length === 1 ? '' : 's'} repriced`)}${stat(adjusted.length, `categor${adjusted.length === 1 ? 'y' : 'ies'} adjusted`)}${stat(diff.compared ? diff.edits.length : (change.changeCount || 0), `other edit${(diff.compared ? diff.edits.length : change.changeCount) === 1 ? '' : 's'}`)}</div>`;
    const status = change.status === 'rejected'
      ? `<p class="review-note is-rejected">Rejected by ${escapeHtml(change.rejectedBy || 'an approver')}${change.rejectionRemarks ? `: “${escapeHtml(change.rejectionRemarks)}”` : ''}</p>` : '';
    const adjustedSection = adjusted.length ? `<section class="review-section"><h3>Category adjustments <small>${change.adjustOnCurrent ? 'on top of the prices it was made from' : base ? 'compared with the current prices · the small figures are the % on the original upload' : '% on the original upload prices'}</small></h3><div class="review-chips">${adjusted.map(item => netChip(item, true)).join('')}</div></section>` : '';
    let priceSection = '';
    if (!diff.compared) {
      priceSection = `<p class="review-note">The version this change was made from is no longer available, so prices can't be compared side by side.${(change.changes || []).length ? ' The cell edits recorded with it are listed below.' : ''}</p>`;
    } else if (diff.prices.length) {
      const columns = [...new Map(diff.prices.flatMap(product => product.cols).map(col => [col.col, col.header])).entries()].sort((a, b) => a[0] - b[0]);
      let lastCategory = null;
      priceSection = `<section class="review-section"><h3>Price changes <small>${priceCount} price${priceCount === 1 ? '' : 's'} on ${diff.prices.length} product${diff.prices.length === 1 ? '' : 's'}</small></h3>
        <div class="review-table-wrap"><table class="review-table"><thead><tr><th>Product</th>${columns.map(([, header]) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${diff.prices.map(product => {
          const categoryRow = product.category !== lastCategory ? `<tr class="review-category"><td colspan="${columns.length + 1}">${escapeHtml(product.category)}</td></tr>` : '';
          lastCategory = product.category;
          return `${categoryRow}<tr><td class="review-product"><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.code || '')}</small></td>${columns.map(([col]) => {
            const cell = product.cols.find(item => item.col === col);
            return cell ? `<td class="review-price"><span class="review-before">${priceText(cell.before)}</span><span class="review-arrow" aria-hidden="true">→</span><strong>${priceText(cell.after)}</strong>${deltaMarkup(cell.before, cell.after)}</td>` : '<td class="review-same">unchanged</td>';
          }).join('')}</tr>`;
        }).join('')}</tbody></table></div></section>`;
    } else {
      priceSection = '<p class="review-note">No prices are different from the version it was made from.</p>';
    }
    const edits = diff.compared ? diff.edits : (change.changes || []).map(item => ({ code: item.code, name: item.product, header: item.column, before: item.oldValue, after: item.newValue }));
    const editSection = edits.length ? `<section class="review-section"><h3>Other edits <small>${edits.length}</small></h3><ul class="review-edits">${edits.map(edit => `<li><span class="review-edit-what"><strong>${escapeHtml(edit.name || edit.code || 'Row')}</strong> · ${escapeHtml(edit.header || '')}</span><span class="review-before">${escapeHtml(edit.before || '(empty)')}</span><span class="review-arrow" aria-hidden="true">→</span><strong>${escapeHtml(edit.after || '(empty)')}</strong></li>`).join('')}</ul></section>` : '';
    const rowsNote = diff.added || diff.removed ? `<p class="review-note">${[diff.added ? `${diff.added} product${diff.added === 1 ? '' : 's'} added` : '', diff.removed ? `${diff.removed} product${diff.removed === 1 ? '' : 's'} removed` : ''].filter(Boolean).join(' · ')}</p>` : '';
    return status + stats + adjustedSection + priceSection + editSection + rowsNote;
  }
  let reviewingId = null;
  async function openChangeReview(id) {
    const summary = versionSummaryById(id);
    const dialog = $('#changeReviewDialog');
    if (!summary || !dialog) return toast('Price change not found. Refresh and try again.');
    reviewingId = id;
    $('#changeReviewKicker').textContent = summary.status === 'pending' ? (summary.canApprove ? 'Waiting for your approval' : 'Waiting for approval') : summary.status === 'rejected' ? 'Rejected price change' : 'Price change';
    $('#changeReviewTitle').textContent = summary.name;
    $('#changeReviewMeta').textContent = [summary.country, summary.priceLevel, `saved by ${summary.savedBy || 'a user'} · ${displayDate(summary.savedAt)}`].filter(Boolean).join(' · ');
    $('#changeReviewApprove').hidden = !summary.canApprove;
    $('#changeReviewReject').hidden = !summary.canApprove;
    $('#changeReviewOpen').textContent = String(state.active?.id) === String(id) ? 'Back to the editor' : 'Open in editor';
    const body = $('#changeReviewBody');
    body.innerHTML = '<p class="review-loading">Comparing with the previous version…</p>';
    if (!dialog.open) dialog.showModal();
    try {
      const change = await fetchVersion(id);
      const base = change?.basedOn ? await fetchVersion(change.basedOn).catch(() => null) : null;
      if (reviewingId !== id) return;
      body.innerHTML = reviewMarkup(change, compareVersions(change, base), base);
    } catch (error) {
      if (reviewingId === id) body.innerHTML = `<p class="review-note is-rejected">${escapeHtml(error.message || 'Could not load this price change.')}</p>`;
    }
  }
  $('#changeReviewApprove')?.addEventListener('click', () => { $('#changeReviewDialog').close(); openDecisionDialog('approve', reviewingId); });
  $('#changeReviewReject')?.addEventListener('click', () => { $('#changeReviewDialog').close(); openDecisionDialog('reject', reviewingId); });
  $('#changeReviewOpen')?.addEventListener('click', () => { $('#changeReviewDialog').close(); runListAction('open', reviewingId); });

  /** In the editor, a pending or rejected change marks every cell it changed ("was 1.25") and the banner offers the full review. */
  let changeMarksFor = null;
  async function loadChangeMarks(active) {
    state.changeMarks = null;
    changeMarksFor = active?.id || null;
    const reviewing = active && !active.isDraft && active.source !== 'upload' && ['pending', 'rejected'].includes(active.status) && active.basedOn;
    if (!reviewing) return renderChangeMarksButton();
    try {
      const base = await fetchVersion(active.basedOn);
      if (changeMarksFor !== active.id || state.active !== active) return;
      state.changeMarks = compareVersions(active, base);
      applyChangeMarks();
    } catch { /* no marks: the review window still lists the recorded edits */ }
    renderChangeMarksButton();
  }
  function applyChangeMarks() {
    const marks = state.changeMarks;
    if (!marks || !dom.table) return;
    marks.cells.forEach(({ before, isPrice }, key) => {
      const [row, col] = key.split('|');
      const td = dom.table.querySelector(`.excel-cell[data-row="${row}"][data-col="${col}"]`);
      if (!td || td.classList.contains('is-changed')) return;
      const was = isPrice ? priceText(before) : escapeHtml(before || '(empty)');
      td.classList.add('is-changed');
      td.title = `Was ${isPrice && isNumeric(before) ? money.format(numeric(before)) : before || '(empty)'}`;
      td.insertAdjacentHTML('beforeend', `<span class="cell-was">was ${was}</span>`);
    });
  }
  function renderChangeMarksButton() {
    const button = $('#bannerReviewBtn');
    if (!button) return;
    const active = state.active;
    const show = Boolean(active && !active.isDraft && active.source !== 'upload' && ['pending', 'rejected'].includes(active.status));
    button.hidden = !show;
    const count = state.changeMarks ? state.changeMarks.cells.size : 0;
    button.textContent = count ? `See ${count} change${count === 1 ? '' : 's'}` : 'See changes';
  }
  $('#bannerReviewBtn')?.addEventListener('click', () => state.active?.id && openChangeReview(state.active.id));

  async function runListAction(action, id) {
    const version = versionSummaryById(id);
    if (!version) return toast('Price list not found. Refresh and try again.');
    if (action === 'review') return openChangeReview(id);
    if (action === 'open') {
      if (String(state.active?.id) === String(id)) return switchPanel('workspacePanel', true);
      try { await openVersion(id); } catch (error) { toast(error.message); }
    } else if (action === 'history') {
      openVersionHistory(version);
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
    review: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    open: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><polyline points="3 3 3 8 8 8"/><polyline points="12 7 12 12 15 14"/>',
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
    // Why export is unavailable for this list, in a couple of words.
    const lockedHint = version.status === 'superseded' ? 'Newer version exists' : version.status === 'rejected' ? 'Rejected' : 'After approval';
    const item = (action, label, { danger = false, disabled = false, hint = '', title = '' } = {}) =>
      `<button type="button" role="menuitem" class="row-menu-item ${danger ? 'danger' : ''}" data-action="${action}" ${disabled ? 'disabled' : ''}${title ? ` title="${escapeHtml(title)}"` : ''}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${menuIcons[action]}</svg>
        <span>${label}</span>${hint ? `<small>${hint}</small>` : ''}</button>`;
    const groups = [
      [
        ...(version.source !== 'upload' ? [item('review', 'Review changes', { hint: 'Before → after' })] : []),
        item('open', isOpen ? 'Go to editor' : 'Open in editor', { hint: isOpen ? 'Already open' : '' }),
        ...(listHistory(version).length > 1 ? [item('history', 'Version history', { hint: `${listHistory(version).length} versions` })] : []),
      ],
      version.canApprove ? [item('approve', 'Approve'), item('reject', 'Reject', { danger: true })] : [],
      can('export') ? [
        item('export-excel', 'Export Excel', { disabled: !exportable, hint: exportable ? '.xlsx' : lockedHint }),
        item('export-pdf', 'Export PDF', { disabled: !exportable, hint: exportable ? '.pdf' : lockedHint })
      ] : [],
      // Approved lists are the record of published prices; only pending, rejected and unused uploads go.
      // Shown greyed out (with the reason) when the list must be kept, so it's clear why.
      version.canDelete ? [item('delete', version.status === 'pending' ? 'Withdraw request' : 'Delete', { danger: true })]
        : version.deleteBlock ? [item('delete', 'Delete', { danger: true, disabled: true, hint: version.source === 'upload' ? 'Has price changes' : 'Kept as a record', title: `${version.deleteBlock}.` })]
        : []
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
    const historyLink = event.target.closest('.version-history-link');
    if (historyLink) { const version = versionSummaryById(historyLink.dataset.id); if (version) openVersionHistory(version); return; }
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
  // The editor has no menu tab of its own: it opens from Files, like a workbook from Excel's start
  // screen, at files.php?list=<id> (prices.php still works and opens the last list).
  const PANEL_PAGES = {
    workspacePanel: 'files.php',
    filesPanel: 'files.php',
    historyPanel: 'audit_logs.php',
    usersPanel: 'users.php',
    settingsPanel: 'config.php'
  };
  const NAV_PARENT = { workspacePanel: 'filesPanel', listsPanel: 'filesPanel' }; // pages without a menu tab of their own belong under this one
  const urlListId = () => new URLSearchParams(location.search).get('list');
  function getInitialPanelId() {
    const panel = document.body.dataset.panel;
    if (panel === 'filesPanel' && urlListId()) return 'workspacePanel';
    return PANEL_PAGES[panel] ? panel : 'filesPanel';
  }
  function panelUrl(panelId) {
    if (panelId === 'workspacePanel') return `files.php?list=${encodeURIComponent(state.active?.id || 'open')}`;
    return PANEL_PAGES[panelId];
  }
  let openOriginRect = null; // the sheet a list was opened from, so the editor can unfold out of it

  function switchPanel(panelId, updateUrl = true) {
    if (panelId === 'listsPanel') panelId = 'filesPanel'; // Approvals merged into Files
    if (panelId === 'workspacePanel' && !state.active) panelId = 'filesPanel'; // no editor without an open list
    const previousPanel = $$('.panel').find(panel => !panel.hidden)?.id || null;
    let targetButton = $$('.nav-item').find(btn => btn.dataset.panel === (NAV_PARENT[panelId] || panelId));
    if (!targetButton || targetButton.hidden) {
      targetButton = $$('.nav-item')[0];
      panelId = targetButton?.dataset.panel;
    }
    if (!targetButton) return;
    const finalPanelId = panelId;
    setPriceEditor(false);
    // Nothing from the page being left stays floating over the next one.
    toggleSwitcher(false);
    toggleCategoryMenu(false);
    closeRowMenu();
    toggleNotifications(false);
    closeExportMenu();
    closeCodeSuggest();

    document.documentElement.removeAttribute('data-initial-panel');

    // The navbar lights only real pages. In the editor the open file's tab (under the bar) is the one
    // highlighted, so "Files" never looks like the page you are on while a file is open.
    $$('.nav-item').forEach(item => item.classList.toggle('active', item === targetButton && finalPanelId !== 'workspacePanel'));
    $$('.panel').forEach(panel => {
      const isTarget = panel.id === finalPanelId;
      panel.hidden = !isTarget;
      panel.classList.toggle('active', isTarget);
    });
    document.querySelector('.content')?.classList.toggle('history-active', ['historyPanel', 'listsPanel', 'filesPanel'].includes(finalPanelId));

    if (finalPanelId === 'settingsPanel') switchConfigTab(state.configTab || 'library');
    // Users: refreshed each time it opens (nothing is redrawn if nobody changed). Elsewhere, admins
    // fetch it once in the background so the page opens already filled in.
    if (finalPanelId === 'usersPanel') { state.usersPreloaded = true; loadUsers(); }
    else if (can('manageUsers') && !state.usersPreloaded) { state.usersPreloaded = true; setTimeout(loadUsers, 1200); }
    if (finalPanelId !== 'usersPanel') closePersonMenu();
    if (finalPanelId === 'historyPanel') renderHistory();
    if (finalPanelId === 'listsPanel') renderLists();
    if (finalPanelId === 'filesPanel') renderFiles();

    // Show the page's own address, so a refresh or bookmark opens this page (and this list), and the
    // browser's Back button steps between Files and the editor.
    const pageName = finalPanelId === 'workspacePanel' ? state.active?.name : targetButton.querySelector('strong')?.textContent.trim();
    if (pageName) document.title = `${pageName} · ${APP_TITLE}`;
    const url = panelUrl(finalPanelId);
    const here = (location.pathname.split('/').pop() || '') + location.search;
    if (updateUrl && url && here !== url) {
      if (state.booted && previousPanel && previousPanel !== finalPanelId) history.pushState({ panel: finalPanelId }, '', url);
      else history.replaceState({ panel: finalPanelId }, '', url);
    }
    renderTabs();
    // Leaving the editor: the open file's tab (now a chip with "Back to editor") glows once, so it is
    // easy to find again.
    if (state.booted && previousPanel === 'workspacePanel' && finalPanelId !== 'workspacePanel' && !reducedMotion()) {
      const parked = $('#fileTabs .file-tab.is-current');
      parked?.animate([
        { boxShadow: '0 0 0 0 rgba(181, 32, 66, 0)' },
        { boxShadow: '0 0 0 5px rgba(181, 32, 66, .16)', offset: 0.35 },
        { boxShadow: '0 0 0 0 rgba(181, 32, 66, 0)' },
      ], { duration: 1100, delay: 250, easing: 'ease-out', composite: 'add' });
    }

    // Files ↔ editor: the editor unfolds out of the sheet it was opened from, and going back the
    // list's sheet "lands" on the board.
    if (state.booted && previousPanel !== finalPanelId && !reducedMotion()) {
      if (finalPanelId === 'workspacePanel' && openOriginRect) { const rect = openOriginRect; setTimeout(() => unfoldEditor(rect), 0); }
      else if (finalPanelId === 'filesPanel' && previousPanel === 'workspacePanel') setTimeout(landOnActiveSheet, 0);
    }
    openOriginRect = null;
  }
  // The logo is "home": Files, the page everything starts from. Like the Files button, an open file
  // stays in its tab with any unsaved changes. Already on Files, it brings the board back to the top.
  // A real link underneath, so Ctrl/middle-click still opens Files in a new tab.
  $('.topbar .brand')?.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (!$('#filesPanel')?.hidden) {
      $('#filesPanel .history-table-frame')?.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
      return;
    }
    switchPanel('filesPanel', true);
  });
  /** The editor opens out of the sheet you clicked: its outline grows from that sheet to the full page. */
  function unfoldEditor(rect) {
    const panel = $('#workspacePanel');
    if (!panel || panel.hidden) return;
    panel.querySelectorAll(':scope > *').forEach(el => el.getAnimations().forEach(anim => anim.id === 'pla-page' && anim.cancel()));
    const box = panel.getBoundingClientRect();
    const from = `inset(${Math.max(0, rect.top - box.top)}px ${Math.max(0, box.right - rect.right)}px ${Math.max(0, box.bottom - rect.bottom)}px ${Math.max(0, rect.left - box.left)}px round 10px)`;
    const anim = panel.animate([{ clipPath: from, opacity: 0.4 }, { clipPath: 'inset(0px 0px 0px 0px round 0px)', opacity: 1 }], { duration: 560, easing: FOLDER_EASE });
    setTimeout(() => { if (anim.playState === 'running') anim.finish(); }, 800);
  }
  /** Back on Files, the sheet of the list you were editing settles onto the board. */
  function landOnActiveSheet() {
    if (!state.active) return;
    const key = [state.active.name, state.active.country, state.active.priceLevel].map(part => String(part || '').trim().toLowerCase()).join('|');
    const sheet = $$('#filesTableBody .file-sheet[data-key]').find(el => el.dataset.key === key);
    if (!sheet) return;
    sheet.scrollIntoView({ block: 'nearest' });
    const anim = sheet.animate([{ transform: 'translateY(-10px) scale(1.06)' }, { transform: 'none' }], { duration: 620, easing: 'cubic-bezier(.34, 1.56, .64, 1)' });
    setTimeout(() => { if (anim.playState === 'running') anim.finish(); }, 900);
  }

  $$('.nav-item').forEach(button => button.addEventListener('click', () => {
    switchPanel(button.dataset.panel, true);
  }));
  // Back / Forward between Files and an open list.
  window.addEventListener('popstate', async () => {
    const file = location.pathname.split('/').pop();
    const listId = urlListId();
    if ((file === 'files.php' && listId) || file === 'prices.php') {
      if (listId && listId !== 'open' && String(state.active?.id) !== listId) {
        try { await openVersion(listId, { stay: true, silent: true }); } catch { /* falls back to Files below if nothing is open */ }
      }
      return switchPanel('workspacePanel', false);
    }
    switchPanel(Object.keys(PANEL_PAGES).find(id => id !== 'workspacePanel' && PANEL_PAGES[id] === file) || 'filesPanel', false);
  });

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
    // An editing session opens to show each step (with its own "View changes").
    const sessionToggle = event.target.closest('.log-session-toggle');
    if (sessionToggle) {
      const items = sessionToggle.closest('.log-card').querySelector('.log-session-items');
      const open = items.hidden;
      sessionToggle.setAttribute('aria-expanded', String(open));
      sessionToggle.firstChild.textContent = open ? 'Hide steps ' : 'Show each step ';
      slideDetail(items, open);
      return;
    }
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
      const sheet = $(`#filesTable [data-id="${CSS.escape(String(deletedId))}"]`)?.closest('.file-sheet, .approval-slip');
      const data = await api('delete-version', { method: 'POST', body: JSON.stringify({ id: deletedId }) });
      const snap = snapForTrash(sheet);
      state.pendingDelete = null;
      dom.deleteDialog.close();
      if (String(state.active?.id) === String(deletedId) && !state.active.isDraft) loadActive(null);
      await refreshState();
      trashToast(data.message, snap);
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
  const searchTypes = searchAfterPause(() => flipMove(dom.imageSettingsList, () => renderImageSettings()));
  dom.imageSearchInput?.addEventListener('input', () => {
    state.imageSearch = dom.imageSearchInput.value;
    searchTypes();
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
      const snap = snapForTrash($(`#imageSettingsList .delete-group-image[data-key="${CSS.escape(state.pendingImageDelete.key)}"]`)?.closest('.plate-card')?.querySelector('.plate'));
      state.productImages = state.productImages.filter(image => image.key !== state.pendingImageDelete.key);
      state.pendingImageDelete = null;
      clearPdfImageCache();
      dom.deleteImageDialog.close();
      renderImageSettings();
      renderTable();
      trashToast(data.message, snap);
    } catch (error) {
      toast(error.message);
    } finally {
      button.disabled = false;
    }
  });
  // Audit Logs' soft focus edges: tell the frame whether there's more to scroll up and/or down.
  const auditFrame = $('#historyPanel .history-table-frame');
  function markAuditEdges() {
    if (!auditFrame) return;
    const more = [];
    if (auditFrame.scrollTop > 4) more.push('up');
    if (auditFrame.scrollTop + auditFrame.clientHeight < auditFrame.scrollHeight - 4) more.push('down');
    auditFrame.dataset.more = more.join(' ');
  }
  // The edges only show while scrolling, and fade away shortly after it stops.
  let auditScrollIdle = 0;
  auditFrame?.addEventListener('scroll', () => {
    markAuditEdges();
    auditFrame.dataset.scrolling = '1';
    clearTimeout(auditScrollIdle);
    auditScrollIdle = setTimeout(() => { delete auditFrame.dataset.scrolling; }, 450);
  }, { passive: true });
  if (auditFrame && typeof ResizeObserver === 'function') {
    const watch = new ResizeObserver(markAuditEdges);
    watch.observe(auditFrame);
    if ($('#historyTableBody')) watch.observe($('#historyTableBody'));
  }
  const searchHistory = searchAfterPause(() => flipMove(dom.historyTableBody, () => renderHistory()));
  dom.historySearchInput?.addEventListener('input', () => {
    state.historySearch = dom.historySearchInput.value;
    state.historyPage = 1;
    searchHistory();
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
    switchPanel('filesPanel', true); // approvals are the tray at the top of Files
    requestAnimationFrame(() => $('#approvalTray')?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' }));
  });
  async function activateNotification(item) {
    if (!item) return;
    toggleNotifications(false);
    if (item.classList.contains('is-unread')) markNotificationsRead(item.dataset.id.split(',').filter(Boolean));
    // An approval request opens that list to review; an update opens the list's current prices.
    const summary = item.dataset.versionId ? versionSummaryById(item.dataset.versionId) : null;
    const target = summary ? (item.dataset.type === 'approval_request' ? summary : liveRevisionOf(summary) || summary) : null;
    if (target) {
      try { await openVersion(target.id); } catch (error) { toast(error.message); }
    } else {
      toast('That price list is no longer available.');
    }
  }
  dom.notificationsList?.addEventListener('click', event => activateNotification(event.target.closest('.notification-item')));
  dom.notificationsList?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activateNotification(event.target.closest('.notification-item'));
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
    }
    dom.percentage.value = 0;
    updateMetrics();
    renderTable();
    rollPrices(pricesBefore);
    toast(state.active?.isDraft ? 'Price adjustments cleared. Other edits are kept.' : 'Prices are back to how they were when you opened the list.');
  });

  // --- Spreadsheet Event Listeners ---
  dom.table?.addEventListener('click', event => {
    // Search shortcuts on a product-group row.
    const keywordAdd = event.target.closest('.gk-add');
    if (keywordAdd) { event.stopPropagation(); return startGroupKeywordInput(keywordAdd.closest('.group-keywords')); }
    const keywordRemove = event.target.closest('.gk-remove');
    if (keywordRemove) {
      event.stopPropagation();
      const box = keywordRemove.closest('.group-keywords');
      const keep = groupKeywords(box.dataset.category, box.dataset.group).filter(keyword => keyword !== keywordRemove.dataset.keyword);
      const chipSnap = snapForTrash(keywordRemove.closest('.gk-chip'));
      saveGroupKeywords(box.dataset.category, box.dataset.group, keep).then(() => trashToast(`Removed "${keywordRemove.dataset.keyword}" from ${box.dataset.group}.`, chipSnap)).catch(error => toast(error.message));
      return;
    }
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
      // Use the click's original path: clicking a cell's text starts editing, which replaces that
      // text, so event.target is no longer inside the table by the time the click gets here.
      const path = event.composedPath();
      const inTable = path.includes(dom.table);
      const inFormula = path.some(node => node.id === 'excelFormulaBar');
      const inDialog = path.some(node => node.tagName === 'DIALOG');
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
    const row = remove.closest('.staged-row');
    const drop = () => morphUploadWindow(() => { stagedFiles.splice(Number(remove.dataset.index), 1); renderStagedFiles(); });
    if (!row || reducedMotion()) return drop();
    // The row slides out first, then the window settles to its new size.
    remove.disabled = true;
    const out = row.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(14px)' }], { duration: 200, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' });
    Promise.race([out.finished.catch(() => { }), new Promise(resolve => setTimeout(resolve, 260))]).then(drop);
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
    if (stagedFiles.some(item => item.check === 'checking')) return;
    if (stagedFiles.every(item => item.status === 'saved' || item.status === 'failed' || (item.check === 'bad' && stagedFiles.some(other => other.status)))) {
      const hasSaved = stagedFiles.some(item => item.status === 'saved');
      closeUploadModal();
      if (hasSaved) switchPanel('filesPanel', true);
      return;
    }
    const problem = validateStagedFiles();
    if (problem) return toast(problem);
    if (!stagedFiles.some(item => item.check === 'ok')) return;
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
        item.status = 'failed'; item.message = err.message || 'Failed to process Excel workbook.'; item.problems = err.problems || [];
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
      case 'discard_changes': // a file with a cross: changes that were not saved
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9.5" y1="12.5" x2="14.5" y2="17.5"/><line x1="14.5" y1="12.5" x2="9.5" y2="17.5"/></svg>`;
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

  // --- Notification bell: "Needs your action" (approvals waiting for you) and "Updates" (one row
  // per price list, newest first, with a count of earlier updates instead of repeats). ---
  const NOTIFICATION_KINDS = {
    approval_request: 'Approval needed', approved: 'Approved', partial_approval: 'Partly approved', rejected: 'Rejected',
  };
  const notifiedStale = new Set(); // stale requests already sent to be marked read
  function notificationKind(item) {
    if (item.type === 'available') return /^new price list/i.test(item.title || '') ? 'New price list' : 'Ready to export';
    return NOTIFICATION_KINDS[item.type] || 'Update';
  }
  function notificationListName(item) {
    const summary = item.versionId ? versionSummaryById(item.versionId) : null;
    return summary?.name || String(item.title || 'Notification').replace(/^[^:]+:\s*/, '');
  }
  function notificationGroupKey(item) {
    const summary = item.versionId ? versionSummaryById(item.versionId) : null;
    return summary ? [summary.name, summary.country, summary.priceLevel].map(part => String(part || '').trim().toLowerCase()).join('|') : `title:${notificationListName(item).toLowerCase()}`;
  }
  /** A short second line: the reason for a rejection, otherwise where the list applies. */
  function notificationDetail(item) {
    if (item.type === 'rejected') {
      const reason = String(item.message || '').split(/Reason:\s*/)[1];
      if (reason) return `Reason: ${reason}`;
    }
    const summary = item.versionId ? versionSummaryById(item.versionId) : null;
    if (item.type === 'approval_request' && summary) return `Saved by ${summary.savedBy || 'a user'} · ${[summary.country, summary.priceLevel].filter(Boolean).join(' · ')}`;
    if (summary) return [summary.country, summary.priceLevel].filter(Boolean).join(' · ');
    return String(item.message || '');
  }
  function renderNotifications() {
    const items = state.notifications || [];
    // An approval request is actionable only while its list is still waiting for this user.
    const actionable = item => item.type === 'approval_request' && Boolean(versionSummaryById(item.versionId)?.canApprove);
    const stale = items.filter(item => item.type === 'approval_request' && !item.read && !actionable(item) && !notifiedStale.has(item.id));
    if (stale.length) {
      // Requests that were already decided elsewhere clear themselves.
      stale.forEach(item => notifiedStale.add(item.id));
      markNotificationsRead(stale.map(item => item.id));
    }
    const unread = Math.max(0, Number(state.unreadCount || 0) - stale.length);
    if (dom.notificationBadge) {
      dom.notificationBadge.hidden = unread === 0;
      dom.notificationBadge.textContent = unread > 99 ? '99+' : String(unread);
    }
    if (dom.notificationsCountBadge) {
      dom.notificationsCountBadge.textContent = unread ? `${unread} new` : 'All caught up';
      dom.notificationsCountBadge.classList.toggle('is-quiet', !unread);
    }
    if (dom.markAllReadBtn) dom.markAllReadBtn.hidden = !unread;
    const actions = items.filter(actionable);
    // Updates: everything else, one row per price list (newest first).
    const groups = new Map();
    items.filter(item => !actionable(item) && item.type !== 'approval_request').forEach(item => {
      const key = notificationGroupKey(item);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    const footer = $('#notificationsDropdown .notifications-footer');
    if (footer) footer.hidden = !actions.length;
    const footerLabel = $('#openAuditLogsFromBell span');
    if (footerLabel) footerLabel.textContent = `Review ${actions.length} approval${actions.length === 1 ? '' : 's'}`;
    if (!dom.notificationsList) return;
    const empty = !actions.length && !groups.size;
    if (dom.notificationsEmpty) dom.notificationsEmpty.hidden = !empty;
    if (empty) { dom.notificationsList.innerHTML = ''; return; }
    const row = (item, { ids = [item.id], earlier = 0, unreadRow = !item.read, review = false } = {}) => `
        <div class="notification-item ${unreadRow ? 'is-unread' : ''}" data-type="${escapeHtml(item.type || 'info')}" data-id="${escapeHtml(ids.join(','))}" data-version-id="${escapeHtml(item.versionId || '')}" role="button" tabindex="0" title="${escapeHtml(item.message || '')}">
          <div class="notification-icon-wrap" aria-hidden="true">${getNotificationIcon(item.type)}</div>
          <div class="notification-content">
            <div class="notification-row-top">
              <span class="notification-actor">${escapeHtml(notificationListName(item))}</span>
              <time class="notification-time" datetime="${escapeHtml(item.createdAt || '')}">${formatRelativeTime(item.createdAt)}</time>
            </div>
            <div class="notification-meta"><span class="notification-kind kind-${escapeHtml(item.type || 'info')}">${escapeHtml(notificationKind(item))}</span>${earlier ? `<span class="notification-earlier">+${earlier} earlier</span>` : ''}</div>
            <div class="notification-details-text">${escapeHtml(notificationDetail(item))}</div>
          </div>
          ${review ? '<span class="notification-review" aria-hidden="true">Review</span>' : ''}
        </div>`;
    dom.notificationsList.innerHTML =
      (actions.length ? `<p class="notifications-section-title">Needs your action <span>${actions.length}</span></p>${actions.map(item => row(item, { unreadRow: true, review: true })).join('')}` : '')
      + (groups.size ? `<p class="notifications-section-title">Updates</p>${[...groups.values()].map(list => row(list[0], { ids: list.map(item => item.id), earlier: list.length - 1, unreadRow: list.some(item => !item.read) })).join('')}` : '');
  }


  async function markNotificationsRead(ids = null) {
    try {
      const data = await api('notifications-read', { method: 'POST', body: JSON.stringify({ ids }) });
      state.notifications = data.notifications || [];
      state.unreadCount = Number(data.unreadCount || 0);
      renderNotifications();
    } catch { }
  }

  /**
   * Edits are logged when they are saved (the save entry has every change), so unsaved work only shows
   * up in the audit log if it is thrown away: one entry saying what was not saved.
   */
  function logDiscardedChanges(list) {
    if (!list?.isDraft) return;
    const edits = (list.pendingChanges || []).length;
    const signedRate = value => `${Number(value) > 0 ? '+' : ''}${Number(value)}%`;
    const adjustments = Object.entries(list.categoryAdjustments || {}).filter(([, value]) => Number(value)).map(([category, value]) => `${category} ${signedRate(value)}`);
    if (!adjustments.length && Number(list.adjustment)) adjustments.push(`All categories ${signedRate(list.adjustment)}`);
    const parts = [adjustments.length ? `price adjustments (${adjustments.join(', ')})` : '', edits ? `${edits} cell edit${edits === 1 ? '' : 's'}` : ''].filter(Boolean);
    logActivity('discard_changes', `Discarded unsaved changes to '${list.name || 'a price list'}'`,
      parts.length ? `Not saved: ${parts.join(' and ')}.` : 'The unsaved changes were not saved.',
      { fileName: list.name || '', versionId: list.id || '', country: list.country || '', priceLevel: list.priceLevel || '', cellEdits: edits, adjustments });
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
    // Each folder shows a little fan of its first photos (the plain folder icon when it is empty).
    const fan = photos => photos.length
      ? `<span class="folder-fan" aria-hidden="true">${photos.slice(0, 3).reverse().map(photo => `<img src="${photoAttr(mediaUrl(photo.imagePath))}" alt="" loading="lazy">`).join('')}</span>`
      : libraryFolderIcon;
    folders.innerHTML = [null, ...libraryFolderNames(), ''].map(folder => {
      const photos = filteredLibrary('', folder);
      const count = photos.length;
      const active = folder === null ? state.libraryFolder === null : state.libraryFolder !== null && folderKey(folder) === folderKey(state.libraryFolder);
      return `<button type="button" class="library-folder${active ? ' is-active' : ''}" data-library-folder="${photoAttr(folderValue(folder))}"${active ? ' aria-current="true"' : ''}>${fan(photos)}<span>${escapeHtml(folderLabel(folder))}</span><small>${count}</small></button>`;
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
    return `<div class="library-card ${selected ? 'is-selected' : ''} ${current ? 'is-current' : ''}" data-key="photo-${photoAttr(photo.id)}" data-photo-id="${photoAttr(photo.id)}" ${deletable ? 'role="group"' : `role="option" tabindex="0" aria-selected="${selected}"`} aria-label="${photoAttr(photo.name)}" title="${photoAttr(photo.name)}">
      <div class="library-thumb"><img src="${photoAttr(mediaUrl(photo.imagePath))}" alt="${photoAttr(photo.name)}" loading="lazy"></div>
      <div class="library-meta">
        ${deletable
          ? `<div class="library-name-row"><strong class="library-name" data-photo-id="${photoAttr(photo.id)}" title="Click to rename">${escapeHtml(photo.name)}</strong><button type="button" class="library-rename" data-photo-id="${photoAttr(photo.id)}" aria-label="Rename ${photoAttr(photo.name)}" title="Rename"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button></div>`
          : `<strong>${escapeHtml(photo.name)}</strong>`}
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
    // Searching with no results shows a message; otherwise the wall always starts with a blank
    // "Upload photos" print (uploads go to the open folder).
    const searching = Boolean(state.librarySearch.trim());
    $('#libraryEmpty').hidden = visible.length > 0 || !searching;
    if (!visible.length && searching) $('#libraryEmpty').innerHTML = '<h2>No matching photos</h2><p>Try another name or browse a different folder.</p>';
    grid.hidden = !visible.length && searching;
    const uploadPrint = searching ? '' : `<button type="button" class="library-upload-print" data-key="upload"><span class="library-upload-plus" aria-hidden="true">+</span><strong>Upload photos</strong><small>${state.libraryFolder === null ? 'JPG, PNG or WebP · up to 6 MB' : `Into ${escapeHtml(folderLabel(state.libraryFolder))}`}</small></button>`;
    grid.innerHTML = uploadPrint + visible.map(photo => photoCardMarkup(photo, { deletable: true })).join('');
  }
  /** Moves the Config section highlight (Photo library / Product type photos / Countries & price levels) under the active one. */
  function placeConfigGlider(glide = true) {
    const active = $('.config-section-btn.is-active');
    const glider = $('.config-sections-glider');
    if (!active || !glider || !active.offsetParent) return;
    const frame = { width: `${active.offsetWidth}px`, transform: `translateX(${active.offsetLeft}px)` };
    const from = { width: glider.style.width, transform: glider.style.transform };
    Object.assign(glider.style, frame);
    if (glide && from.width && from.transform !== frame.transform && !reducedMotion()) glider.animate([from, frame], { duration: 480, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
  }
  window.addEventListener('resize', () => placeConfigGlider(false));
  // Config has three sections in one switcher (no second row of tabs), so its content starts high.
  const CONFIG_SECTIONS = {
    library: { title: 'Photo library', subtitle: 'Category folders of product photos, ready to pick for each product type.', card: '#libraryCard' },
    types: { title: 'Product type photos', subtitle: 'The photo shown for each product type in the price list and the PDF.', card: '#typesCard' },
    lists: { title: 'Countries & price levels', subtitle: 'The choices offered when uploading and saving price lists.', card: '#listsCard' },
  };
  function switchConfigTab(tab) {
    if (!CONFIG_SECTIONS[tab]) tab = 'library';
    const previous = state.configTab;
    try { sessionStorage.setItem(CONFIG_TAB_KEY, tab); } catch { }
    state.configTab = tab;
    $$('.config-section-btn').forEach(button => {
      const active = button.dataset.configSection === tab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    requestAnimationFrame(() => placeConfigGlider(true));
    Object.entries(CONFIG_SECTIONS).forEach(([key, section]) => { $(section.card).hidden = key !== tab; });
    $('#configTitle').textContent = CONFIG_SECTIONS[tab].title;
    $('#configSubtitle').textContent = CONFIG_SECTIONS[tab].subtitle;
    // Changing section: its content glides in from the side of the section chosen.
    const order = Object.keys(CONFIG_SECTIONS);
    if (previous && previous !== tab && !reducedMotion()) {
      const fromRight = order.indexOf(tab) > order.indexOf(previous);
      const card = $(CONFIG_SECTIONS[tab].card);
      requestAnimationFrame(() => card.animate(
        [{ opacity: 0, transform: `translate3d(${fromRight ? 24 : -24}px, 0, 0)` }, { opacity: 1, offset: 0.35 }, { opacity: 1, transform: 'none' }],
        { duration: 560, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' }));
    }
    if (tab === 'library') renderLibrary(); else if (tab === 'types') renderImageSettings(); else renderListOptions();
  }
  $$('.config-section-btn').forEach(button => button.addEventListener('click', () => {
    if (!button.classList.contains('is-active')) switchConfigTab(button.dataset.configSection);
  }));

  // --- Config › Countries & price levels: the choices in the upload and save dropdowns. Switching
  // one off hides it for new price lists; names used by saved lists can't be removed or renamed. ---
  const optionSearch = { countries: '' };
  let optionEditing = null; // "type|index" of the row whose name/description is being edited
  /** Inside of every on/off switch: the knob (the button itself is the track). */
  const SWITCH_PARTS = '<i class="switch-knob" aria-hidden="true"></i>';
  /** Slides a switch over before its list re-renders (the re-render would otherwise make it jump). */
  function flipSwitch(button) {
    button.setAttribute('aria-checked', String(button.getAttribute('aria-checked') !== 'true'));
    return new Promise(resolve => setTimeout(resolve, reducedMotion() ? 0 : 320));
  }
  /** Search: results update once you pause typing, not on every letter. */
  function searchAfterPause(run, wait = 140) {
    let timer = 0;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => run(...args), wait); };
  }
  /**
   * Re-renders a container as if its items were filtered in place (FLIP): items that stay glide to
   * their new spot without blinking, items that leave fade and shrink away where they were, and
   * items that arrive fade in gently. Items are the outermost [data-key] elements. Movement uses the
   * separate translate/scale properties, so an item's own transform (like a photo's tilt) is kept.
   */
  function flipMove(container, render, { exits = true } = {}) {
    if (!container) return render();
    const items = () => [...container.querySelectorAll('[data-key]')].filter(el => {
      const outer = el.parentElement?.closest('[data-key]');
      return !outer || !container.contains(outer);
    });
    const before = new Map();
    items().forEach(el => before.set(el.dataset.key, { el, box: el.getBoundingClientRect(), tilt: getComputedStyle(el).getPropertyValue('--tilt') }));
    render();
    if (!before.size || reducedMotion()) return;
    const view = container.getBoundingClientRect();
    const stays = new Set();
    let arriving = 0;
    items().forEach(el => {
      const key = el.dataset.key;
      stays.add(key);
      const old = before.get(key);
      if (!old) {
        el.animate([{ opacity: 0, scale: '0.96' }, { opacity: 1, scale: '1' }], { duration: 300, delay: 90 + Math.min(arriving++, 8) * 20, easing: FOLDER_EASE, fill: 'backwards' });
        return;
      }
      const now = el.getBoundingClientRect();
      const dx = old.box.left - now.left, dy = old.box.top - now.top;
      // A tilted card (photo prints) eases into the tilt of its new spot instead of snapping.
      const turn = (parseFloat(old.tilt) || 0) - (parseFloat(getComputedStyle(el).getPropertyValue('--tilt')) || 0);
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5 || Math.abs(turn) > 0.05) {
        el.animate([{ translate: `${dx}px ${dy}px`, rotate: `${turn}deg` }, { translate: '0px 0px', rotate: '0deg' }], { duration: 440, easing: FOLDER_EASE });
      }
    });
    if (!exits) return;
    // Leaving items: a copy stays where it was for a moment and fades away.
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    const host = container.getBoundingClientRect();
    before.forEach(({ el, box, tilt }, key) => {
      if (stays.has(key) || box.bottom < view.top || box.top > view.bottom || !box.height) return;
      const ghost = el.cloneNode(true);
      ghost.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
      ghost.removeAttribute('id');
      ghost.removeAttribute('data-key');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.inert = true;
      Object.assign(ghost.style, {
        position: 'absolute', margin: '0', pointerEvents: 'none', zIndex: '0', boxSizing: 'border-box',
        left: `${box.left - host.left - container.clientLeft + container.scrollLeft}px`,
        top: `${box.top - host.top - container.clientTop + container.scrollTop}px`,
        width: `${box.width}px`, height: `${box.height}px`,
      });
      if (tilt) ghost.style.setProperty('--tilt', tilt);
      container.append(ghost);
      const out = ghost.animate([{ opacity: 1, scale: '1' }, { opacity: 0, scale: '0.94' }], { duration: 220, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' });
      const remove = () => ghost.remove();
      out.finished.then(remove, remove);
      setTimeout(remove, 400);
    });
  }
  // Countries are floating tiles, each tinted with its own color (from the name).
  const countryHue = name => [...name].reduce((hue, char) => (hue * 31 + char.charCodeAt(0)) % 360, 7);
  const optionSwitch = item => `<button type="button" class="option-toggle" role="switch" aria-checked="${item.active}" data-option-action="toggle" aria-label="${item.active ? 'Switch off' : 'Switch on'} ${escapeHtml(item.name)}" title="${item.active ? 'Offered for new price lists. Click to switch off.' : 'Switched off. Click to offer it again.'}">${SWITCH_PARTS}</button>`;
  const optionUsage = item => `<span class="option-usage ${item.usedBy > 0 ? 'is-used' : ''}">${item.usedBy > 0 ? `${item.usedBy} list${item.usedBy === 1 ? '' : 's'}` : 'Not used'}</span>`;
  function optionText(item, levels, editing) {
    const used = item.usedBy > 0;
    return editing
      ? `<input class="option-name-input" value="${escapeHtml(item.name)}" maxlength="80" aria-label="Name" ${used ? 'disabled title="Used by saved price lists, so the name stays"' : ''}>${levels ? `<input class="option-desc-input" value="${escapeHtml(item.description || '')}" maxlength="200" placeholder="What is this level for? (optional)" aria-label="Description">` : ''}`
      : `<strong title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</strong>${levels ? `<small>${item.description ? escapeHtml(item.description) : '<em>No description</em>'}</small>` : ''}`;
  }
  function optionTools(item, index, count, levels, editing) {
    if (editing) return '<button type="button" class="button primary" data-option-action="save">Save</button><button type="button" class="button secondary" data-option-action="cancel">Cancel</button>';
    const used = item.usedBy > 0;
    return `${levels ? `<button type="button" class="option-icon" data-option-action="up" aria-label="Move ${escapeHtml(item.name)} up" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" class="option-icon" data-option-action="down" aria-label="Move ${escapeHtml(item.name)} down" ${index === count - 1 ? 'disabled' : ''}>↓</button>` : ''}<button type="button" class="option-icon" data-option-action="edit" aria-label="Edit ${escapeHtml(item.name)}" title="Edit">✎</button><button type="button" class="option-icon danger" data-option-action="remove" aria-label="Remove ${escapeHtml(item.name)}" ${used ? `disabled title="Used by ${item.usedBy} price list${item.usedBy === 1 ? '' : 's'}: switch it off instead"` : 'title="Remove"'}>×</button>`;
  }
  // Countries are cards with their flag (assets/flags, matched by name via scripts/country-flags.js),
  // name and code; an A–Z index on the side jumps to a letter. Hover a card for its ×; a country
  // used by saved price lists says so instead, and stays.
  const countryView = { tab: 'all' };
  const COUNTRY_LOOKUP = new Map(Object.entries(window.PLA_COUNTRY_CODES || {}).map(([name, code]) => [name.toLowerCase(), { name, code }]));
  const countryCodeOf = name => COUNTRY_LOOKUP.get(String(name || '').trim().toLowerCase())?.code || '';
  const flagMarkup = (name, code) => code
    ? `<img src="../assets/flags/${code}.svg" alt="" loading="lazy">`
    : `<span class="flag-fallback" style="--tile-hue: ${countryHue(name)}">${escapeHtml(String(name || '?').trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase())}</span>`;
  function countryCard(item, index) {
    const name = escapeHtml(item.name);
    const code = countryCodeOf(item.name);
    const used = item.usedBy > 0;
    const uses = `${item.usedBy} price list${item.usedBy === 1 ? '' : 's'}`;
    return `<div class="option-row country-card ${used ? 'is-used' : ''}" data-index="${index}" data-key="${name}" ${used ? `title="Used by ${uses}, so it stays"` : ''}>
      <span class="country-flag" aria-hidden="true">${flagMarkup(item.name, code)}</span>
      <span class="country-text"><strong title="${name}">${name}</strong><small>${code ? code.toUpperCase() : 'No flag'}${used ? ` · <em>${uses}</em>` : ''}</small></span>
      ${used ? '' : `<button type="button" class="country-remove" data-option-action="remove" aria-label="Remove ${name}" title="Remove ${name}">×</button>`}
    </div>`;
  }
  // Price levels are a ladder: numbered rungs in a straight column, in the order the dropdowns show them.
  function levelStep(item, index, count, editing) {
    return `<div class="option-row level-step ${item.active ? '' : 'is-off'} ${editing ? 'is-editing' : ''}" data-index="${index}" data-key="${escapeHtml(item.name)}">
      <span class="level-medal" aria-hidden="true">${index + 1}</span>
      <div class="level-card">
        <div class="option-main">${optionText(item, true, editing)}</div>
        ${editing ? '' : optionUsage(item)}
        <div class="option-actions">${optionTools(item, index, count, true, editing)}</div>
        ${optionSwitch(item)}
      </div>
    </div>`;
  }
  function renderListOptions() {
    const options = state.listOptions;
    if (!options) return;
    $$('#listsCard .option-list').forEach(section => {
      const type = section.dataset.optionType;
      const items = options[type] || [];
      const countries = type === 'countries';
      const off = countries ? 0 : items.filter(item => !item.active).length;
      section.querySelector('[data-option-summary]').textContent = `${items.length} ${countries ? 'countr' + (items.length === 1 ? 'y' : 'ies') : 'level' + (items.length === 1 ? '' : 's')}${off ? ` · ${off} switched off` : ''}`;
      const query = (optionSearch[type] || '').trim().toLowerCase();
      const rows = section.querySelector('[data-option-rows]');
      const visible = items.map((item, index) => ({ item, index })).filter(({ item }) =>
        (!query || item.name.toLowerCase().includes(query) || countryCodeOf(item.name) === query) &&
        (!countries || countryView.tab !== 'used' || item.usedBy > 0));
      flipMove(rows, () => {
        rows.innerHTML = (countries
          ? visible.map(({ item, index }) => countryCard(item, index)).join('')
          : visible.map(({ item, index }) => levelStep(item, index, items.length, optionEditing === `${type}|${index}`)).join(''))
          || `<p class="option-empty">${query ? 'No matches.' : countries && countryView.tab === 'used' ? 'No country is used by a price list yet.' : 'Nothing here yet.'}</p>`;
      });
      if (countries) {
        const showing = section.querySelector('[data-country-showing]');
        if (showing) showing.textContent = visible.length === items.length ? `${items.length} countr${items.length === 1 ? 'y' : 'ies'}` : `Showing ${visible.length} of ${items.length} countries`;
      }
      if (optionEditing?.startsWith(`${type}|`)) requestAnimationFrame(() => { const input = rows.querySelector('.is-editing input:not([disabled])'); input?.focus(); input?.select(); });
    });
  }
  async function saveListOptions(type, items, message, trash) {
    // Countries have no on/off any more: every country in the list is offered.
    const data = await api('list-options', { method: 'POST', body: JSON.stringify({ type, items: items.map(({ name, description, active }) => ({ name, description, active: type === 'countries' ? true : active })) }) });
    state.listOptions = { ...state.listOptions, [type]: data.items };
    if (type === 'countries') state.countries = data.active; else state.priceLevels = data.active;
    if (type === 'priceLevels') state.priceLevelInfo = data.items.map(({ name, description }) => ({ name, description }));
    optionEditing = null;
    renderListOptions();
    if (trash !== undefined) trashToast(message || data.message, trash); else toast(message || data.message);
  }
  async function changeListOptions(section, change, message, trash) {
    const type = section.dataset.optionType;
    const items = (state.listOptions[type] || []).map(item => ({ ...item }));
    if (change(items) === false) return;
    try { await saveListOptions(type, items, message, trash); } catch (error) { toast(error.message); renderListOptions(); }
  }
  $('#listsCard')?.addEventListener('click', event => {
    const button = event.target.closest('[data-option-action]');
    if (!button || button.disabled) return;
    const section = button.closest('.option-list');
    const type = section.dataset.optionType;
    const index = Number(button.closest('.option-row').dataset.index);
    const item = state.listOptions[type][index];
    const action = button.dataset.optionAction;
    if (action === 'edit') { optionEditing = `${type}|${index}`; return renderListOptions(); }
    if (action === 'cancel') { optionEditing = null; return renderListOptions(); }
    if (action === 'toggle') return flipSwitch(button).then(() => changeListOptions(section, items => { items[index].active = !items[index].active; }, `${item.name} ${item.active ? 'switched off for new price lists' : 'offered again'}.`));
    if (action === 'remove') {
      const snap = snapForTrash(button.closest('.option-row'));
      const remove = () => changeListOptions(section, items => { items.splice(index, 1); }, `${item.name} removed.`, snap);
      const chip = button.closest('.country-card');
      if (!chip || reducedMotion()) return remove();
      chip.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.6)' }], { duration: 220, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' });
      return setTimeout(remove, 200); // the chip shrinks away, then the list saves
    }
    if (action === 'up' || action === 'down') return changeListOptions(section, items => { const to = index + (action === 'up' ? -1 : 1); [items[index], items[to]] = [items[to], items[index]]; }, `${item.name} moved ${action}.`);
    if (action === 'save') {
      const row = button.closest('.option-row');
      const name = row.querySelector('.option-name-input').value.trim();
      const description = row.querySelector('.option-desc-input')?.value.trim() ?? item.description;
      if (!name) return toast('Enter a name.');
      return changeListOptions(section, items => { items[index] = { ...items[index], name, description }; }, `${name} saved.`);
    }
  });
  $('#listsCard')?.addEventListener('keydown', event => {
    if (!event.target.closest('.option-row.is-editing')) return;
    if (event.key === 'Enter') { event.preventDefault(); event.target.closest('.option-row').querySelector('[data-option-action="save"]').click(); }
    if (event.key === 'Escape') { event.preventDefault(); optionEditing = null; renderListOptions(); }
  });
  // --- Countries: tabs and the "Add country" row (suggests names and shows the flag). ---
  $$('#listsCard [data-country-tab]').forEach(tab => tab.addEventListener('click', () => {
    countryView.tab = tab.dataset.countryTab;
    $$('#listsCard [data-country-tab]').forEach(other => { other.classList.toggle('is-active', other === tab); other.setAttribute('aria-selected', String(other === tab)); });
    renderListOptions();
  }));
  const countryAddForm = $('#countryAddForm');
  function setCountryAdd(open) {
    if (!countryAddForm) return;
    countryAddForm.hidden = !open;
    $('#countryAddToggle')?.setAttribute('aria-expanded', String(open));
    if (open) {
      const list = $('#countryNameList');
      if (list && !list.childElementCount) list.innerHTML = [...COUNTRY_LOOKUP.values()].map(({ name }) => `<option value="${escapeHtml(name)}"></option>`).join('');
      countryAddForm.querySelector('input').focus();
    } else {
      countryAddForm.querySelector('input').value = '';
      showCountryAddFlag('');
    }
  }
  function showCountryAddFlag(name) {
    const holder = $('#countryAddFlag');
    if (!holder) return;
    const code = countryCodeOf(name);
    holder.innerHTML = code ? `<img src="../assets/flags/${code}.svg" alt="">` : '';
    holder.classList.toggle('has-flag', Boolean(code));
  }
  $('#countryAddToggle')?.addEventListener('click', () => setCountryAdd(countryAddForm.hidden));
  $('#countryAddClose')?.addEventListener('click', () => setCountryAdd(false));
  countryAddForm?.querySelector('input').addEventListener('input', event => showCountryAddFlag(event.target.value));
  countryAddForm?.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); setCountryAdd(false); } });
  $$('#listsCard [data-option-add]').forEach(form => form.addEventListener('submit', async event => {
    event.preventDefault();
    const input = form.querySelector('input');
    let name = input.value.trim().replace(/\s+/g, ' ');
    if (!name) return;
    const section = form.closest('.option-list');
    // A known country is saved with its usual spelling (so "japan" becomes "Japan" and gets its flag).
    if (section.dataset.optionType === 'countries') name = COUNTRY_LOOKUP.get(name.toLowerCase())?.name || name;
    if ((state.listOptions[section.dataset.optionType] || []).some(item => item.name.toLowerCase() === name.toLowerCase())) return toast(`${name} is already in the list.`);
    await changeListOptions(section, items => {
      if (section.dataset.optionType === 'countries') {
        // Countries stay alphabetical; price levels keep the order you set.
        items.push({ name, description: '', active: true, usedBy: 0 });
        items.sort((a, b) => a.name.localeCompare(b.name));
      } else items.push({ name, description: '', active: true, usedBy: 0 });
    }, `${name} added.`);
    input.value = '';
    if (form === countryAddForm) { showCountryAddFlag(''); input.focus(); } // stays open to add another
  }));
  // --- Users page (same flow as QRTS): look a person up by biometrics number in the master
  // list, choose a role, add. Change roles or turn access off in the list. You can't change your
  // own access, IT staff are automatic, and the last admin can't be removed. ---
  const ROLE_LABELS = { Admin: 'Admin', User: 'Export only' };
  let userAccounts = [];
  let lookedUp = null;
  let lookupTicket = 0;
  let usersSignature = ''; // the last list drawn, to skip redraws when nothing changed
  const initials = name => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  async function loadUsers() {
    try {
      const data = await api('users-list');
      setUsers(data.users || []);
    } catch (error) { toast(error.message); }
  }
  /** Rebuilds the table only when the list really changed, so reopening Users doesn't redraw it mid-slide. */
  function setUsers(list) {
    const signature = JSON.stringify(list);
    if (signature === usersSignature) return;
    usersSignature = signature;
    userAccounts = list;
    renderUsers();
  }
  // Access lanes: everyone is a small card in the lane of their access (Admins, Export only, No
  // access), so the board shows at a glance who can do what. Dragging a card to another lane changes
  // it; the ⋯ menu on each card does the same from the keyboard or a touch screen.
  const laneOf = account => (account.active ? account.role : 'off');
  const LANE_LABELS = { Admin: 'Admins', User: 'Export only', off: 'No access' };
  const LOCK_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  // Search: name, position, department, biometrics no., employee ID or username; matches are marked.
  let userQuery = '';
  const userWords = () => userQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const userHaystack = account => [account.name, account.position, account.department, account.biometricsId, account.employeeId, account.username].filter(Boolean).join(' ').toLowerCase();
  const userMatches = account => userWords().every(word => userHaystack(account).includes(word));
  function markMatches(text) {
    const safe = escapeHtml(text);
    const words = userWords().map(word => escapeHtml(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return words.length ? safe.replace(new RegExp(`(${words.join('|')})`, 'gi'), '<mark>$1</mark>') : safe;
  }
  function personCard(account) {
    const self = account.username === state.user?.username;
    const name = escapeHtml(account.name);
    const details = escapeHtml([account.position, account.department].filter(Boolean).join(' · ') || 'No department on file');
    const seen = account.lastLogin ? `Seen ${escapeHtml(formatRelativeTime(account.lastLogin))}` : 'Never signed in';
    // An access keycard: printed role on top, the chip and the holder, the magnetic stripe with the
    // biometrics number. Its colour is the lane (rack) it sits in.
    const lane = laneOf(account);
    const printed = { Admin: 'Admin access', User: 'Export only', off: 'Access paused' }[lane];
    return `<article class="person-card keycard ${self ? 'is-self' : ''}" data-id="${account.id}" data-key="user-${account.id}" ${self ? '' : 'draggable="true"'} aria-label="${name}, ${LANE_LABELS[lane]}">
      <div class="kc-top">
        <span class="kc-brand">LRN <b>${printed}</b></span>
        <svg class="kc-wave" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8.5 7.5a6 6 0 0 1 0 9"/><path d="M12 5a9.5 9.5 0 0 1 0 14"/><path d="M15.5 2.5a13 13 0 0 1 0 19"/></svg>
        ${self
          ? `<span class="person-lock" title="Your own access can’t be changed here. Ask another admin.">${LOCK_ICON}</span>`
          : `<button type="button" class="person-menu-btn" aria-haspopup="menu" aria-expanded="false" aria-label="Change access for ${name}" title="Change access"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></button>`}
      </div>
      <div class="kc-main">
        <span class="kc-chip" aria-hidden="true"></span>
        <span class="user-avatar person-avatar" aria-hidden="true">${escapeHtml(initials(account.name))}</span>
        <div class="person-info">
          <strong class="person-name"><span title="${name}">${markMatches(account.name)}</span>${self ? '<span class="person-you">You</span>' : ''}</strong>
          <small class="person-dept" title="${details}">${markMatches([account.position, account.department].filter(Boolean).join(' · ') || 'No department on file')}</small>
        </div>
      </div>
      <div class="kc-stripe"><small class="person-meta">${account.biometricsId ? `BIO ${markMatches(String(account.biometricsId))}` : 'NO BIO'}<span>${seen}</span></small></div>
    </article>`;
  }
  function renderUsers() {
    const board = $('#userBoard');
    if (!board) return;
    closePersonMenu();
    const active = userAccounts.filter(account => account.active).length;
    const searching = userWords().length > 0;
    const found = searching ? userAccounts.filter(userMatches).length : 0;
    $('#userListCount').textContent = searching
      ? `${found} of ${userAccounts.length} match “${userQuery.trim()}”`
      : `${active} with access${userAccounts.length > active ? ` · ${userAccounts.length - active} without` : ''}`;
    board.classList.toggle('is-searching', searching);
    flipMove(board, () => {
      $$('#userBoard .user-lane').forEach(lane => {
        const everyone = userAccounts.filter(account => laneOf(account) === lane.dataset.lane);
        const people = searching ? everyone.filter(userMatches) : everyone;
        lane.querySelector('[data-lane-cards]').innerHTML = people.map(personCard).join('')
          || (searching && everyone.length ? '<p class="lane-nomatch">No one here matches</p>' : '');
        lane.querySelector('[data-lane-count]').textContent = searching ? `${people.length}/${everyone.length}` : String(everyone.length);
        lane.classList.toggle('is-empty', !everyone.length);
      });
    });
  }
  /** Moves someone to a lane: the card glides there right away, then the server confirms (or it glides back). */
  /** A card that just moved racks: a light sweeps across it and the rack's reader blinks. */
  function swipeCard(id, lane) {
    if (reducedMotion()) return;
    const card = $(`#userBoard [data-key="user-${id}"]`);
    const rack = $(`#userBoard .user-lane[data-lane="${lane}"]`);
    [card, rack].forEach(el => { if (!el) return; el.classList.remove('is-swiped'); void el.offsetWidth; el.classList.add('is-swiped'); setTimeout(() => el.classList.remove('is-swiped'), 1100); });
  }
  async function moveUser(id, lane) {
    const account = userAccounts.find(item => item.id === id);
    if (!account || account.username === state.user?.username || laneOf(account) === lane) return;
    if (lane === 'off' && !(await confirmModal({ kicker: 'Remove access', title: `Remove ${account.name}'s access?`, text: 'They will no longer be able to sign in. Their saved work and history stay. You can give access back any time.', confirmLabel: 'Remove access' }))) return;
    const changes = lane === 'off' ? { active: false } : { role: lane, active: true };
    const before = userAccounts;
    userAccounts = userAccounts.map(item => (item.id === id ? { ...item, ...changes } : item));
    usersSignature = '';
    renderUsers();
    swipeCard(id, lane);
    try {
      const data = await api('users-update', { method: 'POST', body: JSON.stringify({ id, ...changes }) });
      setUsers(data.users || userAccounts);
      toast(data.message);
    } catch (error) {
      userAccounts = before;
      usersSignature = '';
      renderUsers();
      toast(error.message);
    }
  }

  const searchUsers = searchAfterPause(() => renderUsers());
  $('#userSearch')?.addEventListener('input', event => { userQuery = event.target.value; searchUsers(); });
  $('#userSearch')?.addEventListener('keydown', event => {
    if (event.key === 'Escape' && event.target.value) { event.preventDefault(); event.target.value = ''; userQuery = ''; renderUsers(); }
  });

  // Drag a card to another lane. The lanes it can go to light up; the one under the pointer says what a drop does.
  const userBoard = $('#userBoard');
  let draggingUserId = null;
  function endUserDrag() {
    draggingUserId = null;
    userBoard?.classList.remove('is-dragging');
    $$('#userBoard .is-dragging, #userBoard .is-over, #userBoard .is-source').forEach(el => el.classList.remove('is-dragging', 'is-over', 'is-source'));
  }
  userBoard?.addEventListener('dragstart', event => {
    const card = event.target.closest?.('.person-card[draggable="true"]');
    if (!card) return;
    draggingUserId = Number(card.dataset.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', card.dataset.id);
    closePersonMenu();
    card.closest('.user-lane').classList.add('is-source');
    requestAnimationFrame(() => { card.classList.add('is-dragging'); userBoard.classList.add('is-dragging'); });
  });
  userBoard?.addEventListener('dragover', event => {
    if (draggingUserId === null) return;
    const lane = event.target.closest('.user-lane');
    $$('#userBoard .user-lane.is-over').forEach(other => { if (other !== lane) other.classList.remove('is-over'); });
    if (!lane || lane.classList.contains('is-source')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    lane.classList.add('is-over');
  });
  userBoard?.addEventListener('dragleave', event => {
    const lane = event.target.closest('.user-lane');
    if (lane && !lane.contains(event.relatedTarget)) lane.classList.remove('is-over');
  });
  userBoard?.addEventListener('drop', event => {
    const lane = event.target.closest('.user-lane');
    const id = draggingUserId;
    if (!lane || id === null || lane.classList.contains('is-source')) return;
    event.preventDefault();
    endUserDrag();
    moveUser(id, lane.dataset.lane);
  });
  userBoard?.addEventListener('dragend', endUserDrag);

  // The ⋯ menu: the other two lanes, worded for this person.
  const personMenu = document.createElement('div');
  personMenu.className = 'person-menu';
  personMenu.setAttribute('role', 'menu');
  personMenu.hidden = true;
  document.body.append(personMenu);
  let personMenuButton = null;
  function closePersonMenu() {
    if (personMenu.hidden) return;
    personMenu.hidden = true;
    personMenuButton?.setAttribute('aria-expanded', 'false');
    personMenuButton?.closest('.person-card')?.classList.remove('has-menu');
    personMenuButton = null;
  }
  function openPersonMenu(button) {
    const account = userAccounts.find(item => item.id === Number(button.closest('.person-card').dataset.id));
    if (!account) return;
    if (personMenuButton === button) return closePersonMenu();
    closePersonMenu();
    const lane = laneOf(account);
    const first = account.name.split(/\s+/)[0];
    const options = [
      { lane: 'Admin', label: lane === 'off' ? 'Give admin access' : 'Make admin', hint: 'Upload, edit, approve, export and Config' },
      { lane: 'User', label: lane === 'off' ? 'Give export access' : 'Make export only', hint: 'View and export approved price lists' },
      { lane: 'off', label: 'Remove access', hint: `${first} can’t sign in; history stays` },
    ].filter(option => option.lane !== lane);
    personMenu.innerHTML = `<p class="person-menu-head">Move ${escapeHtml(first)} to…</p>${options.map(option => `<button type="button" role="menuitem" class="person-menu-item lane-${option.lane}" data-move="${option.lane}"><span class="lane-dot" aria-hidden="true"></span><span><strong>${escapeHtml(option.label)}</strong><small>${escapeHtml(option.hint)}</small></span></button>`).join('')}`;
    personMenu.dataset.id = String(account.id);
    personMenu.hidden = false;
    const rect = button.getBoundingClientRect();
    const width = personMenu.offsetWidth;
    const below = rect.bottom + 6 + personMenu.offsetHeight < window.innerHeight - 8;
    personMenu.style.left = `${Math.round(Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)))}px`;
    personMenu.style.top = `${Math.round(below ? rect.bottom + 6 : rect.top - 6 - personMenu.offsetHeight)}px`;
    personMenuButton = button;
    button.setAttribute('aria-expanded', 'true');
    button.closest('.person-card').classList.add('has-menu');
    if (!reducedMotion()) personMenu.animate([{ opacity: 0, transform: `translateY(${below ? -4 : 4}px) scale(0.98)` }, { opacity: 1, transform: 'none' }], { duration: 180, easing: FOLDER_EASE });
    personMenu.querySelector('.person-menu-item')?.focus({ preventScroll: true });
  }
  userBoard?.addEventListener('click', event => {
    const button = event.target.closest('.person-menu-btn');
    if (button) { event.stopPropagation(); openPersonMenu(button); }
  });
  personMenu.addEventListener('click', event => {
    const item = event.target.closest('[data-move]');
    if (!item) return;
    const id = Number(personMenu.dataset.id);
    const button = personMenuButton;
    closePersonMenu();
    button?.focus({ preventScroll: true });
    moveUser(id, item.dataset.move);
  });
  personMenu.addEventListener('keydown', event => {
    const items = [...personMenu.querySelectorAll('.person-menu-item')];
    const index = items.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus(); }
    if (event.key === 'Escape' || event.key === 'Tab') { const button = personMenuButton; closePersonMenu(); if (event.key === 'Escape') { event.preventDefault(); button?.focus({ preventScroll: true }); } }
  });
  document.addEventListener('click', event => { if (!personMenu.hidden && !personMenu.contains(event.target)) closePersonMenu(); });
  userBoard?.addEventListener('scroll', closePersonMenu, { passive: true });
  window.addEventListener('resize', closePersonMenu);

  // "+ Add" at the foot of a lane opens the lookup inside that lane, so the role is already chosen.
  let addRole = 'Admin';
  function resetLookup() {
    const result = $('#userLookupResult');
    result.getAnimations().forEach(anim => anim.cancel());
    result.hidden = true;
    result.innerHTML = '';
    $('#userLookupInput').value = '';
    lookedUp = null;
    lookupTicket++;
    setAddButton('');
  }
  function openAddPanel(role) {
    const panel = $('#userAddPanel');
    const lane = $(`#userBoard .user-lane[data-lane="${role}"]`);
    if (!panel || !lane) return;
    if (!panel.hidden && addRole === role) return $('#userLookupInput').focus();
    resetLookup();
    addRole = role;
    $('#userAddTitle').textContent = role === 'Admin' ? 'Issue an admin card' : 'Issue an export card';
    $$('#userBoard .lane-add').forEach(button => { button.hidden = button.dataset.addRole === role; });
    lane.insertBefore(panel, lane.querySelector('.lane-add'));
    panel.hidden = false;
    if (!reducedMotion()) {
      const height = panel.getBoundingClientRect().height;
      const grow = panel.animate([{ height: '0px', opacity: 0, transform: 'translateY(-6px)' }, { height: `${height}px`, opacity: 1, transform: 'none' }], { duration: 380, easing: FOLDER_EASE });
      panel.style.overflow = 'hidden';
      grow.finished.catch(() => {}).finally(() => { panel.style.overflow = ''; });
      setTimeout(() => { if (grow.playState === 'running') grow.finish(); }, 600);
    }
    $('#userLookupInput').focus({ preventScroll: true });
    panel.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }
  async function closeAddPanel() {
    const panel = $('#userAddPanel');
    if (!panel || panel.hidden) return;
    if (!reducedMotion()) {
      panel.style.overflow = 'hidden';
      const fold = panel.animate([{ height: `${panel.getBoundingClientRect().height}px`, opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 260, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' });
      await Promise.race([fold.finished.catch(() => {}), new Promise(resolve => setTimeout(resolve, 400))]);
      fold.cancel();
      panel.style.overflow = '';
    }
    panel.hidden = true;
    resetLookup();
    const button = $(`#userBoard .lane-add[data-add-role="${addRole}"]`);
    $$('#userBoard .lane-add').forEach(item => { item.hidden = false; });
    button?.focus({ preventScroll: true });
  }
  userBoard?.addEventListener('click', event => {
    const add = event.target.closest('.lane-add');
    if (add) openAddPanel(add.dataset.addRole);
  });
  $('#userAddPanel')?.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); closeAddPanel(); } });
  /**
   * Swaps the lookup card's content with one motion: the card eases to its new height (growing out
   * of the form when it first appears) while the new lines rise in one after another.
   */
  function morphLookup(update) {
    const box = $('#userLookupResult');
    const wasHidden = box.hidden;
    const fromHeight = wasHidden ? 0 : box.getBoundingClientRect().height;
    box.getAnimations().forEach(anim => anim.cancel());
    box.classList.remove('is-busy');
    update(box);
    box.hidden = false;
    if (reducedMotion()) return;
    const toHeight = box.getBoundingClientRect().height;
    const start = wasHidden
      ? { height: '0px', paddingTop: '0px', paddingBottom: '0px', marginTop: '-14px', opacity: 0, transform: 'scale(0.98)' }
      : { height: `${fromHeight}px` };
    const resize = box.animate([start, { height: `${toHeight}px`, paddingTop: '14px', paddingBottom: '14px', marginTop: '0px', opacity: 1, transform: 'none' }], { duration: 480, easing: FOLDER_EASE });
    box.classList.add('is-morphing');
    resize.finished.catch(() => {}).finally(() => box.classList.remove('is-morphing'));
    const lines = [...box.children].map((el, index) => el.animate(
      [{ opacity: 0, transform: 'translate3d(0, 10px, 0)' }, { opacity: 1, transform: 'translate3d(0, 0, 0)' }],
      { duration: 440, delay: 70 + index * 45, easing: FOLDER_EASE, fill: 'backwards' }
    ));
    setTimeout(() => [resize, ...lines].forEach(anim => anim.playState === 'running' && anim.finish()), 900); // lands even if frames pause
  }
  /** Folds the lookup card back into the form (after someone is added). */
  function closeLookup() {
    const box = $('#userLookupResult');
    if (box.hidden) return;
    box.getAnimations().forEach(anim => anim.cancel());
    if (reducedMotion()) { box.hidden = true; return; }
    box.classList.add('is-morphing');
    const fold = box.animate(
      [{ height: `${box.getBoundingClientRect().height}px`, opacity: 1 }, { height: '0px', paddingTop: '0px', paddingBottom: '0px', marginTop: '-14px', opacity: 0, transform: 'scale(0.98)' }],
      { duration: 380, easing: FOLDER_EASE, fill: 'forwards' }
    );
    fold.finished.then(() => { box.hidden = true; box.innerHTML = ''; box.getAnimations().forEach(anim => anim.cancel()); }).catch(() => {})
      .finally(() => box.classList.remove('is-morphing'));
    setTimeout(() => { if (fold.playState === 'running') fold.finish(); }, 600); // lands even if frames pause
  }
  function renderLookup(person, error = '') {
    morphLookup(box => fillLookup(box, person, error));
  }
  function fillLookup(box, person, error) {
    if (error) { box.innerHTML = `<p class="user-lookup-error">${escapeHtml(error)}</p>`; setAddButton(''); return; }
    const existing = person.account;
    const blocked = person.managedByIt ? 'IT department staff get admin access automatically when they sign in, so they aren’t added here.'
      : existing?.active ? `${person.name} already has access as ${ROLE_LABELS[existing.role] || existing.role}. Drag their card to change it.` : '';
    const warnings = [!person.employed ? 'Not an active employee in the master list.' : '', !person.hasLogin ? 'No company login yet: they can sign in once IT creates it.' : ''].filter(Boolean);
    box.innerHTML = `<div class="user-found">
        <span class="user-avatar large" aria-hidden="true">${escapeHtml(initials(person.name))}</span>
        <div class="user-found-info"><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml([person.position, person.department].filter(Boolean).join(' · ') || 'No position on file')}</small><small>Employee ${escapeHtml(person.employeeId)} · Bio ${escapeHtml(person.biometricsId)}</small></div>
      </div>
      ${warnings.map(text => `<p class="user-lookup-warning">${escapeHtml(text)}</p>`).join('')}
      ${blocked ? `<p class="user-lookup-note">${escapeHtml(blocked)}</p>` : ''}`;
    setAddButton(blocked ? '' : `${existing ? 'Give access back' : 'Add'} as ${addRole === 'Admin' ? 'admin' : 'export only'}`);
  }
  /** The footer's add button: shown (with its label) once someone who can be added is found. */
  function setAddButton(label) {
    const button = $('#userAddButton');
    if (!button) return;
    button.hidden = !label;
    button.disabled = false;
    if (label) button.textContent = label;
  }
  $('#userLookupForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const id = $('#userLookupInput').value.trim();
    if (!id) return;
    lookedUp = null;
    const ticket = ++lookupTicket; // a slower earlier reply can't overwrite this one
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.classList.add('is-loading');
    $('#userLookupResult').classList.add('is-busy'); // the previous card dims while the next one loads
    try {
      const response = await fetch(`../api/users/lookup.php?biometrics_id=${encodeURIComponent(id)}`, { headers: { 'X-CSRF-Token': state.csrf || '' } });
      const data = await response.json().catch(() => ({ ok: false, message: 'Invalid server response.' }));
      if (ticket !== lookupTicket) return;
      if (!data.ok) return renderLookup(null, data.message || 'Lookup failed.');
      lookedUp = data.person;
      renderLookup(lookedUp);
    } catch { if (ticket === lookupTicket) renderLookup(null, 'Could not reach the server.'); }
    finally { if (ticket === lookupTicket) button.classList.remove('is-loading'); }
  });
  $('#userAddCancel')?.addEventListener('click', closeAddPanel);
  $('#userAddButton')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    if (!lookedUp) return;
    button.disabled = true;
    try {
      const role = addRole; // the lane it was added from
      const data = await api('users-create', { method: 'POST', body: JSON.stringify({ biometricsId: lookedUp.biometricsId, role }) });
      setUsers(data.users || userAccounts);
      closeLookup();
      setTimeout(closeAddPanel, 260); // fold the panel away once the card has folded
      toast(data.message);
    } catch (error) { toast(error.message); button.disabled = false; }
  });

  const searchOptions = searchAfterPause(() => renderListOptions());
  $$('#listsCard [data-option-search]').forEach(input => input.addEventListener('input', () => {
    optionSearch[input.closest('.option-list').dataset.optionType] = input.value;
    searchOptions();
  }));

  // --- Search keywords, inline in the price table: each product-group row shows its shortcuts as
  // chips (everyone sees them as hints); admins add one with "+ keyword" and remove one with ×.
  // Saved on the server; group keywords also cover products added to the group later. ---
  function keywordEntryId(scope, category, group, code) {
    return scope === 'product' ? `product|${String(code).trim().toLowerCase()}` : `group|${String(category).trim().toLowerCase()}|${String(group).trim().toLowerCase()}`;
  }
  function groupKeywords(category, groupName) {
    const id = keywordEntryId('group', category, groupName);
    return (state.searchKeywords || []).find(entry => keywordEntryId(entry.scope, entry.category, entry.group, entry.code) === id)?.keywords || [];
  }
  /** Chips for a product-group row of the price table. */
  function groupKeywordsMarkup(category, groupName) {
    const keywords = groupKeywords(category, groupName);
    const editable = can('manageImages');
    if (!keywords.length && !editable) return '';
    const tokens = normalizeSearch(state.search).split(' ').filter(Boolean);
    const chips = keywords.map(keyword => {
      const matched = tokens.some(token => normalizeSearch(keyword).startsWith(token));
      return `<span class="gk-chip ${matched ? 'is-match' : ''}" title="Search shortcut">${escapeHtml(keyword)}${editable ? `<button type="button" class="gk-remove" data-keyword="${escapeHtml(keyword)}" aria-label="Remove shortcut ${escapeHtml(keyword)}">×</button>` : ''}</span>`;
    }).join('');
    return `<span class="group-keywords" data-category="${escapeHtml(category)}" data-group="${escapeHtml(groupName)}"><span class="gk-label">Shortcuts</span>${chips}${editable ? '<button type="button" class="gk-add" title="Add a search shortcut for this product group">+ keyword</button>' : ''}</span>`;
  }
  async function saveGroupKeywords(category, groupName, keywords) {
    const target = { scope: 'group', category, group: groupName, code: '' };
    const data = await api('search-keywords', { method: 'POST', body: JSON.stringify({ ...target, keywords: keywords.join(', ') }) });
    // A new array, so the search picks the change up at once.
    state.searchKeywords = [...(state.searchKeywords || []).filter(entry => keywordEntryId(entry.scope, entry.category, entry.group, entry.code) !== keywordEntryId('group', category, groupName)), ...(data.entry ? [data.entry] : [])];
    renderTable();
    return data;
  }
  /** "+ keyword" turns into a small field; Enter (or leaving it) saves, Esc cancels. */
  function startGroupKeywordInput(container) {
    if (container.querySelector('.gk-input')) return container.querySelector('.gk-input').focus();
    const add = container.querySelector('.gk-add');
    const input = document.createElement('input');
    input.className = 'gk-input';
    input.placeholder = 'e.g. ct, crs';
    input.setAttribute('aria-label', `New search shortcut for ${container.dataset.group}`);
    add.replaceWith(input);
    input.focus();
    let done = false;
    const finish = async save => {
      if (done) return;
      done = true;
      const added = input.value.split(',').map(value => value.trim()).filter(Boolean);
      if (!save || !added.length) return renderTable();
      input.disabled = true;
      try {
        const current = groupKeywords(container.dataset.category, container.dataset.group);
        await saveGroupKeywords(container.dataset.category, container.dataset.group, [...current, ...added]);
        toast(`Added ${added.map(keyword => `"${keyword}"`).join(', ')} to ${container.dataset.group}. Type it in Search to find these products.`);
      } catch (error) { toast(error.message); renderTable(); }
    };
    input.addEventListener('keydown', event => {
      event.stopPropagation(); // not the table's cell navigation
      if (event.key === 'Enter') { event.preventDefault(); finish(true); }
      if (event.key === 'Escape') { event.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
    ['click', 'dblclick', 'mousedown'].forEach(type => input.addEventListener(type, event => event.stopPropagation()));
  }
  const searchLibrary = searchAfterPause(() => flipMove($('#libraryGrid'), () => renderLibrary()));
  $('#librarySearchInput')?.addEventListener('input', event => { state.librarySearch = event.target.value; searchLibrary(); });
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

  // Renaming a photo in place: the name becomes a text box. Enter or clicking away saves, Esc cancels.
  function startPhotoRename(id) {
    const photo = (state.photoLibrary || []).find(item => item.id === id);
    const name = $(`#libraryGrid .library-name[data-photo-id="${CSS.escape(id)}"]`);
    if (!photo || !name || name.closest('.library-name-row').classList.contains('is-editing')) return;
    const row = name.closest('.library-name-row');
    row.classList.add('is-editing');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'library-name-input';
    input.maxLength = 200;
    input.value = photo.name;
    input.setAttribute('aria-label', 'Photo name');
    name.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const finish = async save => {
      if (done) return;
      done = true;
      const next = input.value.trim();
      if (!save || !next || next === photo.name) { if (save && !next) toast('A photo needs a name.'); return renderLibrary(); }
      input.disabled = true;
      try {
        const data = await api('library-rename', { method: 'POST', body: JSON.stringify({ id, name: next }) });
        state.photoLibrary = state.photoLibrary.map(item => (item.id === data.photo.id ? data.photo : item));
        toast(data.message);
      } catch (error) { toast(error.message); }
      renderLibrary();
    };
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); finish(true); }
      else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
  }
  $('#libraryGrid')?.addEventListener('click', event => {
    const trigger = event.target.closest('.library-rename, .library-name');
    if (!trigger) return;
    event.preventDefault();
    event.stopPropagation();
    startPhotoRename(trigger.dataset.photoId);
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
  // The blank print uploads into the folder that is open (or the chosen destination on All photos).
  $('#libraryGrid')?.addEventListener('click', event => {
    if (!event.target.closest('.library-upload-print')) return;
    if (state.libraryFolder !== null) { $('#libraryUploadFolder').value = folderValue(state.libraryFolder); updateLibraryUploadLabel(); }
    $('#libraryUploadButton').click();
  });
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
      const snap = snapForTrash(deleteButton.closest('.library-card'));
      state.photoLibrary = state.photoLibrary.filter(item => item.id !== photo.id);
      state.productImages = state.productImages.filter(image => image.libraryId !== photo.id);
      clearPdfImageCache();
      renderLibrary(); renderImageSettings();
      if (state.active) renderTable();
      trashToast(data.message, snap);
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
        await clearAllDrafts();
        openTabs.forEach(tab => { tab.dirty = false; });
        saveTabs();
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
