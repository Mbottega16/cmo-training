import React, { useCallback, useEffect, useState } from 'react';
import { Info, RotateCcw } from 'lucide-react';
import { useDemoStore } from './store';
import { sessionPhase } from './logic';
import { Navigation, routeToHash, type Route, type CoachTab, type AthleteTab } from './components/Navigation';
import { CoachFloorMode } from './components/CoachFloorMode';
import { FilmBreakdownStudio } from './components/FilmBreakdownStudio';
import { VirtualMeetingRoom } from './components/VirtualMeetingRoom';
import { CancellationEngine } from './components/CancellationEngine';
import { PlayerView } from './components/PlayerView';

const COACH_TABS: CoachTab[] = ['floor', 'film', 'room', 'policy'];
const ATHLETE_TABS: AthleteTab[] = ['portal', 'film', 'room'];

/** #/coach/<tab> or #/athlete/<athleteId>/<tab>. Anything else falls back to the coach's floor. */
function parseRoute(hash: string, playerIds: string[]): Route {
  const parts = hash.replace(/^#\/?/, '').split('/');
  if (parts[0] === 'athlete' && playerIds.includes(parts[1] ?? '')) {
    const tab = ATHLETE_TABS.includes(parts[2] as AthleteTab) ? (parts[2] as AthleteTab) : 'portal';
    return { role: 'player', athleteId: parts[1], tab };
  }
  if (parts[0] === 'coach' && COACH_TABS.includes(parts[1] as CoachTab)) {
    return { role: 'coach', tab: parts[1] as CoachTab, athleteId: playerIds.includes(parts[2] ?? '') ? parts[2] : undefined };
  }
  return { role: 'coach', tab: 'floor' };
}

const COACH_TITLES: Record<CoachTab, string> = { floor: 'Floor Mode', film: 'Film Studio', room: 'Video Room', policy: 'Cancellations' };
const ATHLETE_TITLES: Record<AthleteTab, string> = { portal: 'My Portal', film: 'Film from Coach', room: 'Video Room' };

/** iPhone/iPad Safari not opened from the home screen: saved work there can be cleared after ~7 days unused. */
function needsInstallHint(): boolean {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
  return ios && !standalone;
}

export const App: React.FC = () => {
  const store = useDemoStore();
  const { state } = store;
  const playerIds = state.players.map(p => p.id);
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash, playerIds));

  useEffect(() => {
    const onHash = () => setRoute(parseRoute(window.location.hash, state.players.map(p => p.id)));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [state.players]);

  const navigate = useCallback((next: Route, scroll = true) => {
    const hash = routeToHash(next);
    if (window.location.hash !== hash) window.location.hash = hash;
    setRoute(next);
    if (scroll) window.scrollTo({ top: 0 });
  }, []);

  // The coach's chosen athlete lives in the address, so links and reloads keep it.
  const coachAthleteId = (route.role === 'coach' && route.athleteId) || state.players[0]?.id || '';
  const setCoachAthleteId = (id: string) => route.role === 'coach' && navigate({ role: 'coach', tab: route.tab, athleteId: id }, false);

  const pageTitle =
    route.role === 'coach'
      ? COACH_TITLES[route.tab]
      : `${ATHLETE_TITLES[route.tab]}${route.tab === 'portal' ? ` · ${state.players.find(p => p.id === route.athleteId)?.name ?? ''}` : ''}`;
  useEffect(() => {
    document.title = `${pageTitle} · CMO Training`;
  }, [pageTitle]);

  const handleReset = () => {
    if (window.confirm('Reset the demo? This clears every booking, note, drawing and voice memo saved in this browser.')) {
      void store.reset();
    }
  };

  const now = new Date();
  const hasUpcoming = state.sessions.some(s => sessionPhase(s, now) !== 'ended');
  const pendingLate = state.bookings.filter(b => b.status === 'cancelled_late').length;

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
      <Navigation route={route} navigate={navigate} players={state.players} pendingLateCancels={pendingLate} />

      <main id="main" tabIndex={-1} className="flex-1 max-w-6xl w-full mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 outline-none">
        <h1 className="sr-only">{pageTitle}</h1>
        <div className="bg-brand-surface/60 border border-brand-border/80 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
            <span className="text-slate-300 leading-relaxed">
              <strong className="text-white">Demo with made-up data.</strong> Everything you do is saved in this browser only.
              Payments, texts, emails, and live calls with a second person are not connected yet.
              {store.saveFailed && <strong className="text-red-300"> This browser is blocking storage, so changes will be lost on reload.</strong>}
            </span>
          </div>
          <button
            onClick={handleReset}
            className="shrink-0 self-start sm:self-auto inline-flex items-center gap-1.5 bg-brand-card border border-brand-border hover:border-brand-orange px-3 py-2 rounded-lg text-slate-300 hover:text-white min-h-[44px]"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset demo
          </button>
        </div>

        {needsInstallHint() && (
          <div className="bg-brand-accent/10 border border-brand-accent/40 rounded-2xl p-3 text-xs text-blue-200">
            On iPhone, tap <strong>Share → Add to Home Screen</strong>. It opens like an app, works without signal, and keeps your saved work
            (Safari may clear it after a week without a visit otherwise).
          </div>
        )}

        {!hasUpcoming && (
          <div className="bg-brand-orange/10 border border-brand-orange/40 rounded-2xl p-3 text-xs text-orange-200">
            Every demo session is now in the past. Press <strong>Reset demo</strong> to get fresh session times.
          </div>
        )}

        {route.role === 'coach' ? (
          <>
            {route.tab === 'floor' && <CoachFloorMode store={store} />}
            {route.tab === 'film' && (
              <FilmBreakdownStudio store={store} mode="coach" athleteId={coachAthleteId} onAthleteChange={setCoachAthleteId} />
            )}
            {route.tab === 'room' && (
              <VirtualMeetingRoom store={store} mode="coach" athleteId={coachAthleteId} onAthleteChange={setCoachAthleteId} />
            )}
            {route.tab === 'policy' && <CancellationEngine store={store} />}
          </>
        ) : (
          <>
            {route.tab === 'portal' && <PlayerView store={store} athleteId={route.athleteId} navigate={navigate} />}
            {route.tab === 'film' && <FilmBreakdownStudio store={store} mode="athlete" athleteId={route.athleteId} />}
            {route.tab === 'room' && <VirtualMeetingRoom store={store} mode="athlete" athleteId={route.athleteId} />}
          </>
        )}
      </main>

      <footer className="border-t border-brand-border/60 py-4 px-4 text-center text-xs text-slate-400 bg-brand-dark pb-[max(1rem,env(safe-area-inset-bottom))]">
        CMO Training demo v0.3 · made-up data · built for review and feedback
      </footer>
    </div>
  );
};

export default App;
