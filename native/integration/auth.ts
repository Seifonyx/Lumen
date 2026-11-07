import type {AccountScope} from './scope.ts';
export interface AuthRequest {attemptId:string;state:string;callback:string;signal:AbortSignal}
export interface AuthCompletion {uid:string;attemptId:string;state:string;callback:string;expiresAt:number|null}
/** A future system-browser/SDK adapter must verify its own OAuth/PKCE/nonce before returning this envelope. */
export interface SystemBrowserAuthPort {open(request:AuthRequest):Promise<AuthCompletion>}
/** Never serialize credential material into web storage. This port holds opaque native references only. */
export interface CredentialReference {owner:string;reference:string}
export interface SecureSessionVault {
 readonly facility:'native-keychain';
 read(owner:string):Promise<CredentialReference|null>;
 forget(owner:string):Promise<void>;
}
const nonce=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
const aborted=()=>new DOMException('Sign-in canceled or superseded','AbortError');
export class AuthFlow {
 private attempt:(AuthRequest&{deadline:number;consumed:boolean})|null=null;
 private cancelPending:(()=>void)|null=null;
 cancel(){this.cancelPending?.();this.cancelPending=null;this.attempt=null;}
 acceptCallback(raw:string):boolean {
  const q=this.attempt;if(!q||q.consumed||q.signal.aborted||Date.now()>=q.deadline)return false;
  try {
   const url=new URL(raw),target=new URL(q.callback);
   if(url.protocol!==target.protocol||url.host!==target.host||url.pathname!==target.pathname||url.hash||url.username||url.password)return false;
   if(url.searchParams.getAll('state').length!==1||url.searchParams.get('state')!==q.state)return false;
   q.consumed=true;return true;
  }catch{return false;}
 }
 async authorize(port:SystemBrowserAuthPort):Promise<AuthCompletion>{
  this.cancel();const controller=new AbortController();
  // Deliberately unregistered. No OS URL handler or actual OAuth endpoint is enabled.
  const q={attemptId:nonce(),state:nonce(),callback:'lumen-demo-auth://callback/complete',signal:controller.signal,deadline:Date.now()+120000,consumed:false};
  this.attempt=q;this.cancelPending=()=>controller.abort(aborted());
  let rejectAbort:(()=>void)|undefined;
  const canceled=new Promise<never>((_,reject)=>{rejectAbort=()=>reject(aborted());q.signal.addEventListener('abort',rejectAbort,{once:true});});
  const timer=setTimeout(()=>controller.abort(aborted()),120000);
  try {
   const result=await Promise.race([port.open(q),canceled]);
   if(this.attempt!==q||q.signal.aborted)throw aborted();
   if(Date.now()>=q.deadline||typeof result.uid!=='string'||!result.uid.trim()||result.uid.length>128||result.state!==q.state||result.attemptId!==q.attemptId||result.callback!==q.callback||(result.expiresAt!==null&&(!Number.isFinite(result.expiresAt)||result.expiresAt<=Date.now())))throw new Error('Invalid or expired authentication completion');
   return {uid:result.uid,attemptId:result.attemptId,state:result.state,callback:result.callback,expiresAt:result.expiresAt};
  }finally{
   clearTimeout(timer);if(rejectAbort)q.signal.removeEventListener('abort',rejectAbort);
   if(this.attempt===q){this.attempt=null;this.cancelPending=null;}
  }
 }
}
export class SyntheticAuthPort implements SystemBrowserAuthPort {
 private uid:string;
 constructor(uid:string){if(!/^preview-native-demo-[ab]$/.test(uid))throw Error('Only local demo profiles are supported');this.uid=uid;}
 async open(q:AuthRequest):Promise<AuthCompletion>{
  q.signal.throwIfAborted();await Promise.resolve();q.signal.throwIfAborted();
  return {uid:this.uid,attemptId:q.attemptId,state:q.state,callback:q.callback,expiresAt:null};
 }
}
export class SessionLifetime {
 private scope:AccountScope;private onExpired:()=>void;private now:()=>number;
 private expiresAt:number|null=null;private timer:ReturnType<typeof setTimeout>|undefined;
 constructor(scope:AccountScope,onExpired:()=>void,now=Date.now){this.scope=scope;this.onExpired=onExpired;this.now=now;}
 adopt(uid:string,expiresAt:number|null=null){clearTimeout(this.timer);this.expiresAt=expiresAt;this.scope.set(uid);this.check();this.arm();}
 private arm(){clearTimeout(this.timer);if(this.expiresAt!==null)this.timer=setTimeout(()=>{this.check();this.arm();},Math.max(0,Math.min(2147483647,this.expiresAt-this.now())));}
 check(){if(this.expiresAt!==null&&this.now()>=this.expiresAt){this.end();this.onExpired();}}
 end(){clearTimeout(this.timer);this.expiresAt=null;this.scope.set(null);}
}
