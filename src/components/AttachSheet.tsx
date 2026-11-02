import { useExit } from '../lib/motion';
import { FolderGit2, Images, Image as ImageIcon, Camera, Pencil, ChartNoAxesCombined, Columns2, Globe, Telescope, MessageSquareText, PlayCircle, LayoutGrid, FolderKanban, ChevronRight, Paperclip } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useFocusScope } from '../lib/focus-scope';
import { CANVAS_SHELL, prefetchPlace } from '../lib/canvas-presentation';
import { useStore } from '../store';
import { providerEnabled } from '../lib/ai/provider-config.js';
import { useSheetDrag } from '../lib/sheet-drag';
interface Props {
 onClose():void;onFiles():void;onPhotos():void;onCamera():void;onProject():void;projectName?:string;
 onConnectors():void;onMemory():void;memoryEnabled:boolean;temporary:boolean;
 onRepo():void;onCanvas():void;onAnalysis():void;onCompare():void;compareDisabled:boolean;onImage():void;onResearch?:()=>void;onPrompts?:()=>void;onTool?:(t:'youtube'|'reader'|'calculation')=>void;
 onSearch():void;searchEnabled:boolean;searchAvailable:boolean;onPrivacy():void;privacyEnabled:boolean;
 repoName?:string;anchor?:{left:number;bottom?:number;top?:number};
}
export default function AttachSheet(p:Props){
 const ref=useRef<HTMLDivElement>(null);
 useFocusScope(ref,true,p.onClose);
 useSheetDrag(ref,p.onClose,!p.anchor);
 const backdrop=useRef<HTMLDivElement>(null);
 useExit(backdrop,'fade',[['.sheet',p.anchor?'drop':'sheet']]);
 useEffect(()=>{ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();},[]);
 useEffect(()=>{if(!p.anchor)return;const close=()=>p.onClose();window.addEventListener('resize',close);return()=>window.removeEventListener('resize',close);},[p.anchor,p.onClose]);
 const pick=(action:()=>void)=>()=>{action();p.onClose();};
 // Canvas: a short first layer (attach, chat context, three quick tools) and Browse all tools for the full, searchable
 // catalogue. A quick tool whose key is missing says so and opens key setup instead of pretending to run.
 const keys=CANVAS_SHELL?useStore(s=>s.keys):null;
 if(CANVAS_SHELL) useEffect(()=>{prefetchPlace?.('tools');},[]);
 const setUpKeys=()=>useStore.getState().setUi({settingsOpen:true,settingsTab:'keys'});
 // Ready when the tool's provider is connected: Gemini for research; Cloudflare (with its account) or Hugging Face for
 // images, the same rule as imageProvider in src/lib/images.ts (not imported here: that module loads with the first image).
 const ready=(key:'gemini'|'image')=>{if(key==='gemini')return Boolean(keys!.gemini);const k=keys as unknown as Record<string,unknown>;return (providerEnabled('cloudflare',k)&&/^[a-f0-9]{32}$/i.test(keys!.cloudflareAccountId||''))||providerEnabled('huggingface',k);};
 const quick=(name:string,icon:ReactNode,run:()=>void,key?:'gemini'|'image')=>{const missing=Boolean(key&&!ready(key)),id=name.replace(/\W/g,'');return <button type="button" className="sheet-row" aria-labelledby={`attach-${id}`} aria-describedby={missing?`attach-why-${id}`:undefined} onClick={pick(missing?setUpKeys:run)}>{icon}<span id={`attach-${id}`}>{name}</span>{missing&&<><span className="attach-menu-meta" aria-hidden="true">Needs key</span><span id={`attach-why-${id}`} hidden>Needs a {key==='gemini'?'Gemini':'Cloudflare or Hugging Face'} key; opens key setup</span></>}</button>;};
 return <div ref={backdrop} className={`sheet-backdrop${p.anchor?' sheet-popover-backdrop':''}`} onClick={p.onClose}>
 <div ref={ref} className={CANVAS_SHELL?'sheet attach-menu attach-menu-v2':'sheet attach-menu'} style={p.anchor?(p.anchor.top!==undefined?{left:p.anchor.left,top:p.anchor.top,bottom:'auto',maxHeight:Math.max(80,window.innerHeight-p.anchor.top-12)}:{left:p.anchor.left,bottom:p.anchor.bottom,maxHeight:Math.max(80,window.innerHeight-(p.anchor.bottom||0)-12)}):undefined} role="dialog" aria-modal="true" tabIndex={-1} aria-label="Add to your message" onClick={e=>e.stopPropagation()}
 onKeyDown={e=>{if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;const buttons=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')].filter(button=>button.getClientRects().length>0);const i=buttons.indexOf(document.activeElement as HTMLButtonElement);e.preventDefault();buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowUp'?-1:1)+buttons.length)%buttons.length]?.focus();}}
>
 {CANVAS_SHELL?<>
 <div className="sheet-grab" aria-hidden="true"/>
 {!p.anchor&&<header className="add-sheet-header"><h2>Add</h2></header>}
 {!p.anchor&&<div className="photo-actions"><button type="button" onClick={pick(p.onCamera)}><Camera size={22}/><span>Camera</span></button><button type="button" onClick={pick(p.onPhotos)}><Images size={22}/><span>Photos</span></button><button type="button" onClick={pick(p.onFiles)}><Paperclip size={22}/><span>Files</span></button></div>}
 <div className="attach-menu-group" role="group" aria-label="This chat">
  {p.anchor&&<button type="button" className="sheet-row" onClick={pick(p.onFiles)}><Paperclip size={18}/><span>Files and images</span></button>}
  <button type="button" className="sheet-row search-toggle" role="switch" aria-checked={p.searchEnabled} onClick={p.onSearch} title={p.searchAvailable?'Search the web with Gemini':'Web search works with Gemini models'}><Globe size={18}/><span>Web search</span><span className="menu-switch" aria-hidden="true"/></button>
  <button type="button" className="sheet-row" disabled={p.temporary} aria-describedby={p.temporary?'attach-why-project':undefined} onClick={pick(p.onProject)}><FolderKanban size={18}/><span>Project</span><span className="attach-menu-meta" id={p.temporary?'attach-why-project':undefined}>{p.temporary?'Not in Incognito':p.projectName||'None'}</span><ChevronRight size={16}/></button>
  <button type="button" className="sheet-row" onClick={pick(p.onRepo)}><FolderGit2 size={18}/><span>GitHub repository</span>{p.repoName&&<span className="attach-menu-meta" dir="auto">{p.repoName}</span>}</button>
 </div>
 <div className="attach-menu-group" role="group" aria-labelledby="attach-tools-title">
  <p className="attach-menu-title" id="attach-tools-title">Tools</p>
  {p.onResearch&&quick('Deep research',<Telescope size={18}/>,p.onResearch,'gemini')}
  {quick('Create image',<ImageIcon size={18}/>,p.onImage,'image')}
  {quick('Document canvas',<Pencil size={18}/>,p.onCanvas)}
  <button type="button" className="sheet-row all-tools" aria-haspopup="dialog" onClick={pick(()=>window.dispatchEvent(new CustomEvent('mr:library',{detail:'tools-page'})))}><LayoutGrid size={18}/><span>Browse all tools</span><ChevronRight size={16}/></button>
 </div>
 </>:<>
 <div className="sheet-grab" aria-hidden="true"/>
 {!p.anchor&&<header className="add-sheet-header"><h2>Add</h2></header>}
 {!p.anchor&&<div className="photo-actions"><button type="button" onClick={pick(p.onCamera)}><Camera size={24}/><span>Camera</span></button><button type="button" onClick={pick(p.onPhotos)}><Images size={24}/><span>Photos</span></button></div>}
 <div className="attach-menu-group">
  <button type="button" className="sheet-row" onClick={pick(p.onFiles)}><Paperclip size={18}/><span>Files and images</span></button>
  <button type="button" className="sheet-row search-toggle" role="switch" aria-checked={p.searchEnabled} onClick={p.onSearch} title={p.searchAvailable?'Search the web with Gemini':'Web search works with Gemini models'}><Globe size={18}/><span>Web search</span><span className="menu-switch" aria-hidden="true"/></button>
  <button type="button" className="sheet-row" disabled={p.temporary} onClick={pick(p.onProject)}><FolderKanban size={18}/><span>Project</span><span className="attach-menu-meta">{p.projectName||'None'}</span><ChevronRight size={16}/></button>
  <button type="button" className="sheet-row" onClick={pick(p.onRepo)}><FolderGit2 size={18}/><span>{p.repoName?'Open repository':'GitHub repository'}</span></button>
 </div>
 <p className="attach-menu-title">Tools</p>
 <div className="attach-menu-group">
  {p.onResearch&&<button type="button" className="sheet-row" onClick={pick(p.onResearch)}><Telescope size={18}/><span>Deep research</span></button>}
  <button type="button" className="sheet-row" onClick={pick(p.onCanvas)}><Pencil size={18}/><span>Document canvas</span></button>
  <button type="button" className="sheet-row" onClick={pick(p.onAnalysis)}><ChartNoAxesCombined size={18}/><span>Data analysis</span></button>
  <button type="button" className="sheet-row" onClick={pick(p.onImage)}><ImageIcon size={18}/><span>Create image</span></button>
  <button type="button" className="sheet-row compare-trigger" disabled={p.compareDisabled} aria-describedby={p.compareDisabled?'compare-why':undefined} onClick={pick(p.onCompare)}><Columns2 size={18}/><span>Compare models</span>{p.compareDisabled&&<span className="attach-menu-meta" id="compare-why" aria-hidden="true">Unavailable now</span>}</button>
  {p.onPrompts&&<button type="button" className="sheet-row" onClick={pick(p.onPrompts)}><MessageSquareText size={18}/><span>Saved prompts</span></button>}
  {p.onTool&&<button type="button" className="sheet-row" title="Summarize a YouTube video, read a web page, or calculate with Python" onClick={pick(()=>p.onTool!('youtube'))}><PlayCircle size={18}/><span>Quick tools</span><span className="attach-menu-meta" aria-hidden="true">Video, web, maths</span></button>}
  <button type="button" className="sheet-row all-tools" onClick={pick(()=>window.dispatchEvent(new CustomEvent('mr:library',{detail:'tools-page'})))}><LayoutGrid size={18}/><span>All tools</span><ChevronRight size={16}/></button>
 </div>
 </>}
 </div></div>;
}
