const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const {profile}=require('./helpers/preview-profile.cjs');
const base=process.env.MR_TEST_URL || 'http://localhost:5190/';
const lite='gemini:gemini-flash-lite-latest',pro='gemini:gemini-2.5-pro',free='openrouter:vendor/general:free';
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
(async()=>{
 const browser=await(process.env.MR_WEBKIT?webkit:chromium).launch();
 try {for(const width of [390,1280])for(const priority of ['quality','speed','cost','prompt-override']) {
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<900,hasTouch:width<900,serviceWorkers:'block'});
  const uid=`preview-priority-${width}-${priority}`,requests=[],errors=[];
  await profile(context,uid,'dark',{enabledModels:[lite,pro,free],defaultModel:'auto',autoSwitch:false},{openrouterKey:'fixture-or'});
  await context.route('**/openrouter.ai/**',r=>{
   if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:cors});
   if(r.request().url().endsWith('/models'))return r.fulfill({headers:cors,json:{data:[{id:free.slice(11),name:'Known free model',context_length:128000,pricing:{prompt:'0',completion:'0'},architecture:{input_modalities:['text'],output_modalities:['text']}}]}});
   if(r.request().url().endsWith('/key'))return r.fulfill({headers:cors,json:{data:{is_free_tier:true}}});
   requests.push(free);return r.fulfill({headers:cors,contentType:'text/event-stream',body:'data: '+JSON.stringify({choices:[{delta:{content:'PRIORITY_REPLY'}}]})+'\n\ndata: [DONE]\n\n'});
  });
  await context.route('**/generativelanguage.googleapis.com/**',r=>{
   if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:cors});
   if(r.request().url().includes('/models?'))return r.fulfill({headers:cors,json:{models:[lite,pro].map(id=>({name:`models/${id.slice(7)}`,displayName:id===pro?'Pro':'Flash Lite',inputTokenLimit:128000,supportedGenerationMethods:['generateContent']}))}});
   requests.push(`gemini:${/models\/([^:]+):/.exec(r.request().url())[1]}`);return r.fulfill({headers:cors,contentType:'text/event-stream',body:'data: '+JSON.stringify({candidates:[{content:{parts:[{text:'PRIORITY_REPLY'}]},finishReason:'STOP'}]})+'\n\n'});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.locator('.composer textarea').waitFor();
  if(width<900)await page.locator('.menu-btn').click();
  await page.locator('.sidebar-foot').click();
  await page.locator('.settings-tabs').getByRole('button',{name:'Models',exact:true}).click();
  await page.getByLabel('Routing priority',{exact:true}).selectOption(priority==='prompt-override'?'quality':priority);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mr.settings')).routingPreference),priority==='prompt-override'?'quality':priority);
  if(priority==='quality')await page.screenshot({path:`tests/e2e/out/routing-priority-${process.env.MR_WEBKIT?'webkit':'chromium'}-${width}.png`});
  await page.locator('.settings-page [aria-label="Close"]').click();
  await page.locator('.composer textarea').fill(priority==='prompt-override'?'Use the cheapest available model to write an email':'Hello');
  await page.locator('.send-btn').click();await page.getByText('PRIORITY_REPLY',{exact:true}).waitFor();
  assert.deepEqual(requests,[priority==='quality'?pro:priority==='speed'?lite:free]);
  await page.locator('.route-why-btn').click();
  assert.match(await page.getByRole('dialog',{name:'Why this model'}).textContent(),/estimated|reported|unknown/i);
  assert.deepEqual(errors,[]);console.log(`PASS routing priority ${process.env.MR_WEBKIT?'webkit':'chromium'} ${width}px ${priority}`);
  await context.close();
 }} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
