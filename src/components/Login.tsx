import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../store';

export default function Login() {
  const login = useStore((s) => s.login);
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      await login(password);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <img src="/icon.svg" alt="" className="login-logo" width={56} height={56} />
        <h1>Model Router</h1>
        <p className="muted">Your private chat with free AI models.</p>
        <label className="field">
          <span className="sr-only">Password</span>
          <div className="input-with-btn">
            <input
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            <button type="button" className="icon-btn sm" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="btn primary block" type="submit" disabled={!password || busy}>
          {busy ? <Loader2 className="spin" size={18} /> : <>Sign in <ArrowRight size={18} /></>}
        </button>
      </form>
    </main>
  );
}
