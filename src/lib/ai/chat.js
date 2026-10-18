// Runs a chat turn in the browser: tries the chosen model, then the fallbacks, and yields events:
//   {t:'model', id} {t:'notice', text} {t:'think', text} {t:'text', text} {t:'sources', items} {t:'error', text} {t:'done'}
// and, for the usage meter: {t:'request', id} {t:'usage', id, input, output} {t:'limit', id, scope, quota?, resetAt?, retryAfterSec?}

import { buildInstructions } from './instructions.js';
import { complete, hasKey, isModelRegistered, keyVersion, invalidateModelMetadata, modelCapabilities, openStream, parseModelId,providerSignal } from './providers.js';
import { isUnavailableFailure } from './model-status.js';
import { hasVideo, toolModel } from './tool-inputs.js';
import { healthScope, isCoolingDown, noteFailure, noteSuccess, noteReplyLatency, replyLatency } from './health.js';
import { requestTokens } from './context-budget.js';
import { attachmentNeeds, modelProblem,modelRequirementsProblem } from './eligibility.js';
import { estimatedCost } from './preferences.js';
import { waitFor } from './abort.js';
import { classifyFailure,recoveryDecision } from './recovery.js';
export { waitFor } from './abort.js';

const MAX_ATTEMPTS = 5;
export const timeouts = {
  // A model that sends nothing for this long is treated as failed and the next one is tried.
  firstResponseMs: 25_000,
  quickResponseMs: 8_000,
  quickAnswerMs: 20_000,
  // Once answering, a model that goes silent this long is considered stuck.
  idleMs: 45_000,
  firstAnswerMs: 60_000,
  noAnswerMs: 120_000,
  totalMs: 600_000,
  summaryAttemptMs: 30_000,
  summaryTotalMs: 60_000,
};

// Keep the chosen model first, then spread attempts across providers. Readiness
// precedes layout preference; search breaks ties within each ready/layout tier.
export function attemptQueue(ids, { searchCapable, blocked, preferred, cost, preserveOrder=false, keepFirst = true } = {}) {
  const remaining = [...ids];
  const queue = [];
  const counts = new Map();
  while (remaining.length) {
    const healthy = remaining.filter(id => !isCoolingDown(id) && !blocked?.(id));
    const available = healthy.length ? healthy : remaining;
    const scoped = preferred && available.some(preferred) ? available.filter(preferred) : available;
    const searchable = !preserveOrder && searchCapable && scoped.some(searchCapable) ? scoped.filter(searchCapable) : scoped;
    const lowest=!preserveOrder && cost?Math.min(...searchable.map(id=>cost(id)??Infinity)):Infinity;
    const pool=Number.isFinite(lowest)?searchable.filter(id=>cost(id)===lowest):searchable;
    const fewest = Math.min(...pool.map(id => counts.get(id.split(':')[0]) || 0));
    const index = queue.length || !keepFirst ? remaining.findIndex(id => pool.includes(id) && (preserveOrder || (counts.get(id.split(':')[0]) || 0) === fewest)) : 0;
    const [id] = remaining.splice(index, 1);
    queue.push(id);
    const provider = id.split(':')[0];
    counts.set(provider, (counts.get(provider) || 0) + 1);
  }
  return queue;
}

function describe({ status, message = '' }) {
  if (status === 'timeout') return "didn't respond in time";
  if (status === 'empty') return 'returned an empty reply';
  if (status === 'blocked') return 'declined to answer';
  if (status === 'network') return "couldn't be reached";
  if (status === 'context') return 'has too little context for this request';
  if (status === 'capabilities') return 'has no verified attachment capabilities';
  if (status === 429 || /quota|rate.?limit|exhausted/i.test(message)) return 'hit its usage limit';
  if (status === 401 || status === 403) return 'was refused (check the API key)';
  if (status === 404) return 'is not available';
  if (status === 400) return "couldn't handle this request";
  if (status >= 500) return 'is overloaded or down';
  return 'failed';
}

const available = (id) => {
  const m = parseModelId(id);
  return m && hasKey(m.provider) ? m : null;
};

export async function* runChat({ model, fallbacks = [], messages, options = {} }, signal) {
  signal=providerSignal(signal);
  const observationScope=healthScope();
  const needsGemini = Boolean(options.codeExecution) || Boolean(options.requireSearch) || hasVideo(messages);
  const {image,pdf}=attachmentNeeds(messages.flatMap(m=>m.files || []));
  const candidates = [model, ...fallbacks].filter((id, i, all) => id && all.indexOf(id) === i && available(id) && (!needsGemini || toolModel(id)));
  const preferred = options.preferredModels?.length ? new Set([model, ...options.preferredModels]) : null;
  const searchCapable = options.search ? id => Boolean((modelCapabilities(id) || options.modelCapabilities?.[id])?.search) : undefined;
  const blockedModels = new Set(options.blockedModels || []);
  const blocked = id => blockedModels.has(id);
  const officeFiles = [...new Set(messages.flatMap((m) => (m.files || []).map((f) => f.name)).filter((n) => /\.(docx|xlsx|xlsm)$/i.test(n || '')))];
  const instructions = buildInstructions({ custom: options.customInstructions || '', memory: options.memory || '', workspace: options.workspace || '', officeFiles });
  const tokens = requestTokens(messages, instructions);
  const cost=options.routingPreference==='cost'?id=>estimatedCost(modelCapabilities(id)||options.modelCapabilities?.[id],tokens):undefined;
  const queue = attemptQueue(candidates, { searchCapable, blocked, cost, preserveOrder:options.preserveOrder===true,preferred: preferred ? id => preferred.has(id) : undefined, keepFirst: candidates[0] === model });
  if (queue.length === 0) {
    yield { t: 'error', text: needsGemini ? 'This tool request requires an enabled Gemini model and a Google API key. Check Settings → Models and API keys.' : `No API key for ${model}. Add your keys in Settings → API keys.` };
    if(signal.aborted)return;
    yield { t: 'done' };
    return;
  }
  const failures = [];
  const label = (id) => id.split(':').slice(1).join(':');

  const deadProviders = new Set();
  const started = Date.now();
  let answered = false;
  let attempts = 0;
  const metadataInvalidated=new Set();
  const decisionFor=(failure,id,visibleOutput=false)=>{
    const classified=classifyFailure({...failure,id});
    if(classified.refreshMetadata && !metadataInvalidated.has(classified.provider)) {metadataInvalidated.add(classified.provider);invalidateModelMetadata(id);}
    return recoveryDecision(classified,{
      remainingAttempts:MAX_ATTEMPTS-attempts,remainingMs:(answered?timeouts.totalMs:timeouts.noAnswerMs)-(Date.now()-started),
      canFallback:queue.slice(queue.indexOf(id)+1).some(next=>!deadProviders.has(next.split(':')[0])),visibleOutput,
    });
  };

  for (const id of queue) {
    if (signal.aborted) return;
    const target = available(id);
    if (!target) continue;
    const metadata = modelCapabilities(id) || options.modelCapabilities?.[id];
    const effective=metadata || (options.modelContexts?.[id]!==undefined?{context:options.modelContexts[id]}:undefined);
    const problem=modelProblem(effective,{image,pdf,tokens,outputTokens:options.maxTokens,unavailable:isModelRegistered(id)===false}) || (options.modelRequirements?modelRequirementsProblem(effective,options.modelRequirements):null);
    if (problem) {
      const context=/context|too small/.test(problem);
      failures.push({ id, status: context?'context':metadata?400:'capabilities', message:problem });
      continue;
    }
    // A rejected key fails every model that uses it, so don't try them one by one.
    if (deadProviders.has(target.provider)) continue;
    if (attempts++ >= MAX_ATTEMPTS || Date.now() - started >= (answered ? timeouts.totalMs : timeouts.noAnswerMs)) break;
    yield { t: 'attempt', id, number: attempts };
    if (signal.aborted) return;
    const attemptStarted = Date.now();
    let firstAnswerMs = null;
    // Speed mode is explicitly limited to Auto's simple short-context questions.
    const quick = options.quickReply === true && !needsGemini && !options.thinkingModels?.includes(id);
    const learned = quick ? replyLatency(id) : null;
    const startWait = quick ? Math.min(timeouts.firstResponseMs, Math.max(timeouts.quickResponseMs, learned === null ? 0 : learned * 3 + 1500)) : timeouts.firstResponseMs;

    // Each attempt gets its own cancel switch, so a stuck model can be abandoned without stopping the reply.
    const attempt = new AbortController();
    const stopAttempt = () => attempt.abort();
    signal.addEventListener('abort', stopAttempt, { once: true });
    let timedOut = false;
    let completed = false;
    let timer = setTimeout(() => {
      timedOut = true;
      attempt.abort();
    }, startWait);
    let answerTimer = setTimeout(() => { timedOut = true; attempt.abort(); }, quick ? Math.min(timeouts.firstAnswerMs, Math.max(timeouts.quickAnswerMs, startWait)) : timeouts.firstAnswerMs);
    let deadline = setTimeout(() => { timedOut = true; attempt.abort(); }, Math.max(1, (answered ? timeouts.totalMs : timeouts.noAnswerMs) - (Date.now() - started)));
    const setTotalDeadline = () => {
      if(completed)return;
      deadline = setTimeout(() => { timedOut = true; attempt.abort(); }, Math.max(1, timeouts.totalMs - (Date.now() - started)));
    };
    const keepAlive = () => {
      clearTimeout(timer);
      if(completed)return;
      timer = setTimeout(() => {
        timedOut = true;
        attempt.abort();
      }, timeouts.idleMs);
    };
    const cleanup = () => {
      clearTimeout(timer);
      clearTimeout(answerTimer);
      clearTimeout(deadline);
      signal.removeEventListener('abort', stopAttempt);
      attempt.abort(); // closes the connection if we gave up on this model
    };

    let iterator;
    try {
      let opened;
      try {
        opened = await waitFor(openStream(target, messages, { instructions, metadata, quickReply: quick,maxTokens:options.maxTokens, search: Boolean(options.search), requireSearch: Boolean(options.requireSearch), codeExecution: Boolean(options.codeExecution), signal: attempt.signal,
          onComplete:()=>{completed=true;clearTimeout(timer);clearTimeout(answerTimer);clearTimeout(deadline);},
        }), attempt.signal);
      } catch (e) {
        opened = { ok: false, status: timedOut ? 'timeout' : e.status || 'network', message: timedOut ? '' : e.message,error:timedOut?undefined:e };
      }
      if (signal.aborted) {
        cleanup();
        return;
      }
      if (!opened.ok) {
        cleanup();
        failures.push({ id, status: opened.status, message: opened.message });
        const decision=decisionFor(opened,id);
        if(decision.penalizeHealth)noteFailure(id, opened.status, opened.message,observationScope);
        if (isUnavailableFailure(opened.status, opened.message)) yield { t: 'unavailable', id, reason: String(opened.message || '').slice(0, 140) };
        if(decision.skipProvider)deadProviders.add(target.provider);
        if (opened.limit) yield { t: 'limit', id, ...opened.limit };
        if(decision.action==='stop')break;
        continue;
      }
      yield { t: 'request', id };

      // Announce the model only once it actually starts answering.
      let announced = false;
      const announce = function* () {
        if (announced) return;
        announced = true;
        if (failures.length) {
          const why = failures.map((f) => `${label(f.id)} ${describe(f)}`).join('; ');
          yield { t: 'notice', text: `${why} — switched to ${label(id)}.` };
        }
        yield { t: 'model', id };
        if (options.search && !opened.searchEnabled) {
          yield { t: 'notice', text: 'This model does not support web search, so this answer did not search the web.' };
        }
      };

      // Until real answer text arrives, notices and sources are held back: if the model ends up
      // blocked or empty, we move on to the next one without showing them.
      let wrote = false;
      let thought = false;
      const held = [];
      let failedEarly = null;
      let failedLate = false;
      iterator = opened.events[Symbol.asyncIterator]();
      try {
        for (;;) {
          const next = await waitFor(iterator.next(), attempt.signal);
          if (next.done) break;
          const ev = next.value;
          // Metadata must not extend the wait for a real response indefinitely.
          if ((ev.t === 'text' || ev.t === 'think') && ev.text?.trim()) keepAlive();
          if (ev.t === 'error' && !wrote) {
            failedEarly = { id, status: ev.status, message: ev.text,code:ev.code,limit:ev.limit };
            if (ev.limit) yield { t: 'limit', id, ...ev.limit };
            break;
          }
          if (ev.t === 'error') { failedLate = true; if(decisionFor({...ev,message:ev.text},id,true).penalizeHealth)noteFailure(id, ev.status || 500, ev.text,observationScope); }
          if (ev.t === 'usage') {
            yield { ...ev, id };
            continue;
          }
          if (!wrote && (ev.t === 'notice' || ev.t === 'sources')) {
            held.push(ev);
            continue;
          }
          if (!wrote && ev.t === 'text' && !ev.text?.trim()) {
            held.push(ev); // retain leading whitespace, but don't treat it as a useful answer
            continue;
          }
          yield* announce();
          if(signal.aborted)return;
          if (ev.t === 'think') thought = true;
          if (ev.t === 'text') {
            if (!wrote) {
              wrote = true;
              firstAnswerMs = Date.now() - attemptStarted;
              answered = true;
              clearTimeout(answerTimer);
              // A useful answer can stream longer, but still has a hard overall deadline.
              clearTimeout(deadline);
              setTotalDeadline();
              for(const item of held.splice(0)) {if(signal.aborted)return;yield item;}
            }
          }
          if(signal.aborted)return;
          yield ev;
        }
      } catch (e) {
        if (signal.aborted) {
          cleanup();
          return;
        }
        if (!wrote) failedEarly = { id, status: timedOut ? 'timeout' : e.status || 'network', message: timedOut ? '' : e.message,error:timedOut?undefined:e };
        else {
          failedLate = true;
          noteFailure(id, timedOut ? 'timeout' : 'network','',observationScope);
          yield { t: 'error', text: timedOut ? 'The model stopped responding partway through. Tap Try again or Retry with another model.' : `Connection to the model dropped: ${e.message}` };
        }
      }
      cleanup();
      if (!failedEarly && !wrote) {
        const blocked = held.find((h) => h.t === 'notice' && /blocked|stopped the reply/i.test(h.text));
        failedEarly = { id, status: blocked ? 'blocked' : 'empty', message: blocked ? blocked.text : '' };
      }
      if (failedEarly) {
        failures.push(failedEarly);
        const decision=decisionFor(failedEarly,id);
        if(decision.penalizeHealth)noteFailure(id, failedEarly.status, failedEarly.message,observationScope);
        if (isUnavailableFailure(failedEarly.status, failedEarly.message)) yield { t: 'unavailable', id, reason: String(failedEarly.message || '').slice(0, 140) };
        // Throw away the failed model's partial thinking before the next model starts.
        if (thought) yield { t: 'discard' };
        if(decision.skipProvider)deadProviders.add(target.provider);
        if(decision.action==='stop')break;
        continue;
      }
      if (!failedLate) {
        noteSuccess(id,observationScope);
        // Reasoning-capable models still provide useful speed observations on a
        // simple Auto question, even when we retain their longer startup budget.
        if (options.quickReply === true && !needsGemini && firstAnswerMs !== null) noteReplyLatency(id, firstAnswerMs,observationScope);
      }
      if(signal.aborted)return;
      yield { t: 'done' };
      return;
    } finally {
      cleanup();
      void iterator?.return?.().catch(()=>{});
    }
  }

  if (!signal.aborted) {
    const detail = failures.map((f) => `• ${label(f.id)}: ${describe(f)}${f.message ? ` (${f.message})` : ''}`).join('\n');
    yield { t: 'error', text: `No model could answer.\n${detail}` };
    yield { t: 'done' };
  }
}

/**
 * Short chat title from the first message, using a light model so it barely touches limits. Returns { title, model }.
 * @param {string} text
 * @param {string | undefined} model
 * @param {(id: string) => boolean} [skip] models to avoid (e.g. ones at their limit)
 */
export async function makeTitle(text, model, skip = () => false,models=model?[model]:[]) {
  if (!text.trim()) return null;
  const generation = keyVersion();
  const candidates=[...new Set(models)].filter(id=>available(id)&&isModelRegistered(id)!==false).slice(0,3);
  const prompt = `Write a short title (2 to 6 words) for a chat that starts with the message below. Use the same language as the message. Reply with the title only, no quotes or punctuation at the end.\n\nMessage:\n${text.slice(0, 2000)}`;
  const result=await summarize(prompt,candidates,{skip:id=>skip(id)||isCoolingDown(id),signal:AbortSignal.timeout(10_000),minLength:1,maxTokens:256});
  if(keyVersion()!==generation || !result)return null;
  const title=result.text.split('\n').find(line=>line.trim())?.replace(/^["'#*\s]+|["'*.\s]+$/g,'').slice(0,80);
  return title?{title,model:result.model}:null;
}

// Writes a summary of a long chat with the first model that manages it. `report(id, info)` hears about
// every attempt ({ status?, input?, output?, limit? }) so usage can be counted and limits remembered.
export async function summarize(prompt, candidates, { skip = (_id) => Boolean(false), report = (_id, _info) => {}, signal = /** @type {AbortSignal | undefined} */ (undefined), minLength = 41, maxTokens = 8192,modelRequirements } = {}) {
  try { signal=providerSignal(signal); } catch { return null; }
  const tried = [];
  const started = Date.now();
  const deadProviders=new Set();
  const tokens=requestTokens([{role:'user',text:prompt}]);
  const decisionFor=(failure,id)=>{
    const classified=classifyFailure({...failure,id});
    if(classified.refreshMetadata)invalidateModelMetadata(id);
    return recoveryDecision(classified,{remainingAttempts:4-tried.length,remainingMs:timeouts.summaryTotalMs-(Date.now()-started),canFallback:candidates.some(next=>next!==id&&!tried.includes(next)&&!deadProviders.has(next.split(':')[0]))});
  };
  for (const id of candidates) {
    const m = available(id);
    const metadata=modelCapabilities(id);
    if (!m || isModelRegistered(id)===false || modelProblem(metadata,{tokens,streaming:false,outputTokens:metadata?maxTokens:undefined}) || (modelRequirements && modelRequirementsProblem(metadata,modelRequirements)) || deadProviders.has(m.provider) || skip(id) || tried.includes(id)) continue;
    tried.push(id);
    const remaining = timeouts.summaryTotalMs - (Date.now() - started);
    if (signal?.aborted || remaining <= 0) break;
    const info = {};
    const attempt = new AbortController();
    const timer = setTimeout(() => attempt.abort(), Math.min(timeouts.summaryAttemptMs, remaining));
    const combined = signal ? AbortSignal.any([signal, attempt.signal]) : attempt.signal;
    try {
      const out = await waitFor(complete(m, prompt, { maxTokens, signal: combined, info }), combined);
      if(signal.aborted)break;
      report(id, info);
      if(info.status>=400 || info.status==='output-limit') {
        const decision=decisionFor(info,id);
        if(decision.skipProvider)deadProviders.add(m.provider);
        if(decision.action==='stop')break;
      }
      const text = (out || '').trim();
      if (text.length >= minLength) return { text, model: id };
    } catch(error) {
      if(signal.aborted) break;
      report(id, info);
      const decision=decisionFor({...info,status:attempt.signal.aborted?'timeout':info.status,error:attempt.signal.aborted?undefined:error},id);
      if(decision.skipProvider)deadProviders.add(m.provider);
      if(decision.action==='stop')break;
      // Try the next model.
    } finally {
      clearTimeout(timer);
      attempt.abort();
    }
    if (tried.length >= 4) break;
  }
  return null;
}
