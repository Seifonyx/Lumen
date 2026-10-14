// Editing an attached Word and Excel file in place: the reply's edits are applied to the original, keeping formatting.
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const JSZip = require('jszip');
const { Document, Packer, Paragraph, TextRun, Header, Table, TableRow, TableCell } = require('docx');
const ExcelJS = require('exceljs');
const { profile } = require('./helpers/preview-profile.cjs');

async function makeDocx() {
  const doc = new Document({ sections: [{
    headers: { default: new Header({ children: [new Paragraph('Report date: [Date]')] }) },
    children: [
      new Paragraph({ children: [new TextRun({ text: 'Patient: ', bold: true }), new TextRun({ text: '[Patient name]', italics: true })] }),
      new Paragraph('Findings'),
      new Paragraph('Draft – do not circulate'),
      new Table({ rows: [new TableRow({ children: [new TableCell({ children: [new Paragraph('Ward')] }), new TableCell({ children: [new Paragraph('[Ward]')] })] })] }),
    ] }] });
  return Packer.toBuffer(doc);
}
async function makeXlsx() {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Summary');
  ws.addRow(['Ward', 'Patients']); ws.addRow(['ICU', 10]);
  ws.getCell('B2').numFmt = '0.00'; ws.getCell('A1').font = { bold: true };
  return Buffer.from(await wb.xlsx.writeBuffer());
}
const reply = (block) => 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: block }] }, finishReason: 'STOP' }] }) + '\n\n';

(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce', acceptDownloads: true });
    await profile(ctx, 'preview-office-edit', 'light');
    let next = '', prompt = '';
    await ctx.route('**/generativelanguage.googleapis.com/**', (r) => r.request().url().includes('/models?') ? r.fallback() : (prompt = r.request().postData() || '', r.fulfill({ contentType: 'text/event-stream', body: reply(next) })));
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => { if (!e.message.includes('firestore')) errors.push(e.message); });
    await page.goto(process.env.MR_TEST_URL || 'http://localhost:5190/?emulator');
    await page.locator('.composer textarea').waitFor();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'office-'));

    // Word
    fs.writeFileSync(path.join(dir, 'Ward report.docx'), await makeDocx());
    await page.locator('.composer input[type=file]').last().setInputFiles(path.join(dir, 'Ward report.docx'));
    await page.locator('.composer').getByText('Ward report.docx').waitFor();
    next = 'Done.\n\n````office-edit:Ward report.docx\n' + JSON.stringify({ edits: [
      { find: '[Patient name]', replace: 'Mona Adel' },
      { find: '[Date]', replace: '14 October 2026', all: true },
      { find: '[Ward]', replace: 'ICU' },
      { after: 'Findings', insert: ['Oxygen trend stable.'] },
      { delete: 'Draft – do not circulate' },
      { find: 'not in the file', replace: 'x' },
    ] }) + '\n````';
    await page.fill('.composer textarea', 'Fill in the template.');
    await page.click('.send-btn');
    const card = page.locator('.office-edit-card');
    await card.waitFor();
    assert.match(prompt, /office-edit:/, 'models are told how to edit attached files');
    const [download] = await Promise.all([page.waitForEvent('download'), card.getByRole('button', { name: 'Download edited file' }).click()]);
    assert.equal(download.suggestedFilename(), 'Ward report (edited).docx');
    const zip = await JSZip.loadAsync(fs.readFileSync(await download.path()));
    const body = await zip.file('word/document.xml').async('string');
    const header = (await Promise.all(Object.keys(zip.files).filter((n) => /word\/header\d*\.xml/.test(n)).map((n) => zip.file(n).async('string')))).join('');
    assert.match(body, /<w:b\/>[\s\S]*Patient: [\s\S]*<w:i\/>[\s\S]*Mona Adel/, 'bold label and italic value keep their formatting');
    assert.match(header, /14 October 2026/, 'header placeholder replaced');
    assert.match(body, /<w:tc>[\s\S]*ICU/, 'table cell filled');
    assert.match(body, /Findings[\s\S]*Oxygen trend stable\./, 'paragraph inserted after Findings');
    assert.doesNotMatch(body, /do not circulate/, 'draft line removed');
    const { value: text } = await require('mammoth').extractRawText({ buffer: fs.readFileSync(await download.path()) });
    assert.match(text, /Patient: Mona Adel[\s\S]*Findings\s+Oxygen trend stable\./, 'the edited file still opens as a Word document');
    await card.locator('li.miss').filter({ hasText: 'not in the file' }).waitFor();
    if (process.env.SHOT) await card.screenshot({ path: process.env.SHOT });
    assert.equal(await card.locator('li.ok').count(), 5);

    // Excel
    fs.writeFileSync(path.join(dir, 'Census.xlsx'), await makeXlsx());
    await page.locator('.composer input[type=file]').last().setInputFiles(path.join(dir, 'Census.xlsx'));
    await page.locator('.composer').getByText('Census.xlsx').waitFor();
    next = '````office-edit:Census.xlsx\n' + JSON.stringify({ edits: [{ sheet: 'Summary', cell: 'B2', value: 12 }, { sheet: 'Summary', cell: 'A3', value: 'ER' }, { sheet: 'Summary', cell: 'B3', value: '=B2*2' }] }) + '\n````';
    await page.fill('.composer textarea', 'Update the census.');
    await page.click('.send-btn');
    const sheetCard = page.locator('.office-edit-card').last();
    await sheetCard.getByText('Census.xlsx', { exact: false }).first().waitFor();
    const [xl] = await Promise.all([page.waitForEvent('download'), sheetCard.getByRole('button', { name: 'Download edited file' }).click()]);
    const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(await xl.path());
    const ws = wb.getWorksheet('Summary');
    assert.equal(ws.getCell('B2').value, 12);
    assert.equal(ws.getCell('B2').numFmt, '0.00', 'cell keeps its number format');
    assert.equal(ws.getCell('A1').font?.bold, true, 'other formatting untouched');
    assert.equal(ws.getCell('A3').value, 'ER');
    assert.equal(ws.getCell('B3').formula, 'B2*2');

    assert.deepEqual(errors, []);
    console.log('PASS editing attached Word and Excel files keeps their formatting');
    await ctx.close();
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
