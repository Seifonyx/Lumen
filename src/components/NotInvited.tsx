import { LogOut, ShieldAlert } from 'lucide-react';
import { useStore } from '../store';

export default function NotInvited({ email }: { email: string }) {
  const logout = useStore((s) => s.logout);
  return (
    <main className="login">
      <div className="login-card">
        <ShieldAlert size={44} className="denied-icon" aria-hidden="true" />
        <h1>Not invited</h1>
        <p className="muted">
          <strong dir="auto">{email}</strong> doesn't have access to Model Router. It's a private app; ask its owner to invite this Google account.
        </p>
        <button className="btn block" onClick={logout}>
          <LogOut size={18} /> Use a different account
        </button>
      </div>
    </main>
  );
}
