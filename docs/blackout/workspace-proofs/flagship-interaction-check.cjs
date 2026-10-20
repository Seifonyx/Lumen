const {chromium,webkit}=require('playwright');
const AxeBuilder=require('@axe-core/playwright').default;
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {profile,seed}=require('../../../tests/e2e/helpers/preview-profile.cjs');
const {chats}=require('./fixture.cjs');
const direction=process.env.BLACKOUT_DIRECTION||'index',width=Number(process.env.BLACKOUT_WIDTH)||1440,theme=process.env.BLACKOUT_THEME||'dark';
const engine=process.env.MR_WEBKIT?webkit:chromium;
const out=process.env.BLACKOUT_OUTPUT||'/workspace/.lumen-verification/flagship-2026-10-20';
const height=Number(process.env.BLACKOUT_HEIGHT)||(width<900?844:960);
const flash='gemini:gemini-flash-latest',pro='gemini:gemini-2.5-pro';
const layout={id:'launch-writing',name:'Launch writing',icon:'pen',description:'A focused writing route, with a deliberate backup.',models:[pro,flash],mode:'order',fallback:'layout',priority:'quality'};
const shortDraft='Turn Monday into a practical checklist.';
const longDraft='Turn Monday into a practical checklist.\n\nI want the launch to feel deliberate. Help me shape one clear offer, choose the work worth showing, and write a useful introduction.\n\nKeep the plan realistic for one person. I have three hours on Monday and a small existing portfolio.\n\nBefore drafting the page, tell me what you would leave out. Make the tradeoffs clear.\n\nFinish with five specific things I can do before lunch.';
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await engine.launch();
 try{
  const owner=`preview-blackout-correction-${direction}-${width}-${theme}`;
  const context=await browser.newContext({viewport:{width,height},isMobile:width<900,hasTouch:width<900,serviceWorkers:'block',reducedMotion:'no-preference',timezoneId:'Africa/Cairo'});
  const blockedExternal=[];
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname==='localhost')return route.continue();blockedExternal.push(u.hostname+u.pathname);return route.abort();});
  await profile(context,owner,theme,{enabledModels:[flash,pro],defaultModel:'auto',messageNavigator:false,layouts:[layout]});
  // Isolate visual/configuration flows from the existing weekly model probe.
  // This fixture is not evidence that production has no scheduled probes.
  await context.addInitScript(()=>{window.__blackoutHarness=true;localStorage.setItem('mr.modelCheck.background',JSON.stringify(Date.now()));});
  let mockedInferenceRequests=0,releaseReply=()=>{},phase='startup';
  await context.route('**/generativelanguage.googleapis.com/**',async route=>{
   if(!route.request().url().includes('/models?')){
    mockedInferenceRequests++;
    console.log('MOCK REQUEST',phase,new URL(route.request().url()).pathname);
    await new Promise(resolve=>{releaseReply=resolve;});
    try{await route.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({candidates:[{content:{parts:[{text:'Synthetic reply.'}]},finishReason:'STOP'}]})+'\n\n'});}catch{ /* Expected if Stop aborted this locally mocked request. */ }
    return;
   }
   return route.fulfill({json:{models:[{name:'models/gemini-flash-latest',displayName:'Gemini Flash',inputTokenLimit:128000,supportedGenerationMethods:['generateContent']},{name:'models/gemini-2.5-pro',displayName:'Gemini 2.5 Pro',inputTokenLimit:1048576,supportedGenerationMethods:['generateContent']}]}});
  });
  const page=await context.newPage(),errors=[],checks={},screens=[];
  page.on('pageerror',e=>errors.push(e.message));
  const url=`http://localhost:5193/docs/blackout/workspace-proofs/?direction=${direction}`;
  await page.goto(url);await page.locator('.composer textarea').waitFor();
  await seed(page,owner,chats);await page.reload();await page.locator('.proof-navigation').waitFor();
  if(width<900&&direction==='studio')await page.getByRole('button',{name:'Open chats',exact:true}).click();
  else await page.getByRole('button',{name:'Conversations',exact:true}).click();
  await page.getByRole('button',{name:'A launch worth remembering',exact:true}).click();
  const input=page.locator('.composer textarea');
  await page.waitForFunction(async()=>{const {useStore}=await import('/src/store.ts');return useStore.getState().catalog?.models.some(m=>m.id==='gemini:gemini-2.5-pro');});await input.fill(shortDraft);
  await page.getByText('Make the first week count.',{exact:true}).waitFor();

  await page.getByRole('button',{name:'Expand input',exact:true}).click();
  assert.equal(await page.locator('.proof-writing-head').evaluate(el=>getComputedStyle(el).animationName),'proof-writing-enter');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.proof-writing-head').evaluate(el=>getComputedStyle(el).animationName),'none');
  const prefill='A carefully prepared prompt from an existing tool.';
  await page.evaluate(text=>window.dispatchEvent(new CustomEvent('mr:prefill',{detail:text})),prefill);
  await page.waitForFunction(text=>document.querySelector('.composer textarea').value===text,prefill);
  await page.waitForFunction(()=>document.querySelector('.proof-writing-head>span').textContent==='8 words');
  const tools=page.getByRole('group',{name:'Message context'});
  await tools.getByRole('button',{name:'Research',exact:true}).click();
  await page.getByRole('button',{name:'Turn off deep research',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[aria-label=Research]').getAttribute('aria-pressed')==='false');
  // Stress the intermediate WebKit draft-loss assertion with stable source and no sleeps.
  for(const name of ['Gemini 2.5 Pro','Auto','Launch writing','Gemini Flash','Auto','Launch writing','Gemini 2.5 Pro','Auto']){await page.locator('.composer .model-button').click();await page.getByRole('option').filter({hasText:name==='Auto'?/^Auto/:name}).click();assert.equal(await input.inputValue(),prefill,'rapid model switching retains the prepared draft');}
  await input.evaluate(el=>{el.focus();el.setSelectionRange(2,19,'forward');});
  await page.getByRole('button',{name:'Collapse input',exact:true}).click();
  assert.deepEqual(await input.evaluate(el=>({text:el.value,start:el.selectionStart,end:el.selectionEnd,dir:el.selectionDirection})),{text:prefill,start:2,end:19,dir:'forward'});
  await page.getByRole('button',{name:'Conversation intelligence',exact:true}).click();
  await page.getByRole('dialog',{name:'Conversation intelligence',exact:true}).waitFor();
  assert((await page.locator('.proof-context-details').textContent()).includes('Estimates are not provider billing.'));
  await page.keyboard.press('Escape');
  const result={status:'passed',direction,width,engine:engine.name(),motion:'normal entrance and reduced-motion disable verified',canonicalPrefill:true,rapidModelSwitches:8,researchExternalRemoval:true,forwardSelection:true,contextDialog:true,pageErrors:errors,mockedInferenceRequests};
  assert.deepEqual(errors,[]);assert.equal(mockedInferenceRequests,0);
  fs.writeFileSync(path.join(out,`${direction}-${width}-${engine.name()}-interactions.json`),JSON.stringify(result,null,2)+'\n');
  console.log(result);await context.close();
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
