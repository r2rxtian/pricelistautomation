(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { user: window.__BOOT__.user, csrf: window.__BOOT__.csrf, canEdit: false, active: null, rows: [], headers: [], priceColumns: [], adjustment: 0, categoryAdjustments: {}, search: '', category: '', pending: null, pendingDelete: null, versions: [] };
  const money = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dom = {
    loginView: $('#loginView'), appView: $('#appView'), loginForm: $('#loginForm'), loginError: $('#loginError'), userName: $('#userName'), roleBadge: $('#roleBadge'), emptyState: $('#emptyState'), dataView: $('#dataView'), listTitle: $('#listTitle'), listMeta: $('#listMeta'), savedMeta: $('#savedMeta'), activeBadge: $('#activeBadge'), productCount: $('#productCount'), categoryCount: $('#categoryCount'), priceColumnCount: $('#priceColumnCount'), currentAdjustment: $('#currentAdjustment'), percentage: $('#percentage'), search: $('#searchInput'), category: $('#categorySelect'), table: $('#priceTable'), noResults: $('#noResults'), importDialog: $('#importDialog'), saveDialog: $('#saveDialog'), saveForm: $('#saveForm'), versionNameInput: $('#versionNameInput'), deleteDialog: $('#deleteDialog'), deleteVersionName: $('#deleteVersionName'), resetPricesDialog: $('#resetPricesDialog'), resetPricesForm: $('#resetPricesForm'), confirmResetPrices: $('#confirmResetPrices'), resetPricesButton: $('#resetPricesButton'), logoutDialog: $('#logoutDialog'), logoutForm: $('#logoutForm'), importFileName: $('#importFileName'), historyTable: $('#historyTable'), historyTableBody: $('#historyTableBody'), historyEmpty: $('#historyEmpty'), historyCount: $('#historyCount'), historySearchInput: $('#historySearchInput'), historyAdjustmentSelect: $('#historyAdjustmentSelect'), backToPricesBtn: $('#backToPricesBtn'), emptyGoToPricesBtn: $('#emptyGoToPricesBtn'), toast: $('#toast'), fileInput: $('#fileInput')
  };

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
    if (category && state.categoryAdjustments && state.categoryAdjustments[category] !== undefined) {
      return Number(state.categoryAdjustments[category]);
    }
    return Number(state.adjustment || 0);
  }
  function adjusted(value, category = state.category) {
    const number = Number(value);
    const adj = getCategoryAdjustment(category);
    return Number.isFinite(number) ? number * (1 + adj / 100) : value;
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

  function applyPermissions() { $$('.edit-only').forEach(element => element.hidden = !state.canEdit); }
  function setAppLoading(loading) { document.body.classList.toggle('is-booting', loading); document.body.classList.toggle('is-ready', !loading); }
  function showApp() {
    dom.loginView.hidden = true; dom.appView.hidden = false;
    dom.userName.textContent = state.user.name; dom.roleBadge.textContent = state.user.role; applyPermissions();
  }
  function setPriceEditor(open) {
    const button = $('#editButton');
    const popover = $('#adjustmentBar');
    if (!button || !popover) return;
    popover.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    button.textContent = open ? 'Close' : 'Edit prices';
    if (open) {
      dom.percentage.value = getCategoryAdjustment(state.category);
      const title = $('#adjustmentTitle');
      const subtitle = popover.querySelector('.edit-summary span');
      if (title && state.category) title.textContent = `Adjust ${state.category} prices`;
      if (subtitle && state.category) subtitle.textContent = `Applies percentage only to ${state.category}.`;
      requestAnimationFrame(() => dom.percentage.focus());
    }
  }
  async function loadState(skipDraftCheck = false) {
    const data = await api('state');
    Object.assign(state, { user: data.user, csrf: data.csrf, canEdit: data.canEdit, active: data.active, versions: data.versions || [] });
    let targetActive = data.active;
    let isRestoredDraft = false;
    if (!skipDraftCheck) {
      const draft = await getDraft(draftKey());
      if (draft && draft.rows && draft.rows.length) {
        targetActive = draft;
        isRestoredDraft = true;
      }
    }
    showApp(); loadActive(targetActive); renderHistory();
    setAppLoading(false);
    if (isRestoredDraft) toast('Restored unsaved draft workbook.');
  }
  function loadActive(active) {
    state.active = active;
    const metricGroup = $('#metricGroup');
    if (!active) {
      setPriceEditor(false); dom.emptyState.hidden = false; dom.dataView.hidden = true;
      if (metricGroup) metricGroup.hidden = true;
      dom.listTitle.textContent = 'Start with a workbook';
      dom.listMeta.textContent = 'Upload an .xlsx or .xls file to map its products and prices.';
      dom.savedMeta.textContent = ''; dom.activeBadge.hidden = true;
      $('#editButton').hidden = true; $('#saveButton').hidden = true;
      if (dom.resetPricesButton) dom.resetPricesButton.hidden = true;
      return;
    }
    if (metricGroup) metricGroup.hidden = false;
    state.headers = active.headers || [];
    state.rows = active.rows || [];
    state.priceColumns = (active.priceColumns || []).filter(index => /price\s*\/\s*(pc|box)/i.test(String(state.headers[index] || '')));
    state.adjustment = Number(active.adjustment || 0);
    state.categoryAdjustments = active.categoryAdjustments ? { ...active.categoryAdjustments } : {};
    $('#editButton').hidden = !state.canEdit;
    setPriceEditor(false);

    const categories = [...new Set(state.rows.map(row => String(row[0] ?? '')).filter(Boolean))].sort();
    dom.category.innerHTML = categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
    if (!state.category || !categories.includes(state.category)) {
      state.category = categories[0] || '';
    }
    dom.category.value = state.category;
    dom.percentage.value = getCategoryAdjustment(state.category);

    dom.emptyState.hidden = true; dom.dataView.hidden = false; dom.listTitle.textContent = 'Current file'; dom.listMeta.textContent = active.name;

    const isUnsaved = Boolean(active.isDraft || !active.id);
    if (isUnsaved) {
      dom.savedMeta.textContent = 'Imported workbook · Unsaved';
      dom.activeBadge.innerHTML = '<span class="pulse-dot warning" aria-hidden="true"><span class="pulse-ring"></span></span>Draft (Unsaved)';
      dom.activeBadge.classList.add('draft-badge');
    } else {
      dom.savedMeta.textContent = active.savedAt ? `Last saved ${displayDate(active.savedAt)} by ${active.savedBy}` : 'Imported workbook · Saved';
      dom.activeBadge.innerHTML = '<span class="pulse-dot" aria-hidden="true"><span class="pulse-ring"></span></span>Active';
      dom.activeBadge.classList.remove('draft-badge');
    }

    dom.activeBadge.hidden = false; $('#saveButton').hidden = !state.canEdit;
    updateMetrics(); renderTable();
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
      dom.resetPricesButton.hidden = !state.canEdit || !state.active || !hasPriceAdjustments();
    }
  }
  function filteredRows() {
    const query = state.search.trim().toLowerCase();
    return state.rows.map((row, index) => ({ row, index })).filter(({ row }) => (!state.category || String(row[0] ?? '') === state.category) && (!query || row.some(value => String(value ?? '').toLowerCase().includes(query))));
  }
  function groupVisual(category, groupName, items) {
    const text = `${category} ${groupName}`.toLowerCase();
    if (/presentation|stand|display|acrylic|holder|buffet/i.test(text)) {
      return `<img class="group-photo-img" src="assets/products/presentation.jpg" alt="${escapeHtml(groupName || 'Presentation Stands')}" loading="lazy">`;
    }
    if (/bread|baguette|roll|sourdough|loaf|bun/i.test(text)) {
      return `<img class="group-photo-img" src="assets/products/breads.jpg" alt="${escapeHtml(groupName || 'Breads')}" loading="lazy">`;
    }
    if (/cone/i.test(text)) {
      return `<img class="group-photo-img" src="assets/products/cones.jpg" alt="${escapeHtml(groupName || 'Cones')}" loading="lazy">`;
    }
    if (/tart|shell|pie/i.test(text)) {
      return `<img class="group-photo-img" src="assets/products/tarts.jpg" alt="${escapeHtml(groupName || 'Tart Shells')}" loading="lazy">`;
    }
    if (/chocolate|praline|bonbon|truffle/i.test(text)) {
      return `<img class="group-photo-img" src="assets/products/chocolates.jpg" alt="${escapeHtml(groupName || 'Chocolates')}" loading="lazy">`;
    }
    if (/macaron/i.test(text)) {
      return `<img class="group-photo-img" src="assets/products/macarons.jpg" alt="${escapeHtml(groupName || 'Macarons')}" loading="lazy">`;
    }
    if (/basket|spoon|savory|canape/i.test(text)) {
      return `<img class="group-photo-img" src="assets/products/savory.jpg" alt="${escapeHtml(groupName || 'Savory & Baskets')}" loading="lazy">`;
    }
    if (/pastry|pastries|cake|choux|eclair|dessert/i.test(text)) {
      return `<img class="group-photo-img" src="assets/products/pastries.jpg" alt="${escapeHtml(groupName || 'Pastries')}" loading="lazy">`;
    }
    return `<img class="group-photo-img" src="assets/products/gourmet.jpg" alt="${escapeHtml(groupName || category || 'Gourmet Selection')}" loading="lazy">`;
  }
  function renderTable() {
    const visible = filteredRows();
    const valueMarkup = (row, column) => { const raw = row[column] ?? '', price = state.priceColumns.includes(column) && isNumeric(raw), value = price ? adjusted(numeric(raw), String(row[0] ?? '')) : raw; return price ? money.format(value) : escapeHtml(raw).replace(/\r?\n/g, '<br>'); };
    const standardHeader = () => `
      <tr class="excel-header excel-header-primary">
        <th rowspan="3" class="col-photo-th"></th>
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
    const standardRow = (row, visibleIndex, isFirstInGroup, groupLength, category, groupName, groupItems) => {
      const formatPallet = val => {
        const s = String(val ?? '').trim();
        if (!s) return '';
        if (/pallet|box/i.test(s)) return escapeHtml(s);
        return isNumeric(s) ? `${s} Boxes/Pallet` : escapeHtml(s);
      };
      const photoCell = isFirstInGroup
        ? `<td class="group-photo-cell" rowspan="${groupLength}"><div class="group-photo-wrap">${groupVisual(category, groupName, groupItems)}</div></td>`
        : '';
      return `<tr class="excel-data-row" style="--row-delay:${Math.min(visibleIndex, 8) * 18}ms">
        ${photoCell}
        <td class="code-cell">${valueMarkup(row, 1)}</td>
        <td class="full-description">${valueMarkup(row, 2)}</td>
        <td>${valueMarkup(row, 4)}</td>
        <td>${valueMarkup(row, 5)}</td>
        <td>${valueMarkup(row, 6)}</td>
        <td>${valueMarkup(row, 7)}</td>
        <td class="price-cell changed">${valueMarkup(row, 8)}</td>
        <td class="price-cell changed">${valueMarkup(row, 9)}</td>
        <td class="col-pallet">${formatPallet(row[10])}</td>
        <td class="col-pallet">${formatPallet(row[11])}</td>
        <td class="col-pallet">${formatPallet(row[12])}</td>
      </tr>`;
    };
    const presentationRow = (row, visibleIndex, isFirstInGroup, groupLength, category, groupName, groupItems) => {
      const itemName = [row[2], row[3]].filter(value => String(value ?? '').trim()).map(value => escapeHtml(value).replace(/\r?\n/g, '<br>')).join('<br>');
      const moq = [row[15], row[16]].filter(value => String(value ?? '').trim()).map(value => escapeHtml(value).replace(/\r?\n/g, '<br>')).join('<br>');
      const photoCell = isFirstInGroup
        ? `<td class="group-photo-cell" rowspan="${groupLength}"><div class="group-photo-wrap">${groupVisual(category, groupName, groupItems)}</div></td>`
        : '';
      return `<tr class="excel-data-row presentation-row" style="--row-delay:${Math.min(visibleIndex, 8) * 18}ms">
        ${photoCell}
        <td class="code-cell">${valueMarkup(row, 1)}</td>
        <td class="full-description" colspan="2">${itemName}</td>
        <td>${valueMarkup(row, 6)}</td>
        <td class="price-cell changed">${valueMarkup(row, 8)}</td>
        <td class="price-cell changed">${valueMarkup(row, 9)}</td>
        <td>${valueMarkup(row, 13)}</td>
        <td>${valueMarkup(row, 14)}</td>
        <td>${valueMarkup(row, 7)}</td>
        <td>${moq}</td>
        <td>${valueMarkup(row, 17)}</td>
      </tr>`;
    };

    const groups = [];
    let curGroup = null;
    visible.forEach(({ row }, visibleIndex) => {
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
      curGroup.rows.push({ row, visibleIndex });
    });

    const firstIsPresentation = visible.length > 0 && String(visible[0].row[0] || '').toLowerCase() === 'presentation stands';
    $('thead', dom.table).innerHTML = firstIsPresentation ? presentationHeader() : standardHeader();
    $('tbody', dom.table).innerHTML = groups.map(group => {
      const isPresentation = String(group.category || '').toLowerCase() === 'presentation stands';
      const columnCount = isPresentation ? 11 : 12;
      const groupHeader = group.groupName
        ? `<tr class="product-group-row"><td colspan="${columnCount}" class="group-title-cell"><strong class="group-title-text">${escapeHtml(group.groupName)}</strong></td></tr>`
        : '';
      const rowsHtml = group.rows.map(({ row, visibleIndex }, indexInGroup) => {
        const isFirst = indexInGroup === 0;
        return isPresentation
          ? presentationRow(row, visibleIndex, isFirst, group.rows.length, group.category, group.groupName, group.rows)
          : standardRow(row, visibleIndex, isFirst, group.rows.length, group.category, group.groupName, group.rows);
      }).join('');
      return `${groupHeader}${rowsHtml}`;
    }).join('');
    dom.noResults.hidden = visible.length > 0;
  }
  function renderHistory() {
    if (!dom.historyTableBody) return;
    const query = (state.historySearch || '').trim().toLowerCase();
    const adjFilter = state.historyAdjustment || '';

    const filtered = (state.versions || []).filter(version => {
      const matchesQuery = !query ||
        String(version.name || '').toLowerCase().includes(query) ||
        String(version.savedBy || '').toLowerCase().includes(query) ||
        String(version.id || '').toLowerCase().includes(query);

      const adj = Number(version.adjustment || 0);
      let matchesAdj = true;
      if (adjFilter === 'positive') matchesAdj = adj > 0;
      else if (adjFilter === 'negative') matchesAdj = adj < 0;
      else if (adjFilter === 'zero') matchesAdj = adj === 0;

      return matchesQuery && matchesAdj;
    });

    if (dom.historyCount) {
      dom.historyCount.textContent = `${filtered.length} version${filtered.length === 1 ? '' : 's'}`;
    }

    if (!filtered.length) {
      dom.historyTableBody.innerHTML = '';
      if (dom.historyEmpty) dom.historyEmpty.hidden = false;
      return;
    }

    if (dom.historyEmpty) dom.historyEmpty.hidden = true;
    dom.historyTableBody.innerHTML = filtered.map((version, index) => {
      const hasSummary = version.summary && Array.isArray(version.summary.adjustedCategories) && version.summary.adjustedCategories.length > 0;
      const hasCatAdj = version.categoryAdjustments && Object.keys(version.categoryAdjustments).length > 0;
      let adjMarkup = '';
      if (hasSummary) {
        adjMarkup = version.summary.adjustedCategories.map(item => {
          const num = Number(item.adjustment || 0);
          const cls = num > 0 ? 'pos' : num < 0 ? 'neg' : 'zero';
          const sign = num > 0 ? '+' : '';
          const countTag = item.productCount ? ` <small class="adj-count" style="opacity:0.8; font-size:0.68rem;">(${item.productCount} pcs)</small>` : '';
          return `<span class="adjustment-pill ${cls}" style="margin: 2px 2px 2px 0; display: inline-block;">${escapeHtml(item.category)}: ${sign}${num}%${countTag}</span>`;
        }).join('');
      } else if (hasCatAdj) {
        adjMarkup = Object.entries(version.categoryAdjustments)
          .map(([cat, val]) => {
            const num = Number(val || 0);
            const cls = num > 0 ? 'pos' : num < 0 ? 'neg' : 'zero';
            const sign = num > 0 ? '+' : '';
            return `<span class="adjustment-pill ${cls}" style="margin: 2px 2px 2px 0; display: inline-block;">${escapeHtml(cat)}: ${sign}${num}%</span>`;
          }).join('');
      } else {
        const adj = Number(version.adjustment || 0);
        const adjClass = adj > 0 ? 'pos' : adj < 0 ? 'neg' : 'zero';
        const adjSign = adj > 0 ? '+' : '';
        adjMarkup = `<span class="adjustment-pill ${adjClass}">${adjSign}${adj}%</span>`;
      }
      const versionLabel = version.id ? escapeHtml(version.id.substring(0, 8)) : `v${filtered.length - index}`;
      return `
        <tr class="history-data-row">
          <td class="history-version-cell"><span class="version-tag">${versionLabel}</span></td>
          <td class="history-name-cell"><strong>${escapeHtml(version.name)}</strong></td>
          <td class="history-by-cell">${escapeHtml(version.savedBy)}</td>
          <td class="history-date-cell">${displayDate(version.savedAt)}</td>
          <td class="history-adj-cell">${adjMarkup}</td>
          <td class="history-actions-cell">
            <button class="button secondary open-version" data-id="${escapeHtml(version.id)}">Open</button>
            ${state.user.role === 'admin' ? `<button class="button danger delete-version" data-id="${escapeHtml(version.id)}" data-name="${escapeHtml(version.name)}">Delete</button>` : ''}
          </td>
        </tr>`;
    }).join('');
  }
  function openFilePicker() { dom.fileInput.value = ''; dom.fileInput.click(); }

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
    const headers = ['Worksheet', 'Code No', 'Description', '', 'Expiry Date', 'Weight   gr/pc', 'Pcs\n/box', 'Box Size', 'Price/pc    USD', 'Price/box in USD', 'Large Pallet\n(16 pallets)', 'Small Pallet\n(2 pallets)', 'Large Pallet\n(8 pallets)', 'NW(KG) / Box', 'GW(KG) / Box', 'MOQ', '', 'Total Price Based on MOQ', 'Product Group'];
    const products = [];
    const usedSheets = new Set();
    for (const sheetName of workbook.SheetNames) {
      const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: true });
      let map = null;
      let currentSection = sheetName;
      for (const row of matrix) {
        const labels = row.map(value => String(value ?? '').replace(/[\r\n]+/g, ' ').trim());
        const nonEmptyLabels = labels.filter(Boolean);
        if (nonEmptyLabels.length === 1 && nonEmptyLabels[0].length > 2 && !/price list|don't miss|la rose noire|homepage|facebook|instagram|twitter|tel:/i.test(nonEmptyLabels[0])) currentSection = nonEmptyLabels[0];
        const codeIndex = labels.findIndex(value => /(^|\s)(code no|lrn code)(\s|$)/i.test(value));
        const hasPrice = labels.some(value => /price\s*\/\s*(pc|box)|total price/i.test(value));
        if (codeIndex >= 0 && hasPrice) {
          const find = pattern => labels.findIndex(value => pattern.test(value));
          const palletStart = find(/pallet per container/i);
          map = {
            code: codeIndex,
            description: find(/description|item name/i),
            details: /presentation stands/i.test(sheetName) ? find(/item name/i) + 1 : -1,
            expiry: find(/expiry/i),
            weight: find(/weight/i),
            pieces: find(/pcs\s*\/\s*box|pc\s*\/\s*set/i),
            boxSize: find(/^box size$/i),
            unitPrice: find(/price\s*\/\s*pc/i),
            boxPrice: find(/price\s*\/\s*box/i),
            pallet40Large: palletStart,
            pallet40Small: palletStart >= 0 ? palletStart + 1 : -1,
            pallet20Large: palletStart >= 0 ? palletStart + 2 : -1,
            netWeight: find(/^nw/i),
            grossWeight: find(/^gw/i),
            moq: find(/^moq$/i),
            moqQuantity: find(/^moq$/i) >= 0 ? find(/^moq$/i) + 1 : -1,
            totalPrice: find(/total price/i),
          };
          continue;
        }
        if (!map) continue;
        const code = String(row[map.code] ?? '').trim();
        const unitPrice = map.unitPrice >= 0 ? row[map.unitPrice] : '';
        const boxPrice = map.boxPrice >= 0 ? row[map.boxPrice] : '';
        const totalPrice = map.totalPrice >= 0 ? row[map.totalPrice] : '';
        if (!code || ![unitPrice, boxPrice, totalPrice].some(isNumeric)) continue;
        const take = index => index >= 0 ? row[index] ?? '' : '';
        products.push([
          sheetName, code, take(map.description), take(map.details), take(map.expiry), take(map.weight),
          take(map.pieces), take(map.boxSize), unitPrice, boxPrice, take(map.pallet40Large),
          take(map.pallet40Small), take(map.pallet20Large), take(map.netWeight), take(map.grossWeight),
          take(map.moq), take(map.moqQuantity), totalPrice, currentSection
        ]);
        usedSheets.add(sheetName);
      }
    }
    if (!products.length) throw new Error('No product rows with price values were detected in this workbook.');
    const normalized = [headers, ...products];
    state.pending = { name: file.name.replace(/\.(xlsx|xls)$/i, ''), matrix: normalized, priceColumns: headers.map((header, index) => /price\s*\/\s*(pc|box)/i.test(header) ? index : -1).filter(index => index >= 0) };
    dom.importFileName.textContent = `${file.name} · ${products.length.toLocaleString()} products from ${usedSheets.size} worksheets`;
    dom.importDialog.showModal();
  }
  async function confirmImport(event) {
    event.preventDefault(); const headerIndex = 0; const rawHeaders = state.pending.matrix[headerIndex] || []; const width = Math.max(rawHeaders.length, ...state.pending.matrix.slice(headerIndex + 1).map(row => row.length));
    const headers = Array.from({ length: width }, (_, index) => String(rawHeaders[index] || `Column ${index + 1}`).trim());
    const priceColumns = state.pending.priceColumns;
    const rows = state.pending.matrix.slice(headerIndex + 1).filter(row => row.some(value => value !== '')).map(row => Array.from({ length: width }, (_, index) => row[index] ?? ''));
    state.active = { id: '', name: state.pending.name, headers, rows, priceColumns, adjustment: 0, categoryAdjustments: {}, savedAt: null, savedBy: state.user.name, isDraft: true }; state.adjustment = 0; state.categoryAdjustments = {}; state.search = ''; dom.search.value = ''; dom.importDialog.close(); loadActive(state.active);
    await setDraft(draftKey(), state.active);
    toast(`${rows.length.toLocaleString()} products imported. Autosaved as draft.`);
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
  function exportRows() { return state.rows.map(row => state.headers.map((_, column) => state.priceColumns.includes(column) && isNumeric(row[column]) ? Number(adjusted(numeric(row[column]), String(row[0] ?? '')).toFixed(2)) : row[column])); }
  function exportExcel() {
    if (!window.XLSX) return toast('Excel tools are unavailable.');
    const worksheet = XLSX.utils.aoa_to_sheet([state.headers, ...exportRows()]); worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, 'Updated Price List'); XLSX.writeFile(workbook, `${state.active.name} - updated.xlsx`);
  }
  const pdfImageCache = {};
  async function loadPdfImages() {
    const urls = {
      breads: 'assets/products/breads.jpg',
      cones: 'assets/products/cones.jpg',
      tarts: 'assets/products/tarts.jpg',
      presentation: 'assets/products/presentation.jpg',
      chocolates: 'assets/products/chocolates.jpg',
      macarons: 'assets/products/macarons.jpg',
      savory: 'assets/products/savory.jpg',
      pastries: 'assets/products/pastries.jpg',
      gourmet: 'assets/products/gourmet.jpg'
    };
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
    const text = `${category} ${groupName}`.toLowerCase();
    if (/presentation|stand|display|acrylic|holder|buffet/i.test(text)) return 'presentation';
    if (/bread|baguette|roll|sourdough|loaf|bun/i.test(text)) return 'breads';
    if (/cone/i.test(text)) return 'cones';
    if (/tart|shell|pie/i.test(text)) return 'tarts';
    if (/chocolate|praline|bonbon|truffle/i.test(text)) return 'chocolates';
    if (/macaron/i.test(text)) return 'macarons';
    if (/basket|spoon|savory|canape/i.test(text)) return 'savory';
    if (/pastry|pastries|cake|choux|eclair|dessert/i.test(text)) return 'pastries';
    return 'gourmet';
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
          // Product Group Title Row (bold light pink on black)
          body.push([
            {
              content: groupName,
              colSpan: colCount,
              styles: {
                fillColor: [0, 0, 0],
                textColor: [255, 204, 255],
                fontStyle: 'bold',
                fontSize: 8.5,
                halign: 'left',
                cellPadding: { top: 4, bottom: 4, left: 6, right: 6 },
                lineColor: [38, 69, 110],
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
                  styles: { fillColor: [0, 0, 0], cellPadding: 2, lineColor: [38, 69, 110], lineWidth: 0.65 }
                });
              }
              const itemName = [row[2], row[3]].filter(v => String(v ?? '').trim()).join('\n');
              const moq = [row[15], row[16]].filter(v => String(v ?? '').trim()).join('\n');
              rowCells.push(
                { content: String(row[1] ?? ''), styles: { halign: 'center', fontStyle: 'bold', fontSize: 6.5 } },
                { content: itemName, colSpan: 2, styles: { halign: 'left', fontSize: 6 } },
                { content: String(row[6] ?? ''), styles: { halign: 'center', fontSize: 6 } },
                { content: formatPdfPrice(row[8], category), styles: { halign: 'right', textColor: isAdj ? [255, 42, 133] : [255, 204, 255], fontStyle: isAdj ? 'bold' : 'normal', fontSize: 6.5 } },
                { content: formatPdfPrice(row[9], category), styles: { halign: 'right', textColor: isAdj ? [255, 42, 133] : [255, 204, 255], fontStyle: isAdj ? 'bold' : 'normal', fontSize: 6.5 } },
                { content: String(row[13] ?? ''), styles: { halign: 'center', fontSize: 6 } },
                { content: String(row[14] ?? ''), styles: { halign: 'center', fontSize: 6 } },
                { content: String(row[7] ?? ''), styles: { halign: 'center', fontSize: 6 } },
                { content: moq, styles: { halign: 'center', fontSize: 6 } },
                { content: String(row[17] ?? ''), styles: { halign: 'right', textColor: isAdj ? [255, 42, 133] : [255, 204, 255], fontStyle: isAdj ? 'bold' : 'normal', fontSize: 6 } }
              );
              body.push(rowCells);
            } else {
              const rowCells = [];
              if (isFirstInGroup) {
                rowCells.push({
                  content: '',
                  rowSpan: rows.length,
                  imageKey,
                  styles: { fillColor: [0, 0, 0], cellPadding: 2, lineColor: [38, 69, 110], lineWidth: 0.65 }
                });
              }
              const desc = String(row[2] ?? '').replace(/\r?\n/g, '\n');
              rowCells.push(
                { content: String(row[1] ?? ''), styles: { halign: 'center', fontStyle: 'bold', fontSize: 6.5 } },
                { content: desc, styles: { halign: 'center', fontSize: 6 } },
                { content: String(row[4] ?? ''), styles: { halign: 'center', fontSize: 6 } },
                { content: String(row[5] ?? ''), styles: { halign: 'center', fontSize: 6 } },
                { content: String(row[6] ?? ''), styles: { halign: 'center', fontSize: 6 } },
                { content: String(row[7] ?? ''), styles: { halign: 'center', fontSize: 6 } },
                { content: formatPdfPrice(row[8], category), styles: { halign: 'right', textColor: isAdj ? [255, 42, 133] : [255, 204, 255], fontStyle: isAdj ? 'bold' : 'normal', fontSize: 6.5 } },
                { content: formatPdfPrice(row[9], category), styles: { halign: 'right', textColor: isAdj ? [255, 42, 133] : [255, 204, 255], fontStyle: isAdj ? 'bold' : 'normal', fontSize: 6.5 } },
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
            fillColor: [0, 0, 0],
            textColor: [255, 204, 255],
            lineColor: [38, 69, 110],
            lineWidth: 0.5
          },
          headStyles: {
            fillColor: [0, 0, 0],
            textColor: [255, 204, 255],
            fontStyle: 'bold',
            fontSize: 6.5,
            halign: 'center',
            valign: 'middle',
            lineColor: [38, 69, 110],
            lineWidth: 0.65
          },
          columnStyles: isPresentation ? {
            0: { cellWidth: 93 },
            1: { cellWidth: 60 },
            2: { cellWidth: 95 },
            3: { cellWidth: 77 },
            4: { cellWidth: 55 },
            5: { cellWidth: 55 },
            6: { cellWidth: 55 },
            7: { cellWidth: 55 },
            8: { cellWidth: 55 },
            9: { cellWidth: 65 },
            10: { cellWidth: 65 },
            11: { cellWidth: 65 }
          } : undefined,
          alternateRowStyles: {
            fillColor: [0, 0, 0]
          },
          didDrawCell: function(data) {
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
          willDrawPage: function() {
            doc.setFillColor(0, 0, 0);
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
        doc.setFillColor(255, 42, 133);
        doc.roundedRect(margin, 12, 22, 22, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('LRN', margin + 11, 26, { align: 'center' });

        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.text(state.active?.name || 'Price List', margin + 28, 23);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(140, 155, 175);
        doc.text('LA ROSE NOIRE · FOB Subic Manila–Subic Port · Export Pricing', margin + 28, 32);

        // Right side adjustments
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(255, 51, 136);
        const adjEntries = Object.entries(state.categoryAdjustments || {}).filter(([_, v]) => Number(v) !== 0);
        const adjText = adjEntries.length > 0
          ? adjEntries.map(([c, a]) => `${c}: ${Number(a) > 0 ? '+' : ''}${a}%`).join('  |  ')
          : 'Baseline prices (0% adjustment)';
        doc.text(adjText, pageWidth - margin, 23, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(120, 135, 155);
        doc.text(`Exported ${new Date().toLocaleString()}`, pageWidth - margin, 32, { align: 'right' });

        // Bottom Footer
        doc.setFontSize(6.5);
        doc.setTextColor(90, 105, 125);
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
  $('#uploadButton').addEventListener('click', openFilePicker); $('#emptyUploadButton').addEventListener('click', openFilePicker);
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
  $('#editButton').addEventListener('click', () => setPriceEditor($('#adjustmentBar').hidden));
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
  $('#confirmImport').addEventListener('click', confirmImport);
  $('#previewButton').addEventListener('click', async () => {
    const value = Number(dom.percentage.value);
    if (!Number.isFinite(value) || value < -100 || value > 10000) return toast('Enter a percentage from -100 to 10,000.');
    const cat = state.category;
    if (cat) {
      state.categoryAdjustments[cat] = value;
    } else {
      state.adjustment = value;
    }
    if (state.active) {
      state.active.categoryAdjustments = { ...state.categoryAdjustments };
      state.active.isDraft = true;
      await setDraft(draftKey(), state.active);
      loadActive(state.active);
    } else {
      updateMetrics();
      renderTable();
    }
    toast(`Adjustment for ${cat || 'products'} updated & draft saved.`);
  });
  dom.search.addEventListener('input', () => { state.search = dom.search.value; renderTable(); });
  dom.category.addEventListener('change', () => {
    state.category = dom.category.value;
    dom.percentage.value = getCategoryAdjustment(state.category);
    const title = $('#adjustmentTitle');
    const subtitle = document.querySelector('#adjustmentBar .edit-summary span');
    if (title && state.category) title.textContent = `Adjust ${state.category} prices`;
    if (subtitle && state.category) subtitle.textContent = `Applies percentage only to ${state.category}.`;
    updateMetrics();
    renderTable();
  });
  $('#saveButton').addEventListener('click', () => {
    if (!state.active) return;
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
  $$('.nav-item').forEach(button => button.addEventListener('click', () => { setPriceEditor(false); $$('.nav-item').forEach(item => item.classList.toggle('active', item === button)); $$('.panel').forEach(panel => { panel.hidden = panel.id !== button.dataset.panel; panel.classList.toggle('active', panel.id === button.dataset.panel); }); }));
  document.addEventListener('click', event => { if (!$('#adjustmentBar').hidden && !event.target.closest('.price-editor-wrap')) setPriceEditor(false); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('#adjustmentBar').hidden) { setPriceEditor(false); $('#editButton').focus(); }
    if (event.key === '/' && document.activeElement !== dom.search && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      event.preventDefault();
      dom.search.focus();
    }
  });
  dom.historyTable?.addEventListener('click', async event => {
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
    const deleteButton = event.target.closest('.delete-version');
    if (!deleteButton) return;
    state.pendingDelete = deleteButton.dataset.id;
    dom.deleteVersionName.textContent = deleteButton.dataset.name;
    dom.deleteDialog.showModal();
  });
  $('#confirmDelete').addEventListener('click', async event => { event.preventDefault(); if (!state.pendingDelete) return; const button = event.currentTarget; button.disabled = true; try { const data = await api('delete-version', { method: 'POST', body: JSON.stringify({ id: state.pendingDelete }) }); state.pendingDelete = null; dom.deleteDialog.close(); await loadState(); toast(data.message); } catch (error) { toast(error.message); } finally { button.disabled = false; } });

  dom.backToPricesBtn?.addEventListener('click', () => $$('.nav-item')[0].click());
  dom.emptyGoToPricesBtn?.addEventListener('click', () => $$('.nav-item')[0].click());
  dom.historySearchInput?.addEventListener('input', () => {
    state.historySearch = dom.historySearchInput.value;
    renderHistory();
  });
  dom.historyAdjustmentSelect?.addEventListener('change', () => {
    state.historyAdjustment = dom.historyAdjustmentSelect.value;
    renderHistory();
  });

  dom.resetPricesButton?.addEventListener('click', () => {
    dom.resetPricesDialog.showModal();
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
    if (subtitle && state.category) subtitle.textContent = `Applies percentage only to ${state.category}.`;
    updateMetrics();
    renderTable();
    toast('All price adjustments reset to original (0%). Uploaded file retained.');
  });

  if (state.user) loadState().catch(error => { setAppLoading(false); toast(error.message); });
})();
