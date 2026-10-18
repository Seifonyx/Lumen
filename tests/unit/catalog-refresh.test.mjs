import assert from 'node:assert/strict';
import { startCatalogRefresh } from '../../src/lib/ai/catalog-refresh.js';
const windowTarget=new EventTarget(),documentTarget=new EventTarget();
let can=true,tick,stopped=false,calls=0;
const flush=()=>new Promise(r=>setTimeout(r,0));
const stop=startCatalogRefresh({windowTarget,documentTarget,canRefresh:()=>can,refresh:()=>{calls++;},
 schedule:callback=>{tick=callback;return 42;},unschedule:id=>{assert.equal(id,42);stopped=true;}});
tick(); await flush();assert.equal(calls,1);
documentTarget.hidden=true;tick();windowTarget.dispatchEvent(new Event('focus'));await flush();assert.equal(calls,1);
documentTarget.hidden=false;documentTarget.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(calls,2);
can=false;windowTarget.dispatchEvent(new Event('online'));await flush();assert.equal(calls,2);
can=true;windowTarget.dispatchEvent(new Event('online'));await flush();assert.equal(calls,3);
stop();assert(stopped);windowTarget.dispatchEvent(new Event('focus'));documentTarget.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(calls,3);
console.log('PASS active-only refresh, resume/online events, offline/auth gating and listener cleanup');
