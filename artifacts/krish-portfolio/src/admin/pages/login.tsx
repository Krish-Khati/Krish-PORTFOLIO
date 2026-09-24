import { type FormEvent, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAdminAuth } from '../auth';

export default function LoginPage() {
  const { signIn } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
      setBusy(false);
      setAttempt((n) => n + 1);
    }
  };

  return (
    <div className="adm-login">
      <span className="adm-login-orb adm-login-orb-1" aria-hidden="true" />
      <span className="adm-login-orb adm-login-orb-2" aria-hidden="true" />
      <div className="adm-login-grid" aria-hidden="true" />

      <form key={attempt} className={`adm-login-card${attempt ? ' shake' : ''}`} onSubmit={onSubmit} noValidate>
        <span className="adm-logo adm-logo-lg">K</span>
        <h1>Welcome back</h1>
        <p className="adm-login-sub">Sign in to manage your portfolio.</p>

        <label className="adm-field">
          <span>Email</span>
          <div className="adm-input-icon">
            <Mail size={16} />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="username" required />
          </div>
        </label>

        <label className="adm-field">
          <span>Password</span>
          <div className="adm-input-icon">
            <Lock size={16} />
            <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
            <button type="button" className="adm-input-action" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>

        {error && <p className="adm-form-error" role="alert">{error}</p>}

        <button type="submit" className="adm-btn adm-btn-primary adm-btn-block" disabled={busy}>
          {busy ? <span className="adm-spinner" /> : <>Sign in <ArrowRight size={16} /></>}
        </button>

        <p className="adm-login-note">
          Demo mode: any valid email and a 6+ character password will work. Real sign-in arrives with Supabase.
        </p>
      </form>
    </div>
  );
}
