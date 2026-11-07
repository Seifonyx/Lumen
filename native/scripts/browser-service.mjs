import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
import {preview} from '../../node_modules/vite/dist/node/index.js';
import {chromium,webkit} from '../../node_modules/playwright/index.mjs';
// Default is a fictitious compile fixture. A local explicit config can test the real SDK metadata without login.
const directory=mkdtempSync(join(tmpdir(),'lumen-service-qa-')),fixture=join(directory,'config.json');
writeFileSync(fixture,JSON.stringify({mode:'isolated-test',projectId:'lumen-ios-test-synthetic',projectNumber:'123456789012',apiKey:'synthetic-not-a-google-key',appId:'1:123456789012:web:abc123',iosClientId:'123456789012-synthetic-ios.apps.googleusercontent.com',webClientId:'123456789012-synthetic-web.apps.googleusercontent.com',bundleId:'io.github.seifonyx.lumen.demo',approvedTestEnvironment:true}));
let server;
try{
 const build=spawnSync(process.execPath,['native/scripts/build.mjs'],{env:{...process.env,LUMEN_NATIVE_MODE:'isolated-test',LUMEN_NATIVE_SERVICE_CONFIG:process.env.LUMEN_NATIVE_SERVICE_CONFIG||fixture,LUMEN_NATIVE_OUT_DIR:'native/service-qa'},encoding:'utf8'});
 if(build.status!==0)throw Error('Isolated service build failed: '+build.stderr.slice(-2500));
 server=await preview({configFile:'native/vite.config.ts',build:{outDir:resolve('native/service-qa')},preview:{host:'127.0.0.1',port:5211,strictPort:true}});
 const base='http://127.0.0.1:5211';
 for(const engine of [chromium,webkit]){
  const browser=await engine.launch();
  try{
   const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),outgoing=[],errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===base)return r.continue();outgoing.push(u.origin);return r.abort();});
   await page.addInitScript(()=>{if(!sessionStorage.getItem('native-service-seeded')){
    localStorage.setItem('mr.preview_user',JSON.stringify({uid:'preview-native-demo-a',displayName:'Demo A'}));
    localStorage.setItem('mr.account.preview-native-demo-a',JSON.stringify({settings:{projects:[{id:'retained',name:'Existing demo project'}]}}));
    sessionStorage.setItem('native-service-seeded','1');
   }});
   await page.goto(base);await page.getByRole('button',{name:'Sign in with Google',exact:true}).waitFor();
   const prior=await page.evaluate(()=>localStorage.getItem('mr.account.preview-native-demo-a'));
   assert.equal(await page.locator('.composer textarea').count(),0);assert.equal(await page.getByRole('button',{name:'Open Demo A',exact:true}).count(),0);
   await page.getByRole('button',{name:'Sign in with Google',exact:true}).click();await page.getByRole('alert').waitFor();
   assert.equal(await page.locator('.composer textarea').count(),0);assert.equal(await page.evaluate(()=>localStorage.getItem('mr.account.preview-native-demo-a')),prior);
   await page.reload();await page.getByRole('button',{name:'Sign in with Google',exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>localStorage.getItem('mr.account.preview-native-demo-a')),prior);
   assert.equal(await page.locator('.composer textarea').count(),0);assert.deepEqual(outgoing,[]);assert.deepEqual(errors,[]);
   console.log('PASS',engine.name(),'isolated-service login/reload, unsupported bridge fails closed, no demo fallback or demo data removal, no external traffic; real Google OAuth not exercised');
  }finally{await browser.close();}
 }
}finally{if(server)await new Promise(resolve=>server.httpServer.close(resolve));unlinkSync(fixture);rmdirSync(directory);}
