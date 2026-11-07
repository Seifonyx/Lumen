import { spawn } from 'node:child_process';
import { chromium, webkit } from '../../node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const port=5206, base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--config','native/vite.config.ts','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore'});
try {
 for(let i=0;i<100;i++) { try {if((await fetch(base)).ok)break;}catch{} await new Promise(r=>setTimeout(r,100)); }
 for(const engine of [chromium,webkit]) {
  const browser=await engine.launch();
  try {
   const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1'});
   const outgoing=[];
   await ctx.route('**/*',route=>{
    if(new URL(route.request().url()).origin===base)return route.continue();
    outgoing.push(route.request().url());return route.abort();
   });
   const page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base);
   await page.getByRole('button',{name:'Open Demo A',exact:true}).click();
   const input=page.locator('.composer textarea');
   await input.fill('Synthetic demo message');
   await page.getByRole('button',{name:'Send',exact:true}).click();
   await page.getByText('Offline demonstration.',{exact:false}).first().waitFor();
   await input.fill('Draft stays with A');
   await page.locator('.menu-btn').first().click();
   await page.locator('aside.cv-nav').getByRole('button',{name:'Router',exact:true}).click();
   await page.locator('.rc-page').waitFor();
   await page.keyboard.press('Escape');await input.waitFor();
   assert.equal(await input.inputValue(),'Draft stays with A');
   await page.waitForTimeout(600);
   await page.screenshot({path:'tests/e2e/out/native-demo-'+engine.name()+'.png'});
   await page.locator('.menu-btn').first().click();
   await page.locator('.cv-account').click();
   await page.getByRole('button',{name:/^Account:/}).click();
   await page.getByRole('button',{name:'Sign out',exact:true}).click();
   await page.getByRole('button',{name:'Open Demo B',exact:true}).click();
   await input.waitFor();assert.equal(await input.inputValue(),'');
   assert(!await page.getByText('Synthetic demo message',{exact:true}).count());
   assert.deepEqual(outgoing,[]);assert.deepEqual(errors,[]);
   assert.equal(await page.evaluate(async()=>('serviceWorker' in navigator)?(await navigator.serviceWorker.getRegistrations()).length:0),0);
   console.log('PASS native demo browser',engine.name(),'local reply, Router Back, draft, profile separation, no remote traffic or service worker');
   await ctx.close();
  }finally{await browser.close()}
 }
}finally{server.kill()}
