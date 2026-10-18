import assert from 'node:assert/strict';
import { AUTO, planRoute } from '../../src/lib/routing';
import type { ModelInfo, Attachment } from '../../src/types';
import { attachmentNeeds, modelProblem } from '../../src/lib/ai/eligibility.js';
import { features } from '../../src/lib/model-profile';
import { selectedModel } from '../../src/lib/model-selection';
import { DEFAULT_SETTINGS } from '../../src/lib/settings';
const text: ModelInfo={id:'openrouter:coder',name:'coder',label:'Coder',provider:'openrouter',context:64000,vision:false,pdf:false,thinking:false,search:false};
const vision: ModelInfo={...text,id:'gemini:gemini-flash-latest',name:'gemini-flash-latest',label:'Vision',provider:'google',vision:true,pdf:true};
const photo: Attachment={id:'image',name:'photo.png',mime:'image/png',kind:'image',size:100,data:'fixture'};
const base={selected:text.id,enabled:[text.id,vision.id],catalog:[text,vision],text:'Describe the attached photo',files:[photo],conversationTokens:1700,search:false,blocked:()=>false,left:()=>null};

const locked=planRoute({...base,allowFallback:false});
assert.equal(locked.model,'','manual incompatibility must not authorize substitution');
assert.match(locked.error || '',/image/i);
assert.deepEqual(locked.fallbacks,[]);
assert.equal(planRoute({...base,allowFallback:true}).model,vision.id);
assert.equal(planRoute({...base,selected:AUTO,allowFallback:false}).model,vision.id,'Auto still chooses its initial eligible model when recovery is disabled');

const allExcluded=planRoute({...base,selected:AUTO,excluded:base.enabled});
assert.equal(allExcluded.model,'','Never use in Auto is a hard user constraint');
assert.match(allExcluded.error || '',/excluded/i);
assert.equal(planRoute({...base,selected:vision.id,excluded:base.enabled}).model,vision.id,'Auto exclusions do not apply to explicit manual choices');

const absent={...base,text:'hello',files:[],selected:'openrouter:removed',enabled:['openrouter:removed',vision.id],unavailable:['openrouter:removed']};
assert.equal(planRoute({...absent,allowFallback:false}).model,'');
assert.equal(planRoute({...absent,allowFallback:true}).model,vision.id);
assert.equal(planRoute({...absent,selected:AUTO}).model,vision.id,'a removed registry entry is not an unknown last-resort model');

const unknown={...text,context:null};
const huge={...base,selected:AUTO,enabled:[unknown.id],catalog:[unknown],files:[],conversationTokens:100000};
assert.equal(planRoute(huge).model,'','an omitted context limit does not grant infinite capacity');
assert(modelProblem(undefined,{tools:true}));
assert(modelProblem({...text,tools:null},{tools:true}));
assert.equal(modelProblem({...text,tools:true},{tools:true}),null);
assert(modelProblem({...text,structuredOutput:false},{structuredOutput:true}));
assert(modelProblem(text,{minContext:200000}));
assert.equal(modelProblem(vision,{image:true,pdf:true,tokens:1000}),null);
assert.deepEqual(attachmentNeeds([{kind:'pdf',text:'Extracted content'},{kind:'image',text:'Extracted image description'}]),{image:false,pdf:false});
assert.equal(features({...text,name:'thinking-reasoner',thinking:false,metadata:{fields:{thinking:'api'}}}).slow,0,'verified negative reasoning metadata outranks the name');
const saved={...DEFAULT_SETTINGS,enabledModels:[vision.id],defaultModel:vision.id,unavailableModels:[text.id]};
assert.equal(selectedModel({model:text.id} as any,saved,null),text.id,'the displayed and executed chat choice stays explicit after model rejection');
assert.equal(selectedModel(null,{...saved,defaultModel:text.id},null),text.id,'a missing explicit default is not silently replaced');
assert.equal(selectedModel({model:text.id} as any,{...saved,unavailableModels:[]},null),vision.id,'explicit removal from enabled models still takes effect');
assert.equal(selectedModel(null,{...saved,projects:[{id:'project',defaultModel:text.id} as any],enabledModels:[text.id,vision.id]},null,'project'),text.id);
console.log('PASS manual fallback authorization, strict Auto exclusions, removed-model eligibility and bounded unknown context');
