// Private Windows/system-browser Google consent. No firebase-tools imports or administrative credential access.
import {createServer} from 'node:http';import {randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,statSync,rmSync} from 'node:fs';import {resolve,join,dirname,extname} from 'node:path';
import {build} from '../../node_modules/vite/dist/node/index.js';
import {validateServiceConfig} from '../services/config.mjs';import {allowRequest,acceptReport} from '../authorization/security.mjs';
const root=resolve('.'),base=resolve('.qa-build'),directory=resolve(base,'native-authorization');
if(dirname(directory)!==base||!base.startsWith(root))throw Error('Invalid private build directory');
const c=validateServiceConfig(JSON.parse(readFileSync(process.env.LUMEN_NATIVE_SERVICE_CONFIG||'native/artifacts/test-admin/native-service.private.json','utf8')));
if(c.projectId!=='lumen-ios-test')throw Error('Only lumen-ios-test authorization is allowed');
// Contact metadata only, not a credential; explicitly approved identity must match after Google sign-in.
const email=process.env.LUMEN_TEST_GOOGLE_EMAIL||JSON.parse(readFileSync('native/artifacts/test-admin/firebase.json','utf8')).auth.providers.googleSignIn.supportEmail;
if(typeof email!=='string'||!email.includes('@'))throw Error('Approved test identity email is required');
const session=randomBytes(24).toString('hex'),url='http://localhost:5213/'+session+'/';
mkdirSync(directory,{recursive:true});
writeFileSync(join(directory,'index.html'),`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lumen test authorization</title></head><body><main><h1>Lumen test authorization</h1><p>Google consent for the isolated test project. Authentication stays in memory.</p><button>Continue with Google</button><p role="status"></p></main><script type="module" src="${root.replaceAll(String.fromCharCode(92),'/')}/native/authorization/client.ts"></script></body></html>`);
const dist=join(directory,'dist');
await build({configFile:false,root:directory,base:'./',logLevel:'error',plugins:[{name:'private-authorization-config',resolveId(id){if(id==='lumen:authorization-config')return '\0'+id;},load(id){if(id==='\0lumen:authorization-config')return 'export default '+JSON.stringify({firebase:{projectId:c.projectId,apiKey:c.apiKey,appId:c.appId,authDomain:c.authDomain},email});}}],build:{outDir:dist,emptyOutDir:true,sourcemap:false}});
const assets=new Map();function collect(path,prefix=''){for(const name of readdirSync(path)){const full=join(path,name),key=prefix+name;if(statSync(full).isDirectory())collect(full,key+'/');else assets.set(key,readFileSync(full));}}collect(dist);
let complete=false;
const server=createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cross-Origin-Opener-Policy','same-origin-allow-popups');res.setHeader('Cross-Origin-Resource-Policy','same-origin');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' https://apis.google.com; style-src 'self' 'unsafe-inline'; frame-src https://lumen-ios-test.firebaseapp.com https://apis.google.com; connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://lumen-ios-test.firebaseapp.com; img-src 'self' data: https://*.googleusercontent.com; object-src 'none'; base-uri 'none'; form-action 'none'");
 const path=(req.url||'').split('?')[0];
 if(req.headers.host!=='localhost:5213'){res.writeHead(403).end();return;}
 if(req.method==='POST'){
  if(complete||!allowRequest(req.headers,session,path)){res.writeHead(403).end();return;}
  let body='',oversize=false;try{for await(const chunk of req){body+=chunk;if(body.length>1024){oversize=true;break;}}}catch{res.writeHead(400).end();return;}
  let report;try{report=JSON.parse(body);}catch{}
  if(oversize||!acceptReport(report)){res.writeHead(400).end();return;}
  complete=true;mkdirSync('native/artifacts',{recursive:true});writeFileSync('native/artifacts/app-client-authorization.json',JSON.stringify({project:'lumen-ios-test',...report,nativeIosFlowVerified:false},null,2));
  res.writeHead(200).end('Verified');console.log('PASS fresh Google popup authorization and test cloud roundtrip; native iOS flow not verified');setTimeout(stop,500);return;
 }
 if(req.method!=='GET'||!path.startsWith('/'+session+'/')){res.writeHead(404).end();return;}
 const name=path.slice(session.length+2)||'index.html',data=assets.get(name);
 if(!data){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',extname(name)==='.js'?'text/javascript':extname(name)==='.html'?'text/html':'application/octet-stream');res.writeHead(200).end(data);
});
const timer=setTimeout(()=>{console.log('Authorization session expired; rerun this command for a fresh private session.');stop();},20*60*1000);
function stop(){clearTimeout(timer);server.close();if(dirname(directory)===base&&directory===resolve('.qa-build/native-authorization'))rmSync(directory,{recursive:true,force:true});}
process.once('SIGINT',stop);process.once('SIGTERM',stop);
server.once('error',()=>{console.error('Private authorization listener could not start. Close an existing Lumen authorization session, then retry.');stop();process.exitCode=1;});
server.listen(5213,'127.0.0.1',()=>{console.log('One-time Google authorization (Windows browser only): '+url);console.log('Choose Continue with Google, select the approved account and accept Google consent. No passwords/tokens or iPhone QA.');});
