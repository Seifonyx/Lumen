import { ChevronLeft, Download, FileText, Image as ImageIcon, Plus, Search } from 'lucide-react';
import { Suspense, useEffect, useId, useMemo, useState } from 'react';
import { useStore } from '../store';
import { usePhoneLayout } from '../lib/phone-layout';
import { useScreenMemory } from '../lib/screen-memory';
import { useBackLayer } from '../lib/back-stack';
import { exitFeature, navigateScreen, screenBack, screenUp } from '../lib/screen-history';
import { availability, availabilityShort, discoverItems, extensionOf, itemName, libraryItems, type LibraryItem, type LibrarySort, type ReadExports } from '../lib/library-items';
import { formatBytes, safeFileName, saveBlob } from '../lib/util';
import { loadOriginal } from '../lib/office/originals';
import { fileKind } from '../lib/generate';
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

const categories: {id:CollectionKind;label:string}[] = [
 {id:'all',label:'Everything'},
 {id:'documents',label:'Documents'},
 {id:'photos',label:'Photos'},
 {id:'files',label:'Attached files'},
 {id:'generated',label:'Made by Lumen'},
 {id:'searchable',label:'Knowledge'},
];
const src = (item: LibraryItem) => 'file' in item && item.file.kind === 'image' ? item.file.data ? `data:${item.file.mime};base64,${item.file.data}` : item.file.thumb : undefined;
// Cache only the parser function, never an account's content. Remounted history views
// can restore generated detail keys synchronously after the first Library visit.
let exportReader: ReadExports | undefined;
export default function CanvasCollectionPage({onClose,initial='all'}:{onClose:()=>void;initial?:CollectionKind}) {
 const chats=useStore(s=>s.chats), projects=useStore(s=>s.settings.projects),phone=usePhoneLayout(),panel=useId();
 const [kind,setKind]=useScreenMemory<CollectionKind>('library-kind',initial,initial!=='all');
 const [query,setQuery]=useScreenMemory('library-query',''),[project,setProject]=useScreenMemory('library-project',''),[sort,setSort]=useScreenMemory<LibrarySort>('library-sort','newest');
 const [detailKey,setDetailKey]=useScreenMemory<string|null>('library-detail',null);
 const [readExports,setReadExports]=useState<ReadExports|undefined>(()=>exportReader),[discoveryError,setDiscoveryError]=useState(false);
 useEffect(()=>{let live=true;void import('../lib/markdown').then(({segments})=>{exportReader=(text:string)=>segments(text,false).flatMap(part=>part.type==='file'&&part.complete?[{name:part.name,content:part.content}]:[]);if(live)setReadExports(()=>exportReader)}).catch(()=>{if(live)setDiscoveryError(true)});return()=>{live=false}},[]);
 const items=useMemo(()=>libraryItems(chats,readExports),[chats,readExports]);
 const detail=items.find(item=>item.key===detailKey)||null;
 useBackLayer(Boolean(detail),()=>setDetailKey(null),()=>setDetailKey(detailKey),detailKey || 'library-detail');
 const scoped=useMemo(()=>discoverItems(items,{kind,query,project,sort}),[items,kind,query,project,sort]);
 const category=categories.find(c=>c.id===kind)||categories[0];
 const openChat=(id:string)=>useStore.getState().selectChat(id);
 const newDoc=()=>navigateScreen(()=>{useStore.getState().newChat();useStore.getState().openCanvas()});
 const compose=(mode:'attach'|'image')=>{navigateScreen(()=>{useStore.getState().setUi({page:null});useStore.getState().newChat()});setTimeout(()=>window.dispatchEvent(new CustomEvent('mr:composer-mode',{detail:mode})),80)};
 const create=kind==='photos'?{label:'Add photos',run:()=>compose('attach')}:kind==='files'?{label:'Attach files',run:()=>compose('attach')}:kind==='generated'?{label:'Create an image',run:()=>compose('image')}:kind==='searchable'?undefined:{label:'New document',run:newDoc};
 const open=(item:LibraryItem)=>{
  if(item.kind==='documents')navigateScreen(()=>{openChat(item.chat.id);useStore.getState().setUi({canvasOpen:true,canvasDocumentId:item.doc.id})});
  else if('file' in item && item.file.data && src(item))openImage({src:src(item)!,alt:itemName(item),name:itemName(item)});
  else setDetailKey(item.key);
 };
 const search=<label className="hub-search"><Search size={18} aria-hidden="true"/><input type="search" aria-label="Search your library" placeholder={kind==='searchable'?'Find Knowledge document names':'Search names, chats and documents'} value={query} onChange={e=>setQuery(e.target.value)} />{query&&<button type="button" aria-label="Clear library search" onClick={e=>{setQuery('');e.currentTarget.parentElement?.querySelector('input')?.focus()}}>×</button>}</label>;
 const filtered=Boolean(query||project);
 // Phones name every photo "image.jpg": the same name more than once in one chat gets its place among them ("2 of 3
 // in this chat"), so rows can be told apart without renaming anything.
 const twins=useMemo(()=>{const groups=new Map<string,LibraryItem[]>();for(const item of scoped){const k=itemName(item).toLocaleLowerCase();groups.set(k,[...(groups.get(k)||[]),item])}
  const out=new Map<string,{of:number;n:number}|null>();for(const list of groups.values()){if(list.length<2)continue;const byChat=new Map<string,LibraryItem[]>();for(const item of list)byChat.set(item.chat.id,[...(byChat.get(item.chat.id)||[]),item]);
   for(const same of byChat.values()){const ordered=[...same].sort((a,b)=>a.at-b.at||a.key.localeCompare(b.key));ordered.forEach((item,i)=>out.set(item.key,same.length>1?{n:i+1,of:same.length}:null))}}
  return out},[scoped]);
 const total=<span className="library-total" role="status">{scoped.length} {filtered?'matching ':''}{scoped.length===1?'item':'items'}</span>;
 return <HubPage label="Library" title="Library" onClose={onClose} create={create}
  scrollLabel={!scoped.length && !filtered && kind !== 'searchable' ? 'Library content' : undefined}
  actions={create&&<button type="button" className="btn library-create" onClick={create.run}><Plus size={16}/>{create.label}</button>}
  sectionNavigation={<PhoneSections label="Library content types" panelId={panel} active={kind} items={categories} onSelect={id=>setKind(id as CollectionKind)}/>}
  footer={<footer className="phone-page-search" aria-label="Library search">{search}</footer>}>
  <div className="library-workspace">
   {!phone&&<PhoneSections label="Library content types" panelId={panel} active={kind} items={categories} onSelect={id=>setKind(id as CollectionKind)}/>}
   <section id={panel} role="tabpanel" aria-labelledby={`${panel}-${kind}`} className={`library-panel kind-${kind}`}>
    {discoveryError&&<p role="alert">Generated file discovery could not load. Your other chat items remain available. Reopen Library to retry.</p>}
    <h2 className="sr-only">{category.label}</h2>
    {kind==='searchable'?<div className="files-uploads"><p className="library-knowledge-note">Kept only on this device.</p>{!phone&&<div className="library-controls">{search}</div>}<KnowledgeLibrary onClose={onClose} filter={query}/></div>:<>
     <div className={`library-controls${!scoped.length&&filtered&&!project?' is-empty':''}`}>{!phone&&search}{phone&&total}<div className="library-sorts">{(scoped.length>0||!filtered)&&<label><span className="sr-only">Sort library</span><select aria-label="Sort library" value={sort} onChange={e=>setSort(e.target.value as LibrarySort)}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="name">Name A–Z</option></select></label>}{Boolean(projects?.length)&&(scoped.length>0||!filtered||project)&&<label><span className="sr-only">Project</span><select aria-label="Project" value={project} onChange={e=>setProject(e.target.value)}><option value="">All projects</option>{projects?.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}</div></div>
     {scoped.length?<>
      {!phone&&<div className="library-cols">{total}<span aria-hidden="true">From</span><span aria-hidden="true">Added</span></div>}
      <ul className="library-ledger">{scoped.map(item=><Row key={item.key} item={item} twin={twins.get(item.key)} onOpen={()=>open(item)} openChat={openChat}/>)}</ul>
     </>:filtered?<div className="library-nomatch" role="status"><h3>No matching items</h3><button type="button" className="btn small" onClick={()=>{setQuery('');setProject('')}}>{query&&project?'Clear search and filters':query?'Clear search':'Show every project'}</button></div>
      :<HubEmpty icon={<FileText size={28}/>} title={kind==='all'?'No files yet':kind==='generated'?'No generated files yet':`No ${category.label.toLowerCase()} yet`}/>}

    </>}
   </section>
  </div>
  {detail&&<LibraryDetail key={detail.key} item={detail} onClose={()=>screenBack(()=>setDetailKey(null))} openChat={openChat}/>}
 </HubPage>;
}

/** One saved thing: a tile (photo, extension or document mark), its name, and what it is and where it came from. On
 * computers the source chat and date sit in their own columns; on phones they share the second line. */
function Row({item,twin,onOpen,openChat}:{item:LibraryItem;twin?:{of:number;n:number}|null;onOpen:()=>void;openChat:(id:string)=>void}) {
 const name=itemName(item),id=useId(),picture=src(item),file='file'in item?item.file:null;
 const ext=item.kind==='documents'?'':extensionOf(name);
 const type=item.kind==='documents'?'Document':`${ext||'File'}${file&&Number.isFinite(file.size)&&file.size>0?` · ${formatBytes(file.size)}`:''}`;
 const made=item.kind==='generated'||item.kind==='exports'?'Made by Lumen':'';
 const status=file?availabilityShort(file):'';
 // twin: {n, of} when the name repeats within this chat (other chats already differ by their name on the row).
 const when=relTime(item.at), place=twin?`${twin.n} of ${twin.of} in this chat`:'';
 return <li className={`library-row kind-${item.kind}`}>
  <button type="button" className="library-open" aria-label={`Open ${name}${place?`, ${place}`:''}`} aria-describedby={id} onClick={onOpen}>
   <span className="library-row-copy">
    <span className="library-file-icon" aria-hidden="true">{picture?<img src={picture} alt="" loading="lazy"/>:item.kind==='documents'?<FileText size={20}/>:file?.kind==='image'?<ImageIcon size={20}/>:<span className="library-ext">{ext||<FileText size={20}/>}</span>}</span>
    <strong dir="auto" title={name}>{name}</strong>
    <span className="library-row-meta" id={id}>
     <span className="lr-type">{type}</span>
     {made&&<span className="lr-made">{made}</span>}
     {place&&<span className="lr-place">{place}</span>}
     {status&&<span className="lr-status">{status}</span>}
     <span className="lr-where"><bdi>{item.chat.title}</bdi> · {when}</span>
    </span>
   </span>
   <span className="library-col-from" aria-hidden="true" dir="auto">{item.chat.title}</span>
   <span className="library-col-when" aria-hidden="true">{when}</span>
  </button>
  {item.kind!=='exports'&&<Suspense fallback={null}><CanvasLibraryActions item={item} openChat={openChat}/></Suspense>}
 </li>;
}

function LibraryDetail({item,onClose,openChat}:{item:LibraryItem;onClose:()=>void;openChat:(id:string)=>void}) {
 const owner=useStore(s=>s.user?.uid),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const file='file'in item?item.file:null;
 const download=async()=>{
  if(!file)return;setBusy(true);setError('');
  try{const original=file.data?new Blob([Uint8Array.from(atob(file.data),c=>c.charCodeAt(0))],{type:file.mime}):await loadOriginal(owner,file.id,Boolean(file.stored));if(useStore.getState().user?.uid!==owner)return;if(!original)throw Error('The original is unavailable here. Open this conversation on the device where you added it.');await saveBlob(original,safeFileName(file.name,'File'))}catch(e){if(useStore.getState().user?.uid===owner)setError((e as Error).message)}finally{setBusy(false)}
 };
 return <Modal title={itemName(item)} onClose={onClose} leading={<button type="button" className="icon-btn feature-exit" aria-label="Back" onClick={()=>screenUp(onClose)}><ChevronLeft size={24}/></button>}>
  <div className="library-detail"><p className="library-detail-availability">{file?availability(file):'Generated file · export on demand'}</p>
   <dl><div><dt>Source conversation</dt><dd dir="auto">{item.chat.title}</dd></div>{file&&<><div><dt>File type</dt><dd>{fileKind(file.name).label}</dd></div>{Number.isFinite(file.size)&&file.size>0&&<div><dt>Recorded size</dt><dd>{formatBytes(file.size)}</dd></div>}</>}<div><dt>{item.kind==='documents'?'Updated':'Added'}</dt><dd>{new Date(item.at).toLocaleString()}</dd></div></dl>
   {file&&!file.data&&!file.stored&&<p className="muted">{file.text?'Extracted text is available here. The original formatting and file may be available only on the device where it was added.':'Open the source conversation on the original device to access the file. A thumbnail is not the original.'}</p>}
   {item.kind==='exports'&&<Suspense fallback={<p role="status">Opening file actions…</p>}><FileCard name={item.name} content={item.content} complete onEdit={()=>navigateScreen(()=>{openChat(item.chat.id);useStore.getState().openCanvas(item.name,item.content)})}/></Suspense>}
   {file?.text&&<details><summary>Inspect extracted text</summary><pre dir="auto">{file.text.slice(0,12000)}</pre>{file.text.length>12000&&<p>Showing the first 12,000 characters. Open the source conversation for the full context.</p>}</details>}
   {error&&<p role="alert">{error}</p>}
   <div className="library-detail-actions"><button type="button" className="btn" onClick={()=>openChat(item.chat.id)}>Open source conversation</button>{file&&(file.data||file.stored||/\.(docx|xlsx|xlsm)$/i.test(file.name))&&<button type="button" className="btn" disabled={busy} onClick={()=>void download()}><Download size={16}/>{busy?'Opening…':'Download original'}</button>}{file?.text&&<button type="button" className="btn" onClick={()=>void saveBlob(new Blob([file.text!],{type:'text/plain;charset=utf-8'}),`${safeFileName(file.name,'File')}.txt`)}>Download extracted text</button>}{file&&(file.data||file.text)&&<button type="button" className="btn primary" onClick={()=>{prepareTool('',[file]);exitFeature()}}>Add to chat draft</button>}</div>
  </div>
 </Modal>;
}
