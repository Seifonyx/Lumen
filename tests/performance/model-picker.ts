import {performance} from 'node:perf_hooks';
import {planRoute} from '../../src/lib/routing';
import {rankForTask,taskFromText} from '../../src/lib/layout-builder';
import {helperModels} from '../../src/lib/helper-routing';
import {comparisonSnapshotKey} from '../../src/lib/comparison-snapshot';
import {DEFAULT_SETTINGS} from '../../src/lib/settings';
const measure=(work:()=>unknown)=>{for(let i=0;i<5;i++)work();const times=[];for(let i=0;i<40;i++){const start=performance.now();work();times.push(performance.now()-start);}times.sort((a,b)=>a-b);return {medianMs:times[20],p95Ms:times[38]};};
let networkRequests=0;globalThis.fetch=async()=>{networkRequests++;throw new Error('Performance checks must not contact providers.');};
const report=[];
for(const count of [20,100,1000]) {
 const catalog=Array.from({length:count},(_,i)=>({id:`groq:general-${i}`,name:`general-${i}`,label:`General ${i}`,provider:'groq' as const,context:128000,outputLimit:8192,vision:false,pdf:false,thinking:false,search:false}));
 const enabled=catalog.map(model=>model.id),text='Write a tested Python API with careful error handling';
 const input={selected:'auto',enabled,catalog,text,files:[],conversationTokens:2000,search:false,blocked:()=>false,left:()=>null};
 const task=taskFromText(text);
 report.push({models:count,auto:measure(()=>planRoute(input)),layout:measure(()=>rankForTask(task,catalog)),helper:measure(()=>helperModels(catalog,{enabledModels:enabled},{tokens:2000,outputTokens:4096,text,blocked:()=>false,left:()=>null}))});
}
const chat={id:'synthetic',title:'Synthetic',createdAt:1,updatedAt:1,messages:Array.from({length:1000},(_,i)=>({id:String(i),role:i%2?'assistant' as const:'user' as const,text:'Synthetic context '.repeat(50),createdAt:1}))};
console.log(JSON.stringify({node:process.version,syntheticOnly:true,networkRequests,operations:report,contextSnapshot:measure(()=>comparisonSnapshotKey({settings:DEFAULT_SETTINGS,chat,memories:[]}))},null,2));
