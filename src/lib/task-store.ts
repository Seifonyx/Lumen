import { doc, onSnapshot, runTransaction, type Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import { quota } from './quota';
import { uid } from './util';
import { MAX_TASKS, normalizeTask, normalizeTasks, taskDue, taskOccurrence, TASK_STALE_MS } from './tasks';
import type { ScheduledTask } from '../types';

type Change<T> = { items: ScheduledTask[]; result: T; changed: boolean };
export class TaskStore {
  private unsubscribe: Unsubscribe | null = null;
  private stopped = false;
  private previewDb: Promise<IDBDatabase> | null = null;
  constructor(private owner: string, private onChange: (items: ScheduledTask[], ready: boolean) => void, private onError: (message: string) => void) {}
  private get key() { return `mr.tasks.${this.owner}`; }
  private get ref() { return doc(db,'modelRouter',this.owner,'tasks','all'); }
  private cached() { try { return normalizeTasks(JSON.parse(localStorage.getItem(this.key)||'[]')); } catch { return []; } }
  private emit(items: ScheduledTask[], ready: boolean) {
    if(this.stopped)return;
    try { localStorage.setItem(this.key,JSON.stringify(items)); } catch { /* Cache is optional. */ }
    this.onChange(items,ready);
    window.dispatchEvent(new Event('mr:tasks-changed'));
  }
  private onStorage = (event: StorageEvent) => { if(event.key===this.key)this.onChange(this.cached(),true); };
  start() {
    this.stopped=false;
    this.onChange(this.cached(),false);
    if(this.owner.startsWith('preview-')) {
      window.addEventListener('storage',this.onStorage);
      void this.preview(items=>({items,result:undefined,changed:false})).catch(error=>this.onError(error.message));
      return;
    }
    this.unsubscribe=onSnapshot(this.ref,{includeMetadataChanges:true},snapshot=>{
      if(!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites)quota.count('reads');
      this.emit(normalizeTasks(Object.values(snapshot.data()?.items||{})),!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites);
    },error=>this.onError(`Tasks sync paused: ${error.message}`));
  }
  stop() { this.stopped=true;this.unsubscribe?.();this.unsubscribe=null;window.removeEventListener('storage',this.onStorage); }
  private openPreview() {
    this.previewDb ??= new Promise((resolve,reject)=>{
      const request=indexedDB.open(`model-router-tasks-${this.owner}`,1);
      request.onupgradeneeded=()=>request.result.createObjectStore('state');
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
    return this.previewDb;
  }
  private async preview<T>(change: (items: ScheduledTask[])=>Change<T>): Promise<T> {
    const database=await this.openPreview();
    return new Promise((resolve,reject)=>{
      const transaction=database.transaction('state','readwrite'),store=transaction.objectStore('state');
      const request=store.get('all');let result:T,items:ScheduledTask[];
      request.onsuccess=()=>{
        if(this.stopped){transaction.abort();return;}
        try {
          const previous=request.result===undefined ? this.cached() : normalizeTasks(request.result);
          const changed=change(previous);items=changed.items;result=changed.result;
          if(changed.changed || request.result===undefined)store.put(items,'all');
        } catch(error){reject(error);transaction.abort();}
      };
      transaction.oncomplete=()=>{this.emit(items,true);resolve(result);};
      transaction.onerror=()=>reject(transaction.error);
      transaction.onabort=()=>reject(transaction.error||new Error('Task update stopped.'));
    });
  }
  private async mutate<T>(change: (items: ScheduledTask[])=>Change<T>): Promise<T> {
    if(this.stopped)throw new Error('This account is no longer active.');
    if(!navigator.onLine)throw new Error('Connect to the internet to update or run tasks.');
    if(this.owner.startsWith('preview-'))return this.preview(change);
    if(quota.level()==='paused')throw new Error('Tasks are paused while the Firebase free-plan guard is active.');
    const changed=await runTransaction(db,async transaction=>{
      const snapshot=await transaction.get(this.ref);quota.count('reads');
      if(this.stopped)throw new Error('This account is no longer active.');
      const value=change(normalizeTasks(Object.values(snapshot.data()?.items||{})));
      if(value.changed)transaction.set(this.ref,{items:Object.fromEntries(value.items.map(item=>[item.id,item]))});
      return value;
    });
    if(changed.changed)quota.count('writes');
    this.emit(changed.items,true);return changed.result;
  }
  async save(raw: ScheduledTask) {
    const clean=normalizeTask(raw);if(!clean)throw new Error('Check the task name, prompt and schedule.');
    await this.mutate(items=>{
      const previous=items.find(item=>item.id===clean.id);
      if(!previous && items.length>=MAX_TASKS)throw new Error(`You can save up to ${MAX_TASKS} tasks.`);
      const task={...clean,createdAt:previous?.createdAt||clean.createdAt,updatedAt:Date.now(),...(previous?.lastRun ? {lastRun:previous.lastRun} : {}),...(previous?.lastOccurrence ? {lastOccurrence:previous.lastOccurrence} : {})};
      return {items:[task,...items.filter(item=>item.id!==task.id)],result:undefined,changed:true};
    });
  }
  async remove(id: string) { await this.mutate(items=>({items:items.filter(item=>item.id!==id),result:undefined,changed:items.some(item=>item.id===id)})); }
  async claim(id: string, manual = false, signal?: AbortSignal): Promise<ScheduledTask | null> {
    const token=uid();
    return this.mutate(items=>{
      const task=items.find(item=>item.id===id);
      if(signal?.aborted || !task || (!manual && !task.enabled) || task.lastRun?.status==='running')return {items,result:null,changed:false};
      const due=manual ? taskOccurrence({...task,enabled:true}) : taskDue(task);
      if(!manual && !due)return {items,result:null,changed:false};
      // A manual early run completes a one-off schedule; daily schedules keep future occurrences.
      const consumed=task.schedule.kind==='once' ? `once:${task.schedule.at}` : due?.key;
      const next:ScheduledTask={...task,...(consumed ? {lastOccurrence:consumed} : {}),lastRun:{key:manual ? `manual:${token}` : due!.key,token,at:Date.now(),status:'running'}};
      return {items:items.map(item=>item.id===id?next:item),result:next,changed:true};
    });
  }
  async finish(id: string, token: string, status: Exclude<NonNullable<ScheduledTask['lastRun']>['status'],'running'>, extra: {chatId?:string;error?:string} = {}) {
    await this.mutate(items=>{
      const task=items.find(item=>item.id===id);
      if(!task?.lastRun || task.lastRun.token!==token)return {items,result:undefined,changed:false};
      const lastRun={...task.lastRun,status,...(extra.chatId ? {chatId:extra.chatId} : {}),...(extra.error ? {error:extra.error.slice(0,1000)} : {})};
      return {items:items.map(item=>item.id===id?{...task,lastRun}:item),result:undefined,changed:true};
    });
  }
  async interruptStale(id: string) {
    await this.mutate(items=>{
      const task=items.find(item=>item.id===id);
      if(task?.lastRun?.status!=='running' || Date.now()-task.lastRun.at<TASK_STALE_MS)return {items,result:undefined,changed:false};
      const lastRun={...task.lastRun,status:'interrupted' as const,error:'This run was interrupted. Retry manually when ready; it may spend another message.'};
      return {items:items.map(item=>item.id===id?{...task,lastRun}:item),result:undefined,changed:true};
    });
  }
}
