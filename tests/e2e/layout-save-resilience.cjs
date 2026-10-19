// A pending layout snapshot must survive reload and replay without rolling back account keys.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const database='http://127.0.0.1:8080/v1/projects/the-model-router/databases/(default)/documents';
const headers={Authorization:'Bearer owner'}; // Firebase emulator only.
const readAccount=async uid=>(await(await fetch(`${database}/modelRouter/${uid}`,{headers})).json()).fields;
async function openLayouts(page) {
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.locator('.settings-tabs').getByRole('button',{name:'Models',exact:true}).click();
 await page.getByRole('button',{name:'Layouts',exact:true}).click();
}
(async()=>{
 await fetch('http://127.0.0.1:8080/emulator/v1/projects/the-model-router/databases/(default)/documents',{method:'DELETE'});
 await fetch('http://127.0.0.1:9099/emulator/v1/projects/the-model-router/accounts',{method:'DELETE'});
 const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:1280,height:860},serviceWorkers:'block'});
 let release;const heldWrites=new Promise(resolve=>{release=resolve;});
 let writing;const writeStarted=new Promise(resolve=>{writing=resolve;});
 let lists=0;
 try {
  await context.route('**/generativelanguage.googleapis.com/**',route=>{
   assert(route.request().url().includes('/models?'),'layout building does not send inference');lists++;
   return route.fulfill({json:{models:[{name:'models/gemini-flash-latest',displayName:'Layout Flash',inputTokenLimit:128000,supportedGenerationMethods:['generateContent']},{name:'models/gemini-2.5-pro',displayName:'Layout Pro',inputTokenLimit:262144,supportedGenerationMethods:['generateContent']}]}});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://localhost:5190/?emulator');await page.waitForFunction(()=>typeof window.__testSignIn==='function');
  const uid=await page.evaluate(async()=>(await window.__testSignIn('hebaghoneim8@gmail.com')).user.uid);
  await page.getByPlaceholder('AIza…',{exact:true}).fill('synthetic-layout-save-key');
  await page.getByRole('button',{name:'Save keys',exact:true}).click();
  await page.locator('.settings-tabs').getByRole('button',{name:'Models',exact:true}).click();
  await page.locator('.model-row').first().waitFor();
  // Allow the initial account settings to reach the emulator before blocking subsequent writes.
  let baseline;const deadline=Date.now()+10000;
  do {baseline=await readAccount(uid);if(baseline?.settings?.mapValue?.fields?.enabledModels)break;await new Promise(resolve=>setTimeout(resolve,100));}while(Date.now()<deadline);
  assert(baseline.settings?.mapValue?.fields?.enabledModels,'baseline account settings reached the server');
  await context.route('**/google.firestore.v1.Firestore/Write/channel**',async route=>{writing();await heldWrites;await route.continue().catch(()=>{});});
  await page.getByRole('button',{name:'Layouts',exact:true}).click();
  await page.getByRole('button',{name:'Build for a task',exact:true}).click();
  await page.getByLabel('Describe the work').fill('Review complex code carefully with a large context');
  await page.getByRole('button',{name:'Build',exact:true}).click();
  await page.locator('.builder-picks li').first().waitFor();
  await page.locator('.builder-name input').fill('Pending layout survives');
  await page.getByRole('button',{name:'Save layout',exact:true}).click();
  await Promise.race([writeStarted,new Promise((_,reject)=>setTimeout(()=>reject(new Error("The controlled account write did not start")),10000).unref())]);
  assert(await page.evaluate(id=>JSON.parse(localStorage.getItem(`mr.account.${id}`)).settings.layouts.some(layout=>layout.name==='Pending layout survives'),uid));
  const before=lists;await page.reload();await page.locator('.composer textarea').waitFor();
  await page.waitForFunction(()=>document.querySelector('.model-button'));
  const until=Date.now()+10000;while(lists<=before && Date.now()<until)await new Promise(resolve=>setTimeout(resolve,50));
  assert(lists>before,'the reloaded account read completed and refreshed its catalog');
  await openLayouts(page);
  await page.getByRole('button',{name:'Edit Pending layout survives',exact:true}).waitFor({timeout:5000});
  assert.equal(await page.evaluate(id=>JSON.parse(localStorage.getItem(`mr.account.${id}`)).geminiKey,uid),'synthetic-layout-save-key');
  console.log('PASS a layout saved during a stalled account write survives reload and stale remote settings');
  release();
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem(`mr.account.${id}`)).pendingSettingsRevision===null,uid);
  let remote=await readAccount(uid);
  assert(remote.settings.mapValue.fields.layouts.arrayValue.values.some(value=>value.mapValue.fields.name.stringValue==='Pending layout survives'));
  assert.equal(remote.geminiKey.stringValue,'synthetic-layout-save-key');
  console.log('PASS resumed layout sync preserves account keys and acknowledges the current settings revision');
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Delete Pending layout survives',exact:true}).click();
  await page.waitForFunction(id=>{const value=JSON.parse(localStorage.getItem(`mr.account.${id}`));return !value.settings.layouts.some(layout=>layout.name==='Pending layout survives') && value.pendingSettingsRevision===null;},uid);
  await page.reload();await page.locator('.composer textarea').waitFor();await openLayouts(page);
  assert.equal(await page.getByRole('button',{name:'Edit Pending layout survives',exact:true}).count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS deleted layouts remain removed after sync and reload');
 } finally {release();await context.close();await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
