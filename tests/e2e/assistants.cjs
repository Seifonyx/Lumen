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
  // Assistants: Tools page → All assistants. Prompts: the message box's + menu → Saved prompts.
  const open=async()=>{if(width<900)await page.click('.menu-btn');await page.getByRole('button',{name:'Tools',exact:true}).click();if(!await page.locator('.app[data-lumen-canvas-shell]').count())await page.getByRole('button',{name:'All assistants',exact:true}).click();await page.locator(await page.locator('.app[data-lumen-canvas-shell]').count()?'#tools-assistants':'.assistant-library').waitFor();};
  const prompts=async()=>{await page.getByRole('button',{name:/^Add (?:photos, )?files or a repository$/}).click();await page.getByRole('button',{name:'Saved prompts',exact:true}).click();await page.waitForSelector('.prompts-modal');};
  await open();await page.getByRole('button',{name:'New assistant',exact:true}).click();
  await page.getByLabel('Library item name').fill('Quality helper');
  await page.getByLabel('Library instructions').fill('Always use QUALITY_MARKER in your answer.');
  await page.getByLabel('Assistant model').selectOption('gemini:gemini-flash-latest');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  assert.ok(await page.locator('.hub-page').evaluate(el=>el.scrollWidth<=el.clientWidth+1));assert.ok(await page.locator('.assistant-library, .tools-sections').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  const canvas=Boolean(await page.locator('.app[data-lumen-canvas-shell]').count());
  const card=page.locator(canvas?'.tool-card-wrap':'article.lib-card').filter({has:page.locator('strong',{hasText:/^Quality helper$/})});
  if(canvas)await card.locator('.tool-card').click();else await card.getByRole('button',{name:'Start a chat with Quality helper',exact:true}).click();
  await page.waitForSelector('.assistant-badge');assert.equal(calls.length,0);
  await page.waitForTimeout(1000);await page.reload();await page.waitForSelector('.assistant-badge');
  assert.equal(await page.locator('.assistant-badge').textContent(),'Quality helper');
  await page.fill('.composer textarea','Hello');await page.click('.send-btn');await page.waitForSelector('.msg.assistant .markdown');
  assert.ok(JSON.stringify(calls[0]).includes('QUALITY_MARKER'));
  await open();if(canvas){await page.getByRole('button',{name:'Edit Quality helper',exact:true}).click();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Delete',exact:true}).click();}else{page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Delete Quality helper',exact:true}).click();}
  await card.waitFor({state:'detached'});
  await page.locator('.hub-page [aria-label="Close"], .hub-page .phone-navigation [aria-label^="Return to "]').click();await page.locator('.hub-page').waitFor({state:'detached'});
  assert.ok(await page.locator('.assistant-badge').isVisible());
  await page.evaluate(()=>(document.querySelector('.sidebar .new-chat, .cv-new-pill')||[...document.querySelectorAll('.cv-dest button')].find(b=>b.textContent.includes('New chat'))).click());assert.equal(await page.locator('.assistant-badge').count(),0);
  await page.fill('.composer textarea','Existing draft');await prompts();
  await page.getByRole('button',{name:'New',exact:true}).click();
  await page.getByLabel('Library item name').fill('My prompt');await page.getByLabel('Library instructions').fill('PROMPT_MARKER');await page.getByRole('button',{name:'Save',exact:true}).click();
  assert.ok(await page.locator('.prompts-modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1));assert.ok(await page.locator('.modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await page.locator('li.lib-row').filter({has:page.locator('strong',{hasText:/^My prompt$/})}).getByRole('button',{name:'Use My prompt',exact:true}).click();
  assert.equal(await page.locator('.prompts-modal').count(),0);
  assert.equal(await page.inputValue('.composer textarea'),'Existing draft\n\nPROMPT_MARKER');assert.equal(calls.length,1);
  await prompts();await page.getByRole('button',{name:'Edit My prompt',exact:true}).click();await page.getByLabel('Library instructions').fill('UPDATED_MARKER');await page.getByRole('button',{name:'Save',exact:true}).click();
  await page.locator('.modal [aria-label="Close"]').click();await page.reload();await page.waitForSelector('.composer textarea');await prompts();assert.ok((await page.locator('.prompts-modal').textContent()).includes('UPDATED_MARKER'));
  require('fs').mkdirSync('tests/e2e/out',{recursive:true});
  await page.screenshot({path:`tests/e2e/out/library-${width}.png`});
  console.log(`PASS ${width}px: helper CRUD, immutable chat instructions, reload, model choice, ordinary chat isolation, prompt append/edit/persistence and fit`);
  await context.close();
 }} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
