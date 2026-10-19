// A temporarily unavailable account-sync service must not block local key activation/discovery.
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 await fetch('http://127.0.0.1:8080/emulator/v1/projects/the-model-router/databases/(default)/documents',{method:'DELETE'});
 await fetch('http://127.0.0.1:9099/emulator/v1/projects/the-model-router/accounts',{method:'DELETE'});
 const browser=await(process.env.MR_WEBKIT?webkit:chromium).launch(),ctx=await browser.newContext({viewport:{width:1280,height:860},serviceWorkers:'block'});
 let releaseWrites;const writesReady=new Promise(resolve=>{releaseWrites=resolve;});
 const lists=[];let held=0,announceWrites;const writesStarted=new Promise(resolve=>{announceWrites=resolve;});
 try {
  await ctx.route('**/google.firestore.v1.Firestore/Write/channel**',async route=>{held++;announceWrites();await writesReady;await route.continue().catch(()=>{});});
  await ctx.route('**/generativelanguage.googleapis.com/**',route=>{
   assert(route.request().url().includes('/models?'),'this scenario never sends paid inference');
   lists.push(route.request().headers()['x-goog-api-key']);
   return route.fulfill({json:{models:[{name:'models/gemini-flash-latest',displayName:'Stall-proof Gemini',inputTokenLimit:128000,supportedGenerationMethods:['generateContent']}]}});
  });
  const page=await ctx.newPage();await page.goto('http://localhost:5190/?emulator');await page.waitForFunction(()=>typeof window.__testSignIn==='function');
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const uid=await page.evaluate(async()=>(await window.__testSignIn('hebaghoneim8@gmail.com')).user.uid);
  await page.getByPlaceholder('AIza…',{exact:true}).fill('synthetic-stalled-key-alpha');
  await page.getByRole('button',{name:'Save keys',exact:true}).click();await writesStarted;
  await page.locator('.settings-tabs').getByRole('button',{name:'Models',exact:true}).click();
  assert(held>0,'a real Firestore write acknowledgement remains blocked');
  const local=await page.evaluate(id=>JSON.parse(localStorage.getItem(`mr.account.${id}`)||'{}').geminiKey,uid);
  assert.equal(local,'synthetic-stalled-key-alpha','the saved key is durable in its own local account cache');
  await page.locator('.model-row').filter({hasText:'Stall-proof Gemini'}).waitFor({timeout:5000});
  assert(lists.includes('synthetic-stalled-key-alpha'),'local discovery uses the saved credential without waiting for cloud acknowledgement');
  console.log('PASS local credential activation and discovery while account write acknowledgement is stalled');
  await page.locator('.settings-tabs').getByRole('button',{name:'API keys',exact:true}).click();
  await page.locator('[data-provider=gemini] summary').click();
  await page.getByPlaceholder('AIza…',{exact:true}).fill('synthetic-stalled-key-beta');
  await page.getByRole('button',{name:'Save keys',exact:true}).click();
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem(`mr.account.${id}`)||'{}').geminiKey==='synthetic-stalled-key-beta',uid);
  await page.locator('.settings-tabs').getByRole('button',{name:'Models',exact:true}).click();
  await page.locator('.model-row').filter({hasText:'Stall-proof Gemini'}).waitFor({timeout:5000});
  assert(lists.includes('synthetic-stalled-key-beta'),'a replacement key must discover without waiting for the first save');
  console.log('PASS replacement credential discovery does not queue behind an old acknowledgement');
  // Reload discards Firestore's in-memory queue; the durable revision must survive.
  await page.reload();
  await page.locator('.app:not(.app-skeleton) .composer textarea').waitFor({timeout:10000});
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.locator('.settings-tabs').getByRole('button',{name:'API keys',exact:true}).click();
  await page.locator('[data-provider=gemini] summary').click();
  assert.equal(await page.getByPlaceholder('AIza…',{exact:true}).inputValue(),'synthetic-stalled-key-beta');
  await page.waitForFunction(id=>{const d=JSON.parse(localStorage.getItem(`mr.account.${id}`)||'{}');return d.pendingKeyRevision===d.keyRevision && Boolean(d.keyRevision);},uid);
  console.log('PASS a reload cannot replace a pending local key with older remote keys');
  const other=await page.evaluate(async()=>(await window.__testSignIn('seifeldingamal2021@gmail.com')).user.uid);
  assert.notEqual(other,uid);
  await page.getByPlaceholder('AIza…',{exact:true}).waitFor({timeout:5000});
  assert.equal(await page.getByPlaceholder('AIza…',{exact:true}).inputValue(),'','another account must never inherit pending keys');
  console.log('PASS account switching is not blocked by the old account cloud write');
  await page.getByPlaceholder('AIza…',{exact:true}).fill('synthetic-other-account-key');
  await page.getByRole('button',{name:'Save keys',exact:true}).click();
  await page.locator('.settings-tabs').getByRole('button',{name:'Models',exact:true}).click();
  await page.locator('.model-row').filter({hasText:'Stall-proof Gemini'}).waitFor({timeout:5000});
  releaseWrites();
  const endpoint=`http://127.0.0.1:8080/v1/projects/the-model-router/databases/(default)/documents/modelRouter/${encodeURIComponent(other)}`;
  const deadline=Date.now()+15000;let remote;
  do {remote=await(await fetch(endpoint,{headers:{Authorization:"Bearer owner"}})).json();if(remote.fields?.geminiKey?.stringValue==='synthetic-other-account-key')break;await new Promise(resolve=>setTimeout(resolve,100));}while(Date.now()<deadline);
  assert.equal(remote.fields?.geminiKey?.stringValue,'synthetic-other-account-key','reconnection persists the active account latest key');
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem(`mr.account.${id}`)||'{}').pendingKeyRevision===null,other);
  assert.equal(await page.evaluate(id=>JSON.parse(localStorage.getItem(`mr.account.${id}`)||'{}').geminiKey,uid),'synthetic-stalled-key-beta');
  console.log('PASS cloud reconnection acknowledges only its own account and revision');
  // Clear uses the same durable path and must remove provider eligibility immediately.
  await page.locator('.settings-tabs').getByRole('button',{name:'API keys',exact:true}).click();
  await page.locator('[data-provider=gemini] summary').click();
  await page.getByPlaceholder('AIza…',{exact:true}).fill('');
  await page.getByRole('button',{name:'Save keys',exact:true}).click();
  await page.waitForFunction(id=>{const d=JSON.parse(localStorage.getItem(`mr.account.${id}`)||'{}');return d.geminiKey==='' && d.pendingKeyRevision===null;},other);
  await page.locator('.settings-tabs').getByRole('button',{name:'Models',exact:true}).click();
  assert.equal(await page.locator('.model-row').filter({hasText:'Stall-proof Gemini'}).count(),0,'removed credentials cannot remain eligible');
  assert.deepEqual(errors,[]);
  console.log('PASS removal clears local and cloud keys without leaving the old model eligible');
 } finally {releaseWrites();await ctx.close();await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
