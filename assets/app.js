(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { user: window.__BOOT__.user, csrf: window.__BOOT__.csrf, canEdit: false, active: null, rows: [], headers: [], priceColumns: [], adjustment: 0, search: '', category: '', page: 1, pageSize: 6, pending: null, pendingDelete: null, versions: [] };
  const money = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dom = {
    loginView: $('#loginView'), appView: $('#appView'), loginForm: $('#loginForm'), loginError: $('#loginError'), userName: $('#userName'), roleBadge: $('#roleBadge'), emptyState: $('#emptyState'), dataView: $('#dataView'), listTitle: $('#listTitle'), listMeta: $('#listMeta'), savedMeta: $('#savedMeta'), activeBadge: $('#activeBadge'), productCount: $('#productCount'), categoryCount: $('#categoryCount'), priceColumnCount: $('#priceColumnCount'), currentAdjustment: $('#currentAdjustment'), percentage: $('#percentage'), search: $('#searchInput'), category: $('#categorySelect'), pageSize: $('#pageSizeSelect'), table: $('#priceTable'), noResults: $('#noResults'), range: $('#rangeLabel'), pageNumbers: $('#pageNumbers'), importDialog: $('#importDialog'), saveDialog: $('#saveDialog'), saveForm: $('#saveForm'), versionNameInput: $('#versionNameInput'), deleteDialog: $('#deleteDialog'), deleteVersionName: $('#deleteVersionName'), logoutDialog: $('#logoutDialog'), logoutForm: $('#logoutForm'), importFileName: $('#importFileName'), historyList: $('#historyList'), toast: $('#toast'), fileInput: $('#fileInput')
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
  function adjusted(value) { const number = Number(value); return Number.isFinite(number) ? number * (1 + state.adjustment / 100) : value; }
  function isNumeric(value) { return value !== '' && value !== null && Number.isFinite(Number(String(value).replace(/,/g, ''))); }
  function numeric(value) { return Number(String(value).replace(/,/g, '')); }
  function productVisual(row) {
    const category = String(row[0] || '').toLowerCase();
    const description = String(row[2] || row[1] || 'Product').trim();
    const text = description.toLowerCase();
    const tones = [
      [/chocolate|cocoa/, '#6f3c2d'], [/black|charcoal|squid/, '#29252a'], [/tomato|strawberry|raspberry/, '#d84e58'],
      [/curry|lemon|mango|pineapple/, '#e0a72f'], [/pesto|green|matcha/, '#648b4e'], [/vanilla|white|bamboo/, '#e8d7a3']
    ];
    const tone = tones.find(([pattern]) => pattern.test(text))?.[1] || ['#d58d4d', '#c66c8d', '#829e72', '#9670b2', '#4b91a7'][Math.abs([...String(row[1] || '')].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 5];
    const kind = /cone/.test(category) ? 'cone' : /tart|shell/.test(category) ? 'tart' : /chocolate/.test(category) ? 'chocolate' : /bread|croissant|danish/.test(category) ? 'pastry' : 'product';
    const initials = description.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase();
    return { tone, kind, initials, description };
  }

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
    if (open) requestAnimationFrame(() => dom.percentage.focus());
  }
  async function loadState() {
    const data = await api('state');
    Object.assign(state, { user: data.user, csrf: data.csrf, canEdit: data.canEdit, active: data.active, versions: data.versions || [] });
    showApp(); loadActive(data.active); renderHistory();
    setAppLoading(false);
  }
  function loadActive(active) {
    state.active = active;
    if (!active) { setPriceEditor(false); dom.emptyState.hidden = false; dom.dataView.hidden = true; dom.listTitle.textContent = 'Start with a workbook'; dom.listMeta.textContent = 'Upload an .xlsx or .xls file to map its products and prices.'; dom.savedMeta.textContent = ''; dom.activeBadge.hidden = true; $('#editButton').hidden = true; $('#saveButton').hidden = true; return; }
    state.headers = active.headers || []; state.rows = active.rows || []; state.priceColumns = (active.priceColumns || []).filter(index => /price\s*\/\s*(pc|box)/i.test(String(state.headers[index] || ''))); state.adjustment = Number(active.adjustment || 0); state.page = 1; $('#editButton').hidden = !state.canEdit; setPriceEditor(false);
    dom.percentage.value = state.adjustment; dom.emptyState.hidden = true; dom.dataView.hidden = false; dom.listTitle.textContent = 'Current file'; dom.listMeta.textContent = active.name; dom.savedMeta.textContent = active.savedAt ? `Last saved ${displayDate(active.savedAt)} by ${active.savedBy}` : 'Imported workbook, not saved yet'; dom.activeBadge.hidden = false; $('#saveButton').hidden = !state.canEdit;
    const categories = [...new Set(state.rows.map(row => String(row[0] ?? '')).filter(Boolean))].sort();
    dom.category.innerHTML = '<option value="">All categories</option>' + categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
    state.category = ''; dom.category.value = '';
    updateMetrics(); renderTable();
  }
  function updateMetrics() { dom.productCount.textContent = state.rows.length.toLocaleString(); dom.categoryCount.textContent = new Set(state.rows.map(row => row[0]).filter(Boolean)).size; dom.priceColumnCount.textContent = state.priceColumns.length; dom.currentAdjustment.textContent = `${state.adjustment > 0 ? '+' : ''}${state.adjustment}%`; }
  function filteredRows() {
    const query = state.search.trim().toLowerCase();
    return state.rows.map((row, index) => ({ row, index })).filter(({ row }) => (!state.category || String(row[0] ?? '') === state.category) && (!query || row.some(value => String(value ?? '').toLowerCase().includes(query))));
  }
  function renderTable() {
    const items = filteredRows(), pages = Math.max(1, Math.ceil(items.length / state.pageSize)); state.page = Math.min(state.page, pages);
    const start = (state.page - 1) * state.pageSize, visible = items.slice(start, start + state.pageSize);
    const visualMarkup = row => { const visual = productVisual(row); return `<div class="product-thumb ${visual.kind}" style="--product-tone:${visual.tone}" role="img" aria-label="Placeholder for ${escapeHtml(visual.description)}"><span>${escapeHtml(visual.initials)}</span></div>`; };
    const valueMarkup = (row, column) => { const raw = row[column] ?? '', price = state.priceColumns.includes(column) && isNumeric(raw), value = price ? adjusted(numeric(raw)) : raw; return price ? money.format(value) : escapeHtml(raw).replace(/\r?\n/g, '<br>'); };
    const standardHeader = () => `
      <tr class="excel-header excel-header-primary">
        <th rowspan="3" class="photo-heading" aria-label="Product image"></th>
        <th rowspan="3">Code No</th>
        <th rowspan="3">Description</th>
        <th rowspan="3">Expiry Date</th>
        <th rowspan="3">Weight<br>gr/pc</th>
        <th rowspan="3">Pcs<br>/box</th>
        <th rowspan="3">Box Size</th>
        <th rowspan="3">Price/pc<br>USD</th>
        <th rowspan="3">Price/box in<br>USD</th>
        <th colspan="3">PALLET PER CONTAINER</th>
      </tr>
      <tr class="excel-header excel-header-secondary">
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
    const standardRow = (row, visibleIndex) => `<tr class="excel-data-row" style="--row-delay:${Math.min(visibleIndex, 8) * 18}ms">
      <td class="full-photo">${visualMarkup(row)}</td>
      <td class="code-cell">${valueMarkup(row, 1)}</td>
      <td class="full-description">${valueMarkup(row, 2)}</td>
      <td>${valueMarkup(row, 4)}</td>
      <td>${valueMarkup(row, 5)}</td>
      <td>${valueMarkup(row, 6)}</td>
      <td>${valueMarkup(row, 7)}</td>
      <td class="price-cell changed">${valueMarkup(row, 8)}</td>
      <td class="price-cell changed">${valueMarkup(row, 9)}</td>
      <td>${valueMarkup(row, 10)}</td>
      <td>${valueMarkup(row, 11)}</td>
      <td>${valueMarkup(row, 12)}</td>
    </tr>`;
    const presentationRow = (row, visibleIndex) => {
      const itemName = [row[2], row[3]].filter(value => String(value ?? '').trim()).map(value => escapeHtml(value).replace(/\r?\n/g, '<br>')).join('<br>');
      const moq = [row[15], row[16]].filter(value => String(value ?? '').trim()).map(value => escapeHtml(value).replace(/\r?\n/g, '<br>')).join('<br>');
      return `<tr class="excel-data-row presentation-row" style="--row-delay:${Math.min(visibleIndex, 8) * 18}ms">
        <td class="full-photo">${visualMarkup(row)}</td>
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
    let previousGroup = '';
    $('thead', dom.table).innerHTML = '';
    $('tbody', dom.table).innerHTML = visible.map(({ row }, visibleIndex) => {
      const group = String(row[18] || row[0] || 'Other products');
      const groupKey = `${row[0]}|${group}`;
      const isPresentation = String(row[0] || '').toLowerCase() === 'presentation stands';
      const columnCount = 12;
      const groupStart = groupKey !== previousGroup
        ? `<tr class="product-group-row"><td colspan="${columnCount}">${state.category ? '' : `<span>${escapeHtml(row[0])}</span>`}<strong>${escapeHtml(group)}</strong></td></tr>${isPresentation ? presentationHeader() : standardHeader()}`
        : '';
      previousGroup = groupKey;
      return `${groupStart}${isPresentation ? presentationRow(row, visibleIndex) : standardRow(row, visibleIndex)}`;
    }).join('');
    dom.noResults.hidden = items.length > 0; dom.range.textContent = items.length ? `${start + 1}–${Math.min(start + state.pageSize, items.length)} of ${items.length}` : '0 items';
    const pageStart = Math.max(1, Math.min(state.page - 2, pages - 4)); const pageEnd = Math.min(pages, pageStart + 4);
    dom.pageNumbers.innerHTML = Array.from({ length: pageEnd - pageStart + 1 }, (_, i) => pageStart + i).map(page => `<button class="page-button ${page === state.page ? 'active' : ''}" data-page="${page}">${page}</button>`).join('');
    $('#previousPage').disabled = state.page <= 1; $('#nextPage').disabled = state.page >= pages;
  }
  function renderHistory() {
    if (!state.versions.length) { dom.historyList.innerHTML = '<div class="history-empty">No saved versions yet.</div>'; return; }
    dom.historyList.innerHTML = state.versions.map(version => `<article class="history-item"><div><strong>${escapeHtml(version.name)}</strong><span>${escapeHtml(version.id)}</span></div><div><span>Saved</span><strong>${displayDate(version.savedAt)}</strong></div><div><span>By</span><strong>${escapeHtml(version.savedBy)}</strong></div><div><span>Adjustment</span><strong class="adjust">${Number(version.adjustment) > 0 ? '+' : ''}${Number(version.adjustment)}%</strong></div><div class="history-actions"><button class="button secondary open-version" data-id="${escapeHtml(version.id)}">Open</button>${state.user.role === 'admin' ? `<button class="button danger delete-version" data-id="${escapeHtml(version.id)}" data-name="${escapeHtml(version.name)}">Delete</button>` : ''}</div></article>`).join('');
  }
  function openFilePicker() { dom.fileInput.value = ''; dom.fileInput.click(); }

  async function parseWorkbook(file) {
    if (!window.XLSX) throw new Error('Excel tools did not load. Check the internet connection and refresh.');
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
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
  function confirmImport(event) {
    event.preventDefault(); const headerIndex = 0; const rawHeaders = state.pending.matrix[headerIndex] || []; const width = Math.max(rawHeaders.length, ...state.pending.matrix.slice(headerIndex + 1).map(row => row.length));
    const headers = Array.from({ length: width }, (_, index) => String(rawHeaders[index] || `Column ${index + 1}`).trim());
    const priceColumns = state.pending.priceColumns;
    const rows = state.pending.matrix.slice(headerIndex + 1).filter(row => row.some(value => value !== '')).map(row => Array.from({ length: width }, (_, index) => row[index] ?? ''));
    state.active = { id: '', name: state.pending.name, headers, rows, priceColumns, adjustment: 0, savedAt: null, savedBy: state.user.name }; state.adjustment = 0; state.search = ''; dom.search.value = ''; dom.importDialog.close(); loadActive(state.active); toast(`${rows.length.toLocaleString()} products imported. Review, then save.`);
  }
  async function save(customName) {
    const name = (customName || '').trim() || state.active?.name || 'Untitled price list';
    const data = await api('save', { method: 'POST', body: JSON.stringify({ name, headers: state.headers, rows: state.rows, priceColumns: state.priceColumns, adjustment: state.adjustment }) });
    loadActive(data.active); await loadState(); toast(data.message);
  }
  function exportRows() { return state.rows.map(row => state.headers.map((_, column) => state.priceColumns.includes(column) && isNumeric(row[column]) ? Number(adjusted(numeric(row[column])).toFixed(2)) : row[column])); }
  function exportExcel() {
    if (!window.XLSX) return toast('Excel tools are unavailable.');
    const worksheet = XLSX.utils.aoa_to_sheet([state.headers, ...exportRows()]); worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, 'Updated Price List'); XLSX.writeFile(workbook, `${state.active.name} - updated.xlsx`);
  }
  function exportPdf() {
    if (!window.jspdf?.jsPDF) return toast('PDF tools are unavailable.');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    if (typeof doc.autoTable !== 'function') return toast('PDF table tools are unavailable.');

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 22;
    const pdfValue = (row, column) => {
      const raw = row[column] ?? '';
      if (state.priceColumns.includes(column) && isNumeric(raw)) return Number(adjusted(numeric(raw))).toFixed(2);
      return String(raw).replace(/\r?\n/g, '\n');
    };
    const sections = [];
    state.rows.forEach(row => {
      const worksheet = String(row[0] || 'Products');
      const group = String(row[18] || worksheet);
      const key = `${worksheet}|${group}`;
      let section = sections[sections.length - 1];
      if (!section || section.key !== key) {
        section = { key, worksheet, group, rows: [] };
        sections.push(section);
      }
      section.rows.push(row);
    });

    doc.setTextColor(28, 31, 38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(state.active.name, margin, 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(92, 98, 108);
    doc.text(`Adjustment: ${state.adjustment > 0 ? '+' : ''}${state.adjustment}% - Exported ${new Date().toLocaleString()}`, margin, 44);

    let startY = 60;
    sections.forEach(section => {
      const isPresentation = section.worksheet.toLowerCase() === 'presentation stands';
      if (startY > pageHeight - 105) {
        doc.addPage();
        startY = 30;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(220, 45, 133);
      doc.text(section.group, margin, startY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(94, 101, 112);
      if (section.group !== section.worksheet) doc.text(section.worksheet, pageWidth - margin, startY, { align: 'right' });

      const commonOptions = {
        startY: startY + 7,
        theme: 'grid',
        showHead: 'everyPage',
        margin: { top: 24, right: margin, bottom: 28, left: margin },
        styles: { font: 'helvetica', fontSize: 6.5, cellPadding: 3, overflow: 'linebreak', valign: 'middle', textColor: [35, 39, 47], lineColor: [121, 143, 160], lineWidth: 0.35 },
        headStyles: { fillColor: [16, 22, 30], textColor: [255, 238, 248], fontStyle: 'bold', halign: 'center', valign: 'middle', lineColor: [58, 106, 143], lineWidth: 0.5 },
        alternateRowStyles: { fillColor: [244, 247, 250] },
      };

      if (isPresentation) {
        const head = [['Photo', 'LRN code', 'Item Name', 'PC/Set Per Box', 'Price/pc in USD', 'Price/Box USD', 'NW(KG) / Box', 'GW(KG) / Box', 'Box size', 'MOQ', 'Total Price Based on MOQ']];
        const body = section.rows.map(row => {
          const visual = productVisual(row);
          const itemName = [pdfValue(row, 2), pdfValue(row, 3)].filter(Boolean).join('\n');
          const moq = [pdfValue(row, 15), pdfValue(row, 16)].filter(Boolean).join('\n');
          return [visual.initials, pdfValue(row, 1), itemName, pdfValue(row, 6), pdfValue(row, 8), pdfValue(row, 9), pdfValue(row, 13), pdfValue(row, 14), pdfValue(row, 7), moq, pdfValue(row, 17)];
        });
        doc.autoTable({ ...commonOptions, head, body, columnStyles: { 0: { cellWidth: 38, halign: 'center' }, 1: { cellWidth: 58 }, 2: { cellWidth: 180 }, 3: { cellWidth: 56, halign: 'center' }, 4: { cellWidth: 55, halign: 'right' }, 5: { cellWidth: 55, halign: 'right' }, 6: { cellWidth: 55, halign: 'center' }, 7: { cellWidth: 55, halign: 'center' }, 8: { cellWidth: 70 }, 9: { cellWidth: 70 }, 10: { cellWidth: 72, halign: 'right' } } });
      } else {
        const head = [
          [
            { content: '', rowSpan: 3 },
            { content: 'Code No', rowSpan: 3 },
            { content: 'Description', rowSpan: 3 },
            { content: 'Expiry Date', rowSpan: 3 },
            { content: 'Weight\ngr/pc', rowSpan: 3 },
            { content: 'Pcs\n/box', rowSpan: 3 },
            { content: 'Box Size', rowSpan: 3 },
            { content: 'Price/pc\nUSD', rowSpan: 3 },
            { content: 'Price/box in\nUSD', rowSpan: 3 },
            { content: 'PALLET PER CONTAINER', colSpan: 3 },
          ],
          [{ content: '40ft Container', colSpan: 2 }, { content: '20ft Container' }],
          ['Large Pallet\n(16 pallets)', 'Small Pallet\n(2 pallets)', 'Large Pallet\n(8 pallets)'],
        ];
        const body = section.rows.map(row => {
          const visual = productVisual(row);
          return [visual.initials, pdfValue(row, 1), pdfValue(row, 2), pdfValue(row, 4), pdfValue(row, 5), pdfValue(row, 6), pdfValue(row, 7), pdfValue(row, 8), pdfValue(row, 9), pdfValue(row, 10), pdfValue(row, 11), pdfValue(row, 12)];
        });
        doc.autoTable({ ...commonOptions, head, body, columnStyles: { 0: { cellWidth: 42, halign: 'center' }, 1: { cellWidth: 64 }, 2: { cellWidth: 155 }, 3: { cellWidth: 50, halign: 'center' }, 4: { cellWidth: 43, halign: 'center' }, 5: { cellWidth: 42, halign: 'center' }, 6: { cellWidth: 52, halign: 'center' }, 7: { cellWidth: 48, halign: 'right' }, 8: { cellWidth: 55, halign: 'right' }, 9: { cellWidth: 82, halign: 'center' }, 10: { cellWidth: 82, halign: 'center' }, 11: { cellWidth: 82, halign: 'center' } } });
      }
      startY = (doc.lastAutoTable?.finalY || startY + 25) + 16;
    });

    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page++) {
      doc.setPage(page);
      doc.setFontSize(7);
      doc.setTextColor(112, 118, 128);
      doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 12, { align: 'right' });
    }
    doc.save(`${state.active.name} - updated.pdf`);
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
  dom.fileInput.addEventListener('change', async () => { const file = dom.fileInput.files[0]; if (!file) return; try { await parseWorkbook(file); } catch (error) { toast(error.message); } });
  $('#confirmImport').addEventListener('click', confirmImport);
  $('#previewButton').addEventListener('click', () => { const value = Number(dom.percentage.value); if (!Number.isFinite(value) || value < -100 || value > 10000) return toast('Enter a percentage from -100 to 10,000.'); state.adjustment = value; state.page = 1; updateMetrics(); renderTable(); toast('Adjustment preview updated.'); });
  dom.search.addEventListener('input', () => { state.search = dom.search.value; state.page = 1; renderTable(); });
  dom.category.addEventListener('change', () => { state.category = dom.category.value; state.page = 1; renderTable(); });
  dom.pageSize.addEventListener('change', () => { state.pageSize = Number(dom.pageSize.value); state.page = 1; document.body.classList.toggle('expanded-rows', state.pageSize > 6); renderTable(); });
  $('#previousPage').addEventListener('click', () => { state.page--; renderTable(); }); $('#nextPage').addEventListener('click', () => { state.page++; renderTable(); });
  dom.pageNumbers.addEventListener('click', event => { const button = event.target.closest('[data-page]'); if (!button) return; state.page = Number(button.dataset.page); renderTable(); });
  $('#saveButton').addEventListener('click', () => {
    if (!state.active) return;
    dom.versionNameInput.value = state.active.name || '';
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
  dom.historyList.addEventListener('click', async event => { const openButton = event.target.closest('.open-version'); if (openButton) { try { const data = await api('open', { method: 'POST', body: JSON.stringify({ id: openButton.dataset.id }) }); loadActive(data.active); $$('.nav-item')[0].click(); toast('Saved version opened without changing history.'); } catch (error) { toast(error.message); } return; } const deleteButton = event.target.closest('.delete-version'); if (!deleteButton) return; state.pendingDelete = deleteButton.dataset.id; dom.deleteVersionName.textContent = deleteButton.dataset.name; dom.deleteDialog.showModal(); });
  $('#confirmDelete').addEventListener('click', async event => { event.preventDefault(); if (!state.pendingDelete) return; const button = event.currentTarget; button.disabled = true; try { const data = await api('delete-version', { method: 'POST', body: JSON.stringify({ id: state.pendingDelete }) }); state.pendingDelete = null; dom.deleteDialog.close(); await loadState(); toast(data.message); } catch (error) { toast(error.message); } finally { button.disabled = false; } });

  if (state.user) loadState().catch(error => { setAppLoading(false); toast(error.message); });
})();
