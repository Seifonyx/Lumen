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
  await ctx.addInitScript(()=>{window.__mrMotion=true;});
  let requests=0;
  ctx.on('request',r=>{if(r.url().includes(':streamGenerateContent'))requests++;});
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>{if(!e.message.includes('firestore.googleapis.com'))errors.push(e.message);});
  await page.goto(url);await page.locator('.composer textarea').waitFor();
  const moon=page.locator('.welcome-moon'),head=moon.locator('.orbit-head');
  // Canvas shows Lumen's mark (owner, 2026-10-30: it replaces the old lime moon); the ordinary build keeps the moon.
  if(await page.locator('.welcome-native').count()){
   assert.equal(await moon.count(),0,'Canvas new chat has no moon');
   assert.equal(await page.locator('.welcome-native svg').count(),1,'Canvas new chat shows one mark');
  }else{
  assert.equal(await head.count(),1,'Welcome moon has one orbiting light');
  await page.waitForTimeout(1500);
  const p=await head.boundingBox();await page.waitForTimeout(450);const q=await head.boundingBox();
  assert.equal(Math.hypot(q.x-p.x,q.y-p.y)>1,!reduced,'Orbit really moves, except with Reduce Motion');
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(()=>document.querySelector('.welcome-moon').dataset.visualActive==='false');
  // CSS pause commits on the next rendering tick; wait for pending pause tasks before measuring.
  await moon.evaluate(el=>Promise.all(el.getAnimations({subtree:true}).map(animation=>animation.ready)));
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
  if(!reduced){
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.waitForFunction(()=>document.querySelector('.welcome-moon').dataset.visualActive==='false');
   assert.equal(await moon.locator('.moon-orbit').evaluate(el=>getComputedStyle(el).animationName),'none','Live preference changes stop the orbit');
   await page.emulateMedia({reducedMotion:'no-preference'});
   await page.waitForFunction(()=>document.querySelector('.welcome-moon').dataset.visualActive==='true');
  }
  }
  await page.locator('.composer textarea').fill('KEEP_MOON_DRAFT');
  await page.waitForTimeout(300);
  assert.equal(await page.locator('.composer textarea').inputValue(),'KEEP_MOON_DRAFT');
  assert.equal(requests,0,'Moon animation never requests inference');
  assert.deepEqual(errors,[]);
  console.log(`PASS visual animations ${process.env.MR_WEBKIT?'webkit':'chromium'} ${width}px ${theme} ${reduced?'reduced':'motion'}`);
  await ctx.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
