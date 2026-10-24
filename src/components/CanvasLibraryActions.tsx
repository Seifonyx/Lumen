import { finishScreen, screenBack } from '../lib/screen-history';
import { useBackLayer } from '../lib/back-stack';
import { useState } from 'react';
import type { Item } from './CollectionPage';
import ScreenActions from './ScreenActions';
import Modal from './Modal';
import { useStore } from '../store';
import { safeFileName, saveBlob } from '../lib/util';
export default function CanvasLibraryActions({ item, openChat }: { item: Item; openChat: (id: string) => void }) {
 const owner=useStore(s=>s.user?.uid), projects=useStore(s=>s.settings.projects)||[];
 const [confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useBackLayer(confirm, () => setConfirm(false), () => setConfirm(true), `delete:${item.key}`);
 const label=item.kind==='documents'?item.doc.name:item.file.name;
 const actions=[{label:'Open source conversation',run:()=>openChat(item.chat.id)},
 ...(item.kind==='documents'?[{label:'Download document',run:()=>saveBlob(new Blob([item.doc.content],{type:'text/markdown'}),`${safeFileName(item.doc.name.replace(/\.md$/i,''),'Document')}.md`)}]:[]),
 ...projects.filter(p=>p.id!==item.chat.projectId).map(p=>({label:`Move conversation to ${p.name}`,run:()=>useStore.getState().moveChatToProject(item.chat.id,p.id)})),
 ...(item.kind==='documents'?[{label:'Delete document…',destructive:true,run:()=>setConfirm(true)}]:[])];
 const remove=async()=>{const fresh=useStore.getState();if(fresh.user?.uid!==owner||item.kind!=='documents')return;setBusy(true);setError('');try{finishScreen(() => { fresh.deleteCanvasDocument(item.chat.id,item.doc.id);setConfirm(false); })}catch{setError('The document could not be deleted. Try again.')}finally{setBusy(false)}};
 return <><ScreenActions label={`More for ${label}`} actions={actions}/>{confirm&&<Modal title={`Delete “${label}”?`} onClose={busy?()=>{}:()=>screenBack(() => setConfirm(false))}><p>This removes the document from its conversation. Source attachments are kept.</p>{error&&<p role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="btn" disabled={busy} onClick={()=>screenBack(() => setConfirm(false))}>Cancel</button><button type="button" className="btn danger" disabled={busy} onClick={()=>void remove()}>{busy?'Deleting…':'Delete document'}</button></div></Modal>}</>;
}
