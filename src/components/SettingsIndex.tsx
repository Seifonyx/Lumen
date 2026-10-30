import { ChevronRight, GitFork, type LucideIcon } from 'lucide-react';
import { useId } from 'react';
import { openRoutingCenter } from '../lib/routing-center';
import { navigateScreen } from '../lib/screen-history';
import { PROVIDER_NAMES } from '../lib/util';
import { useStore } from '../store';
import './settings-index.css';

export type SettingsSection = [string, string, LucideIcon, string];

// Settings index for the Canvas presentation on phones: the account first, then short groups whose rows
// state what is true now. Router owns API keys, models, routing, layouts and usage, so one row leaves Settings for it.
// A group of one needs no heading of its own: the row says it.
const GROUPS: [string | null, string[]][] = [
  ['Connections', ['connectors']],
  ['Personal', ['personalize', 'memory', 'tasks']],
  [null, ['privacy']],
];

const NOT_PROVIDER_KEYS = new Set(['github', 'providerAccess', 'cloudflareAccountId', 'alibabaBaseUrl', 'providerRelayUrl']);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function useStatus(): Record<string, string> {
  const keys = useStore((s) => s.keys);
  const settings = useStore((s) => s.settings);
  const memories = useStore((s) => s.memories);
  const tasks = useStore((s) => s.tasks);
  const tasksReady = useStore((s) => s.tasksReady);
  const connected = Object.entries(keys).filter(([id, v]) => !NOT_PROVIDER_KEYS.has(id) && typeof v === 'string' && v.trim()).map(([id]) => id === 'gemini' ? 'Gemini' : PROVIDER_NAMES[id as keyof typeof PROVIDER_NAMES] || id);
  const active = tasks.filter((t) => t.enabled).length;
  return {
    router: `${connected.length === 0 ? 'No provider connected' : connected.length === 1 ? `${connected[0]} connected` : `${connected[0]} and ${plural(connected.length - 1, 'other')} connected`} · ${settings.enabledModels.length ? plural(settings.enabledModels.length, 'saved model') : 'no saved models'}`,
    connectors: keys.github ? 'GitHub connected' : 'GitHub not connected',
    personalize: settings.customInstructions.trim() || settings.aboutMe?.trim() ? 'Instructions set' : 'No instructions yet',
    memory: !settings.memory ? 'Off' : memories.length ? `On · ${plural(memories.length, 'memory', 'memories')}` : 'On',
    tasks: !tasksReady ? '' : tasks.length === 0 ? 'None scheduled' : active === tasks.length ? `${plural(active, 'task')} on` : `${active} of ${plural(tasks.length, 'task')} on`,
    privacy: `Privacy shield ${settings.privacyShield ? 'on' : 'off'}`,
  };
}

function Row({ name, status, Icon, onClick, hint }: { name: string; status: string; Icon: LucideIcon; onClick: () => void; hint?: string }) {
  const id = useId(), nameId = useId();
  return (
    <li className="si-row">
      <button type="button" className="si-hit" onClick={onClick} aria-labelledby={nameId} aria-describedby={status || hint ? id : undefined}>
        <span className="si-icon" aria-hidden="true"><Icon size={17} /></span>
        <span className="si-copy">
          <span className="si-name" id={nameId}>{name}</span>
          {status && <span className="si-status" id={id}>{status}{hint && <span className="sr-only">. {hint}</span>}</span>}
        </span>
        <ChevronRight size={17} className="si-go" aria-hidden="true" />
      </button>
    </li>
  );
}

export default function SettingsIndex({ sections, open }: { sections: SettingsSection[]; open: (id: string) => void }) {
  const user = useStore((s) => s.user);
  const status = useStatus();
  const find = (id: string) => sections.find(([sid]) => sid === id)!;
  const accountId = useId(), accountName = useId();
  const name = user?.name || user?.email || 'Your account';
  // One history step, so Back from Router returns here.
  const prism = () => navigateScreen(() => { useStore.getState().setUi({ page: null, settingsOpen: false, sidebarOpen: false }); openRoutingCenter(); });
  return (
    <nav className="si" aria-label="Settings sections">
      <button type="button" className="si-account" onClick={() => open('general')} aria-labelledby={accountName} aria-describedby={accountId}>
        <span className="avatar si-avatar" aria-hidden="true">
          {user?.photo ? <img src={user.photo} alt="" referrerPolicy="no-referrer" /> : name.charAt(0).toUpperCase()}
        </span>
        <span className="si-copy">
          <span className="si-account-name" id={accountName}><span className="sr-only">Account: </span>{name}</span>
          <span className="si-status" id={accountId}>{user?.name && user.email ? user.email : 'Account, appearance & chat'}{user?.name && user.email ? <span className="sr-only">. Account, appearance & chat</span> : null}</span>
        </span>
        <ChevronRight size={17} className="si-go" aria-hidden="true" />
      </button>
      {GROUPS.map(([title, ids]) => {
        const list = (
          <ul className="si-list">
            {title === 'Connections' && <Row name="Router" status={status.router} hint="API keys, models, routing, layouts and usage. Leaves Settings" Icon={GitFork} onClick={prism} />}
            {ids.map((id) => { const [, label, Icon] = find(id); return <Row key={id} name={label} status={status[id]} hint={id === 'privacy' ? 'Backups, export and account deletion' : undefined} Icon={Icon} onClick={() => open(id)} />; })}
          </ul>
        );
        return title ? (
          <section className="si-group" key={title} aria-labelledby={`si-${title.replace(/\W+/g, '-')}`}>
            <h2 id={`si-${title.replace(/\W+/g, '-')}`}>{title}</h2>
            {list}
          </section>
        ) : <div className="si-group" key={ids.join()}>{list}</div>;
      })}
    </nav>
  );
}
