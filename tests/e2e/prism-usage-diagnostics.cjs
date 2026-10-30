// Router > Activity (Overview, Logs, Quotas): truthful evidence and privacy, synthetic account/catalog/transport only.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require('playwright'),AxeBuilder=require('@axe-core/playwright').default;
const {profile,seed}=require('./helpers/preview-profile.cjs');
const base=process.env.MR_TEST_URL||'http://localhost:5190/',engine=process.env.MR_WEBKIT?'webkit':'chromium',out=process.env.PRISM_EVIDENCE_OUT||'tests/e2e/out/prism-usage-diagnostics';fs.mkdirSync(out,{recursive:true});
const sizes=(process.env.PRISM_EVIDENCE_SIZES||'320x568,390x844,430x932,1440x960').split(',').map(s=>s.split('x').map(Number));
(async()=>{const browser=await(engine==='webkit'?webkit:chromium).launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH&&engine==='chromium'?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),results=[];
try{for(const[width,height]of sizes)for(const theme of['light','dark']){
 const ctx=await browser.newContext({viewport:{width,height},hasTouch:width<900,reducedMotion:'reduce',serviceWorkers:'block'});
 await ctx.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
 const uid=`preview-prism-evidence-${width}-${theme}`,flash='gemini:gemini-flash-latest';await profile(ctx,uid,theme,{defaultModel:flash,enabledModels:[flash]});
 let hold=false,releaseHold;await ctx.route('**/generativelanguage.googleapis.com/**',async r=>{if(r.request().url().includes('/models?'))return r.fulfill({json:{models:[{name:'models/gemini-flash-latest',displayName:'Gemini Flash',inputTokenLimit:1048576,supportedGenerationMethods:['generateContent']}]}});if(hold)await new Promise(resolve=>{releaseHold=resolve});return r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({candidates:[{content:{parts:[{text:'Synthetic completed reply.'}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:12,candidatesTokenCount:7}})+'\n\n'})});
 const page=await ctx.newPage();page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);const input=page.locator('.composer textarea');await input.waitFor();if(!await page.locator('.app[data-lumen-canvas-shell]').count()){console.log('Not applicable to ordinary presentation');await ctx.close();continue;}
 const now=Date.now(),reply=(id,status,at,extra={})=>({id,role:'assistant',text:`PRIVATE_BODY_${id}`,model:flash,status,createdAt:at,...extra});
 await seed(page,uid,[{id:'evidence',title:'PRIVATE CHAT TITLE',model:flash,createdAt:now-10000,updatedAt:now,messages:[{id:'u',role:'user',text:'PRIVATE PROMPT',createdAt:now-9000},reply('done','done',now-8000,{route:'balanced'}),reply('rerouted','done',now-7000,{notices:['A model reached its limit — switched to Gemini Flash.']}),reply('stopped','stopped',now-6000),reply('failed','error',now-5000,{error:'401 private provider response'})]},{id:'temporary-secret',title:'TEMPORARY PRIVATE',model:flash,createdAt:now,updatedAt:now,messages:[reply('temp','done',now)]}]);
 await page.reload();await input.waitFor();await input.fill('Synthetic counter request');await page.locator('.send-btn').click();await page.getByText('Synthetic completed reply.',{exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('.send-btn')?.getAttribute('aria-label')!=='Stop');
 const open=async()=>{if(width<900)await page.getByRole('button',{name:'Open chats',exact:true}).first().click();await page.locator('aside.cv-nav').getByRole('button',{name:'Router',exact:true}).click();};await open();const rc=page.locator('.rc-page');await rc.locator('.rc-model').first().waitFor();const nav=rc.getByRole('navigation',{name:'Router sections'});
 const tab=name=>rc.getByRole('tablist',{name:'Activity views'}).getByRole('tab',{name,exact:true});
 await nav.getByRole('button',{name:'Activity',exact:true}).click();await tab('Overview').waitFor();assert.equal(await tab('Overview').getAttribute('aria-selected'),'true','Activity opens on its Overview');
 await rc.locator('[data-evidence-source="app-counters"]').waitFor();await rc.locator('[data-evidence-source="saved-chats"]').waitFor();
 const overview=await rc.innerText();assert.match(overview,/Requests today/);assert.match(overview,/Counted by Lumen/);assert.match(overview,/3 of 5 requests/);assert.match(overview,/Provider limits appear only when known/);assert.doesNotMatch(overview,/\bAvailable\b/);
 for(const secret of['PRIVATE CHAT TITLE','PRIVATE PROMPT','PRIVATE_BODY','private provider response','TEMPORARY PRIVATE'])assert(!overview.includes(secret),`hidden overview content: ${secret}`);
 const flat=async()=>{assert(await rc.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Activity has no horizontal clipping');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow');};
 const top=()=>page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);const p=document.querySelector('.rc-page'),s=document.querySelector('.rc-scroll');if(p)p.scrollTop=0;if(s)s.scrollTop=0});
 await flat();await top();await page.screenshot({path:path.join(out,`${engine}-${width}-${theme}-overview.png`),animations:'disabled'});
 // Quotas: real counters only. Gemini has no reported limit (counted, unknown); cloud sync has the free plan's limits.
 await tab('Quotas').click();const quotas=rc.locator('.ac-quotas');await quotas.waitFor();const qText=await quotas.innerText();assert.match(qText,/Counted, no known limit/);assert.match(qText,/Sync reads/);assert.doesNotMatch(qText,/\bNaN\b|undefined/);
 const reads=quotas.locator('.ac-quota',{hasText:'Sync reads'}).locator('.ac-quota-hit');await reads.click();assert.equal(await reads.getAttribute('aria-expanded'),'true');assert.match(await quotas.innerText(),/Where this comes from/);
 await quotas.getByText('Alert settings',{exact:true}).click();await quotas.getByRole('combobox').selectOption('70');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mr.settings')||'{}').quotaWarnAt),0.7,'the warning level is a saved setting');
 await flat();await top();await page.screenshot({path:path.join(out,`${engine}-${width}-${theme}-quotas.png`),animations:'disabled'});
 if(width<900){for(let i=0;i<3&&await rc.isVisible();i++)await rc.locator('.phone-navigation').getByRole('button',{name:'Return to chat',exact:true}).click();}else await rc.getByRole('button',{name:'Return to chat',exact:true}).click();await rc.waitFor({state:'hidden'});hold=true;await input.fill('Keep this request in progress');await page.locator('.send-btn').click();await page.getByRole('button',{name:'Stop',exact:true}).waitFor();await open();await rc.locator('.rc-model').first().waitFor();await rc.getByRole('navigation',{name:'Router sections'}).getByRole('button',{name:'Activity',exact:true}).click();
 // Logs list every saved request outcome, in Lumen's words only.
 await tab('Logs').click();const logs=rc.locator('[data-evidence-source="saved-request-outcomes"]');await logs.waitFor();await logs.locator('.ac-row').first().waitFor();
 const logText=await logs.innerText();for(const want of[/In progress/,/Answered/,/Answered after rerouting/,/Request stopped/,/Request failed/,/Provider refused the key/])assert.match(logText,want);
 for(const secret of['PRIVATE CHAT TITLE','PRIVATE PROMPT','PRIVATE_BODY','private provider response','TEMPORARY PRIVATE'])assert(!logText.includes(secret),`hidden log content: ${secret}`);
 const titles=rc.getByRole('checkbox',{name:'Show chat titles',exact:true});assert.equal(await titles.isChecked(),false);await titles.check();assert.match(await logs.innerText(),/PRIVATE CHAT TITLE/);await titles.uncheck();assert(!((await logs.innerText()).includes('PRIVATE CHAT TITLE')));
 // Search, filter, inspect, export.
 const search=rc.getByRole('searchbox',{name:'Search logs',exact:true});await search.fill('refused');assert.equal(await logs.locator('.ac-row').count(),1,'search narrows to the failed request');
 await logs.locator('.ac-row').first().click();const detail=page.getByRole('dialog',{name:'Request failed'});await detail.waitFor();const dText=await detail.innerText();assert.match(dText,/Event id/);assert.match(dText,/Provider refused the key/);assert(!dText.includes('private provider response'));
 await detail.getByRole('button',{name:'Close event details',exact:true}).click();await detail.waitFor({state:'hidden'});
 await search.fill('');await rc.getByRole('button',{name:/^Status: /}).click();await page.getByRole('menuitemradio',{name:/^Error/}).click();assert.equal(await logs.locator('.ac-row').count(),1,'status filter keeps only errors');await rc.getByRole('button',{name:/^Status: /}).click();await page.getByRole('menuitemradio',{name:/All statuses/}).click();
 const [download]=await Promise.all([page.waitForEvent('download'),rc.getByRole('button',{name:'CSV',exact:true}).click()]);const csv=fs.readFileSync(await download.path(),'utf8');assert.match(csv,/^﻿?time,category,status,event,/);assert.match(csv,/Request failed/);for(const secret of['PRIVATE CHAT TITLE','PRIVATE PROMPT','PRIVATE_BODY','private provider response'])assert(!csv.includes(secret),`export leaks ${secret}`);
 await page.keyboard.press('Shift+Tab');assert(await page.evaluate(()=>document.activeElement!==document.body),'keyboard focus remains visible in Logs');
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);await flat();await top();await page.screenshot({path:path.join(out,`${engine}-${width}-${theme}-logs.png`),animations:'disabled'});
 await page.goBack();await rc.getByRole('navigation',{name:'Router sections'}).locator('[aria-current="page"]',{hasText:'Models'}).waitFor();await page.goForward();await tab('Logs').waitFor();assert.equal(await tab('Logs').getAttribute('aria-selected'),'true','Forward returns to Logs');if(releaseHold){releaseHold();await page.waitForFunction(()=>document.querySelector('.send-btn')?.getAttribute('aria-label')!=='Stop');}
 if(width===320&&theme==='light'){await page.evaluate(()=>{localStorage.setItem('mr.preview_user',JSON.stringify({uid:'preview-prism-other-account',email:'other@local.invalid',displayName:'Other'}));localStorage.setItem('mr.account.preview-prism-other-account',JSON.stringify({geminiKey:'fixture',settings:{theme:'light',enabledModels:['gemini:gemini-flash-latest'],defaultModel:'gemini:gemini-flash-latest'}}));});// New tab, same browser context/storage: account switch remains real but does not
  // reload an old branched-history WebKit document (a known Linux WebKit crash).
  await page.close();
  const other = await ctx.newPage();
  other.on('pageerror',e=>errors.push(e.message));
  await other.goto(base);
  await other.locator('.composer textarea').waitFor();
  if(width<900)await other.getByRole('button',{name:'Open chats',exact:true}).first().click();
  await other.locator('aside.cv-nav').getByRole('button',{name:'Router',exact:true}).click();
  await other.locator('.rc-page').getByRole('navigation',{name:'Router sections'}).getByRole('button',{name:'Activity',exact:true}).click();
  await other.getByRole('tab',{name:'Logs',exact:true}).click();
  await other.getByText('No activity yet',{exact:true}).waitFor();
  assert.equal(await other.getByText('PRIVATE CHAT TITLE',{exact:true}).count(),0,'another account cannot see first account evidence');
  await other.screenshot({path:path.join(out,`${engine}-${width}-${theme}-other-account-diagnostics.png`),animations:'disabled'});}
 assert.deepEqual(errors,[]);results.push({width,height,theme,passed:true});console.log(`PASS Activity ${engine} ${width} ${theme}`);await ctx.close();
}}finally{await browser.close();fs.writeFileSync(path.join(out,`results-${engine}.json`),JSON.stringify({engine,syntheticOnly:true,physicalIPhone:false,results},null,2));}
})().catch(e=>{console.error(e);process.exit(1)});
