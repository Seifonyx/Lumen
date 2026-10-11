import { Check, ListChecks } from 'lucide-react';
import { useStore } from '../store';
import { parsePlan, planBaseline, planRepo } from '../lib/coding-plan';
import type { Message } from '../types';
import { prepareTool } from './Composer';

export default function CodingPlanCard({ message }: { message: Message }) {
  const chat = useStore(s => s.chats.find(c => c.id === s.currentId));
  const busy = useStore(s => Boolean(s.streamingChatId || s.compactingChatId || s.comparing || s.canvasEditingChatId));
  const decide = useStore(s => s.decidePlan);
  const p = chat?.codingPlan;
  if (!chat || !p || p.messageId !== message.id) {
    const steps = message.coding?.phase === 'plan' && message.status === 'done' ? parsePlan(message.text) : null;
    return steps ? <section className="coding-plan" aria-label="Saved coding plan"><header><ListChecks size={18} /><h3>Coding plan</h3><span>Saved proposal</span></header><ol>{steps.map((step,i) => <li key={i}><span className="plan-step-number">{i+1}</span><div><p>{step.title}</p><div className="plan-files">{step.files.map(file => <code key={file}>{file}</code>)}</div></div></li>)}</ol><p className="plan-note">This is an earlier proposal or a plan from another device. Enable Plan and send a request for a fresh plan in this workspace.</p></section> : null;
  }
  const stale = p.repo !== planRepo(chat.repo) || (p.status === 'awaiting' && (p.baseline !== planBaseline(chat) || chat.messages.at(-1)?.id !== p.messageId));
  const review = ['review','completed'].includes(p.status);
  const status = stale ? 'Workspace changed' : ({planning:'Inspecting repository',awaiting:'Ready for approval',approved:'Approved · send to begin',review:'Ready for review',stopped:'Stopped',failed:'Plan needs another try',rejected:'Plan rejected',completed:'Review completed'})[p.status];
  const revise = () => { if (decide(chat.id, p.id, 'reject')) prepareTool('Revise the coding plan before implementing. My changes: '); };
  return <section className="coding-plan" aria-label="Coding plan">
    <header><ListChecks size={18} /><h3>Coding plan</h3><span role="status">{status}</span></header>
    {p.steps.length > 0 && <ol>{p.steps.map((step, i) => <li key={i}>
      {review ? <input type="checkbox" aria-label={`Reviewed step ${i + 1}`} checked={p.checked.includes(i)} disabled={busy} onChange={() => decide(chat.id, p.id, i)} /> : <span className="plan-step-number">{i + 1}</span>}
      <div><p>{step.title}</p>{step.files.length > 0 && <div className="plan-files">{step.files.map(file => <code key={file}>{file}</code>)}</div>}</div>
    </li>)}</ol>}
    <p className="plan-note">{stale ? 'Files or context changed. Request a fresh plan before approving.' : review ? 'Check each step after reviewing the proposed edits and verification. These checks record your review; they do not run tests.' : p.status === 'failed' ? 'The reply did not contain a complete valid plan, or the request failed. Nothing was approved. Ask for a revised plan.' : 'Approval prepares your draft. Send when ready; edits remain proposals until you apply them.'}</p>
    <div className="plan-actions">
      {p.status === 'awaiting' && !stale && <button className="btn primary small" disabled={busy} onClick={() => { if (decide(chat.id, p.id, 'approve')) prepareTool('Implement the approved coding plan below, in order. Propose edits for review and explain verification still needed.\n\n' + p.steps.map((s,i) => `${i+1}. ${s.title}${s.files.length ? ' — '+s.files.join(', ') : ''}`).join('\n')); }}><Check size={14} />Approve plan</button>}
      {!['completed','rejected'].includes(p.status) && <button className="btn small" disabled={busy} onClick={revise}>{stale || ['failed','stopped'].includes(p.status) ? 'Request fresh plan' : 'Revise plan'}</button>}
      {['awaiting','approved'].includes(p.status) && <button className="btn ghost small" disabled={busy} onClick={() => decide(chat.id,p.id,'reject')}>Reject</button>}
      {p.status === 'review' && <button className="btn primary small" disabled={busy || p.checked.length !== p.steps.length} onClick={() => decide(chat.id,p.id,'complete')}>Finish review</button>}
    </div>
  </section>;
}
