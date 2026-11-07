import {useState} from 'react';
import {useScreenMemory} from '../../src/lib/screen-memory';
import {useStore} from '../../src/store';
import ProviderConnections from '../../src/components/ProviderConnections';
import {normalizeKeys} from '../../src/lib/ai/provider-config.js';
import type {ApiKeys} from '../../src/lib/firebase';
import {showRoutingProvider} from '../../src/lib/routing-center';
import {accountScope} from '../integration/runtime';
import {nativeAiConsent,enableFreeOpenRouter} from './transport';

export default function KeysPanel({provider}:{provider?:string}){
 const uid=useStore(s=>s.user?.uid);
 return <FreeKeys key={uid} owner={uid} provider={provider}/>;
}
function FreeKeys({owner,provider}:{owner?:string;provider?:string}){
 const saved=useStore(s=>s.keys),save=useStore(s=>s.saveApiKeys);
 const [key,setKey]=useScreenMemory<string>('native-openrouter-key-draft',saved.openrouter||'');
 const [confirmed,setConfirmed]=useState(Boolean(nativeAiConsent.current())),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('');
 const draft=normalizeKeys({openrouter:key}) as unknown as ApiKeys;
 const unsupported=provider&&provider!=='openrouter';
 if(unsupported)return <div className="settings-section"><p>Only OpenRouter free text models are enabled in this iPhone build.</p><button className="btn" onClick={()=>showRoutingProvider('openrouter')}>Set up OpenRouter</button></div>;
 async function connect(){
  if(!owner||busy)return;setBusy(true);setError('');setStatus('');
  try{
   await enableFreeOpenRouter(key.trim(),confirmed);
   if(accountScope.uid!==owner)return;
   const changed=key.trim()!==saved.openrouter;
   await save(normalizeKeys({openrouter:key.trim()}) as unknown as ApiKeys);
   if(!changed&&accountScope.uid===owner)await useStore.getState().loadCatalog(true);
   if(accountScope.uid===owner)setStatus('Key saved privately. View model availability in Router.');
  }catch(error){
   nativeAiConsent.revoke(owner);
   const known=new Set(['OpenRouter is rate limited. Try later.','OpenRouter could not verify this key.','Use a free account, set the key credit limit to $0, and remove BYOK usage.','Key sync could not be confirmed. Reconnect and retry.','The account changed.']);
   const message=(error as Error).message;
   if(accountScope.uid===owner)setError(known.has(message)?message:'Could not connect. Check your free $0 key and network, then retry.');
  }
  finally{setBusy(false);}
 }
 function disconnect(){
  useStore.getState().stop();nativeAiConsent.revoke(owner);setConfirmed(false);setStatus('Free AI disabled on this device. The private account key is retained.');setError('');
  useStore.setState({keys:{...useStore.getState().keys}});
 }

 return <div className="settings-section">
  <fieldset disabled={busy} style={{border:0,padding:0,margin:0,minWidth:0}}><ProviderConnections compact targetProvider="openrouter" main={[{id:'openrouter',label:'OpenRouter',placeholder:'sk-or-…',link:'https://openrouter.ai/keys',hint:'Free text models only. Set your key credit limit to $0.'}]} draft={draft} setDraft={d=>setKey(d.openrouter||'')} saved={saved}/></fieldset>
  <label style={{display:'flex',gap:10,alignItems:'flex-start',paddingBlock:8}}><input type="checkbox" style={{width:18,height:18,flexShrink:0,marginTop:4}} checked={confirmed} disabled={busy} onChange={e=>{setConfirmed(e.target.checked);if(!e.target.checked)disconnect();}}/><span>Allow this account’s text to be sent to OpenRouter and its model providers. My free account has no BYOK keys. Use only $0 models; never fall back to paid models.</span></label>
  <p className="muted small">No request is made until you connect. Paid plugins, web search and image/PDF requests stay blocked.</p>
  {error&&<p className="error-text" role="alert">{error}</p>}
  {status&&<p role="status">{status}</p>}
  <div style={{display:'grid',gap:8,marginTop:12}}><button className="btn primary" disabled={busy||!confirmed||!key.trim()} onClick={()=>void connect()}>{busy?'Connecting…':'Save and enable free AI'}</button><button className="btn" disabled={busy} onClick={()=>void disconnect()}>Disable free AI</button></div>
 </div>;
}
