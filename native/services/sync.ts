import {queueDeletion} from '../integration/pending-deletions';
import {ChatSync as CanonicalSync,fetchOriginal as original} from 'lumen:canonical-sync';
import {AccountSync,Connectivity,type SyncHandlers} from '../integration/sync';
import {accountScope} from '../integration/runtime';
const connectivity=new Connectivity(navigator.onLine);
window.addEventListener('online',()=>connectivity.set(true));window.addEventListener('offline',()=>connectivity.set(false));
// Canonical queue is durable even while its Firestore driver is paused/not mounted.
export class ChatSync extends AccountSync {
 private owner:string;private started=false;
 constructor(uid:string,handlers:SyncHandlers){super(uid,accountScope,handlers,(owner,h)=>new CanonicalSync(owner,h),new Set(),connectivity);this.owner=uid;}
 override start(){this.started=true;super.start();}
 override stop(){this.started=false;super.stop();}
 override remove(id:string){
  if(accountScope.uid!==this.owner||id.startsWith('temporary-'))return;
  queueDeletion(this.owner,id);
  if(this.started&&accountScope.active&&connectivity.online)super.remove(id);
 }
}

export async function fetchOriginal(uid:string,fileId:string){
 if(!accountScope.active||accountScope.uid!==uid)return null;
 const lease=accountScope.capture(),result=await original(uid,fileId);return lease.valid()?result:null;
}
