// Real Canvas shell, synthetic identity and intercepted model discovery. No provider inference.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.MR_TEST_URL || 'http://localhost:5190/';
const {chromium,webkit}=require('playwright');
const {profile,seed}=require('./helpers/preview-profile.cjs');
(async()=>{
 const browser=await(process.env.MR_WEBKIT?webkit:chromium).launch();
 try {for(const width of [320,390,430,1440]) {
 const context=await browser.newContext({viewport:{width,height:width===320?568:width===1440?960:844},hasTouch:width<900,serviceWorkers:'block',reducedMotion:'reduce'});
 await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
 await profile(context,'preview-navigation-reset',width===390?'dark':'light',{defaultModel:'auto'});
 const page=await context.newPage();await page.goto(new URL('/privacy.html',base).href);const now=Date.now();await seed(page,'preview-navigation-reset',[{id:'review-chat',title:'Review content',createdAt:now,updatedAt:now,messages:[],documents:[{id:'review-document',name:'Review plan.md',content:'# Review plan\n\nSynthetic document.',updatedAt:now}]}]);await page.goto(base);await page.locator('.composer textarea').waitFor();if(!await page.locator('.app[data-lumen-canvas-shell]').count()){await context.close();console.log('Not applicable to ordinary presentation');return;}await page.locator('.composer textarea').fill('Draft stays in its original chat');
 const drawer=async()=>{if(width<900)await page.locator('.menu-btn').first().click();};
 await drawer();await page.locator('aside.cv-nav').getByRole('button',{name:'Models & routing',exact:true}).click();
 await page.locator('.rc-page').waitFor();assert.equal(await page.locator('.rc-dock').count(),0);
 if(width<900){
 await page.getByRole('navigation',{name:'Routing sections'}).getByRole('button',{name:'Providers',exact:true}).click();
 await page.locator('[data-provider="gemini"]').click();
 await page.getByRole('region',{name:'Provider detail'}).waitFor();
 await page.getByRole('button',{name:'More actions',exact:true}).click();
 await page.getByRole('menuitem',{name:'Connection settings',exact:true}).click();
 await page.locator('.settings-page').waitFor();
 await page.getByRole('button',{name:'Back',exact:true}).first().click();
 await page.getByRole('region',{name:'Provider detail'}).waitFor();
 await page.locator('.phone-navigation').getByRole('button',{name:'Back',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('.rc-providers.has-detail'));
 await page.goForward();await page.getByRole('region',{name:'Provider detail'}).waitFor();
 await page.goBack();await page.goBack();await page.getByRole('navigation',{name:'Routing sections'}).waitFor();
 await page.goBack();await page.locator('.composer textarea').waitFor();
 }else await page.getByRole('button',{name:'Back to chat',exact:true}).click();
 assert.equal(await page.locator('.composer textarea').inputValue(),'Draft stays in its original chat');
 await drawer();await page.locator('aside.cv-nav').getByRole('button',{name:'Library',exact:true}).click();
 await page.getByRole('searchbox',{name:'Search your library'}).fill('Review');
 await page.getByRole('button',{name:'More for Review plan.md',exact:true}).click();
 await page.getByRole('menu',{name:'Screen actions'}).waitFor();
 await page.getByRole('menuitem',{name:'Delete document…',exact:true}).click();
 await page.getByRole('dialog',{name:'Delete “Review plan.md”?' }).waitFor();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('dialog',{name:'Delete “Review plan.md”?' }).waitFor({state:'detached'});
 await page.getByRole('button',{name:'More for Review plan.md',exact:true}).click();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Open Review plan.md',exact:true}).click();await page.locator('.canvas-panel').waitFor();
 await page.goBack();await page.getByRole('searchbox',{name:'Search your library'}).waitFor();
 assert.equal(await page.locator('.canvas-panel').count(),0);assert.equal(await page.getByRole('searchbox',{name:'Search your library'}).inputValue(),'Review');
 await page.getByRole('searchbox',{name:'Search your library'}).fill('Remember this filter');
 assert.equal(await page.locator('.glass-tabbar').count(),0);
 await page.goBack();await page.locator('.composer textarea').waitFor();await page.goForward();
 assert.equal(await page.getByRole('searchbox',{name:'Search your library'}).inputValue(),'Remember this filter');
 await page.goBack();await drawer();await page.locator('aside.cv-nav').getByRole('button',{name:'Tools',exact:true}).click();
 await page.getByRole('searchbox',{name:'Search tools'}).fill('Study');

 assert.equal(await page.locator('.glass-tabbar').count(),0);
 await page.getByRole('searchbox',{name:'Search tools'}).fill('');
 await page.getByRole('button',{name:'New assistant',exact:true}).click();
 await page.getByRole('textbox',{name:'Library item name'}).fill('Unsent assistant');
 await page.getByRole('textbox',{name:'Library instructions'}).fill('Preserve this private test draft');
 await page.goBack();await page.getByRole('searchbox',{name:'Search tools'}).waitFor();
 await page.goBack();await page.locator('.composer textarea').waitFor();
 await page.goForward();await page.getByRole('searchbox',{name:'Search tools'}).waitFor();
 await page.goForward();
 assert.equal(await page.getByRole('textbox',{name:'Library item name'}).inputValue(),'Unsent assistant');
 await page.goBack();
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 fs.mkdirSync('/tmp/lumen-reset/screens',{recursive:true});await page.screenshot({path:`/tmp/lumen-reset/screens/tools-${width}.png`,animations:'disabled'});
 await context.close();console.log('PASS navigation journey',width);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
