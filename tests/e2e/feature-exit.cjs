// Real user journeys. Replacing Exit with sequential Back must fail at the deep-view assertions.
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const {profile,seed}=require('./helpers/preview-profile.cjs');
const base=process.env.MR_TEST_URL||'http://localhost:5190';
(async()=>{const browser=await(process.env.MR_WEBKIT?webkit:chromium).launch();try{
for(const width of [390,1440]){
 const ctx=await browser.newContext({viewport:{width,height:900},hasTouch:width<900,serviceWorkers:'block',reducedMotion:'reduce'});
 await ctx.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());await profile(ctx,'preview-feature-exit');
 const page=await ctx.newPage();page.setDefaultTimeout(10000);await page.goto(base);await page.locator('.composer textarea').waitFor();
 if(!await page.locator('[data-lumen-canvas-shell]').count()){await ctx.close();continue;}
 const now=Date.now();await seed(page,'preview-feature-exit',[{id:'document-chat',title:'Document source',createdAt:now,updatedAt:now,messages:[],documents:[{id:'doc',name:'Exit review.md',content:'# Saved content',updatedAt:now}]}]);await page.reload();
 const input=page.locator('.composer textarea');await input.fill('Keep my original draft');
 await page.locator('.composer input[type=file][multiple]').last().setInputFiles({name:'Keep attachment.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic unsent attachment')});await page.getByRole('button',{name:'Remove Keep attachment.txt',exact:true}).waitFor();
 const drawer=page.locator('aside.cv-nav');const open=async(name)=>{if(width<900)await page.locator('.menu-btn:visible').first().click();await drawer.getByRole('button',{name,exact:true}).click()};
 const exit=async()=>page.getByRole('button',{name:/^Return to (chat|previous screen)$/,exact:false}).filter({visible:true}).first().click();
 await open('Prism');await page.getByRole('navigation',{name:'Prism sections'}).getByRole('button',{name:'Providers',exact:true}).click();await page.locator('[data-provider="gemini"]').click();await page.getByRole('region',{name:'Provider detail'}).waitFor();
 await exit();await page.locator('.rc-page').waitFor({state:'hidden'});assert.equal(await input.inputValue(),'Keep my original draft');
 // The chevron traverses existing entries; Forward still restores intentional browser history.
 await page.goForward();await page.locator('.rc-page').waitFor({state:'visible'});await page.goBack();await input.waitFor();
 await open('Library');await page.getByRole('button',{name:'Open Exit review.md',exact:true}).click();await page.locator('.canvas-panel').waitFor();
 const editor=page.getByRole('textbox',{name:'Canvas document',exact:true});await editor.fill('# Edited and retained');await page.getByText('Saved on device',{exact:true}).waitFor();
 if(width===390){
  await page.evaluate(()=>{window.__realPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='chats')throw Error('Synthetic storage failure');return window.__realPut.apply(this,args)}});
  await page.getByRole('textbox',{name:'Canvas filename',exact:true}).fill('Failed rename.md');await page.getByRole('alert').filter({hasText:'Document name could not be saved'}).waitFor();await exit();assert(await editor.isVisible(),'failed rename prevents Exit');
  await page.goBack();await page.locator('.canvas-panel').waitFor({state:'detached'});await page.goForward();await editor.waitFor();await page.getByRole('alert').filter({hasText:'Document name could not be saved'}).waitFor();await exit();assert(await editor.isVisible(),'failed rename remains guarded after history replay');
  await page.evaluate(()=>{IDBObjectStore.prototype.put=window.__realPut});await page.getByRole('textbox',{name:'Canvas filename',exact:true}).fill('Exit review.md');await page.getByRole('alert').filter({hasText:'Document name could not be saved'}).waitFor({state:'detached'});
  const instruction=page.getByRole('textbox',{name:'Canvas edit instruction',exact:true});await instruction.fill('A substantive unsent instruction');await page.goBack();await page.locator('.canvas-panel').waitFor({state:'detached'});await page.goForward();await instruction.waitFor();assert.equal(await instruction.inputValue(),'A substantive unsent instruction','browser Back/Forward preserves unsent edit instructions');page.once('dialog',dialog=>dialog.dismiss());await exit();assert(await editor.isVisible(),'declining discard keeps document instructions');await instruction.fill('');
 }
 await exit();await page.locator('.canvas-panel').waitFor({state:'detached'});await input.waitFor();assert.equal(await input.inputValue(),'Keep my original draft');assert.equal(await page.locator('.hub-page:visible').count(),0);
 assert.equal(await page.getByRole('button',{name:'Remove Keep attachment.txt',exact:true}).count(),1,'whole-feature Exit restores the original chat attachment draft');
 await open('Library');await page.getByRole('button',{name:'Open Exit review.md',exact:true}).click();assert.equal(await editor.inputValue(),'# Edited and retained');await exit();
 await open('Tools');await page.locator('.tool-card').filter({has:page.locator('strong',{hasText:/^Document canvas$/})}).click();await page.locator('.canvas-panel').waitFor();await exit();await input.waitFor();assert.equal(await input.inputValue(),'Keep my original draft','Tools Canvas exits to the original chat, not an intermediate new chat');assert.equal(await page.getByRole('button',{name:'Remove Keep attachment.txt',exact:true}).count(),1);
 await open('Tools');await page.getByRole('button',{name:'New assistant',exact:true}).click();await page.getByRole('textbox',{name:'Library item name'}).fill('An unsaved helper');await page.getByRole('textbox',{name:'Library instructions'}).fill('Preserve instructions');await exit();await input.waitFor();assert.equal(await input.inputValue(),'Keep my original draft');
 assert.equal(await page.locator('.cv-chat-pill:visible,.rc-close:visible').count(),0,'no redundant trailing chat pill');
 await ctx.close();console.log('PASS whole-feature Exit',width);
}
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
