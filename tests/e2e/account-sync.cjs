// Actual auth changes in one browser; all database operations use isolated Firebase emulators.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const database='http://127.0.0.1:8080/v1/projects/the-model-router/databases/(default)/documents';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const remoteChats=async uid=>(await (await fetch(`${database}/modelRouter/${uid}/chats`,{headers:{Authorization:'Bearer owner'}})).json()).documents||[];
const remoteText=async uid=>{
 const rows=await remoteChats(uid), result=[];
 for(const row of rows)result.push(...((await (await fetch(`${database}/modelRouter/${uid}/chats/${row.name.split('/').pop()}/messages`,{headers:{Authorization:'Bearer owner'}})).json()).documents||[]));
 return JSON.stringify(result);
};
const waitFor=async check=>{for(let i=0;i<60;i++){if(await check())return;await pause(200)}throw new Error('Fixture condition did not finish');};
(async()=>{
 await fetch('http://127.0.0.1:8080/emulator/v1/projects/the-model-router/databases/(default)/documents',{method:'DELETE'});await fetch('http://127.0.0.1:9099/emulator/v1/projects/the-model-router/accounts',{method:'DELETE'});
 const browser=await chromium.launch(),ctx=await browser.newContext({viewport:{width:1280,height:860}});
 try{
  const calls=[];
  await ctx.route('**/generativelanguage.googleapis.com/**',async r=>{
   if(r.request().url().includes('/models?'))return r.fulfill({json:{models:[{name:'models/gemini-flash-latest',supportedGenerationMethods:['generateContent']}]}});
   const body=r.request().postDataJSON();calls.push(body);const last=body.contents?.at(-1)?.parts?.map(x=>x.text||'').join('')||'';
   if(last.includes('PENDING_A_MESSAGE'))await pause(1500);
   return r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({candidates:[{content:{parts:[{text:last.includes('ACCOUNT_B_MESSAGE')?'ACCOUNT_B_REPLY':'ACCOUNT_A_REPLY'}]},finishReason:'STOP'}]})+'\n\n'}).catch(()=>{});
  });
  const page=await ctx.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('http://localhost:5190/?emulator');await page.waitForFunction(()=>typeof window.__testSignIn==='function');
  const signin=async email=>page.evaluate(async value=>(await window.__testSignIn(value)).user.uid,email);
  const keys=async()=>{await page.waitForSelector('input[placeholder="AIza…"]');await page.fill('input[placeholder="AIza…"]','fixture');await page.getByRole('button',{name:'Save keys',exact:true}).click();await page.waitForTimeout(1000);};
  const uidA=await signin('hebaghoneim8@gmail.com');await keys();await page.locator('.settings-tabs').getByText('Personalization',{exact:true}).click();await page.locator('.field-block textarea').fill('PRIVATE_ACCOUNT_A_INSTRUCTIONS');await page.waitForTimeout(1000);await page.locator('.settings-page [aria-label="Close"]').click();
  await page.fill('.composer textarea','PRIVATE_ACCOUNT_A_MESSAGE');await page.click('.send-btn');await page.waitForSelector('.msg.assistant .model-tag');await waitFor(async()=>(await remoteText(uidA)).includes('PRIVATE_ACCOUNT_A_MESSAGE'));
  await page.fill('.composer textarea','PENDING_A_MESSAGE');await page.click('.send-btn');await waitFor(()=>calls.some(body=>JSON.stringify(body).includes('PENDING_A_MESSAGE')));
  const uidB=await signin('seifeldingamal2021@gmail.com');assert.notEqual(uidA,uidB);await keys();await page.locator('.settings-page [aria-label="Close"]').click();await page.waitForSelector('.composer textarea');await page.waitForTimeout(1800);
  assert.equal(await page.locator('.chat-row').filter({hasText:'PRIVATE_ACCOUNT_A_MESSAGE'}).count(),0);assert.equal((await remoteChats(uidB)).length,0,'Account A chats uploaded into Account B cloud space');
  await page.fill('.composer textarea','ACCOUNT_B_MESSAGE');await page.click('.send-btn');await page.waitForSelector('.msg.assistant .model-tag');assert.ok(!JSON.stringify(calls.at(-1)).includes('PRIVATE_ACCOUNT_A'));await waitFor(async()=>(await remoteText(uidB)).includes('ACCOUNT_B_MESSAGE'));assert.ok(!(await remoteText(uidB)).includes('PRIVATE_ACCOUNT_A'));
  await signin('hebaghoneim8@gmail.com');await page.waitForSelector('.composer textarea');await page.waitForFunction(()=>document.querySelector('.chat-list')?.textContent.includes('PRIVATE_ACCOUNT_A_MESSAGE'));assert.equal(await page.locator('.chat-row').filter({hasText:'ACCOUNT_B_MESSAGE'}).count(),0);assert.deepEqual(errors,[]);
  console.log('PASS actual account changes isolate local/cloud chats and instructions; interrupted responses stay in their original account');
 }finally{await ctx.close();await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
