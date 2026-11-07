// Public, fixed demonstration data. No model, embeddings or source analysis runs here.
export const DEMO_MODELS = [
 {name:'models/gemini-flash-latest',displayName:'Local demo reply'},
 {name:'models/gemini-2.5-pro',displayName:'Local demo alternative'},
].map(model=>({...model,inputTokenLimit:128000,outputTokenLimit:8192,supportedGenerationMethods:['generateContent']}));
const SAMPLE_STUDY={
 title:'Offline demo: sample cards',
 cards:[
  {q:'Is this deck derived from your source?',a:'No. These are fixed sample cards, not an analysis of your source.'},
  {q:'Does this demo contact an AI provider?',a:'No. Replies and these sample cards are created locally.'},
  {q:'Are Demo A and Demo B real accounts?',a:'No. They are separate local synthetic profiles.'},
 ],
 quiz:[
  {q:'What created this deck?',options:['A fixed local template','A live AI request'],answer:0,why:'This is explicitly synthetic demonstration content.'},
  {q:'Does this prove real sign-in works?',options:['Yes','No'],answer:1,why:'Real Google/Firebase integration remains disabled.'},
 ],
};
export function replyText(body: string): string {
 try {
  const request=JSON.parse(body);
  const text=(request.contents||[]).flatMap((c:{parts?:{text?:string}[]})=>(c.parts||[]).map(p=>p.text||'')).join('\n');
  if(text.includes('Make study material from the material below')) return JSON.stringify(SAMPLE_STUDY);
 } catch { /* The ordinary fixed reply still makes no factual claim about the input. */ }
 return '**Offline demonstration.** This reply was created locally from a fixed template. No model or account service was contacted. You can test navigation, drafts, files and projects here.';
}
/** Real incremental local SSE, so the canonical streaming and Stop paths can be exercised. */
export function replyStream(text: string,signal?: AbortSignal|null,interval=80): ReadableStream<Uint8Array> {
 let timer:ReturnType<typeof setTimeout>|undefined,stopped=false;
 const encoder=new TextEncoder();let offset=0;
 let abort:()=>void=()=>{};
 const cleanup=()=>{stopped=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);};
 return new ReadableStream({
  start(controller) {
   abort=()=>{if(stopped)return;cleanup();controller.error(new DOMException('Stopped','AbortError'));};
   if(signal?.aborted){abort();return;}
   signal?.addEventListener('abort',abort,{once:true});
   const send=()=>{
    if(stopped)return;
    if(offset>=text.length){
     controller.enqueue(encoder.encode('data: '+JSON.stringify({candidates:[{finishReason:'STOP'}]})+'\n\n'));
     cleanup();controller.close();return;
    }
    const part=text.slice(offset,offset+16);offset+=16;
    controller.enqueue(encoder.encode('data: '+JSON.stringify({candidates:[{content:{role:'model',parts:[{text:part}]}}]})+'\n\n'));
    timer=setTimeout(send,interval);
   };
   timer=setTimeout(send,interval);
  },
  cancel(){cleanup();},
 });
}
