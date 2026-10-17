import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import { startTransition, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { Chat, ChatSummary } from '../types';
import MessageItem from './MessageItem';
import { useStore } from '../store';
import { CompactingNote, CompactNote } from './CompactNote';
import { createPortal } from 'react-dom';
import MessageNavigation from './MessageNavigation';
import { messageStops, stopAtIndex } from '../lib/message-navigation';
import { useReplyEntrance } from '../lib/motion';

const FIRST_PAINT = 6;
export const navigatorDefault = () => !(window.matchMedia('(pointer: coarse)').matches && window.matchMedia('(max-width: 899px)').matches);
const BATCH = 12;

export default function MessageThread({chat,summary,busy,compacting,scroller,stick,navigationHost}: {chat:Chat;summary:ChatSummary|null;busy:boolean;compacting:boolean;scroller:RefObject<HTMLDivElement|null>;stick:RefObject<boolean>;navigationHost:RefObject<HTMLDivElement|null>}) {
  const [full,setFull] = useState(false);
  const [pinned,setPinned] = useState<string[]>([]);
  const [focus,setFocus] = useState<string|null>(null);
  const [jumpTarget,setJumpTarget] = useState<string|null>(null);
  const [lastJump,setLastJump] = useState<string|null>(null);
  const [jumpKeyboard,setJumpKeyboard] = useState(false);
  const [activeStop,setActiveStop] = useState<string|null>(null);
  const [announcement,setAnnouncement] = useState('');
  const [navigationRoot,setNavigationRoot] = useState<HTMLDivElement|null>(null);
  const [bounds,setBounds] = useState({width:0,height:0});
  const messages = chat.messages;
  // The lines on the right that jump between your messages: Settings → General; by default on computers only.
  const showNavigator = useStore((s) => s.settings.messageNavigator ?? navigatorDefault());
  const messageData=useRef(messages);messageData.current=messages;
  const stops=useMemo(()=>messageStops(messages),[messages]);
  const pinnedKeys=useMemo(()=>new Set([...pinned,...(focus?[focus]:[]),...(jumpTarget?[jumpTarget]:[])]),[pinned,focus,jumpTarget]);
  const enabled = messages.length > 120 && !full;
  const count = messages.length;
  // Opening a chat shows the newest messages first and adds older ones a few at a time in the background,
  // so the chat appears at once and taps stay responsive (the view stays pinned to the latest message).
  const [from,setFrom] = useState(()=>enabled?0:Math.max(0,count-FIRST_PAINT));
  const start = enabled ? 0 : Math.min(from,count);
  // Older messages added above stay out of view: keep the latest in place before the browser paints.
  useLayoutEffect(()=>{const el=scroller.current;if(el&&stick.current)el.scrollTop=el.scrollHeight},[start,scroller,stick]);
  const firstStart=useRef(start);
  useEffect(()=>{
    if(start===0)return;
    let timer=0;const frame=requestAnimationFrame(()=>{timer=window.setTimeout(()=>startTransition(()=>setFrom(f=>Math.max(0,f-BATCH))),0)});
    return()=>{cancelAnimationFrame(frame);clearTimeout(timer)};
  },[start]);
  const host=useRef<HTMLDivElement>(null);
  useReplyEntrance(host, messages.map(message => message.id));
  const [margin,setMargin]=useState(0);
  const virtual = useVirtualizer({ count, enabled, getScrollElement:()=>scroller.current,
    // Measuring a row can change the thread height; defer that work out of
    // ResizeObserver delivery to avoid feedback-loop errors in WebKit.
    useAnimationFrameWithResizeObserver:true,
    getItemKey:i=>messages[i].id, estimateSize:i=>Math.max(160,Math.min(1200,100+messages[i].text.length/2)),
    overscan:6,paddingStart:30,paddingEnd:44,gap:28,scrollMargin:margin,
    rangeExtractor:range=>[...new Set([...defaultRangeExtractor(range),...(pinnedKeys.size?messages.flatMap((m,i)=>pinnedKeys.has(m.id)?[i]:[]):[])])].filter(i=>i>=0&&i<count).sort((a,b)=>a-b),
  });
  const lastLength = messages.at(-1)?.text.length || 0;
  const lastThought = messages.at(-1)?.thinking?.length || 0;
  useLayoutEffect(()=>{setNavigationRoot(navigationHost.current)},[navigationHost]);
  useEffect(()=>{
    const parent=scroller.current;if(!parent)return;
    let frame=0;
    const update=()=>{
      frame=0;
      const threshold=parent.scrollTop+Math.min(80,parent.clientHeight*.2);
      let index=0;
      if(enabled){
        const items=virtual.getVirtualItems();
        const visible=items.find(item=>item.start<=threshold&&item.end>=threshold) || items.find(item=>item.end>=threshold);
        index=visible?.index ?? count-1;
      }else{
        const top=parent.getBoundingClientRect().top;
        const rows=host.current?.querySelectorAll<HTMLElement>('[data-message-index]') || [];
        for(const row of rows){if(row.getBoundingClientRect().top-top<=Math.min(80,parent.clientHeight*.2))index=Number(row.dataset.messageIndex);else break}
      }
      setActiveStop(stopAtIndex(stops,index));
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(update)};
    const measure=()=>{setBounds({width:parent.clientWidth,height:parent.clientHeight});schedule()};
    measure();const observer=new ResizeObserver(measure);observer.observe(parent);
    parent.addEventListener('scroll',schedule,{passive:true});
    return()=>{observer.disconnect();parent.removeEventListener('scroll',schedule);cancelAnimationFrame(frame)};
  },[scroller,enabled,count,stops,virtual]);
  useLayoutEffect(()=>{
    if(!jumpTarget)return;
    if(start>0){setFrom(0);return}
    const index=messages.findIndex(message=>message.id===jumpTarget);
    const parent=scroller.current;
    if(index<0||!parent){setJumpTarget(null);return}
    stick.current=false;
    if(enabled)virtual.scrollToIndex(index,{align:'start',behavior:'auto'});
    let frame=0,attempt=0,stable=0;
    const settle=()=>{
      const row=[...(host.current?.querySelectorAll<HTMLElement>('[data-message-id]')||[])].find(el=>el.dataset.messageId===jumpTarget);
      if(row){
        const target=Math.max(0,Math.min(parent.scrollHeight-parent.clientHeight,parent.scrollTop+row.getBoundingClientRect().top-parent.getBoundingClientRect().top-12));
        const delta=Math.abs(parent.scrollTop-target);
        // The DOM target already includes measured height changes. An absolute
        // virtualizer command discards deferred iOS size compensation so it cannot
        // replay the same change after landing. Our loop owns the final alignment.
        if(enabled){virtual.scrollToOffset(target,{behavior:'auto'});virtual.cancelScroll()}
        else parent.scrollTop=target;
        stable=delta<2?stable+1:0;
        if(stable>=2||attempt>=11){
          row.focus({preventScroll:true});setLastJump(jumpTarget);setActiveStop(jumpTarget);
          setAnnouncement(`Jumped to sent message ${stops.find(stop=>stop.id===jumpTarget)?.ordinal || ''}.`);
          setJumpTarget(null);return;
        }
      }
      if(attempt++<12)frame=requestAnimationFrame(settle);else setJumpTarget(null);
    };
    frame=requestAnimationFrame(settle);
    return()=>cancelAnimationFrame(frame);
  },[jumpTarget,enabled,scroller,stick,virtual,messages,stops,start]);
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
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
    {navigationRoot && showNavigator && stops.length>1 && createPortal(<MessageNavigation stops={stops} activeId={activeStop} height={bounds.height} onJump={(id,keyboard)=>{stick.current=false;setJumpKeyboard(keyboard);setJumpTarget(id)}}/>,navigationRoot)}
    {count>120 && <div className="history-controls"><span className="muted small">{count.toLocaleString()} messages</span><button className="btn ghost small" aria-pressed={full} title="Show all messages for browser search and screen-reader reading" onClick={()=>setFull(!full)}>{full?'Use faster scrolling':'Show full conversation'}</button></div>}
    {summary?.upTo===null && <div className="thread-summary"><CompactNote chat={chat} summary={summary}/></div>}
    <div ref={host} className={`thread${enabled?' virtual-thread':''}`} role={count?'feed':'region'} aria-label="Conversation" aria-busy={busy} aria-live="off" style={enabled?{height:virtual.getTotalSize()}:undefined}>
      {(enabled?virtual.getVirtualItems().map(item=>({index:item.index,start:item.start})):messages.slice(start).map((_,k)=>({index:start+k,start:0}))).map(({index,start})=><article key={messages[index].id} data-index={index} data-message-index={index} data-message-id={messages[index].id} data-jump-keyboard={lastJump===messages[index].id && jumpKeyboard || undefined} tabIndex={-1} ref={enabled?virtual.measureElement:undefined} className={`message-row${lastJump===messages[index].id?' message-jump-target':''}${index<firstStart.current?' backfill':''}`} aria-label={`${messages[index].role==='user'?'You':'Assistant'}, message ${index+1}`} aria-posinset={index+1} aria-setsize={count}
        onFocusCapture={()=>setFocus(messages[index].id)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setFocus(null)}} style={enabled?{position:'absolute',top:start-margin,left:0,width:'100%'}:undefined}>
        {render(index)}
      </article>)}
    </div>
    {compacting && <CompactingNote/>}
  </>;
}
