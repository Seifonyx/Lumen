const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const {profile}=require('./helpers/preview-profile.cjs');
(async()=>{
 const engine=process.env.MR_WEBKIT?webkit:chromium,browser=await engine.launch();
 try {
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const declared='gemini:gemini-unknown-custom',native='gemini:gemini-flash-latest',calls=[];
  await profile(context,'preview-declared-background','dark',{enabledModels:[native,declared],modelDeclarations:[{id:declared,provider:'gemini',name:'gemini-unknown-custom',endpoint:'https://generativelanguage.googleapis.com/v1beta',context:128000}]});
  await context.route('**/generativelanguage.googleapis.com/**',route=>{
   if(route.request().url().includes('/models?'))return route.fulfill({json:{models:[{name:'models/gemini-flash-latest',inputTokenLimit:128000,supportedGenerationMethods:['generateContent']}]}});
   calls.push(route.request().url());return route.fulfill({json:{candidates:[{content:{parts:[{text:'OK'}]},finishReason:'STOP'}]}});
  });
  const page=await context.newPage();await page.clock.install();await page.goto(process.env.MR_TEST_URL||'http://localhost:5190/');await page.locator('.composer textarea').waitFor();
  await page.locator('.model-button').click();await page.locator('.mp-item').filter({hasText:'gemini-unknown-custom'}).waitFor();await page.keyboard.press('Escape');
  await page.clock.fastForward(31_000);
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('mr.modelCheck.seen')||'{}')['gemini:gemini-flash-latest']);
  assert.equal(calls.filter(url=>url.includes('gemini-unknown-custom:')).length,0,'automatic weekly diagnostics cannot spend requests on unchecked user declarations');
  assert.equal(calls.filter(url=>url.includes('gemini-flash-latest:')).length,1,'existing API-discovered weekly health check still runs');
  await page.locator('.menu-btn').click();await page.locator('.sidebar-foot').click();await page.locator('.settings-tabs').getByRole('button',{name:'Models',exact:true}).click();
  await page.getByRole('button',{name:'Check models',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Check models',exact:true});await dialog.getByRole('button',{name:'Start check',exact:true}).click();
  await dialog.getByText('Check complete',{exact:true}).waitFor();
  assert.equal(calls.filter(url=>url.includes('gemini-unknown-custom:')).length,1,'an explicit user-requested diagnostic can check declared models');
  console.log(`PASS ${engine.name()} unchecked declarations skip automatic probes but explicit checks remain available`);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
