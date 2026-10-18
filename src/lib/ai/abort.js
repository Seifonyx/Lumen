// Race the operation itself; stalled/uncooperative IO cannot hold cancellation open.
export function waitFor(promise,signal) {
  return new Promise((resolve,reject)=>{
    const cleanup=()=>signal.removeEventListener('abort',abort);
    const abort=()=>{cleanup();reject(Object.assign(new Error('Stopped'),{name:'AbortError'}));};
    signal.addEventListener('abort',abort,{once:true});
    Promise.resolve(promise).then(value=>{cleanup();resolve(value);},error=>{cleanup();reject(error);});
    if(signal.aborted)abort();
  });
}
