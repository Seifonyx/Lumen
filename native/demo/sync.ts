import type {Chat} from '../../src/types';
import {AccountSync,Connectivity,MemoryReplica,ReplicaDriver,type SyncHandlers} from '../integration/sync';
import {accountScope} from '../integration/runtime';
// Memory-only demonstration replica. Canonical IndexedDB is the durable source; no cloud SDK or new schema.
const replica=new MemoryReplica();
export const syntheticConnectivity=new Connectivity(navigator.onLine);
window.addEventListener('online',()=>syntheticConnectivity.set(true));
window.addEventListener('offline',()=>syntheticConnectivity.set(false));
const pendingDeletes=new Map<string,Set<string>>();
export class ChatSync extends AccountSync {
 constructor(uid:string,handlers:SyncHandlers){const outbox=pendingDeletes.get(uid)||new Set<string>();pendingDeletes.set(uid,outbox);super(uid,accountScope,handlers,(owner,h)=>new ReplicaDriver(owner,h,replica),outbox,syntheticConnectivity);}
}
export async function fetchOriginal(_uid:string,_fileId:string):Promise<{data:string;mime:string;name:string}|null>{return null;}
export const syntheticReplica=replica;
// Type-only compatibility with canonical ChatSync callers.
export type SyncedChat=Chat;
