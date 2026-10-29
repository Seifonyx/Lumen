// Shared synthetic fixture for Tools baseline/implemented screenshots; external traffic is blocked.
// Readiness is deliberately mixed: a Gemini key is saved, no Cloudflare key, and one custom assistant exists.
// After the redesign it also checks behaviour and captures the review states (area filter, no match, no keys,
// a dense assistant list and assistant editing) at 390 and 1440.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require('playwright');const AxeBuilder=require('@axe-core/playwright').default;
const {profile}=require('./helpers/preview-profile.cjs');
const {execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');
const sourceSha=process.env.TOOLS_SOURCE_SHA||process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const base=process.env.MR_TEST_URL||'http://localhost:5190',before=process.env.TOOLS_BEFORE==='1',engine=process.env.MR_WEBKIT?'webkit':'chromium';
const out=process.env.TOOLS_OUT||`tests/e2e/out/tools/${before?'before':'after'}/${engine}`;
const assistants=[{id:'fixture-brief',name:'Weekly brief',description:'Turns meeting notes into a one-page brief with owners and dates.',instructions:'Summarize synthetic notes.',model:'auto'}];
const dense=[...assistants,...['Contract reader','Release notes','Interview prep','Grant reviewer','Recipe scaler','Travel planner','SQL explainer','Lesson planner','Press summary','Bug triage','Tone checker'].map((name,i)=>({id:`fixture-dense-${i}`,name,description:`A synthetic ${name.toLowerCase()} assistant for density review.`,instructions:'Synthetic.',model:'auto'}))];
const heights={320:568,390:844,430:932,1440:960};
const fixtureSha=createHash('sha256').update(JSON.stringify({assistants,dense})).digest('hex');
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await(process.env.MR_WEBKIT?webkit:chromium).launch();const results=[];try{
const open=async({width,theme,extra={assistants},keys={}})=>{
 const ctx=await browser.newContext({viewport:{width,height:heights[width]||900},hasTouch:width<900,reducedMotion:'reduce',colorScheme:theme});
 await ctx.addInitScript(()=>{if(window.top===window&&'serviceWorker'in navigator)navigator.serviceWorker.register=()=>Promise.reject(new Error('Disabled for synthetic QA'))});
 await ctx.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
 await profile(ctx,'preview-tools-slice',theme,extra,keys);
 const page=await ctx.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.goto(base);await page.locator('.composer textarea').waitFor({state:'attached'});await page.waitForTimeout(300);
 // Without a usable model the home screen offers provider setup instead of the message box.
 if(await page.locator('.composer textarea').isVisible())await page.locator('.composer textarea').fill('Retain my working draft');
 if(await page.locator('.composer textarea').isVisible()){
  if(width<900)await page.locator('.menu-btn:visible').first().click();
  await page.locator('aside.cv-nav').getByRole('button',{name:'Tools',exact:true}).click();
 }else await page.evaluate(()=>window.dispatchEvent(new CustomEvent('mr:library',{detail:'tools-page'})));
 const hub=page.locator('.hub-page:visible');await hub.waitFor();
 await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>document.activeElement?.blur());
 return {ctx,page,hub,errors};
};
const shot=async(page,name)=>{await page.evaluate(()=>document.activeElement?.blur());await page.screenshot({path:path.join(out,name),animations:'disabled'});};
// The redesign is Canvas-only; the ordinary in-app run (every suite in this folder) has nothing to check here.
{const ctx=await browser.newContext();await ctx.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());await profile(ctx,'preview-tools-slice','light');const page=await ctx.newPage();await page.goto(base);await page.locator('.composer textarea').waitFor({state:'attached'});const canvas=await page.locator('[data-lumen-canvas-shell]').count();await ctx.close();if(!canvas){console.log('SKIP Tools fixture: not the Canvas presentation');return;}}
for(const width of (process.env.TOOLS_WIDTHS||'320,390,430,1440').split(',').map(Number))for(const theme of (process.env.TOOLS_THEMES||'light,dark').split(',')){
 const {ctx,page,hub,errors}=await open({width,theme});
 await shot(page,`${width}-${theme}-tools.png`);
 if(!before){
  const audit=await new AxeBuilder({page}).include('.hub-page').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
  for(const sel of ['.hub-scroll','.tx'])assert(await hub.locator(sel).evaluate(el=>el.scrollWidth<=el.clientWidth+1),`no horizontal overflow in ${sel}`);
  if(width<900)for(const box of await page.locator('.tx-hit:is(button), .tx-side, .tx-areas button, .tx-setup').evaluateAll(els=>els.map(e=>e.getBoundingClientRect()).filter(r=>r.width).map(r=>({w:r.width,h:r.height}))))assert(box.h>=36&&box.w>=36,`phone targets stay large enough: ${JSON.stringify(box)}`);
  // Readiness is stated in text, not colour alone, and only the missing key offers setup.
  assert.match(await page.getByRole('region',{name:'Tool readiness'}).innerText(),/Gemini key[\s\S]*Ready · powers 5 tools[\s\S]*Cloudflare key[\s\S]*Not set up · needed for Create an image/);
  assert.equal(await page.getByRole('button',{name:'Create an image',exact:true}).getAttribute('aria-describedby').then(ids=>page.evaluate(ids=>ids.split(' ').map(id=>document.getElementById(id)?.textContent).join(' '),ids)).then(t=>/Needs Cloudflare key/.test(t)),true);
  assert.equal(await page.getByRole('button',{name:'Writing tools'}).count(),0,'contextual tools do not pretend to open');
  // Area filter, then search inside it with a scoped empty state.
  await page.getByRole('group',{name:'Tool areas'}).getByRole('button',{name:/^Create/}).click();
  assert.equal(await page.getByRole('heading',{name:'Research',exact:true}).count(),0);await page.getByRole('heading',{name:'Create',exact:true}).waitFor();
  if(width===390||width===1440)await shot(page,`${width}-${theme}-area.png`);
  await page.getByRole('searchbox',{name:'Search tools',exact:true}).fill('quarterly forecast');await page.getByRole('status').filter({hasText:'No tools match'}).waitFor();
  if(width===390||width===1440)await shot(page,`${width}-${theme}-empty.png`);
  await page.getByRole('button',{name:'Search all areas',exact:true}).click();await page.getByRole('button',{name:'Clear search',exact:true}).click();
  assert.equal(await page.getByRole('searchbox',{name:'Search tools',exact:true}).inputValue(),'');
  // Assistant editing returns to Tools, keeping the area.
  await page.getByRole('group',{name:'Tool areas'}).getByRole('button',{name:/^Assistants/}).click();
  await page.getByRole('button',{name:'Edit Weekly brief',exact:true}).click();await page.getByRole('textbox',{name:'Library item name'}).waitFor();
  if(width===390||width===1440)await shot(page,`${width}-${theme}-editing.png`);
  await page.goBack();await page.getByRole('heading',{name:'Assistants',exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Research',exact:true}).count(),0,'Back restores the chosen area');
  // A switch, not a launch: toggling keeps you on Tools.
  await page.getByRole('group',{name:'Tool areas'}).getByRole('button',{name:/^All/}).click();
  const sw=page.getByRole('switch',{name:'Web search',exact:true});assert.equal(await sw.getAttribute('aria-checked'),'false');await sw.click();assert.equal(await sw.getAttribute('aria-checked'),'true');await sw.click();await hub.waitFor();
  // Whole-feature Exit keeps the chat draft.
  await (width<900?page.locator('.phone-navigation [aria-label^="Return to "]'):page.locator('.hub-page .feature-exit')).click();await hub.waitFor({state:'detached'});
  assert.equal(await page.locator('.composer textarea').inputValue(),'Retain my working draft');
  await page.emulateMedia({forcedColors:'active'});await page.emulateMedia({forcedColors:'none'});
 }
 assert.deepEqual(errors,[]);await ctx.close();results.push({width,theme,passed:true});console.log('PASS Tools',before?'before':'after',engine,width,theme);
 if(!before&&(width===390||width===1440)){
  const none=await open({width,theme,keys:{geminiKey:''}});
  assert.match(await none.page.getByRole('region',{name:'Tool readiness'}).innerText(),/Gemini key[\s\S]*Not set up · needed for 5 tools/);
  await shot(none.page,`${width}-${theme}-no-keys.png`);assert.deepEqual(none.errors,[]);await none.ctx.close();
  const busy=await open({width,theme,extra:{assistants:dense}});
  await busy.page.getByRole('group',{name:'Tool areas'}).getByRole('button',{name:/^Assistants 16/}).click();
  await shot(busy.page,`${width}-${theme}-dense.png`);assert.deepEqual(busy.errors,[]);await busy.ctx.close();
  console.log('PASS Tools states',engine,width,theme);
 }
}
}finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({sourceSha,fixtureSha256:fixtureSha,engine,before,syntheticOnly:true,physicalIPhone:false,results},null,2))}})().catch(e=>{console.error(e);process.exit(1)});
