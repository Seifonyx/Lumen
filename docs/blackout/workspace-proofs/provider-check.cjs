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
  const context=await browser.newContext({viewport:{width,height:width<900?844:960},isMobile:width<900,hasTouch:width<900,serviceWorkers:'block',reducedMotion:'reduce',locale:'en-GB',timezoneId:'Pacific/Honolulu'});
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
  await page.waitForFunction(async()=>{const {useStore}=await import('/src/store.ts');return useStore.getState().catalog?.models.some(m=>m.id==='gemini:gemini-flash-latest');});
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
   if(name!=='keyboard-focus')await page.mouse.move(width-2,2);
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   if(['overview','providers'].includes(name)){
    const head=await page.locator('.proof-routing-head h1').boundingBox(),frame=await page.locator('.proof-routing').boundingBox();
    assert(head.y>=frame.y&&head.y+head.height<=frame.y+frame.height,'Routing Center heading remains visible in presentation captures');
   }
   if(capture&&!process.env.MR_WEBKIT)await page.screenshot({path:path.join(output,`${direction}-${width}-${name}.png`)});
  };
  const open=async(id)=>{await page.locator(`[data-provider-browse="${id}"]`).click();await page.getByRole('region',{name:'Provider detail',exact:true}).waitFor();};
  const back=async()=>{if(width<900)await page.getByRole('button',{name:'Back to providers',exact:true}).click();};
  await page.getByRole('button',{name:'Routing Center',exact:true}).click();
  const browserPanel=page.getByRole('region',{name:'Provider browser',exact:true});
  await page.getByRole('main',{name:'Routing Center',exact:true}).waitFor();
  assert.equal(await page.locator('[data-provider-browse]').count(),32,'all configured provider definitions, not four hardcoded rows');
  assert.equal(await page.locator('.proof-routing-summary').textContent().then(t=>t.includes('Remaining allowance is not reported.')),false,'numeric quota has no contradictory copy');
  await shot('overview');
  if(width<900){
   const nav=page.getByRole('navigation',{name:'Routing sections',exact:true});
   for(const b of await nav.getByRole('button').all())assert.equal(await b.evaluate(n=>n.scrollWidth<=n.clientWidth+1),true,'routing labels are not clipped');
   assert.equal(await nav.evaluate(n=>n.scrollWidth<=n.clientWidth+1),true,'all routing sections are visible without horizontal discovery');
   const summary=page.locator('.proof-routing-summary');
   assert.equal(await summary.locator('p').evaluateAll(ns=>ns.every(n=>parseFloat(getComputedStyle(n).fontSize)>=12)),true,'important summary explanations remain readable');
  }
  await page.locator('.proof-routing').evaluate(n=>{n.scrollTop=100;});
  await page.getByRole('navigation',{name:'Routing sections'}).getByRole('button',{name:'Providers',exact:true}).click();
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  assert.equal(await page.locator('.proof-routing').evaluate(n=>n.scrollTop),0,'section changes begin at the top');
  await shot('providers');
  if(width>=900){assert.match(await page.getByRole('region',{name:'Provider detail',exact:true}).textContent(),/Google AI Studio/,'default follows the conversation, not alphabetical Aion');assert.equal(await page.getByRole('button',{name:'Back to providers',exact:true}).count(),0,'desktop has no redundant Back');}

  await browserPanel.getByRole('button',{name:'Filter providers: All providers',exact:true}).click();
  await page.getByRole('menuitemradio',{name:/Saved connections/}).click();
  assert.equal(await page.locator('[data-provider-browse]').count(),5,'saved connections include a saved key with permission off');
  await browserPanel.getByRole('button',{name:'Filter providers: Saved connections',exact:true}).click();
  await page.keyboard.press('End');await page.keyboard.press('Enter');
  assert.equal(await page.locator('[data-provider-browse]').count(),4,'enabled filter follows saved provider permissions');
  await browserPanel.getByRole('button',{name:'Filter providers: Enabled providers',exact:true}).click();
  await page.keyboard.press('Home');await page.keyboard.press('Enter');
  assert.equal(await page.locator('[data-provider-browse]').count(),32);
  const search=browserPanel.getByRole('searchbox',{name:'Find a provider',exact:true});
  await search.fill('OpenAI');
  if(width>=900){assert.equal(await page.getByRole('region',{name:'Provider detail',exact:true}).count(),0,'hidden provider cannot remain the active detail');await page.getByText('Choose a provider',{exact:true}).waitFor();}
  await search.fill('nothing-matches');await page.getByText('No providers match.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Clear provider search',exact:true}).click();assert.equal(await search.inputValue(),'');assert.equal(await search.evaluate(n=>n===document.activeElement),true);
  await open('aion');const detail=page.getByRole('region',{name:'Provider detail',exact:true});
  assert.match(await detail.textContent(),/Cached catalog/);assert.match(await detail.textContent(),/Key saved/);assert.match(await detail.textContent(),/Unknown/);
  assert.doesNotMatch(await detail.textContent(),/healthy|online|fixture-only/);
  await back();await open('openai');assert.match(await detail.textContent(),/Permission off/);assert.equal(await detail.getByRole('button',{name:'Use GPT fixture',exact:true}).isDisabled(),true);
  await back();
  await browserPanel.getByRole('button',{name:'Filter providers: All providers',exact:true}).click();await page.getByRole('menuitemradio',{name:/Enabled providers/}).click();
  assert.equal(await page.getByRole('region',{name:'Provider detail',exact:true}).count(),0,'permission-off selection clears when enabled filter hides it');
  assert.equal(await page.locator('[data-provider-browse][aria-current=true]').count(),0);
  await browserPanel.getByRole('button',{name:'Filter providers: Enabled providers',exact:true}).click();await page.keyboard.press('Home');await page.keyboard.press('Enter');
  await open('groq');assert.match(await detail.textContent(),/No key saved/);assert.equal(await detail.getByRole('button',{name:'Use Cached Groq model',exact:true}).isDisabled(),true);
  await shot('no-key',false);await back();await open('mistral');assert.match(await detail.textContent(),/Discovery failed/);assert.equal(await detail.getByRole('button',{name:'Use Denied Mistral model',exact:true}).isDisabled(),true);
  await back();await open('openrouter');assert.match(await detail.textContent(),/13 requests remaining/);assert.match(await detail.textContent(),/shared.*free models/i);assert.doesNotMatch(await detail.textContent(),/26 requests remaining/);
  await back();await open('cloudflare');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'long provider identity fits');await shot('long-provider',false);await back();await open('baseten');assert.match(await detail.textContent(),/No catalog models/);assert.match(await detail.textContent(),/No key saved/);
  await back();await page.locator('[data-provider-browse=gemini]').focus();await page.keyboard.press('Enter');await detail.waitFor();assert.match(await detail.textContent(),/7 requests remaining/);assert.match(await detail.textContent(),/3 requests/);assert.match(await detail.textContent(),/Discovery does not verify successful replies/);

  assert.equal(await detail.getByRole('heading',{name:'Google AI Studio',exact:true}).evaluate(n=>n===document.activeElement),true,'keyboard navigation focuses the provider heading');
  await shot('keyboard-focus');
  const stamp=detail.locator('time');assert.equal(await stamp.textContent(),await stamp.evaluate(n=>new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(Number(n.dataset.timestamp))),'timestamp follows browser locale and timezone');
  assert.doesNotMatch(await detail.textContent(),/Cairo/);
  if(width<900){const action=await detail.getByRole('button',{name:'Use Gemini Flash',exact:true}).boundingBox();assert(action.y+action.height<844-65,'first model action is reachable in initial phone view');}
  await page.evaluate(()=>document.activeElement?.blur()); // Separate ordinary presentation from keyboard evidence; do not change focus styles.
  await shot('detail');
  await detail.getByText('Usage & provenance',{exact:true}).click();await detail.getByText(/Token counts may include estimates/).waitFor();await detail.getByText('Usage & provenance',{exact:true}).click();
  // Existing masked settings, without showing the synthetic key in screenshots.
  await detail.getByRole('button',{name:'Manage Google AI Studio connection',exact:true}).click();
  await page.getByLabel('Google AI Studio (Gemini) API key',{exact:true}).waitFor({timeout:5000});assert.equal(await page.getByLabel('Google AI Studio (Gemini) API key',{exact:true}).getAttribute('type'),'password');
  await page.locator('.settings-page').getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('region',{name:'Provider detail',exact:true}).waitFor();
  await detail.getByRole('button',{name:'Use Gemini 2.5 Pro',exact:true}).focus();await page.keyboard.press('Enter');
  await input.waitFor();assert.equal(await input.inputValue(),draft);assert.match(await page.locator('.composer .model-button').textContent(),/Gemini 2.5 Pro/);
  await page.getByRole('button',{name:'Routing Center',exact:true}).click();await page.getByRole('navigation',{name:'Routing sections'}).getByRole('button',{name:'Providers',exact:true}).click();await open('gemini');
  let largeCatalog=null;
  if(process.env.BLACKOUT_LARGE){
   await page.evaluate(async()=>{
    const {useStore}=await import('/src/store.ts');const s=useStore.getState(),base=s.catalog.models.find(m=>m.id==='gemini:gemini-flash-latest');
    const models=Array.from({length:1000},(_,i)=>({...base,id:'gemini:large-'+i,name:'large-'+i,label:i===999?'A long model name for a realistic inventory · research and analysis · final candidate':`Synthetic model ${i}`}));
    useStore.setState({catalog:{...s.catalog,models},settings:{...s.settings,enabledModels:models.map(m=>m.id)}});
   });
   assert.equal(await detail.locator('.proof-provider-model').count(),24,'large catalog has a bounded rendered page');
   await detail.getByRole('button',{name:'Next models',exact:true}).click();assert.match(await detail.getByRole('navigation',{name:'Model pages'}).textContent(),/25–48 of 1000/);
   await detail.getByRole('searchbox',{name:'Find a model',exact:true}).fill('final candidate');assert.equal(await detail.locator('.proof-provider-model').count(),1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   await detail.getByRole('button',{name:'Clear model search',exact:true}).click();assert.equal(await detail.locator('.proof-provider-model').count(),24);
   largeCatalog=await page.evaluate(async()=>{const {useStore}=await import('/src/store.ts');const {measureModelActions}=await import('/docs/blackout/workspace-proofs/provider-performance.tsx');return measureModelActions(useStore.getState().catalog.models);});
   assert.equal(largeCatalog.models,1000);assert.equal(largeCatalog.unrelatedCommits,0,'unrelated store updates do not rerender model actions');assert.equal(largeCatalog.disabledAfterKeyRemoval,1000,'relevant permission changes still reach every action');assert(largeCatalog.permissionChangeCommits>=1000);
   console.log('LARGE CATALOG',JSON.stringify(largeCatalog));
  }
  // Account safety: replace account-scoped state with an empty new synthetic account.
  await page.evaluate(async()=>{const {useStore}=await import('/src/store.ts');const {normalizeKeys}=await import('/src/lib/ai/provider-config.js');useStore.setState({user:{uid:'preview-blackout-empty-account',name:'Empty fixture',email:'empty@local.invalid',photo:''},keys:normalizeKeys({}),catalog:null,usage:null,settings:{...useStore.getState().settings,enabledModels:[]}});});
  if(width<900)assert.equal(await detail.isVisible(),false,'old account detail selection is cleared');
  await open('gemini');assert.match(await detail.textContent(),/No key saved/);assert.match(await detail.textContent(),/Not checked/);assert.match(await detail.textContent(),/Unknown/);assert.equal(await detail.getByRole('button',{name:/^Use /}).count(),0,'new account does not inherit model actions');
  await page.getByRole('button',{name:'Workspace',exact:true}).click();await input.waitFor();
  await page.evaluate(async()=>{const {useStore}=await import('/src/store.ts');useStore.setState({chats:[],currentId:null,settings:{...useStore.getState().settings,defaultModel:'auto'}});});
  await page.getByRole('button',{name:'Routing Center',exact:true}).click();await page.getByRole('navigation',{name:'Routing sections'}).getByRole('button',{name:'Providers',exact:true}).click();
  assert.equal(await page.getByRole('region',{name:'Provider detail',exact:true}).count(),0,'unknown route invites selection rather than alphabetical default');
  assert.equal(await page.locator('[data-provider-browse][aria-current=true]').count(),0);
  assert.equal(inference,0);assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
  const report={status:'passed',direction,width,engine:engine.name(),syntheticData:true,largeCatalog,inferenceRequests:inference,blockedAuthSdkRequests,unexpectedExternalRequests:unexpected,pageErrors:errors,scans,limitations:['No real provider calls or physical iPhone','Catalog discovery does not prove inference','Synthetic account transition checks proof-local UI, not a live sign-in flow']};
  fs.writeFileSync(path.join(output,`${direction}-${width}-${engine.name()}.json`),JSON.stringify(report,null,2)+'\n');
  console.log('PASS providers',direction,width,engine.name(),scans.length,'axe scans');await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
