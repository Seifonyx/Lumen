// Shared synthetic fixture for Tools baseline/implemented screenshots; external traffic is blocked.
// Readiness is deliberately mixed: a Gemini key is saved, no Cloudflare key, and one custom assistant exists.
const fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require('playwright');
const {profile}=require('./helpers/preview-profile.cjs');
const {execFileSync}=require('node:child_process');
const sourceSha=process.env.TOOLS_SOURCE_SHA||process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const base=process.env.MR_TEST_URL||'http://localhost:5190',before=process.env.TOOLS_BEFORE==='1',engine=process.env.MR_WEBKIT?'webkit':'chromium';
const out=process.env.TOOLS_OUT||`tests/e2e/out/tools/${before?'before':'after'}/${engine}`;
const assistants=[{id:'fixture-brief',name:'Weekly brief',description:'Turns meeting notes into a one-page brief with owners and dates.',instructions:'Summarize synthetic notes.',model:'auto'}];
const heights={320:568,390:844,430:932,1440:960};
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await(process.env.MR_WEBKIT?webkit:chromium).launch();const results=[];try{
for(const width of (process.env.TOOLS_WIDTHS||'320,390,430,1440').split(',').map(Number))for(const theme of (process.env.TOOLS_THEMES||'light,dark').split(',')){
 const ctx=await browser.newContext({viewport:{width,height:heights[width]||900},hasTouch:width<900,reducedMotion:'reduce',colorScheme:theme});
 await ctx.addInitScript(()=>{if(window.top===window&&'serviceWorker'in navigator)navigator.serviceWorker.register=()=>Promise.reject(new Error('Disabled for synthetic QA'))});
 await ctx.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
 await profile(ctx,'preview-tools-slice',theme,{assistants});
 const page=await ctx.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.goto(base);await page.locator('.composer textarea').waitFor();
 await page.locator('.composer textarea').fill('Retain my working draft');
 if(width<900)await page.locator('.menu-btn:visible').first().click();
 await page.locator('aside.cv-nav').getByRole('button',{name:'Tools',exact:true}).click();
 const hub=page.locator('.hub-page:visible');await hub.waitFor();
 await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>document.activeElement?.blur());
 await page.screenshot({path:path.join(out,`${width}-${theme}-tools.png`),animations:'disabled'});
 if(process.env.TOOLS_FULL==='1'){const h=await hub.locator('.hub-scroll').evaluate(el=>el.scrollHeight);await page.setViewportSize({width,height:Math.min(h+120,4000)});await page.waitForTimeout(150);await page.screenshot({path:path.join(out,`${width}-${theme}-tools-full.png`),animations:'disabled'});await page.setViewportSize({width,height:heights[width]||900});}
 results.push({width,theme,errors:errors.length});await ctx.close();console.log('CAPTURE Tools',before?'before':'after',engine,width,theme);
}
}finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({sourceSha,engine,before,syntheticOnly:true,physicalIPhone:false,results},null,2))}})().catch(e=>{console.error(e);process.exit(1)});
