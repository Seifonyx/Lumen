// Local proof only. Production never imports this entry or its test capability.
import fixture from './fixture.json';
const params=new URLSearchParams(location.search);
const owner='preview-blackout-interactive';
const previous=JSON.parse(localStorage.getItem('mr.preview_user')||'null');
const harness=Boolean((window as unknown as {__blackoutHarness?:boolean}).__blackoutHarness)&&String(previous?.uid||'').startsWith('preview-blackout-');
const message=(text:string)=>{document.getElementById('root')!.textContent=text;};
function isolateTransport(){
 const nativeFetch=window.fetch.bind(window);
 window.fetch=async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href);
  if(url.origin===location.origin)return nativeFetch(input,init);
  if(url.hostname==='generativelanguage.googleapis.com'&&url.pathname.endsWith('/models'))return Response.json({models:[{name:'models/gemini-flash-latest',displayName:'Gemini Flash',inputTokenLimit:128000,supportedGenerationMethods:['generateContent']},{name:'models/gemini-2.5-pro',displayName:'Gemini 2.5 Pro',inputTokenLimit:1048576,supportedGenerationMethods:['generateContent']}]});
  if(url.hostname==='identitytoolkit.googleapis.com'||url.hostname==='www.googleapis.com')return Response.json({projectId:'the-model-router',authorizedDomains:['localhost']});
  return Response.json({error:{message:'This is a local design preview. No external request was sent.'}},{status:503});
 };
 const nativeOpen=XMLHttpRequest.prototype.open;
 XMLHttpRequest.prototype.open=function(method:string,url:string|URL,async:boolean=true,username?:string|null,password?:string|null){
  if(new URL(String(url),location.href).origin!==location.origin)throw new DOMException('External requests are disabled in the local design preview.','SecurityError');
  return nativeOpen.call(this,method,url,async,username,password);
 };
}
if(location.hostname!=='localhost')message('Design proofs run only on localhost in an isolated synthetic account.');
else if(harness)await import('./main'); // Explicit test-only capability; Playwright intercepts all provider traffic.
else if(params.get('fixture')==='1'||previous?.uid===owner){
 const owned=localStorage.getItem('mr.blackout.ownedFixture')==='1'&&previous?.uid===owner;
 const foreignAccounts=Object.keys(localStorage).some(key=>key.startsWith('mr.account.')&&key!==`mr.account.${owner}`);
 const databases=typeof indexedDB.databases==='function'?await indexedDB.databases():null;
 const existingAuth=databases?.some(db=>db.name?.toLowerCase().includes('firebase'));
 if((previous&&previous.uid!==owner)||foreignAccounts||(!owned&&(localStorage.getItem('mr.signedIn')||existingAuth||databases===null))){
  message('Open the synthetic Blackout preview in a separate browser profile to preserve the existing local account.');
 }else{
  isolateTransport(); // Applied on every reopen, including a direction-only URL.
  const settings={theme:'dark',autoIntroduced:true,autoTitle:false,autoCompact:false,privacyShield:false,messageNavigator:false,enabledModels:['gemini:gemini-flash-latest','gemini:gemini-2.5-pro'],defaultModel:'auto',layouts:[{id:'launch-writing',name:'Launch writing',icon:'pen',description:'A focused writing route, with a deliberate backup.',models:['gemini:gemini-2.5-pro','gemini:gemini-flash-latest'],mode:'order',fallback:'layout',priority:'quality'}]};
  localStorage.setItem('mr.preview_user',JSON.stringify({uid:owner,email:'fixture@local.invalid',displayName:'Fixture'}));
  localStorage.setItem('mr.blackout.ownedFixture','1');
  if(!localStorage.getItem(`mr.account.${owner}`))localStorage.setItem(`mr.account.${owner}`,JSON.stringify({geminiKey:'fixture',settings}));
  localStorage.setItem('mr.installHint','1');localStorage.setItem('mr.modelCheck.background',JSON.stringify(Date.now()));
  await new Promise<void>((resolve,reject)=>{const request=indexedDB.open('model-router-account-'+owner,2);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('chats'))request.result.createObjectStore('chats',{keyPath:'id'});};request.onsuccess=()=>{const db=request.result,tx=db.transaction('chats','readwrite');for(const chat of fixture.chats)tx.objectStore('chats').put(chat);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};request.onerror=()=>reject(request.error);});
  await import('./main');
  const {useStore}=await import('../../../src/store');
  const ready=()=>useStore.getState().authed===true&&useStore.getState().chats.some(c=>c.id==='launch');
  if(ready())useStore.getState().selectChat('launch');
  else{const unsubscribe=useStore.subscribe(()=>{if(ready()){unsubscribe();useStore.getState().selectChat('launch');}});}
 }
}else message('Use the isolated synthetic preview (?fixture=1). Regular accounts are not loaded into experimental design proofs.');
