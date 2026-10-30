// Files the AI makes: Word, Excel (with colors/conditional formatting) and PowerPoint open as valid files.
const { chromium } = require('playwright');
const JSZip = require('jszip');
let failures = 0;
const check = (c, l) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) failures++; };
const sse = (o) => `data: ${JSON.stringify(o)}\n\n`;
const F = '````';
const REPLY = [
  'Here are your files.',
  `${F}file:Ward report.docx\n<!-- {"title":"Ward Report","cover":true,"footer":true} -->\n# Summary\nOccupancy rose to **85%**.\n> [!WARNING]\n> ICU is close to capacity.\n| Ward | Patients |\n|---|---|\n| ICU | 12 |\n${F}`,
  `${F}file:Tracker.xlsx\n${JSON.stringify({ sheets: [{ name: 'Wards', title: 'Ward tracker', columns: [{ header: 'Ward', type: 'text' }, { header: 'Patients', type: 'integer', total: 'sum' }, { header: 'Occupancy', type: 'percent' }, { header: 'Status' }], rows: [['ICU', 12, 0.85, '=IF(C{row}>=0.9,"FULL","OK")'], ['ER', 30, 0.95, '=IF(C{row}>=0.9,"FULL","OK")'], ['Peds', 8, 0.4, '=IF(C{row}>=0.9,"FULL","OK")']], zebra: true, totals: true, conditional: [{ column: 'Occupancy', type: 'colorScale' }, { column: 'Patients', type: 'dataBar' }, { column: 'Occupancy', type: 'greaterThan', value: 0.9, fill: '#F8CBAD' }] }] })}\n${F}`,
  `${F}file:Deck.pptx\n${JSON.stringify({ title: 'Update', theme: { preset: 'ocean' }, slides: [{ layout: 'title', title: 'Update', subtitle: 'March' }, { layout: 'chart', title: 'Patients', chart: { type: 'bar', labels: ['ICU', 'ER'], series: [{ name: 'Patients', values: [12, 30] }] } }, { layout: 'bullets', title: 'Next', bullets: ['Hire', 'Train'] }] })}\n${F}`,
].join('\n\n');

(async () => {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/the-model-router/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/the-model-router/accounts', { method: 'DELETE' });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, acceptDownloads: true });
  await ctx.route('**/generativelanguage.googleapis.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/models?')) return route.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash Latest', inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent'] }] } });
    if (url.includes(':generateContent')) return route.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'Files' }] } }] } });
    const chunks = REPLY.match(/[\s\S]{1,300}/g);
    return route.fulfill({ headers: { 'content-type': 'text/event-stream' }, body: chunks.map((t) => sse({ candidates: [{ content: { parts: [{ text: t }] } }] })).join('') + sse({ candidates: [{ content: { parts: [] }, finishReason: 'STOP' }] }) });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:5190/?emulator');
  await page.waitForFunction(() => typeof window.__testSignIn === 'function');
  await page.evaluate(() => window.__testSignIn('hebaghoneim8@gmail.com'));
  await page.waitForSelector('input[placeholder="AIza…"]');
  await page.fill('input[placeholder="AIza…"]', 'g');
  await page.click('button:has-text("Save key")');
  await page.waitForTimeout(1500);
  await page.click('.settings-page [aria-label="Close"], .rc-page:not([hidden]) .rc-head .feature-exit, .rc-page:not([hidden]) .phone-navigation > button');
  await page.fill('.composer textarea', 'make me a report, a tracker and a deck');
  await page.click('.send-btn');
  await page.waitForSelector('.msg.assistant .model-tag', { timeout: 20000 });
  check((await page.$$('.file-card')).length === 3, 'three file cards shown');

  const download = async (name) => {
    const [d] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click(`[aria-label="Save ${name}"]`)]);
    const buf = require('fs').readFileSync(await d.path());
    return { name: d.suggestedFilename(), zip: await JSZip.loadAsync(buf), buf };
  };

  const docx = await download('Ward report.docx');
  const docXml = await docx.zip.file('word/document.xml').async('string');
  check(docx.name.endsWith('.docx') && docXml.includes('Occupancy rose to') && docXml.includes('ICU'), `Word file is valid (${docx.name})`);

  const xlsx = await download('Tracker.xlsx');
  const sheet = await xlsx.zip.file('xl/worksheets/sheet1.xml').async('string');
  check(sheet.includes('<conditionalFormatting') && sheet.includes('dataBar'), 'Excel has conditional formatting');
  check(!/<x14:id\s*\/>|<x14:id><\/x14:id>/.test(sheet), 'no empty x14:id (the "damaged file" bug)');
  const priorities = [...sheet.matchAll(/<cfRule[^>]*priority="(\d+)"/g)].map((m) => m[1]);
  check(priorities.length >= 3 && new Set(priorities).size === priorities.length, `conditional rules have unique priorities (${priorities.join(',')})`);
  check(sheet.includes('SUM('), 'totals row uses a formula');
  check(/<f>IF\(C5&gt;=0\.9,&quot;FULL&quot;,&quot;OK&quot;\)<\/f><v>FULL<\/v>/.test(sheet) && /<f>SUM\(B\d:B\d\)<\/f><v>50<\/v>/.test(sheet), 'formulas carry their results (phone viewers show values)');

  const pptx = await download('Deck.pptx');
  const slides = Object.keys(pptx.zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
  check(slides.length === 3 && Object.keys(pptx.zip.files).some((f) => f.startsWith('ppt/charts/')), `PowerPoint has 3 slides and a chart (${slides.length})`);

  // Preview opens.
  await page.click('[aria-label="Preview Tracker.xlsx"]');
  const shown = await page.waitForFunction(() => [...document.querySelectorAll('.modal td, .modal th, .modal')].some((e) => /Peds/.test(e.textContent || '')), null, { timeout: 15000 }).then(() => true, () => false);
  check(shown, 'Excel preview shows the data');
  const cells = await page.$$eval('.modal td', (tds) => tds.map((t) => t.textContent));
  check(cells.includes('FULL') && cells.includes('OK') && !cells.some((t) => t.includes('=IF') || t.includes('{row}')), 'preview shows formula results, not code');

  check(!errors.length, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
