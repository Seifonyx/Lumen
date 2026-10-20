// Focused provider intelligence regression. Synthetic state; deny all external traffic.
const {chromium,webkit}=require('playwright');
const AxeBuilder=require('@axe-core/playwright').default;
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {profile,seed}=require('../../../tests/e2e/helpers/preview-profile.cjs');
const {chats}=require('./fixture.cjs');
const direction=process.env.BLACKOUT_DIRECTION||'index',width=Number(process.env.BLACKOUT_WIDTH)||1440;
const engine=process.env.MR_WEBKIT?webkit:chromium;
const output=process.env.BLACKOUT_PROVIDER_OUTPUT||path.join(require('node:os').tmpdir(),'lumen-provider-intelligence');
const flash='gemini:gemini-flash-latest',pro='gemini:gemini-2.5-pro';
(async()=>{
 const browser=await engine.launch();
 try{
  fs.mkdirSync(output,{recursive:true});
  const owner=`preview-blackout-providers-${direction}-${width}-${engine.name()}`;
  const context=await browser.newContext({viewport:{width,height:width<900?844:960},isMobile:width<900,hasTouch:width<900,serviceWorkers:'block',reducedMotion:'reduce',timezoneId:'Africa/Cairo'});
  await profile(context,owner,'dark',{enabledModels:[flash,pro],defaultModel:'auto'});
  await context.addInitScript(()=>{window.__blackoutHarness=true;localStorage.setItem('mr.modelCheck.background',JSON.stringify(Date.now()));});
  let inference=0;const unexpected=[],blockedAuthSdkRequests=[];
  await context.route('**/*',route=>{
   const u=new URL(route.request().url());
   if(u.hostname==='localhost')return route.continue();
   if(u.hostname==='generativelanguage.googleapis.com'&&u.pathname.endsWith('/models'))return route.fulfill({json:{models:[{name:'models/gemini-flash-latest',displayName:'Gemini Flash',inputTokenLimit:128000,supportedGenerationMethods:['generateContent']},{name:'models/gemini-2.5-pro',displayName:'Gemini 2.5 Pro',inputTokenLimit:1048576,supportedGenerationMethods:['generateContent']}]}});
   if(u.hostname==='www.googleapis.com'||u.hostname==='identitytoolkit.googleapis.com')return route.fulfill({json:{projectId:'the-model-router',authorizedDomains:['localhost']}});
   if(/generateContent|chat\/completions|messages$/.test(u.pathname))inference++;
   // Existing Firebase watchUser calls getRedirectResult even for preview users.
   // WebKit initializes its redirect resolver with this SDK script. Deny it locally,
   // report every attempted load, and do not broaden the external allowlist.
   if(u.hostname==='apis.google.com'&&u.pathname==='/js/api.js'&&route.request().resourceType()==='script'){blockedAuthSdkRequests.push({host:u.hostname,path:u.pathname});return route.abort();}
   unexpected.push(u.hostname);return route.abort();
  });
  const page=await context.newPage(),errors=[],scans=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://localhost:5193/docs/blackout/workspace-proofs/?direction=${direction}`);
  await page.locator('.composer textarea').waitFor();await seed(page,owner,chats);await page.reload();await page.locator('.proof-navigation').waitFor();
  await page.evaluate(async({flash,pro})=>{
   const {useStore}=await import('/src/store.ts');
   const {normalizeKeys}=await import('/src/lib/ai/provider-config.js');
   const s=useStore.getState(),now=Date.now();
   const extra=(id,label)=>({id,provider:id.split(':')[0],name:id.split(':').slice(1).join(':'),label,context:32000,vision:false,pdf:false,search:false,thinking:false});
   useStore.setState({keys:normalizeKeys({...s.keys,aion:'fixture-only',openai:'fixture-only',mistral:'fixture-only',openrouter:'fixture-only',providerAccess:{aion:true,openai:false,mistral:true}}),catalog:{...s.catalog,models:[...s.catalog.models,extra('aion:aion-1','Aion 1'),extra('openai:gpt-fixture','GPT fixture'),extra('groq:cached-model','Cached Groq model'),extra('mistral:denied-model','Denied Mistral model'),extra('openrouter:one:free','Free model one'),extra('openrouter:two:free','Free model two')],providerStatus:{gemini:{state:'ready',lastAttempt:now,lastSuccess:now,nextRefresh:now+3600000},aion:{state:'stale',lastAttempt:now,lastSuccess:now-86400000,nextRefresh:now+3600000,errorKind:'network'},mistral:{state:'error',lastAttempt:now,lastSuccess:null,nextRefresh:now+3600000,errorKind:'auth'}}},settings:{...s.settings,enabledModels:[flash,pro,'aion:aion-1','openai:gpt-fixture','groq:cached-model','mistral:denied-model','openrouter:one:free','openrouter:two:free']},usage:{models:{[flash]:{id:flash,requests:3,input:1200,output:600,quota:10,blockedUntil:null,blockScope:null}},openrouter:{used:7,limit:20,resetAt:now+3600000},geminiResetAt:now+3600000}});
   useStore.getState().selectChat('launch');
  },{flash,pro});
  const draft='A provider roundtrip must keep this unsent draft.';
  const input=page.locator('.composer textarea');await input.fill(draft);
  const shot=async(name,capture=true)=>{
   await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${name}: horizontal overflow`);
   const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
   scans.push({state:name,violations:scan.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))});
   assert.deepEqual(scans.at(-1).violations,[],`${name}: accessibility`);
   if(capture&&!process.env.MR_WEBKIT)await page.screenshot({path:path.join(output,`${direction}-${width}-${name}.png`)});
  };
  const open=async(id)=>{await page.locator(`[data-provider-browse="${id}"]`).click();await page.getByRole('region',{name:'Provider detail',exact:true}).waitFor();};
  const back=async()=>{await page.getByRole('button',{name:'Back to providers',exact:true}).click();};
  await page.getByRole('button',{name:'Routing Center',exact:true}).click();
  const browserPanel=page.getByRole('region',{name:'Provider browser',exact:true});
  await browserPanel.getByRole('searchbox',{name:'Find a provider',exact:true}).waitFor({timeout:5000});
  assert.equal(await page.locator('[data-provider-browse]').count(),32,'all configured provider definitions, not four hardcoded rows');
  assert.equal(await page.locator('.proof-routing-summary').textContent().then(t=>t.includes('Remaining allowance is not reported.')),false,'numeric quota has no contradictory copy');
  await shot('providers');
  await browserPanel.getByRole('button',{name:'Filter providers: All providers',exact:true}).click();
  await page.keyboard.press('End');await page.keyboard.press('Enter');
  assert.equal(await page.locator('[data-provider-browse]').count(),4,'configured filter follows saved provider permissions');
  await browserPanel.getByRole('button',{name:'Filter providers: Configured',exact:true}).click();
  await page.keyboard.press('Home');await page.keyboard.press('Enter');
  assert.equal(await page.locator('[data-provider-browse]').count(),32);
  const search=browserPanel.getByRole('searchbox',{name:'Find a provider',exact:true});
  await search.fill('nothing-matches');await page.getByText('No providers match.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Clear provider search',exact:true}).click();assert.equal(await search.inputValue(),'');assert.equal(await search.evaluate(n=>n===document.activeElement),true);
  await open('aion');const detail=page.getByRole('region',{name:'Provider detail',exact:true});
  assert.match(await detail.textContent(),/Cached catalog/);assert.match(await detail.textContent(),/Key saved/);assert.match(await detail.textContent(),/Unknown/);
  assert.doesNotMatch(await detail.textContent(),/healthy|online|fixture-only/);
  await back();await open('openai');assert.match(await detail.textContent(),/Permission off/);assert.equal(await detail.getByRole('button',{name:'Use GPT fixture',exact:true}).isDisabled(),true);
  await back();await open('groq');assert.match(await detail.textContent(),/No key saved/);assert.equal(await detail.getByRole('button',{name:'Use Cached Groq model',exact:true}).isDisabled(),true);
  await shot('no-key',false);await back();await open('mistral');assert.match(await detail.textContent(),/Discovery failed/);assert.equal(await detail.getByRole('button',{name:'Use Denied Mistral model',exact:true}).isDisabled(),true);
  await back();await open('openrouter');assert.match(await detail.textContent(),/13 requests remaining/);assert.match(await detail.textContent(),/shared.*free models/i);assert.doesNotMatch(await detail.textContent(),/26 requests remaining/);
  await back();await open('baseten');assert.match(await detail.textContent(),/No catalog models/);assert.match(await detail.textContent(),/No key saved/);
  await back();await page.locator('[data-provider-browse=gemini]').focus();await page.keyboard.press('Enter');await detail.waitFor();assert.match(await detail.textContent(),/7 requests remaining/);assert.match(await detail.textContent(),/3 requests/);assert.match(await detail.textContent(),/Not established by discovery/);
  if(width>=900)await page.locator('.proof-routing').evaluate(node=>{const detail=node.querySelector('.proof-provider-detail');node.scrollTop=detail.getBoundingClientRect().top-node.getBoundingClientRect().top+node.scrollTop-20;});
  assert.equal(await detail.getByRole('heading',{name:'Google AI Studio',exact:true}).evaluate(n=>n===document.activeElement),true,'keyboard navigation focuses the provider heading');
  await detail.getByRole('heading',{name:'Google AI Studio',exact:true}).click(); // Pointer presentation after the separate keyboard/focus check.
  await shot('detail');
  await detail.getByText('About these counts',{exact:true}).click();await detail.getByText(/Token counts may include estimates/).waitFor();await detail.getByText('About these counts',{exact:true}).click();
  // Existing masked settings, without showing the synthetic key in screenshots.
  await detail.getByRole('button',{name:'Manage Google AI Studio connection',exact:true}).click();
  await page.getByLabel('Google AI Studio (Gemini) API key',{exact:true}).waitFor({timeout:5000});assert.equal(await page.getByLabel('Google AI Studio (Gemini) API key',{exact:true}).getAttribute('type'),'password');
  await page.locator('.settings-page').getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('region',{name:'Provider detail',exact:true}).waitFor();
  await detail.getByRole('button',{name:'Use Gemini 2.5 Pro',exact:true}).focus();await page.keyboard.press('Enter');
  await input.waitFor();assert.equal(await input.inputValue(),draft);assert.match(await page.locator('.composer .model-button').textContent(),/Gemini 2.5 Pro/);
  await page.getByRole('button',{name:'Routing Center',exact:true}).click();await open('gemini');
  // Account safety: replace account-scoped state with an empty new synthetic account.
  await page.evaluate(async()=>{const {useStore}=await import('/src/store.ts');const {normalizeKeys}=await import('/src/lib/ai/provider-config.js');useStore.setState({user:{uid:'preview-blackout-empty-account',name:'Empty fixture',email:'empty@local.invalid',photo:''},keys:normalizeKeys({}),catalog:null,usage:null,settings:{...useStore.getState().settings,enabledModels:[]}});});
  if(width<900)assert.equal(await detail.isVisible(),false,'old account detail selection is cleared');
  await open('gemini');assert.match(await page.locator('.proof-routing-summary').textContent(),/Unknown/);assert.match(await detail.textContent(),/No key saved/);assert.match(await detail.textContent(),/Not checked/);assert.match(await detail.textContent(),/Unknown/);assert.equal(await detail.getByRole('button',{name:/^Use /}).count(),0,'new account does not inherit model actions');
  await page.getByRole('button',{name:'Workspace',exact:true}).click();await input.waitFor();
  assert.equal(inference,0);assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
  const report={status:'passed',direction,width,engine:engine.name(),syntheticData:true,inferenceRequests:inference,blockedAuthSdkRequests,unexpectedExternalRequests:unexpected,pageErrors:errors,scans,limitations:['No real provider calls or physical iPhone','Catalog discovery does not prove inference','Synthetic account transition checks proof-local UI, not a live sign-in flow']};
  fs.writeFileSync(path.join(output,`${direction}-${width}-${engine.name()}.json`),JSON.stringify(report,null,2)+'\n');
  console.log('PASS providers',direction,width,engine.name(),scans.length,'axe scans');await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
