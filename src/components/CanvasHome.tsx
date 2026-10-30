// Canvas home (the new-chat screen): a time-aware line and where a new chat will start. Reached only when
// CANVAS_SHELL is on; the ordinary build keeps its rotating greeting.
import { useLayoutEffect, useRef } from 'react';
import { useStore } from '../store';
import { prefillComposer } from './Composer';

// Starters: your own saved prompts first, then a few everyday ones. Each only fills the message box; nothing is sent.
const STARTERS = [
  { title: 'Plan my week', text: 'Help me plan my week. Here’s what I need to get done: ' },
  { title: 'Explain simply', text: 'Explain this simply, with one example: ' },
  { title: 'Draft an email', text: 'Draft a short, friendly email about ' },
  { title: 'Brainstorm ideas', text: 'Give me ten ideas for ' },
];

export default function CanvasHome({ temporary }: { temporary: boolean }) {
  const user = useStore((s) => s.user);
  const projects = useStore((s) => s.settings.projects);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const selectProject = useStore((s) => s.selectProject);
  const saved = useStore((s) => s.settings.prompts);
  const hour = new Date().getHours();
  const part = hour >= 5 && hour < 12 ? 'Good morning' : hour >= 12 && hour < 18 ? 'Good afternoon' : 'Good evening';
  const name = user?.name?.split(' ')[0].slice(0, 20);
  const project = projects?.find((p) => p.id === activeProjectId) || null;
  // The greeting stays on one line at every width: when ", name" would not fit (a long name, a narrow phone, a
  // larger text size, the longer "Good afternoon"), only the name steps aside. Re-checked on resize and once the web
  // font has loaded, since both change the width.
  const heading = useRef<HTMLHeadingElement>(null), nameRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = heading.current, named = nameRef.current;
    if (!el || !named) return;
    let live = true;
    const box = el.parentElement!;
    const fit = () => {
      if (!live) return;
      named.hidden = false;
      named.hidden = el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().width > box.clientWidth + 1;
    };
    fit();
    // The parent follows the window (the heading shrinks to its text), so a wider window can bring the name back.
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    void document.fonts?.ready.then(fit);
    return () => { live = false; observer.disconnect(); };
  }, [part, name, temporary]);
  if (temporary) return <h1>Incognito chat</h1>;
  return (
    <div className="cv-home">
      <h1 ref={heading}>{part}{name && <span ref={nameRef}>, {name}</span>}</h1>
      {project
        ? <p className="cv-home-where">New chat in <strong dir="auto">{project.name}</strong> <button type="button" onClick={() => selectProject(null)}>Start outside it</button></p>
        : <p className="cv-home-where">Ask anything.</p>}
      <ul className="cv-home-starters" aria-label="Ways to start">
        {[...(saved || []).filter((p) => p.title && p.text).slice(0, 2).map((p) => ({ title: p.title, text: p.text })), ...STARTERS].slice(0, 4).map((s) => (
          <li key={s.title}><button type="button" onClick={() => prefillComposer(s.text)}>{s.title}</button></li>
        ))}
      </ul>
    </div>
  );
}
