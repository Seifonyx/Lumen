// Real Pyodide, pandas, Excel and matplotlib. No Python responses are mocked.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const fs = require('node:fs');
const csv = { name: 'data.csv', mimeType: 'text/csv', buffer: Buffer.from('value,label\n1,a\n2,b\n3,c\n') };
(async () => {
 const browser = await chromium.launch();
 const ctx = await browser.newContext({ viewport: { width:1280, height:860 }, acceptDownloads:true });
 try {
  let calls = 0;
  await ctx.route('**/firestore.googleapis.com/**', r => r.abort());
  await ctx.route('**/generativelanguage.googleapis.com/**', r => { calls++; return r.fulfill({ json: { models:[] } }); });
  await ctx.addInitScript(() => {
   if (localStorage.getItem('mr.preview_user')) return;
   const uid='preview-analysis', settings={autoIntroduced:true,autoTitle:false,enabledModels:['gemini:gemini-flash-latest'],defaultModel:'gemini:gemini-flash-latest'};
   localStorage.setItem('mr.preview_user',JSON.stringify({uid,email:'analysis@local.invalid',displayName:'Analysis'}));
   localStorage.setItem(`mr.account.${uid}`,JSON.stringify({geminiKey:'fixture',settings}));localStorage.setItem('mr.settings',JSON.stringify(settings));localStorage.setItem('mr.installHint','1');
  });
  const page = await ctx.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.MR_TEST_URL || 'http://localhost:5190/?emulator');await page.waitForSelector('.composer textarea');
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
  const open = async () => { await page.getByRole('button',{name:/^Add .*repository$/}).click();await page.getByRole('button',{name:'Tools',exact:true}).click();await page.getByRole('button',{name:/Data analysis/}).click();await page.waitForSelector('.analysis-panel'); };
  const close = async () => { await page.locator('.modal [aria-label="Close"]').click();await page.waitForSelector('.analysis-panel',{state:'detached'}); };
  const upload = async files => { await page.getByLabel('Upload analysis files').setInputFiles(files);await page.waitForFunction(()=>!document.querySelector('.analysis-upload .spin')); };
  const code = async text => {await page.locator('.run-code .cm-content').click();await page.keyboard.press('Control+a');await page.keyboard.insertText(text);};
  const run = async () => {await page.getByRole('button',{name:/^Run( again)?$/,exact:true}).click();await page.waitForFunction(()=>/Finished|Failed/.test(document.querySelector('.run-status')?.textContent||''),null,{timeout:250000});assert.ok((await page.locator('.run-status').textContent()).includes('Finished'),await page.locator('.run-out').textContent());};
  const download = async name => {const event=page.waitForEvent('download');await page.locator('.analysis-download').filter({hasText:name}).click();const item=await event;const stream=await item.createReadStream();const parts=[];for await(const part of stream)parts.push(part);return Buffer.concat(parts);};
  await open();assert.equal(await page.locator('.run-line').count(),1);assert.ok(!(await page.locator('.run-out').textContent()).includes('Loading Python'));
  await upload({name:'no.exe',mimeType:'application/octet-stream',buffer:Buffer.from('no')});assert.ok((await page.getByRole('alert').textContent()).includes('CSV'));
  await upload(csv);await upload(csv);assert.ok((await page.locator('.analysis-file-list').textContent()).includes('data (2).csv'));await page.getByRole('button',{name:'Remove data (2).csv',exact:true}).click();
  await run();assert.ok((await page.locator('.run-out').textContent()).includes('Rows: 3 Columns: 2'));assert.ok((await download('summary.csv')).toString().includes('mean,2.0'));
  console.log('PASS real pandas CSV inspection and summary download');
  const workbook=new ExcelJS.Workbook();const sheet=workbook.addWorksheet('Patients');sheet.addRow(['value','label']);sheet.addRow([4,'d']);sheet.addRow([6,'e']);workbook.addWorksheet('Other').addRow(['other']);
  await page.getByRole('button',{name:'Remove data.csv',exact:true}).click();await upload({name:'patients.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(await workbook.xlsx.writeBuffer())});
  await page.getByRole('button',{name:'Clean & export',exact:true}).click();await run();assert.ok((await page.locator('.run-out').textContent()).includes("['Patients', 'Other']"));assert.ok((await download('cleaned.csv')).toString().includes('4,d'));
  const exported=new ExcelJS.Workbook();await exported.xlsx.load(await download('cleaned.xlsx'));assert.equal(exported.worksheets[0].getCell('A3').value,6);
  console.log('PASS real multi-sheet Excel input and readable CSV/XLSX exports');
  await page.getByRole('button',{name:'Make a chart',exact:true}).click();await run();const png=await download('figure-1.png');assert.equal(png.subarray(1,4).toString(),'PNG');await page.locator('.analysis-artifacts img').first().evaluate(img=>img.decode());assert.ok((await page.locator('.analysis-artifacts img').first().boundingBox()).width>200);
  console.log('PASS real matplotlib chart preview and PNG download');
  await code('from pathlib import Path\nprint("inputs", len(input_files))\nprint("old variable", "df" in globals())\nprint("old output", len(list(Path(output_dir).iterdir())))\nraise ValueError("fixture failure")');
  await page.getByRole('button',{name:'Run again',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.run-status')?.textContent.includes('Failed'));assert.ok((await page.locator('.run-out').textContent()).includes('old variable False'));assert.ok((await page.locator('.run-out').textContent()).includes('old output 0'));assert.equal(await page.locator('.analysis-download').count(),0);
  await page.getByRole('button',{name:'Add output to draft',exact:true}).click();await page.waitForSelector('.analysis-panel',{state:'detached'});assert.ok((await page.inputValue('.composer textarea')).includes('fixture failure'));assert.equal(await page.locator('.msg.user').count(),0);await page.fill('.composer textarea','');
  const cached=await page.evaluate(async()=> (await caches.open('model-router-python-0.26.4')).keys().then(items=>items.map(x=>x.url)));
  assert.ok(cached.some(url=>url.endsWith('pyodide.asm.wasm')),`Python runtime cache missing: ${cached.join(', ')}`);assert.ok(cached.some(url=>url.includes('pandas')));assert.ok(cached.some(url=>url.includes('matplotlib')));
  console.log('PASS fresh namespaces/output folders, failed export reset and draft review without sending');
  // A reload destroys the worker. Offline execution must use persistent caches, not a warm runtime.
  await ctx.setOffline(true);await page.reload();await page.waitForSelector('.composer textarea');await open();await upload(csv);await run();assert.ok((await page.locator('.run-out').textContent()).includes('Rows: 3 Columns: 2'));
  await code('print("loop started", flush=True)\nwhile True:\n    pass');await page.getByRole('button',{name:'Run again',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.run-out')?.textContent.includes('loop started'));await page.getByRole('button',{name:'Stop',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.run-status')?.textContent.includes('Failed'));
  await code('print("recovered", sum([1, 2, 3]))');await run();assert.ok((await page.locator('.run-out').textContent()).includes('recovered 6'));
  await code('from pathlib import Path\nfor n in range(21):\n    Path("/output/%s.txt" % n).write_text("test")');await page.getByRole('button',{name:'Run again',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.run-status')?.textContent.includes('Failed'));assert.ok((await page.locator('.run-out').textContent()).includes('limited to 20 files'));assert.equal(await page.locator('.analysis-download').count(),0);
  await close();await ctx.setOffline(false);
  console.log('PASS cold Python worker, packages and uploads work after an offline reload');
  console.log('PASS stopped loops recover offline and oversized output sets expose no partial downloads');
  for(const width of [390,320]) {
   await page.setViewportSize({width,height:844});await open();await upload(csv);
   assert.ok(await page.locator('.analysis-panel').evaluate(el=>el.scrollWidth<=el.clientWidth+1));assert.ok(await page.locator('.modal-body').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
   await page.evaluate(()=>{document.documentElement.classList.add('kb-open');document.documentElement.style.setProperty('--vv-h','400px');document.documentElement.style.setProperty('--vv-top','0px');});
   assert.ok((await page.locator('.modal').boundingBox()).height<=401);
   await page.evaluate(()=>{document.documentElement.classList.remove('kb-open');document.documentElement.style.removeProperty('--vv-h');document.documentElement.style.removeProperty('--vv-top');});
   fs.mkdirSync('tests/e2e/out',{recursive:true});await page.screenshot({path:`tests/e2e/out/analysis-${width}.png`});await close();console.log(`PASS ${width}px analysis layout and keyboard height`);
  }
  assert.deepEqual(errors,[]);
 } finally {await ctx.close();await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
