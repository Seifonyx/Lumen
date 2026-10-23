const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const photo = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAPAAAACgCAIAAAC9uXYyAAABxUlEQVR4nO3SUQkAIBTAwFfLQGayriUEYRxcgH1s1j6QMd8L4CFDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphiblAtvNGJwm3OWxAAAAAElFTkSuQmCC','base64');
const { profile, seed } = require('./helpers/preview-profile.cjs');
const url = process.env.MR_TEST_URL || 'http://localhost:5190/';
const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1';
(async () => {
 const browser = await (process.env.MR_WEBKIT ? webkit : chromium).launch();
 try {
  for (const [width,height,reduced] of [[390,844,false],[320,740,false],[1280,900,false],[390,844,true],[844,390,false]]) {
   const phone=width<900, uid=`attachment-motion-${width}-${reduced}`;
   const ctx=await browser.newContext({viewport:{width,height},isMobile:phone,hasTouch:phone,serviceWorkers:'block',reducedMotion:reduced?'reduce':'no-preference',...(phone?{userAgent:ua}:{})});
   await profile(ctx,uid,phone?'dark':'light');
   await ctx.addInitScript(()=>{window.__mrMotion=true;window.__attachmentAnimations=[];const animate=Element.prototype.animate;Element.prototype.animate=function(...args){const a=animate.apply(this,args);window.__attachmentAnimations.push({animation:a,element:this});return a;};});
   const page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(new URL('/privacy.html',url).href);
   const now=Date.now();
   await seed(page,uid,[{id:'motion-chat',title:'Motion attachments',createdAt:now,updatedAt:now,messages:[{id:'user',role:'user',text:'Preview these files.',files:[{id:'note',kind:'text',name:'source.txt',mime:'text/plain',text:'SOURCE_PREVIEW_MARKER',size:21}],createdAt:now},{id:'reply',role:'assistant',text:'````file:report.txt\nREPORT_PREVIEW_MARKER\n````',createdAt:now+1}]}]);
   await page.goto(url);
   await page.locator('.composer textarea').fill('KEEP_ATTACHMENT_DRAFT');
   if(phone)await page.locator('.menu-btn').click();
   await page.locator('.sidebar .chat-open',{hasText:'Motion attachments'}).click();
   await page.locator('.file-card').waitFor();
   await page.locator('.composer textarea').fill('KEEP_ATTACHMENT_DRAFT');
   const input=page.locator('.composer input[type=file][multiple]').last();
   const file=(name)=>({name,mimeType:'text/plain',buffer:Buffer.from('ATTACHMENT_PREVIEW_MARKER '+name)});
   // Compare the same typography and committed draft layout, not a fallback-font frame with a loaded-font frame.
   await page.evaluate(async()=>{
    await new Promise(resolve=>requestAnimationFrame(resolve));
    await document.fonts.ready;
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   });
   const composerHeight = await page.locator('.composer').evaluate(el=>el.offsetHeight);
   await input.setInputFiles([file('first.txt'),file('second.txt'),file('third.txt')]);
   await page.waitForFunction(()=>document.querySelectorAll('.attachment:not(.exit-ghost):not(.loading)').length===3);
   const second=page.getByRole('button',{name:'Preview second.txt',exact:true});
   assert.ok(await second.isVisible(),'Composer attachments expose previews');
   await page.waitForTimeout(450);
   await page.getByRole('button',{name:'Remove first.txt',exact:true}).click();
   const tray=page.locator('.attachments');
   const moving=await tray.evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.id==='attachment-reflow').length);
   assert.equal(moving>0,!reduced,'Remaining attachment chips animate reflow only with motion enabled');
   await page.waitForTimeout(350);
   const sourceBox = await second.locator('..').boundingBox();
   await second.click();
   const dialog=page.getByRole('dialog');
   await dialog.waitFor();
   assert.equal(await page.evaluate(()=>window.__attachmentAnimations.some(a=>a.animation.id==='preview-expand')),!reduced,'File preview expands from its source');
   if(!reduced) {
    const start=await dialog.evaluate(el=>{const a=window.__attachmentAnimations.find(a=>a.element===el&&a.animation.id==='preview-expand').animation;const m=new DOMMatrixReadOnly(a.effect.getKeyframes()[0].transform);return {x:el.offsetLeft+el.offsetWidth/2+m.m41,y:el.offsetTop+el.offsetHeight/2+m.m42,width:el.offsetWidth*m.a,height:el.offsetHeight*m.d};});
    assert.ok(Math.abs(start.x-(sourceBox.x+sourceBox.width/2))<2&&Math.abs(start.y-(sourceBox.y+sourceBox.height/2))<2,'Preview expansion starts at the actual source card');
    assert.ok(Math.abs(start.width-sourceBox.width)<2&&Math.abs(start.height-sourceBox.height)<2,'Preview starts at the source dimensions');
   }
   assert.match(await dialog.innerText(),/ATTACHMENT_PREVIEW_MARKER/);
   await page.waitForTimeout(400);
   if(width===390&&!reduced||width===1280){fs.mkdirSync('tests/e2e/out',{recursive:true});await page.screenshot({path:`tests/e2e/out/attachment-preview-${process.env.MR_WEBKIT?'webkit':'chromium'}-${width}.png`});}
   await page.getByRole('button',{name:'Close',exact:true}).click();
   if(!reduced)assert.ok(await dialog.evaluate(el=>el.getAnimations().some(a=>a.id==='preview-return')),'Closing returns to the source');
   await dialog.waitFor({state:'detached'});
   assert.equal(await page.locator('.composer textarea').inputValue(),'KEEP_ATTACHMENT_DRAFT');
   // Generated files use the whole card as the source; Escape closes safely, even during entry.
   await page.getByRole('button',{name:'Preview report.txt',exact:true}).click();
   await dialog.waitFor();
   await page.locator('.file-card').evaluate(el=>el.style.display='none');
   await page.keyboard.press('Escape');
   await dialog.waitFor({state:'detached'});
   await page.locator('.file-card').evaluate(el=>el.style.display='');
   assert.equal(await page.locator('.exit-ghost [role=dialog]').count(),0,'Origin transitions do not add a second modal exit copy');
   await page.getByRole('button',{name:'Remove second.txt',exact:true}).click();
   await page.getByRole('button',{name:'Remove third.txt',exact:true}).click();
   await page.waitForTimeout(400);
   assert.equal(await page.locator('.attachments').evaluate(el=>el.offsetHeight),0,'Removing the last attachment leaves no empty gap');
   assert.equal(await page.locator('.composer').evaluate(el=>el.offsetHeight),composerHeight,'Composer returns to its original size');
   await input.setInputFiles({name:'sample.png',mimeType:'image/png',buffer:photo});
   const photoButton=page.getByRole('button',{name:'Preview sample.png',exact:true});
   await page.waitForFunction(()=>document.querySelector('.attachment:not(.loading) img'));
   await photoButton.click();
   const viewer=page.locator('.image-viewer');
   await viewer.waitFor();
   assert.equal(await viewer.locator('.iv-img').getAttribute('alt'),'sample.png');
   await viewer.getByRole('button',{name:'Close',exact:true}).click();
   await viewer.waitFor({state:'detached'});
   await page.getByRole('button',{name:'Remove sample.png',exact:true}).click();
   await page.waitForTimeout(350);
   assert.equal(await page.locator('.composer textarea').inputValue(),'KEEP_ATTACHMENT_DRAFT');
   // Uploaded HTML is inspected as text, never run as a generated interactive page.
   let outbound=0;
   await ctx.route('https://preview-should-not-load.invalid/**',route=>{outbound++;return route.fulfill({body:''});});
   await input.setInputFiles({name:'uploaded.html',mimeType:'text/html',buffer:Buffer.from('<script>fetch("https://preview-should-not-load.invalid/script")</script><img src="https://preview-should-not-load.invalid/image">')});
   await page.getByRole('button',{name:'Preview uploaded.html',exact:true}).waitFor({state:'visible'});
   await page.waitForFunction(()=>!document.querySelector('.attachment.loading'));
   await page.getByRole('button',{name:'Preview uploaded.html',exact:true}).click();
   await dialog.locator('.code-preview').waitFor();
   assert.equal(await dialog.locator('iframe').count(),0,'Uploaded HTML remains a text preview');
   assert.match(await dialog.innerText(),/<script>/);
   assert.equal(outbound,0,'Previewing uploaded HTML must not run code or fetch remote content');
   await page.keyboard.press('Escape');
   await dialog.waitFor({state:'detached'});
   await page.getByRole('button',{name:'Remove uploaded.html',exact:true}).click();
   await page.waitForTimeout(300);
   // Scroll the tray, interrupt a reflow, then change chat while removal copies still exist.
   await input.setInputFiles(Array.from({length:7},(_,i)=>file(`scroll-${i}-long-attachment-name.txt`)));
   await page.waitForFunction(()=>document.querySelectorAll('.attachment:not(.loading):not(.exit-ghost)').length===7);
   await page.waitForTimeout(300);
   await tray.evaluate(el=>el.scrollLeft=el.scrollWidth);
   await page.getByRole('button',{name:'Remove scroll-5-long-attachment-name.txt',exact:true}).click();
   if(!reduced) {
    const displacement=await page.getByRole('button',{name:'Preview scroll-6-long-attachment-name.txt',exact:true}).locator('..').evaluate(el=>{const a=el.getAnimations().find(a=>a.id==='attachment-reflow');return a?new DOMMatrixReadOnly(a.effect.getKeyframes()[0].transform).m41:0;});
    assert.ok(displacement>0&&displacement<250,'Horizontal scroll does not add a false displacement to reflow');
   }
   await page.getByRole('button',{name:'Remove scroll-4-long-attachment-name.txt',exact:true}).click();
   const mod=await page.evaluate(()=>/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent)?'Meta':'Control');
   await page.keyboard.press(`${mod}+Shift+O`);
   await page.waitForFunction(()=>!document.querySelector('.file-card'));
   assert.equal(await page.locator('.attachments .attachment').count(),0,'Changing chats removes real attachments and fading copies immediately');
   assert.equal(await page.locator('.attachments').evaluate(el=>el.offsetHeight),0,'Scope changes do not animate an empty gap into the next chat');
   assert.ok(!await page.evaluate(()=>document.body.innerText.includes('scroll-')));
   assert.deepEqual(errors,[]);
   console.log(`PASS attachment motion ${process.env.MR_WEBKIT?'webkit':'chromium'} ${width}x${height} ${reduced?'reduced':'motion'}`);
   await ctx.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
