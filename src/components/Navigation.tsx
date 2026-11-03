import React from 'react';
import { Video, ShieldAlert, ClipboardCheck, Film, User, Dumbbell, Home } from 'lucide-react';
import type { Player } from '../types';

export type CoachTab = 'floor' | 'film' | 'room' | 'policy';
export type AthleteTab = 'portal' | 'film' | 'room';
export type Route = { role: 'coach'; tab: CoachTab; athleteId?: string } | { role: 'player'; athleteId: string; tab: AthleteTab };

/** #/coach/<tab>[/<athleteId>] or #/athlete/<athleteId>/<tab> */
export function routeToHash(route: Route): string {
  if (route.role === 'player') return `#/athlete/${route.athleteId}/${route.tab}`;
  return `#/coach/${route.tab}${route.athleteId ? `/${route.athleteId}` : ''}`;
}

interface NavigationProps {
  route: Route;
  navigate: (route: Route, scroll?: boolean) => void;
  players: Player[];
  pendingLateCancels: number;
}

interface TabDef {
  key: string;
  short: string;
  long: string;
  icon: React.ReactNode;
  active: boolean;
  route: Route;
  badge?: number;
}

/** A real link, so Cmd/Ctrl/middle-click opens the section in a new tab; a plain click stays in the app. */
const TabLink: React.FC<Omit<TabDef, 'key'> & { navigate: NavigationProps['navigate'] }> = ({ short, long, icon, active, route, badge, navigate }) => (
  <a
    href={routeToHash(route)}
    onClick={e => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      navigate(route);
    }}
    aria-current={active ? 'page' : undefined}
    className={`py-3 px-3 border-b-2 text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap transition-colors min-h-[44px] ${
      active ? 'border-brand-orange text-brand-orange' : 'border-transparent text-slate-400 hover:text-slate-200'
    }`}
  >
    {icon}
    <span className="sm:hidden">{short}</span>
    <span className="hidden sm:inline">{long}</span>
    {badge ? (
      <span className="ml-0.5 text-[10px] bg-brand-action text-white rounded-full px-1.5 py-0.5 leading-none" aria-label={`${badge} waiting`}>
        {badge}
      </span>
    ) : null}
  </a>
);

export const Navigation: React.FC<NavigationProps> = ({ route, navigate, players, pendingLateCancels }) => {
  const athleteId = route.role === 'player' ? route.athleteId : players[0]?.id ?? '';
  const athlete = players.find(p => p.id === athleteId);
  const coachAthleteId = route.role === 'coach' ? route.athleteId : undefined;

  const coachTabs: TabDef[] = ([
    { key: 'floor', short: 'Floor', long: 'Floor Mode (Court View)', icon: <ClipboardCheck className="w-4 h-4" />, active: false, route: { role: 'coach', tab: 'floor', athleteId: coachAthleteId } },
    { key: 'film', short: 'Film', long: 'Film Studio (Telestrator)', icon: <Film className="w-4 h-4" />, active: false, route: { role: 'coach', tab: 'film', athleteId: coachAthleteId } },
    { key: 'room', short: 'Video', long: 'Video Room', icon: <Video className="w-4 h-4" />, active: false, route: { role: 'coach', tab: 'room', athleteId: coachAthleteId } },
    {
      key: 'policy',
      short: 'Cancels',
      long: 'Cancellations & 24h Grace',
      icon: <ShieldAlert className="w-4 h-4" />,
      active: false,
      route: { role: 'coach', tab: 'policy', athleteId: coachAthleteId },
      badge: pendingLateCancels
    }
  ] satisfies TabDef[]).map(t => ({ ...t, active: route.role === 'coach' && route.tab === t.key }));

  const athleteTabs: TabDef[] = ([
    { key: 'portal', short: 'My Portal', long: `My Portal${athlete ? ` (${athlete.name})` : ''}`, icon: <Home className="w-4 h-4" />, active: false, route: { role: 'player', athleteId, tab: 'portal' } },
    { key: 'film', short: 'Film', long: 'Film From Coach', icon: <Film className="w-4 h-4" />, active: false, route: { role: 'player', athleteId, tab: 'film' } },
    { key: 'room', short: 'Video', long: 'Video Room', icon: <Video className="w-4 h-4" />, active: false, route: { role: 'player', athleteId, tab: 'room' } }
  ] satisfies TabDef[]).map(t => ({ ...t, active: route.role === 'player' && route.tab === t.key }));

  return (
    <header className="sticky top-0 z-40 bg-brand-dark/95 backdrop-blur-md border-b border-brand-border pt-[env(safe-area-inset-top)]">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br from-brand-orange to-red-600 flex items-center justify-center font-bold text-white shadow-lg shadow-brand-orange/20 text-sm tracking-wider">
            CMO
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span translate="no" className="font-heading text-xl sm:text-2xl text-white tracking-wide leading-none">CMO TRAINING</span>
              <span className="hidden sm:inline text-[10px] font-semibold bg-brand-surface border border-brand-border px-1.5 py-0.5 rounded text-brand-orange uppercase">
                Demo
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 truncate">Elite Basketball Development</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider hidden sm:block">Demo: view as</span>
          <div className="flex items-center bg-brand-surface border border-brand-border rounded-xl p-1 text-xs" role="group" aria-label="Demo: view as">
            <button
              onClick={() => navigate({ role: 'coach', tab: route.role === 'coach' ? route.tab : 'floor', athleteId: coachAthleteId })}
              aria-pressed={route.role === 'coach'}
              className={`px-2.5 sm:px-3 py-2 rounded-lg font-medium transition flex items-center gap-1.5 ${
                route.role === 'coach' ? 'bg-brand-action text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Dumbbell className="w-3.5 h-3.5" />
              Coach
            </button>
            <button
              onClick={() => navigate({ role: 'player', athleteId, tab: 'portal' })}
              aria-pressed={route.role === 'player'}
              className={`px-2.5 sm:px-3 py-2 rounded-lg font-medium transition flex items-center gap-1.5 ${
                route.role === 'player' ? 'bg-brand-action text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              Athlete
            </button>
          </div>
        </div>
      </div>

      <nav className="border-t border-brand-border/60 bg-brand-card/70 overflow-x-auto scrollbar-none" aria-label="Sections">
        <div className="max-w-6xl mx-auto px-2 sm:px-4 flex gap-0.5 sm:gap-2">
          {(route.role === 'coach' ? coachTabs : athleteTabs).map(({ key, ...t }) => (
            <TabLink key={key} {...t} navigate={navigate} />
          ))}
        </div>
      </nav>
    </header>
  );
};
