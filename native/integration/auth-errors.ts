// Only fixed classifications cross the UI boundary. Never retain remote messages, causes or userInfo.
const messages = {
 AUTH_SIGNING: 'This signed app does not match its Google configuration. Keep the existing app installed and use a build configured for the same Sideloadly bundle ID.',
 AUTH_CONFIG: 'This build has incomplete sign-in configuration. Install the corrected Lumen build over this app.',
 AUTH_CALLBACK_CONFIG: 'The Google return link is missing from this build. Install the corrected Lumen build over this app.',
 AUTH_ORIGIN: 'Sign-in cannot start from this page. Close and reopen Lumen.',
 AUTH_BRIDGE: 'Native Google sign-in is unavailable in this build. Open the installed Lumen app.',
 AUTH_PRESENTATION: 'Google sign-in could not open. Close any system sign-in sheet and try again.',
 AUTH_BUSY: 'Another sign-in is finishing. Close the Google sheet, then try again.',
 AUTH_CANCELED: 'Sign-in canceled. Tap Sign in with Google when ready.',
 AUTH_STORAGE: 'Secure sign-in storage is unavailable. Unlock the iPhone and try again. If it persists, keep the app installed and check its signing configuration.',
 AUTH_GOOGLE_NETWORK: 'Google could not be reached. Check your connection and try again.',
 AUTH_GOOGLE_POLICY: 'Google sign-in was blocked by an account or device policy. Use an authorized Lumen account.',
 AUTH_GOOGLE: 'Google did not return a usable sign-in. Close the Google sheet and try again.',
 AUTH_TOKEN: 'Google returned an invalid sign-in credential. Try a fresh sign-in.',
 AUTH_TOKEN_CLIENT: 'Google returned a credential for a different client. This build needs its sign-in configuration corrected.',
 AUTH_TOKEN_EXPIRED: 'The Google sign-in expired. Check the iPhone date and time, then try again.',
 AUTH_NONCE: 'The sign-in security check failed. Close Google sign-in and try a fresh sign-in.',
 AUTH_FIREBASE_NETWORK: 'Google completed, but Lumen could not connect to account sign-in. Check your connection and retry.',
 AUTH_FIREBASE_CREDENTIAL: 'The sign-in service rejected the Google credential. Try a fresh sign-in.',
 AUTH_ACCOUNT_DISABLED: 'This account is disabled. Use an authorized Lumen account.',
 AUTH_FIREBASE_CONFIG: 'The sign-in service is not configured for this build. Install the corrected Lumen build.',
 AUTH_FIREBASE: 'Google completed, but account sign-in failed. Try again.',
 AUTH_SESSION: 'The previous sign-in could not be cleared safely. Close and reopen Lumen.',
 AUTH_UNKNOWN: 'Sign-in could not finish. Close and reopen Lumen, then try again.'
} as const;
export type AuthCode = keyof typeof messages;
export class NativeAuthError extends Error {
 readonly code:AuthCode;
 constructor(code:AuthCode){super(messages[code]);this.name='NativeAuthError';this.code=code;}
}
function codeOf(error:unknown):string {
 if(error&&typeof error==='object'&&'code' in error&&typeof error.code==='string')return error.code;
 return error instanceof DOMException&&error.name==='AbortError'?'AUTH_CANCELED':'';
}
const firebaseCodes:Record<string,AuthCode>={
 'auth/network-request-failed':'AUTH_FIREBASE_NETWORK',
 'auth/missing-or-invalid-nonce':'AUTH_NONCE',
 'auth/invalid-credential':'AUTH_FIREBASE_CREDENTIAL','auth/invalid-idp-response':'AUTH_FIREBASE_CREDENTIAL',
 'auth/user-disabled':'AUTH_ACCOUNT_DISABLED',
 'auth/operation-not-allowed':'AUTH_FIREBASE_CONFIG','auth/invalid-api-key':'AUTH_FIREBASE_CONFIG','auth/app-not-authorized':'AUTH_FIREBASE_CONFIG'
};
export function authFailure(stage:'google'|'firebase'|'session',error:unknown):NativeAuthError {
 const code=codeOf(error);
 if(Object.hasOwn(messages,code))return new NativeAuthError(code as AuthCode);
 if(stage==='firebase'&&Object.hasOwn(firebaseCodes,code))return new NativeAuthError(firebaseCodes[code]);
 if(stage==='google'&&['UNIMPLEMENTED','UNAVAILABLE'].includes(code))return new NativeAuthError('AUTH_BRIDGE');
 return new NativeAuthError(stage==='google'?'AUTH_GOOGLE':stage==='firebase'?'AUTH_FIREBASE':'AUTH_SESSION');
}
export function signInProblem(error:unknown):{code:AuthCode;message:string}{
 const raw=codeOf(error),code=Object.hasOwn(messages,raw)?raw as AuthCode:'AUTH_UNKNOWN';
 return {code,message:messages[code]};
}
