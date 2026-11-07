import type {NativeCredential} from './real-session';

/** Local nonce/audience check only. Firebase's Google credential exchange MUST
 * verify the signed ID token with Google; parsing a JWT here never authenticates a user. */
export async function verifyNativeGoogleToken(credential:NativeCredential,webClientId:string):Promise<string>{
 const token=credential.idToken,nonce=credential.rawNonce;
 if(credential.signedIn!==true||typeof token!=='string'||token.length>16384||
    typeof nonce!=='string'||!/^[A-Fa-f0-9-]{72}$/.test(nonce)||
    !/^\d+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(webClientId)){
  throw Error('Invalid native Google credential.');
 }
 let claims:Record<string,unknown>;
 try{
  const parts=token.split('.');
  if(parts.length!==3||parts.some(x=>!x||!/^[A-Za-z0-9_-]+$/.test(x)))throw Error();
  const payload=parts[1].replace(/-/g,'+').replace(/_/g,'/');
  claims=JSON.parse(atob(payload.padEnd(Math.ceil(payload.length/4)*4,'='))) as Record<string,unknown>;
  if(!claims||typeof claims!=='object'||Array.isArray(claims))throw Error();
 }catch{throw Error('Malformed Google identity token.');}
 const now=Math.floor(Date.now()/1000);
 if(!['https://accounts.google.com','accounts.google.com'].includes(String(claims.iss||''))||
    claims.aud!==webClientId||typeof claims.exp!=='number'||claims.exp<=now||
    typeof claims.iat!=='number'||claims.iat>now+300){
  throw Error('Google identity token was not issued for this test client.');
 }
 if(!globalThis.crypto?.subtle)throw Error('Secure Google credential validation unavailable.');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(nonce));
 const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 if(claims.nonce!==hash)throw Error('Google sign-in nonce mismatch.');
 return token;
}
