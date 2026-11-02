// Before/after captures for the Library + tools-in-the-composer redesign. Synthetic data only; every request that
// leaves the preview origin is blocked. Usage: MR_TEST_URL=http://localhost:5196 SHOTS_OUT=dir node this-file
// Optional: SHOTS_WIDTHS=320,390 SHOTS_THEMES=light SHOTS_ENGINE=webkit
const fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require('playwright');
const {profile,seed}=require('./preview-profile.cjs');
const base=process.env.MR_TEST_URL||'http://localhost:5190',out=process.env.SHOTS_OUT||'tests/e2e/out/redesign';
const image='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG34AAAAASUVORK5CYII=';
const picture=fs.readFileSync(path.join(__dirname,'picture.b64'),'utf8').trim();
const now=Date.now(),day=86400000;
const projects=[{id:'p-field',name:'Field study',instructions:'',createdAt:now-9*day,updatedAt:now-9*day}];
const assistants=[{id:'fixture-brief',name:'Weekly brief',description:'Turns meeting notes into a one-page brief with owners and dates.',instructions:'Synthetic.',model:'auto'}];
exports.fixture=[
 {id:'lib-a',title:'Autumn research',createdAt:now-2*day,updatedAt:now-2*day,messages:[
  {id:'u1',role:'user',text:'Synthetic files for design review',createdAt:now-2*day,files:[
   {id:'photo',name:'Courtyard study.png',kind:'image',mime:'image/png',size:1178,data:picture},
   {id:'budget',name:'Research budget.csv',kind:'text',mime:'text/csv',size:128,text:'Category,Amount\nResearch,10'},
   {id:'away',name:'Field notes.docx',kind:'text',mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',size:20480},
   {id:'thumb',name:'Whiteboard after the workshop.jpg',kind:'image',mime:'image/jpeg',size:482113,thumb:`data:image/png;base64,${picture}`}]},
  {id:'a1',role:'assistant',status:'done',createdAt:now-2*day+1000,text:'```file:Research brief.md\n# Research brief\n\nA generated file from a saved reply.\n```'}],
  documents:[{id:'plan',name:'A quieter workspace.md',content:'# A quieter workspace\n\nA synthetic plan.',updatedAt:now-3600000},{id:'notes',name:'Working notes.md',content:'# Working notes',updatedAt:now-5*day}]},
 {id:'lib-b',title:'Quarterly planning for the regional reading programme and its volunteers',projectId:'p-field',createdAt:now-7*day,updatedAt:now-7*day,messages:[
  {id:'u2',role:'user',text:'Read these',createdAt:now-7*day,files:[
   {id:'long',name:'Reading-programme-volunteer-handbook-final-revised-v3-with-appendices-and-contact-sheets.pdf',kind:'pdf',mime:'application/pdf',size:3481221,stored:true},
   {id:'rtl',name:'تقرير الميزانية السنوي.txt',kind:'text',mime:'text/plain',size:5120,text:'نص تجريبي'}]},
  {id:'a2',role:'assistant',status:'done',createdAt:now-7*day+1000,text:'Here is a cover image.',files:[{id:'gen',name:'Cover illustration.png',kind:'image',mime:'image/png',size:1178,data:picture}]}]},
];
const sizes={320:568,390:844,430:932,1280:800,1440:960};
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const engine=process.env.SHOTS_ENGINE==='webkit'?webkit:chromium,browser=await engine.launch();
 const widths=(process.env.SHOTS_WIDTHS||'320,390,430,1280,1440').split(',').map(Number),themes=(process.env.SHOTS_THEMES||'light,dark').split(',');
 const only=process.env.SHOTS_ONLY?process.env.SHOTS_ONLY.split(','):null,want=n=>!only||only.includes(n);
 try{for(const width of widths)for(const theme of themes){
  const phone=width<900;
  const open=async({chats=exports.fixture,keys={}}={})=>{
   const ctx=await browser.newContext({viewport:{width,height:sizes[width]||900},hasTouch:phone,isMobile:false,reducedMotion:'reduce',colorScheme:theme});
   await ctx.addInitScript(()=>{if(window.top===window&&'serviceWorker'in navigator)navigator.serviceWorker.register=()=>Promise.reject(new Error('Disabled for synthetic QA'))});
   await ctx.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
   await profile(ctx,'preview-redesign',theme,{projects,assistants},keys);
   const page=await ctx.newPage();page.setDefaultTimeout(10000);
   await page.goto(base);await page.locator('.composer textarea').waitFor({state:'attached'});
   if(chats.length){await seed(page,'preview-redesign',chats);await page.reload();await page.locator('.composer textarea').waitFor({state:'attached'});}
   await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(300);
   return {ctx,page};
  };
  const shot=async(page,name)=>{await page.waitForTimeout(250);await page.screenshot({path:path.join(out,`${width}-${theme}-${name}.png`),animations:'disabled'});};
  const library=async(page,kind)=>{await page.evaluate(k=>window.dispatchEvent(new CustomEvent('mr:library',{detail:k})),kind);await page.locator('.hub-page:visible').waitFor();await page.evaluate(()=>document.activeElement?.blur());};
  const tools=async page=>{await page.evaluate(()=>window.dispatchEvent(new CustomEvent('mr:library',{detail:'tools-page'})));await page.locator('.hub-page:visible, .tool-picker').first().waitFor();await page.evaluate(()=>document.activeElement?.blur());};
  {const {ctx,page}=await open();
   if(want('plus')){await page.locator('.composer textarea').fill('Plan a two-day trip');await page.locator(phone?'.composer .tool-btn:visible':'.composer .add-tool').first().click();await page.locator('.attach-menu').waitFor();await shot(page,'plus');await page.keyboard.press('Escape');await page.locator('.attach-menu').waitFor({state:'detached'});}
   if(want('library')){await library(page,'collection');await shot(page,'library');}
   if(want('library-search')){await page.locator('input[type=search]:visible').first().fill('quarterly forecast');await shot(page,'library-noresults');await page.locator('input[type=search]:visible').first().fill('');}
   if(want('knowledge')){await library(page,'knowledge');await shot(page,'knowledge');}
   if(want('tools')){await page.goto(base);await page.locator('.composer textarea').waitFor({state:'attached'});await tools(page);await shot(page,'tools');}
   await ctx.close();}
  if(want('empty')){const {ctx,page}=await open({chats:[]});await library(page,'collection');await shot(page,'library-empty');await ctx.close();}
  if(want('nokeys')){const {ctx,page}=await open({keys:{geminiKey:''}});await tools(page);await shot(page,'tools-nokeys');await ctx.close();}
  console.log('captured',width,theme);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
