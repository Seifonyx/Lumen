// Synthetic fixture for the models/routing hub checkpoint; external traffic is blocked.
// Gemini is saved and listing; Groq has a key saved with no list yet; everything else is unconnected.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require('playwright');const AxeBuilder=require('@axe-core/playwright').default;
const {profile}=require('./helpers/preview-profile.cjs');
const base=process.env.MR_TEST_URL||'http://localhost:5190',before=process.env.HUB_BEFORE==='1',engine=process.env.MR_WEBKIT?'webkit':'chromium';
const out=process.env.HUB_OUT||`tests/e2e/out/switchboard/${before?'before':'after'}/${engine}`;
const heights={320:568,390:844,430:932,1440:960};
const views=(process.env.HUB_VIEWS||'390:light,1440:dark,1440:light').split(',').map(v=>{const [w,t]=v.split(':');return [Number(w),t]});
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await(process.env.MR_WEBKIT?webkit:chromium).launch();try{
for(const [width,theme] of views){
 const ctx=await browser.newContext({viewport:{width,height:heights[width]||900},hasTouch:width<900,reducedMotion:'reduce',colorScheme:theme});
 await ctx.addInitScript(()=>{if(window.top===window&&'serviceWorker'in navigator)navigator.serviceWorker.register=()=>Promise.reject(new Error('Disabled for synthetic QA'))});
 await ctx.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
 await profile(ctx,'preview-switchboard-slice',theme,{},{groqKey:'gsk_synthetic_fixture_key'});
 const page=await ctx.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.goto(base);await page.locator('.composer textarea').waitFor();
 if(!await page.locator('[data-lumen-canvas-shell]').count()){console.log('SKIP hub fixture: not the Canvas presentation');await ctx.close();continue;}
 await page.locator('.composer textarea').fill('Retain my working draft');
 if(width<900)await page.locator('.menu-btn:visible').first().click();
 await page.locator('[data-routing-center]:visible').first().click();
 const hub=page.locator('.rc-page:visible');await hub.waitFor();await page.waitForTimeout(500);
 await page.screenshot({path:path.join(out,`${width}-${theme}-landing.png`),animations:'disabled'});
 await hub.getByRole('button',{name:'Providers',exact:true}).first().click();await page.waitForTimeout(500);
 await page.screenshot({path:path.join(out,`${width}-${theme}-providers.png`),animations:'disabled'});
 const full=await page.evaluate(()=>{const s=document.querySelector('.rc-page:not([hidden]) .rc-scroll');return s?s.scrollHeight:0});
 if(full>(heights[width]||900)){await page.setViewportSize({width,height:Math.min(full+160,4200)});await page.waitForTimeout(300);await page.screenshot({path:path.join(out,`${width}-${theme}-providers-full.png`),animations:'disabled'});await page.setViewportSize({width,height:heights[width]||900});await page.waitForTimeout(200);}
 if(!before){
  const axe=await new AxeBuilder({page}).include('.rc-page:not([hidden])').withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  assert.deepEqual(axe.violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target).join(' ')}`),[],'hub has no WCAG A/AA violations');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow');
  if(width<900){const small=await hub.locator('button:visible').evaluateAll(b=>b.map(e=>[e.getAttribute('aria-label')||e.textContent.trim(),Math.round(e.getBoundingClientRect().height)]).filter(([,h])=>h<44));assert.deepEqual(small,[],'phone targets are at least 44px');}
  // A tile opens that provider; Back returns to the grid.
  await hub.getByRole('button',{name:'Groq',exact:true}).first().click();await page.getByRole('heading',{name:'Groq',exact:true}).first().waitFor();await page.getByText('Loading models…').waitFor({state:'detached'}).catch(()=>{});await page.waitForTimeout(400);
  await page.screenshot({path:path.join(out,`${width}-${theme}-provider-detail.png`),animations:'disabled'});
  await page.goBack();await hub.getByRole('button',{name:'Google AI Studio',exact:true}).first().waitFor();
 }
 assert.deepEqual(errors,[],'no page errors');console.log(`PASS hub ${before?'before':'after'} ${engine} ${width} ${theme}`);
 await ctx.close();
}}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
