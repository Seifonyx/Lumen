// Targeted provider editor regression. Real Canvas components, synthetic profiles and intercepted catalog only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require('playwright');
const { profile } = require('./helpers/preview-profile.cjs');
const base = process.env.MR_TEST_URL || 'http://localhost:5190/';
const out = process.env.PROVIDER_WRAP_OUT || 'tests/e2e/out/provider-wrap';
const widths = (process.env.PROVIDER_WRAP_WIDTHS || '320,390,430').split(',').map(Number);
fs.mkdirSync(out, { recursive: true });
const engine = process.env.MR_WEBKIT ? 'webkit' : 'chromium';

async function containment(card) {
  return card.evaluate(el => {
    const edge = el.getBoundingClientRect(), failures = [];
    const describe = node => `${node.tagName.toLowerCase()}.${node.className || ''}`;
    for (const node of el.querySelectorAll('summary,.provider-name,.key-status-pill,.provider-connection-body,p,a,label,span,input,button,.key-input-wrap')) {
      const r = node.getBoundingClientRect(); if (!r.width || !r.height) continue;
      if (r.left < edge.left - 1 || r.right > edge.right + 1) failures.push({ kind:'element', node:describe(node), left:r.left, right:r.right, cardRight:edge.right });
    }
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode; if (!text.textContent.trim()) continue;
      const range = document.createRange(); range.selectNodeContents(text);
      for (const r of range.getClientRects()) if (r.width && (r.left < edge.left - 1 || r.right > edge.right + 1)) {
        failures.push({ kind:'text', node:describe(text.parentElement), text:text.textContent.slice(0,60), left:r.left, right:r.right, cardRight:edge.right });
      }
    }
    if (edge.left < -1 || edge.right > innerWidth + 1) failures.push({kind:'card',left:edge.left,right:edge.right,width:innerWidth});
    return failures;
  });
}
(async () => {
 const browser=await (engine==='webkit'?webkit:chromium).launch(), results=[];
 try {
  for (const width of widths) for (const theme of ['light','dark']) {
   const context=await browser.newContext({viewport:{width,height:width===320?568:width===390?844:932},hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
   await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
   await profile(context,`preview-provider-wrap-${width}-${theme}`,theme,{}, {providerConnections:{anthropic:'SYNTHETIC_ONLY',cloudflare:'SYNTHETIC_ONLY',providerAccess:{anthropic:false,cloudflare:false}}});
   const page=await context.newPage(), errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
   try {
    await page.goto(base);await page.locator('.composer textarea').waitFor();
    if(!await page.locator('.app[data-lumen-canvas-shell]').count()){console.log('Not applicable to ordinary presentation');return;}
    const draft='Containment regression — café';await page.locator('.composer textarea').fill(draft);
    await page.getByRole('button',{name:'Open chats',exact:true}).first().click();
    await page.locator('aside.cv-nav').getByRole('button',{name:'Router',exact:true}).click();
    const rc=page.locator('.rc-page');await rc.getByRole('navigation',{name:'Router sections'}).getByRole('button',{name:'Providers',exact:true}).click();
    for (const provider of ['anthropic','cloudflare']) {
     await rc.getByRole('searchbox',{name:'Find a provider'}).fill(provider);
     await rc.locator(`[data-provider="${provider}"]`).click();
     await rc.getByRole('region',{name:'Provider detail'}).getByRole('button',{name:'Enable provider',exact:true}).click();
     // Router: the provider's key editor is on its own page, inside Router's scroller.
     const settings=rc.getByRole('region',{name:'Provider detail'}),card=settings.locator(`#sb-connection .provider-connection[data-provider="${provider}"]`);
     await card.waitFor();await page.evaluate(()=>document.fonts.ready);
     const diagnostic=await card.evaluate(el=>[el,...el.querySelectorAll('.provider-connection-body,p,.provider-consent,.provider-consent span,.key-input-wrap')].map(n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect();return {node:n.tagName+'.'+n.className,width:r.width,right:r.right,scrollWidth:n.scrollWidth,clientWidth:n.clientWidth,display:s.display,minWidth:s.minWidth,grid:s.gridTemplateColumns,whiteSpace:s.whiteSpace,overflow:s.overflow}}));
     fs.writeFileSync(path.join(out,`${width}-${theme}-${provider}-layout.json`),JSON.stringify(diagnostic,null,2));
     for (const scale of [1,1.5]) {
      if(scale===1.5) await settings.evaluate(el=>{const sizes=[el,...el.querySelectorAll('*')].map(n=>[n,parseFloat(getComputedStyle(n).fontSize)]);for(const[n,size]of sizes)n.style.fontSize=`${size*1.5}px`;});
      await page.evaluate(()=>document.activeElement?.blur());
      await rc.locator('.rc-scroll').evaluate(el=>el.scrollTop=0);
      if(scale===1)await page.screenshot({path:path.join(out,`${width}-${theme}-${provider}-overview.png`),animations:'disabled'});
      assert.equal(await card.getAttribute('open')!==null,true,'measure expanded provider content');
      await card.evaluate(el=>{const scroll=el.closest('.rc-scroll');scroll.scrollTop+=el.getBoundingClientRect().top-scroll.getBoundingClientRect().top-12;});
      await page.screenshot({path:path.join(out,`${width}-${theme}-${provider}-${scale===1?'normal':'large'}.png`),animations:'disabled'});
      assert.deepEqual(await containment(card),[],`${width}px ${theme} ${provider} ${scale}x text and controls must fit visible card`);
      assert(await rc.locator('.rc-scroll').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'the provider page cannot horizontally scroll');
      results.push({width,theme,provider,scale,passed:true});
     }
     const key=card.locator('input[type="password"]');assert.equal(await key.inputValue(),'SYNTHETIC_ONLY');
     await card.getByRole('link',{name:'Provider dashboard'}).scrollIntoViewIfNeeded();assert(await card.getByRole('link',{name:'Provider dashboard'}).isVisible());
     const permission=card.locator('input[type="checkbox"]');
     if(width===320){await permission.evaluate(el=>{const label=el.closest('label'),scroll=el.closest('.rc-scroll');scroll.scrollTop+=label.getBoundingClientRect().top-scroll.getBoundingClientRect().top-12;});await page.screenshot({path:path.join(out,`${width}-${theme}-${provider}-permission-large.png`),animations:'disabled'});}
     await permission.check();await key.fill('SYNTHETIC_UNSAVED');
     assert.equal(await card.locator('.key-status-pill').innerText(),'Unsaved changes');
     await settings.getByRole('button',{name:'Save keys',exact:true}).scrollIntoViewIfNeeded();assert(await settings.getByRole('button',{name:'Save keys',exact:true}).isVisible());if(provider==='anthropic')assert(await settings.getByRole('button',{name:'Save keys',exact:true}).isEnabled(),'valid unsaved edits enable Save keys');
     assert(!/SYNTHETIC_UNSAVED|SYNTHETIC_ONLY/.test(await rc.innerText()),'keys are never shown as text');
     await page.goBack();await rc.locator(`[data-provider="${provider}"]`).waitFor();
     await page.goForward();await card.waitFor();assert.equal(await key.inputValue(),'SYNTHETIC_UNSAVED');assert(await permission.isChecked(),'Forward restores the unsaved permission');
     await page.goBack();
    }
    assert.equal(await page.locator('.composer textarea').inputValue(),draft);assert.deepEqual(errors,[]);
   } finally {await context.close();}
  }
 } finally {await browser.close();fs.writeFileSync(path.join(out,`results-${engine}.json`),JSON.stringify({engine,physicalIPhone:false,syntheticTextScale:true,results},null,2));}
 console.log(`PASS provider editor containment ${engine}: ${results.length} cases`);
})().catch(e=>{console.error(e);process.exit(1)});
