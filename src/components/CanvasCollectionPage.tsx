import { BookOpen, ChevronLeft, Download, FileText, Image as ImageIcon, Plus, Search } from 'lucide-react';
import { Suspense, useEffect, useId, useMemo, useState } from 'react';
import { useStore } from '../store';
import { usePhoneLayout } from '../lib/phone-layout';
import { useScreenMemory } from '../lib/screen-memory';
import { useBackLayer } from '../lib/back-stack';
import { exitFeature, featureExitLabel, navigateScreen, screenBack } from '../lib/screen-history';
import { availability, discoverItems, itemName, libraryItems, type LibraryItem, type LibrarySort, type ReadExports } from '../lib/library-items';
import { formatBytes, safeFileName, saveBlob } from '../lib/util';
import { loadOriginal } from '../lib/office/originals';
import type { CollectionKind } from './CollectionPage';
import HubPage, { HubEmpty, relTime } from './HubPage';
import PhoneSections from './PhoneSections';
import KnowledgeLibrary from './KnowledgeLibrary';
import CanvasLibraryActions from './CanvasLibraryActions';
import Modal from './Modal';
import FileCard from './FileCard';
import { openImage } from './ImageViewer';
import { prepareTool } from './Composer';
import './canvas-library.css';

const categories: {id:CollectionKind;label:string;description:string}[] = [
 {id:'all',label:'Everything',description:'Photos, attachments, editable documents and generated files from your saved chats.'},
 {id:'documents',label:'Documents',description:'Editable Canvas documents, saved with their conversations.'},
 {id:'photos',label:'Photos',description:'Images you attached to conversations. Originals may depend on the device where you added them.'},
 {id:'files',label:'Attached files',description:'Uploads attached to saved chats. Extracted text and original files are distinct.'},
 {id:'generated',label:'Made by Lumen',description:'Images and file blocks from replies. Exports are built when you choose Save; downloads are not tracked.'},
 {id:'searchable',label:'Knowledge',description:'Searchable references kept only on this device, separately from your chat attachments.'},
];
const src = (item: LibraryItem) => 'file' in item && item.file.kind === 'image' ? item.file.data ? `data:${item.file.mime};base64,${item.file.data}` : item.file.thumb : undefined;
export default function CanvasCollectionPage({onClose,initial='all'}:{onClose:()=>void;initial?:CollectionKind}) {
 const chats=useStore(s=>s.chats), projects=useStore(s=>s.settings.projects),phone=usePhoneLayout(),panel=useId();
 const [kind,setKind]=useScreenMemory<CollectionKind>('library-kind',initial,initial!=='all');
 const [query,setQuery]=useScreenMemory('library-query',''),[project,setProject]=useScreenMemory('library-project',''),[sort,setSort]=useScreenMemory<LibrarySort>('library-sort','newest');
 const [detail,setDetail]=useState<LibraryItem|null>(null);
 const [readExports,setReadExports]=useState<ReadExports>();
 useEffect(()=>{let live=true;void import('../lib/markdown').then(({segments})=>{if(live)setReadExports(()=> (text:string)=>segments(text,false).flatMap(part=>part.type==='file'&&part.complete?[{name:part.name,content:part.content}]:[]))});return()=>{live=false}},[]);
 useBackLayer(Boolean(detail),()=>setDetail(null),()=>setDetail(detail),detail?.key || 'library-detail');
 const items=useMemo(()=>libraryItems(chats,readExports),[chats,readExports]);
 const scoped=useMemo(()=>discoverItems(items,{kind,query,project,sort}),[items,kind,query,project,sort]);
 const category=categories.find(c=>c.id===kind)||categories[0];
 const openChat=(id:string)=>useStore.getState().selectChat(id);
 const newDoc=()=>navigateScreen(()=>{useStore.getState().newChat();useStore.getState().openCanvas()});
 const compose=(mode:'attach'|'image')=>{navigateScreen(()=>{useStore.getState().setUi({page:null});useStore.getState().newChat()});setTimeout(()=>window.dispatchEvent(new CustomEvent('mr:composer-mode',{detail:mode})),80)};
 const create=kind==='photos'?{label:'Add photos',run:()=>compose('attach')}:kind==='files'?{label:'Attach files',run:()=>compose('attach')}:kind==='generated'?{label:'Create an image',run:()=>compose('image')}:kind==='searchable'?{label:'Import Knowledge',run:()=>document.querySelector<HTMLInputElement>('.files-uploads input[type="file"]')?.click()}:{label:'New document',run:newDoc};
 const open=(item:LibraryItem)=>{
  if(item.kind==='documents')navigateScreen(()=>{openChat(item.chat.id);useStore.getState().setUi({canvasOpen:true,canvasDocumentId:item.doc.id})});
  else if('file' in item && item.file.data && src(item))openImage({src:src(item)!,alt:itemName(item),name:itemName(item)});
  else setDetail(item);
 };
 const search=<label className="hub-search"><Search size={18} aria-hidden="true"/><input type="search" aria-label="Search your library" placeholder={kind==='searchable'?'Find Knowledge document names':'Search names, chats and documents'} value={query} onChange={e=>setQuery(e.target.value)} />{query&&<button type="button" aria-label="Clear library search" onClick={e=>{setQuery('');e.currentTarget.parentElement?.querySelector('input')?.focus()}}>×</button>}</label>;
 return <HubPage label="Library" title="Library" subtitle="Keep your work within reach." onClose={onClose} create={create}
  actions={<button type="button" className="btn primary" onClick={create.run}><Plus size={16}/>{create.label}</button>}
  sectionNavigation={<PhoneSections label="Library content types" panelId={panel} active={kind} items={categories} onSelect={id=>setKind(id as CollectionKind)}/>}
  footer={<footer className="phone-page-search" aria-label="Library search">{search}</footer>}>
  <div className="library-workspace">
   {!phone&&<PhoneSections label="Library content types" panelId={panel} active={kind} items={categories} onSelect={id=>setKind(id as CollectionKind)}/>}
   <section id={panel} role="tabpanel" aria-labelledby={`${panel}-${kind}`} className="library-panel">
    <div className="library-section-head"><div><h2>{category.label==='Everything'?'From your chats':category.label}</h2><p>{category.description}</p></div>{kind!=='searchable'&&<span className="library-total" role="status">{scoped.length} {query||project?'matching ':''}chat {scoped.length===1?'item':'items'}</span>}</div>
    {kind==='searchable'?<div className="files-uploads">{!phone&&<div className="library-controls">{search}</div>}<KnowledgeLibrary onClose={onClose} filter={query}/></div>:<>
     <div className="library-controls">{!phone&&search}<label><span className="sr-only">Sort library</span><select aria-label="Sort library" value={sort} onChange={e=>setSort(e.target.value as LibrarySort)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name A–Z</option></select></label>{Boolean(projects?.length)&&<label><span className="sr-only">Project</span><select aria-label="Project" value={project} onChange={e=>setProject(e.target.value)}><option value="">All projects</option>{projects?.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}</div>
     {scoped.length?<ul className="library-ledger">{scoped.map(item=><li key={item.key} className="library-row">
      <button type="button" className="library-open" aria-label={`Open ${itemName(item)}`} onClick={()=>open(item)}>
       <span className="library-file-icon" aria-hidden="true">{src(item)?<img src={src(item)} alt="" loading="lazy"/>:'file'in item&&item.file.kind==='image'?<ImageIcon size={24}/>:<FileText size={24}/>}</span>
       <span className="library-row-copy"><strong dir="auto">{itemName(item)}</strong><span>{item.kind==='documents'?'Canvas document':item.kind==='exports'?'Generated file · export on demand':`${item.file.name.split('.').pop()?.toUpperCase()||'File'}${Number.isFinite(item.file.size)&&item.file.size>0?` · ${formatBytes(item.file.size)}`:''} · ${availability(item.file)}`}</span><span className="library-row-source" dir="auto">{item.chat.title} · {relTime(item.at)}</span></span>
      </button>
      {item.kind!=='exports'&&<Suspense fallback={null}><CanvasLibraryActions item={item} openChat={openChat}/></Suspense>}
     </li>)}</ul>:<HubEmpty icon={<FileText size={28}/>} title={query||project?'No matching items':'A little room for your work'} text={query||project?'Try another search or widen the category and project filters.':category.description} action={query||project?<button type="button" className="btn" onClick={()=>{setQuery('');setProject('');setKind('all')}}>Reset filters</button>:<button type="button" className="btn primary" onClick={newDoc}>New document</button>}/>}
     <button type="button" className="library-knowledge-link" onClick={()=>setKind('searchable')}><BookOpen size={20}/><span><strong>Looking for searchable sources?</strong><span>Knowledge has its own device-local collection.</span></span><span aria-hidden="true">→</span></button>
    </>}
   </section>
  </div>
  {detail&&<LibraryDetail key={detail.key} item={detail} onClose={()=>screenBack(()=>setDetail(null))} openChat={openChat}/>}
 </HubPage>;
}

function LibraryDetail({item,onClose,openChat}:{item:LibraryItem;onClose:()=>void;openChat:(id:string)=>void}) {
 const owner=useStore(s=>s.user?.uid),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const file='file'in item?item.file:null;
 const download=async()=>{
  if(!file)return;setBusy(true);setError('');
  try{const original=file.data?new Blob([Uint8Array.from(atob(file.data),c=>c.charCodeAt(0))],{type:file.mime}):await loadOriginal(owner,file.id,Boolean(file.stored));if(useStore.getState().user?.uid!==owner)return;if(!original)throw Error('The original is unavailable here. Open this conversation on the device where you added it.');await saveBlob(original,safeFileName(file.name,'File'))}catch(e){if(useStore.getState().user?.uid===owner)setError((e as Error).message)}finally{setBusy(false)}
 };
 return <Modal title={itemName(item)} onClose={onClose} leading={<button type="button" className="icon-btn feature-exit" aria-label={featureExitLabel()} onClick={()=>exitFeature()}><ChevronLeft size={24}/></button>}>
  <div className="library-detail"><p className="library-detail-availability">{file?availability(file):'Generated file · export on demand'}</p>
   <dl><div><dt>Source conversation</dt><dd dir="auto">{item.chat.title}</dd></div>{file&&<><div><dt>File type</dt><dd>{file.mime||'Not recorded'}</dd></div>{Number.isFinite(file.size)&&file.size>0&&<div><dt>Recorded size</dt><dd>{formatBytes(file.size)}</dd></div>}</>}<div><dt>{item.kind==='documents'?'Updated':'Added'}</dt><dd>{new Date(item.at).toLocaleString()}</dd></div></dl>
   {file&&!file.data&&!file.stored&&<p className="muted">{file.text?'Extracted text is available here. The original formatting and file may be available only on the device where it was added.':'Open the source conversation on the original device to access the file. A thumbnail is not the original.'}</p>}
   {item.kind==='exports'&&<Suspense fallback={<p role="status">Opening file actions…</p>}><FileCard name={item.name} content={item.content} complete onEdit={()=>navigateScreen(()=>{openChat(item.chat.id);useStore.getState().openCanvas(item.name,item.content)})}/></Suspense>}
   {file?.text&&<details><summary>Inspect extracted text</summary><pre dir="auto">{file.text.slice(0,12000)}</pre>{file.text.length>12000&&<p>Showing the first 12,000 characters. Open the source conversation for the full context.</p>}</details>}
   {error&&<p role="alert">{error}</p>}
   <div className="library-detail-actions"><button type="button" className="btn" onClick={()=>openChat(item.chat.id)}>Open source conversation</button>{file&&(file.data||file.stored||/\.(docx|xlsx|xlsm)$/i.test(file.name))&&<button type="button" className="btn" disabled={busy} onClick={()=>void download()}><Download size={16}/>{busy?'Opening…':'Download original'}</button>}{file?.text&&<button type="button" className="btn" onClick={()=>void saveBlob(new Blob([file.text!],{type:'text/plain;charset=utf-8'}),`${safeFileName(file.name,'File')}.txt`)}>Download extracted text</button>}{file&&(file.data||file.text)&&<button type="button" className="btn primary" onClick={()=>{prepareTool('',[file]);exitFeature()}}>Add to chat draft</button>}</div>
  </div>
 </Modal>;
}
