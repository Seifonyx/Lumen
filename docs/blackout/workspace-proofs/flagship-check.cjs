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
  const context=await browser.newContext({viewport:{width,height},isMobile:width<900,hasTouch:width<900,serviceWorkers:'block',reducedMotion:'reduce',timezoneId:'Africa/Cairo'});
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
  const shot=async state=>{
   phase=state;
   await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert(!overflow,`${direction} ${width} ${state}: document overflow`);
   const filename=`${direction}-${width}-${theme}-${engine.name()}-${state}.png`;
   const curated=['workspace','expanded-input','model-picker','usage-details','routing-center','attached-context'];if(curated.includes(state)){if(['workspace','expanded-input','attached-context'].includes(state))await input.evaluate(el=>el.blur());await page.mouse.move(2,2);await page.screenshot({path:path.join(out,filename)});screens.push(filename);}
   const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
   checks[state]=scan.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target),summaries:v.nodes.map(n=>n.failureSummary)}));
   fs.writeFileSync(path.join(out,`${direction}-${width}-${height}-${theme}-${engine.name()}.json`),JSON.stringify({status:'in progress',direction,width,theme,engine:engine.name(),syntheticData:true,realProviderCalls:0,mockedInferenceRequests,pageErrors:errors,checks,screens},null,2)+'\n');
   console.log(filename,JSON.stringify(checks[state].map(v=>v.id)));
  };
  await page.locator('.messages').evaluate(el=>el.scrollTop=0);await shot('workspace');
  if(width<900){await page.getByRole('button',{name:'Open chats',exact:true}).click();await shot('navigation');await page.getByRole('button',{name:'Close menu',exact:true}).click();}
  await input.fill(longDraft);await input.evaluate(el=>{el.focus();el.setSelectionRange(12,38,'backward');window.__originalInput=el;});
  await page.getByRole('button',{name:'Expand input',exact:true}).click();
  assert.deepEqual(await input.evaluate(el=>({same:el===window.__originalInput,text:el.value,start:el.selectionStart,end:el.selectionEnd,direction:el.selectionDirection,focused:el===document.activeElement})),{same:true,text:longDraft,start:12,end:38,direction:'backward',focused:true},'expansion preserves draft, DOM, selection and focus');
  const expandedBox=await input.boundingBox();assert(expandedBox.height>=(height<650?60:180),'expanded writing surface has usable height, not a collapsed row');assert(expandedBox.width>=240,'expanded input has readable measure');await input.evaluate(el=>{el.setSelectionRange(0,0);el.blur();});await shot('expanded-input');
  await input.focus();await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'Expand input',exact:true}).getAttribute('aria-expanded'),'false','Escape returns from writing mode');assert.equal(await input.inputValue(),longDraft);await page.getByRole('button',{name:'Expand input',exact:true}).click();
  // A long draft scrolls only its editor; Studio response scroll never moves the draft.
  const veryLong=Array.from({length:80},(_,i)=>`Paragraph ${i+1}: think carefully about the launch, its constraints and the audience.`).join('\n\n');
  await input.fill(veryLong);const beforeScroll=await page.locator('.messages').evaluate(el=>el.scrollTop);await input.evaluate(el=>el.scrollTop=300);assert((await input.evaluate(el=>el.scrollTop))>0);assert.equal(await page.locator('.messages').evaluate(el=>el.scrollTop),beforeScroll);await input.fill(longDraft);
  if(width<900){const oldSelection=await input.evaluate(el=>({start:el.selectionStart,end:el.selectionEnd}));await page.setViewportSize({width,height:480});const keyboardInput=await input.boundingBox(),keyboardFooter=await page.locator('.composer-bar').boundingBox();assert(keyboardInput.height>=60&&keyboardInput.y>=0,'simulated keyboard leaves a usable writing region');assert(keyboardFooter.y+keyboardFooter.height<=480,'simulated keyboard leaves actions visible');assert.equal(await input.inputValue(),longDraft);assert.deepEqual(await input.evaluate(el=>({start:el.selectionStart,end:el.selectionEnd})),oldSelection);await page.setViewportSize({width,height});}
  const formBox=await page.locator('.composer').boundingBox(),footerBox=await page.locator('.composer-bar').boundingBox();assert(expandedBox.y>=formBox.y&&expandedBox.y+expandedBox.height<=formBox.y+formBox.height+1,'expanded input remains contained by the composer');assert(footerBox.y+footerBox.height<=formBox.y+formBox.height+1,'expanded footer remains contained by the composer');
  if(direction==='studio'&&width<900){const wrapBox=await page.locator('.composer-wrap').boundingBox(),mainBox=await page.locator('.main').boundingBox();assert(wrapBox.height>=mainBox.height-54,'Studio expanded composing fills the available working area');assert(formBox.height>=wrapBox.height-23,'Studio form fills its expanded wrapper');}
  await page.getByRole('button',{name:'Collapse input',exact:true}).click();await input.fill(shortDraft);
  // Keyboard access and visible focus survive ordinary presentation cleanup.
  const expand=page.getByRole('button',{name:'Expand input',exact:true});await page.keyboard.press('Tab');await expand.focus();assert.equal(await expand.evaluate(el=>el.matches(':focus-visible')),true);await page.keyboard.press('Enter');assert.equal(await input.evaluate(el=>el===document.activeElement),true);await page.keyboard.press('Escape');
  if(direction==='index'&&width>=1150){const jump=page.getByRole('navigation',{name:'Answer outline'}).getByRole('button').last();await jump.focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'A week with a little structure');await page.locator('.messages').evaluate(el=>el.scrollTop=0);}
  if(direction==='studio'&&width>=900){await input.fill(veryLong);await input.evaluate(el=>el.scrollTop=200);await page.locator('.messages').evaluate(el=>el.scrollTop=200);assert.equal(await input.evaluate(el=>el.scrollTop),200);await input.fill(shortDraft);await page.locator('.messages').evaluate(el=>el.scrollTop=0);}
  assert.equal(await input.inputValue(),shortDraft,'keyboard and scroll roundtrip draft');
  const toolbar=page.getByRole('group',{name:'Message context',exact:true});
  await toolbar.getByRole('button',{name:'Search',exact:true}).click();assert.equal(await toolbar.getByRole('button',{name:'Search',exact:true}).getAttribute('aria-pressed'),'true');await toolbar.getByRole('button',{name:'Search',exact:true}).click();
  await toolbar.getByRole('button',{name:'Research',exact:true}).click();assert.equal(await toolbar.getByRole('button',{name:'Research',exact:true}).getAttribute('aria-pressed'),'true','Research control reflects canonical state');await toolbar.getByRole('button',{name:'Research',exact:true}).click();await page.getByRole('button',{name:'Turn off deep research',exact:true}).waitFor({state:'detached'});
  assert.equal(await input.inputValue(),shortDraft,'tools roundtrip draft');
  await toolbar.getByRole('button',{name:'Add context',exact:true}).click();await page.getByRole('dialog',{name:'Add to your message',exact:true}).waitFor();await shot('add-context');await page.keyboard.press('Escape');
  const chooser=page.waitForEvent('filechooser');await toolbar.getByRole('button',{name:'Attach a file',exact:true}).click();await (await chooser).setFiles({name:'Studio brief.txt',mimeType:'text/plain',buffer:Buffer.from('A synthetic studio brief. One clear offer, five conversations.')});
  await page.getByRole('button',{name:'Remove Studio brief.txt',exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('.proof-file-count')?.textContent==='1');await shot('attached-context');await page.getByRole('button',{name:'Remove Studio brief.txt',exact:true}).click();
  assert.equal(await input.inputValue(),shortDraft,'attachment roundtrip draft');
  await page.locator('.composer .model-button').click();await page.getByRole('searchbox',{name:'Search models',exact:true}).waitFor();await shot('model-picker');
  await page.getByRole('option').filter({hasText:'Gemini 2.5 Pro'}).click();await page.locator('.composer .model-button').filter({hasText:'Gemini 2.5 Pro'}).waitFor();
  assert.equal(await input.inputValue(),shortDraft,'manual selection preserves draft');
  await page.locator('.composer .model-button').click();await page.getByRole('option').filter({hasText:/^Auto/}).click();
  await page.locator('.composer .model-button').click();await page.getByRole('option').filter({hasText:'Launch writing'}).click();await page.locator('.composer .model-button').filter({hasText:'Launch writing'}).waitFor();
  assert.equal(await input.inputValue(),shortDraft,'Layout selection preserves draft');
  await page.evaluate(async()=>{const {useStore}=await import('/src/store.ts');const s=useStore.getState();window.__originalCatalog=s.catalog;window.__originalEnabled=s.settings.enabledModels;useStore.setState({catalog:{...s.catalog,models:s.catalog.models.map(m=>({...m,search:false}))},settings:{...s.settings,enabledModels:[]}});});
  assert.equal(await toolbar.getByRole('button',{name:'Research',exact:true}).isDisabled(),true);
  await page.evaluate(async()=>{const {useStore}=await import('/src/store.ts');useStore.setState({catalog:window.__originalCatalog,settings:{...useStore.getState().settings,enabledModels:window.__originalEnabled}});});
  await page.locator('.composer .usage-chip').click();await page.getByRole('dialog',{name:'Usage',exact:true}).waitFor();await shot('usage-details');
  await page.getByRole('button',{name:'Close usage',exact:true}).click();
  await page.evaluate(async(flash)=>{const {useStore}=await import('/src/store.ts');window.__originalUsage=useStore.getState().usage;useStore.setState({usage:{models:{[flash]:{id:flash,requests:3,input:1200,output:600,quota:10,blockedUntil:null,blockScope:null}},geminiResetAt:Date.now()+3600000}});},flash);
  await page.waitForFunction(()=>document.querySelector('.proof-usage-label')?.textContent?.includes('7 requests left · last model'));
  await page.evaluate(async()=>{const {useStore}=await import('/src/store.ts');useStore.setState({usage:window.__originalUsage});});
  await page.waitForFunction(()=>document.querySelector('.proof-usage-label')?.textContent?.includes('Allowance unknown'));
  await page.getByRole('button',{name:'Routing Center',exact:true}).click();await page.getByRole('main',{name:'Routing Center',exact:true}).waitFor();await shot('routing-center');
  await page.getByRole('button',{name:'Model inventory',exact:true}).click();await shot('model-inventory');
  await page.locator('.proof-model-row').first().getByRole('button',{name:/^Use /}).click();assert((await page.locator('.composer .model-button').textContent()).includes('Gemini Flash'));assert.equal(await input.inputValue(),shortDraft);
  await page.locator('.composer .model-button').click();await page.getByRole('option').filter({hasText:'Launch writing'}).click();await page.getByRole('button',{name:'Routing Center',exact:true}).click();
  await page.getByRole('button',{name:'Usage & quotas',exact:true}).click();await shot('routing-usage');
  await page.getByRole('button',{name:'Diagnostics',exact:true}).click();await shot('diagnostics');await page.locator('.proof-diagnostics .route-why-btn').click();await page.getByRole('dialog',{name:'Why this model',exact:true}).waitFor();await shot('route-explanation');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Policies & fallbacks',exact:true}).click();await shot('routing-policies');
  await page.getByRole('button',{name:'Edit Launch writing',exact:true}).click();await shot('fallback-editor');
  const down=page.getByRole('button',{name:'Move down',exact:true}).first();await down.click();
  await page.locator('.layout-editor select').nth(1).selectOption('none');
  await page.getByRole('button',{name:'Save layout',exact:true}).click();
  const order=await page.locator('.proof-policy-row ol li').allTextContents();assert(order[0].includes('Flash'),'saved fallback priority is changed by the real Layout editor');
  assert((await page.locator('.proof-policy-row').textContent()).includes('Fallback: None'),'fallback permissions saved through the real editor');await shot('fallback-saved');
  await page.getByRole('button',{name:'Overview',exact:true}).click();await page.getByRole('button',{name:'Connect a provider',exact:true}).click();
  await page.locator('.provider-connections').waitFor();await shot('provider-management');
  await page.locator('.provider-connection[data-provider="gemini"] summary').click();
  assert.equal(await page.getByLabel('Google AI Studio (Gemini) API key',{exact:true}).getAttribute('type'),'password','canonical key input stays masked');await shot('provider-connection');
  phase='close provider settings';await page.locator('.settings-page').getByRole('button',{name:'Close',exact:true}).click();
  phase='return to workspace';await page.getByRole('button',{name:'Workspace',exact:true}).click();await input.waitFor();
  assert.equal(await input.inputValue(),shortDraft,'routing/settings roundtrip preserves draft');
  assert((await page.locator('.composer .model-button').textContent()).includes('Launch writing'),'routing roundtrip preserves selection');
  assert.equal(mockedInferenceRequests,0,'navigation, usage and configuration never submit the draft');
  // No real provider is contacted. Hold one intercepted request to inspect the real Stop state.
  await page.getByRole('button',{name:'Send',exact:true}).click();await page.getByRole('button',{name:'Stop',exact:true}).waitFor();await shot('stop-state');
  await page.getByRole('button',{name:'Stop',exact:true}).click();releaseReply();
  await page.getByRole('button',{name:'Stop',exact:true}).waitFor({state:'detached'});
  assert.equal(mockedInferenceRequests,1,'only deliberate Send starts one synthetic request');
  await page.reload();await page.locator('.proof-navigation').waitFor();await page.getByRole('button',{name:'Routing Center',exact:true}).click();await page.getByRole('button',{name:'Policies & fallbacks',exact:true}).click();await page.getByRole('button',{name:'Edit Launch writing',exact:true}).click();
  assert((await page.locator('.layout-editor .model-list li').first().textContent()).includes('Gemini Flash'),'fallback priority survives reload');assert.equal(await page.locator('.layout-editor select').nth(1).inputValue(),'none','fallback scope survives reload');
  const report={status:'passed',direction,width,height,theme,blockedExternal,engine:engine.name(),syntheticData:true,realProviderCalls:0,mockedInferenceRequests,pageErrors:errors,checks,screens,limitations:['Linux engine/viewport checks, not a physical iPhone','No production imports or deployment','No live provider/quality/quota validation']};
  assert.deepEqual(errors,[],'browser page errors');for(const [state,violations] of Object.entries(checks))assert.deepEqual(violations,[],`${state}: accessibility`);
  fs.writeFileSync(path.join(out,`${direction}-${width}-${height}-${theme}-${engine.name()}.json`),JSON.stringify(report,null,2)+'\n');
  await context.close();console.log('PASS',direction,width,theme,engine.name());
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
