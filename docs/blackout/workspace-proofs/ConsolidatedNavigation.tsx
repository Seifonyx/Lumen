// Preview navigation delegates to the same account-scoped conversations and app destinations.
import { BookOpen, Columns3, History, LayoutGrid, MessageSquare, Plus, Search, Settings2, Waypoints } from 'lucide-react';
import { useStore } from '../../../src/store';
export default function ConsolidatedNavigation({workspace,routing,active}:{workspace:()=>void;routing:()=>void;active:'workspace'|'routing'|null}){
 const chats=useStore(s=>s.chats);
 const recent=chats.filter(c=>!c.archived).toSorted((a,b)=>b.updatedAt-a.updatedAt).slice(0,4);
 const history=(search=false)=>{useStore.getState().setUi({sidebarOpen:true});if(search)requestAnimationFrame(()=>document.querySelector<HTMLInputElement>('.sidebar input[aria-label="Search chats"]')?.focus());};
 const destination=(page:'projects'|'collection'|'tools')=>{workspace();useStore.getState().setUi({page});};
 return <nav className="proof-navigation proof-unified-navigation" aria-label="Lumen workspaces">
  <button type="button" className="proof-wordmark" aria-label="Lumen workspace" onClick={workspace}>Lumen<span className="proof-wordmark-edition">WORKSPACE</span></button>
  <button type="button" className="proof-new-primary" onClick={()=>{workspace();useStore.getState().newChat();}}><Plus size={18}/>New conversation</button>
  <button type="button" onClick={()=>history(true)}><Search size={18}/>Search conversations</button>
  <button type="button" aria-current={active==='workspace'?'page':undefined} onClick={workspace}><MessageSquare size={18}/>Workspace</button>
  <button type="button" onClick={()=>history()}><History size={18}/>Conversations</button>
  <button type="button" onClick={()=>destination('projects')}><Columns3 size={18}/>Projects</button>
  <button type="button" aria-current={active==='routing'?'page':undefined} onClick={routing}><Waypoints size={18}/>Routing Center</button>
  <div className="proof-recent-heading">Recent conversations</div>
  <div className="proof-recent-list">{recent.map(chat=><button type="button" key={chat.id} aria-label={`Open recent: ${chat.title||'New conversation'}`} onClick={()=>{workspace();useStore.getState().selectChat(chat.id);}}>{chat.title||'New conversation'}</button>)}</div>
  <button type="button" onClick={()=>destination('collection')}><BookOpen size={18}/>Library</button>
  <button type="button" onClick={()=>destination('tools')}><LayoutGrid size={18}/>Tools & Study</button>
  <button type="button" className="proof-nav-settings" onClick={()=>useStore.getState().setUi({settingsOpen:true,settingsTab:'general',sidebarOpen:false})}><Settings2 size={18}/>Settings</button>
  <span className="proof-fixture-note">Local preview · synthetic account</span>
 </nav>;
}
