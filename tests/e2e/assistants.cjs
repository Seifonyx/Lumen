const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch();
 try { for(const width of [1280,390,320]) {
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<900,hasTouch:width<900});
  let calls=[];
  await context.route('**/firestore.googleapis.com/**',r=>r.abort());
  await context.route('**/generativelanguage.googleapis.com/**',r=>{
   if(r.request().url().includes('/models?')) return r.fulfill({json:{models:[{name:'models/gemini-flash-latest',displayName:'Flash',supportedGenerationMethods:['generateContent']}]}});
   calls.push(r.request().postDataJSON());
   return r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({candidates:[{content:{parts:[{text:'Helper answered.'}]},finishReason:'STOP'}]})+'\n\n'});
  });
  await context.addInitScript(()=>{
   if(localStorage.getItem('mr.preview_user'))return;
   const uid='preview-assistants';const settings={autoIntroduced:true,autoTitle:false,enabledModels:['gemini:gemini-flash-latest'],defaultModel:'gemini:gemini-flash-latest'};
   localStorage.setItem('mr.preview_user',JSON.stringify({uid,email:'helpers@local.invalid',displayName:'Helpers'}));
   localStorage.setItem(`mr.account.${uid}`,JSON.stringify({geminiKey:'fixture',settings}));
   localStorage.setItem('mr.settings',JSON.stringify(settings));localStorage.setItem('mr.installHint','1');
  });
  const page=await context.newPage();
  await page.goto(process.env.MR_TEST_URL||'http://localhost:5190/?emulator');
  await page.waitForSelector('.composer textarea');
  const open=async()=>{if(width<900)await page.click('.menu-btn');await page.getByRole('button',{name:'Customize',exact:true}).click();await page.waitForSelector('.assistant-library');};
  await open();await page.getByRole('button',{name:'New assistant',exact:true}).click();
  await page.getByLabel('Library item name').fill('Quality helper');
  await page.getByLabel('Library instructions').fill('Always use QUALITY_MARKER in your answer.');
  await page.getByLabel('Assistant model').selectOption('gemini:gemini-flash-latest');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  const card=page.locator('.library-card').filter({has:page.getByRole('heading',{name:'Quality helper',exact:true})});
  await card.getByRole('button',{name:'Start chat',exact:true}).click();
  await page.waitForSelector('.assistant-badge');assert.equal(calls.length,0);
  await page.waitForTimeout(1000);await page.reload();await page.waitForSelector('.assistant-badge');
  assert.equal(await page.locator('.assistant-badge').textContent(),'Quality helper');
  await page.fill('.composer textarea','Hello');await page.click('.send-btn');await page.waitForSelector('.msg.assistant .markdown');
  assert.ok(JSON.stringify(calls[0]).includes('QUALITY_MARKER'));
  await open();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Delete Quality helper',exact:true}).click();
  await page.getByRole('button',{name:'Close',exact:true}).click();
  assert.ok(await page.locator('.assistant-badge').isVisible());
  await page.evaluate(()=>document.querySelector('.sidebar .new-chat').click());assert.equal(await page.locator('.assistant-badge').count(),0);
  await page.fill('.composer textarea','Existing draft');await open();
  await page.getByRole('tab',{name:'Prompts',exact:true}).click();
  await page.getByRole('button',{name:'New prompt',exact:true}).click();
  await page.getByLabel('Library item name').fill('My prompt');await page.getByLabel('Library instructions').fill('PROMPT_MARKER');await page.getByRole('button',{name:'Save',exact:true}).click();
  assert.ok(await page.locator('.assistant-library').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await page.locator('.library-card').filter({has:page.getByRole('heading',{name:'My prompt',exact:true})}).getByRole('button',{name:'Insert prompt',exact:true}).click();
  assert.equal(await page.inputValue('.composer textarea'),'Existing draft\n\nPROMPT_MARKER');assert.equal(calls.length,1);
  await open();await page.getByRole('tab',{name:'Prompts',exact:true}).click();await page.getByRole('button',{name:'Edit My prompt',exact:true}).click();await page.getByLabel('Library instructions').fill('UPDATED_MARKER');await page.getByRole('button',{name:'Save',exact:true}).click();
  await page.getByRole('button',{name:'Close',exact:true}).click();await page.reload();await page.waitForSelector('.composer textarea');await open();await page.getByRole('tab',{name:'Prompts',exact:true}).click();assert.ok((await page.locator('.assistant-library').textContent()).includes('UPDATED_MARKER'));
  require('fs').mkdirSync('tests/e2e/out',{recursive:true});
  await page.screenshot({path:`tests/e2e/out/library-${width}.png`});
  console.log(`PASS ${width}px: helper CRUD, immutable chat instructions, reload, model choice, ordinary chat isolation, prompt append/edit/persistence and fit`);
  await context.close();
 }} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
