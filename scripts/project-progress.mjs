// Recalculate the stable documentation baseline; this is not a product-quality benchmark.
import {readFileSync} from 'node:fs';
const plan=readFileSync(new URL('../IMPLEMENTATION_PLAN.md',import.meta.url),'utf8');
const table=plan.split('| Stable task | Weight | Earned fraction | Earned weighted work |')[1]?.split('\n\n')[0];
if(!table)throw new Error('Missing authoritative weighted progress table');
const tasks=[...table.matchAll(/^\| (P\d{2}-[A-Z]) \| ([\d.]+) \| ([\d.]+) \| ([\d.]+) \|$/gm)].map(([,id,weight,fraction,earned])=>({id,weight:Number(weight),fraction:Number(fraction),earned:Number(earned)}));
if(!tasks.length || new Set(tasks.map(task=>task.id)).size!==tasks.length)throw new Error('Missing or duplicate task IDs');
for(const task of tasks)if(!(task.weight>0) || task.fraction<0 || task.fraction>1 || Math.abs(task.weight*task.fraction-task.earned)>1e-6)throw new Error(`Invalid weighted credit: ${task.id}`);
const scope=tasks.reduce((sum,task)=>sum+task.weight,0),earned=tasks.reduce((sum,task)=>sum+task.earned,0);
if(Math.abs(scope-100)>1e-6)throw new Error('Scope weights must sum to100');
console.log(JSON.stringify({baseline:'v1',tasks:tasks.length,totalWeight:scope,earnedWeight:earned,remainingWeight:scope-earned,completionPercent:100*earned/scope},null,2));
