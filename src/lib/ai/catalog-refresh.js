// Timers only run in an active browser. Resume/online events also check expiry;
// the registry decides which providers need IO and deduplicates concurrent work.
export function startCatalogRefresh({windowTarget=window,documentTarget=document,canRefresh,refresh,intervalMs=60_000,
  schedule=setInterval,unschedule=clearInterval}) {
  const tick=()=>{
    if(documentTarget.hidden || !canRefresh()) return;
    void Promise.resolve().then(()=>refresh()).catch(()=>{});
  };
  const timer=schedule(tick,intervalMs);
  windowTarget.addEventListener('focus',tick);
  windowTarget.addEventListener('online',tick);
  documentTarget.addEventListener('visibilitychange',tick);
  return ()=>{
    unschedule(timer);
    windowTarget.removeEventListener('focus',tick);
    windowTarget.removeEventListener('online',tick);
    documentTarget.removeEventListener('visibilitychange',tick);
  };
}
