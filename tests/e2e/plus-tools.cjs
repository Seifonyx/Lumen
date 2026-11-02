// The + menu and Browse all tools (Canvas): Tools is no longer a place in the sidebar; the message box's + holds attach,
// this chat's context, three quick tools and Browse all tools, a searchable picker over the chat. Synthetic profile,
// every request off the preview origin blocked, nothing sent to a model.
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');const AxeBuilder=require('@axe-core/playwright').default;
const {profile}=require('./helpers/preview-profile.cjs');
const base=process.env.MR_TEST_URL||'http://localhost:5190';
const assistants=[{id:'fixture-brief',name:'Weekly brief',description:'Turns meeting notes into a one-page brief.',instructions:'Synthetic.',model:'auto'}];
const heights={320:568,390:844,430:932,1280:800,1440:960};
(async()=>{const browser=await(process.env.MR_WEBKIT?webkit:chromium).launch();try{
const open=async(width,theme='light',keys={})=>{
 const phone=width<900;
 const ctx=await browser.newContext({viewport:{width,height:heights[width]},hasTouch:phone,reducedMotion:'reduce',colorScheme:theme});
 await ctx.addInitScript(()=>{if(window.top===window&&'serviceWorker'in navigator)navigator.serviceWorker.register=()=>Promise.reject(new Error('Disabled for synthetic QA'))});
 await ctx.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
 await profile(ctx,'preview-plus-tools',theme,{assistants},keys);
 const page=await ctx.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.goto(base);await page.locator('.composer textarea').waitFor({state:'attached'});
 return {ctx,page,errors,phone};
};
// Skip on the ordinary build: it keeps the Tools page and its old + menu.
{const {ctx,page}=await open(1440);const canvas=await page.locator('[data-lumen-canvas-shell]').count();await ctx.close();if(!canvas){console.log('SKIP plus-tools: not the Canvas presentation');return;}}
for(const width of [320,390,430,1280,1440])for(const theme of ['light','dark']){
 const {ctx,page,errors,phone}=await open(width,theme);
 const box=page.locator('.composer textarea');
 await box.fill('Keep this draft');
 // No Tools place in the sidebar or drawer any more.
 if(phone)await page.locator('.menu-btn:visible').first().click();
 assert.equal(await page.locator('aside.cv-nav').getByRole('button',{name:'Tools',exact:true}).count(),0,'Tools is not a sidebar place');
 await page.locator('aside.cv-nav').getByRole('button',{name:'Library',exact:true}).waitFor();
 if(phone){await page.keyboard.press('Escape');await page.locator('.scrim.visible').waitFor({state:'detached'}).catch(()=>{});await page.mouse.click(width-10,heights[width]/2);}
 // First layer: attach, this chat, three quick tools and Browse all tools; nothing clipped.
 await page.locator(phone?'.composer .tool-btn':'.composer .add-tool').first().click();
 const menu=page.getByRole('dialog',{name:'Add to your message'});await menu.waitFor();
 for(const name of ['Web search','Deep research','Create image','Document canvas','Browse all tools'])assert.equal(await menu.getByRole(name==='Web search'?'switch':'button',{name:new RegExp(`^${name}`)}).count(),1,`+ has ${name}`);
 if(phone)for(const name of ['Camera','Photos','Files'])await menu.getByRole('button',{name,exact:true}).waitFor();
 else await menu.getByRole('button',{name:'Files and images',exact:true}).waitFor();
 assert.equal(await menu.getByRole('button',{name:/^Compare models|^Data analysis|^Saved prompts|^Quick tools/}).count(),0,'the rest of the catalogue waits in Browse all tools');
 // A quick tool whose key is missing says so (the fixture has no Cloudflare key).
 assert.match(await menu.getByRole('button',{name:/^Create image/}).innerText(),/Needs key/);
 assert(await menu.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'+ menu has no sideways overflow');
 const audit=await new AxeBuilder({page}).include('.attach-menu').withTags(['wcag2a','wcag2aa']).analyze();assert.deepEqual(audit.violations.map(v=>v.id),[]);
 // Opening the picker starts nothing and keeps the draft.
 await menu.getByRole('button',{name:'Browse all tools'}).click();
 const picker=page.getByRole('dialog',{name:'Tools',exact:true});await picker.waitFor();
 assert.equal(await box.inputValue(),'Keep this draft');
 const search=picker.getByRole('searchbox',{name:'Search tools'});
 if(!phone)assert(await search.evaluate(el=>el===document.activeElement),'computers: the search has focus');
 // Every tool from the old Tools page is here.
 for(const name of ['Deep research','Ask your chats','Read a web page','Summarize a YouTube video','Document canvas','Create an image','Saved prompts','Data analysis','Calculate','Compare models','Study','Study partner','New assistant','Weekly brief'])await picker.getByRole('button',{name,exact:true}).first().waitFor();
 await picker.getByRole('switch',{name:'Web search'}).waitFor();await picker.getByText('Writing tools',{exact:true}).waitFor();
 assert.match(await picker.getByRole('region',{name:'Tool readiness'}).innerText(),/No Cloudflare or Hugging Face key[\s\S]*Create an image/);
 const fit=await picker.evaluate(el=>{const r=el.getBoundingClientRect();return {w:r.width,h:r.height,l:r.left,b:r.bottom,vw:innerWidth,vh:innerHeight,ow:el.scrollWidth>el.clientWidth+1}});
 assert(fit.l>=0&&fit.l+fit.w<=fit.vw+0.5&&fit.b<=fit.vh+0.5&&!fit.ow,`picker fits: ${JSON.stringify(fit)}`);
 const audit2=await new AxeBuilder({page}).include('.tool-picker').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(audit2.violations.map(v=>({id:v.id,n:v.nodes.map(n=>n.target)})),[]);
 // Find as you type, area filter, Escape clears the search before it closes.
 await search.fill('youtube');await picker.getByRole('button',{name:'Summarize a YouTube video',exact:true}).waitFor();assert.equal(await picker.getByRole('button',{name:'Deep research',exact:true}).count(),0);
 await search.fill('quarterly forecast');await picker.getByRole('status').filter({hasText:'No tools match'}).waitFor();
 await search.press('Escape');assert.equal(await search.inputValue(),'');await picker.waitFor();
 await picker.getByRole('group',{name:'Tool areas'}).getByRole('button',{name:'Assistants',exact:true}).click();
 await picker.getByRole('button',{name:'Weekly brief',exact:true}).waitFor();assert.equal(await picker.getByRole('button',{name:'Deep research',exact:true}).count(),0);
 await picker.getByRole('group',{name:'Tool areas'}).getByRole('button',{name:'All',exact:true}).click();
 // A tool with a missing key leads to key setup rather than pretending to run.
 await picker.getByRole('button',{name:'Create an image',exact:true}).click();await picker.waitFor({state:'detached'});
 const keysPage=page.locator('.settings-page:visible, .rc-page:visible').first();await keysPage.waitFor();
 await page.goBack();await keysPage.waitFor({state:'hidden'});assert.equal(await picker.count(),0,'the chosen destination replaced the picker');
 await page.getByRole('button',{name:/^Add (?:photos, )?files or a repository$/}).click();await page.getByRole('dialog',{name:'Add to your message'}).getByRole('button',{name:'Browse all tools'}).click();await picker.waitFor();
 // Back closes the picker; Forward brings it back with the chat and draft intact.
 await page.goBack();await picker.waitFor({state:'detached'});assert.equal(await box.inputValue(),'Keep this draft');
 await page.goForward();await picker.waitFor();
 // Choosing a tool closes the picker in one step and keeps the draft (Compare opens over this chat).
 await picker.getByRole('button',{name:'Compare models',exact:true}).click();await picker.waitFor({state:'detached'});
 await page.getByRole('dialog',{name:/Compare/}).waitFor();assert.equal(await box.inputValue(),'Keep this draft');
 await page.keyboard.press('Escape');await page.getByRole('dialog',{name:/Compare/}).waitFor({state:'detached'});
 // Older routes still land here: the event, the command palette and ⌘⇧L (assistants).
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('mr:library',{detail:'tools-page'})));await picker.waitFor();
 await picker.getByRole('button',{name:'Close tools'}).click();await picker.waitFor({state:'detached'});
 if(!phone){
  await page.keyboard.press('Control+K');await page.getByRole('dialog').filter({has:page.getByRole('combobox')}).first().waitFor().catch(()=>{});
  const palette=page.locator('.command-palette, [role="dialog"]').last();await page.keyboard.type('Browse all tools');await page.keyboard.press('Enter');await picker.waitFor();
  await page.keyboard.press('Escape');await picker.waitFor({state:'detached'});
  await page.waitForTimeout(50);const focused=await page.evaluate(()=>document.activeElement?.outerHTML.slice(0,120));
  assert(await page.evaluate(()=>document.activeElement?.matches('.composer .add-tool, .composer .tool-btn, .composer textarea')||false),`focus returns to the message box controls: ${focused}`);
 }
 assert.deepEqual(errors,[]);
 await ctx.close();console.log('PASS + and Browse all tools',width,theme);
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
