import { useLayoutEffect, useRef, type RefObject } from 'react';

const scopes: HTMLElement[] = [];
const saved = new Map<HTMLElement,boolean>();
const focusable = (root:HTMLElement) => [...root.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')].filter(el=>el.tabIndex>=0 && el.getClientRects().length>0 && !el.closest('[inert]'));
function isolate() {
  for(const [el,value] of saved)el.inert=el.classList.contains('sidebar')?window.matchMedia('(max-width:899px)').matches&&!el.classList.contains('open'):value;
  saved.clear();
  let branch=scopes.at(-1);
  while(branch?.parentElement && branch!==document.body) {
    // A scope marked data-keep-sidebar (Settings on computers) leaves the sidebar usable.
    const keepSidebar=Boolean(scopes.at(-1)?.dataset.keepSidebar)&&!window.matchMedia('(max-width:899px)').matches;
    for(const sibling of branch.parentElement.children)if(sibling!==branch && sibling instanceof HTMLElement && !sibling.matches('.toasts,[aria-live],.mp-scrim,.sheet-backdrop,.scrim,.haptic-switch') && !(keepSidebar&&sibling.classList.contains('sidebar'))) {
      saved.set(sibling,sibling.inert);sibling.inert=true;
    }
    branch=branch.parentElement;
  }
}
// Making the background inert restyles the whole app (tens of milliseconds on a phone with a long chat
// open), so on open it happens right after the sheet or dialog has painted: it appears at once and its
// slide/fade (compositor-driven) doesn't wait. The backdrop covers the background meanwhile, so nothing
// behind can be tapped. Closing undoes it immediately, so focus can return to where it was.
let pending = 0;
const after: (() => void)[] = [];
function scheduleIsolate(then?: () => void) {
  if (then) after.push(then);
  if (pending) return;
  pending = requestAnimationFrame(() => {
    setTimeout(() => {
      pending = 0;
      isolate();
      after.splice(0).forEach((fn) => fn());
    }, 0);
  });
}

/** Nested dialogs own focus and hide their background from assistive technology. */
export function useFocusScope(ref:RefObject<HTMLElement|null>,active:boolean,onEscape:()=>void) {
  const close=useRef(onEscape);close.current=onEscape;
  useLayoutEffect(()=>{
    const root=ref.current;if(!active||!root)return;
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    scopes.push(root);scheduleIsolate();
    if(!root.contains(document.activeElement))root.focus({preventScroll:true});
    const key=(event:KeyboardEvent)=>{
      if(scopes.at(-1)!==root)return;
      // The existing select enhancement is a body portal with its own keyboard
      // owner. Its Escape/Tab must settle before the containing dialog handles them.
      if(event.target instanceof Element && event.target.closest('.glass-select-menu'))return;
      if(event.key==='Escape'){
        if(event.target instanceof Element && event.target.closest('[role="menu"]'))return;
        if(event.target instanceof Element && event.target.closest('[data-local-escape]'))return;
        if(root.querySelector('.cm-tooltip-autocomplete'))return;
        event.preventDefault();event.stopImmediatePropagation();close.current();return;
      }
      if(event.key!=='Tab')return;
      const list=focusable(root),first=list[0],last=list.at(-1);
      if(!first){event.preventDefault();root.focus();return}
      if(event.shiftKey && (document.activeElement===first||document.activeElement===root)){event.preventDefault();last?.focus()}
      else if(!event.shiftKey && (document.activeElement===last||!root.contains(document.activeElement))){event.preventDefault();first.focus()}
    };
    document.addEventListener('keydown',key,true);
    return()=>{
      // Closing makes the background usable again straight away, so focus returns to where it was at once.
      document.removeEventListener('keydown',key,true);scopes.splice(scopes.indexOf(root),1);
      if(pending){cancelAnimationFrame(pending);pending=0;after.splice(0).forEach(fn=>fn());}
      isolate();
      if(previous?.isConnected && !previous.closest('[inert]') && !(window.matchMedia('(pointer:coarse)').matches && previous.matches('input,textarea')))previous.focus({preventScroll:true});
    };
  },[active,ref]);
}
