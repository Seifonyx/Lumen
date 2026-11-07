import config from 'lumen:authorization-config';
import {withDeadline} from './security.mjs';
import {initializeApp,deleteApp} from 'firebase/app';
import {initializeAuth,inMemoryPersistence,browserPopupRedirectResolver,signInWithPopup,GoogleAuthProvider,signOut} from 'firebase/auth';
import {initializeFirestore,setLogLevel,doc,setDoc,getDocFromServer,deleteDoc,terminate,serverTimestamp} from 'firebase/firestore';
const button=document.querySelector<HTMLButtonElement>('button')!,status=document.querySelector<HTMLElement>('[role=status]')!;
status.textContent='Use '+config.email+' in the Google window. After consent, a temporary test sample is created and deleted. No AI requests.';
button.onclick=async()=>{
 button.disabled=true;status.textContent='Waiting for Google sign-in…';
 const app=initializeApp(config.firebase,'lumen-one-time-consent');
 const auth=initializeAuth(app,{persistence:inMemoryPersistence,popupRedirectResolver:browserPopupRedirectResolver});
 let completed=false;let db:ReturnType<typeof initializeFirestore>|undefined,ref:ReturnType<typeof doc>|undefined,created=false;
 try{
  const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account',login_hint:config.email});
  const result=await signInWithPopup(auth,provider,browserPopupRedirectResolver);
  if(result.user.email?.toLowerCase()!==config.email.toLowerCase()||!result.user.emailVerified)throw Object.assign(Error(),{code:'wrong-account'});
  const claims=(await result.user.getIdTokenResult(true)).claims;
  if(claims.aud!=='lumen-ios-test'||claims.lumenIosTest!==true||(claims.firebase as {sign_in_provider?:string})?.sign_in_provider!=='google.com')throw Object.assign(Error(),{code:'test-access'});
  setLogLevel('silent');db=initializeFirestore(app,{});
  // Only a non-secret random sample identifier survives a reload, never an identity or credential.
  const pendingKey='lumen.test.authorization.pending';
  const prior=sessionStorage.getItem(pendingKey);
  if(prior&&/^authorization-probe-[a-f0-9-]{36}$/.test(prior)){
   await withDeadline(deleteDoc(doc(db,'modelRouter',result.user.uid,'chats',prior)),15000);
   sessionStorage.removeItem(pendingKey);
  }
  const id='authorization-probe-'+crypto.randomUUID();ref=doc(db,'modelRouter',result.user.uid,'chats',id);
  sessionStorage.setItem(pendingKey,id);created=true;
  await withDeadline(setDoc(ref,{title:'Synthetic authorization verification',messages:[],count:0,ids:[],createdAt:Date.now(),updatedAt:Date.now(),rev:Date.now(),srv:serverTimestamp(),deleted:false}),15000);
  if((await withDeadline(getDocFromServer(ref),15000)).data()?.title!=='Synthetic authorization verification')throw Error('roundtrip');
  await withDeadline(deleteDoc(ref),15000);if((await withDeadline(getDocFromServer(ref),15000)).exists())throw Error('cleanup');
  created=false;sessionStorage.removeItem('lumen.test.authorization.pending');
  await signOut(auth);await terminate(db);db=undefined;
  const report={flow:'google-popup',authorized:true,cloudRoundtrip:true,cleaned:true};
  const response=await fetch('./result',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(report)});
  if(!response.ok)throw Error('report');
  completed=true;status.textContent='Google app-client sign-in and test cloud access verified. The temporary sample was deleted. You can close this page.';
 }catch(error){
  const code=(error as {code?:string}).code;
  status.textContent=code==='auth/popup-closed-by-user'?'Google sign-in was canceled. Select Continue with Google to try again.':code==='wrong-account'?'Choose the approved test account. No cloud data was accessed.':code==='test-access'?'The selected account does not have test access.':'Sign-in did not complete. Allow the Google popup and retry. No credentials are sent to this tool.';
 }finally{
  if(created&&ref)try{await withDeadline(deleteDoc(ref),5000);sessionStorage.removeItem('lumen.test.authorization.pending');}catch{status.textContent+=' Temporary sample deletion is unconfirmed. Keep this tab open and retry after reconnecting to finish cleanup.';}
  if(db)await terminate(db).catch(()=>{});await signOut(auth).catch(()=>{});await deleteApp(app);button.disabled=completed;
 }
};
