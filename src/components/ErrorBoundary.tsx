import React from 'react';
import { wipeSavedData } from '../store';

interface State {
  failed: boolean;
}

/**
 * If anything on screen crashes (for example damaged saved data), show a way out instead of a blank page.
 * Kept free of other app components so it still renders when they are the problem.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('CMO Training crashed:', error);
  }

  private resetAndReload = async () => {
    await wipeSavedData();
    window.location.hash = '';
    window.location.reload();
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="min-h-screen bg-brand-dark flex items-center justify-center p-6">
        <div role="alert" className="max-w-md w-full bg-brand-card border border-brand-border rounded-2xl p-6 space-y-4 text-sm text-slate-300">
          <h1 className="text-lg font-bold text-white">Something went wrong</h1>
          <p>The app hit a problem showing this page. Reloading often fixes it. If it keeps happening, reset the demo data saved in this browser.</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={() => window.location.reload()} className="flex-1 min-h-[44px] rounded-xl border border-brand-border text-slate-200 hover:text-white">
              Reload
            </button>
            <button onClick={this.resetAndReload} className="flex-1 min-h-[44px] rounded-xl bg-brand-orange hover:bg-brand-orangeHover text-white font-semibold">
              Reset demo data
            </button>
          </div>
        </div>
      </div>
    );
  }
}
