import {DEMO_MODELS,replyText,replyStream} from './synthetic';
const assetFetch = globalThis.fetch.bind(globalThis);
export const blocked: string[] = [];
export const demoFetch: typeof fetch = async (input,init) => {
  const raw = input instanceof Request ? input.url : String(input);
  const url = new URL(raw,document.baseURI);
  const signal=init?.signal || (input instanceof Request ? input.signal : undefined);
  if(signal?.aborted) throw new DOMException('Stopped','AbortError');
  if(url.protocol==='https:' && url.hostname==='generativelanguage.googleapis.com') {
    if(url.pathname.endsWith('/models')) return Response.json({models:DEMO_MODELS});
    const body=typeof init?.body==='string' ? init.body : '';
    if(/:streamGenerateContent$/.test(url.pathname)) return new Response(replyStream(replyText(body),signal),{headers:{'content-type':'text/event-stream'}});
    if(/:generateContent$/.test(url.pathname)) return Response.json({candidates:[{content:{parts:[{text:replyText(body)}]},finishReason:'STOP'}]});
  }
  const local = url.protocol===location.protocol && url.host===location.host;
  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if((local || ['blob:','data:'].includes(url.protocol)) && method==='GET') return assetFetch(input,init);
  blocked.push(url.hostname);
  throw new Error('Unavailable in the offline native demo. No request was sent.');
};
globalThis.fetch = demoFetch;
window.open = () => null;
document.addEventListener('click', event => {
  const link = (event.target as Element)?.closest<HTMLAnchorElement>('a[href]');
  if(!link) return;
  const url = new URL(link.href,document.baseURI);
  if(!['blob:','data:'].includes(url.protocol) && (url.host!==location.host || url.protocol!==location.protocol)) event.preventDefault();
},true);
