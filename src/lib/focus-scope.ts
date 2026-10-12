import { useLayoutEffect, useRef, type RefObject } from 'react';

const scopes: HTMLElement[] = [];
const saved = new Map<HTMLElement,boolean>();
const focusable = (root:HTMLElement) => [...root.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')].filter(el=>el.tabIndex>=0 && el.getClientRects().length>0 && !el.closest('[inert]'));
function isolate() {
  for(const [el,value] of saved)el.inert=el.classList.contains('sidebar')?window.matchMedia('(max-width:899px)').matches&&!el.classList.contains('open'):value;
  saved.clear();
  let branch=scopes.at(-1);
  while(branch?.parentElement && branch!==document.body) {
    for(const sibling of branch.parentElement.children)if(sibling!==branch && sibling instanceof HTMLElement && !sibling.matches('.toasts,[aria-live],.mp-scrim,.sheet-backdrop')) {
      saved.set(sibling,sibling.inert);sibling.inert=true;
    }
    branch=branch.parentElement;
  }
}
/** Nested dialogs own focus and hide their background from assistive technology. */
export function useFocusScope(ref:RefObject<HTMLElement|null>,active:boolean,onEscape:()=>void) {
  const close=useRef(onEscape);close.current=onEscape;
  useLayoutEffect(()=>{
    const root=ref.current;if(!active||!root)return;
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    scopes.push(root);isolate();
    if(!root.contains(document.activeElement))root.focus({preventScroll:true});
    const key=(event:KeyboardEvent)=>{
      if(scopes.at(-1)!==root)return;
      if(event.key==='Escape'){
        if(event.target instanceof Element && event.target.closest('[role="menu"]'))return;
        if(event.target instanceof Element && event.target.matches('[data-local-escape]'))return;
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
      document.removeEventListener('keydown',key,true);scopes.splice(scopes.indexOf(root),1);isolate();
      if(previous?.isConnected && !previous.closest('[inert]') && !(window.matchMedia('(pointer:coarse)').matches && previous.matches('input,textarea')))previous.focus({preventScroll:true});
    };
  },[active,ref]);
}
