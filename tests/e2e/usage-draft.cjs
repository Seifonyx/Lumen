// Opening/dismissing usage must never submit the composer or clear its draft.
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const {profile,seed}=require('./helpers/preview-profile.cjs');
(async()=>{
 const engine=process.env.MR_WEBKIT?webkit:chromium,browser=await engine.launch();
 try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<900,hasTouch:width<900,serviceWorkers:'block',reducedMotion:'reduce'});
  const owner=`preview-usage-draft-${width}`,draft='Keep this draft until I explicitly send it.';
  await profile(context,owner,'dark');let unintendedRequests=0;
  await context.route('**/generativelanguage.googleapis.com/**',route=>{
   if(route.request().url().includes('/models?'))return route.fulfill({json:{models:[{name:'models/gemini-flash-latest',displayName:'Gemini Flash',inputTokenLimit:128000,supportedGenerationMethods:['generateContent']}]}});
   unintendedRequests++;return route.abort();
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.MR_TEST_URL||'http://localhost:5190/');await page.locator('.composer textarea').waitFor();
  await seed(page,owner,[{id:'usage-draft',title:'Usage draft regression',createdAt:1,updatedAt:2,model:'gemini:gemini-flash-latest',messages:[{id:'q',role:'user',text:'An existing question.',createdAt:1},{id:'a',role:'assistant',text:'An existing answer.',model:'gemini:gemini-flash-latest',status:'done',createdAt:2}]}]);
  await page.reload();await page.locator('.composer textarea').waitFor();if(width<900)await page.getByRole('button',{name:'Open chats',exact:true}).click();
  await page.getByRole('button',{name:'Usage draft regression',exact:true}).click();
  const input=page.locator('.composer textarea');await input.fill(draft);
  const count=await page.locator('[data-message-id]').count();
  for(const interaction of ['pointer','keyboard']){
   const trigger=page.locator('.composer .usage-chip');
   if(interaction==='pointer')await trigger.click();else{await trigger.focus();await page.keyboard.press('Enter');}
   await page.getByRole('dialog',{name:'Usage',exact:true}).waitFor();
   assert.equal(await input.inputValue(),draft,`${interaction}: opening usage preserves the draft`);
   await page.getByRole('button',{name:'Close usage',exact:true}).click();
   await page.getByRole('dialog',{name:'Usage',exact:true}).waitFor({state:'detached'});
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   assert.equal(await input.inputValue(),draft,`${interaction}: closing usage preserves the draft`);
   assert.equal(await page.locator('[data-message-id]').count(),count,'no unsolicited conversation message');
   assert.equal(unintendedRequests,0,'usage controls do not issue inference requests');
   assert.equal(await trigger.evaluate(node=>node===document.activeElement),true,'usage trigger regains focus');
  }
  assert.deepEqual(errors,[]);await context.close();console.log('PASS usage draft isolation',engine.name(),width);
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
