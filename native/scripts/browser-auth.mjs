import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';import {resolve} from 'node:path';
import {build,preview,loadConfigFromFile} from '../../node_modules/vite/dist/node/index.js';import {chromium,webkit} from '../../node_modules/playwright/index.mjs';
const root=resolve('.').replaceAll('\\','/'),folder='.qa-build/auth-app';mkdirSync(folder,{recursive:true});
const account=process.env.LUMEN_NATIVE_QA_ACCOUNT==='1';
const sdk=account?process.env.LUMEN_NATIVE_SERVICE_CONFIG:resolve(folder,'sdk.json');if(!sdk)throw Error('Account configuration required');
if(!account)writeFileSync(sdk,JSON.stringify({mode:'isolated-test',projectId:'lumen-ios-test',projectNumber:'123456789',apiKey:'synthetic-not-a-key',appId:'1:123456789:web:abc',iosClientId:'123456789-ios.apps.googleusercontent.com',webClientId:'123456789-web.apps.googleusercontent.com',bundleId:'io.github.seifonyx.lumen.demo',approvedTestEnvironment:true}));
const sdkConfig=JSON.parse(readFileSync(sdk,'utf8'));
process.env.LUMEN_NATIVE_MODE=account?'account-connected':'isolated-test';process.env.LUMEN_NATIVE_SERVICE_CONFIG=sdk;process.env.LUMEN_NATIVE_OUT_DIR='native/service-qa';
const entry=resolve(folder,'entry.ts');writeFileSync(entry,`
const fixture={code:'AUTH_SIGNING',calls:[] as string[],finish:()=>{}};
(window as any).authFixture=fixture;
(window as any).authBridge={
 restore:()=>{fixture.calls.push('restore');return new Promise(resolve=>{fixture.finish=()=>resolve({signedIn:false});});},
 signIn:async()=>{fixture.calls.push('interactive');
  if(['FIREBASE','NONCE','KEY_POLICY'].includes(fixture.code)){
   const rawNonce='ABCDEF12-1234-1234-1234-ABCDEF123456'.repeat(2);
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(rawNonce))),n=>n.toString(16).padStart(2,'0')).join('');
   const now=Math.floor(Date.now()/1000),encode=(v:any)=>btoa(JSON.stringify(v)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
   return {signedIn:true,rawNonce,idToken:encode({alg:'RS256'})+'.'+encode({iss:'https://accounts.google.com',aud:${JSON.stringify(sdkConfig.webClientId)},iat:now,exp:now+3600,nonce:fixture.code==='NONCE'?'wrong':hash})+'.c3ludGhldGlj'};
  }
  throw {code:fixture.code,message:'NEVER_SHOW_TOKEN_CALLBACK_OR_IDENTITY'};
 },signOut:async()=>{},cancel:async()=>fixture.finish()
};
await import('${root}/native/services/main.ts');
const {auth}=await import('${root}/src/lib/firebase.ts');
(fixture as any).firebaseApiKey=auth.config.apiKey;
`);
const {config}=await loadConfigFromFile({command:'build',mode:'production'},resolve('native/vite.config.ts'));
const fixture={name:'synthetic-native-auth-only',enforce:'pre',transformIndexHtml:{order:'pre',handler(html){return html.replace('./demo/main.ts',entry.replaceAll('\\','/'));}},transform(code,id){
 if(id.endsWith('/native/services/account.ts')){const from="const google=registerPlugin<GoogleBridge>('LumenGoogleAuth');";assert(code.includes(from));return code.replace(from,'const google:GoogleBridge=(window as any).authBridge;');}
}};
await build({...config,configFile:false,plugins:[fixture,...config.plugins],logLevel:'error',build:{...config.build,target:'esnext'}});
assert.equal(JSON.parse(readFileSync('native/service-qa/demo-build.json','utf8')).mode,sdkConfig.mode,'Packaged mode must match approved backend');
const server=await preview({configFile:false,root:'native',build:{outDir:resolve('native/service-qa')},preview:{host:'127.0.0.1',port:5217,strictPort:true}});
try{for(const engine of [chromium,webkit]){
 const browser=await engine.launch();try{
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),outside=[],errors=[];let exchanges=0,policy=false,xhrProbes=0;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin==='http://127.0.0.1:5217')return r.continue();
   if(u.hostname==='identitytoolkit.googleapis.com'&&u.pathname==='/v1/accounts:lookup'){assert(sdkConfig.nativeApiKey&&r.request().headers()['x-ios-bundle-identifier']===sdkConfig.nativeApiKeyBundleId,'XHR native identity missing');xhrProbes++;return r.fulfill({status:400,json:{error:{code:400,message:'INVALID_ID_TOKEN'}}});}
   if(u.hostname==='identitytoolkit.googleapis.com'&&u.pathname==='/v1/accounts:signInWithIdp'){if(sdkConfig.nativeApiKey)assert(r.request().headers()['x-ios-bundle-identifier']===sdkConfig.nativeApiKeyBundleId,'Fetch native identity missing');const body=JSON.parse(r.request().postData()||'{}');assert.equal(new URLSearchParams(body.postBody).get('nonce'),'ABCDEF12-1234-1234-1234-ABCDEF123456'.repeat(2),'Firebase exchange must retain validated raw nonce');exchanges++;if(policy)return r.fulfill({status:403,json:{error:{code:403,message:'Requests from referer <empty> are blocked.',status:'PERMISSION_DENIED',details:[{reason:'API_KEY_HTTP_REFERRER_BLOCKED'}]}}});return r.fulfill({status:400,json:{error:{code:400,message:'INVALID_IDP_RESPONSE : NEVER_SHOW_TOKEN_CALLBACK_OR_IDENTITY'}}});}
   outside.push(u.origin);return r.abort();});
  await page.addInitScript(()=>{const raw=localStorage;raw.setItem('mr.account.preview-native-demo-a',JSON.stringify({settings:{projects:[{id:'retained',name:'Demo preserved'}]}}));window.authLegacyRead=()=>raw.getItem('mr.account.preview-native-demo-a');});
  await page.goto('http://127.0.0.1:5217');
  const button=page.getByRole('button',{name:'Sign in with Google',exact:true});await button.waitFor();
  assert(await page.evaluate(expected=>window.authFixture.firebaseApiKey===expected,sdkConfig.nativeApiKey||sdkConfig.apiKey),'Firebase SDK must use the reviewed platform key');
  if(account){assert.equal(await page.getByRole('heading',{name:'Lumen',exact:true}).count(),1);assert(!(await page.locator('body').innerText()).includes('Isolated test environment'));}
  await page.waitForFunction(()=>window.authFixture.calls.includes('restore'));
  await button.click();await page.getByRole('button',{name:'Cancel sign-in',exact:true}).waitFor();
  assert.equal(await page.getByRole('alert').count(),0);assert.deepEqual(await page.evaluate(()=>window.authFixture.calls),['restore']);
  await page.evaluate(()=>window.authFixture.finish());
  await page.getByRole('alert').filter({hasText:'AUTH_SIGNING'}).waitFor();assert.equal(exchanges,0);
  for(const [code,expected] of [['AUTH_STORAGE','AUTH_STORAGE'],['AUTH_CALLBACK_CONFIG','AUTH_CALLBACK_CONFIG'],['AUTH_CANCELED','AUTH_CANCELED'],['NONCE','AUTH_NONCE'],['FIREBASE','AUTH_FIREBASE_CREDENTIAL'],['KEY_POLICY','AUTH_FIREBASE_KEY_POLICY']]){
   policy=code==='KEY_POLICY';await page.evaluate(code=>{window.authFixture.code=code;},code);await button.click();await page.getByRole('alert').filter({hasText:expected}).waitFor();
   assert(!(await page.locator('body').innerText()).includes('NEVER_SHOW_TOKEN_CALLBACK_OR_IDENTITY'));
  }
  assert.equal(exchanges,2);
  if(sdkConfig.nativeApiKey){
   const probe=await page.evaluate(url=>new Promise((resolve,reject)=>{const x=new XMLHttpRequest();x.open('POST',url);x.setRequestHeader('Content-Type','application/json');x.onload=()=>resolve(x.status);x.onerror=()=>reject(Error('Synthetic native XHR probe failed'));x.send(JSON.stringify({idToken:'synthetic-invalid-token'}));}),'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(sdkConfig.nativeApiKey));
   assert.equal(probe,400);assert.equal(xhrProbes,1);
  }assert.equal(await page.locator('.composer textarea').count(),0);
  assert(await page.evaluate(()=>window.authLegacyRead()?.includes('Demo preserved')));
  if(account){assert.equal(await page.evaluate(()=>localStorage.getItem('mr.account.preview-native-demo-a')),null);
   assert((await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('auth-scope-check');r.onsuccess=()=>{const db=r.result;resolve(db.name);db.close();indexedDB.deleteDatabase('auth-scope-check');};r.onerror=()=>reject(Error('Database test failed'));}))).startsWith('lumen.account.the-model-router.'));}
  assert.deepEqual(outside,[]);assert.deepEqual(errors,[]);
  await page.screenshot({path:'tests/e2e/out/auth-login-'+engine.name()+'.png'});
  console.log('PASS',engine.name(),'actual Login + account coordinator: delayed restore/login, signing/storage/callback/cancel/nonce/Firebase rejection classifications, secret redaction, demo preservation and fail-closed account; no external traffic');
 }finally{await browser.close();}
}}finally{await new Promise(r=>server.httpServer.close(r));}
