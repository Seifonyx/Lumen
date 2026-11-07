const assetFetch = globalThis.fetch.bind(globalThis);
const models = [
  {name:'models/gemini-flash-latest',displayName:'Local demo reply',inputTokenLimit:128000,outputTokenLimit:8192,supportedGenerationMethods:['generateContent']}
];
export const blocked: string[] = [];
export const demoFetch: typeof fetch = async (input,init) => {
  const raw = input instanceof Request ? input.url : String(input);
  const url = new URL(raw,document.baseURI);
  if(url.hostname==='generativelanguage.googleapis.com') {
    if(url.pathname.endsWith('/models')) return Response.json({models});
    if(/:streamGenerateContent$/.test(url.pathname)) {
      if(init?.signal?.aborted) throw new DOMException('Stopped','AbortError');
      const event={candidates:[{content:{role:'model',parts:[{text:'**Offline demonstration.** This reply was created locally from a fixed template. No model or account service was contacted. You can test navigation, drafts, files and projects here.'}]},finishReason:'STOP'}]};
      return new Response('data: '+JSON.stringify(event)+'\n\n',{headers:{'content-type':'text/event-stream'}});
    }
    if(/:generateContent$/.test(url.pathname)) return Response.json({candidates:[{content:{parts:[{text:'Offline demonstration reply.'}]},finishReason:'STOP'}]});
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
