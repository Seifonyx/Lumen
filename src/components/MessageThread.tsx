import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { Chat, ChatSummary } from '../types';
import MessageItem from './MessageItem';
import { CompactingNote, CompactNote } from './CompactNote';

export default function MessageThread({chat,summary,busy,compacting,scroller,stick}: {chat:Chat;summary:ChatSummary|null;busy:boolean;compacting:boolean;scroller:RefObject<HTMLDivElement|null>;stick:RefObject<boolean>}) {
  const [full,setFull] = useState(false);
  const [pinned,setPinned] = useState<string[]>([]);
  const [focus,setFocus] = useState<string|null>(null);
  const messages = chat.messages;
  const messageData=useRef(messages);messageData.current=messages;
  const pinnedKeys=useMemo(()=>new Set([...pinned,...(focus?[focus]:[])]),[pinned,focus]);
  const enabled = messages.length > 120 && !full;
  const count = messages.length;
  const host=useRef<HTMLDivElement>(null);
  const [margin,setMargin]=useState(0);
  const virtual = useVirtualizer({ count, enabled, getScrollElement:()=>scroller.current,
    getItemKey:i=>messages[i].id, estimateSize:i=>Math.max(160,Math.min(1200,100+messages[i].text.length/2)),
    overscan:6,paddingStart:30,paddingEnd:44,gap:28,scrollMargin:margin,
    rangeExtractor:range=>[...new Set([...defaultRangeExtractor(range),...(pinnedKeys.size?messages.flatMap((m,i)=>pinnedKeys.has(m.id)?[i]:[]):[])])].filter(i=>i>=0&&i<count).sort((a,b)=>a-b),
  });
  const lastLength = messages.at(-1)?.text.length || 0;
  const lastThought = messages.at(-1)?.thinking?.length || 0;
  const wasEnabled = useRef(enabled);
  useLayoutEffect(()=>{
    const parent=scroller.current,el=host.current;if(!enabled||!parent||!el)return;
    const measure=()=>setMargin(el.getBoundingClientRect().top-parent.getBoundingClientRect().top+parent.scrollTop);
    measure();const observer=new ResizeObserver(measure);observer.observe(parent);observer.observe(el);return()=>observer.disconnect();
  },[enabled,scroller]);
  useLayoutEffect(()=>{
    if(enabled && stick.current) virtual.scrollToIndex(Math.max(0,count-1),{align:'end'});
    else if(wasEnabled.current !== enabled && stick.current && scroller.current)scroller.current.scrollTop=scroller.current.scrollHeight;
    wasEnabled.current=enabled;
  },[enabled,count,lastLength,lastThought,virtual,stick,scroller]);
  useEffect(()=>{
    if(!enabled)return;
    const select=()=>{
      const selection=window.getSelection();
      const index=(node:Node|null)=>{let el=node instanceof Element?node:node?.parentElement;while(el&&el.parentElement!==host.current)el=el.parentElement;const value=el instanceof HTMLElement?Number(el.dataset.messageIndex):-1;return Number.isInteger(value)&&value>=0&&value<count?value:-1};
      const a=index(selection?.anchorNode||null),b=index(selection?.focusNode||null);
      setPinned(selection && !selection.isCollapsed && a>=0 && b>=0 ? Array.from({length:Math.abs(b-a)+1},(_,i)=>messageData.current[Math.min(a,b)+i]?.id).filter((id):id is string=>Boolean(id)) : []);
    };
    const find=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f')setFull(true)};
    document.addEventListener('selectionchange',select);window.addEventListener('keydown',find);
    return()=>{document.removeEventListener('selectionchange',select);window.removeEventListener('keydown',find)};
  },[enabled,count]);
  const render=(index:number)=> <>
    <MessageItem message={messages[index]} isLast={index===count-1} busy={busy}/>
    {summary?.upTo===messages[index].id && <CompactNote chat={chat} summary={summary}/>}
  </>;
  return <>
    {count>120 && <div className="history-controls"><span className="muted small">{count.toLocaleString()} messages</span><button className="btn ghost small" aria-pressed={full} title="Show all messages for browser search and screen-reader reading" onClick={()=>setFull(!full)}>{full?'Use faster scrolling':'Show full conversation'}</button></div>}
    {summary?.upTo===null && <div className="thread-summary"><CompactNote chat={chat} summary={summary}/></div>}
    <div ref={host} className={`thread${enabled?' virtual-thread':''}`} role={count?'feed':'region'} aria-label="Conversation" aria-busy={busy} aria-live="off" style={enabled?{height:virtual.getTotalSize()}:undefined}>
      {(enabled?virtual.getVirtualItems().map(item=>({index:item.index,start:item.start})):messages.map((_,index)=>({index,start:0}))).map(({index,start})=><article key={messages[index].id} data-index={index} data-message-index={index} ref={enabled?virtual.measureElement:undefined} className="message-row" aria-label={`${messages[index].role==='user'?'You':'Assistant'}, message ${index+1}`} aria-posinset={index+1} aria-setsize={count}
        onFocusCapture={()=>setFocus(messages[index].id)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setFocus(null)}} style={enabled?{position:'absolute',top:start-margin,left:0,width:'100%'}:undefined}>
        {render(index)}
      </article>)}
    </div>
    {compacting && <CompactingNote/>}
  </>;
}
