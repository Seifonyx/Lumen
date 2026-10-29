// CP2 supplemental states and canceled lazy Settings. Existing synthetic profile; never live accounts/inference.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium,webkit}=require('playwright');
const {profile}=require('./helpers/preview-profile.cjs');
const base=process.env.MR_TEST_URL||'http://localhost:5190/';
const out=process.env.PRISM_STATES_OUT||'tests/e2e/out/prism-providers';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await(process.env.MR_WEBKIT?webkit:chromium).launch();let cases=0;
 try{for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width:320,height:568},hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  await profile(context,`preview-prism-states-${theme}`,theme,{}, {providerConnections:{anthropic:'SYNTHETIC_ONLY',providerAccess:{anthropic:false}}});
  let finishCatalog;const pendingCatalog=new Promise(resolve=>{finishCatalog=resolve});
  await context.route('**/generativelanguage.googleapis.com/**',async r=>{await pendingCatalog;await r.fulfill({json:{models:[]}}).catch(()=>{});});
  const page=await context.newPage();page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
   let releaseSettings,held=false;const heldRequest=new Promise(resolve=>releaseSettings=resolve);
   await page.route('**/SettingsModal-*.js',async r=>{held=true;await heldRequest;await r.continue();});

  try{
   await page.goto(base);await page.locator('.composer textarea').waitFor();
   if(!await page.locator('.app[data-lumen-canvas-shell]').count()){console.log('Not applicable to ordinary presentation');return;}
   const draft='Provider setup draft — café';await page.locator('.composer textarea').fill(draft);
   await page.getByRole('button',{name:'Open chats',exact:true}).first().click();
   await page.locator('aside.cv-nav').getByRole('button',{name:'Router',exact:true}).click();
   const rc=page.locator('.rc-page');await rc.getByRole('navigation',{name:'Router sections'}).getByRole('button',{name:'Providers',exact:true}).click();
   await rc.locator('[data-provider="gemini"]').click();const detail=rc.getByRole('region',{name:'Provider detail'});
   assert.match(await detail.innerText(),/Not checked/);assert.match(await detail.innerText(),/No model list yet/);
   await page.evaluate(()=>document.activeElement?.blur());
   await page.screenshot({path:path.join(out,`320-${theme}-unchecked.png`),animations:'disabled'});
   finishCatalog();await detail.getByText('No compatible models',{exact:true}).waitFor();
   assert.match(await detail.innerText(),/Discovery completed/);
   await page.screenshot({path:path.join(out,`320-${theme}-empty-catalog.png`),animations:'disabled'});
   await page.goBack();
   const search=rc.getByRole('searchbox',{name:'Find a provider'});await search.fill('Groq');await rc.locator('[data-provider="groq"]').click();
   assert.match(await detail.innerText(),/No key saved/);await detail.getByRole('button',{name:'Add a key',exact:true}).waitFor();
   await page.screenshot({path:path.join(out,`320-${theme}-no-key.png`),animations:'disabled'});
   // Hold only the first local lazy editor chunk, cancel the actual history visit, then open general Keys.
   await detail.getByRole('button',{name:'Add a key',exact:true}).click();
   for(let i=0;i<40&&!held;i++)await page.waitForTimeout(25);
   assert(held,'the first Settings lazy load was held');
   await page.goBack();releaseSettings();await detail.waitFor();
   await page.goBack();
   await rc.getByRole('button',{name:'Connect a provider',exact:true}).click();
   const settings=page.getByRole('dialog',{name:'Settings',exact:true});await settings.locator('.provider-connection').first().waitFor();
   assert((await settings.locator('.provider-connection:visible').count())>1,'canceled handoff cannot narrow a later general visit');
   // Jump directly between two existing Keys history entries. The editor must follow the restored target
   // while preserving unsaved credential edits within this account (nothing is saved or sent).
   await page.keyboard.press('Escape'); await settings.waitFor({state:'hidden'});
   await rc.locator('[data-provider="groq"]').click();
   await detail.getByRole('button',{name:'Add a key',exact:true}).click();
   const groq=settings.locator('.provider-connection[data-provider="groq"]');await groq.waitFor();
   const key=groq.locator('input[aria-label="Groq API key"]');await key.fill('SYNTHETIC_UNSAVED');
   assert.equal(await groq.locator('.key-status-pill').innerText(),'Unsaved changes');
   await page.evaluate(()=>history.go(-3));
   await page.waitForFunction(()=>document.querySelectorAll('.settings-page .provider-connection').length>1);
   assert.equal(await key.inputValue(),'SYNTHETIC_UNSAVED');
   await page.evaluate(()=>history.go(3));
   await page.waitForFunction(()=>document.querySelectorAll('.settings-page .provider-connection').length===1);
   assert.equal(await groq.isVisible(),true);assert.equal(await key.inputValue(),'SYNTHETIC_UNSAVED');
   await page.goBack();await rc.waitFor();
   assert.equal(await page.locator('.composer textarea').inputValue(),draft);
   assert.deepEqual(errors,[]);cases++;
  }finally{finishCatalog();releaseSettings();await context.close();}
 }}finally{await browser.close();}
 console.log(`PASS Prism unchecked/empty/no-key and canceled-lazy-settings ${cases}/2`);
})().catch(e=>{console.error(e);process.exit(1)});
