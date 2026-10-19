/**
 * Design Renaissance exploration: three genuine Lumen entry points, no mock UI.
 * Present ONLY in an opt-in real-app proof. Actions use existing store owners.
 * This component is temporary until a full-screen direction is approved.
 */
import { ArrowUpRight, FilePenLine, FolderKanban, Shapes, Sparkles } from 'lucide-react';
import { useStore } from '../store';

const STARTS = [
  {
    id: 'tools',
    number: '01',
    name: 'Explore tools',
    subtitle: 'Research, analyze and create',
    Icon: Shapes,
    action: () => useStore.getState().setUi({ page: 'tools', sidebarOpen: false }),
  },
  {
    id: 'document',
    number: '02',
    name: 'Write a document',
    subtitle: 'Open the live canvas',
    Icon: FilePenLine,
    action: () => useStore.getState().openCanvas(),
  },
  {
    id: 'projects',
    number: '03',
    name: 'Your projects',
    subtitle: 'Return to your workspace',
    Icon: FolderKanban,
    action: () => useStore.getState().setUi({ page: 'projects', sidebarOpen: false }),
  },
] as const;

export default function RenaissanceLaunchpad() {
  return (
    <nav className="renaissance-launchpad" aria-label="Start a task in Lumen">
      <div className="renaissance-launchpad-intro" aria-hidden="true">
        <span className="renaissance-launchpad-kicker"><Sparkles size={13} /> MADE FOR YOUR NEXT IDEA</span>
        <span className="renaissance-launchpad-rule" />
      </div>
      <div className="renaissance-launchpad-actions">
        {STARTS.map(({ id, number, name, subtitle, Icon, action }) => (
          <button key={id} type="button" className="renaissance-start" onClick={action}>
            <span className="renaissance-start-number" aria-hidden="true">{number}</span>
            <span className="renaissance-start-icon" aria-hidden="true"><Icon size={20} strokeWidth={1.8} /></span>
            <span className="renaissance-start-content">
              <span className="renaissance-start-title">{name}</span>
              <span className="renaissance-start-subtitle">{subtitle}</span>
            </span>
            <ArrowUpRight className="renaissance-start-arrow" size={17} aria-hidden="true" />
          </button>
        ))}
      </div>
    </nav>
  );
}
