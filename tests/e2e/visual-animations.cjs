const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {profile}=require('./helpers/preview-profile.cjs');
const url=process.env.MR_TEST_URL||'http://localhost:5190/';
const ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1';
(async()=>{
 const browser=await(process.env.MR_WEBKIT?webkit:chromium).launch();
 try{for(const [width,theme,reduced]of[[390,'dark',false],[1280,'light',false],[320,'black',false],[390,'dark',true]]){
  const ctx=await browser.newContext({viewport:{width,height:844},isMobile:width<900,hasTouch:width<900,serviceWorkers:'block',reducedMotion:reduced?'reduce':'no-preference',...(width<900?{userAgent:ua}:{})});
  await profile(ctx,`visual-art-${width}-${theme}-${reduced}`,theme,{defaultModel:'auto'});
  await ctx.addInitScript(()=>{window.__mrMotion=true;window.__visualDissolveSparks=0;new MutationObserver(()=>{const art=document.querySelector('.thinking-art[data-phase="dissolving"]');if(art)window.__visualDissolveSparks=art.querySelectorAll('.thinking-spark').length;}).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['data-phase']});});
  let finish,requests=0;
  await ctx.route('**/generativelanguage.googleapis.com/**',async route=>{
   const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
   if(route.request().url().includes('/models?'))return route.fulfill({headers,json:{models:[{name:'models/gemini-flash-latest',displayName:'Gemini Flash',supportedGenerationMethods:['generateContent']}]}});
   requests++;await new Promise(resolve=>{finish=resolve;});
   await route.fulfill({headers,contentType:'text/event-stream',body:'data: '+JSON.stringify({candidates:[{content:{parts:[{text:'THE_ANSWER_MARKER'}]},finishReason:'STOP'}]})+'\n\n'}).catch(()=>{});
  });
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>{if(!e.message.includes('firestore.googleapis.com'))errors.push(e.message);});
  await page.goto(url);await page.locator('.composer textarea').waitFor();
  const moon=page.locator('.welcome-moon'),head=moon.locator('.orbit-head');
  assert.equal(await head.count(),1,'Welcome moon has one orbiting light');
  await page.waitForTimeout(1500);
  const p=await head.boundingBox();await page.waitForTimeout(450);const q=await head.boundingBox();
  assert.equal(Math.hypot(q.x-p.x,q.y-p.y)>1,!reduced,'Orbit really moves, except with Reduce Motion');
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(()=>document.querySelector('.welcome-moon').dataset.visualActive==='false');
  const hidden=await head.boundingBox();await page.waitForTimeout(250);const still=await head.boundingBox();
  assert.ok(Math.hypot(hidden.x-still.x,hidden.y-still.y)<.2,'Hidden-document visuals pause');
  await page.evaluate(()=>{delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'));});
  if(!reduced){
   await moon.evaluate(el=>el.style.display='none');await page.waitForFunction(()=>document.querySelector('.welcome-moon').dataset.visualActive==='false');
   await moon.evaluate(el=>el.style.display='');await page.waitForFunction(()=>document.querySelector('.welcome-moon').dataset.visualActive==='true');await page.waitForTimeout(1400);
  }
  fs.mkdirSync('tests/e2e/out',{recursive:true});
  const prefix=`tests/e2e/out/visual-${process.env.MR_WEBKIT?'webkit':'chromium'}-${width}-${reduced}`;
  if(!reduced&&width!==320)await moon.screenshot({path:prefix+'-moon.png'});
  await page.locator('.composer textarea').fill('Explain this.');await page.locator('.send-btn').click();
  const art=page.locator('.thinking-art');await art.waitFor();
  assert.equal(await art.locator('.thinking-ribbon').count(),3);
  assert.equal(await art.locator('svg').getAttribute('aria-hidden'),'true');
  await page.waitForTimeout(250);
  const curve=()=>art.locator('.thinking-ribbon').first().evaluate(el=>el.getPointAtLength(el.getTotalLength()*.35).y);
  const a=await curve();await page.waitForTimeout(400);const b=await curve();
  assert.equal(Math.abs(a-b)>.3,!reduced,'The ribbons actually weave rather than merely fade');
  assert.equal(await art.locator('svg').evaluate(el=>el.animationsPaused()),reduced,'Native SVG timeline respects Reduce Motion');
  if(!reduced){await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('.thinking-visual').dataset.visualActive==='false');assert.ok(await art.locator('svg').evaluate(el=>el.animationsPaused()));await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>document.querySelector('.thinking-visual').dataset.visualActive==='true');}
  if(!reduced&&width!==320){for(let i=0;i<3;i++){await art.screenshot({path:prefix+`-waves-${i}.png`});await page.waitForTimeout(180);}}
  await page.locator('.composer textarea').fill('KEEP_VISUAL_DRAFT');
  finish();
  await page.getByText('THE_ANSWER_MARKER',{exact:true}).waitFor();
  if(!reduced)assert.equal(await page.evaluate(()=>window.__visualDissolveSparks),8,'Reply arrival dissolves the ribbons into eight sparks');
  await art.waitFor({state:'detached'});
  assert.equal(await page.locator('.composer textarea').inputValue(),'KEEP_VISUAL_DRAFT');
  assert.equal(requests,1,'Visuals never trigger inference');
  const nextRequest=page.waitForRequest(r=>r.url().includes('generativelanguage.googleapis.com')&&!r.url().includes('/models?')&&r.method()!=='OPTIONS');
  await page.locator('.send-btn').click();await nextRequest;await art.waitFor();
  await page.getByRole('button',{name:'Stop',exact:true}).click();finish?.();
  await art.waitFor({state:'detached'});
  assert.deepEqual(errors,[]);
  console.log(`PASS visual animations ${process.env.MR_WEBKIT?'webkit':'chromium'} ${width}px ${theme} ${reduced?'reduced':'motion'}`);
  await ctx.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
