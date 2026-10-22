const {chromium}=require('playwright');
const {openSettings,replyAction}=require('./helpers/ui.cjs');
const assert=require('node:assert/strict');
(async()=>{
 const base=process.env.MR_TEST_URL||'http://localhost:5190/?emulator';
 const browser=await chromium.launch();const ctx=await browser.newContext({viewport:{width:1280,height:860}});
 try {
  const calls=[];
  await ctx.route('**/firestore.googleapis.com/**',r=>r.abort());
  await ctx.route('**/generativelanguage.googleapis.com/**',r=>{
   if(r.request().url().includes('/models?'))return r.fulfill({json:{models:[{name:'models/gemini-flash-latest',supportedGenerationMethods:['generateContent']}]}});
   const body=r.request().postDataJSON();calls.push(body);const reply=JSON.stringify(body).includes('ACCOUNT_B_MESSAGE')?'ACCOUNT_B_REPLY':'PRIVATE_ACCOUNT_A_REPLY';return r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({candidates:[{content:{parts:[{text:reply}]},finishReason:'STOP'}]})+'\n\n'});
  });
  await ctx.route('**/__test-setup',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Isolated setup</title>'}));
  await ctx.addInitScript(()=>{
   if(window.top!==window)return;
   if(localStorage.getItem('mr.preview_user'))return;
   const uid='preview-account-a',settings={autoIntroduced:true,autoTitle:false,customInstructions:'PRIVATE_ACCOUNT_A_INSTRUCTIONS',enabledModels:['gemini:gemini-flash-latest'],defaultModel:'gemini:gemini-flash-latest'};
   localStorage.setItem('mr.preview_user',JSON.stringify({uid,email:'a@local.invalid',displayName:'Account A'}));localStorage.setItem(`mr.account.${uid}`,JSON.stringify({geminiKey:'fixture',settings}));localStorage.setItem('mr.settings',JSON.stringify(settings));localStorage.setItem('mr.installHint','1');
  });
  const page=await ctx.newPage();await page.goto(new URL('/__test-setup',base).href);
  await page.evaluate(async()=>{
   const database=await new Promise((resolve,reject)=>{const request=indexedDB.open('model-router',2);request.onupgradeneeded=()=>request.result.createObjectStore('chats',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
   await new Promise((resolve,reject)=>{const tx=database.transaction('chats','readwrite');tx.objectStore('chats').put({id:'legacy-chat',title:'LEGACY_CHAT_MARKER',createdAt:1,updatedAt:1,messages:[{id:'legacy-message',role:'user',text:'LEGACY_PRIVATE_MESSAGE',createdAt:1}],documents:[{id:'legacy-doc',name:'Legacy.md',content:'LEGACY_PRIVATE_CANVAS',updatedAt:1}]});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});database.close();localStorage.setItem('mr.draft.legacy-chat','LEGACY_CHAT_DRAFT');localStorage.setItem('mr.draft.new','LEGACY_NEW_DRAFT');
  });
  await page.goto(base);await page.waitForSelector('.composer textarea');assert.equal(await page.inputValue('.composer textarea'),'LEGACY_NEW_DRAFT');await page.locator('.chat-row').filter({hasText:'LEGACY_CHAT_MARKER'}).locator('.chat-open').click();assert.equal(await page.inputValue('.composer textarea'),'LEGACY_CHAT_DRAFT');await page.getByRole('button',{name:'Open canvas',exact:true}).click();assert.equal(await page.inputValue('.canvas-text'),'LEGACY_PRIVATE_CANVAS');await page.getByRole('button',{name:'Close canvas',exact:true}).click();await page.evaluate(()=>(document.querySelector('.sidebar .new-chat, .cv-new-pill')||[...document.querySelectorAll('.cv-dest button')].find(b=>b.textContent.includes('New chat'))).click());
  await page.fill('.composer textarea','PRIVATE_ACCOUNT_A_MESSAGE');await page.click('.send-btn');await page.waitForSelector('.msg.assistant .model-tag');await replyAction(page,'Edit in canvas','last');await page.fill('.canvas-text','PRIVATE_ACCOUNT_A_CANVAS');await page.getByRole('button',{name:'Close canvas',exact:true}).click();await page.fill('.composer textarea','PRIVATE_ACCOUNT_A_DRAFT');
  await page.evaluate(()=>{
   const uid='preview-account-b',settings={autoIntroduced:true,autoTitle:false,enabledModels:['gemini:gemini-flash-latest'],defaultModel:'gemini:gemini-flash-latest'};
   localStorage.setItem('mr.preview_user',JSON.stringify({uid,email:'b@local.invalid',displayName:'Account B'}));localStorage.setItem(`mr.account.${uid}`,JSON.stringify({geminiKey:'fixture',settings}));
  });
  await page.reload();await page.waitForSelector('.composer textarea');assert.equal(await page.locator('.chat-row').filter({hasText:'PRIVATE_ACCOUNT_A_MESSAGE'}).count(),0,'Account B can see Account A chat on this device');assert.ok(!(await page.inputValue('.composer textarea')).includes('PRIVATE_ACCOUNT_A'));
  assert.equal(await page.locator('.chat-row').filter({hasText:'LEGACY_CHAT_MARKER'}).count(),0);
  await page.fill('.composer textarea','ACCOUNT_B_MESSAGE');await page.click('.send-btn');await page.waitForSelector('.msg.assistant .model-tag');assert.ok(!JSON.stringify(calls.at(-1)).includes('PRIVATE_ACCOUNT_A'));
  await page.evaluate(()=>localStorage.setItem('mr.preview_user',JSON.stringify({uid:'preview-account-a',email:'a@local.invalid',displayName:'Account A'})));await page.reload();await page.waitForSelector('.composer textarea');assert.equal(await page.locator('.chat-row').filter({hasText:'ACCOUNT_B_MESSAGE'}).count(),0);await page.locator('.chat-row').filter({hasText:'PRIVATE_ACCOUNT_A_MESSAGE'}).locator('.chat-open').click();await page.waitForFunction(()=>document.querySelector('.composer textarea').value==='PRIVATE_ACCOUNT_A_DRAFT');await page.getByRole('button',{name:'Open canvas',exact:true}).click();assert.equal(await page.inputValue('.canvas-text'),'PRIVATE_ACCOUNT_A_CANVAS');await page.getByRole('button',{name:'Close canvas',exact:true}).click();assert.equal(await page.locator('.chat-row').filter({hasText:'LEGACY_CHAT_MARKER'}).count(),1);
  console.log('PASS different accounts cannot see each other’s device chats or drafts');
  console.log('PASS account instructions stay isolated; switching back restores chats, Canvas and drafts; legacy data migrates once');
 }finally{await ctx.close();await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
