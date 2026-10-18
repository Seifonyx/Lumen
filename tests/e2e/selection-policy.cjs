const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const {profile,seed}=require('./helpers/preview-profile.cjs');
const base=process.env.MR_TEST_URL || 'http://localhost:5190/';
const coder='openrouter:vendor/coder:free',vision='gemini:gemini-flash-latest';
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
(async()=>{
 const browser=await(process.env.MR_WEBKIT?webkit:chromium).launch();
 try {for(const width of [390,1280])for(const mode of ['manual-locked','layout-locked','layout-primary-missing','excluded-all','authorized-switch']) {
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<900,hasTouch:width<900,serviceWorkers:'block'});
  const uid=`preview-policy-${width}-${mode}`,requests=[],errors=[];
  const layout={id:'fixed',name:'Fixed order',icon:'layers',description:'Fixed order',mode:'order',models:mode==='layout-primary-missing'?['openrouter:missing',vision]:[coder,vision]};
  const selected=mode.startsWith('layout')?'layout:fixed':mode==='excluded-all'?'auto':coder;
  await profile(context,uid,'dark',{enabledModels:[coder,vision],defaultModel:selected,autoSwitch:mode==='authorized-switch',layouts:[layout],autoExcluded:mode==='excluded-all'?[coder,vision]:[]},{openrouterKey:'fixture-or'});
  await context.route('**/openrouter.ai/**',async r=>{
   const url=r.request().url();if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:cors});
   if(url.endsWith('/models'))return r.fulfill({headers:cors,json:{data:[{id:coder.slice(11),name:'Text coder',context_length:64000,pricing:{prompt:'0',completion:'0'},architecture:{input_modalities:['text'],output_modalities:['text']}}]}});
   if(url.endsWith('/key'))return r.fulfill({headers:cors,json:{data:{is_free_tier:true}}});
   requests.push(coder);return r.fulfill({headers:cors,status:500,json:{error:{message:'Text model must not receive this image'}}});
  });
  await context.route('**/generativelanguage.googleapis.com/**',r=>{
   if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:cors});
   if(r.request().url().includes('/models?'))return r.fulfill({headers:cors,json:{models:[{name:'models/gemini-flash-latest',displayName:'Vision',inputTokenLimit:128000,supportedGenerationMethods:['generateContent']}]}});
   requests.push(vision);return r.fulfill({headers:cors,contentType:'text/event-stream',body:'data: '+JSON.stringify({candidates:[{content:{parts:[{text:'AUTHORIZED_REPLY'}]},finishReason:'STOP'}]})+'\n\n'});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL('privacy.html',base).href);
  await seed(page,uid,[{id:'policy',title:'Policy test',model:selected,createdAt:1,updatedAt:2,messages:[{id:'photo',role:'user',text:'A photo',createdAt:1,files:[{id:'image',kind:'image',name:'photo.png',mime:'image/png',size:10,data:'iVBORw0KGgo='}]},{id:'ready',role:'assistant',text:'Ready.',createdAt:2,model:vision,status:'done'}]}]);
  await page.goto(base);await page.locator('.composer textarea').waitFor();
  if(width<900)await page.locator('.menu-btn').click();
  await page.locator('.chat-open').filter({hasText:'Policy test'}).click();
  await page.locator('.composer textarea').fill('Describe the photo');
  assert.equal(await page.locator('.composer textarea').inputValue(),'Describe the photo','rapid chat selection preserves the first input');
  await page.getByRole('button',{name:'Send',exact:true}).click();
  if(mode==='authorized-switch') {
   await page.getByText('AUTHORIZED_REPLY',{exact:true}).waitFor();
   assert.deepEqual(requests,[vision]);
   assert((await page.locator('.notice').allTextContents()).some(t=>/using Vision/.test(t)),'authorized substitution is disclosed');
  } else {
   const error=page.locator('.error-msg').filter({hasText:mode==='excluded-all'?/excluded/i:/switching is off/i});
   await error.first().waitFor();assert.deepEqual(requests,[],'no inference call or unauthorized replacement');
  }
  await page.getByRole('button',{name:'Stop',exact:true}).waitFor({state:'detached'});
  const settings=await page.evaluate(()=>JSON.parse(localStorage.getItem('mr.settings')));
  assert.equal(settings.defaultModel,selected,'the explicit default persists');
  assert.deepEqual(settings.layouts,[layout],'fixed layout assignments persist');
  assert.deepEqual(errors,[]);console.log(`PASS selection policy ${process.env.MR_WEBKIT?'webkit':'chromium'} ${width}px ${mode}`);
  await context.close();
 }} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
