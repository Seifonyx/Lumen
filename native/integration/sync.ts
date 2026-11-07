import type {Chat} from '../../src/types';
import {isTemporaryChat} from '../../src/lib/temporary-chat.ts';
import type {AccountScope,Lease} from './scope.ts';
export interface SyncHandlers {local(id:string):Chat|undefined;allLocal():Chat[];apply(chat:Chat):void;remove(id:string):void;error(message:string):void}
/** Same public surface as canonical ChatSync. Real activation must supply its reviewed driver, not this replica. */
export interface SyncDriver {start():void;stop():void;push(chat:Chat):void;remove(id:string):void}
export type SyncFactory=(uid:string,handlers:SyncHandlers)=>SyncDriver;
export class Connectivity {
 private value:boolean;private listeners=new Set<()=>void>();
 constructor(online=true){this.value=online;}
 get online(){return this.value;}
 set(online:boolean){if(this.value===online)return;this.value=online;for(const fn of this.listeners)fn();}
 subscribe(fn:()=>void){this.listeners.add(fn);return()=>{this.listeners.delete(fn);};}
}
export class AccountSync implements SyncDriver {
 private uid:string;private scope:AccountScope;private handlers:SyncHandlers;private factory:SyncFactory;
 private driver:SyncDriver|null=null;private lease:Lease|null=null;private off:(()=>void)|null=null;
 private deletes:Set<string>;private connectivity:Connectivity;
 constructor(uid:string,scope:AccountScope,handlers:SyncHandlers,factory:SyncFactory,pendingDeletes=new Set<string>(),connectivity=new Connectivity()){this.connectivity=connectivity;this.deletes=pendingDeletes;this.uid=uid;this.scope=scope;this.handlers=handlers;this.factory=factory;}
 start(){if(!this.off){const a=this.scope.subscribe(()=>this.reconcile()),b=this.connectivity.subscribe(()=>this.reconcile());this.off=()=>{a();b();};}this.reconcile();}
 stop(){this.off?.();this.off=null;this.stopDriver();}
 private stopDriver(){this.lease=null;this.driver?.stop();this.driver=null;}
 private reconcile(){
  if(!this.connectivity.online||!this.scope.active||this.scope.uid!==this.uid){this.stopDriver();return;}
  if(this.lease?.valid())return;this.stopDriver();const lease=this.scope.capture();this.lease=lease;
  const valid=()=>this.lease===lease&&lease.valid();
  const guarded:SyncHandlers={
   local:id=>valid()?this.handlers.local(id):undefined,
   allLocal:()=>valid()?this.handlers.allLocal().filter(c=>!isTemporaryChat(c)&&!this.deletes.has(c.id)):[],
   apply:chat=>{if(valid()&&!isTemporaryChat(chat)&&!this.deletes.has(chat.id))this.handlers.apply(chat);},
   remove:id=>{if(valid()&&!id.startsWith('temporary-'))this.handlers.remove(id);},
   error:message=>{if(valid())this.handlers.error(message);},
  };
  this.driver=this.factory(this.uid,guarded);this.driver.start();
  for(const id of this.deletes)this.driver.remove(id);this.deletes.clear();
 }
 push(chat:Chat){if(this.scope.uid===this.uid&&!isTemporaryChat(chat))this.driver?.push(chat);}
 remove(id:string){if(this.scope.uid!==this.uid||id.startsWith('temporary-'))return;if(this.driver)this.driver.remove(id);else this.deletes.add(id);}
}
interface ReplicaRow {id:string;rev:number;chat:Chat|null}
const revision=(chat:Chat)=>Number(chat.rev??chat.updatedAt)||0;
/** Deterministic, memory-only demonstration backend. Never cloud, persistence or production conflict semantics. */
export class MemoryReplica {
 private rows=new Map<string,Map<string,ReplicaRow>>();private listeners=new Map<string,Set<(row:ReplicaRow)=>void>>();
 list(uid:string){return [...(this.rows.get(uid)?.values()||[])].map(row=>structuredClone(row));}
 subscribe(uid:string,fn:(row:ReplicaRow)=>void){const set=this.listeners.get(uid)||new Set();this.listeners.set(uid,set);set.add(fn);return()=>{set.delete(fn);};}
 private publish(uid:string,row:ReplicaRow){for(const fn of this.listeners.get(uid)||[])queueMicrotask(()=>fn(structuredClone(row)));}
 put(uid:string,chat:Chat){
  if(isTemporaryChat(chat))return;const rows=this.rows.get(uid)||new Map();this.rows.set(uid,rows);const prior=rows.get(chat.id),rev=revision(chat);
  if(prior&&(prior.rev>rev||prior.rev===rev&&(!prior.chat||JSON.stringify(prior.chat)===JSON.stringify(chat))))return;
  const row={id:chat.id,rev,chat:structuredClone(chat)};rows.set(chat.id,row);this.publish(uid,row);
 }
 remove(uid:string,id:string){if(id.startsWith('temporary-'))return;const rows=this.rows.get(uid)||new Map();this.rows.set(uid,rows);const row={id,rev:Math.max(Date.now(),rows.get(id)?.rev||0),chat:null};rows.set(id,row);this.publish(uid,row);}
}
export class ReplicaDriver implements SyncDriver {
 private uid:string;private handlers:SyncHandlers;private replica:MemoryReplica;private off:(()=>void)|null=null;
 constructor(uid:string,handlers:SyncHandlers,replica:MemoryReplica){this.uid=uid;this.handlers=handlers;this.replica=replica;}
 private receive(row:ReplicaRow){
  const local=this.handlers.local(row.id);
  if(!row.chat){if(!local||revision(local)<=row.rev)this.handlers.remove(row.id);return;}
  if(!local||revision(row.chat)>revision(local))this.handlers.apply(structuredClone(row.chat));
 }
 start(){this.off=this.replica.subscribe(this.uid,row=>this.receive(row));for(const row of this.replica.list(this.uid))this.receive(row);for(const c of this.handlers.allLocal())this.push(c);}
 stop(){this.off?.();this.off=null;}
 push(chat:Chat){this.replica.put(this.uid,chat);}
 remove(id:string){this.replica.remove(this.uid,id);}
}
