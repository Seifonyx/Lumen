// CP3: unknown/unchecked/restricted metadata and recovery; isolated synthetic owners only.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require('playwright'),{profile}=require('./helpers/preview-profile.cjs');
const base=process.env.MR_TEST_URL||'http://localhost:5190/',engine=process.env.MR_WEBKIT?'webkit':'chromium',out=process.env.PRISM_MODELS_OUT||'tests/e2e/out/prism-models';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await(engine==='webkit'?webkit:chromium).launch();let passed=0;
try{for(const width of [320,1440])for(const theme of ['light','dark'])for(const mode of ['metadata','missing']){
 const context=await browser.newContext({viewport:{width,height:width===320?568:960},hasTouch:width<900,serviceWorkers:'block',reducedMotion:'reduce'});
 await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
 const endpoint='https://generativelanguage.googleapis.com/v1beta';
 await profile(context,`preview-prism-unknown-${width}-${theme}`,theme,mode==='missing'?{defaultModel:'gemini:saved-missing',enabledModels:['gemini:saved-missing',...Array.from({length:32},(_,i)=>`gemini:gemini-choice-${i}`)]}:{defaultModel:'gemini:gemini-unknown',enabledModels:['gemini:gemini-flash-latest','gemini:gemini-unknown','gemini:gemini-offline'],modelDeclarations:[{id:'gemini:gemini-unknown',provider:'gemini',name:'gemini-unknown',label:'Research model with unknown capacity',endpoint},{id:'gemini:gemini-offline',provider:'gemini',name:'gemini-offline',label:'Non-streaming research model',streaming:false,endpoint}]});
 if(mode==='missing')await context.route('**/generativelanguage.googleapis.com/**',r=>{assert(r.request().url().includes('/models?'));return r.fulfill({json:{models:Array.from({length:32},(_,i)=>({name:`models/gemini-choice-${i}`,displayName:`Gemini Choice ${i}`,inputTokenLimit:128000,supportedGenerationMethods:['generateContent']}))}})});
 const page=await context.newPage();page.setDefaultTimeout(12000);try{
 await page.goto(base);const input=page.locator('.composer textarea');await input.waitFor();if(!await page.locator('.app[data-lumen-canvas-shell]').count())return;
 await input.fill('Account A private synthetic draft');if(width<900)await page.getByRole('button',{name:'Open chats',exact:true}).first().click();await page.locator('aside.cv-nav').getByRole('button',{name:'Router',exact:true}).click();
 const rc=page.locator('.rc-page');
 if(mode==='missing'){
  await rc.locator('.rc-model').first().waitFor();
  const current=rc.getByRole('region',{name:'Current routing mode'});assert.match(await current.innerText(),width===320?/Needs setup/:/unavailable/);
  if(width===320){const geometry=await rc.locator('.rc-model').first().evaluate(el=>({bottom:el.getBoundingClientRect().bottom,search:document.querySelector('.rc-search input').getBoundingClientRect().top}));assert(geometry.bottom<geometry.search,JSON.stringify(geometry));await current.locator('summary').click();}
  assert(await current.getByRole('button',{name:'Review model settings',exact:true}).isVisible());if(width===320)await current.locator('summary').click();
  await rc.getByRole('button',{name:'Filter models: All models',exact:true}).click();await rc.getByRole('menuitemradio',{name:/Selected/}).click();
  const missing=rc.locator('[data-model="gemini:saved-missing"]');await missing.waitFor();assert.match(await missing.innerText(),/Selected/);assert.match(await missing.innerText(),/unavailable/);assert(await missing.getByRole('button',{name:/^Use /}).isDisabled());
  await page.evaluate(()=>document.activeElement?.blur());await page.screenshot({path:path.join(out,`${width}-${theme}-missing-selected.png`),animations:'disabled'});passed++;continue;
 }
 const unknown=rc.locator('[data-model="gemini:gemini-unknown"]');await unknown.waitFor();assert.match(await unknown.innerText(),/Selected/);assert.match(await unknown.innerText(),/Context unknown/);assert.match(await unknown.innerText(),/Declared, unchecked/);await unknown.getByText('Model details',{exact:true}).click();assert.match(await unknown.innerText(),/Capabilities not reported/);assert.match(await unknown.innerText(),/Allowance unknown/);assert(await unknown.getByRole('button',{name:'Use Research model with unknown capacity',exact:true}).isEnabled());
 const restricted=rc.locator('[data-model="gemini:gemini-offline"]');assert.match(await restricted.innerText(),/does not support streamed replies/);assert(await restricted.getByRole('button',{name:'Use Non-streaming research model',exact:true}).isDisabled());await restricted.scrollIntoViewIfNeeded();await page.evaluate(()=>document.activeElement?.blur());await page.screenshot({path:path.join(out,`${width}-${theme}-unknown-restricted.png`),animations:'disabled'});
 // Router owns model settings: Manage model opens Routing in one step; Back and Forward move between the two.
 const routing=rc.getByRole('combobox',{name:'Routing priority',exact:true});
 await restricted.getByRole('button',{name:'Manage model',exact:true}).click();await routing.waitFor();assert.equal(await page.getByRole('dialog',{name:'Settings',exact:true}).count(),0);await page.goBack();await restricted.waitFor();await page.goForward();await routing.waitFor();await page.goBack();await restricted.waitFor();assert.equal(await input.inputValue(),'Account A private synthetic draft');
 // Exercise the real sign-out owner while nested, then verify another synthetic owner in a fresh tab.
 await restricted.getByRole('button',{name:'Manage model',exact:true}).click();await routing.waitFor();
 const settings=page.getByRole('dialog',{name:'Settings',exact:true});
 if(width<900){await rc.getByRole('button',{name:'Return to chat',exact:true}).click();await rc.waitFor({state:'hidden'});await page.getByRole('button',{name:'Open chats',exact:true}).first().click();}
 await page.locator('aside.cv-nav').getByRole('button',{name:'Settings',exact:true}).click();
 await settings.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:/^(General|Account:)/}).click();
 await settings.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('button',{name:'Continue with Google',exact:true}).waitFor();
 await page.goBack();assert.equal(await rc.count(),0,'Back after sign-out cannot restore another account’s Prism');
 await page.evaluate(()=>{localStorage.setItem('mr.preview_user',JSON.stringify({uid:'preview-prism-other',email:'fixture@local.invalid',displayName:'Other'}));localStorage.setItem('mr.account.preview-prism-other',JSON.stringify({geminiKey:'fixture',settings:{autoIntroduced:true,defaultModel:'auto',enabledModels:['gemini:gemini-flash-latest']}}));});
 // Fresh tab avoids the independently reproduced Linux WebKit history/reload crash; not a physical Safari claim.
 const other=await context.newPage();await other.goto(base);await other.locator('.composer textarea').waitFor();assert.equal(await other.locator('.composer textarea').inputValue(),'');assert.equal(await other.locator('.rc-page').count(),0);assert.equal(await other.getByText('context.txt',{exact:true}).count(),0);await other.close();passed++;
 }finally{await context.close();}
}}finally{await browser.close();fs.writeFileSync(path.join(out,`states-${engine}.json`),JSON.stringify({passed,syntheticOnly:true,physicalIPhone:false},null,2));}
console.log(`PASS Prism unknown/restrictions/recovery/account ${engine} ${passed}/8`);
})().catch(e=>{console.error(e);process.exit(1)});
