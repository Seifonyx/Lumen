import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {chromium,webkit} from '../../node_modules/playwright/index.mjs';
const base='http://127.0.0.1:5206';let server;
async function start(outDir){
 server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--config','native/vite.config.ts','--host','127.0.0.1','--port','5206','--strictPort','--outDir',resolve(outDir)],{stdio:'ignore'});
 for(let i=0;i<100;i++){try{if((await fetch(base)).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('Local preview did not start');
}
async function stop(){if(server&&server.exitCode===null){const exited=once(server,'exit');server.kill();await exited;}server=null;}
async function logout(page){
 await page.locator('.menu-btn').first().click();await page.locator('.cv-account').click();
 await page.getByRole('button',{name:/^Account:/}).click();await page.getByRole('button',{name:'Sign out',exact:true}).click();
}
try{
 for(const engine of [chromium,webkit]){
  await start(process.env.LUMEN_NATIVE_BASELINE||'native/www');const browser=await engine.launch();
  try{
   const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1'});
   await page.addInitScript(()=>{window.__exports=[];window.webkit={messageHandlers:{nativeDownload:{postMessage:value=>window.__exports.push(value)}}};});
   const outgoing=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',r=>{if(new URL(r.request().url()).origin===base)return r.continue();outgoing.push(r.request().url());return r.abort();});
   await page.goto(base);await page.getByRole('button',{name:'Open Demo A',exact:true}).click();
   const input=page.locator('.composer textarea');await input.fill('Saved before compatible update');
   await page.getByRole('button',{name:'Send',exact:true}).click();
   await page.getByText('Offline demonstration.',{exact:false}).first().waitFor();
   await page.getByRole('button',{name:'Stop',exact:true}).waitFor({state:'hidden'});
   await input.fill('Unsent upgrade draft A');
   await page.waitForFunction(()=>Object.keys(localStorage).some(k=>k.startsWith('mr.draft.preview-native-demo-a.')&&localStorage.getItem(k)==='Unsent upgrade draft A'));
   await stop();await start('native/www');await page.reload();
   await page.getByText('Saved before compatible update',{exact:true}).waitFor();
   await input.waitFor();assert.equal(await input.inputValue(),'Unsent upgrade draft A');
   const file=page.locator('.composer input[type=file][multiple]').first();
   await file.setInputFiles({name:'native-sample.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic attachment only.')});
   await page.getByText('native-sample.txt',{exact:true}).first().waitFor();
   await page.locator('.menu-btn').first().click();await page.locator('aside.cv-nav').getByRole('button',{name:'Router',exact:true}).click();
   await page.locator('.rc-page').waitFor();await page.keyboard.press('Escape');await input.waitFor();
   assert.equal(await input.inputValue(),'Unsent upgrade draft A');await page.getByText('native-sample.txt',{exact:true}).first().waitFor();
   await input.fill('Cancel the synthetic stream');await page.getByRole('button',{name:'Send',exact:true}).click();
   await page.getByRole('button',{name:'Stop',exact:true}).click();
   await page.getByRole('button',{name:'Stop',exact:true}).waitFor({state:'hidden'});
   await page.waitForTimeout(100);const stopped=await page.locator('.message-row').last().innerText();
   await page.waitForTimeout(600);assert.equal(await page.locator('.message-row').last().innerText(),stopped);
   for(const colorScheme of ['light','dark']){await page.emulateMedia({colorScheme});await page.waitForTimeout(250);await page.screenshot({path:`tests/e2e/out/native-foundation-${engine.name()}-${colorScheme}.png`});}
   // Router policy and Activity use detached anchors; ordinary files use attached ones.
   await page.evaluate(()=>{
    for(const [name,attached] of [['policy.json',false],['activity.csv',true]]){
     const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['Synthetic export.']));a.download=name;
     if(attached)document.body.append(a);a.click();a.remove();
    }
    const a=document.createElement('a');a.id='native-export-click';a.style.cssText='position:fixed;top:100px;left:20px;z-index:99999';a.textContent='Synthetic export';a.href=URL.createObjectURL(new Blob(['Synthetic export.']));a.download='manual.txt';document.body.append(a);
   });
   await page.locator('#native-export-click').click();
   await page.waitForFunction(()=>window.__exports.length===3,{},{timeout:5000});
   const exports=await page.evaluate(()=>window.__exports);
   assert.deepEqual(exports.map(x=>x.name).sort(),['activity.csv','manual.txt','policy.json']);
   assert(exports.every(x=>Buffer.from(x.data,'base64').toString()==='Synthetic export.'));
   await page.locator('#native-export-click').evaluate(el=>el.remove());
   await logout(page);await page.getByRole('button',{name:'Open Demo B',exact:true}).click();await input.waitFor();
   assert.equal(await input.inputValue(),'');assert.equal(await page.getByText('Saved before compatible update',{exact:true}).count(),0);
   assert.equal(await page.getByText('native-sample.txt',{exact:true}).count(),0);
   await logout(page);await page.getByRole('button',{name:'Open Demo A',exact:true}).click();
   await page.locator('.menu-btn').first().click();await page.locator('aside.cv-nav .chat-row .chat-open').first().click();
   await page.getByText('Saved before compatible update',{exact:true}).waitFor();
   assert.deepEqual(outgoing,[]);assert.deepEqual(errors,[]);
   console.log('PASS',engine.name(),process.env.LUMEN_NATIVE_BASELINE?'baseline-to-current same-origin update':'same-build reload','chat/draft persistence, attachment navigation, Stop, attached/detached export IPC, A/B/A, Light/Dark, no external traffic');
  }finally{await browser.close();await stop();}
 }
}finally{await stop();}
