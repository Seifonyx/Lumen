// Full native Canvas, production-shaped URLs and actual Firebase SDK; all IO ends at local emulators.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';import {resolve} from 'node:path';
import {build,preview,loadConfigFromFile} from '../../node_modules/vite/dist/node/index.js';import {chromium,webkit} from '../../node_modules/playwright/index.mjs';
if(!/^(127\.0\.0\.1|localhost):/.test(process.env.FIRESTORE_EMULATOR_HOST||''))throw Error('Loopback emulators required');
const root=resolve('.').replaceAll('\\','/'),folder='.qa-build/native-history';mkdirSync(folder,{recursive:true});
const canonical=JSON.parse(readFileSync('src/firebase-config.json','utf8')),project=canonical.projectId;
const config={...Object.fromEntries(['projectId','projectNumber','apiKey','appId'].map(k=>[k,canonical[k]])),mode:'account-connected',nativeApiKey:'synthetic-native-key',nativeApiKeyBundleId:'io.github.seifonyx.lumen.demo.EXAMPLE123',signedBundleId:'io.github.seifonyx.lumen.demo.EXAMPLE123',iosClientId:canonical.projectNumber+'-synthetic-ios.apps.googleusercontent.com',webClientId:canonical.projectNumber+'-synthetic-web.apps.googleusercontent.com',bundleId:'io.github.seifonyx.lumen.demo',approvedExistingAccounts:true};
const sdk=resolve(folder,'sdk.json');writeFileSync(sdk,JSON.stringify(config));process.env.LUMEN_NATIVE_MODE='account-connected';process.env.LUMEN_NATIVE_SERVICE_CONFIG=sdk;process.env.LUMEN_NATIVE_OUT_DIR='native/service-qa';
const rawNonce='ABCDEF12-1234-1234-1234-ABCDEF123456'.repeat(2),{createHash}=await import('node:crypto');
const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
function googleToken(subject){const now=Math.floor(Date.now()/1000);return encode({alg:'RS256'})+'.'+encode({sub:subject,email:subject+'@synthetic.invalid',email_verified:true,iss:'https://accounts.google.com',aud:config.webClientId,iat:now,exp:now+3600,nonce:createHash('sha256').update(rawNonce).digest('hex')})+'.c3ludGhldGlj';}
const entry=resolve(folder,'entry.ts');writeFileSync(entry,`
(window as any).historyBridge={restore:async()=>({signedIn:false}),signIn:async()=>({signedIn:true,idToken:(window as any).historyGoogleToken,rawNonce:${JSON.stringify(rawNonce)}}),signOut:async()=>{},cancel:async()=>{}};
await import('${root}/native/services/main.ts');
const {useStore}=await import('${root}/src/store.ts');const {auth,db}=await import('${root}/src/lib/firebase.ts');const {accountScope}=await import('${root}/native/integration/runtime.ts');
(window as any).historyFixture={store:useStore,auth,scope:accountScope};
`);
const {config:vite}=await loadConfigFromFile({command:'build',mode:'production'},resolve('native/vite.config.ts'));
const fixture={name:'private-native-history',enforce:'pre',transformIndexHtml:{order:'pre',handler(html){return html.replace('./demo/main.ts',entry.replaceAll('\\','/')).replace("connect-src 'self' data: blob:","connect-src 'self' data: blob: http://127.0.0.1:9099 http://127.0.0.1:8080");}},transform(code,id){
 if(id.endsWith('/native/services/account.ts')){const from="const google=registerPlugin<GoogleBridge>('LumenGoogleAuth');";assert(code.includes(from));return code.replace(from,'const google:GoogleBridge=(window as any).historyBridge;');}
}};
await build({...vite,configFile:false,plugins:[fixture,...vite.plugins],logLevel:'error',build:{...vite.build,target:'esnext'}});
const server=await preview({configFile:false,root:'native',build:{outDir:resolve('native/service-qa')},preview:{host:'127.0.0.1',port:5218,strictPort:true}});
const authURL='http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const json=async(url,body,headers={})=>{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});assert(r.ok,'Synthetic emulator setup failed '+r.status);return r.json();};
function field(value){if(typeof value==='string')return{stringValue:value};if(typeof value==='number')return{integerValue:String(value)};if(typeof value==='boolean')return{booleanValue:value};if(Array.isArray(value))return{arrayValue:{values:value.map(field)}};return{mapValue:{fields:Object.fromEntries(Object.entries(value).map(([k,v])=>[k,field(v)]))}};}
try{for(const engine of [chromium,webkit]){
 const token=googleToken('history-'+engine.name());
 const login=await json(authURL+'/accounts:signInWithIdp?key=synthetic-native-key',{requestUri:'http://localhost',postBody:'id_token='+encodeURIComponent(token)+'&providerId=google.com',returnSecureToken:true});
 await json(authURL+'/projects/'+project+'/accounts:update',{localId:login.localId,customAttributes:JSON.stringify({lumenIosTest:true})},{Authorization:'Bearer owner'});
 const current=await json(authURL+'/accounts:signInWithIdp?key=synthetic-native-key',{requestUri:'http://localhost',postBody:'id_token='+encodeURIComponent(token)+'&providerId=google.com',returnSecureToken:true});
 const documentRoot='http://127.0.0.1:8080/v1/projects/'+project+'/databases/(default)/documents/modelRouter/'+current.localId;
 const put=async(path,data)=>{const fields=Object.fromEntries(Object.entries(data).map(([k,v])=>[k,field(v)]));if(path.includes('/chats/'))fields.srv={timestampValue:new Date().toISOString()};const r=await fetch(documentRoot+path,{method:'PATCH',headers:{Authorization:'Bearer '+current.idToken,'Content-Type':'application/json'},body:JSON.stringify({fields})});assert(r.ok,'Synthetic cloud fixture write denied');};
 await put('',{settings:{projects:[{id:'fieldwork',name:'Fieldwork'}]}});
 await put('/chats/website-history',{title:'From the website',createdAt:100,updatedAt:200,rev:200,pinned:true,projectId:'fieldwork',ids:['website-message']});
 await put('/chats/website-history/messages/website-message',{id:'website-message',role:'user',text:'Existing synthetic cloud conversation',createdAt:100,index:0});
 const browser=await engine.launch();try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),outside=[],errors=[];const requests=[];
  await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname==='127.0.0.1'&&['5218','8080','9099'].includes(u.port)){requests.push(u.pathname);if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:{'access-control-allow-origin':'http://127.0.0.1:5218','access-control-allow-credentials':'true','access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':r.request().headers()['access-control-request-headers']||'*'}});return r.continue();}outside.push(u.origin);return r.abort();});
  const warnings=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))warnings.push(m.text().slice(0,1200));});page.on('requestfailed',r=>warnings.push(new URL(r.url()).origin+new URL(r.url()).pathname+' '+r.failure()?.errorText));
  await page.addInitScript(({token})=>{
   window.historyGoogleToken=token;
   const mapped=raw=>{const u=new URL(String(raw),location.href);if(u.hostname==='identitytoolkit.googleapis.com')return 'http://127.0.0.1:9099/identitytoolkit.googleapis.com'+u.pathname+u.search;if(u.hostname==='securetoken.googleapis.com')return 'http://127.0.0.1:9099/securetoken.googleapis.com'+u.pathname+u.search;if(u.hostname==='firestore.googleapis.com')return 'http://127.0.0.1:8080'+u.pathname+u.search;return raw;};
   const originalFetch=window.fetch.bind(window),open=XMLHttpRequest.prototype.open,setHeader=XMLHttpRequest.prototype.setRequestHeader;
   window.fetch=(input,init)=>originalFetch(input instanceof Request?new Request(mapped(input.url),input):mapped(input),init);
   XMLHttpRequest.prototype.open=function(method,url,...args){return open.call(this,method,mapped(url),...args);};
   XMLHttpRequest.prototype.setRequestHeader=function(name,value){if(name.toLowerCase()==='x-ios-bundle-identifier')return;return setHeader.call(this,name,value);};
  },{token});
  await page.goto('http://127.0.0.1:5218');await page.getByRole('button',{name:'Sign in with Google',exact:true}).click();
  await page.waitForFunction(()=>window.historyFixture?.store.getState().authed===true,{},{timeout:15000});
  try{await page.waitForFunction(()=>window.historyFixture.store.getState().chats.some(c=>c.id==='website-history'),{},{timeout:12000});}
  catch(error){console.log('Synthetic history diagnostics',await page.evaluate(()=>({active:window.historyFixture.scope.active,projects:window.historyFixture.store.getState().settings.projects?.length,chats:window.historyFixture.store.getState().chats.length,denied:!!window.historyFixture.store.getState().accessDenied,alerts:[...document.querySelectorAll('[role=alert]')].map(x=>x.textContent)})),{errors,warnings,requests:requests.filter(x=>x.includes('channel')).slice(0,12)});await page.screenshot({path:'tests/e2e/out/native-history-'+engine.name()+'.png'});throw error;}
  assert.equal(await page.evaluate(()=>window.historyFixture.auth.currentUser.uid),current.localId);
  const chat=await page.evaluate(()=>window.historyFixture.store.getState().chats.find(c=>c.id==='website-history'));
  assert.equal(chat.messages[0].text,'Existing synthetic cloud conversation');assert.equal(chat.projectId,'fieldwork');assert.equal(chat.pinned,true);
  await page.evaluate(()=>window.historyFixture.store.setState({sidebarOpen:true}));
  await page.getByRole('button',{name:/From the website/}).first().waitFor();await page.screenshot({path:'tests/e2e/out/native-history-'+engine.name()+'.png'});
  assert.deepEqual(outside,[]);assert.deepEqual(errors,[]);console.log('PASS',engine.name(),'native account Canvas loads preexisting website-shaped cloud history, project and messages through unmodified destination guards; same Firebase UID, no external traffic');
 }finally{await browser.close();}
}}finally{server.httpServer.closeAllConnections?.();await new Promise(r=>server.httpServer.close(r));}
