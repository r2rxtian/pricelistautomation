'use strict';
// Real upload markup, CSS, event handlers, dropdowns and motion; isolated API responses.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const XLSX = require(path.join(root, 'assets/vendor/xlsx.full.min.js'));
const app = fs.readFileSync(path.join(root, 'scripts/app.js'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'components/app_shell.php'), 'utf8');
const dialogStart = shell.indexOf('<dialog id="uploadModal"');
const dialog = shell.slice(dialogStart, shell.indexOf('</dialog>', dialogStart) + 9);
const contract = JSON.parse(fs.readFileSync(path.join(root, 'rules/price_list_template.json'), 'utf8'));
const moduleSource = app.slice(app.indexOf('  // Files waiting in the upload modal'), app.indexOf('  function resetFilters()'));
const listeners = app.slice(app.indexOf('  // Upload Modal Listeners'), app.indexOf('  // --- Audit Logs & Notification System'));
const domIds = ['uploadModal', 'closeUploadModalBtn', 'cancelUploadBtn', 'submitUploadBtn', 'downloadTemplateBtn', 'modalDropZone', 'modalFileInput', 'browseFileBtn', 'dropZonePrompt'];
const harness = `
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const state={importTemplate:${JSON.stringify(contract)},countries:['Australia','China','France','Germany','Hong Kong','Italy','Japan','Philippines','Singapore','Switzerland','Thailand','Vietnam'],priceLevels:['Price Level 4'],csrf:'test-csrf',active:{id:'old',name:'Old draft',isDraft:true},autoApprove:false};
const dom=Object.fromEntries(${JSON.stringify(domIds)}.map(id=>[id,$('#'+id)]));
const can=()=>true,confirmDiscardDraft=async()=>true,fillDatalists=()=>{},guessPriceLevel=()=> 'Price Level 4';
const priceLevelOptionsHtml=value=>'<option value="">Price level…</option><option'+(value?' selected':'')+'>Price Level 4</option>';
const toast=message=>{window.lastToast=message;},escapeHtml=value=>{const node=document.createElement('div');node.textContent=String(value??'');return node.innerHTML;};
const statusLabel=value=>value,refreshState=async()=>{},resetFilters=()=>{},rememberCategory=()=>{},draftKey=()=> 'old';
const removeDraft=async()=>{window.removedDraft=(window.removedDraft||0)+1;},loadActive=active=>{state.active=active;},switchPanel=id=>{window.panel=id;};
async function api(action,options){window.lastRequest={action,keys:[...options.body.keys()],csrf:options.headers['X-CSRF-Token']};if(window.holdUpload)await new Promise(resolve=>{window.releaseUpload=resolve;});if(window.failUpload)throw Error('Presentation Stands!C1: expected "PC/Set Per Box". <img src=x onerror=alert(1)>');return {ok:true,active:{id:'new',name:'Accepted list',productCount:6,status:'uploaded',rows:Array(6).fill([])}};}
${moduleSource}
${listeners}
XLSX.writeFile=(wb,name)=>{window.download={name,sheets:wb.SheetNames};};
window.QA={state,openUploadModal,stageFilesForUpload,getStaged:()=>stagedFiles};
`;
const safeHarness = harness.replaceAll('</script>', '<' + String.fromCharCode(92) + '/script>');
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles/app.css"></head><body>${dialog}<script src="/assets/vendor/xlsx.full.min.js"></script><script>${safeHarness}</script><script src="/scripts/select-dropdown.js"></script><script src="/scripts/motion.js"></script><script>openUploadModal();</script></body></html>`;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pla-upload-ui-'));
const server = http.createServer((request, response) => {
  if (request.url === '/') { response.setHeader('Content-Type', 'text/html; charset=utf-8'); return response.end(html); }
  const filename = path.resolve(root, '.' + decodeURIComponent(request.url.split('?')[0]));
  if (!filename.startsWith(root + path.sep) || !fs.existsSync(filename)) { response.statusCode = 404; return response.end(); }
  response.setHeader('Content-Type', filename.endsWith('.js') ? 'text/javascript' : filename.endsWith('.css') ? 'text/css' : 'application/octet-stream');
  response.end(fs.readFileSync(filename));
});
let browser, socket, checks = 0;
function pass(name) { checks++; console.log(`PASS ${name}`); }
(async () => { try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = spawn(process.env.PLA_TEST_EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  const debug = await new Promise((resolve, reject) => {
    let output = ''; const timer = setTimeout(() => reject(Error('Browser did not start')), 10000);
    browser.stderr.on('data', chunk => { output += chunk; const match = output.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/); if (match) { clearTimeout(timer); resolve(Number(match[1])); } });
    browser.on('error', error => { clearTimeout(timer); reject(error); });
    browser.on('exit', () => { clearTimeout(timer); reject(Error('Browser exited before QA')); });
  });
  const targets = await (await fetch(`http://127.0.0.1:${debug}/json/list`)).json();
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let serial = 0; const pending = new Map(), errors = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) { const handler = pending.get(message.id); if (!handler) return; clearTimeout(handler.timer); pending.delete(message.id); message.error ? handler.reject(Error(JSON.stringify(message.error))) : handler.resolve(message.result); }
    else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  });
  const rpc = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial, timer = setTimeout(() => { pending.delete(id); reject(Error(`Timed out: ${method} ${params.expression || ''}`)); }, 10000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => { const result = await rpc('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return result.result.value; };
  async function waitFor(expression) { for (let i = 0; i < 60; i++) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 20)); } throw Error(`Condition not reached: ${expression}`); }
  async function viewport(width, height) {
    await rpc('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await new Promise(resolve => setTimeout(resolve, 30));
    await evaluate('document.documentElement.getBoundingClientRect().width');
  }
  async function screenshot(name) {
    if (!process.env.PLA_MODAL_QA_OUTPUT) return;
    await new Promise(resolve => setTimeout(resolve, 100));
    fs.writeFileSync(path.join(process.env.PLA_MODAL_QA_OUTPUT, `${name}.png`), Buffer.from((await rpc('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })).data, 'base64'));
  }
  async function assertFit(name, height) {
    const size = await evaluate(`(()=>{const modal=$('#uploadModal'),footer=$('.upload-footer');return {scroll:modal.scrollHeight,height:modal.clientHeight,width:modal.scrollWidth,clientWidth:modal.clientWidth,bottom:footer.getBoundingClientRect().bottom,top:footer.getBoundingClientRect().top};})()`);
    assert.ok(size.scroll <= size.height + 2, `${name}: modal scrolls ${JSON.stringify(size)}`);
    assert.ok(size.width <= size.clientWidth + 2, `${name}: horizontal overflow`);
    assert.ok(size.bottom <= height - 5 && size.top >= 0, `${name}: footer off-screen`);
  }
  async function assertWorksheet(key) {
    const layout = contract.layouts[key], category = contract.categories.find(category => category.layout === key);
    const preview = await evaluate(`(()=>{const panel=$('#templateLayout-${key}'),table=panel.querySelector('table');return {
      columns:table.querySelectorAll('col').length,
      cells:[...table.querySelectorAll('[data-cell]')].map(cell=>({address:cell.dataset.cell,text:cell.textContent,rowspan:cell.rowSpan,colspan:cell.colSpan})),
      letters:[...table.querySelectorAll('.template-column-ruler th')].slice(1).map(cell=>cell.textContent),
      rows:[...table.querySelectorAll('tr')].slice(1).map(row=>row.querySelector('.template-row-number').textContent),
      sheet:panel.querySelector('.template-sheet-name').textContent,
      fontSize:parseFloat(getComputedStyle(table).fontSize)
    };})()`);
    const starts = new Map(), covered = new Set(), expected = [];
    layout.merges.forEach(address => {
      const range = XLSX.utils.decode_range(address); starts.set(XLSX.utils.encode_cell(range.s), range);
      for (let r = range.s.r; r <= range.e.r; r++) for (let c = range.s.c; c <= range.e.c; c++) {
        if (r !== range.s.r || c !== range.s.c) covered.add(XLSX.utils.encode_cell({ r, c }));
      }
    });
    layout.headerRows.forEach((row, r) => layout.columns.forEach((_, c) => {
      const address = XLSX.utils.encode_cell({ r, c }); if (covered.has(address)) return;
      const range = starts.get(address);
      expected.push({ address, text: row[c] || '', rowspan: range ? range.e.r - range.s.r + 1 : 1, colspan: range ? range.e.c - range.s.c + 1 : 1 });
    }));
    const sheet = XLSX.utils.aoa_to_sheet([...layout.headerRows, ...category.samples]);
    category.samples.forEach((row, index) => layout.columns.forEach((column, c) => {
      const address = XLSX.utils.encode_cell({ r: layout.headerRows.length + index, c });
      const cell = sheet[address]; if (cell && column.type !== 'text') cell.z = column.type === 'integer' ? '0' : '0.00';
      expected.push({ address, text: cell ? XLSX.utils.format_cell(cell) : '', rowspan: 1, colspan: 1 });
    }));
    assert.deepEqual(preview.cells, expected, `${key}: preview must match workbook headers, merges and formatted sample values`);
    assert.equal(preview.columns, layout.columns.length + 1);
    assert.deepEqual(preview.letters, layout.columns.map((_, index) => XLSX.utils.encode_col(index)));
    assert.deepEqual(preview.rows, Array.from({ length: layout.headerRows.length + category.samples.length + 2 }, (_, index) => String(index + 1)));
    assert.equal(preview.sheet, category.name); assert.ok(preview.fontSize >= 11, 'worksheet text stays readable');
    pass(`${key} Excel preview matches the downloadable worksheet`);
  }
  await rpc('Runtime.enable'); await rpc('Page.enable'); await viewport(1440, 900);
  await rpc('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
  await waitFor('Boolean(window.QA&&$("#uploadModal").open)');
  await new Promise(resolve => setTimeout(resolve,600));
  for (const [width, height] of [[1440, 900], [1366, 768], [1024, 640], [768, 600], [390, 844], [390, 667], [320, 568], [812, 375]]) {
    await viewport(width, height); await assertFit(`empty ${width}×${height}`, height);
    assert.equal(await evaluate('$("#uploadGuideView").hidden'), true); pass(`empty view fits ${width}×${height} without modal scrolling`);
  }
  await viewport(1440, 900); await screenshot('upload-empty');
  await evaluate('$("#downloadTemplateBtn").click()');
  assert.deepEqual(await evaluate('download.sheets'), ['Instructions', ...contract.categories.map(category => category.name)]); pass('official download preserved');
  await evaluate('QA.stageFilesForUpload(new File(["xlsx"],"official.xlsx"));const country=$("[data-field=country]");country.value="Switzerland";country.dispatchEvent(new Event("input",{bubbles:true}));const name=$("[data-field=name]");name.value=\'List "quoted" name\';name.dispatchEvent(new Event("input",{bubbles:true}));$("#uploadTemplateRulesBtn").click()');
  assert.equal(await evaluate('$("#uploadMainView").hidden'), true);
  assert.equal(await evaluate('$("#uploadMainActions").hidden'), true);
  assert.equal(await evaluate('$(".template-validity-group.is-accepted").querySelectorAll("li").length'), 3);
  assert.equal(await evaluate('$(".template-validity-group.is-rejected").querySelectorAll("li").length'), 3);
  assert.match(await evaluate('$(".template-validation-outcome").textContent'), /One invalid sheet rejects the whole workbook/);
  assert.match(await evaluate('$(".template-validity-summary").textContent'), /sheet is optional.*headers are not/);
  for (const key of ['standard', 'presentation']) {
    const fields = await evaluate(`({required:$('#templateLayout-${key} .template-required-values').textContent,optional:$('#templateLayout-${key} .template-optional-values').textContent})`);
    contract.layouts[key].columns.forEach(column => assert.ok(fields[column.required ? 'required' : 'optional'].includes(column.name)));
    assert.match(fields.optional, /Keep these headers/);
  }
  pass('validity guidance clearly distinguishes optional sheets, required headers and required values');
  await assertWorksheet('standard');
  await assertFit('standard guide desktop', 900); await screenshot('upload-guide-standard');
  await evaluate('$("#templateLayout-standard .template-sheet-scroll").scrollLeft=900');
  assert.ok(await evaluate('$("#templateLayout-standard .template-sheet-scroll").scrollLeft>0'));
  await screenshot('upload-guide-standard-pallet');
  await evaluate('$("#templateLayout-standard .template-sheet-scroll").scrollLeft=0');
  await waitFor('document.activeElement.id==="templateStandardTab"');
  await evaluate('document.activeElement.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true,cancelable:true}))');
  assert.equal(await evaluate('$("#templatePresentationTab").getAttribute("aria-selected")'), 'true');
  assert.equal(await evaluate('$("#templateLayout-presentation").hidden'), false);
  await assertWorksheet('presentation');
  await assertFit('guide desktop', 900); await screenshot('upload-guide-presentation');
  for (const key of ['standard', 'presentation']) {
    await evaluate(`$('#${key === 'standard' ? 'templateStandardTab' : 'templatePresentationTab'}').click()`);
    for (const [width, height] of [[1366, 768], [1024, 640], [390, 667], [320, 568], [812, 375]]) {
      await viewport(width, height); await assertFit(`${key} guide ${width}×${height}`, height);
      assert.equal(await evaluate(`$('#templateLayout-${key} .template-sheet-scroll').tabIndex`), 0);
      assert.ok(await evaluate(`$('#templateLayout-${key} .template-sheet-scroll').scrollWidth>$('#templateLayout-${key} .template-sheet-scroll').clientWidth`));
      if (width === 390) {
        await screenshot(`upload-guide-${key}-mobile`);
        await evaluate('$(".template-validity").scrollIntoView({block:"start",behavior:"instant"})');
        await screenshot(`upload-validity-${key}-cases-mobile`);
        await evaluate('$(".template-guide-content").scrollTop=$(".template-guide-content").scrollHeight');
        await assertFit('mobile validity guidance', height); await screenshot(`upload-validity-${key}-mobile`);
        assert.ok(await evaluate('$(".template-validation-outcome").getBoundingClientRect().bottom<=$(".upload-footer").getBoundingClientRect().top'));
        await evaluate('$(".template-guide-content").scrollTop=0');
      }
    }
  }
  await viewport(1366, 768); await evaluate('document.documentElement.dataset.theme="dark"');
  await new Promise(resolve => setTimeout(resolve,300));
  await assertFit('dark worksheet guide', 768); await screenshot('upload-guide-dark');
  assert.equal(await evaluate('getComputedStyle($("#templateLayout-presentation [data-cell=A2]")).color'), 'rgb(244, 244, 246)');
  await evaluate('document.documentElement.removeAttribute("data-theme")');
  pass('template guide remains readable with anchored mobile actions');
  const cancel = await evaluate('$("#uploadModal").dispatchEvent(new Event("cancel",{cancelable:true}))');
  assert.equal(cancel, false); assert.equal(await evaluate('$("#uploadModal").open'), true); assert.equal(await evaluate('$("#uploadGuideView").hidden'), true);
  assert.equal(await evaluate('$("[data-field=name]").value'), 'List "quoted" name');
  assert.equal(await evaluate('QA.getStaged()[0].country'), 'Switzerland'); pass('guide tabs, keyboard/Escape navigation and metadata preservation');
  for (const [width, height] of [[1366, 768], [390, 667], [320, 568], [812, 375]]) { await viewport(width, height); await assertFit('selected file', height); }
  await viewport(1440, 900); await screenshot('upload-selected');
  await evaluate('$("[data-field=country]").dispatchEvent(new MouseEvent("mousedown",{bubbles:true,cancelable:true}))');
  await waitFor('$("#selectDropdownMenu").matches(":popover-open")');
  assert.ok(await evaluate('$("#selectDropdownMenu").getBoundingClientRect().bottom <= innerHeight'));
  await evaluate('$("#selectDropdownMenu").dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true}))'); pass('country dropdown remains above the modal');
  await evaluate('window.failUpload=true;$("#submitUploadBtn").click()');
  await waitFor('QA.getStaged()[0].status==="failed"');
  assert.equal(await evaluate('QA.state.active.id'), 'old'); assert.equal(await evaluate('window.removedDraft||0'), 0);
  assert.equal(await evaluate('$("#uploadValidationErrors").querySelectorAll("img").length'), 0);
  assert.match(await evaluate('$("#uploadValidationErrors").textContent'), /Presentation Stands!C1/);
  assert.deepEqual(await evaluate('lastRequest.keys'), ['kind', 'name', 'country', 'priceLevel', 'workbook']);
  for (const [width, height] of [[1366, 768], [390, 667], [320, 568], [812, 375]]) { await viewport(width, height); await assertFit('validation failure', height); }
  await viewport(390, 667); await screenshot('upload-mobile-error'); pass('persistent escaped errors, visible footer and original draft retained');
  await evaluate('window.failUpload=false;window.holdUpload=true;QA.stageFilesForUpload(new File(["fixed"],"corrected.xlsx"));const correctedCountry=$("[data-field=country]");correctedCountry.value="Switzerland";correctedCountry.dispatchEvent(new Event("input",{bubbles:true}));$("#submitUploadBtn").click()');
  await waitFor('Boolean(window.releaseUpload)');
  assert.equal(await evaluate('$("#uploadTemplateRulesBtn").disabled&&$("#browseFileBtn").disabled'), true);
  await evaluate('$("#uploadModal").dispatchEvent(new Event("cancel",{cancelable:true}));$("#closeUploadModalBtn").click()');
  assert.equal(await evaluate('$("#uploadModal").open'), true); pass('busy state blocks closing and file changes');
  await evaluate('window.holdUpload=false;releaseUpload()'); await waitFor('!$("#uploadModal").open');
  assert.equal(await evaluate('QA.state.active.id'), 'new'); assert.equal(await evaluate('window.removedDraft'), 1); pass('corrected workbook retry opens the new list');
  await evaluate('QA.openUploadModal()'); await waitFor('$("#uploadModal").open'); await new Promise(resolve => setTimeout(resolve,600));
  await evaluate('QA.stageFilesForUpload(Array.from({length:5},(_,i)=>new File(["xlsx"],"list-"+i+".xlsx")))');
  for (const [width, height] of [[1366, 768], [390, 667], [320, 568], [812, 375]]) { await viewport(width, height); await assertFit('five-file batch', height); assert.ok(await evaluate('$("#stagedFilesList").clientHeight>20')); }
  await viewport(1366, 768); await screenshot('upload-batch');
  await evaluate('$("#applyAllCountry").value="Switzerland";$("#applyAllPriceLevel").value="Price Level 4";$("#applyAllBtn").click()');
  assert.equal(await evaluate('QA.getStaged().every(file=>file.country==="Switzerland"&&file.priceLevel==="Price Level 4")'), true); pass('five-file queue fits and batch metadata still applies');
  await evaluate('document.documentElement.dataset.theme="dark"');
  await new Promise(resolve => setTimeout(resolve,300));
  await screenshot('upload-dark'); await assertFit('dark batch', 768);
  assert.equal(await evaluate('getComputedStyle($("#modalDropZone")).backgroundColor'), 'rgb(27, 29, 34)');
  await evaluate('window.failUpload=true;$("#submitUploadBtn").click()');
  await waitFor('QA.getStaged().every(file=>file.status==="failed")');
  assert.equal(await evaluate('$("#browseFileBtn").hidden'), false);
  for (const [width, height] of [[1366, 768], [390, 667], [320, 568]]) {
    await viewport(width, height); await assertFit('five rejected files', height);
    const sizes = await evaluate('({queue:$("#stagedFilesList").clientHeight,main:$("#uploadMainView").clientHeight,errors:$("#uploadValidationErrors").clientHeight,tools:$(".upload-template-tools").clientHeight,drop:$("#modalDropZone").clientHeight,panel:$("#stagedFilesPanel").clientHeight,hint:$("#stagedFilesHint").clientHeight})');
    assert.ok(sizes.queue>20, `${width}×${height}: ${JSON.stringify(sizes)}`);
  }
  pass('full rejected batch stays usable and can select corrected files');
  assert.equal(errors.length, 0, JSON.stringify(errors)); pass('dark mode and no browser exceptions');
  console.log(`${checks} upload UI checks passed.`);
} finally {
  socket?.close(); browser?.kill(); server.close();
  await new Promise(resolve => setTimeout(resolve, 300));
  const resolved = path.resolve(profile);
  if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep + 'pla-upload-ui-')) fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
} })().catch(error => { console.error(error); process.exitCode = 1; });
