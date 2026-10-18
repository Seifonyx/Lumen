// One discovery pass per credential scope. Contains no credentials or browser storage.
// A new scope gets a new instance; invalidate the old one before publishing new keys.
const changed = () => new Error('Provider settings changed. Refresh models again.');
const kindOf = e => e?.status === 401 || e?.status === 403 ? 'auth'
  : e?.status === 429 ? 'rate-limit' : e?.status >= 500 ? 'provider'
  : e?.name === 'TimeoutError' ? 'timeout'
  : e instanceof TypeError || e?.name==='TypeError' || /connection failed|failed to fetch|network|load failed/i.test(e?.message || '') ? 'network' : 'invalid';

export function createModelRegistry({ providers, enabled, load, ttl = () => 10 * 60_000,
  now = Date.now, random = Math.random, sleep = ms => new Promise(r => setTimeout(r, ms)),
  concurrency = 4, attemptMs = 15_000, maxRetries = 1 }) {
  const records = new Map();
  const revisions=new Map();
  const scope = new AbortController();
  let inFlight = null;
  let valid = true;

  // Race IO itself: cancellation still settles if an adapter ignores abort.
  const invoke = provider => new Promise((resolve, reject) => {
    const controller = new AbortController();
    const abort = () => { controller.abort(); finish(reject, changed()); };
    const finish = (settle, value) => { clearTimeout(timer); scope.signal.removeEventListener('abort', abort); settle(value); };
    const timer = setTimeout(() => {
      controller.abort(); finish(reject, Object.assign(new Error('Discovery timed out'), {name:'TimeoutError'}));
    }, attemptMs);
    scope.signal.addEventListener('abort', abort, {once:true});
    try { Promise.resolve(load(provider, controller.signal)).then(value => finish(resolve,value),e => finish(reject,e)); }
    catch (e) { finish(reject,e); }
    if (scope.signal.aborted) abort();
  });

  const snapshot = () => {
    const active = providers.filter(enabled);
    return {
      models: active.flatMap(p => (records.get(p)?.models || []).map(m => ({...m,
        metadata: {...m.metadata, stale:records.get(p).state !== 'ready'}}))),
      providerStatus: Object.fromEntries(active.filter(p => records.has(p)).map(p => {
        const {models:_,failures:__,...status}=records.get(p);return [p,status];
      })),
      failedProviders: active.filter(p => records.get(p)?.error),
      errors: active.flatMap(p => records.get(p)?.error ? [records.get(p).error] : []),
    };
  };

  async function discover(provider) {
    const previous=records.get(provider);
    const revision=revisions.get(provider) || 0;
    const lastAttempt=now();
    let failure;
    for(let attempt=0;attempt<=maxRetries;attempt++) {
      if(!valid) throw changed();
      try {
        const list=await invoke(provider);
        if(!valid) throw changed();
        if(!Array.isArray(list)) throw new Error('Invalid model catalogue');
        const models=[...new Map(list.filter(m => typeof m?.id === 'string' && m.id.startsWith(`${provider}:`)).map(m=>[m.id,m])).values()];
        const lastSuccess=now();
        records.set(provider,{models,state:'ready',lastAttempt,lastSuccess,nextRefresh:revision===(revisions.get(provider)||0)?lastSuccess+ttl(provider)*(0.9+random()*0.2):0,failures:0});
        return;
      } catch(e) {
        if(!valid) throw changed();
        failure=e;
        if(!['network','provider'].includes(kindOf(e)) || attempt===maxRetries) break;
        await sleep(250*2**attempt*(0.75+random()*0.5));
      }
    }
    if(!valid) throw changed();
    const errorKind=kindOf(failure), failures=(previous?.failures || 0)+1;
    const models=errorKind==='auth'?[]:previous?.models || [];
    // Retry-After is honored (bounded to a day); failures do not create tight refresh loops.
    const backoff=Math.max(Math.min(600_000,30_000*2**Math.min(failures-1,5))*(0.9+random()*0.2),Math.min(86400_000,failure?.retryAfterMs || 0));
    records.set(provider,{models,state:models.length?'stale':'error',lastAttempt,lastSuccess:previous?.lastSuccess ?? null,
      nextRefresh:now()+backoff,errorKind,error:String(failure?.message || 'Model discovery failed'),failures});
  }

  return {
    snapshot,
    expire(provider) {
      if(!valid || !providers.includes(provider) || !enabled(provider))return false;
      const record=records.get(provider);
      if(!record || (record.error && record.nextRefresh>now()))return false;
      revisions.set(provider,(revisions.get(provider)||0)+1);
      records.set(provider,{...record,state:record.models.length?'stale':record.state,nextRefresh:0});
      return true;
    },
    invalidate() { valid=false;records.clear();scope.abort(); },
    seed(value) {
      if(inFlight || !valid) return;
      for(const p of providers.filter(enabled)) {
        if(records.has(p)) continue;
        const models=(value.models || []).filter(m=>m.id?.startsWith(`${p}:`));
        const lastSuccess=value.providerStatus?.[p]?.lastSuccess;
        if(models.length) records.set(p,{models,state:'stale',lastAttempt:0,lastSuccess:Number.isFinite(lastSuccess)?lastSuccess:null,nextRefresh:0,failures:0});
      }
    },
    read({refresh=false}={}) {
      if(!valid) return Promise.reject(changed());
      if(inFlight) return inFlight;
      const pending=providers.filter(p=>enabled(p)&&(refresh || !records.has(p) || records.get(p).nextRefresh<=now()));
      if(!pending.length) return Promise.resolve(snapshot());
      const queue=[...pending];
      const worker=async()=>{ for(let p=queue.shift();p;p=queue.shift()) await discover(p); };
      const work=Promise.all(Array.from({length:Math.min(concurrency,queue.length)},worker)).then(()=>{
        if(!valid) throw changed();return snapshot();
      });
      inFlight=work;
      // Do not create an unhandled rejected promise from a detached finally().
      work.then(()=>{if(inFlight===work)inFlight=null;},()=>{if(inFlight===work)inFlight=null;});
      return work;
    },
  };
}
