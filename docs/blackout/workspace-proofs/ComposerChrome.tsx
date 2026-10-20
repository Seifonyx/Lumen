// Shared proof-only presentation; the real Composer remains the sole draft/tool/send owner.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, Expand, Globe, Layers3, Paperclip, Plus, X } from 'lucide-react';
import { modelInfo, useStore } from '../../../src/store';
import { toolModel } from '../../../src/lib/ai/tool-inputs.js';

export function useComposerPresentation(form:Element|undefined, scope:string|undefined){
 const [draft,setDraft]=useState(''),[research,setResearch]=useState(false),[files,setFiles]=useState(0);
 const [expanded,setExpanded]=useState(false);
 const selection=useRef({start:0,end:0,direction:'none' as 'none'|'forward'|'backward',scroll:0});
 const changed=useRef(false);
 useLayoutEffect(()=>{setExpanded(false);},[scope]);
 useEffect(()=>{
  const input=form?.querySelector('textarea');if(!input)return;
  const read=()=>{setDraft(input.value);setResearch(Boolean(form?.querySelector('.research-chip')));setFiles(form?.querySelectorAll('.attachment:not(.attachment-exit)').length||0);};
  const remember=()=>{selection.current={start:input.selectionStart,end:input.selectionEnd,direction:input.selectionDirection,scroll:input.scrollTop};};
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&document.activeElement===input&&!Array.from(document.querySelectorAll<HTMLElement>('[role=dialog],dialog[open]')).some(node=>!node.closest('[aria-hidden=true],[hidden],[inert]')&&node.getClientRects().length>0)){changed.current=true;setExpanded(false);}};
  const observer=new MutationObserver(read);observer.observe(form!,{childList:true,subtree:true});
  input.addEventListener('input',read);input.addEventListener('select',remember);input.addEventListener('blur',remember);input.addEventListener('keydown',escape);read();
  return()=>{observer.disconnect();input.removeEventListener('input',read);input.removeEventListener('select',remember);input.removeEventListener('blur',remember);input.removeEventListener('keydown',escape);};
 },[form,scope]);
 useLayoutEffect(()=>{
  document.documentElement.toggleAttribute('data-proof-expanded',expanded);
  if(!changed.current)return;changed.current=false;
  const input=form?.querySelector('textarea');if(!input)return;
  const saved=selection.current;input.focus({preventScroll:true});input.setSelectionRange(saved.start,saved.end,saved.direction);input.scrollTop=saved.scroll;
 },[expanded,form]);
 const toggle=()=>{changed.current=true;setExpanded(x=>!x);};
 return {draft,research,files,expanded,toggle};
}
export function ComposerContext({form,model,research,files,expanded,onExpand}:{form:Element;model:string;research:boolean;files:number;expanded:boolean;onExpand:()=>void}){
 const search=useStore(s=>s.settings.webSearch),catalog=useStore(s=>s.catalog),enabled=useStore(s=>s.settings.enabledModels);
 const supportsSearch=!modelInfo(catalog,model)||Boolean(modelInfo(catalog,model)?.search);
 const supportsResearch=enabled.some(toolModel);
 return <div className="proof-context-toolbar" role="group" aria-label="Message context">
  <button type="button" aria-label="Attach a file" title={files?`${files} attached file${files===1?'':'s'}`:'Attach files or images'} onClick={()=>form.querySelector<HTMLInputElement>('.composer-bar input[type=file]:last-of-type')?.click()}><Paperclip size={16}/><span>Attach</span>{files>0&&<b className="proof-file-count">{files}</b>}</button>
  <button type="button" aria-label="Search" aria-pressed={Boolean(search&&supportsSearch)} disabled={!supportsSearch} title={supportsSearch?'Use web search when sending':'This manual model does not support web search'} onClick={()=>useStore.getState().updateSettings({webSearch:!search})}><Globe size={16}/><span>Search</span>{search&&supportsSearch&&<Check size={12}/>}</button>
  <button type="button" aria-label="Research" aria-pressed={research} disabled={!supportsResearch} title={supportsResearch?'Deep research uses enabled Gemini models':'Enable a Gemini model to use deep research'} onClick={()=>{if(research)form.querySelector<HTMLButtonElement>('[aria-label="Turn off deep research"]')?.click();else window.dispatchEvent(new CustomEvent('mr:composer-mode',{detail:'research'}));}}><Layers3 size={16}/><span>Research</span>{research&&<Check size={12}/>}</button>
  <button type="button" aria-label="Add context" aria-haspopup="dialog" title="Files, project, repository and tools" onClick={()=>window.dispatchEvent(new CustomEvent('mr:composer-mode',{detail:'attach'}))}><Plus size={16}/><span>Context</span></button>
  <button type="button" className="proof-expand" aria-label={expanded?'Collapse input':'Expand input'} aria-expanded={expanded} aria-controls="message-input" title={expanded?'Return to conversation (Esc in editor)':'Open writing mode'} onClick={onExpand}>{expanded?<X size={17}/>:<Expand size={17}/>}</button>
 </div>;
}
