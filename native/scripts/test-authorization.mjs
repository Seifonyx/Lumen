import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
import {mkdtempSync,writeFileSync,unlinkSync,rmdirSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {chromium,webkit} from '../../node_modules/playwright/index.mjs';
const folder=mkdtempSync(join(tmpdir(),'lumen-auth-contract-')),file=join(folder,'config.json');
writeFileSync(file,JSON.stringify({mode:'isolated-test',projectId:'lumen-ios-test',projectNumber:'123456789012',apiKey:'synthetic-not-a-key',appId:'1:123456789012:web:abc123',iosClientId:'123456789012-test-ios.apps.googleusercontent.com',webClientId:'123456789012-test-web.apps.googleusercontent.com',bundleId:'io.github.seifonyx.lumen.demo',approvedTestEnvironment:true}));
const child=spawn(process.execPath,['native/scripts/authorize-test.mjs'],{env:{...process.env,LUMEN_NATIVE_SERVICE_CONFIG:file,LUMEN_TEST_GOOGLE_EMAIL:'synthetic@synthetic.invalid'},stdio:['ignore','pipe','pipe']});
let output='',error='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>error+=x);
try{
 let url;for(let i=0;i<100;i++){url=output.match(/http:\/\/localhost:5213\/[a-f0-9]{48}\//)?.[0];if(url)break;if(child.exitCode!==null)throw Error(error);await new Promise(r=>setTimeout(r,100));}
 assert(url,'Private consent server started');
 assert.equal((await fetch('http://localhost:5213/')).status,404);
 assert.equal((await fetch(url.replace('localhost','127.0.0.1'))).status,403);
 assert.equal((await fetch(url+'result',{method:'POST',headers:{Origin:'https://evil.test','Content-Type':'application/json'},body:'{}'})).status,403);
 assert.equal((await fetch(url+'result',{method:'POST',headers:{Origin:'http://localhost:5213','Content-Type':'application/json'},body:JSON.stringify({idToken:'synthetic-never-accept'})})).status,400);
 for(const engine of [chromium,webkit]){
  const browser=await engine.launch();try{
   const page=await browser.newPage(),outgoing=[];
   await page.route('**/*',r=>{if(new URL(r.request().url()).origin==='http://localhost:5213')return r.continue();outgoing.push('external');return r.abort();});
   await page.goto(url);await page.getByRole('button',{name:'Continue with Google',exact:true}).waitFor();
   await page.getByRole('status').filter({hasText:'synthetic@synthetic.invalid'}).waitFor();
   assert.equal(await page.evaluate(()=>localStorage.length),0);assert.deepEqual(outgoing,[]);
   console.log('PASS',engine.name(),'private consent page loads without starting sign-in/network or storing credentials; no real authorization claimed');
  }finally{await browser.close();}
 }
}finally{
 const done=new Promise(resolve=>child.once('exit',resolve));if(child.exitCode===null){child.kill();await done;}
 unlinkSync(file);rmdirSync(folder);
}
