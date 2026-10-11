const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const JSZip=require('jszip');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch();
 try {for(const width of [1280,390,320]){
  const ctx=await browser.newContext({viewport:{width,height:844},isMobile:width<900,hasTouch:width<900,acceptDownloads:true});
  await ctx.route('**/firestore.googleapis.com/**',r=>r.abort());
  await ctx.route('**/generativelanguage.googleapis.com/**',r=>r.request().url().includes('/models?')?r.fulfill({json:{models:[{name:'models/gemini-flash-latest',displayName:'Flash',supportedGenerationMethods:['generateContent']}]}}):r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({candidates:[{content:{parts:[{text:'EXPORT_ASSISTANT_MARKER\n\nمرحبا بالعالم\n\n| Value | Count |\n| --- | --- |\n| A | 2 |\n\n```py\nprint(2)\n```'}]},groundingMetadata:{groundingChunks:[{web:{title:'Export source',uri:'https://example.com/source'}}]},finishReason:'STOP'}]})+'\n\n'}));
  await ctx.addInitScript(()=>{
   if(window.top!==window)return;
   if(localStorage.getItem('mr.preview_user'))return;
   const uid='preview-export',settings={autoIntroduced:true,autoTitle:false,enabledModels:['gemini:gemini-flash-latest'],defaultModel:'gemini:gemini-flash-latest'};
   localStorage.setItem('mr.preview_user',JSON.stringify({uid,email:'exports@local.invalid',displayName:'Exports'}));localStorage.setItem(`mr.account.${uid}`,JSON.stringify({geminiKey:'fixture',settings}));localStorage.setItem('mr.settings',JSON.stringify(settings));localStorage.setItem('mr.installHint','1');
  });
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.MR_TEST_URL||'http://localhost:5190/?emulator');await page.waitForSelector('.composer textarea');await page.fill('.composer textarea','EXPORT_USER_MARKER');await page.click('.send-btn');await page.waitForSelector('.msg.assistant .model-tag');
  await page.getByRole('button',{name:'Edit in canvas',exact:true}).click();await page.fill('.canvas-text','CANVAS_EXPORT_MARKER');await page.getByRole('button',{name:'Close canvas',exact:true}).click();
  const open=async()=>{if(width<900)await page.click('.menu-btn');await page.getByRole('button',{name:'Chat options',exact:true}).first().click();await page.getByRole('menuitem',{name:'Export',exact:true}).click();await page.waitForSelector('.chat-export-panel');};
  const download=async(name)=>{const event=page.waitForEvent('download');await page.getByRole('button',{name:new RegExp(name)}).click();const item=await event;const stream=await item.createReadStream();const parts=[];for await(const part of stream)parts.push(part);return {name:item.suggestedFilename(),data:Buffer.concat(parts)};};
  await open();assert.ok(await page.locator('.modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1));assert.ok((await page.locator('.modal').boundingBox()).width<=width);
  const md=await download('Markdown');assert.ok(md.name.endsWith('.md'));const text=md.data.toString();for(const marker of ['EXPORT_USER_MARKER','EXPORT_ASSISTANT_MARKER','CANVAS_EXPORT_MARKER','مرحبا بالعالم','https://example.com/source'])assert.ok(text.includes(marker));
  const word=await download('Word document');assert.ok(word.name.endsWith('.docx'));const zip=await JSZip.loadAsync(word.data);const xml=await zip.file('word/document.xml').async('string');assert.ok(xml.includes('EXPORT_USER_MARKER')&&xml.includes('EXPORT_ASSISTANT_MARKER')&&xml.includes('CANVAS_EXPORT_MARKER')&&xml.includes('مرحبا بالعالم'));assert.ok(xml.includes('<w:tbl>'));assert.ok((await zip.file('word/_rels/document.xml.rels').async('string')).includes('https://example.com/source'));
  await page.getByRole('button',{name:/^PDF/}).click();await page.waitForSelector('.preview-frame');const frame=page.frameLocator('.preview-frame');await frame.locator('.doc').waitFor();const body=await frame.locator('.doc').textContent();assert.ok(body.includes('EXPORT_USER_MARKER')&&body.includes('EXPORT_ASSISTANT_MARKER')&&body.includes('CANVAS_EXPORT_MARKER')&&body.includes('مرحبا بالعالم'));assert.equal(await frame.locator('table').count(),1);assert.equal(await frame.locator('script').count(),0);assert.ok(await page.getByRole('button',{name:'Save PDF',exact:true}).isVisible());
  fs.mkdirSync('tests/e2e/out',{recursive:true});await page.screenshot({path:`tests/e2e/out/chat-export-${width}.png`});await page.getByRole('button',{name:'Close',exact:true}).click();assert.deepEqual(errors,[]);console.log(`PASS ${width}px: whole-chat Markdown/Word, tables, Arabic, sources, Canvas, PDF preview and fit`);await ctx.close();
 }}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
