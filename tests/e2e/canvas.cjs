const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch();
 try {for(const width of [1280,1024,390,320]){
  const ctx=await browser.newContext({viewport:{width,height:844},isMobile:width<900,hasTouch:width<900,acceptDownloads:true});
  const calls=[];let failEdit=false;
  await ctx.route('**/firestore.googleapis.com/**',r=>r.abort());
  await ctx.route('**/generativelanguage.googleapis.com/**',r=>{
   if(r.request().url().includes('/models?'))return r.fulfill({json:{models:[{name:'models/gemini-flash-latest',displayName:'Flash',supportedGenerationMethods:['generateContent']}]}});
   const body=r.request().postDataJSON();calls.push(body);
   const text=body.contents?.at(-1)?.parts?.map(x=>x.text||'').join('')||'';
   if(failEdit)return r.fulfill({status:503,json:{error:{message:'Temporary fixture outage'}}});
   const reply=text.includes('Edit the selected section') ? (text.includes('[PHONE_1]')?'Call [PHONE_1].':'Short sentence.') : 'A very long sentence that needs to be shortened.\n\nKeep this paragraph.';
   return r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({candidates:[{content:{parts:[{text:reply}]},finishReason:'STOP'}]})+'\n\n'});
  });
  await ctx.addInitScript(()=>{
   if(localStorage.getItem('mr.preview_user'))return;
   const uid='preview-canvas';const settings={autoIntroduced:true,autoTitle:false,privacyShield:true,privacyMode:'ask',privacyRestore:true,enabledModels:['gemini:gemini-flash-latest'],defaultModel:'gemini:gemini-flash-latest'};
   localStorage.setItem('mr.preview_user',JSON.stringify({uid,email:'canvas@local.invalid',displayName:'Canvas'}));localStorage.setItem(`mr.account.${uid}`,JSON.stringify({geminiKey:'fixture',settings}));localStorage.setItem('mr.settings',JSON.stringify(settings));localStorage.setItem('mr.installHint','1');
  });
  const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.MR_TEST_URL||'http://localhost:5190/?emulator');await page.waitForSelector('.composer textarea');
  await page.fill('.composer textarea','Draft an article');await page.click('.send-btn');await page.waitForSelector('.msg.assistant .model-tag');
  await page.getByRole('button',{name:'Edit in canvas',exact:true}).click();await page.waitForSelector('.canvas-text');
  const original=await page.inputValue('.canvas-text');
  const selectRange=async(start,end)=>{await page.locator('.canvas-text').evaluate((el,{start,end})=>{el.focus();el.setSelectionRange(start,end);document.dispatchEvent(new Event('selectionchange'));},{start,end});};
  const request=async()=>{await page.getByLabel('Canvas edit instruction').fill('Shorten');await page.getByRole('button',{name:'Suggest',exact:true}).click();await page.waitForSelector('.canvas-review');};
  await selectRange(0,original.indexOf('\n'));await request();assert.equal(await page.inputValue('.canvas-text'),original);
  require('fs').mkdirSync('tests/e2e/out',{recursive:true});await page.screenshot({path:`tests/e2e/out/canvas-review-${width}.png`});
  await page.getByRole('button',{name:'Accept edit',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.canvas-text').value.startsWith('Short sentence.'));
  assert.equal(await page.inputValue('.canvas-text'),'Short sentence.\n\nKeep this paragraph.');
  assert.ok(JSON.stringify(calls.at(-1)).includes('Keep this paragraph'));
  await page.getByRole('button',{name:'Undo canvas edit',exact:true}).click();assert.equal(await page.inputValue('.canvas-text'),original);
  await page.getByRole('button',{name:'Select all',exact:true}).click();await request();await page.getByRole('button',{name:'Reject',exact:true}).click();assert.equal(await page.inputValue('.canvas-text'),original);
  await page.getByRole('button',{name:'Select all',exact:true}).click();await request();await page.fill('.canvas-text',original+'\nManual change');assert.ok(await page.getByRole('button',{name:'Accept edit',exact:true}).isDisabled());await page.getByRole('button',{name:'Reject',exact:true}).click();
  await page.fill('.canvas-text','Call 01011112222 tomorrow.');await page.getByRole('button',{name:'Select all',exact:true}).click();await page.getByLabel('Canvas edit instruction').fill('Shorten');await page.getByRole('button',{name:'Suggest',exact:true}).click();await page.waitForSelector('.privacy-check');
  const before=calls.length;await page.getByRole('button',{name:'Mask and send',exact:true}).click();await page.waitForSelector('.canvas-review');assert.equal(calls.length,before+1);assert.ok(!JSON.stringify(calls.at(-1)).includes('01011112222'));await page.getByRole('button',{name:'Accept edit',exact:true}).click();assert.equal(await page.inputValue('.canvas-text'),'Call 01011112222.');
  failEdit=true;await page.getByRole('button',{name:'Select all',exact:true}).click();await page.getByLabel('Canvas edit instruction').fill('Shorten');await page.getByRole('button',{name:'Suggest',exact:true}).click();await page.getByRole('button',{name:'Mask and send',exact:true}).click();await page.waitForSelector('.canvas-error');assert.equal(await page.locator('.canvas-review').count(),0);assert.equal(await page.inputValue('.canvas-text'),'Call 01011112222.');failEdit=false;
  assert.ok(await page.locator('.canvas-panel').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download canvas document',exact:true}).click();assert.ok((await downloadPromise).suggestedFilename().endsWith('.md'));
  await page.getByRole('button',{name:'Close canvas',exact:true}).click();await page.reload();await page.waitForSelector('.composer textarea');if(width<900)await page.click('.menu-btn');await page.locator('.chat-row .chat-open').first().click();await page.getByRole('button',{name:'Open canvas',exact:true}).click();assert.equal(await page.inputValue('.canvas-text'),'Call 01011112222.');
  await ctx.setOffline(true);await page.fill('.canvas-text','Offline draft');await page.getByRole('button',{name:'Close canvas',exact:true}).click();await ctx.setOffline(false);await page.getByRole('button',{name:'Open canvas',exact:true}).click();assert.equal(await page.inputValue('.canvas-text'),'Offline draft');
  await page.locator('.canvas-panel input[type=file]').setInputFiles({name:'code.py',mimeType:'text/x-python',buffer:Buffer.from('print(1 + 1)')});await page.waitForFunction(()=>document.querySelector('.canvas-text').value==='print(1 + 1)');assert.ok(await page.locator('.canvas-text').evaluate(el=>el.classList.contains('code')));
  await page.getByRole('button',{name:'Preview',exact:true}).click();assert.ok((await page.locator('.canvas-preview').textContent()).includes('print(1 + 1)'));
  if(width<900){assert.ok(await page.locator('.main').evaluate(el=>el.inert));await page.setViewportSize({width,height:440});assert.ok(await page.locator('.canvas-panel').evaluate(el=>el.scrollWidth<=el.clientWidth+1));await page.setViewportSize({width,height:844});
   await page.evaluate(()=>{document.documentElement.classList.add('kb-open');document.documentElement.style.setProperty('--vv-h','400px');document.documentElement.style.setProperty('--vv-top','0px');});
   assert.ok((await page.locator('.canvas-panel').boundingBox()).height<=401);
   assert.ok((await page.getByRole('button',{name:'Suggest',exact:true}).boundingBox()).y<400);
   await page.evaluate(()=>{document.documentElement.classList.remove('kb-open');document.documentElement.style.removeProperty('--vv-h');document.documentElement.style.removeProperty('--vv-top');});
  }
  require('fs').mkdirSync('tests/e2e/out',{recursive:true});await page.screenshot({path:`tests/e2e/out/canvas-${width}.png`});
  assert.deepEqual(errors,[]);console.log(`PASS ${width}px: range editing, accept/reject/undo, stale refusal, privacy, failure preservation, download, reload, offline editing, code import/preview and phone fit`);await ctx.close();
 }}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
