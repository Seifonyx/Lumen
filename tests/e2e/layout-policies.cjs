const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const {profile}=require('./helpers/preview-profile.cjs');
const base=process.env.MR_TEST_URL || 'http://localhost:5190/';
const a='openrouter:vendor/primary:free',b='openrouter:vendor/backup:free',g='gemini:gemini-flash-latest',pro='gemini:gemini-2.5-pro';
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
async function settings(page,width) {
 if(width<900)await page.locator('.menu-btn').click();
 await page.locator('.sidebar-foot').click();
 await page.locator('.settings-tabs').getByRole('button',{name:'Models',exact:true}).click();
 await page.getByRole('button',{name:'Layouts',exact:true}).click();
}
(async()=>{
 const browser=await(process.env.MR_WEBKIT?webkit:chromium).launch();
 try {for(const width of [390,1280])for(const mode of ['order','layout','none','enabled','saved-requirements']) {
  const context=await browser.newContext({viewport:{width,height:860},isMobile:width<900,hasTouch:width<900,serviceWorkers:'block'});
  const uid=`preview-layout-policy-${width}-${mode}`,requests=[],errors=[];
  const layout={id:'fixed-policy',name:'Policy layout',icon:'layers',description:'Fixed assignments',mode:'order',models:mode==='order'||mode==='none'?[a,b,g]:[a],fallback:mode==='order'?'layout':mode};
  await profile(context,uid,'dark',{enabledModels:[a,b,g,pro],defaultModel:mode==='saved-requirements'?'auto':'layout:fixed-policy',autoSwitch:true,layouts:mode==='saved-requirements'?[]:[layout]},{openrouterKey:'fixture-or'});
  let downgraded=false;
  await context.route('**/openrouter.ai/**',r=>{
   if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:cors});
   if(r.request().url().endsWith('/models'))return r.fulfill({headers:cors,json:{data:[a,b].map(id=>({id:id.slice(11),name:id===a?'Primary':'Backup',context_length:128000,pricing:{prompt:'0',completion:'0'},architecture:{input_modalities:['text'],output_modalities:['text']}}))}});
   if(r.request().url().endsWith('/key'))return r.fulfill({headers:cors,json:{data:{is_free_tier:true}}});
   const id='openrouter:'+r.request().postDataJSON().model;requests.push(id);
   return id===a?r.fulfill({status:503,headers:cors,json:{error:{message:'Controlled outage'}}}):r.fulfill({headers:cors,contentType:'text/event-stream',body:'data: '+JSON.stringify({choices:[{delta:{content:'ORDERED_BACKUP'}}]})+'\n\ndata: [DONE]\n\n'});
  });
  await context.route('**/generativelanguage.googleapis.com/**',r=>{
   if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:cors});
   if(r.request().url().includes('/models?'))return r.fulfill({headers:cors,json:{models:[{name:'models/gemini-flash-latest',displayName:'Flash',inputTokenLimit:64000,supportedGenerationMethods:['generateContent']},{name:'models/gemini-2.5-pro',displayName:'Large Pro',inputTokenLimit:downgraded?16000:262144,supportedGenerationMethods:['generateContent']}]}});
   requests.push(`gemini:${/models\/([^:]+):/.exec(r.request().url())[1]}`);
   return r.fulfill({headers:cors,contentType:'text/event-stream',body:'data: '+JSON.stringify({candidates:[{content:{parts:[{text:'WRONG_OUTSIDE_BACKUP'}]},finishReason:'STOP'}]})+'\n\n'});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.locator('.composer textarea').waitFor();
  if(mode==='saved-requirements') {
   await settings(page,width);
   await page.getByRole('button',{name:'Build for a task'}).click();
   await page.getByLabel('Describe the work').fill('Review code with a 200k token context');
   await page.getByRole('button',{name:'Build',exact:true}).click();
   await page.locator('.builder-picks li').filter({hasText:'Large Pro'}).waitFor();
   await page.locator('.builder-name input').fill('Large context');
   await page.getByLabel('Use it for new chats').check();
   await page.getByRole('button',{name:'Save layout',exact:true}).click();
   const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('mr.settings')).layouts.at(-1));
   assert.equal(saved.requirements.minContext,200000);assert.deepEqual(saved.models,[pro]);
   await page.getByRole('button',{name:'Edit Large context',exact:true}).click();
   await page.getByLabel('Layout fallback models').selectOption('layout');
   await page.getByLabel('Layout routing priority').selectOption('quality');
   await page.locator('.layout-requirements summary').click();
   await page.getByRole('checkbox',{name:'Images',exact:true}).check();
   await page.getByRole('checkbox',{name:'Images',exact:true}).uncheck();
   await page.getByLabel('Minimum context (tokens)').fill('0');
   assert(await page.getByRole('button',{name:'Save layout',exact:true}).isDisabled());
   await page.getByLabel('Minimum context (tokens)').fill('200000');
   await page.locator('.layout-editor fieldset').scrollIntoViewIfNeeded();
   await page.screenshot({path:`tests/e2e/out/layout-editor-policy-${process.env.MR_WEBKIT?'webkit':'chromium'}-${width}.png`});
   await page.getByRole('button',{name:'Save layout',exact:true}).click();
   await page.screenshot({path:`tests/e2e/out/layout-policy-${process.env.MR_WEBKIT?'webkit':'chromium'}-${width}.png`});
   downgraded=true;await page.reload();await page.locator('.composer textarea').waitFor();
   await page.waitForFunction(uid=>JSON.parse(localStorage.getItem(`mr.catalog.v2.${uid}`)||'null')?.value.models.some(m=>m.id==='gemini:gemini-2.5-pro'&&m.context===16000),uid);
   await page.locator('.composer textarea').fill('Review this small code change');await page.getByRole('button',{name:'Send',exact:true}).click();
   await page.locator('.error-msg').filter({hasText:/saved requirements/}).first().waitFor();
   assert.deepEqual(requests,[],'a model downgrade cannot weaken stored requirements or escape layout-only fallback');
   const current=await page.evaluate(()=>JSON.parse(localStorage.getItem('mr.settings')).layouts.at(-1));
   assert.equal(current.requirements.minContext,200000);assert.equal(current.fallback,'layout');assert.equal(current.priority,'quality');assert.deepEqual(current.models,[pro]);
   await page.locator('.model-button').click();
   const entry=page.locator('.mp-layout').filter({hasText:'Large context'});
   await entry.waitFor();assert.match(await entry.textContent(),/0 available.*1 unavailable/,'unavailable saved layouts stay visible with accurate status');
  } else {
   await page.locator('.composer textarea').fill('Hello');await page.getByRole('button',{name:'Send',exact:true}).click();
   if(mode==='order'||mode==='enabled') {await page.getByText('ORDERED_BACKUP',{exact:true}).waitFor();assert.deepEqual(requests,[a,b]);}
   else {await page.locator('.error-msg').filter({hasText:/No model could answer/}).first().waitFor();assert.deepEqual(requests,[a],'no unauthorized fallback request');}
  }
  assert.deepEqual(errors,[]);console.log(`PASS layout policy ${process.env.MR_WEBKIT?'webkit':'chromium'} ${width}px ${mode}`);await context.close();
 }} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
