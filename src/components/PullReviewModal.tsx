import { useEffect, useRef, useState } from 'react';
import { ExternalLink, GitPullRequest, Loader2 } from 'lucide-react';
import type { Chat } from '../types';
import { loadPullReview, reviewDraft, type PullReview } from '../lib/pull-review';
import { useStore } from '../store';
import { prepareTool } from './Composer';
import Modal from './Modal';

export default function PullReviewModal({chat,onClose}:{chat:Chat;onClose:()=>void}) {
  const [input,setInput]=useState(''),[review,setReview]=useState<PullReview|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  const controller=useRef<AbortController|null>(null);
  const owner=useStore(state=>state.user?.uid);
  const busy=useStore(state=>Boolean(state.streamingChatId || state.compactingChatId || state.comparing || state.canvasEditingChatId || state.runningTaskId));
  useEffect(()=>()=>{controller.current?.abort();controller.current=null;},[]);
  const load=async()=>{
    controller.current?.abort();const job=new AbortController();controller.current=job;
    setLoading(true);setError('');setReview(null);
    const timer=setTimeout(()=>job.abort(),30_000);
    try{const value=await loadPullReview(chat.repo!,input,job.signal);if(controller.current===job && !job.signal.aborted)setReview(value);}
    catch(e){if(controller.current===job)setError(job.signal.aborted?'Loading stopped. Try again when ready.':(e as Error).message);}
    finally{clearTimeout(timer);if(controller.current===job)setLoading(false);}
  };
  const prepare=()=>{
    const state=useStore.getState(),current=state.chats.find(item=>item.id===chat.id);
    if(!review || state.user?.uid!==owner || state.currentId!==chat.id || current?.repo?.owner!==chat.repo?.owner || current?.repo?.repo!==chat.repo?.repo || current?.repo?.branch!==chat.repo?.branch)return;
    const draft=reviewDraft(review);prepareTool(draft.prompt,[draft.file]);state.setUi({workspaceOpen:false});onClose();
  };
  return <Modal title="Review a pull request" onClose={onClose} wide>
    <div className="pull-review pad">
      <p className="muted small">Load changes from {chat.repo?.owner}/{chat.repo?.repo}, inspect the snapshot, then add a review request to your draft. Sending uses your chosen model and normal privacy checks. Reviews use diff context; tests are not executed.</p>
      <form className="pull-review-load" onSubmit={event=>{event.preventDefault();void load();}}>
        <label className="field-block"><span className="setting-label">Pull request</span><input aria-label="Pull request number or link" placeholder="#42 or a GitHub pull-request link" value={input} disabled={loading} onChange={event=>{setInput(event.target.value);setReview(null);setError('');}} /></label>
        <button className="btn" disabled={loading || !input.trim()}>{loading?<Loader2 size={15} className="spin"/>:<GitPullRequest size={15}/>} {loading?'Loading…':'Load changes'}</button>
        {loading && <button className="btn ghost" type="button" onClick={()=>controller.current?.abort()}>Cancel loading</button>}
      </form>
      {error && <p className="free-tool-error" role="alert">{error}</p>}
      {review && <>
        <section className="pull-review-summary"><h3>#{review.number} · {review.title}</h3><p className="muted small" dir="auto">{review.head} → {review.base}</p><p className="muted small">{review.files.length} / {review.total} changed files · snapshot {review.sha.slice(0,8)}</p><a href={review.url} target="_blank" rel="noopener noreferrer">Open on GitHub <ExternalLink size={12}/></a></section>
        {review.warnings.length>0 && <div className="pull-review-coverage" role="status">{review.warnings.map(warning=><p key={warning}>{warning}</p>)}</div>}
        <div className="pull-review-files">{review.files.map((file,index)=><details key={`${file.path}:${index}`}><summary><span>{file.path}</span><small>{file.status} · +{file.added} / −{file.removed}</small></summary>{file.previous && <p className="muted small">Renamed from {file.previous}</p>}{file.patch?<pre dir="ltr"><code>{file.patch}</code></pre>:<p className="muted small">No textual patch available.</p>}{file.omitted && <p className="muted small">This file’s review context is incomplete.</p>}</details>)}</div>
        <div className="library-form-actions"><button className="btn primary" disabled={busy || !review.files.some(file=>file.patch)} onClick={prepare}>Add review to draft</button></div>
      </>}
    </div>
  </Modal>;
}
