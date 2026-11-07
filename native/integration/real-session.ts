import {NativeAuthError,authFailure} from './auth-errors.ts';
export interface AccountIdentity {uid:string}
export interface NativeCredential {signedIn:boolean;idToken?:string;rawNonce?:string}
export interface FirebaseSessionPort<T extends AccountIdentity>{current():T|null;watch(fn:(user:T|null)=>void):()=>void;signIn(c:NativeCredential):Promise<T>;signOut():Promise<void>}
export interface GoogleSessionPort {credential(restore:boolean):Promise<NativeCredential>;signOut():Promise<void>;cancel():Promise<void>}
/** Firebase is the sole account owner. Native Google supplies credentials, never an alternative account identity. */
export class RealSession<T extends AccountIdentity> {
 private firebase:FirebaseSessionPort<T>;private native:GoogleSessionPort;
 private generation=0;private pending=false;private blocked=true;private delivered:T|null=null;
 private restoring:Promise<void>|null=null;
 private listeners=new Set<(user:T|null)=>void>();private off:(()=>void)|null=null;
 constructor(firebase:FirebaseSessionPort<T>,native:GoogleSessionPort){this.firebase=firebase;this.native=native;}
 private publish(user:T|null){if(user===this.delivered)return;this.delivered=user;for(const fn of this.listeners)fn(user);}
 watch(fn:(user:T|null)=>void){this.listeners.add(fn);fn(this.delivered);
  if(!this.off)this.off=this.firebase.watch(user=>{
   if(!user){if(!this.pending&&this.delivered){this.blocked=true;void this.native.signOut().catch(()=>{});}this.publish(null);return;}
   if(!this.pending&&!this.blocked)this.publish(user);
  });
  return()=>{this.listeners.delete(fn);if(!this.listeners.size){this.off?.();this.off=null;}};
 }
 restore(){
  if(!this.restoring)this.restoring=this.signIn(true).finally(()=>{this.restoring=null;});
  return this.restoring;
 }
 async signIn(restore=false){
  const queuedGeneration=this.generation;
  if(!restore&&this.restoring){
   await this.restoring.catch(()=>{});
   if(queuedGeneration!==this.generation)throw new DOMException('Sign-in canceled','AbortError');
   if(this.delivered&&!this.blocked)return;
  }
  if(this.pending)throw new NativeAuthError('AUTH_BUSY');
  this.pending=true;this.blocked=true;this.publish(null);const generation=++this.generation;
  const current=()=>{if(generation!==this.generation)throw new DOMException('Sign-in canceled','AbortError');};
  try{
   try{await this.firebase.signOut();}catch(error){throw authFailure('session',error);}current();
   const credential=await this.native.credential(restore);current();
   if(!credential.signedIn){if(restore)return;throw new NativeAuthError('AUTH_GOOGLE');}
   if(typeof credential.idToken!=='string'||!credential.idToken)throw new NativeAuthError('AUTH_TOKEN');
   const user=await this.firebase.signIn(credential);current();
   if(!user.uid||user.uid.startsWith('preview-'))throw new NativeAuthError('AUTH_TOKEN');
   this.blocked=false;this.publish(user);
  }catch(error){
   this.blocked=true;await this.firebase.signOut().catch(()=>{});await this.native.signOut().catch(()=>{});this.publish(null);throw error;
  }finally{this.pending=false;}
 }
 async signOut(){
  this.generation++;this.blocked=true;this.publish(null);
  // Clear Canvas immediately even if a native system sheet is still being dismissed.
  await Promise.all([this.firebase.signOut(),this.native.signOut()]);
 }
 async cancel(){this.generation++;this.blocked=true;this.publish(null);await this.firebase.signOut();await this.native.cancel();}
}
