import assert from 'node:assert/strict';
import {patchSync} from '../services/patches.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';
import {createServer} from '../../node_modules/vite/dist/node/index.js';
import {chromium,webkit} from '../../node_modules/playwright/index.mjs';
const project='demo-lumen-ios-test',root=resolve('.qa-build/native-cloud'),repo=resolve('.').replaceAll(String.fromCharCode(92),'/');
if(!process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:')&&!process.env.FIRESTORE_EMULATOR_HOST?.startsWith('localhost:'))throw Error('A loopback Firestore emulator is required');
mkdirSync(root,{recursive:true});writeFileSync(resolve(root,'index.html'),'<html><body><script type="module" src="/entry.ts"></script></body></html>');writeFileSync(resolve(root,'entry.ts'),`import ${JSON.stringify(repo+'/native/tests/cloud-harness.ts')};`);
const firebase=repo+'/src/lib/firebase.ts',sync=repo+'/src/lib/sync.ts',harness=repo+'/native/tests/cloud-harness.ts';
const server=await createServer({configFile:false,root,server:{host:'127.0.0.1',port:5208,strictPort:true,hmr:false,fs:{allow:[repo]}},plugins:[{name:'private-native-cloud-contract',enforce:'pre',async resolveId(source,importer,options){
 if(source==='lumen:canonical-sync')return sync;
 if(!importer||source.startsWith('\0'))return null;const found=await this.resolve(source,importer,{...options,skipSelf:true});
 if(found?.id.replaceAll(String.fromCharCode(92),'/')===firebase)return harness;
 return null;
},transform(code,id){if(id.split('?')[0].replaceAll(String.fromCharCode(92),'/')===sync)return{code:patchSync(code),map:null};}
}]});
try{await server.listen();
 for(const engine of [chromium,webkit]){
  // Reset only the namespaced synthetic emulators, never a Firebase cloud endpoint.
  for(const url of ['http://127.0.0.1:8080/emulator/v1/projects/'+project+'/databases/(default)/documents','http://127.0.0.1:9099/emulator/v1/projects/'+project+'/accounts'])assert((await fetch(url,{method:'DELETE'})).ok);
  const browser=await engine.launch();
  try{
   const contexts=[],pages=[],outgoing=[];
   for(let i=0;i<3;i++){const c=await browser.newContext();contexts.push(c);await c.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname==='127.0.0.1'&&['5208','8080','9099'].includes(u.port))return r.continue();outgoing.push(u.origin);return r.abort();});const p=await c.newPage();pages.push(p);await p.goto('http://127.0.0.1:5208');await p.waitForFunction(()=>!!window.nativeCloudQA);}
   const [a,b,foreign]=pages;
   const uid=await a.evaluate(()=>window.nativeCloudQA.login('synthetic-a'));assert.equal(await b.evaluate(()=>window.nativeCloudQA.login('synthetic-a')),uid);
   const other=await foreign.evaluate(()=>window.nativeCloudQA.login('synthetic-b'));assert.notEqual(other,uid);
   assert(await foreign.evaluate(u=>window.nativeCloudQA.denied(u),uid));assert(await foreign.evaluate(u=>window.nativeCloudQA.forge(u),uid));assert(await foreign.evaluate(()=>window.nativeCloudQA.publicDenied()));
   await a.evaluate(()=>window.nativeCloudQA.settings('Sample project A'));assert.equal((await b.evaluate(()=>window.nativeCloudQA.readSettings())).projects[0].name,'Sample project A');
   await a.evaluate(()=>window.nativeCloudQA.start());await b.evaluate(()=>window.nativeCloudQA.start());
   await a.evaluate(()=>window.nativeCloudQA.put('roundtrip','first',1));await b.waitForFunction(()=>window.nativeCloudQA.all().some(c=>c.id==='roundtrip'&&c.title==='first'));
   await a.evaluate(()=>window.nativeCloudQA.offline());await a.evaluate(()=>window.nativeCloudQA.put('roundtrip','offline update',2));assert.equal((await b.evaluate(()=>window.nativeCloudQA.all()))[0].title,'first');await a.evaluate(()=>window.nativeCloudQA.online());await b.waitForFunction(()=>window.nativeCloudQA.all().some(c=>c.title==='offline update'));
   await a.evaluate(()=>window.nativeCloudQA.offline());await a.evaluate(()=>window.nativeCloudQA.put('roundtrip','older offline conflict',3));
   await b.evaluate(()=>window.nativeCloudQA.put('roundtrip','newer remote conflict',4));
   await b.waitForFunction(async()=>await window.nativeCloudQA.remoteTitle('roundtrip')==='newer remote conflict');
   await a.evaluate(()=>window.nativeCloudQA.online());try{await a.waitForFunction(()=>window.nativeCloudQA.all().some(c=>c.id==='roundtrip'&&c.title==='newer remote conflict'),{},{timeout:5000});}catch(error){console.error('Synthetic conflict diagnostics',await a.evaluate(()=>window.nativeCloudQA.diagnostics()),await b.evaluate(()=>window.nativeCloudQA.diagnostics()));throw error;}
   await a.evaluate(()=>window.nativeCloudQA.put('temporary-private','must not synchronize',1));await a.waitForTimeout(300);assert.equal(await a.evaluate(()=>window.nativeCloudQA.remote('temporary-private')),false);
   await a.evaluate(()=>window.nativeCloudQA.offline());await a.evaluate(()=>window.nativeCloudQA.remove('roundtrip'));await a.evaluate(()=>window.nativeCloudQA.online());await b.waitForFunction(()=>!window.nativeCloudQA.all().some(c=>c.id==='roundtrip'));
   await a.evaluate(()=>window.nativeCloudQA.put('restart-delete','remove while offline',5));
   await b.waitForFunction(()=>window.nativeCloudQA.all().some(c=>c.id==='restart-delete'));
   await a.evaluate(()=>window.nativeCloudQA.offline());await a.evaluate(()=>window.nativeCloudQA.remove('restart-delete'));
   await a.reload();await a.waitForFunction(()=>!!window.nativeCloudQA);
   await a.evaluate(()=>window.nativeCloudQA.login('synthetic-a'));await a.evaluate(()=>window.nativeCloudQA.start());
   await b.waitForFunction(()=>!window.nativeCloudQA.all().some(c=>c.id==='restart-delete'),{},{timeout:5000});
   await a.waitForFunction(()=>window.nativeCloudQA.pending().length===0);
   await b.evaluate(()=>window.nativeCloudQA.logout());assert.deepEqual(await b.evaluate(()=>window.nativeCloudQA.all()),[]);assert(await b.evaluate(()=>window.nativeCloudQA.anonDenied()));
   const unapproved=await foreign.evaluate(()=>window.nativeCloudQA.login('unapproved',false));assert(await foreign.evaluate(u=>window.nativeCloudQA.denied(u),unapproved));assert(await foreign.evaluate(u=>window.nativeCloudQA.forge(u),unapproved));
   const password=await foreign.evaluate(()=>window.nativeCloudQA.login('non-google',true,'password'));assert(await foreign.evaluate(u=>window.nativeCloudQA.denied(u),password));assert(await foreign.evaluate(u=>window.nativeCloudQA.forge(u),password));
   assert.deepEqual(outgoing,[]);console.log('PASS',engine.name(),'emulated Google claims, strict Google/claim/account read/write, settings/projects, canonical ChatSync roundtrip, offline update/conflict/delete/restart recovery, Incognito exclusion and logout; no cloud/provider traffic');
   await Promise.all(contexts.map(c=>c.close()));
  }finally{await browser.close();}
 }
}finally{await server.close();}
