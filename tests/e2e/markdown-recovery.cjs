const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
const {profile}=require('./helpers/preview-profile.cjs');
(async()=>{const browser=await(process.env.MR_WEBKIT?webkit:chromium).launch();try{
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await profile(context,'preview-markdown-recovery');
 let blocked=0;await context.route('**/assets/markdown-extras-*.css',route=>{blocked++;return route.abort('failed');});
 await context.route('**/generativelanguage.googleapis.com/**',route=>route.request().url().includes('/models?')?route.fallback():route.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({candidates:[{content:{parts:[{text:'Readable code despite optional formatting failure:\n\n```js\nconst readable = 42;\n```'}]},finishReason:'STOP'}]})+'\n\n'}));
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(process.env.MR_TEST_URL || 'http://localhost:5190/');await page.locator('.composer textarea').fill('Show a code example');await page.getByRole('button',{name:'Send',exact:true}).click();
 await page.locator('.code-block code').filter({hasText:'const readable = 42;'}).waitFor();await page.getByRole('button',{name:'Stop',exact:true}).waitFor({state:'detached'});
 assert(blocked>0,'optional styles failed during the real workflow');assert.deepEqual(errors,[],'formatting failure must not escape into the chat application');
 await context.unroute('**/assets/markdown-extras-*.css');await page.reload();await page.locator('.composer textarea').waitFor();
 await page.locator('.composer textarea').fill('Show another code example');await page.getByRole('button',{name:'Send',exact:true}).click();await page.locator('.code-block code .hljs-keyword').first().waitFor();assert.deepEqual(errors,[]);
 console.log(`PASS markdown recovery ${process.env.MR_WEBKIT?'webkit':'chromium'}: failed optional stylesheet preserves readable reply, reload restores highlighting`);await context.close();
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exit(1)});
