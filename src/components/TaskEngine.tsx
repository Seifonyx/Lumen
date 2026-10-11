import { useEffect } from 'react';
import { useStore } from '../store';
import { taskDue, TASK_STALE_MS } from '../lib/tasks';

/** App-open scheduler only: no service-worker timers, push permission or paid background jobs. */
export default function TaskEngine() {
  const accountId=useStore(state=>state.user?.uid);
  const authed=useStore(state=>state.authed);
  useEffect(()=>{
    if(!authed || !accountId)return;
    let stopped=false, busy=false;
    const nextTry=new Map<string,number>();
    const tick=async()=>{
      const state=useStore.getState(),now=Date.now();
      if(stopped || busy || document.visibilityState==='hidden' || state.user?.uid!==accountId || !state.tasksReady || !state.online || state.firebaseUsage.level==='paused' || state.runningTaskId || state.streamingChatId || state.compactingChatId || state.comparing || state.canvasEditingChatId)return;
      const stale=state.tasks.find(task=>task.lastRun?.status==='running' && now-task.lastRun.at>=TASK_STALE_MS && (nextTry.get(task.id)||0)<=now);
      const due=state.tasks.map(task=>({task,due:taskDue(task,now)})).filter(item=>item.due && (item.task.kind==='reminder' || state.catalog) && item.task.lastRun?.status!=='running' && (nextTry.get(item.task.id)||0)<=now).sort((a,b)=>a.due!.at-b.due!.at)[0]?.task;
      const task=stale||due;if(!task)return;
      busy=true;nextTry.set(task.id,now+5*60_000);
      try { if(stale)await state.interruptStaleTask(task.id);else await state.runTask(task.id); }
      catch(error){if(!stopped)useStore.getState().toast(`Tasks paused: ${(error as Error).message}`,'error');}
      finally{busy=false;}
    };
    const onOpen=()=>{if(document.visibilityState!=='hidden')void tick();};
    const onOnline=()=>{nextTry.clear();void tick();};
    const timer=setInterval(()=>void tick(),30_000);
    window.addEventListener('mr:tasks-changed',onOpen);
    window.addEventListener('online',onOnline);
    document.addEventListener('visibilitychange',onOpen);
    void tick();
    return ()=>{stopped=true;clearInterval(timer);window.removeEventListener('mr:tasks-changed',onOpen);window.removeEventListener('online',onOnline);document.removeEventListener('visibilitychange',onOpen);};
  },[accountId,authed]);
  return null;
}
