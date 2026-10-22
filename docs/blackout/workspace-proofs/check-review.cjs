const {chromium}=require('playwright');
const AxeBuilder=require('@axe-core/playwright').default;
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{const browser=await chromium.launch();try{
 const context=await browser.newContext({viewport:{width:1440,height:1040},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5194/reference-board.html');
 await page.locator('img').last().waitFor();await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
 assert.equal(await page.locator('img').count(),10);await page.screenshot({path:path.join(__dirname,'reference-board-overview.png')});
 await page.goto('http://localhost:5194/workspace-proofs/review.html');
 for(const state of ['routing-center','workspace','expanded-input','model-picker','usage-details','model-inventory','routing-policies','fallback-editor','provider-management','provider-connection']){
  await page.locator('#state').selectOption(state);
  for(const before of [false,true]){
   await page.locator('#before').setChecked(before);
   await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  }
 }
 await page.locator('#state').selectOption('routing-center');await page.locator('#before').setChecked(false);
 await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
 const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();assert.deepEqual(scan.violations.map(v=>v.id),[]);
 await page.screenshot({path:path.join(__dirname,'review-overview.png')});assert.deepEqual(errors,[]);await context.close();
 const previewContext=await browser.newContext({viewport:{width:1440,height:960},serviceWorkers:'block'}),preview=await previewContext.newPage(),remote=[],previewErrors=[];
 previewContext.on('request',request=>{const url=new URL(request.url());if(url.hostname!=='localhost'&&url.hostname!=='127.0.0.1')remote.push(url.hostname);});
 preview.on('pageerror',e=>previewErrors.push(e.message));
 await preview.goto('http://localhost:5193/docs/blackout/workspace-proofs/?direction=index&fixture=1');
 await preview.getByText('Make the first week count.',{exact:true}).waitFor();
 await preview.locator('.composer textarea').fill('A manual preview draft.');
 await preview.getByRole('button',{name:'Routing Center',exact:true}).click();await preview.getByRole('main',{name:'Routing Center'}).waitFor();
 await preview.getByRole('button',{name:'Workspace',exact:true}).click();assert.equal(await preview.locator('.composer textarea').inputValue(),'A manual preview draft.');
 await preview.goto('http://localhost:5193/docs/blackout/workspace-proofs/?direction=studio');await preview.getByText('Make the first week count.',{exact:true}).waitFor();
 await preview.evaluate(async()=>{const response=await fetch('https://example.invalid/no-request');if(response.status!==503)throw new Error('fetch guard missing');let blocked=false;try{new XMLHttpRequest().open('GET','https://example.invalid/no-request');}catch{blocked=true;}if(!blocked)throw new Error('XHR guard missing');});
 assert.deepEqual(remote,[],'synthetic initial/reopened preview makes no external network requests');assert.deepEqual(previewErrors,[]);await previewContext.close();
 const guarded=await browser.newContext(),guardPage=await guarded.newPage();
 await guarded.addInitScript(()=>{localStorage.setItem('mr.preview_user',JSON.stringify({uid:'preview-another-account'}));localStorage.setItem('existing-data-marker','keep');});
 await guardPage.goto('http://localhost:5193/docs/blackout/workspace-proofs/?fixture=1');await guardPage.getByText(/preserve the existing local account/).waitFor();
 assert.equal(await guardPage.locator('.app').count(),0);assert.equal(await guardPage.evaluate(()=>localStorage.getItem('existing-data-marker')),'keep');await guarded.close();
 const authContext=await browser.newContext(),authPage=await authContext.newPage();
 // A separate IndexedDB on the proof origin, without a sign-in marker, must also block fixture setup.
 await authPage.goto('http://localhost:5193/docs/blackout/workspace-proofs/');await authPage.evaluate(()=>new Promise((resolve,reject)=>{localStorage.removeItem('mr.signedIn');const r=indexedDB.open('firebaseLocalStorageDb',1);r.onsuccess=()=>{r.result.close();resolve();};r.onerror=reject;}));await authPage.goto('http://localhost:5193/docs/blackout/workspace-proofs/?fixture=1');await authPage.getByText(/preserve the existing local account/).waitFor();assert.equal(await authPage.locator('.app').count(),0);await authContext.close();
 console.log('PASS: 10 actual reference images; 20 matched before/after board states; accessibility; synthetic preview with zero external requests; existing local account guard');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
