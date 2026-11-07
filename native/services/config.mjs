const fields=new Set(['mode','projectId','projectNumber','apiKey','appId','iosClientId','webClientId','bundleId','signedBundleId','approvedTestEnvironment']);
export function validateServiceConfig(input){
 if(!input||typeof input!=='object'||Object.keys(input).some(k=>!fields.has(k)))throw Error('Only non-secret isolated test SDK configuration is accepted');
 const c={...input};
 if(c.mode!=='isolated-test'||c.approvedTestEnvironment!==true)throw Error('Explicit isolated-test configuration approval is required');
 if(typeof c.projectId!=='string'||!/^[a-z][a-z0-9-]{5,29}$/.test(c.projectId)||['the-model-router','lumen-chat','model-router'].includes(c.projectId))throw Error('Production or invalid Firebase project refused');
 if(!/^\d+$/.test(c.projectNumber)||typeof c.apiKey!=='string'||!c.apiKey||c.apiKey.length>256)throw Error('Missing test Firebase SDK configuration');
 if(!new RegExp('^1:'+c.projectNumber+':web:[a-zA-Z0-9]+$').test(c.appId))throw Error('Firebase app does not match test project number');
 for(const name of ['iosClientId','webClientId'])if(typeof c[name]!=='string'||!new RegExp('^'+c.projectNumber+'-[a-zA-Z0-9_-]+\\.apps\\.googleusercontent\\.com$').test(c[name]))throw Error('OAuth client does not match test project number');
 if(c.bundleId!=='io.github.seifonyx.lumen.demo')throw Error('Installed bundle identity must be preserved');
 const signedBundleId=c.signedBundleId||c.bundleId;
 if(typeof signedBundleId!=='string'||signedBundleId.length>160||!/^([A-Za-z0-9-]+\.)+[A-Za-z0-9-]+$/.test(signedBundleId))throw Error('Invalid installed signing bundle ID');
 return Object.freeze({...c,signedBundleId,callbackScheme:c.iosClientId.split('.').reverse().join('.'),authDomain:c.projectId+'.firebaseapp.com'});
}
export function requestAllowed(c,raw){
 try{
  const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port)return false;
  if(u.hostname==='identitytoolkit.googleapis.com')return /^\/v1\/accounts:(signInWithIdp|lookup)$/.test(u.pathname)&&u.searchParams.get('key')===c.apiKey;
  if(u.hostname==='securetoken.googleapis.com')return u.pathname==='/v1/token'&&u.searchParams.get('key')===c.apiKey;
  if(u.hostname==='firestore.googleapis.com'){
   const db='projects/'+c.projectId+'/databases/(default)';
   return u.pathname.startsWith('/v1/'+db+'/')||/^\/google\.firestore\.v1\.Firestore\/(Listen|Write)\/channel$/.test(u.pathname)&&u.searchParams.get('database')===db;
  }
  return false; // Inference needs independently verified zero-cost path; none is activated here.
 }catch{return false;}
}
