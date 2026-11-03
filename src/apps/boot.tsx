import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource/teko/600.css';
import '@fontsource/teko/700.css';
import '../style.css';
import type { Backend, Role } from '../backend/types';
import { createBackend } from '../backend';
import { useAppStore } from '../store';
import { syncClock } from '../clock';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { AuthGate } from '../components/AuthGate';
import { Loading } from '../components/Shell';
import { AthletePage, CoachPage, DevPage, Landing } from './pages';

export type PageName = 'landing' | 'coach' | 'athlete' | 'dev';

const ALLOW: Record<Exclude<PageName, 'landing'>, { roles: Role[]; label: string }> = {
  coach: { roles: ['coach', 'dev'], label: 'Coach' },
  athlete: { roles: ['athlete', 'coach', 'dev'], label: 'Athlete' },
  dev: { roles: ['dev'], label: 'Owner' }
};

const Bound: React.FC<{ backend: Backend; page: Exclude<PageName, 'landing'>; profile: Parameters<typeof CoachPage>[0]['profile'] }> = ({ backend, page, profile }) => {
  const store = useAppStore(backend);
  if (!store) return <Loading />;
  if (page === 'coach') return <CoachPage store={store} profile={profile} />;
  if (page === 'athlete') return <AthletePage store={store} profile={profile} />;
  return <DevPage store={store} profile={profile} />;
};

const Root: React.FC<{ page: PageName }> = ({ page }) => {
  const [backend, setBackend] = useState<Backend | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (page === 'landing') return;
    // Check the time against the server before any data is created or rules run, so a phone with a wrong clock
    // can't skew the demo's session times. Never wait more than 2 seconds (offline: carry on with the device clock).
    const clockChecked = Promise.race([syncClock(), new Promise(resolve => window.setTimeout(resolve, 2000))]);
    clockChecked.then(() => createBackend()).then(setBackend, () => setFailed(true));
  }, [page]);
  if (page === 'landing') return <Landing />;
  if (failed) return <Loading label="Could not start. Check your connection and reload." />;
  if (!backend) return <Loading />;
  const { roles, label } = ALLOW[page];
  return (
    <AuthGate backend={backend} allow={roles} pageName={label}>
      {profile => <Bound backend={backend} page={page} profile={profile} />}
    </AuthGate>
  );
};

/** Clickjacking guard: static hosts like GitHub Pages can't send the header that forbids framing. */
function isFramed(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function boot(page: PageName): void {
  const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
  if (isFramed()) {
    root.render(
      <div className="min-h-screen bg-brand-dark flex items-center justify-center p-6 text-sm text-slate-300">
        <a href={window.location.href} target="_blank" rel="noopener noreferrer" className="underline text-brand-orange">
          Open CMO Training in its own tab
        </a>
      </div>
    );
    return;
  }
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <Root page={page} />
      </ErrorBoundary>
    </React.StrictMode>
  );

  window.addEventListener('online', () => void syncClock());
  // Ask the browser not to clear saved work when space runs low.
  void navigator.storage?.persist?.().catch(() => undefined);
  // Offline support, built site only. One worker at the site root serves every page.
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    const base = page === 'landing' ? './' : '../';
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => undefined);
    });
  }
}
