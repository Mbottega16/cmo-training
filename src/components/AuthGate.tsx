import React, { useCallback, useEffect, useState } from 'react';
import { LogIn, LogOut, KeyRound } from 'lucide-react';
import type { Backend, Profile, Role } from '../backend/types';
import { pageUrl } from '../router';
import { Loading } from './Shell';

const PAGE_FOR: Record<Role, 'coach' | 'athlete' | 'dev' | ''> = { dev: 'dev', coach: 'coach', athlete: 'athlete', pending: '' };
const field = 'w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-3 text-base text-white placeholder-slate-500 focus:outline-none focus:border-brand-orange';

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
    <main className="max-w-sm w-full bg-brand-card border border-brand-border rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-orange to-red-600 flex items-center justify-center font-bold text-white text-sm" aria-hidden="true">CMO</div>
        <h1 className="text-lg font-bold text-white">{title}</h1>
      </div>
      {children}
    </main>
  </div>
);

const SignIn: React.FC<{ backend: Backend; pageName: string }> = ({ backend, pageName }) => {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const error = mode === 'in' ? await backend.auth!.signIn(email, password) : await backend.auth!.signUp(email, password);
    setBusy(false);
    if (error) setMessage(error);
  };
  return (
    <Card title={`CMO Training · ${pageName}`}>
      <p className="text-sm text-slate-300">{mode === 'in' ? 'Sign in to continue.' : 'Create your account. You will need the invite code Coach sent you.'}</p>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="block text-xs font-semibold text-slate-300 mb-1">E-mail</span>
          <input type="email" required autoComplete="email" spellCheck={false} value={email} onChange={e => setEmail(e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-slate-300 mb-1">Password{mode === 'up' && ' (at least 8 characters)'}</span>
          <input type="password" required minLength={mode === 'up' ? 8 : undefined} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} className={field} />
        </label>
        {message && <p role="alert" className="text-sm text-orange-200">{message}</p>}
        <button type="submit" disabled={busy} className="w-full min-h-[48px] rounded-xl bg-brand-action hover:bg-brand-actionHover text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
          <LogIn className="w-4 h-4" /> {busy ? (mode === 'in' ? 'Signing in…' : 'Creating…') : mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      <button onClick={() => setMode(mode === 'in' ? 'up' : 'in')} className="w-full min-h-[44px] text-sm text-slate-300 underline">
        {mode === 'in' ? 'New here? Create an account' : 'Already have an account? Sign in'}
      </button>
    </Card>
  );
};

const ClaimInvite: React.FC<{ backend: Backend; email: string }> = ({ backend, email }) => {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(await backend.auth!.claimInvite(code));
  };
  return (
    <Card title="Enter your invite code">
      <p className="text-sm text-slate-300">Signed in as {email}. Enter the 8-character code Coach sent you. You only do this once.</p>
      <form onSubmit={submit} className="space-y-3">
        <input aria-label="Invite code" required autoCapitalize="characters" autoComplete="one-time-code" spellCheck={false} maxLength={8} value={code} onChange={e => setCode(e.target.value.toUpperCase())} className={`${field} font-mono tracking-widest text-center`} placeholder="ABCD1234" />
        {message && <p role="alert" className="text-sm text-orange-200">{message}</p>}
        <button type="submit" className="w-full min-h-[48px] rounded-xl bg-brand-action hover:bg-brand-actionHover text-white font-semibold flex items-center justify-center gap-2">
          <KeyRound className="w-4 h-4" /> Continue
        </button>
      </form>
      <button onClick={() => void backend.auth!.signOut()} className="w-full min-h-[44px] text-sm text-slate-300 underline">Sign out</button>
    </Card>
  );
};

export const SignOutButton: React.FC<{ backend: Backend; email: string }> = ({ backend, email }) => (
  <button onClick={() => void backend.auth?.signOut()} title={`Signed in as ${email}`} className="min-h-[44px] px-3 rounded-xl border border-brand-border text-slate-300 hover:text-white text-xs flex items-center gap-1.5">
    <LogOut className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Sign out</span>
  </button>
);

/**
 * With the real backend, a page opens only for the right people. In the demo (no backend) everyone gets in.
 * `children` receives the signed-in profile (null in the demo).
 */
export const AuthGate: React.FC<{ backend: Backend; allow: Role[]; pageName: string; children: (profile: Profile | null) => React.ReactNode }> = ({ backend, allow, pageName, children }) => {
  const [profile, setProfile] = useState<Profile | null | undefined>(backend.auth ? undefined : null);
  const refresh = useCallback(() => {
    if (backend.auth) void backend.auth.profile().then(setProfile);
  }, [backend]);
  useEffect(() => {
    if (!backend.auth) return;
    refresh();
    return backend.auth.onChange(refresh);
  }, [backend, refresh]);

  if (!backend.auth) return <>{children(null)}</>;
  if (profile === undefined) return <Loading />;
  if (profile === null) return <SignIn backend={backend} pageName={pageName} />;
  if (profile.role === 'pending') return <ClaimInvite backend={backend} email={profile.email} />;
  if (!allow.includes(profile.role)) {
    const target = PAGE_FOR[profile.role];
    return (
      <Card title="Wrong page">
        <p className="text-sm text-slate-300">This page is for {pageName.toLowerCase()} use. Your account opens a different page.</p>
        {target && <a href={pageUrl(target)} className="block w-full min-h-[48px] rounded-xl bg-brand-action text-white font-semibold text-center leading-[48px]">Go to my page</a>}
        <button onClick={() => void backend.auth!.signOut()} className="w-full min-h-[44px] text-sm text-slate-300 underline">Sign out</button>
      </Card>
    );
  }
  return <>{children(profile)}</>;
};
