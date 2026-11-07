export interface Lease {uid:string;generation:number;signal:AbortSignal;valid:()=>boolean}
export class AccountScope {
 private owner:string|null=null;
 private epoch=0;
 private controller=new AbortController();
 private foreground=true;
 private listeners=new Set<()=>void>();
 get uid(){return this.owner;}
 get isForeground(){return this.foreground;}
 get active(){return this.foreground&&this.owner!==null;}
 subscribe(fn:()=>void){this.listeners.add(fn);return()=>{this.listeners.delete(fn);};}
 private rotate(){this.controller.abort(new DOMException('Account or app lifecycle changed','AbortError'));this.controller=new AbortController();this.epoch++;if(!this.foreground)this.controller.abort();for(const fn of this.listeners)fn();}
 set(uid:string|null){this.owner=uid;this.rotate();}
 pause(){if(this.foreground){this.foreground=false;this.rotate();}}
 resume(){if(!this.foreground){this.foreground=true;this.rotate();}}
 capture():Lease {
  if(!this.active)throw new DOMException('An active account is required','AbortError');
  const uid=this.owner!,generation=this.epoch,signal=this.controller.signal;
  return {uid,generation,signal,valid:()=>this.active&&this.owner===uid&&this.epoch===generation&&!signal.aborted};
 }
 request(external?:AbortSignal|null){
  const lease=this.capture(),controller=new AbortController();
  const signals=[lease.signal,...(external?[external]:[])];
  const abort=()=>controller.abort(new DOMException('Request stopped','AbortError'));
  for(const signal of signals){signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();}
  return {...lease,signal:controller.signal,valid:()=>lease.valid()&&!controller.signal.aborted,
   dispose:()=>{for(const signal of signals)signal.removeEventListener('abort',abort);}};
 }
}
