// Under the welcome greeting: a few things Lumen can do, one tap to start each.
import { FileUp, Image as ImageIcon, Pencil, Telescope } from 'lucide-react';
import { useStore } from '../store';

const mode = (m: string) => window.dispatchEvent(new CustomEvent('mr:composer-mode', { detail: m }));

export default function WelcomeStarters() {
  const { openCanvas, setUi } = useStore.getState();
  const items = [
    { label: 'Research a topic', icon: <Telescope size={15} />, run: () => mode('research') },
    { label: 'Write a document', icon: <Pencil size={15} />, run: () => openCanvas() },
    { label: 'Create an image', icon: <ImageIcon size={15} />, run: () => mode('image') },
    { label: 'Bring your chats', icon: <FileUp size={15} />, run: () => setUi({ settingsOpen: true, settingsTab: 'privacy' }) },
  ];
  return (
    <div className="welcome-starters">
      {items.map((it, i) => (
        <button key={it.label} type="button" className="welcome-starter" style={{ animationDelay: `${120 + i * 50}ms` }} onClick={it.run}>
          {it.icon}<span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}
