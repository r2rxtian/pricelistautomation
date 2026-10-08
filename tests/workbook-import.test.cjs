'use strict';
// Executes the real app downloader and the real PHP reader using disposable workbooks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync, spawn } = require('node:child_process');
const net = require('node:net');
const { randomBytes } = require('node:crypto');
const { inflateRawSync, deflateRawSync } = require('node:zlib');
const root = path.resolve(__dirname, '..');
const XLSX = require(path.join(root, 'assets/vendor/xlsx.full.min.js'));
const template = JSON.parse(fs.readFileSync(path.join(root, 'rules/price_list_template.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'scripts/app.js'), 'utf8');
const downloader = source.slice(source.indexOf('  function downloadExcelTemplate() {'), source.indexOf('  /** Send the original workbook'));
const exporter = source.slice(source.indexOf('  function exportExcel(version, rows) {'), source.indexOf('  const pdfImageCache'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pla-workbook-tests-'));
const php = process.env.PLA_TEST_PHP || 'C:/xampp/php/php.exe';
let captured;
const context = { state: { importTemplate: template }, window: { XLSX }, XLSX: { ...XLSX, writeFile(wb) { captured = wb; } }, toast() {} };
vm.runInNewContext(downloader + '\ndownloadExcelTemplate();', context);
const original = Buffer.from(XLSX.write(captured, { type: 'buffer', bookType: 'xlsx', compression: true }));
let checks = 0;
function check(name, buffer, expectation) {
  const file = path.join(tmp, `${checks}.xlsx`);
  fs.writeFileSync(file, buffer);
  const process = spawnSync(php, [path.join(__dirname, 'read-workbook.php'), file], { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  assert.ok(process.stdout, `${name}: ${process.stderr}`);
  const response = JSON.parse(process.stdout);
  if (expectation instanceof RegExp) {
    assert.equal(response.ok, false, `${name}: unexpectedly accepted`);
    assert.match(response.message, expectation, name);
  } else {
    assert.equal(response.ok, true, `${name}: ${response.message || process.stderr}`);
    expectation?.(response.result);
  }
  checks++;
  console.log(`PASS ${name}`);
  return response;
}
function changed(mutate) {
  const wb = XLSX.read(original, { type: 'buffer' });
  mutate(wb);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: true });
}
function deleteSheet(wb, name) { wb.SheetNames = wb.SheetNames.filter(item => item !== name); delete wb.Sheets[name]; }
function emptySheet(wb, name) {
  const category = template.categories.find(item => item.name === name);
  const layout = template.layouts[category.layout];
  wb.Sheets[name] = XLSX.utils.aoa_to_sheet(layout.headerRows);
  wb.Sheets[name]['!merges'] = layout.merges.map(XLSX.utils.decode_range);
}
// Small ZIP fixture helper, used only to mutate package parts for hostile-input tests.
function unzip(bytes) {
  const end = bytes.lastIndexOf(Buffer.from('504b0506', 'hex'));
  let position = bytes.readUInt32LE(end + 16);
  const files = [];
  for (let i = 0; i < bytes.readUInt16LE(end + 10); i++) {
    const length = bytes.readUInt16LE(position + 28), extra = bytes.readUInt16LE(position + 30), comment = bytes.readUInt16LE(position + 32);
    const name = bytes.subarray(position + 46, position + 46 + length).toString();
    const compressed = bytes.readUInt32LE(position + 20), offset = bytes.readUInt32LE(position + 42);
    const start = offset + 30 + bytes.readUInt16LE(offset + 26) + bytes.readUInt16LE(offset + 28);
    const data = bytes.subarray(start, start + compressed);
    files.push({ name, data: bytes.readUInt16LE(position + 10) === 8 ? inflateRawSync(data) : data });
    position += 46 + length + extra + comment;
  }
  return files;
}
function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ -1) >>> 0;
}
function zip(files) {
  const locals = [], entries = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name), data = Buffer.from(file.data), compressed = deflateRawSync(data);
    const local = Buffer.alloc(30), central = Buffer.alloc(46), crc = crc32(data);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(file.flags || 0, 6); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(file.flags || 0, 8); central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, name, compressed); entries.push(central, name); offset += local.length + name.length + compressed.length;
  }
  const central = Buffer.concat(entries), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, central, end]);
}
function packageChange(mutate) { const files = unzip(original); mutate(files); return zip(files); }
function xmlChange(files, name, mutate) { const file = files.find(item => item.name === name); file.data = Buffer.from(mutate(file.data.toString())); }

async function apiChecks() {
  const reservation = net.createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const token = randomBytes(20).toString('hex');
  const server = spawn(php, ['-S', `127.0.0.1:${port}`, path.join(__dirname, 'workbook-upload-router.php')], { cwd: root, windowsHide: true, stdio: 'ignore', env: { ...process.env, PLA_WORKBOOK_TEST_TOKEN: token } });
  const url = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try { ready = (await fetch(`${url}/health`, { headers: { 'X-Workbook-Test': token } })).ok; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(ready, 'isolated PHP test server starts');
    const baseHeaders = { 'X-Workbook-Test': token, 'X-CSRF-Token': 'fixture-csrf' };
    function form(buffer = original, filename = 'official.xlsx') {
      const body = new FormData();
      for (const [key, value] of Object.entries({ kind: 'upload', name: 'Test price list', country: 'Switzerland', priceLevel: 'Price Level 4' })) body.append(key, value);
      body.append('workbook', new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
      return body;
    }
    async function request(name, body, status, extraHeaders = {}, method = 'POST') {
      const headers = { ...baseHeaders, ...extraHeaders };
      if (typeof body === 'string') headers['Content-Type'] = 'application/json';
      const response = await fetch(`${url}/api/versions/save.php`, { method, headers, ...(method === 'GET' ? {} : { body }) });
      const data = await response.json();
      assert.equal(response.status, status, `${name}: ${data.message}`);
      if (status !== 200) assert.deepEqual(data._testEffects, { saved: 0, superseded: 0, audit: 0, notifications: 0 }, `${name}: rejection has no write effects`);
      checks++; console.log(`PASS API ${name}`);
      return data;
    }
    const data = await request('valid original workbook saved once', form(), 200);
    assert.deepEqual(data._testEffects, { saved: 1, superseded: 1, audit: 1, notifications: 1 });
    assert.equal(data.active.templateVersion, template.version); assert.equal(data.active.rows.length, 6);
    const withoutStands = await request('workbook without stands accepted', form(changed(wb => deleteSheet(wb, 'Presentation Stands'))), 200);
    assert.equal(withoutStands.active.rows.length, 5);
    await request('one bad category rejects entire workbook', form(changed(wb => { wb.Sheets['Presentation Stands'].C1.v = 'Qty'; })), 422);
    await request('removed standard fields rejected before writes', form(changed(wb => { wb.Sheets.Breads.M1 = { t: 's', v: 'MOQ' }; wb.Sheets.Breads['!ref'] = 'A1:M4'; })), 422);
    await request('browser JSON upload bypass rejected', JSON.stringify({ kind: 'upload', name: 'Test price list', country: 'Switzerland', priceLevel: 'Price Level 4', headers: ['Anything'], rows: [['fake', 10]], priceColumns: [1] }), 422);
    const spoof = form(); spoof.append('rows', 'fake'); spoof.append('headers', 'fake'); spoof.append('priceColumns', '[0]'); spoof.append('adjustment', '100');
    const ignored = await request('spoofed multipart rows ignored', spoof, 200);
    assert.deepEqual(ignored.active.rows, data.active.rows); assert.deepEqual(ignored.active.priceColumns, [8, 9]); assert.equal(ignored.active.adjustment, 0);
    await request('legacy xls filename rejected', form(original, 'legacy.xls'), 422);
    await request('fake xlsx file content rejected', form(Buffer.from('fake workbook')), 422);
    const multiple = form(); multiple.append('extra', new Blob([original]), 'another.xlsx');
    await request('unexpected uploaded file rejected', multiple, 422);
    await request('unauthorized role rejected', form(), 403, { 'X-Test-Role': 'User' });
    await request('CSRF required', form(), 403, { 'X-CSRF-Token': '' });
    await request('POST required', null, 405, {}, 'GET');
    const country = form(); country.set('country', 'Unknown');
    await request('configured country required', country, 422);
    const change = { id: 'uploaded-base', name: 'Test price list', country: 'Switzerland', priceLevel: 'Price Level 4', headers: template.normalizedHeaders, rows: data.active.rows, priceColumns: [8, 9], adjustment: 5, categoryAdjustments: {}, changes: [] };
    const validChange = await request('existing strict-template price edits still save', JSON.stringify(change), 200);
    assert.equal(validChange.active.source, 'change'); assert.equal(validChange.active.status, 'pending'); assert.equal(validChange.active.templateVersion, 'PLA-1');
    await request('edit endpoint cannot create a new list without a base', JSON.stringify({ ...change, id: null }), 422);
    await request('edit endpoint requires an existing visible base', JSON.stringify({ ...change, id: 'unknown-base' }), 404);
    await request('strict-template columns cannot change through edit API', JSON.stringify({ ...change, headers: ['Other'] }), 422);
    const legacy = await request('legacy saved lists remain editable', JSON.stringify({ ...change, id: 'legacy-base', name: 'Legacy list', headers: ['Category', 'Code', 'Price'], rows: [['Legacy', 'OLD-1', 10]], priceColumns: [2] }), 200);
    assert.equal(legacy.active.templateVersion, null);
  } finally { server.kill(); await new Promise(resolve => server.once('close', resolve)); }
}

(async () => { try {
  check('official download: both layouts and correct stand mapping', original, result => {
    assert.equal(result.rows.length, 6); assert.equal(result.templateVersion, template.version); assert.deepEqual(result.priceColumns, [8, 9]);
    const stand = result.rows.find(row => row[0] === 'Presentation Stands');
    assert.deepEqual([stand[3], stand[6], stand[8], stand[9], stand[15], stand[16], stand[17]], ['', 4, 18.5, 74, '10 Sets', '', 740]);
    assert.ok(result.rows.every(row => row[19] === 'Price Level 4' && row[20] === 'Switzerland'));
    result.rows.filter(row => row[0] !== 'Presentation Stands').forEach(row => {
      const category = template.categories.find(category => category.name === row[0]);
      assert.equal(row[18], category.samples[0][11], 'Product Group keeps its normalized photo/grouping field');
      assert.deepEqual([row[13], row[14], row[15], row[16], row[17]], ['', '', '', '', '']);
    });
    assert.equal(template.layouts.standard.columns.length, 12);
    assert.equal(captured.Sheets.Breads['!ref'], 'A1:L4');
    assert.equal(captured.Sheets.Breads.L1.v, 'Product Group');
    assert.equal(captured.Sheets.Breads.L4.v, 'Baguettes');
    const standHeaders = ['LRN code', 'Item Name', 'PC/Set Per Box', 'Price/pc in USD', 'Price/Box USD', 'NW(KG) / Box', 'GW(KG) / Box', 'Box size', 'MOQ', 'Total Price Based on MOQ', 'Product Group'];
    assert.deepEqual(template.layouts.presentation.headerRows, [standHeaders], 'stand layout unchanged');
    assert.deepEqual(template.categories.find(category => category.layout === 'presentation').samples[0], ['LRN-STD-001', 'Acrylic 3-Tier Tart Stand', 4, 18.5, 74, 3.4, 4.2, 'Display Box', '10 Sets', 740, 'Acrylic Displays']);
    vm.runInNewContext(exporter + '\nexportExcel({}, inputRows);', {
      ...context, inputRows: result.rows, adjustmentFor: () => () => 5,
      adjustedWith: (rate, value) => value * (1 + rate / 100),
      isNumeric: value => value !== '' && Number.isFinite(Number(value)), numeric: Number,
      exportFileName: () => 'test-export.xlsx'
    });
    template.categories.forEach(category => {
      const layout = template.layouts[category.layout], sheet = captured.Sheets[category.name];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      assert.deepEqual(data.slice(0, layout.headerRows.length), layout.headerRows, 'export headers match the corrected layout');
      const expected = [...category.samples[0]];
      layout.columns.forEach((column, index) => {
        if ([8, 9].includes(column.target)) expected[index] = Number((expected[index] * 1.05).toFixed(2));
      });
      assert.deepEqual(data[layout.headerRows.length], expected, 'export preserves values and price adjustments');
      if (category.layout === 'standard') assert.deepEqual(Array.from(sheet['!merges'], range => XLSX.utils.encode_range(range)), layout.merges);
    });
    checks++; console.log('PASS Excel exports match corrected products and unchanged stands');
  });
  check('Presentation Stands omitted', changed(wb => deleteSheet(wb, 'Presentation Stands')), result => assert.equal(result.rows.length, 5));
  check('Presentation Stands empty', changed(wb => emptySheet(wb, 'Presentation Stands')), result => assert.equal(result.rows.length, 5));
  check('only Breads populated; other category sheets removed', changed(wb => template.categories.filter(c => c.name !== 'Breads').forEach(c => deleteSheet(wb, c.name))), result => assert.equal(result.rows.length, 1));
  check('stand-only workbook', changed(wb => template.categories.filter(c => c.name !== 'Presentation Stands').forEach(c => deleteSheet(wb, c.name))), result => assert.equal(result.rows.length, 1));
  check('empty standard category accepted', changed(wb => emptySheet(wb, 'Breads')), result => assert.equal(result.rows.length, 5));
  const shared = XLSX.read(original, { type: 'buffer' });
  check('Excel-style shared-string package accepted', XLSX.write(shared, { type: 'buffer', bookType: 'xlsx', bookSST: true, compression: true }), result => assert.equal(result.rows.length, 6));
  check('cosmetic column widths and row heights allowed', changed(wb => { wb.Sheets.Breads['!cols'] = Array.from({ length: template.layouts.standard.columns.length }, () => ({ wch: 30 })); wb.Sheets.Breads['!rows'] = [{ hpt: 40 }]; }), result => assert.equal(result.rows.length, 6));
  check('no populated categories rejected', changed(wb => template.categories.forEach(c => emptySheet(wb, c.name))), /no products/);
  check('unknown worksheet rejected even empty', changed(wb => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Notes']]), 'Extra')), /not part/);
  check('renamed category rejected', changed(wb => { wb.Sheets.breads = wb.Sheets.Breads; delete wb.Sheets.Breads; wb.SheetNames[1] = 'breads'; }), /not part/);
  check('missing Instructions rejected', changed(wb => deleteSheet(wb, 'Instructions')), /Missing Instructions/);
  check('superseded PLA-1 version rejected', changed(wb => { wb.Sheets.Instructions.B1.v = 'PLA-1'; }), /Instructions!B1/);
  check('changed instructions rejected', changed(wb => { wb.Sheets.Instructions.B2.v = 'Anything allowed'; }), /Instructions!B2/);
  check('renamed standard header rejected', changed(wb => { wb.Sheets.Breads.D1.v = 'Mass'; }), /Breads!D1/);
  check('renamed stand header rejected', changed(wb => { wb.Sheets['Presentation Stands'].C1.v = 'Qty'; }), /Presentation Stands!C1/);
  check('missing header rejected', changed(wb => { delete wb.Sheets['Presentation Stands'].C1; }), /Presentation Stands!C1/);
  check('reordered headers rejected', changed(wb => { const sheet = wb.Sheets['Presentation Stands']; [sheet.C1, sheet.D1] = [sheet.D1, sheet.C1]; }), /Presentation Stands!C1/);
  check('extra stand column rejected', changed(wb => { const sheet = wb.Sheets['Presentation Stands']; sheet.L1 = { t: 's', v: 'Extra' }; sheet['!ref'] = 'A1:L2'; }), /extra columns/);
  check('hidden extra column rejected', changed(wb => { const sheet = wb.Sheets['Presentation Stands']; sheet.L2 = { t: 's', v: 'Hidden data' }; sheet['!cols'] = Array.from({ length: 12 }, (_, i) => ({ hidden: i === 11 })); sheet['!ref'] = 'A1:L2'; }), /extra columns/);
  check('moved header rows rejected', changed(wb => { const sheet = wb.Sheets['Presentation Stands']; wb.Sheets['Presentation Stands'] = XLSX.utils.aoa_to_sheet([[], ...XLSX.utils.sheet_to_json(sheet, { header: 1 })]); }), /Presentation Stands!A1/);
  check('modified header merges rejected', changed(wb => { wb.Sheets.Breads['!merges'] = []; }), /header merges/);
  check('removed standard column cannot be added back', changed(wb => { wb.Sheets.Breads.M1 = { t: 's', v: 'NW(KG) / Box' }; wb.Sheets.Breads['!ref'] = 'A1:M4'; }), /extra columns/);
  check('obsolete 16-column standard layout rejected', changed(wb => {
    const layout = template.layouts.standard;
    const oldHeaders = layout.headerRows.map((row, index) => [...row.slice(0, 11), ...(index === 0 ? ['NW(KG) / Box', 'GW(KG) / Box', 'MOQ', 'Total Price Based on MOQ', 'Product Group'] : Array(5).fill(''))]);
    const sample = template.categories[0].samples[0];
    wb.Sheets.Breads = XLSX.utils.aoa_to_sheet([...oldHeaders, [...sample.slice(0, 11), 6, 6.8, '40 Boxes', 1200, sample[11]]]);
    wb.Sheets.Breads['!merges'] = [...layout.merges, 'M1:M3', 'N1:N3', 'O1:O3', 'P1:P3'].map(XLSX.utils.decode_range);
  }), /extra columns/);
  check('standard Product Group remains required', changed(wb => { delete wb.Sheets.Breads.L4; }), /Breads!L4: Product Group is required/);
  check('negative prices rejected', changed(wb => { wb.Sheets.Breads.G4.v = -1; }), /Breads!G4/);
  check('missing prices rejected', changed(wb => { delete wb.Sheets.Breads.G4; }), /Breads!G4/);
  check('zero prices preserved', changed(wb => { wb.Sheets.Breads.G4.v = 0; wb.Sheets.Breads.H4.v = 0; }), result => assert.equal(result.rows[0][8], 0));
  check('fractional pieces rejected', changed(wb => { wb.Sheets.Breads.E4.v = 1.5; }), /positive whole/);
  check('zero standard weight rejected', changed(wb => { wb.Sheets.Breads.D4.v = 0; }), /positive number/);
  check('partial product row rejected', changed(wb => { delete wb.Sheets.Breads.A4; }), /Code No is required/);
  check('duplicate product codes rejected across categories', changed(wb => { wb.Sheets.Pastries.A4.v = 'lrn-brd-001'; }), /duplicate product code/);
  check('oversized text rejected without truncation', changed(wb => { wb.Sheets.Breads.B4.v = 'X'.repeat(501); }), /exceeds 500/);
  check('cached numeric formula rejected', changed(wb => { wb.Sheets.Breads.G4.f = '1+1'; }), /formulas are not accepted/);
  check('Excel errors rejected', changed(wb => { wb.Sheets.Breads.G4 = { t: 'e', v: 7 }; }), /Excel errors/);
  check('hidden category sheet rejected', changed(wb => { wb.Workbook.Sheets.find(s => s.name === 'Breads').Hidden = 1; }), /hidden worksheets/);
  check('fake xlsx rejected', Buffer.from('not a workbook'), /valid .xlsx|not an .xlsx/);
  check('macro package rejected', packageChange(files => files.push({ name: 'xl/vbaProject.bin', data: 'fake macro' })), /unsupported parts/);
  check('external workbook relationship rejected', packageChange(files => xmlChange(files, 'xl/_rels/workbook.xml.rels', xml => xml.replace('</Relationships>', '<Relationship Id="bad" Type="external" Target="https://example.com" TargetMode="External"/></Relationships>'))), /External or invalid/);
  check('XML entity declarations rejected', packageChange(files => xmlChange(files, 'xl/workbook.xml', xml => xml.replace('<workbook', '<!DOCTYPE workbook [<!ENTITY x SYSTEM "file:///C:/Windows/win.ini">]><workbook'))), /XML is unsafe/);
  check('duplicate ZIP package parts rejected', packageChange(files => files.push(files.find(file => file.name === 'xl/workbook.xml'))), /duplicate or unsafe/);
  check('unsafe ZIP path rejected', packageChange(files => files.push({ name: '../evil.xml', data: '<x/>' })), /duplicate or unsafe/);
  check('ZIP expansion bomb rejected before decompression', packageChange(files => files.push({ name: 'docProps/custom.xml', data: 'X'.repeat(500000) })), /decompression limits/);
  check('encrypted ZIP flags rejected', packageChange(files => { files[0].flags = 1; }), /Encrypted or unsupported/);
  check('corrupt archive rejected', original.subarray(0, original.length - 10), /archive is invalid/);
  check('UTF-16 XML entity declarations rejected', packageChange(files => {
    const file = files.find(f => f.name === 'xl/workbook.xml');
    const xml = file.data.toString().replace('encoding="UTF-8"', 'encoding="UTF-16"').replace('<workbook', '<!DOCTYPE workbook [<!ENTITY x SYSTEM "file:///C:/Windows/win.ini">]><workbook');
    file.data = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(xml, 'utf16le')]);
  }), /XML is unsafe/);
  const large = XLSX.read(original, { type: 'buffer' });
  template.categories.filter(c => c.name !== 'Breads').forEach(c => deleteSheet(large, c.name));
  const rows = Array.from({ length: 15000 }, (_, i) => { const row = [...template.categories[0].samples[0]]; row[0] = `BRD-${i+1}`; return row; });
  large.Sheets.Breads = XLSX.utils.aoa_to_sheet([...template.layouts.standard.headerRows, ...rows]);
  large.Sheets.Breads['!merges'] = template.layouts.standard.merges.map(XLSX.utils.decode_range);
  check('15,000 products accepted at the published limit', XLSX.write(large, { type: 'buffer', bookType: 'xlsx', compression: true }), result => assert.equal(result.rows.length, 15000));
  XLSX.utils.sheet_add_aoa(large.Sheets.Breads, [[...rows[0].map((value, index) => index === 0 ? 'BRD-15001' : value)]], { origin: 'A15004' });
  check('15,001 products rejected', XLSX.write(large, { type: 'buffer', bookType: 'xlsx', compression: true }), /15,000/);
  check('10 MB file limit enforced', Buffer.alloc(template.maxFileBytes + 1), /no more than 10 MB/);
  await apiChecks();
  const output = process.env.PLA_TEST_TEMPLATE_OUTPUT;
  if (output) fs.writeFileSync(output, original);
  console.log(`${checks} strict workbook checks passed.`);
} finally {
  for (const entry of fs.readdirSync(tmp)) fs.unlinkSync(path.join(tmp, entry));
  fs.rmdirSync(tmp);
} })().catch(error => { console.error(error); process.exitCode = 1; });
