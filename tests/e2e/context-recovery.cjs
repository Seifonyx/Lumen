// An oversized first exchange must not poison later sends or leave a global busy lock.
const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const { profile, seed } = require('./helpers/preview-profile.cjs');
const url = process.env.MR_TEST_URL || 'http://localhost:5190/';
const sse = text => 'data: '+JSON.stringify({candidates:[{content:{parts:[{text}]},finishReason:'STOP'}]})+'\n\n';
(async()=>{
 const browser=await (process.env.MR_WEBKIT?webkit:chromium).launch();
 try { for(const width of [390,1280]) for(const mode of ['compact','oversize','stop','layout','startup']) {
  if(process.env.CONTEXT_CASE && process.env.CONTEXT_CASE!==mode)continue;
  const uid=`context-${width}-${mode}`,log={summaries:0,chats:[],lists:0}; let release,hold=mode==='stop';
  const ctx=await browser.newContext({viewport:{width,height:844},isMobile:width<900,hasTouch:width<900,serviceWorkers:'block',...(width<900?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1'}:{})});
  await profile(ctx,uid,'dark',{defaultModel:'auto',autoCompact:!['oversize','layout','startup'].includes(mode),...(mode==='layout'?{layouts:[{id:'small-layout',name:'Small layout',icon:'code',mode:'order',models:['gemini:gemini-flash-lite-latest']}]}:{})});
  await ctx.route('**/generativelanguage.googleapis.com/**',async r=>{
   const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
   if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers});
   if(r.request().url().includes('/models?')){
    log.lists++;
    if(process.env.CATALOG_DELAY||mode==='startup')await new Promise(resolve=>setTimeout(resolve,Number(process.env.CATALOG_DELAY)||1800));
    return r.fulfill({headers,json:{models:[{name:'models/gemini-flash-latest',displayName:'Gemini Flash',inputTokenLimit:mode==='layout'?128000:16384,supportedGenerationMethods:['generateContent']},...(mode==='layout'?[{name:'models/gemini-flash-lite-latest',displayName:'Gemini Flash-Lite',inputTokenLimit:4096,supportedGenerationMethods:['generateContent']}]:[])]}});
   }
   const body=r.request().postDataJSON();
   if(r.request().url().includes(':generateContent')){
    log.summaries++; if(hold) await new Promise(resolve=>{release=resolve;});
    return r.fulfill({headers,json:{candidates:[{content:{parts:[{text:'SUMMARY: the user is reviewing a long quarterly report. Keep its goal and continue answering their new questions.'}]}}]}}).catch(()=>{});
   }
   log.chats.push(body);
   return r.fulfill({headers,contentType:'text/event-stream',body:sse(`RECOVERED_REPLY_${log.chats.length}`)});
  });
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>{if(!e.message.includes('firestore.googleapis.com'))errors.push(e.message);});
  await page.goto(new URL('/privacy.html',url).href);
  await seed(page,uid,[{id:'large',title:'Large context',model:mode==='layout'?'layout:small-layout':'auto',createdAt:1,updatedAt:2,messages:[{id:'old',role:'user',text:'ORIGINAL_REPORT '+ 'Quarterly report facts. '.repeat(3200),createdAt:1},{id:'answer',role:'assistant',text:'Original answer.',status:'done',model:'gemini:gemini-flash-latest',createdAt:2}]}]);
  await page.goto(url);await page.locator('.composer textarea').waitFor();
  if(width<900)await page.locator('.menu-btn').click();
  await page.locator('.chat-open').filter({hasText:'Large context'}).click();
  await page.locator('[data-message-id="answer"]').waitFor();
  await page.locator('.composer textarea').fill('NEW_QUESTION');await page.locator('.send-btn').click();
  if(mode==='oversize'||mode==='startup') {
   await page.locator('.error-msg').filter({hasText:'context'}).waitFor({timeout:10000});
   assert.equal(log.chats.length,0,'Never send an obviously oversized request');
   assert.equal(await page.getByRole('button',{name:'Stop',exact:true}).count(),0,'Failure releases the busy state');
   await page.locator('.composer textarea').fill('A draft remains editable');
   assert.equal(await page.locator('.composer textarea').inputValue(),'A draft remains editable');
   await page.locator('.send-btn').click();
   await page.waitForFunction(()=>[...document.querySelectorAll('.error-msg')].filter(el=>el.textContent.includes('context')).length===2);
   assert.equal(log.chats.length,0,'Repeated sends remain bounded and explain the same oversized context');
   if(mode==='startup')assert.equal(log.lists,1,'The initial load and the fast send share one catalogue request');
  } else {
   if(mode==='stop') {
    await page.waitForFunction(()=>document.querySelector('.compact-note.working'));
    await page.getByRole('button',{name:'Stop',exact:true}).last().click();
    hold=false; release?.();
    await page.locator('.compact-note.working').waitFor({state:'detached'});
    await page.getByRole('button',{name:'Stop',exact:true}).waitFor({state:'detached'});
    assert.equal(log.chats.length,0,'Stopping preparation never sends a late model request');
    await page.locator('.composer textarea').fill('AFTER_STOP');await page.locator('.send-btn').click();
   }
   await page.getByText('RECOVERED_REPLY_1',{exact:true}).waitFor();
   for(let i=2;i<=4;i++) {
    await page.locator('.composer textarea').fill(`FOLLOW_UP_${i}`);await page.locator('.send-btn').click();
    await page.getByText(`RECOVERED_REPLY_${i}`,{exact:true}).waitFor();
   }
   assert.equal(log.chats.length,4,'Every subsequent send completes exactly once');
   assert.equal(log.summaries,mode==='layout'?0:mode==='stop'?2:1,'Later messages reuse the summary or keep fitting full context');
   const wire=JSON.stringify(log.chats.at(-1));
   assert.ok(wire.includes('FOLLOW_UP_4'));
   if(mode==='layout')assert.ok(wire.includes('ORIGINAL_REPORT'),'A larger outside-layout backup receives the full context without truncation');
   else assert.ok(wire.includes('SUMMARY:')&&!wire.includes('ORIGINAL_REPORT'));
   assert.ok(await page.locator('[data-message-id="old"]').count(),'Original history stays visible');
  }
  assert.deepEqual(errors,[]);console.log(`PASS context recovery ${process.env.MR_WEBKIT?'webkit':'chromium'} ${width}px ${mode}`);
  await ctx.close();
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
