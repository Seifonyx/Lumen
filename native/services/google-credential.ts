import {OAuthProvider} from 'firebase/auth';
import {verifyNativeGoogleToken} from '../integration/google-token.ts';
import type {NativeCredential} from '../integration/real-session.ts';
export async function nativeFirebaseCredential(input:NativeCredential,client:string){
 const idToken=await verifyNativeGoogleToken(input,client);
 return new OAuthProvider('google.com').credential({idToken,rawNonce:input.rawNonce});
}
