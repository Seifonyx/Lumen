import test from 'node:test';import assert from 'node:assert/strict';
import {nativeFirebaseFetch,installNativeFirebaseXHR} from '../services/firebase-request.ts';
import {requestAllowed,validateServiceConfig} from '../services/config.mjs';
const c={mode:'account-connected',projectId:'the-model-router',projectNumber:'123456789',apiKey:'website-key',nativeApiKey:'ios-key',nativeApiKeyBundleId:'io.github.seifonyx.lumen.demo.EXAMPLE123',signedBundleId:'io.github.seifonyx.lumen.demo.EXAMPLE123',appId:'1:123456789:web:abc',iosClientId:'123456789-ios.apps.googleusercontent.com',webClientId:'123456789-web.apps.googleusercontent.com',bundleId:'io.github.seifonyx.lumen.demo',approvedExistingAccounts:true};
const target='https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=ios-key',header='X-Ios-Bundle-Identifier';
test('native Firebase key requires a reviewed account build and its exact signing identity',()=>{
 assert.equal(validateServiceConfig(c).nativeApiKey,'ios-key');assert(requestAllowed(c,target));assert(!requestAllowed(c,target.replace('ios-key','website-key')));
 for(const patch of [{nativeApiKeyBundleId:'other.bundle'},{nativeApiKey:''},{nativeApiKey:undefined},{nativeApiKey:'website-key'},{mode:'isolated-test',projectId:'lumen-ios-test',approvedExistingAccounts:undefined,approvedTestEnvironment:true}])assert.throws(()=>validateServiceConfig({...c,...patch}));
});
test('fetch supplies trusted native identity only to configured Firebase requests, retaining body/headers/abort',async()=>{
 const calls=[],io=async(...args)=>{calls.push(args);return new Response('{}');},fetch=nativeFirebaseFetch(c,io),abort=new AbortController();
 await fetch(target,{method:'POST',body:'synthetic',headers:{[header]:'forged','X-Client-Version':'fixture'},signal:abort.signal});
 assert.equal(calls[0][1].headers.get(header),c.signedBundleId);assert.equal(calls[0][1].headers.get('X-Client-Version'),'fixture');assert.equal(calls[0][1].body,'synthetic');assert.equal(calls[0][1].signal,abort.signal);
 await fetch(new Request(target,{method:'POST',body:'request',headers:{'X-Test':'retained'}}));assert.equal(calls[1][1].headers.get(header),c.signedBundleId);assert.equal(calls[1][1].headers.get('X-Test'),'retained');
 await fetch('https://openrouter.ai/api/v1/key',{headers:{authorization:'Bearer synthetic'}});assert.equal(new Headers(calls[2][1].headers).has(header),false);
 await fetch('http://127.0.0.1/local');assert.equal(calls[3][1],undefined);
 const testOnly=nativeFirebaseFetch({...c,nativeApiKey:undefined,nativeApiKeyBundleId:undefined},io);await testOnly(target);assert.equal(calls[4][1],undefined);
});
test('XHR adds native identity on Firebase only; reuse and caller headers cannot leak or replace identity',()=>{
 class Fake {headers={};open(_method,url){this.url=url;this.headers={};}setRequestHeader(k,v){this.headers[k.toLowerCase()]=v;}send(body){this.body=body;}}
 installNativeFirebaseXHR(c,Fake.prototype);const x=new Fake();x.open('POST',target);assert.throws(()=>x.setRequestHeader(header,'forged'));x.setRequestHeader('X-Test','kept');x.send('body');assert.equal(x.headers[header.toLowerCase()],c.signedBundleId);assert.equal(x.headers['x-test'],'kept');
 x.open('POST','https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?database=projects/the-model-router/databases/(default)');x.send();assert.equal(x.headers[header.toLowerCase()],c.signedBundleId);
 x.open('GET','http://127.0.0.1/local');x.send();assert.equal(x.headers[header.toLowerCase()],undefined);
});
