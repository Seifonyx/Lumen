// Private emulator harness only: never imported by a packaged/native production entry.
import {initializeApp} from 'firebase/app';
import {initializeAuth,inMemoryPersistence,connectAuthEmulator,GoogleAuthProvider,signInWithCredential,signOut,getIdToken,createUserWithEmailAndPassword} from 'firebase/auth';
import {initializeFirestore,connectFirestoreEmulator,doc,getDoc,getDocFromServer,setDoc,getDocs,collection,disableNetwork,enableNetwork} from 'firebase/firestore';
import {ChatSync} from '../services/sync';
import {accountScope} from '../integration/runtime';
import type {Chat} from '../../src/types';
const project='demo-lumen-ios-test';
const app=initializeApp({projectId:project,apiKey:'synthetic-config-only',appId:'1:123456789:web:synthetic'});
export const auth=initializeAuth(app,{persistence:inMemoryPersistence});
export const db=initializeFirestore(app,{ignoreUndefinedProperties:true});
connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});connectFirestoreEmulator(db,'127.0.0.1',8080);
const items=new Map<string,Chat>(),errors:string[]=[];let sync:ChatSync|null=null;
const api={
 async login(subject:string,approved=true,provider='google.com'){
  sync?.stop();await signOut(auth);items.clear();errors.length=0;accountScope.set(null);
  const user=provider==='google.com'?(await signInWithCredential(auth,GoogleAuthProvider.credential(JSON.stringify({sub:subject,email:subject+'@synthetic.invalid',email_verified:true})))).user:(await createUserWithEmailAndPassword(auth,subject+'@synthetic.invalid','synthetic-only-not-a-real-secret')).user;
  // Auth Emulator admin only; never a real Firebase administrator token or project.
  const response=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/'+project+'/accounts:update',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer owner'},body:JSON.stringify({localId:user.uid,customAttributes:JSON.stringify({lumenIosTest:approved})})});
  if(!response.ok)throw Error('Could not set emulator-only claim');await getIdToken(user,true);accountScope.set(user.uid);
  return user.uid;
 },
 start(){if(!auth.currentUser)throw Error('No emulator account');sync?.stop();sync=new ChatSync(auth.currentUser.uid,{local:id=>items.get(id),allLocal:()=>[...items.values()],apply:c=>items.set(c.id,c),remove:id=>items.delete(id),error:message=>errors.push(message)});sync.start();},
 put(id:string,title:string,rev:number){const c={id,title,createdAt:Date.now(),updatedAt:Date.now(),rev,messages:[{id:id+'-m',role:'user',text:title,createdAt:Date.now(),rev}]} as Chat;items.set(id,c);sync?.push(c);},
 remove(id:string){items.delete(id);sync?.remove(id);},
 pending(){return JSON.parse(localStorage.getItem(`mr.sync.deletes.${auth.currentUser!.uid}`)||'[]');},
 all(){return [...items.values()];},errors(){return [...errors];},
 async diagnostics(){const data=(await getDocFromServer(doc(db,'modelRouter',auth.currentUser!.uid,'chats','roundtrip'))).data();return{local:[...items.values()].map(c=>({id:c.id,title:c.title,rev:c.rev})),remote:data&&{title:data.title,rev:data.rev},errors,active:accountScope.active};},
 async remoteTitle(id:string){return(await getDoc(doc(db,'modelRouter',auth.currentUser!.uid,'chats',id))).data()?.title;},
 async remote(id:string){return(await getDoc(doc(db,'modelRouter',auth.currentUser!.uid,'chats',id))).exists();},
 async settings(projectName:string){await setDoc(doc(db,'modelRouter',auth.currentUser!.uid),{settings:{projects:[{id:'synthetic-project',name:projectName}],customInstructions:'Sample only'}});},
 async readSettings(){return(await getDoc(doc(db,'modelRouter',auth.currentUser!.uid))).data()?.settings;},
 async denied(uid:string){try{await getDoc(doc(db,'modelRouter',uid));return false;}catch(e){return(e as {code:string}).code==='permission-denied';}},
 async forge(uid:string){try{await setDoc(doc(db,'modelRouter',uid),{settings:{projects:[]}});return false;}catch(e){return(e as {code:string}).code==='permission-denied';}},
 async publicDenied(){try{await getDocs(collection(db,'modelRouterShares'));return false;}catch(e){return(e as {code:string}).code==='permission-denied';}},
 async offline(){accountScope.pause();await disableNetwork(db);},
 async online(){await enableNetwork(db);accountScope.resume();},
 async logout(){sync?.stop();sync=null;accountScope.set(null);items.clear();await signOut(auth);},
 async anonDenied(){try{await getDoc(doc(db,'modelRouter','no-user'));return false;}catch(e){return(e as {code:string}).code==='permission-denied';}},
};
(window as unknown as {nativeCloudQA:typeof api}).nativeCloudQA=api;
