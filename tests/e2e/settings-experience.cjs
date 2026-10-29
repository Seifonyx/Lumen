// Synthetic fixture for the Settings index checkpoint; external traffic is blocked.
// A Gemini key is saved, nothing else is connected, and the account is a preview guest.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require('playwright');const AxeBuilder=require('@axe-core/playwright').default;
const {profile}=require('./helpers/preview-profile.cjs');
const base=process.env.MR_TEST_URL||'http://localhost:5190',before=process.env.SETTINGS_BEFORE==='1',engine=process.env.MR_WEBKIT?'webkit':'chromium';
const out=process.env.SETTINGS_OUT||`tests/e2e/out/settings/${before?'before':'after'}/${engine}`;
const heights={320:568,390:844,430:932,1440:960};
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await(process.env.MR_WEBKIT?webkit:chromium).launch();try{
for(const width of (process.env.SETTINGS_WIDTHS||'390').split(',').map(Number))for(const theme of (process.env.SETTINGS_THEMES||'light').split(',')){
 const ctx=await browser.newContext({viewport:{width,height:heights[width]||900},hasTouch:width<900,reducedMotion:'reduce',colorScheme:theme});
 await ctx.addInitScript(()=>{if(window.top===window&&'serviceWorker'in navigator)navigator.serviceWorker.register=()=>Promise.reject(new Error('Disabled for synthetic QA'))});
 await ctx.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
 await profile(ctx,'preview-settings-slice',theme);
 const page=await ctx.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.goto(base);await page.locator('.composer textarea').waitFor();
 if(!await page.locator('[data-lumen-canvas-shell]').count()){console.log('SKIP Settings fixture: not the Canvas presentation');await ctx.close();continue;}
 await page.locator('.composer textarea').fill('Retain my working draft');
 if(width<900)await page.locator('.menu-btn:visible').first().click();
 await page.locator('.cv-account:visible').first().click();
 const settings=page.locator('.settings-page');await settings.waitFor();await page.waitForTimeout(400);
 await page.screenshot({path:path.join(out,`${width}-${theme}-index.png`),animations:'disabled'});
 // The whole scrolled index, for review of what sits below the fold.
 const full=await page.evaluate(()=>{const s=document.querySelector('.settings-scroll');return s?s.scrollHeight:0});
 if(full>0){await page.setViewportSize({width,height:Math.min(full+120,4000)});await page.waitForTimeout(200);await page.screenshot({path:path.join(out,`${width}-${theme}-index-full.png`),animations:'disabled'});await page.setViewportSize({width,height:heights[width]||900});}
 if(!before){
  const axe=await new AxeBuilder({page}).include('.settings-page').withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  assert.deepEqual(axe.violations.map(v=>v.id),[],'Settings index has no WCAG A/AA violations');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow');
  if(width<900){
   for(const [row,heading] of [['API keys','API keys'],['Privacy & data','Privacy & data'],['Fixture','General']]){
    await page.locator('.si').getByRole('button',{name:row,exact:false}).click();await page.locator('.settings-page.has-section').waitFor();assert.equal((await page.locator('.settings-heading h2').textContent()).trim(),heading,`${row} opens ${heading}`);
    await page.goBack();await page.locator('.si').waitFor();await page.locator('.settings-page.has-section').waitFor({state:'detached'});
   }
   await page.locator('.si').getByRole('button',{name:'Memory',exact:false}).click();await page.locator('.settings-page.has-section').waitFor();
   await page.locator('.settings-page .phone-navigation > button').first().click();await page.locator('.settings-page').waitFor({state:'detached'});
   assert.equal(await page.locator('.composer textarea').inputValue(),'Retain my working draft','Exit from a section returns to the chat with its draft');
   if(width<900)await page.locator('.menu-btn:visible').first().click();await page.locator('.cv-account:visible').first().click();await page.locator('.si').waitFor();
   assert.match(await page.locator('.si').getByRole('button',{name:'API keys',exact:true}).getAttribute('aria-describedby').then(id=>page.locator(`[id="${id}"]`).innerText()),/Gemini connected/,'key status is stated in words');
  }
  if(width<900){const small=await page.locator('.settings-page button:visible').evaluateAll(b=>b.map(e=>[e.getAttribute('aria-label')||e.textContent.trim(),e.getBoundingClientRect().height]).filter(([,h])=>h<44));assert.deepEqual(small,[],'phone targets are at least 44px');}
 }
 if(!before&&width<900){await page.locator('.si').getByRole('button',{name:'Router',exact:true}).click();await page.locator('.rc-page:visible').waitFor();assert.equal(await page.locator('.settings-page').count(),0,'Router leaves Settings');}
 assert.deepEqual(errors,[],'no page errors');console.log(`PASS settings ${before?'before':'after'} ${engine} ${width} ${theme}`);
 await ctx.close();
}}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
