import {AccountScope} from './scope.ts';
import {AuthFlow,SessionLifetime} from './auth.ts';
export const accountScope=new AccountScope();
export const authFlow=new AuthFlow();
let expired:()=>void=()=>{};
export const sessionLifetime=new SessionLifetime(accountScope,()=>expired());
export function onSessionExpired(callback:()=>void){expired=callback;}
