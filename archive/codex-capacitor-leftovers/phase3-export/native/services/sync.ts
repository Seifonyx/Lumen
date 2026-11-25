import {ChatSync as CanonicalSync,fetchOriginal as original} from 'lumen:canonical-sync';
import {AccountSync,Connectivity,type SyncHandlers} from '../integration/sync';
import {accountScope} from '../integration/runtime';
const connectivity=new Connectivity(navigator.onLine);
window.addEventListener('online',()=>connectivity.set(true));window.addEventListener('offline',()=>connectivity.set(false));
const deletes=new Map<string,Set<string>>();
export class ChatSync extends AccountSync {
 constructor(uid:string,handlers:SyncHandlers){const outbox=deletes.get(uid)||new Set<string>();deletes.set(uid,outbox);super(uid,accountScope,handlers,(owner,h)=>new CanonicalSync(owner,h),outbox,connectivity);}
}
export async function fetchOriginal(uid:string,fileId:string){
 if(!accountScope.active||accountScope.uid!==uid)return null;
 const lease=accountScope.capture(),result=await original(uid,fileId);return lease.valid()?result:null;
}
