// CP3: actual Canvas + canonical synthetic profile/catalog. No live provider requests or accounts.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require('playwright'),AxeBuilder=require('@axe-core/playwright').default;
const {profile,seed}=require('./helpers/preview-profile.cjs');
const base=process.env.MR_TEST_URL||'http://localhost:5190/',engine=process.env.MR_WEBKIT?'webkit':'chromium';
const out=process.env.PRISM_MODELS_OUT||'tests/e2e/out/prism-models';fs.mkdirSync(out,{recursive:true});
const sizes=(process.env.PRISM_MODELS_SIZES||'320x568,390x844,430x932,1440x960').split(',').map(s=>s.split('x').map(Number));
(async()=>{const browser=await(engine==='webkit'?webkit:chromium).launch(),results=[];
try{for(const[width,height]of sizes)for(const theme of ['light','dark']){
 const context=await browser.newContext({viewport:{width,height},hasTouch:width<900,reducedMotion:'reduce',serviceWorkers:'block'});
 await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
 const uid=`preview-prism-models-${width}-${theme}`;
 const ids=['gemini:gemini-flash-latest','gemini:gemini-2.5-pro'];
 await profile(context,uid,theme,{defaultModel:'auto',enabledModels:ids,layouts:[{id:'fixture-layout',name:'Writing pair',description:'Synthetic saved layout',icon:'layers',models:ids,mode:'order',fallback:'layout'}]});
 let large=false;const requests=[];
 await context.route('**/generativelanguage.googleapis.com/**',r=>{assert(r.request().url().includes('/models?'),'selection must not send inference');requests.push(r.request().method());return r.fulfill({json:{models:[['gemini-flash-latest','Gemini Flash'],['gemini-2.5-pro','Gemini 2.5 Pro'],...(large?Array.from({length:300},(_,i)=>[`gemini-fixture-${i}`,`Synthetic research model ${i} with a deliberately long multilingual title — دراسة النموذج`]):[])].map(([name,displayName])=>({name:`models/${name}`,displayName,inputTokenLimit:128000,supportedGenerationMethods:['generateContent']}))}})});
 const page=await context.newPage();page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
 await page.goto(base);const input=page.locator('.composer textarea');await input.waitFor();
 if(!await page.locator('.app[data-lumen-canvas-shell]').count()){console.log('Not applicable to ordinary presentation');return;}
 await seed(page,uid,[{id:'model-chat',title:'Prism selection conversation',model:'auto',createdAt:1,updatedAt:2,messages:[{id:'m1',role:'user',text:'Synthetic existing conversation',createdAt:1},{id:'m2',role:'assistant',text:'Your existing response stays here.',status:'done',model:ids[0],createdAt:2}]}]);
 await page.reload();await input.waitFor();if(width<900)await page.getByRole('button',{name:'Open chats',exact:true}).first().click();await page.locator('aside.cv-nav').getByRole('button',{name:/Prism selection conversation/}).first().click();await page.getByText('Your existing response stays here.',{exact:true}).waitFor();

 const draft='Keep my draft: café 🌙 مرحبا\nSecond line remains exact.';await input.fill(draft);
 await page.locator('.composer input[type=file][multiple]').last().setInputFiles({name:'context.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic attachment context')});
 await page.getByText('context.txt',{exact:true}).first().waitFor();
 await input.evaluate(el=>{window.__prismInput=el;el.focus();el.setSelectionRange(5,19,'backward');});
 const open=async()=>{if(width<900)await page.getByRole('button',{name:'Open chats',exact:true}).first().click();await page.locator('aside.cv-nav').getByRole('button',{name:'Prism',exact:true}).click();};
 await open();const rc=page.locator('.rc-page');await rc.locator('.rc-model').first().waitFor();await page.evaluate(()=>document.fonts.ready);
 const shot=async name=>{await page.evaluate(()=>document.activeElement?.blur());await page.screenshot({path:path.join(out,`${width}-${theme}-${name}.png`),animations:'disabled'});};
 await shot('models');
 if(process.env.PRISM_MODELS_CAPTURE_BASELINE==='1')continue; // Explicit capture-only baseline, never enabled in verification/CI.
 if(width===320){const geo=await rc.locator('.rc-model').first().evaluate(el=>{const a=el.getBoundingClientRect(),b=el.querySelector('button:not(:disabled)').getBoundingClientRect(),s=document.querySelector('.rc-search input').getBoundingClientRect();return{rowBottom:a.bottom,buttonBottom:b.bottom,searchTop:s.top,scroll:el.closest('.rc-scroll').scrollTop}});assert.equal(geo.scroll,0);assert(geo.rowBottom<geo.searchTop&&geo.buttonBottom<geo.searchTop,JSON.stringify(geo));}
 const search=rc.getByRole('searchbox',{name:'Search models',exact:true});await search.fill('Google AI Studio pro');assert.equal(await rc.locator('.rc-model').count(),1,'provider alias + model terms narrow inventory');assert.match(await rc.locator('.rc-model').innerText(),/2.5 Pro/);
 await rc.getByRole('button',{name:'Clear model search',exact:true}).click();
 await rc.getByRole('button',{name:'Filter models: All models',exact:true}).click();await rc.getByRole('menuitemradio',{name:/Selectable/}).click();assert.equal(await rc.locator('.rc-model').count(),2);
 await shot('filtered');
 await rc.getByRole('button',{name:'Filter models: Selectable',exact:true}).click();await rc.getByRole('menuitemradio',{name:/Reads images/}).click();assert.equal(await rc.locator('.rc-model').count(),2);
 await rc.getByRole('button',{name:'Filter models: Reads images',exact:true}).click();await rc.getByRole('menuitemradio',{name:/Selected/}).click();await rc.getByText('No models match.',{exact:true}).waitFor();await rc.getByRole('button',{name:'Reset model filters',exact:true}).click();
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
 await rc.getByRole('button',{name:'Use Gemini 2.5 Pro',exact:true}).click();await rc.waitFor({state:'hidden'});
 assert.equal(await input.inputValue(),draft);assert(await page.getByText('Your existing response stays here.',{exact:true}).isVisible());assert(await page.getByText('context.txt',{exact:true}).first().isVisible());
 const info=await input.evaluate(el=>({same:el===window.__prismInput,start:el.selectionStart,end:el.selectionEnd,direction:el.selectionDirection,focus:el===document.activeElement}));assert.deepEqual(info,{same:true,start:5,end:19,direction:'backward',focus:true});
 assert.match(await page.locator('.model-button').innerText(),/2.5 Pro/);await page.getByText('Now using Gemini 2.5 Pro in this chat',{exact:true}).waitFor();await shot('selected-chat');
 const dismiss=page.locator('.toasts').getByRole('button',{name:'Dismiss',exact:true}).first();if(await dismiss.isVisible())await dismiss.click(); // Keep the success capture; clear the real toast before presentation captures.
 // Same compact picker: alias search, manual / Auto / saved Layout and keyboard activation.
 await page.locator('.model-button').click();const picker=page.getByRole('dialog',{name:'Choose a model'});const ps=picker.getByRole('searchbox',{name:'Search models',exact:true});await ps.fill('Google AI Studio pro');assert.equal(await picker.getByRole('option').count(),1);assert.equal(await picker.getByRole('option').first().getAttribute('aria-selected'),'true');await shot('picker');await ps.press('ArrowDown');assert.equal(await picker.locator('[role=option]:focus').count(),1);await page.keyboard.press('Enter');await picker.waitFor({state:'hidden'});assert.equal(await input.inputValue(),draft);
 await page.locator('.model-button').click();await picker.getByRole('option',{name:/^Auto /}).click();assert.match(await page.locator('.model-button').innerText(),/Auto/);
 await page.locator('.model-button').click();await picker.getByRole('option',{name:/Writing pair/}).click();assert.match(await page.locator('.model-button').innerText(),/Writing pair/);assert.equal(await input.inputValue(),draft);
 // Refresh via existing provider action, then bound a large inventory and search to an off-page long name.
 await open();await rc.getByRole('navigation',{name:'Prism sections'}).getByRole('button',{name:'Providers',exact:true}).click();await rc.locator('[data-provider="gemini"]').click();large=true;await rc.getByRole('button',{name:'Refresh model list',exact:true}).click();await rc.getByText('302 in catalog',{exact:true}).waitFor();
 if(width<900)await rc.locator('.phone-navigation').getByRole('button',{name:'Back',exact:true}).click();await rc.getByRole('navigation',{name:'Prism sections'}).getByRole('button',{name:'Models',exact:true}).click();await rc.getByRole('navigation',{name:'Model pages',exact:true}).waitFor();assert.equal(await rc.locator('.rc-model').count(),24);
 await search.fill('fixture-299');assert.equal(await rc.locator('.rc-model').count(),1);assert.match(await rc.locator('.rc-model').innerText(),/Enable this model/);assert(await rc.getByRole('button',{name:'Use Synthetic research model 299 with a deliberately long multilingual title — دراسة النموذج',exact:true}).isDisabled());await shot('long-name');
 assert(await rc.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'model rows fit narrow screen');
 await rc.getByRole('button',{name:'Clear model search',exact:true}).click();await rc.getByRole('button',{name:'Next',exact:true}).click();assert.match(await rc.getByRole('navigation',{name:'Model pages'}).innerText(),/25–48 of 302/);
 await search.fill('fixture-299');await rc.getByRole('navigation',{name:'Prism sections'}).getByRole('button',{name:'Usage',exact:true}).click();await page.goBack();await search.waitFor();assert.equal(await search.inputValue(),'fixture-299','Back restores Models search');
 assert(requests.every(m=>m==='GET'));assert.deepEqual(errors,[]);results.push({width,height,theme,passed:true});console.log(`PASS Prism Models ${engine} ${width} ${theme}`);
 }finally{await context.close();}
}}finally{await browser.close();fs.writeFileSync(path.join(out,`results-${engine}.json`),JSON.stringify({engine,syntheticOnly:true,physicalIPhone:false,results},null,2));}
})().catch(e=>{console.error(e);process.exit(1)});
