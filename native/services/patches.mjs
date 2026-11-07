function between(code,start,end,replacement){const a=code.indexOf(start),b=code.indexOf(end,a+start.length);if(a<0||b<0)throw Error('Unknown canonical Firebase boundary: '+start);return code.slice(0,a)+replacement+'\n\n'+code.slice(b);}
/** Checked build-only adaptation of canonical account persistence; production source remains untouched. */
export function patchFirebase(code){
 code=code.replace('GoogleAuthProvider, browserLocalPersistence,','GoogleAuthProvider, inMemoryPersistence, initializeAuth,');
 code=code.replace("import config from '../firebase-config.json';", "import config from 'lumen:test-config';\nimport {watchNativeUser,signInNative,signOutNative,readNativeAccount,writeNativeAccount,clearNativeAccount} from 'lumen:native-account';");
 code=between(code,'const SAME_SITE_AUTH_HOSTS:', 'export interface PreviewUser',`const app = initializeApp(config);
export const auth = initializeAuth(app, {persistence: inMemoryPersistence});
export const db = initializeFirestore(app, {ignoreUndefinedProperties: true});`);
 code=between(code,'export function getStoredPreviewUser()', 'let accountSession=', 'export function getStoredPreviewUser(): PreviewUser | null { return null; }');
 code=between(code,'export function signInPreview(', 'export function watchUser(', "export function signInPreview(_email?:string,_name?:string): PreviewUser {throw Error('Demo profiles are only available in the offline demo build.');}");
 code=between(code,'export function watchUser(', "let redirectError =", `export function watchUser(cb: (user: User | PreviewUser | null)=>void) {
 return watchNativeUser(auth,user=>{accountSession++;accountRead=null;cb(user);});
}`);
 code=between(code,'export async function signInWithGoogle()', 'export interface ApiKeys', `export async function signInWithGoogle(){await signInNative(auth);}
export const signOutUser = async()=>{await signOutNative(auth);};`);
 code=between(code,'function localAccount(', 'const deniedAccounts', `function localAccount(uid:string): Account | null {return readNativeAccount(uid);}
function keepLocal(uid:string,patch:Account){return writeNativeAccount(uid,patch);}`);
 code=between(code,'export function forgetLocalAccount(', '// Keys and settings live', 'export function forgetLocalAccount(uid:string){clearNativeAccount(uid);}');
 code=between(code,'export function savedAccount(', 'export async function loadKeys(', 'export function savedAccount(_uid:string): {keys:ApiKeys;settings:Record<string,unknown>|null}|null{return null;}');
 const save=code.indexOf('export async function saveKeys(');if(save<0)throw Error('Unknown canonical key save boundary');
 code=code.slice(0,save)+`export async function saveKeys(_uid:string,_keys:ApiKeys):Promise<void>{throw Error('Configure test provider credentials through the approved test backend. Native key saving is disabled.');}\n`;
 return code;
}
