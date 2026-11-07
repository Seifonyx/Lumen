function between(code,start,end,replacement){const a=code.indexOf(start),b=code.indexOf(end,a+start.length);if(a<0||b<0)throw Error('Unknown canonical Firebase boundary: '+start);return code.slice(0,a)+replacement+'\n\n'+code.slice(b);}
/** Checked build-only adaptation of canonical account persistence; production source remains untouched. */
export function patchFirebase(code){
 code=code.replace('GoogleAuthProvider, browserLocalPersistence,','GoogleAuthProvider, inMemoryPersistence, initializeAuth,');
 code=code.replace("import config from '../firebase-config.json';", "import config from 'lumen:test-config';\nimport {watchNativeUser,signInNative,signOutNative,readNativeAccount,writeNativeAccount,clearNativeAccount,saveNativeProviderKeys} from 'lumen:native-account';");
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
 code=code.replace("return normalizeKeys({ ...d.providerConnections, gemini: d.geminiKey || '', openrouter: d.openrouterKey || '', groq: d.groqKey || '', cerebras: d.cerebrasKey || '', github: d.githubKey || '' })","return normalizeKeys({openrouter: d.openrouterKey || ''})");
 const save=code.indexOf('export async function saveKeys(');if(save<0)throw Error('Unknown canonical key save boundary');
 code=code.slice(0,save)+`export async function saveKeys(uid:string,keys:ApiKeys):Promise<void>{await saveNativeProviderKeys(db,uid,keys);accountRead=null;}\n`;
 return code;
}

/** Native-only durability around the canonical driver's unchanged cloud/deletion protocol. */
export function patchSync(code){
 code=code.replaceAll('\r\n','\n');
 const flush='    save(`mr.sync.deletes.${this.uid}`, []);';
 const id='            const id = c.doc.id;';
 const listen='    this.unsub = onSnapshot(\n      q,\n      (snap) => {';
 const changes='        const changes = snap.docChanges().filter((c) => !c.doc.metadata.hasPendingWrites);';
 const start=code.indexOf('  private async removeNow(id: string)');
 const end=code.indexOf('  /**',start+1);
 if(!code.includes(flush)||!code.includes(id)||!code.includes(listen)||!code.includes(changes)||start<0||end<0)throw Error('Unknown canonical sync deletion boundary');
 const segment=code.slice(start,end),ack='    save(`mr.sync.revs.${this.uid}`, this.synced);';
 if(!segment.includes(ack))throw Error('Unknown canonical sync acknowledgment');
 const updated=segment.replace(ack,ack+'\n    save(`mr.sync.deletes.${this.uid}`, load<string[]>(`mr.sync.deletes.${this.uid}`, []).filter(value => value !== id));');
 return (code.slice(0,start)+updated+code.slice(end))
  .replace(listen,'    this.unsub = onSnapshot(\n      q,\n      {includeMetadataChanges:true},\n      (snap) => {')
  .replace(changes,'        // Native reconnect must reconcile authoritative server data before uploading local revisions.\n        if (snap.metadata.fromCache) return;\n        const changes = (first ? snap.docs.map(doc => ({doc,type: "added"})) : snap.docChanges()).filter((c) => !c.doc.metadata.hasPendingWrites);')
  .replace(flush,'    // Native: keep the durable queue until removeNow receives a server acknowledgment.')
  .replace(id,id+'\n            if (!data.deleted && load<string[]>(`mr.sync.deletes.${this.uid}`, []).includes(id)) continue;');
}
