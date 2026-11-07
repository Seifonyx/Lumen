import type {NativeCredential} from './real-session';
import {NativeAuthError} from './auth-errors.ts';

/** Local nonce/audience check only. Firebase's Google credential exchange MUST
 * verify the signed ID token with Google; parsing a JWT here never authenticates a user. */
export async function verifyNativeGoogleToken(credential:NativeCredential,webClientId:string):Promise<string>{
 const token=credential.idToken,nonce=credential.rawNonce;
 if(credential.signedIn!==true||typeof token!=='string'||token.length>16384||
    typeof nonce!=='string'||!/^[A-Fa-f0-9-]{72}$/.test(nonce)||
    !/^\d+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(webClientId)){
  throw new NativeAuthError('AUTH_TOKEN');
 }
 let claims:Record<string,unknown>;
 try{
  const parts=token.split('.');
  if(parts.length!==3||parts.some(x=>!x||!/^[A-Za-z0-9_-]+$/.test(x)))throw Error();
  const payload=parts[1].replace(/-/g,'+').replace(/_/g,'/');
  claims=JSON.parse(atob(payload.padEnd(Math.ceil(payload.length/4)*4,'='))) as Record<string,unknown>;
  if(!claims||typeof claims!=='object'||Array.isArray(claims))throw Error();
 }catch{throw new NativeAuthError('AUTH_TOKEN');}
 const now=Math.floor(Date.now()/1000);
 if(!['https://accounts.google.com','accounts.google.com'].includes(String(claims.iss||''))||
    claims.aud!==webClientId){
  throw new NativeAuthError('AUTH_TOKEN_CLIENT');
 }
 if(typeof claims.exp!=='number'||claims.exp<=now||typeof claims.iat!=='number'||claims.iat>now+300)throw new NativeAuthError('AUTH_TOKEN_EXPIRED');
 if(!globalThis.crypto?.subtle)throw new NativeAuthError('AUTH_TOKEN');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(nonce));
 const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 if(claims.nonce!==hash)throw new NativeAuthError('AUTH_NONCE');
 return token;
}
