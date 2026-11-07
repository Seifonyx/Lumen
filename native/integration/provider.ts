import {DEMO_MODELS,replyStream,replyText} from '../demo/synthetic.ts';
import type {AccountScope,Lease} from './scope.ts';
/** Future provider adapter must obtain a scoped opaque native credential reference, never persist raw keys. */
export interface ProviderCredentialPort {reference(owner:string,provider:string,lease:Lease):Promise<string>}
export class SyntheticProvider {
 available=true;private scope:AccountScope;private pending=0;
 constructor(scope:AccountScope){this.scope=scope;}
 get inFlight(){return this.pending;}
 async request(path:string,body:string,external?:AbortSignal|null):Promise<Response>{
  const lease=this.scope.request(external);let streaming=false;this.pending++;
  let released=false;const release=()=>{if(released)return;released=true;lease.dispose();this.pending--;};
  try {
   lease.signal.throwIfAborted();
   if(!this.available)return Response.json({error:{message:'Synthetic provider unavailable. Try again.',code:503}},{status:503});
   if(path.endsWith('/models'))return Response.json({models:DEMO_MODELS});
   if(path.endsWith(':streamGenerateContent')){
    streaming=true;return new Response(replyStream(replyText(body),lease.signal,80,release),{headers:{'content-type':'text/event-stream'}});
   }
   if(path.endsWith(':generateContent'))return Response.json({candidates:[{content:{parts:[{text:replyText(body)}]},finishReason:'STOP'}]});
   throw new Error('This service is unavailable in the offline demonstration.');
  }finally{if(!streaming)release();}
 }
}
