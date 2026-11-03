import React, { useEffect } from 'react';
import { Info, X } from 'lucide-react';
import type { AppStore } from '../store';
import { sessionPhase } from '../logic';
import { now } from '../clock';

/** iPhone/iPad Safari not opened from the home screen: saved work there can be cleared after ~7 days unused. */
function needsInstallHint(): boolean {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
  return ios && !standalone;
}

interface ShellProps {
  /** The screen's name: page title, hidden h1. */
  title: string;
  header: React.ReactNode;
  store?: AppStore | null;
  /** Shown on the dev page only. */
  showDemoTools?: boolean;
  children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ title, header, store, showDemoTools, children }) => {
  useEffect(() => {
    document.title = `${title} · CMO Training`;
  }, [title]);

  const demo = store?.backend.kind === 'local';
  const hasUpcoming = store ? store.state.sessions.some(s => sessionPhase(s, now()) !== 'ended') : true;

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col">
      <a
        href="#main"
        onClick={e => {
          e.preventDefault(); // the address holds the route, so don't let this link change it
          document.getElementById('main')?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] bg-brand-action text-white px-4 py-2 rounded-lg"
      >
        Skip to content
      </a>
      {header}
      <main id="main" tabIndex={-1} className="flex-1 max-w-6xl w-full mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 outline-none">
        <h1 className="sr-only">{title}</h1>

        {store?.problem && (
          <div role="alert" className="bg-red-500/10 border border-red-500/40 rounded-2xl p-3 text-sm text-red-200 flex items-start justify-between gap-3">
            <span>{store.problem}</span>
            <button onClick={store.clearProblem} aria-label="Dismiss" className="min-w-[44px] min-h-[44px] -m-2 flex items-center justify-center text-red-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {demo && (
          <div className="bg-brand-surface/60 border border-brand-border/80 rounded-2xl p-3 flex items-start gap-2.5 text-xs">
            <Info className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
            <span className="text-slate-300 leading-relaxed">
              <strong className="text-white">Demo with made-up data.</strong> Everything is saved in this browser only, and the coach and athlete pages share
              it. {showDemoTools ? 'Use the Dev tools tab to change the rules, travel in time, or reset.' : 'Payments, texts and e-mails are not connected.'}
            </span>
          </div>
        )}

        {needsInstallHint() && (
          <div className="bg-brand-info/10 border border-brand-accent/40 rounded-2xl p-3 text-xs text-blue-200">
            On iPhone, tap <strong>Share → Add to Home Screen</strong>. It opens like an app, works without signal, and keeps your saved work (Safari may
            clear it after a week without a visit otherwise).
          </div>
        )}

        {demo && !hasUpcoming && (
          <div className="bg-brand-orange/10 border border-brand-orange/40 rounded-2xl p-3 text-xs text-orange-200">
            Every demo session is now in the past. Reset the demo on the dev page to get fresh session times.
          </div>
        )}

        {children}
      </main>
      <footer className="border-t border-brand-border/60 py-4 px-4 text-center text-xs text-slate-400 bg-brand-dark pb-[max(1rem,env(safe-area-inset-bottom))]">
        CMO Training v0.4{store ? (demo ? ' · demo data' : ' · live') : ''}
      </footer>
    </div>
  );
};

export const Loading: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div className="min-h-screen bg-brand-dark flex items-center justify-center text-sm text-slate-300" role="status">
    {label}
  </div>
);
