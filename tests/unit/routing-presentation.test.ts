import assert from 'node:assert/strict';
import { fallbackPresentation,layoutPreview,completedRoutingRecord,currentRoutingPresentation,layoutAssignmentProblem } from '../../src/lib/routing-presentation';
import { DEFAULT_SETTINGS } from '../../src/lib/settings';
import type { Layout } from '../../src/lib/layouts';
import type { Message } from '../../src/types';
const layout:Layout={id:'saved',name:'Careful writing',description:'',icon:'pen',mode:'order',models:['gemini:missing','gemini:flash'],fallback:'layout'};
assert.equal(fallbackPresentation(layout,false).title,'Automatic switching is off');
assert.equal(fallbackPresentation({...layout,fallback:'none'},true).title,'No automatic fallback');
assert.equal(fallbackPresentation({...layout,fallback:undefined},true).title,'Layout, then enabled models','legacy undefined fallback keeps canonical enabled scope');
assert.equal(fallbackPresentation(layout,true).title,'Only this Layout');
assert.equal(fallbackPresentation(undefined,true).title,'Enabled models permitted');
assert.equal(fallbackPresentation({...layout,fallback:'future-invalid'} as unknown as Layout,true).title,'No automatic fallback');
const preview=layoutPreview({...layout,priority:'quality',requirements:{capabilities:['vision'],minContext:128000}}, {...DEFAULT_SETTINGS,autoSwitch:false,routingPreference:'speed'});
assert.match(preview.mode,/saved order/);assert.equal(preview.priority,'Quality');assert.match(preview.requirements,/Images/);assert.match(preview.requirements,/128,000/);assert.match(preview.fallback.title,/off/);
assert.equal(layout.models[0],'gemini:missing','presentation cannot remove/reorder saved assignments');
const done:Message={id:'done',role:'assistant',text:'PRIVATE_BODY_DO_NOT_COPY',model:'gemini:flash',status:'done',createdAt:2,via:'An earlier Layout',notices:['Pro hit its usage limit — switched to Flash.']};
const newer:Message={...done,id:'error',model:'gemini:pro',createdAt:3,status:'error'};
assert.equal(completedRoutingRecord([done,newer])?.model,'gemini:flash');assert.deepEqual(completedRoutingRecord([done])?.reasons,[],'never fabricate a best-available reason');assert.deepEqual(completedRoutingRecord([done])?.recovery,['Pro hit its usage limit — switched to Flash.']);assert(!JSON.stringify(completedRoutingRecord([done])).includes('PRIVATE_BODY'));
for(const status of ['streaming','stopped','error',undefined] as const)assert.equal(completedRoutingRecord([{...done,status}]),null,'only an explicit completed answer is evidence');
const reasoned={...done,notices:undefined,route:'strong writer',routeDetail:{why:['strong writer'],next:['gemini:other']}};
assert.deepEqual(completedRoutingRecord([reasoned])?.alternatives,['gemini:other']);
assert.equal(completedRoutingRecord([done])?.via,'An earlier Layout');
assert.equal(currentRoutingPresentation('auto',DEFAULT_SETTINGS,null).kind,'Auto');assert.equal(currentRoutingPresentation('layout:saved',{...DEFAULT_SETTINGS,layouts:[layout]},null).kind,'Layout');
assert.equal(currentRoutingPresentation('layout:missing',DEFAULT_SETTINGS,null).kind,'Missing Layout');
assert.doesNotMatch(currentRoutingPresentation('gemini:flash',DEFAULT_SETTINGS,null).description,/Every message.*uses|will answer/);
console.log('PASS effective legacy/global fallback, preview, current-vs-recorded routing, missing evidence and privacy');

const nonstream = {id:'gemini:no-stream',provider:'google' as const,name:'no-stream',label:'No stream',context:null,vision:false,pdf:false,search:false,thinking:false,streaming:false};
assert.match(layoutAssignmentProblem(layout, nonstream)!, /streamed replies/, 'a display advisory catches request-time streaming incompatibility even without saved requirements');

assert.equal(completedRoutingRecord([{...done,error:'ambiguous legacy error'}]),null,'an error cannot be presented as a completed answer');
assert.equal(completedRoutingRecord([{...done,via:'Combined from 2 answers'}])?.via,'Combined from 2 answers','source provenance is kept literally, not inferred as a Layout');

const quotaNotice = "Gemini Pro reached its limit (available again 3:00 PM) — using Gemini Flash.";
assert.deepEqual(completedRoutingRecord([{...done,notices:[quotaNotice,"Not a recovery event"]}])?.recovery,[quotaNotice],"saved preflight quota recovery must remain visible");
