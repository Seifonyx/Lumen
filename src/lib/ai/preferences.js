export const ROUTING_PRIORITIES=['balanced','quality','speed','cost'];
/** @param {string|undefined} configured @param {{quality?:boolean,speed?:boolean,cost?:boolean}} intent */
export function choosePreference(configured,intent={}) {
  if(intent.quality) return 'quality';
  if(intent.cost) return 'cost';
  if(intent.speed) return 'speed';
  return ROUTING_PRIORITIES.includes(configured)?configured:'balanced';
}

// A comparison estimate using reported per-token prices and an explicit answer
// allowance. It is not a quote or a claim about the final billed token count.
export function estimatedCost(model,inputTokens,outputTokens=1024) {
  const price=model?.pricing;
  if(price?.unit!=='token'||price?.currency!=='USD'||![price.input,price.output,inputTokens,outputTokens].every(n=>Number.isFinite(n)&&n>=0)) return null;
  const limit=model?.outputLimit;
  const output=Number.isFinite(limit)&&limit>0?Math.min(limit,outputTokens):outputTokens;
  const value=price.input*inputTokens+price.output*output;
  return Number.isFinite(value)?value:null;
}
export function compareKnownCost(a,b) {
  if(a===null&&b===null)return 0;
  if(a===null)return 1;
  if(b===null)return -1;
  return a-b;
}
