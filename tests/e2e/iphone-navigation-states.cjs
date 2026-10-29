// Synthetic multi-screen regression matrix. Scripted touch and keyboard-height tests are not physical iPhone tests.
const assert = require('node:assert/strict');
const {chromium,webkit} = require('playwright');
const {profile,seed} = require('./helpers/preview-profile.cjs');
const base=process.env.MR_TEST_URL||'http://localhost:5190/';
const iphone='Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1';
(async()=>{
 const browser=await(process.env.MR_WEBKIT?webkit:chromium).launch();
 try { for(const [width,height,theme,solid,large] of [[320,568,'light',false,false],[390,844,'dark',true,false],[430,932,'light',false,true]]){
  if(process.env.NAV_WIDTH && width!==Number(process.env.NAV_WIDTH))continue;
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,userAgent:iphone,serviceWorkers:'block',reducedMotion:'reduce'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  await profile(context,`navigation-states-${width}`,theme);
  if(solid)await context.addInitScript(()=>localStorage.setItem('mr.glass','off'));
  const page=await context.newPage();page.setDefaultTimeout(15000);
  await page.goto(new URL('/privacy.html',base).href);
  const now=Date.now();await seed(page,`navigation-states-${width}`,Array.from({length:80},(_,i)=>({id:`dense-${i}`,title:`Collection ${i}`,createdAt:now,updatedAt:now-i*1000,messages:[],documents:[{id:`document-${i}`,name:`Document ${String(i).padStart(2,'0')} with a long readable title.md`,content:'# Synthetic content',updatedAt:now-i*1000}]})));
  await page.goto(base);await page.locator('.composer textarea').waitFor();
  if(!await page.locator('.app[data-lumen-canvas-shell]').count()){console.log('Not applicable to ordinary presentation');await context.close();return;}
  if(large)await page.addStyleTag({content:'.app[data-lumen-canvas-shell] .hub-body,.app[data-lumen-canvas-shell] .doc-name,.app[data-lumen-canvas-shell] .doc-sub{font-size:20px}'});
  const enter=async(name)=>{await page.locator('.menu-btn').first().click();await page.locator('aside.cv-nav').getByRole('button',{name,exact:true}).click();};
  await enter('Library');await page.getByRole('searchbox',{name:'Search your library'}).fill('Document');
  const item=page.getByRole('button',{name:'Open Document 35 with a long readable title.md',exact:true});await item.scrollIntoViewIfNeeded();
  const scroll=await page.locator('.hub-scroll').evaluate(el=>el.scrollTop);assert(scroll>500);
  await item.click();await page.locator('.canvas-panel').waitFor();await page.goBack();
  await page.getByRole('searchbox',{name:'Search your library'}).waitFor();await page.waitForTimeout(100);
  assert.equal(await page.getByRole('searchbox',{name:'Search your library'}).inputValue(),'Document');
  assert(Math.abs(await page.locator('.hub-scroll').evaluate(el=>el.scrollTop)-scroll)<20,'Library restores previous scroll');
  await page.locator('.phone-navigation [aria-label^="Return to "]').click();await page.locator('.composer textarea').waitFor();
  await enter('Tools');await page.getByRole('group',{name:'Tool areas'}).getByRole('button',{name:/^Learn/}).click();await page.getByRole('heading',{name:'Learn',exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Research',exact:true}).count(),0,'an area filter shows only that area');await page.locator(':is(.tool-card,.tx-hit)').filter({has:page.locator('strong',{hasText:/^Study$/})}).click();
  await page.locator('.phone-navigation h1').filter({hasText:'Study'}).waitFor();
  assert.equal(await page.locator('.phone-navigation [aria-label="Open sidebar"]').count(),0);
  // Exercise the actual gesture handler with a scripted edge touch sequence, in both engines.
  await page.locator('.hub-page').evaluate(async el=>{const dispatch=(type,x)=>{const e=new Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:type==='touchend'?[]:[{identifier:1,clientX:x,clientY:180}]});el.dispatchEvent(e)};dispatch('touchstart',5);for(const x of [30,90,180,300]){dispatch('touchmove',x);await new Promise(r=>setTimeout(r,30))}dispatch('touchend',300)});
  await page.getByRole('searchbox',{name:'Search tools'}).waitFor();
  await page.getByRole('button',{name:'New assistant',exact:true}).click();await page.getByLabel('Library item name').fill('Retained editor');await page.getByLabel('Library instructions').fill('Preserved across global sheets');
  const command=async(name)=>{await page.keyboard.press('Control+k');const search=page.getByRole('combobox',{name:'Search commands',exact:true});await search.fill(name);await search.press('Enter');};
  await command('Read a web page');await page.locator('.free-tools').waitFor();
  await page.goBack();await page.locator('.free-tools').waitFor({state:'detached'});assert.equal(await page.getByLabel('Library item name').inputValue(),'Retained editor');
  await page.goForward();await page.locator('.free-tools').waitFor();await page.goBack();await page.locator('.free-tools').waitFor({state:'detached'});
  await command('Settings · API keys');await page.locator('.settings-page').waitFor();await page.goBack();await page.locator('.settings-page').waitFor({state:'detached'});
  assert.equal(await page.getByLabel('Library instructions').inputValue(),'Preserved across global sheets','single Back restores editor from Settings');
  // A reduced viewport stands in for available keyboard space; it does not emulate Safari's keyboard.
  await page.setViewportSize({width,height:400});await page.getByLabel('Library instructions').focus();await page.getByRole('button',{name:'Save',exact:true}).scrollIntoViewIfNeeded();
  assert(await page.getByRole('button',{name:'Save',exact:true}).isVisible());await page.setViewportSize({width,height});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  console.log(`PASS pre-reload screen-state checks ${width}x${height}`);
  await page.reload();await page.locator('.composer textarea').waitFor();assert.equal(await page.locator('.phone-navigation').count(),0,'refresh starts at the real chat root');
  console.log(`PASS screen states ${width}x${height}: ${theme}, ${solid?'solid':'glass'}, ${large?'larger text':'default text'}, dense scroll, nested layers, single Back, scripted edge swipe, simulated keyboard, refresh`);
  await context.close();
 }}finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
