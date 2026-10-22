// Gate1 reconsideration captures: production Lumen and the two proposals, same synthetic account and states.
// TARGET=production|canvas|desk VIEW=desktop|phone PORT=5195 OUT=<dir> node docs/blackout/workspace-proofs/proposals/capture.cjs
// Proposal runs also check the contracts the proposals must keep: same textarea node, draft, selection and focus
// across expand/collapse; real picker and usage dialogs; one intercepted Send then Stop; no page errors/overflow.
const {chromium,webkit}=require('playwright');
const AxeBuilder=require('@axe-core/playwright').default;
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {profile,seed}=require('../../../../tests/e2e/helpers/preview-profile.cjs');
const {chats,projects}=require('./fixture.cjs');
const target=process.env.TARGET||'canvas',view=process.env.VIEW||'phone',phone=view==='phone';
const width=Number(process.env.WIDTH)||(phone?393:1440),height=Number(process.env.HEIGHT)||(phone?852:900);
const out=process.env.OUT||`/home/user/.lumen-verification/gate1-reconsideration/${target}`;
const engine=process.env.MR_WEBKIT?webkit:chromium,theme=process.env.THEME||'dark';
const IPHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const flash='gemini:gemini-flash-latest',pro='gemini:gemini-2.5-pro';
const layout={id:'launch-writing',name:'Launch writing',icon:'pen',description:'A focused writing route, with a deliberate backup.',models:[pro,flash],mode:'order',fallback:'layout',priority:'quality'};
const draft='Turn Monday into a practical checklist.\n\nKeep it realistic for one person with three hours, and tell me what you would leave out.';
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await engine.launch();
 const owner=`preview-blackout-proposal-${target}-${view}`;
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:phone?3:1,isMobile:phone,hasTouch:phone,...(phone?{userAgent:IPHONE}:{}),serviceWorkers:'block',reducedMotion:'reduce',timezoneId:'Africa/Cairo'});
 const blocked=[];
 await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname==='localhost')return r.continue();blocked.push(u.hostname);return r.abort();});
 await profile(context,owner,theme,{enabledModels:[flash,pro],defaultModel:'auto',messageNavigator:false,layouts:[layout],projects});
 await context.addInitScript(()=>{window.__blackoutHarness=true;localStorage.setItem('mr.modelCheck.background',JSON.stringify(Date.now()));});
 let release=()=>{},mocked=0;
 await context.route('**/generativelanguage.googleapis.com/**',async r=>{
  if(r.request().url().includes('/models?'))return r.fulfill({json:{models:[{name:'models/gemini-flash-latest',displayName:'Gemini Flash',inputTokenLimit:128000,supportedGenerationMethods:['generateContent']},{name:'models/gemini-2.5-pro',displayName:'Gemini 2.5 Pro',inputTokenLimit:1048576,supportedGenerationMethods:['generateContent']}]}});
  mocked++;await new Promise(res=>{release=res;});
  try{await r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({candidates:[{content:{parts:[{text:'Synthetic reply.'}]},finishReason:'STOP'}]})+'\n\n'});}catch{/* aborted by Stop */}
 });
 const page=await context.newPage(),errors=[],report={target,view,width,height,engine:engine.name(),theme,screens:[],checks:{},axe:{}};
 page.on('pageerror',e=>errors.push(e.message));
 const url=target==='production'?`http://localhost:${process.env.PORT||5195}/`:`http://localhost:${process.env.PORT||5195}/docs/blackout/workspace-proofs/?proposal=${target}`;
 await page.goto(url);await page.locator('.composer textarea').waitFor();
 await seed(page,owner,chats);await page.reload();await page.locator('.composer textarea').waitFor();
 await page.waitForFunction(async()=>{const {useStore}=await import('/src/store.ts');return useStore.getState().catalog?.models.some(m=>m.id==='gemini:gemini-2.5-pro')&&useStore.getState().chats.length>=7;});
 await page.evaluate(async()=>{const {useStore}=await import('/src/store.ts');useStore.getState().setUi({sidebarOpen:false});useStore.getState().selectChat('launch');});
 await page.getByText('Make the first week count.',{exact:true}).first().waitFor();
 const input=page.locator('.composer textarea');
 const settle=()=>page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
 const shot=async(name,axe=false)=>{
  await page.waitForTimeout(350);await settle();
  assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),`${name}: document overflow`);
  const file=`${target}-${view}-${name}.png`;await page.screenshot({path:path.join(out,file)});report.screens.push(file);
  if(axe){const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();report.axe[name]=scan.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}));}
 };
 const close=async()=>{await page.keyboard.press('Escape');await page.waitForTimeout(250);};
 await page.locator('.messages').evaluate(el=>el.scrollTop=0);
 await shot('conversation',true);
 // Navigation: where projects and conversations live.
 if(target==='production'){if(phone){await page.locator('.menu-btn').first().click();}await shot('navigation');if(phone)await page.locator('.scrim').click({position:{x:370,y:400}});}
 else{if(phone)await page.locator('[data-proposal-nav]').first().click();await page.locator('[data-proposal-space="trip"]').first().click();await shot('navigation',true);await page.locator('[data-proposal-space="'+(target==='desk'?'studio':'trip')+'"]').first().click();if(phone)await page.locator('[data-proposal-nav-close]').first().click();await page.waitForTimeout(300);}
 // Composer: engaged with a real multi-line draft.
 await input.click();await input.fill(draft);await input.evaluate(el=>{el.setSelectionRange(12,38,'forward');window.__input=el;});
 await shot('composer-draft');
 if(target!=='production'){
  await page.locator('[data-proposal-expand]').first().click();await page.waitForTimeout(400);
  report.checks.expand=await input.evaluate(el=>({same:el===window.__input,text:el.value,start:el.selectionStart,end:el.selectionEnd,focused:el===document.activeElement}));
  assert.deepEqual(report.checks.expand,{same:true,text:draft,start:12,end:38,focused:true},'expanded writing keeps node, draft, selection and focus');
  await input.evaluate(el=>el.blur());await shot('expanded',true);
  await input.focus();await page.keyboard.press('Escape');await page.waitForTimeout(300);
  report.checks.collapse=await input.evaluate(el=>({same:el===window.__input,text:el.value,start:el.selectionStart,end:el.selectionEnd}));
  assert.deepEqual(report.checks.collapse,{same:true,text:draft,start:12,end:38},'Escape returns with draft and selection');
 }
 await input.evaluate(el=>el.blur());
 // Model and context access through the real picker and UsageMeter.
 await page.locator('.composer .model-button').first().click();await page.getByRole('dialog',{name:'Choose a model'}).waitFor();await shot('model-picker');await close();
 await page.locator('.composer .usage-chip').first().click();await page.getByRole('dialog',{name:'Usage',exact:true}).waitFor();await shot('context');await page.getByRole('button',{name:'Close usage',exact:true}).click();
 // Composer at rest (empty) as most people see it.
 await input.fill('');await input.evaluate(el=>el.blur());await page.locator('.messages').evaluate(el=>el.scrollTop=el.scrollHeight);await shot('composer-rest');
 // One intercepted send, then the real Stop.
 if(target!=='production'){
  await input.fill('Synthetic proposal send.');await page.getByRole('button',{name:'Send',exact:true}).click();
  await page.getByRole('button',{name:'Stop',exact:true}).waitFor();await page.getByRole('button',{name:'Stop',exact:true}).click();release();
  await page.getByRole('button',{name:'Stop',exact:true}).waitFor({state:'detached'});
  report.checks.sendStop={mocked};assert.equal(mocked,1,'exactly one intercepted send');
 }
 report.pageErrors=errors;report.blockedExternal=[...new Set(blocked)];report.realProviderCalls=0;
 assert.equal(errors.length,0,'no page errors: '+errors.join(' | '));
 report.status='passed';fs.writeFileSync(path.join(out,`${target}-${view}.json`),JSON.stringify(report,null,1)+'\n');
 console.log('PASS',target,view,width+'x'+height,engine.name(),'axe',Object.values(report.axe).flat().length,'violations');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
