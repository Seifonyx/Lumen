import { FolderGit2, Images, Camera, Pencil, ChartNoAxesCombined, Columns2, Globe, ShieldCheck, Check, X, FolderKanban, Blocks, Brain, ChevronRight, ArrowLeft, Wrench, BookOpen, Clock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useFocusScope } from '../lib/focus-scope';
import './touch.css';
interface Props {
 onClose():void;onFiles():void;onPhotos():void;onCamera():void;onProject():void;projectName?:string;
 onConnectors():void;onMemory():void;memoryEnabled:boolean;temporary:boolean;
 onRepo():void;onCanvas():void;onAnalysis():void;onCompare():void;compareDisabled:boolean;
 onSearch():void;searchEnabled:boolean;searchAvailable:boolean;onPrivacy():void;privacyEnabled:boolean;
 repoName?:string;anchor?:{left:number;bottom:number};
}
export default function AttachSheet(p:Props){
 const ref=useRef<HTMLDivElement>(null),startY=useRef<number|null>(null);const [tools,setTools]=useState(false);
 useFocusScope(ref,true,p.onClose);
 useEffect(()=>{ref.current?.querySelector<HTMLButtonElement>('button')?.focus();},[tools]);
 useEffect(()=>{if(!p.anchor)return;const close=()=>p.onClose();window.addEventListener('resize',close);return()=>window.removeEventListener('resize',close);},[p.anchor,p.onClose]);
 const pick=(action:()=>void)=>()=>{action();p.onClose();};
 const library=(section:string)=>pick(()=>window.dispatchEvent(new CustomEvent('mr:library',{detail:section})));
 return <div className={`sheet-backdrop${p.anchor?' sheet-popover-backdrop':''}`} onClick={p.onClose}>
 <div ref={ref} className="sheet attach-menu" style={p.anchor?{left:p.anchor.left,bottom:p.anchor.bottom,maxHeight:Math.max(80,window.innerHeight-p.anchor.bottom-12)}:undefined} role="dialog" aria-modal="true" tabIndex={-1} aria-label="Add to your message" onClick={e=>e.stopPropagation()}
 onKeyDown={e=>{if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;const buttons=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')].filter(button=>button.getClientRects().length>0);const i=buttons.indexOf(document.activeElement as HTMLButtonElement);e.preventDefault();buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowUp'?-1:1)+buttons.length)%buttons.length]?.focus();}}
 onTouchStart={e=>{startY.current=e.touches[0].clientY;}} onTouchEnd={e=>{if(startY.current!==null&&ref.current?.scrollTop===0&&e.changedTouches[0].clientY-startY.current>70)p.onClose();startY.current=null;}}>
 <div className="sheet-grab" aria-hidden="true"/>
 <header className="add-sheet-header"><button type="button" className="icon-btn" aria-label={tools?'Back to Add to Chat':'Close Add to Chat'} onClick={()=>tools?setTools(false):p.onClose()}>{tools?<ArrowLeft size={22}/>:<X size={24}/>}</button><h2>{tools?'Tools':'Add to Chat'}</h2>{!tools?<button type="button" onClick={pick(p.onPhotos)}>Photos</button>:<span/>}</header>
 {!tools?<>
 <div className="photo-actions"><button type="button" onClick={pick(p.onCamera)}><Camera size={25}/><span>Camera</span></button><button type="button" onClick={pick(p.onPhotos)}><Images size={25}/><span>Photos</span></button></div>
 <div className="attach-menu-group"><button type="button" className="sheet-row" onClick={pick(p.onFiles)}><Images size={20}/><span>Add files</span></button><button type="button" className="sheet-row" disabled={p.temporary} onClick={pick(p.onProject)}><FolderKanban size={20}/><span>Add to project</span><span className="attach-menu-meta">{p.projectName||'None'}</span><ChevronRight size={17}/></button></div>
 <div className="attach-menu-group"><button type="button" className="sheet-row" onClick={pick(p.onConnectors)}><Blocks size={20}/><span>Connectors</span><ChevronRight className="attach-menu-check" size={18}/></button><button type="button" className="sheet-row" role="switch" aria-checked={p.memoryEnabled} disabled={p.temporary} onClick={p.onMemory}><Brain size={20}/><span>Memory</span><span className={`add-memory-switch ${p.memoryEnabled?'on':''}`} aria-hidden="true"/></button></div>
 <div className="attach-menu-group"><button type="button" className="sheet-row" onClick={()=>setTools(true)}><Wrench size={20}/><span>Tools</span><ChevronRight className="attach-menu-check" size={18}/></button><button type="button" className="sheet-row" onClick={pick(p.onRepo)}><FolderGit2 size={20}/><span>{p.repoName?'Open repository':'GitHub repository'}</span></button></div>
 </>:<>
 <div className="attach-menu-group"><button type="button" className="sheet-row" onClick={pick(p.onCanvas)}><Pencil size={18}/><span>Document canvas</span></button><button type="button" className="sheet-row" onClick={pick(p.onAnalysis)}><ChartNoAxesCombined size={18}/><span>Data analysis</span></button><button type="button" className="sheet-row compare-trigger" disabled={p.compareDisabled} onClick={pick(p.onCompare)}><Columns2 size={18}/><span>Compare models</span></button></div>
 <div className="attach-menu-group"><button type="button" className="sheet-row search-toggle" aria-pressed={p.searchEnabled} onClick={p.onSearch} title={p.searchAvailable?'Search with Gemini':'Web search uses Gemini models'}><Globe size={18}/><span>Web search</span>{p.searchEnabled&&<Check size={16} className="attach-menu-check"/>}</button><button type="button" className="sheet-row" onClick={pick(p.onPrivacy)}><ShieldCheck size={18}/><span>Privacy settings</span>{p.privacyEnabled&&<span className="attach-menu-meta">On</span>}</button></div>
 <div className="attach-menu-group"><button type="button" className="sheet-row" onClick={library('assistants')}><BookOpen size={18}/><span>Helpers &amp; prompts</span></button><button type="button" className="sheet-row" onClick={library('knowledge')}><BookOpen size={18}/><span>Knowledge</span></button><button type="button" className="sheet-row" onClick={library('tasks')}><Clock size={18}/><span>Tasks &amp; reminders</span></button><button type="button" className="sheet-row" onClick={library('tools')}><Wrench size={18}/><span>Free tools</span></button></div>
 </>}
 </div></div>;
}
