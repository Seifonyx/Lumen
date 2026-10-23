// App chrome and portal titles never start native selection; explicit message selection still works.
const { chromium, webkit } = require('playwright'), assert = require('node:assert/strict');
const { profile, seed } = require('./helpers/preview-profile.cjs');
const url=process.env.MR_TEST_URL||'http://localhost:5190/';
(async()=>{
 const browser=await(process.env.MR_WEBKIT?webkit:chromium).launch();
 try{for(const width of[390,1280]){
  const ctx=await browser.newContext({viewport:{width,height:844},isMobile:width<900,hasTouch:width<900,serviceWorkers:'block'});
  const uid=`selection-${width}`;await profile(ctx,uid,'dark');
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>{if(!e.message.includes('firestore.googleapis.com'))errors.push(e.message);});
  await page.goto(new URL('/privacy.html',url).href);
  await seed(page,uid,[{id:'selection',title:'Selection test',model:'auto',createdAt:1,updatedAt:2,messages:[{id:'u',role:'user',text:'SELECTABLE_MESSAGE_WORDS',createdAt:1},{id:'a',role:'assistant',status:'done',model:'gemini:gemini-flash-latest',text:'A readable answer.\n\n```js\nconst sample = 1;\n```',createdAt:2}]}]);
  await page.goto(url);await page.locator('.composer textarea').waitFor();
  assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).webkitUserSelect),'none','Portals and blank body space inherit selection protection');
  if(width<900)await page.locator('.menu-btn').click();
  await page.locator('.chat-open').filter({hasText:'Selection test'}).click();await page.locator('[data-message-id="a"]').waitFor();
  await page.waitForFunction(expected=>{const node=document.querySelector('.msg.assistant pre');return node&&getComputedStyle(node).webkitUserSelect===expected;},'text');
  if(width>=900){
   const prose=page.locator('.msg.assistant .markdown p').first();
   await prose.waitFor({state:'visible'});await prose.scrollIntoViewIfNeeded();await prose.hover();
   const paragraph=await prose.boundingBox();assert.ok(paragraph,'Desktop prose has a visible layout before dragging');
   await page.mouse.move(paragraph.x+1,paragraph.y+paragraph.height/2);await page.mouse.down();
   await page.mouse.move(paragraph.x+Math.min(180,paragraph.width-1),paragraph.y+paragraph.height/2,{steps:8});await page.mouse.up();
   assert.match(await page.evaluate(()=>getSelection().toString()),/readable/,'Real desktop drag selection remains available');
  }
  await page.locator('.composer textarea').fill('Keep this draft');
  await page.locator('.composer textarea').evaluate(el=>{el.focus();el.setSelectionRange(0,4);});
  assert.equal(await page.locator('.composer textarea').evaluate(el=>el.selectionEnd-el.selectionStart),4,'Input selection remains usable');
  // Canvas phones fold your message's actions until the bubble is tapped (or the long-press menu opens).
  if(await page.locator('.app[data-lumen-canvas-shell]').count()&&await page.locator('.msg.user .msg-actions').evaluate(el=>getComputedStyle(el).pointerEvents==='none'))await page.locator('.msg.user .bubble').click();
  await page.locator('.msg.user').getByRole('button',{name:'Select text',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Select text',exact:true});await dialog.waitFor();
  assert.equal(await dialog.locator('.modal-title').evaluate(el=>getComputedStyle(el).webkitUserSelect),'none','Portal title cannot leave a native selection handle');
  assert.equal(await dialog.locator('.selectable-text').evaluate(el=>getComputedStyle(el).webkitUserSelect),'text');
  await dialog.getByRole('button',{name:'Select all',exact:true}).click();
  assert.equal(await page.evaluate(()=>getSelection().toString()),'SELECTABLE_MESSAGE_WORDS');
  assert.ok(await dialog.getByRole('button',{name:'Copy selected',exact:true}).isEnabled());
  await dialog.getByRole('button',{name:'Close',exact:true}).click();await dialog.waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>getSelection().toString()),'','Closing selection removes stale handles');
  assert.equal(await page.locator('.composer textarea').inputValue(),'Keep this draft');
  assert.deepEqual(errors,[]);console.log(`PASS selection boundaries ${process.env.MR_WEBKIT?'webkit':'chromium'} ${width}px`);await ctx.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
