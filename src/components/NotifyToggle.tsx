// Settings → General: a notification when a reply finishes while you're in another app or tab. Turning it on
// asks the browser for permission; the hint says what's possible on this device.
import { useState } from 'react';
import { enableNotifications, notifyState, type NotifyState } from '../lib/notify';

type ToggleProps = { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string };

export default function NotifyToggle({ Toggle, on, onChange }: { Toggle: (p: ToggleProps) => React.ReactElement; on: boolean; onChange: (v: boolean) => void }) {
  const [state, setState] = useState<NotifyState>(notifyState);
  const hint = state === 'blocked' ? 'Notifications are blocked for Lumen. Allow them in your browser or phone settings first.'
    : state === 'unsupported' ? 'On iPhone, add Lumen to your Home Screen (Share → Add to Home Screen) and open it from there to get notifications.'
    : 'When a reply finishes while you’re in another app or tab. Lumen needs to stay open in the background. Deep research always tells you when it’s done.';
  return (
    <Toggle
      label="Notify me when a reply is ready"
      hint={hint}
      checked={on && state === 'on'}
      onChange={async (v) => {
        if (!v) { onChange(false); return; }
        const next = state === 'on' ? 'on' : await enableNotifications();
        setState(next);
        onChange(next === 'on');
      }}
    />
  );
}
