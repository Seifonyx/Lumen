import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modelDeclarationEndpoint, normalizeModelDeclarations, mergeModelDeclarations } from '../../src/lib/ai/model-declarations.js';
import { normalizeKeys } from '../../src/lib/ai/provider-config.js';

const configuration = normalizeKeys({ groq:'private-test-key', gemini:'private-google-key', openrouter:'private-or-key',
  alibaba:'private-ali-key', perplexity:'private-pplx-key', providerAccess:{alibaba:true,perplexity:true} });
const endpoint = provider => modelDeclarationEndpoint(provider, configuration);
const declaration = (provider='groq', name='new/chat', extra={}) => ({provider,name,endpoint:endpoint(provider),...extra});
const merge = (models, declarations, options={}) => mergeModelDeclarations(models,declarations,{configuration,...options});
const row = (extra={}) => ({id:'groq:new/chat',provider:'groq',name:'new/chat',label:'Listed',endpoint:endpoint('groq'),
  context:null,vision:false,pdf:false,thinking:false,search:false,
  metadata:{source:'api',fields:{context:'unknown',vision:'inferred',pdf:'documented',thinking:'inferred',search:'documented'}},...extra});

test('normalization creates stable IDs, trims strings, is idempotent and never retains credentials', () => {
  const input = [declaration('groq','  new/chat  ',{label:'  New Chat  ',context:64000,vision:true})];
  const clean = normalizeModelDeclarations(input);
  assert.equal(clean[0].id,'groq:new/chat');
  assert.equal(clean[0].label,'New Chat');
  assert.deepEqual(normalizeModelDeclarations(clean),clean);
  assert.notEqual(clean[0],input[0]);
  assert.throws(()=>normalizeModelDeclarations([declaration('groq','test',{apiKey:'secret'})]),/field|credential/i);
  assert(!JSON.stringify(clean).includes('private'));
});

test('validation rejects duplicates, spoofed IDs, malformed values, prototype payloads and bounded huge input', () => {
  const invalid = [null,{},'[]',Array(2),Array(101).fill(declaration()),
    [declaration(),declaration()],
    [declaration('other','chat')], [declaration('groq','../chat')], [declaration('groq','chat?key=secret')],
    [declaration('groq','a'.repeat(257))], [declaration('groq','chat',{id:'openai:chat'})],
    [declaration('groq','chat',{label:'x'.repeat(161)})], [declaration('groq','chat',{vision:'true'})],
    [declaration('groq','chat',{context:0})], [declaration('groq','chat',{context:Infinity})],
    [declaration('groq','chat',{context:1e12})], [declaration('groq','chat',{outputLimit:1.5})],
    [declaration('groq','chat',{endpoint:'https://api.groq.com/openai/v1?key=secret'})],
    [declaration('groq','chat',{endpoint:'https://user:pass@api.groq.com/openai/v1'})],
    [declaration('groq','chat',{endpoint:'https://attacker.invalid/v1'})],
    [JSON.parse('{"provider":"groq","name":"chat","endpoint":"https://api.groq.com/openai/v1","__proto__":{"apiKey":"secret"}}')]];
  for (const value of invalid) assert.throws(()=>normalizeModelDeclarations(value));
  assert.deepEqual(normalizeModelDeclarations(undefined),[]);
});

test('endpoint scopes match adapters, including Alibaba region and configured Cloudflare relay', () => {
  assert.equal(endpoint('gemini'),'https://generativelanguage.googleapis.com/v1beta');
  assert.equal(endpoint('openrouter'),'https://openrouter.ai/api/v1');
  assert.equal(modelDeclarationEndpoint('alibaba',{alibabaBaseUrl:'https://dashscope.aliyuncs.com/compatible-mode/v1/'}),'https://dashscope.aliyuncs.com/compatible-mode/v1');
  assert.equal(modelDeclarationEndpoint('cloudflare',{providerRelayUrl:'https://relay.example/custom/'}),'https://relay.example/custom/cloudflare');
  assert.equal(modelDeclarationEndpoint('alibaba',{alibabaBaseUrl:'https://attacker.invalid/v1'}),null);
  assert.equal(modelDeclarationEndpoint('unsupported',configuration),null);
  assert.equal(modelDeclarationEndpoint('nvidia',{providerRelayUrl:'https://relay.example/custom'}),'https://integrate.api.nvidia.com/v1');
});

test('Cloudflare declarations are scoped to the configured account as well as relay endpoint', () => {
  const cloudConfiguration=normalizeKeys({cloudflare:'private-cf-key',cloudflareAccountId:'a'.repeat(32),providerAccess:{cloudflare:true}});
  const declared={provider:'cloudflare',name:'@cf/new-chat',endpoint:modelDeclarationEndpoint('cloudflare',cloudConfiguration),accountId:'A'.repeat(32),context:64000};
  const clean=normalizeModelDeclarations([declared]);
  assert.equal(clean[0].accountId,'a'.repeat(32));
  assert.deepEqual(normalizeModelDeclarations(clean),clean);
  assert.equal(merge([],clean,{configuration:cloudConfiguration}).length,1);
  const changed={...cloudConfiguration,cloudflareAccountId:'b'.repeat(32)};
  assert.deepEqual(merge([],clean,{configuration:changed}),[]);
  const discovered={id:'cloudflare:@cf/new-chat',provider:'cloudflare',name:'@cf/new-chat',endpoint:declared.endpoint,context:null,metadata:{source:'api',fields:{context:'unknown'}}};
  assert.equal(merge([discovered],clean,{configuration:changed})[0].context,null);
  assert.equal(merge([discovered],clean,{configuration:cloudConfiguration})[0].context,64000);
  const {accountId:_,...unscoped}=declared;
  assert.throws(()=>normalizeModelDeclarations([unscoped]),/account/i);
  assert.throws(()=>normalizeModelDeclarations([{...declared,accountId:'bad'}]),/account/i);
  assert.throws(()=>normalizeModelDeclarations([declaration('groq','test',{accountId:'a'.repeat(32)})]),/account/i);
  const other={...declared,accountId:'b'.repeat(32)};
  assert.equal(normalizeModelDeclarations([declared,other]).length,2);
  assert.throws(()=>normalizeModelDeclarations([declared,{...declared,accountId:'a'.repeat(32)}]),/duplicate/i);
});

test('Nvidia relay changes retain official upstream identity and documented false attachment/search facts', () => {
  const nvidiaConfiguration=normalizeKeys({nvidia:'private-nvidia-key',providerRelayUrl:'https://relay.example/custom',providerAccess:{nvidia:true}});
  const declared=declaration('nvidia','vendor/new',{context:64000,pdf:true,search:true});
  const discovered={...row(),id:'nvidia:vendor/new',provider:'nvidia',name:'vendor/new',endpoint:'https://integrate.api.nvidia.com/v1'};
  const result=merge([discovered],[declared],{configuration:nvidiaConfiguration});
  assert.equal(result[0].context,64000);assert.equal(result[0].pdf,false);assert.equal(result[0].search,false);
  const google={...row(),id:'gemini:gemini-3-new',provider:'google',name:'gemini-3-new',endpoint:endpoint('gemini'),metadata:{source:'api',fields:{pdf:'documented',search:'api'}}};
  const googleResult=merge([google],[declaration('gemini','gemini-3-new',{pdf:true,search:true})]);
  assert.equal(googleResult[0].pdf,false);assert.equal(googleResult[0].search,false);
});

test('unknown metadata is filled without mutating API inputs or inventing verification', () => {
  const api = row();
  const before = structuredClone(api);
  const result = merge([api],[declaration('groq','new/chat',{label:'User label',context:64000,outputLimit:8192,vision:true,thinking:true,tools:true})]);
  assert.equal(result.length,1);
  assert.equal(result[0].label,'Listed');
  assert.equal(result[0].context,64000);
  assert.equal(result[0].vision,true);
  assert.equal(result[0].outputLimit,8192);
  assert.equal(result[0].tools,true);
  assert.equal(result[0].metadata.source,'api');
  assert.equal(result[0].metadata.fields.context,'user');
  assert.equal(result[0].metadata.verification,'unchecked');
  assert(result[0].metadata.declaredFields.includes('vision'));
  assert.deepEqual(api,before);
});

test('explicit API and documented values outrank declarations including false and zero', () => {
  const api = row({context:32000,outputLimit:4096,tools:false,structuredOutput:false,streaming:true,
    metadata:{source:'api',fields:{context:'api',vision:'api',pdf:'documented',thinking:'documented',search:'documented'}}});
  const result=merge([api],[declaration('groq','new/chat',{context:128000,outputLimit:16000,vision:true,thinking:true,tools:true,structuredOutput:true,streaming:false})])[0];
  assert.equal(result.context,32000);assert.equal(result.outputLimit,4096);
  assert.equal(result.vision,false);assert.equal(result.thinking,false);
  assert.equal(result.tools,false);assert.equal(result.structuredOutput,false);assert.equal(result.streaming,true);
});

test('new declarations are visibly unchecked and cannot widen native PDF/search transports', () => {
  const result=merge([], [declaration('groq','new/chat',{pdf:true,search:true,vision:true}),
    declaration('gemini','gemma-3-new',{pdf:true,search:true}),declaration('gemini','gemini-3-new',{pdf:true,search:true}),
    declaration('perplexity','sonar-new',{pdf:true,search:true})]);
  assert.equal(result.length,4);
  const [groq,gemma,gemini,sonar]=result;
  assert.equal(groq.pdf,false);assert.equal(groq.search,false);assert.equal(groq.vision,true);
  assert.equal(gemma.pdf,false);assert.equal(gemma.search,false);
  assert.equal(gemini.provider,'google');assert.equal(gemini.pdf,true);assert.equal(gemini.search,true);
  assert.equal(sonar.pdf,false);assert.equal(sonar.search,true);
  assert.equal(groq.metadata.source,'user');assert.equal(groq.metadata.verification,'unchecked');
  assert.equal(groq.metadata.fields.pdf,'documented');
  assert.equal(groq.context,null);assert.equal(groq.thinking,false);
  assert.equal(groq.metadata.fields.thinking,'unknown');
  assert(!JSON.stringify(result).includes('private-test-key'));
});

test('disconnected, billing-disabled, auth-rejected and explicitly unavailable declarations stay absent', () => {
  const declarations=[declaration(),declaration('perplexity','sonar-new')];
  assert.deepEqual(merge([],declarations,{configuration:normalizeKeys()}),[]);
  assert.deepEqual(merge([],declarations,{configuration:normalizeKeys({perplexity:'key'})}),[]);
  assert.deepEqual(merge([],declarations,{providerStatus:{groq:{errorKind:'auth'},perplexity:{errorKind:'auth'}}}),[]);
  assert.deepEqual(merge([], [declaration()],{unavailableModels:['groq:new/chat']}),[]);
  assert.equal(merge([], [declaration()],{providerStatus:{groq:{errorKind:'network'}}}).length,1);
});

test('identical provider model names from another endpoint never merge or re-register', () => {
  const saved = declaration('alibaba','qwen-new',{context:64000});
  const changed = normalizeKeys({...configuration,alibabaBaseUrl:'https://dashscope.aliyuncs.com/compatible-mode/v1'});
  assert.deepEqual(merge([], [saved],{configuration:changed}),[]);
  const foreign=row({endpoint:'https://other.example/v1'});
  const result=merge([foreign],[declaration('groq','new/chat',{context:64000})]);
  assert.equal(result.length,1);assert.equal(result[0].context,null);
});

test('OpenRouter declarations cannot add unlisted or paid models or alter free-only pricing', () => {
  assert.deepEqual(merge([], [declaration('openrouter','vendor/unknown',{context:64000})]),[]);
  const api={...row(),id:'openrouter:vendor/free',provider:'openrouter',name:'vendor/free',endpoint:endpoint('openrouter'),pricing:{input:0,output:0,currency:'USD',unit:'token'}};
  const result=merge([api],[declaration('openrouter','vendor/free',{context:64000})]);
  assert.equal(result[0].context,64000);assert.deepEqual(result[0].pricing,api.pricing);
  assert.deepEqual(merge([], [declaration('openrouter','vendor/paid')]),[]);
  const paid={...api,pricing:{...api.pricing,input:0.001}};
  assert.equal(merge([paid],[declaration('openrouter','vendor/free',{context:64000})])[0].context,null);
});

test('removing a declaration restores untouched discovery inputs on the next pure merge', () => {
  const original=row();const declared=[declaration('groq','new/chat',{context:64000}),declaration('groq','manual')];
  assert.equal(merge([original],declared).length,2);
  assert.deepEqual(merge([original],[]),[original]);
});
