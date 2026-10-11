import { useState } from 'react';
import { Bell, Clock, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { modelLabel, useStore } from '../store';
import { MAX_TASKS, normalizeTask, scheduleLabel } from '../lib/tasks';
import { AUTO } from '../lib/routing';
import { uid } from '../lib/util';
import { scan, type Finding } from '../lib/privacy';
import PrivacyCheck from './PrivacyCheck';
import type { ScheduledTask } from '../types';

const localDateTime=(at:number)=>new Date(at-new Date(at).getTimezoneOffset()*60_000).toISOString().slice(0,16);
export default function TaskLibrary({ onClose }: { onClose:()=>void }) {
  const tasks=useStore(state=>state.tasks),ready=useStore(state=>state.tasksReady);
  const settings=useStore(state=>state.settings),catalog=useStore(state=>state.catalog),chats=useStore(state=>state.chats);
  const busy=useStore(state=>Boolean(state.runningTaskId || state.streamingChatId || state.compactingChatId || state.comparing || state.canvasEditingChatId));
  const [editing,setEditing]=useState<ScheduledTask|null>(null),[error,setError]=useState(''),[saving,setSaving]=useState(false);
  const [check,setCheck]=useState<{task:ScheduledTask;findings:Finding[];reviewKey:string}|null>(null);
  const zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
  const newTask=()=>{const now=Date.now();setError('');setEditing({id:uid(),name:'',prompt:'',kind:'reminder',model:AUTO,search:false,enabled:true,schedule:{kind:'once',at:now+5*60_000},createdAt:now,updatedAt:now});};
  const save=async()=>{
    const task=normalizeTask(editing);if(!task){setError('Check the task name, request and time.');return;}
    setSaving(true);setError('');
    try {await useStore.getState().saveTask(task);setEditing(null);}catch(e){setError((e as Error).message);}finally{setSaving(false);}
  };
  const run=(task:ScheduledTask)=>{
    const state=useStore.getState();
    const findings=scan([task.prompt,state.settings.customInstructions,state.settings.memory ? state.memories.map(item=>item.text).join('\n') : ''].join('\n'));
    if(task.kind==='assistant' && state.settings.privacyShield && state.settings.privacyMode==='ask' && findings.length){setCheck({task,findings,reviewKey:state.taskReviewKey(task)});return;}
    void state.runTask(task.id,{manual:true});
  };
  const toggle=async(task:ScheduledTask)=>{try{await useStore.getState().saveTask({...task,enabled:!task.enabled});}catch(e){useStore.getState().toast((e as Error).message,'error');}};
  const remove=async(task:ScheduledTask)=>{if(!confirm('Delete this schedule? Existing result chats will stay.'))return;try{await useStore.getState().deleteTask(task.id);}catch(e){useStore.getState().toast((e as Error).message,'error');}};
  return <div className="task-library">
    <p className="muted small">Tasks run only while this app is open, visible and online. Reminders use no AI messages. AI tasks use your current privacy settings and one message per model attempt; they stop after five minutes. Missed daily tasks catch up once.</p>
    {editing ? <form className="task-editor" onSubmit={event=>{event.preventDefault();void save();}}>
      <h3>{tasks.some(task=>task.id===editing.id)?'Edit task':'New task'}</h3>
      <label className="field-block"><span className="setting-label">Name</span><input aria-label="Task name" required maxLength={60} value={editing.name} onChange={event=>setEditing({...editing,name:event.target.value})} placeholder="Morning headlines" /></label>
      <label className="field-block"><span className="setting-label">Action</span><select aria-label="Task action" value={editing.kind} onChange={event=>setEditing({...editing,kind:event.target.value as ScheduledTask['kind'],enabled:event.target.value==='reminder',search:false})}><option value="reminder">Remind me</option><option value="assistant">Ask AI</option></select></label>
      <label className="field-block"><span className="setting-label">{editing.kind==='reminder'?'Reminder text':'AI request'}</span><textarea aria-label="Task request" required rows={5} maxLength={8000} value={editing.prompt} onChange={event=>setEditing({...editing,prompt:event.target.value})} placeholder={editing.kind==='reminder'?'What should you remember?':'For example: summarize today’s WHO headlines, with source links.'} /></label>
      {editing.kind==='assistant' && <>
        <label className="field-block"><span className="setting-label">Model</span><select aria-label="Task model" value={editing.model} onChange={event=>setEditing({...editing,model:event.target.value})}><option value={AUTO}>Auto · choose for the task</option>{settings.enabledModels.filter(id=>id!==AUTO).map(id=><option key={id} value={id}>{modelLabel(catalog,id)}</option>)}{editing.model!==AUTO && !settings.enabledModels.includes(editing.model) && <option value={editing.model}>Unavailable · uses your enabled models</option>}</select></label>
        <label className="task-toggle"><input type="checkbox" checked={editing.search} onChange={event=>setEditing({...editing,search:event.target.checked})} />Search the web · requires Gemini</label>
      </>}
      <label className="field-block"><span className="setting-label">Schedule</span><select aria-label="Task schedule" value={editing.schedule.kind} onChange={event=>setEditing({...editing,schedule:event.target.value==='once'?{kind:'once',at:Date.now()+5*60_000}:{kind:'daily',time:'09:00',timeZone:zone}})}><option value="once">Once</option><option value="daily">Every day</option></select></label>
      {editing.schedule.kind==='once' ? <label className="field-block"><span className="setting-label">When · this device’s time zone</span><input type="datetime-local" aria-label="Task date and time" required value={Number.isFinite(editing.schedule.at)?localDateTime(editing.schedule.at):''} onChange={event=>setEditing({...editing,schedule:{kind:'once',at:new Date(event.target.value).getTime()}})} /></label> : <div className="task-schedule-grid">
        <label className="field-block"><span className="setting-label">Time</span><input type="time" aria-label="Daily task time" required value={editing.schedule.time} onChange={event=>setEditing({...editing,schedule:{...(editing.schedule as {kind:'daily';time:string;timeZone:string}),time:event.target.value}})} /></label>
        <label className="field-block"><span className="setting-label">Time zone</span><select aria-label="Daily task time zone" value={editing.schedule.timeZone} onChange={event=>setEditing({...editing,schedule:{...(editing.schedule as {kind:'daily';time:string;timeZone:string}),timeZone:event.target.value}})}>{[...new Set([zone,editing.schedule.timeZone,'UTC','Africa/Cairo','Europe/London','Europe/Paris','America/New_York','America/Los_Angeles','Asia/Dubai','Asia/Tokyo','Australia/Sydney'])].map(value=><option key={value} value={value}>{value.replaceAll('_',' ')}</option>)}</select></label>
      </div>}
      <label className="task-toggle"><input type="checkbox" checked={editing.enabled} onChange={event=>setEditing({...editing,enabled:event.target.checked})} />{editing.kind==='assistant'?'Run automatically while the app is open':'Enable reminder'}</label>
      {editing.kind==='assistant' && <p className="muted small">Automatic AI runs are off until you enable them. “Ask me” privacy mode pauses requests containing personal details for review. Results are saved in their own chats; your current draft stays in place.</p>}
      {error && <p className="free-tool-error" role="alert">{error}</p>}
      <div className="library-form-actions"><button type="button" className="btn" disabled={saving} onClick={()=>{setEditing(null);setError('');}}>Back</button><button type="submit" className="btn primary" disabled={saving}>{saving?'Saving…':'Save task'}</button></div>
    </form> : <>
      <div className="task-toolbar"><span className="muted small">{tasks.length} / {MAX_TASKS} saved{!ready?' · loading schedules…':''}</span><button className="btn" disabled={tasks.length>=MAX_TASKS} onClick={newTask}><Plus size={16} />New task</button></div>
      <div className="library-grid">{tasks.map(task=><article className="library-card task-card" key={task.id}>
        <div className="library-card-heading"><span className="library-card-icon">{task.kind==='reminder'?<Bell size={18}/>:<Clock size={18}/>}</span><span className="muted small">{task.enabled?'Enabled':'Paused'} · {task.kind==='reminder'?'Reminder':'AI'}</span></div>
        <h3>{task.name}</h3><p>{task.prompt}</p><span className="task-schedule muted small" dir="auto">{scheduleLabel(task)}</span>
        {task.lastRun && <div className="task-last-run" role="status"><strong>{({running:'Running',done:'Finished',error:'Needs attention',review:'Needs privacy review',interrupted:'Interrupted'} as const)[task.lastRun.status]}</strong><span className="muted small">{new Date(task.lastRun.at).toLocaleString()}</span>{task.lastRun.error && <span className="muted small">{task.lastRun.error}</span>}{task.lastRun.chatId && <button className="btn small" disabled={!chats.some(chat=>chat.id===task.lastRun?.chatId)} onClick={()=>{useStore.getState().selectChat(task.lastRun!.chatId!);onClose();}}>Open result</button>}</div>}
        <div className="task-card-actions"><button className="btn small" disabled={busy || !ready || task.lastRun?.status==='running'} onClick={()=>run(task)}><Play size={13}/>{task.lastRun?.status==='review'?'Review & run':'Run now'}</button><button className="btn small" onClick={()=>void toggle(task)}>{task.enabled?'Pause':'Enable'}</button><span className="spacer"/><button className="icon-btn sm" aria-label={`Edit task ${task.name}`} onClick={()=>{setEditing({...task});setError('');}}><Pencil size={15}/></button><button className="icon-btn sm" aria-label={`Delete task ${task.name}`} onClick={()=>void remove(task)}><Trash2 size={15}/></button></div>
      </article>)}</div>
      {!tasks.length && <div className="library-empty"><Clock size={24}/><h3>A little help when you open the app</h3><p className="muted small">Save a reminder or an AI request for a one-off time or a daily routine.</p></div>}
    </>}
    {check && <PrivacyCheck findings={check.findings} unchecked={0} onEdit={()=>{setEditing(check.task);setCheck(null);}} onMask={()=>{void useStore.getState().runTask(check.task.id,{manual:true,privacy:'masked',reviewKey:check.reviewKey});setCheck(null);}} onAsIs={()=>{void useStore.getState().runTask(check.task.id,{manual:true,privacy:'asIs',reviewKey:check.reviewKey});setCheck(null);}} />}
  </div>;
}
