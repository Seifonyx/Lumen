// Shared synthetic fixture for baseline/implemented screenshots; external traffic is blocked.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require('playwright');const AxeBuilder=require('@axe-core/playwright').default;
const {profile,seed}=require('./helpers/preview-profile.cjs');
const base=process.env.MR_TEST_URL||'http://localhost:5190',before=process.env.LIBRARY_BEFORE==='1',engine=process.env.MR_WEBKIT?'webkit':'chromium';
const out=process.env.LIBRARY_OUT||`tests/e2e/out/library/${before?'before':'after'}/${engine}`;
const image='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG34AAAAASUVORK5CYII=';
const now=1793000000000;
const fixture=[{id:'workspace',title:'Autumn research',createdAt:now,updatedAt:now,messages:[{id:'upload',role:'user',text:'Synthetic files for design review',createdAt:now-1000,files:[{id:'photo',name:'Courtyard study.png',kind:'image',mime:'image/png',size:68,data:image},{id:'budget',name:'Research budget.csv',kind:'text',mime:'text/csv',size:128,text:'Category,Amount\nResearch,10'},{id:'away',name:'Field notes.docx',kind:'text',mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',size:2048}]}],documents:[{id:'plan',name:'A quieter workspace.md',content:'# A quieter workspace\n\nA synthetic plan for careful reading and useful research.',updatedAt:now-500},{id:'notes',name:'Working notes.md',content:'# Working notes\n\nKeep sources close to the conversation.',updatedAt:now-2000}]}];
fixture[0].messages.push({id:'export',role:'assistant',status:'done',createdAt:now-750,text:'```file:Research brief.md\n# Research brief\n\nA generated file from a saved reply.\n```'});
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await(process.env.MR_WEBKIT?webkit:chromium).launch();const results=[];try{
for(const width of (process.env.LIBRARY_WIDTHS||'320,390,430,1440').split(',').map(Number))for(const theme of ['light','dark']){
 // Playwright 1.56's built-in SW blocker throws inside sandboxed srcdoc previews
 // (reproduced on a static iframe). Disable registration in top documents instead;
 // every context is fresh and all non-loopback requests remain blocked.
 const ctx=await browser.newContext({viewport:{width,height:width===320?568:width===1440?960:width===430?932:844},hasTouch:width<900,reducedMotion:'reduce',colorScheme:theme});
 await ctx.addInitScript(()=>{if(window.top===window&&'serviceWorker'in navigator)navigator.serviceWorker.register=()=>Promise.reject(new Error('Disabled for synthetic QA'))});
 await ctx.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());await profile(ctx,'preview-library-slice',theme);
 const page=await ctx.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.stack));await page.goto(base);await page.locator('.composer textarea').waitFor();if(!await page.locator('[data-lumen-canvas-shell]').count()){await ctx.close();continue;}
 await seed(page,'preview-library-slice',fixture);await page.reload();await page.locator('.composer textarea').waitFor();if(width<900)await page.locator('.menu-btn:visible').first().click();await page.locator('aside.cv-nav').getByRole('button',{name:'Library',exact:true}).click();await page.getByRole('button',{name:'Open A quieter workspace.md',exact:true}).waitFor();
 await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>document.activeElement?.blur());await page.screenshot({path:path.join(out,`${width}-${theme}-library.png`),animations:'disabled'});
 if(!before){
  const hub=page.locator('.hub-page:visible');assert.match(await hub.innerText(),/6 chat items/);await page.getByRole('combobox',{name:'Sort library',exact:true}).selectOption('name');
  await page.getByRole('searchbox',{name:'Search your library',exact:true}).fill('no such file');await page.getByRole('heading',{name:'No matching items',exact:true}).waitFor();await page.getByRole('button',{name:'Clear library search',exact:true}).click();
  await page.getByRole('button',{name:'Open Field notes.docx',exact:true}).click();await page.getByRole('dialog',{name:'Field notes.docx',exact:true}).waitFor();assert.match(await page.getByRole('dialog').innerText(),/Original unavailable on this device/);await page.getByRole('button',{name:'Download original',exact:true}).click();await page.getByRole('alert').filter({hasText:'original is unavailable'}).waitFor();await page.screenshot({path:path.join(out,`${width}-${theme}-unavailable.png`),animations:'disabled'});await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Open Research brief.md',exact:true}).click();await page.getByRole('button',{name:'Preview Research brief.md',exact:true}).click();await page.getByTitle('Document preview', {exact:true}).waitFor();await page.goBack();await page.getByTitle('Document preview', {exact:true}).waitFor({state:'detached'});await page.getByRole('dialog',{name:'Research brief.md',exact:true}).waitFor();await page.goForward();await page.getByTitle('Document preview', {exact:true}).waitFor();await page.getByRole('dialog').last().getByRole('button',{name:'Return to chat',exact:true}).click();await hub.waitFor({state:'detached'});
  await page.goForward();await hub.waitFor();await page.goForward();await page.getByRole('dialog',{name:'Research brief.md',exact:true}).waitFor();await page.goForward();await page.getByTitle('Document preview',{exact:true}).waitFor();await page.getByRole('dialog').last().getByRole('button',{name:'Return to chat',exact:true}).click();await hub.waitFor({state:'detached'});
  if(width<900)await page.locator('.menu-btn:visible').first().click();await page.locator('aside.cv-nav').getByRole('button',{name:'Library',exact:true}).click();await page.getByRole('button',{name:'Open Research brief.md',exact:true}).waitFor();
  const audit=await new AxeBuilder({page}).include('.hub-page').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
  assert(await hub.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'no horizontal page clipping');
  const nav=page.getByRole('tablist',{name:'Library content types'});await nav.getByRole('tab',{name:'Knowledge',exact:true}).click();await page.getByText('Your references, in one place',{exact:true}).waitFor();assert.match(await hub.innerText(),/only on this device/);await page.screenshot({path:path.join(out,`${width}-${theme}-knowledge.png`),animations:'disabled'});
  await page.emulateMedia({forcedColors:'active'});assert(await page.getByRole('button',{name:'Return to chat',exact:true}).isVisible());await page.emulateMedia({forcedColors:'none'});assert.deepEqual(errors,[]);
 }
 results.push({width,theme,passed:true});await ctx.close();console.log('PASS Library',before?'before':'after',engine,width,theme);
}
}finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({engine,before,syntheticOnly:true,physicalIPhone:false,results},null,2))}})().catch(e=>{console.error(e);process.exit(1)});
