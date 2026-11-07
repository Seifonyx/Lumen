export function allowRequest(headers,session,path){return headers.host==='localhost:5213'&&headers.origin==='http://localhost:5213'&&path==='/'+session+'/result';}
export function acceptReport(value){return value&&Object.keys(value).sort().join(',')==='authorized,cleaned,cloudRoundtrip,flow'&&value.flow==='google-popup'&&value.authorized===true&&value.cloudRoundtrip===true&&value.cleaned===true;}

export function withDeadline(operation, milliseconds) {
 let timer;
 return Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Cloud verification timed out')),milliseconds);})]).finally(()=>clearTimeout(timer));
}
