import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';
import {build,preview,loadConfigFromFile} from '../../node_modules/vite/dist/node/index.js';import {chromium,webkit} from '../../node_modules/playwright/index.mjs';
const root=resolve('.').replaceAll('\\','/'),folder='.qa-build/rc-app';mkdirSync(folder,{recursive:true});
const configPath=resolve(folder,'sdk.json');writeFileSync(configPath,JSON.stringify({mode:'isolated-test',projectId:'lumen-ios-test',projectNumber:'123456789',apiKey:'synthetic-not-a-key',appId:'1:123456789:web:abc',iosClientId:'123456789-ios.apps.googleusercontent.com',webClientId:'123456789-web.apps.googleusercontent.com',bundleId:'io.github.seifonyx.lumen.demo',approvedTestEnvironment:true}));
process.env.LUMEN_NATIVE_MODE='isolated-test';process.env.LUMEN_NATIVE_SERVICE_CONFIG=configPath;process.env.LUMEN_NATIVE_OUT_DIR='native/service-qa';
const entry=resolve(folder,'entry.ts');writeFileSync(entry,`
import {connectAuthEmulator,signInWithCredential,GoogleAuthProvider,getIdToken,getIdTokenResult} from 'firebase/auth';
import {connectFirestoreEmulator,getDocFromServer,doc} from 'firebase/firestore';
import {auth,db} from '${root}/src/lib/firebase.ts';
connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});connectFirestoreEmulator(db,'127.0.0.1',8080);
const token=JSON.stringify({sub:'rc-synthetic-user',email:'rc@synthetic.invalid',email_verified:true});
const {user}=await signInWithCredential(auth,GoogleAuthProvider.credential(token));
const grant=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/lumen-ios-test/accounts:update',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer owner'},body:JSON.stringify({localId:user.uid,customAttributes:JSON.stringify({lumenIosTest:true})})});if(!grant.ok)throw Error('Synthetic claim grant failed');await getIdToken(user,true);const claims=(await getIdTokenResult(user)).claims;if(claims.lumenIosTest!==true)throw Error('Synthetic claim missing');
const routing=await import('${root}/src/lib/routing-center.ts');
const {useStore}=await import('${root}/src/store.ts');
(window as any).rc={open:()=>{routing.openRoutingCenter('providers');routing.showRoutingProvider('openrouter');},store:useStore,close:()=>routing.closeRoutingCenter(),cloudKey:async()=>(await getDocFromServer(doc(db,'modelRouter',auth.currentUser!.uid))).data()?.openrouterKey};
await import('${root}/native/services/main.ts');
`);
const {config}=await loadConfigFromFile({command:'build',mode:'production'},resolve('native/vite.config.ts'));
const fixture={name:'synthetic-native-rc-only',enforce:'pre',transformIndexHtml:{order:'pre',handler(html){return html.replace('./demo/main.ts',entry.replaceAll('\\','/')).replace("connect-src 'self' data: blob:","connect-src 'self' data: blob: http://127.0.0.1:9099 http://127.0.0.1:8080");}},transform(code,id){if(id.endsWith('/native/services/account.ts')){const a=code.indexOf('export function watchNativeUser('),b=code.indexOf('export const signInNative',a);return code.slice(0,a)+`export function watchNativeUser(auth,callback){let last;return onIdTokenChanged(auth,user=>{if(user===last)return;last=user;const next=user?.uid||null;if(accountScope.uid!==next){if(accountScope.uid)localStorage.removeItem(consentKey(accountScope.uid));accounts.clear();accountScope.set(next);}callback(user);});}\n`+code.slice(b);}if(id.endsWith('/native/services/transport.ts'))return code.replace('function allowed(url:URL){return',"function allowed(url:URL){return ['http://127.0.0.1:9099','http://127.0.0.1:8080'].includes(url.origin)||");}};
await build({...config,configFile:false,plugins:[fixture,...config.plugins],logLevel:'error',build:{...config.build,target:'esnext'}});
const server=await preview({configFile:false,root:'native',build:{outDir:resolve('native/service-qa')},preview:{host:'127.0.0.1',port:5216,strictPort:true}});
try{for(const engine of [chromium,webkit]){
 const browser=await engine.launch();try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),outside=[],requests=[],errors=[];let slow=false;
  page.on('pageerror',e=>{errors.push(e.message);console.log('APP ERROR',e.message);});page.on('console',m=>{if(m.text().startsWith('RC setup failure'))console.log(m.text());});
  await page.route('**/*',r=>{
   const u=new URL(r.request().url());if(u.hostname==='127.0.0.1')return r.continue();
   if(u.origin==='https://openrouter.ai'){
    requests.push(u.pathname);
    if(u.pathname==='/api/v1/key')return r.fulfill({json:{data:{limit:0,is_free_tier:true,byok_usage:0}}});
    if(u.pathname==='/api/v1/models')return r.fulfill({json:{data:[{id:'fixture/text:free',name:'Synthetic free model',context_length:8192,top_provider:{max_completion_tokens:2048},pricing:{prompt:'0',completion:'0'},architecture:{input_modalities:['text'],output_modalities:['text']},supported_parameters:[]}]}});
    if(u.pathname==='/api/v1/chat/completions'){if(slow){return new Promise(resolve=>setTimeout(resolve,1500)).then(()=>r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({choices:[{delta:{content:'Late canceled output'},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n'})).catch(()=>{});}return r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({choices:[{delta:{content:'Synthetic browser reply'},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:3}})+'\n\ndata: [DONE]\n\n'});}
   }
   outside.push(u.origin);return r.abort();
  });
  await page.goto('http://127.0.0.1:5216');await page.waitForFunction(()=>window.rc?.store.getState().authed);
  await page.waitForTimeout(500);await page.evaluate(()=>window.rc.open());
  if(await page.getByRole('button',{name:'Set up OpenRouter',exact:true}).count())await page.getByRole('button',{name:'Set up OpenRouter',exact:true}).click();
  const input=page.getByLabel('OpenRouter API key',{exact:true});await input.waitFor();
  const key='sk-or-synthetic-rc-key';await input.fill(key);
  const save=page.getByRole('button',{name:'Save and enable free AI',exact:true});assert(await save.isDisabled());assert.equal(requests.length,0);
  await page.getByRole('checkbox').check();assert.equal(requests.length,0);await save.click();
  await page.waitForFunction(key=>window.rc.store.getState().keys.openrouter===key,key,{timeout:20000});await page.waitForFunction(()=>window.rc.store.getState().catalog?.models.some(m=>m.id==='openrouter:fixture/text:free'),null,{timeout:20000});
  assert(requests.includes('/api/v1/models'));assert(!requests.includes('/api/v1/chat/completions'));
  assert.equal(await page.evaluate(()=>window.rc.cloudKey()),key);
  assert.equal(await page.evaluate(key=>Object.values(localStorage).some(v=>v.includes(key)),key),false);
  await page.screenshot({path:'tests/e2e/out/rc-provider-'+engine.name()+'.png'});
  await page.getByRole('button',{name:'Use Synthetic free model',exact:true}).click();
  const composer=page.locator('.composer textarea');await composer.waitFor();await composer.fill('Synthetic browser verification');
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await page.getByText('Synthetic browser reply',{exact:true}).waitFor({timeout:20000});
  assert.equal(requests.filter(p=>p==='/api/v1/chat/completions').length,1);
  await composer.fill('Unsent native draft');await page.evaluate(()=>window.rc.open());
  if(await page.getByRole('button',{name:'Set up OpenRouter',exact:true}).count())await page.getByRole('button',{name:'Set up OpenRouter',exact:true}).click();
  await page.getByRole('button',{name:'Use Synthetic free model',exact:true}).click();assert.equal(await composer.inputValue(),'Unsent native draft');
  slow=true;await page.getByRole('button',{name:'Send',exact:true}).click();await page.getByRole('button',{name:'Stop',exact:true}).click();await page.waitForTimeout(1800);assert.equal(await page.getByText('Late canceled output',{exact:true}).count(),0);
  await composer.fill('Draft retained after disabling AI');await page.evaluate(()=>window.rc.open());
  if(await page.getByRole('button',{name:'Set up OpenRouter',exact:true}).count())await page.getByRole('button',{name:'Set up OpenRouter',exact:true}).click();
  await page.getByRole('button',{name:'Disable free AI',exact:true}).click();assert.equal(await page.getByRole('checkbox').isChecked(),false);
  assert.equal(await page.evaluate(()=>window.rc.cloudKey()),key);
  assert.deepEqual(outside,[]);assert.deepEqual(errors,[]);
  console.log('PASS',engine.name(),'actual connected Canvas: explicit consent, zero-budget metadata, private cloud key save, catalogue, composer synthetic SSE; no real provider traffic');
 }finally{await browser.close();}
}}finally{server.httpServer.closeAllConnections?.();await new Promise(r=>server.httpServer.close(r));}
