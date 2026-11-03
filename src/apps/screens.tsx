import React from 'react';
import { ClipboardCheck, Film, Video, ShieldAlert, Settings2, Home } from 'lucide-react';
import type { AppStore } from '../store';
import { TabBar, type TabItem } from '../components/Navigation';
import { CoachFloorMode } from '../components/CoachFloorMode';
import { FilmBreakdownStudio } from '../components/FilmBreakdownStudio';
import { VirtualMeetingRoom } from '../components/VirtualMeetingRoom';
import { CancellationEngine } from '../components/CancellationEngine';
import { CoachManage } from '../components/CoachManage';
import { PlayerView } from '../components/PlayerView';
import { pageUrl, toHash } from '../router';

export interface Screens {
  title: string;
  tabBar: React.ReactNode;
  content: React.ReactNode;
}

type Go = (parts: string[], opts?: { scroll?: boolean }) => void;

const COACH_TABS = ['floor', 'film', 'room', 'policy', 'manage'] as const;
type CoachTab = (typeof COACH_TABS)[number];
const COACH_TITLES: Record<CoachTab, string> = { floor: 'Floor Mode', film: 'Film Studio', room: 'Video Room', policy: 'Cancellations', manage: 'Manage' };

/** The coach's screens. Address: <prefix>/<tab>/<athleteId?> (prefix is empty on the coach page, "coach" on the dev page). */
export function coachScreens(store: AppStore, parts: string[], go: Go, prefix: string[]): Screens {
  const { state } = store;
  const tab: CoachTab = (COACH_TABS as readonly string[]).includes(parts[0]) ? (parts[0] as CoachTab) : 'floor';
  const athleteId = state.players.some(p => p.id === parts[1]) ? parts[1] : state.players[0]?.id ?? '';
  const keepAthlete = parts[1] && state.players.some(p => p.id === parts[1]) ? parts[1] : '';
  const pending = state.bookings.filter(b => b.status === 'cancelled_late').length;
  const item = (key: CoachTab, short: string, long: string, icon: React.ReactNode, badge?: number): TabItem => ({
    key,
    short,
    long,
    icon,
    badge,
    href: toHash([...prefix, key, keepAthlete]),
    active: tab === key,
    onSelect: () => go([...prefix, key, keepAthlete])
  });
  const tabs = [
    item('floor', 'Floor', 'Floor Mode', <ClipboardCheck className="w-4 h-4" />),
    item('film', 'Film', 'Film Studio', <Film className="w-4 h-4" />),
    item('room', 'Video', 'Video Room', <Video className="w-4 h-4" />),
    item('policy', 'Cancels', 'Cancellations', <ShieldAlert className="w-4 h-4" />, pending),
    item('manage', 'Manage', 'Manage', <Settings2 className="w-4 h-4" />)
  ];
  const pick = (id: string) => go([...prefix, tab, id], { scroll: false });
  const content =
    tab === 'floor' ? <CoachFloorMode store={store} /> :
    tab === 'film' ? <FilmBreakdownStudio store={store} mode="coach" athleteId={athleteId} onAthleteChange={pick} /> :
    tab === 'room' ? <VirtualMeetingRoom store={store} mode="coach" athleteId={athleteId} onAthleteChange={pick} inviteLink={pageUrl('athlete', ['room', athleteId])} /> :
    tab === 'policy' ? <CancellationEngine store={store} /> :
    <CoachManage store={store} />;
  return { title: COACH_TITLES[tab], tabBar: <TabBar tabs={tabs} label="Coach sections" />, content };
}

const ATHLETE_TABS = ['portal', 'film', 'room'] as const;
type AthleteTab = (typeof ATHLETE_TABS)[number];
const ATHLETE_TITLES: Record<AthleteTab, string> = { portal: 'My Portal', film: 'Film from Coach', room: 'Video Room' };

/**
 * The athlete's screens. Address: <prefix>/<tab>/<athleteId?>. A signed-in athlete always sees themselves;
 * in the demo (and for the owner) the athlete can be switched.
 */
export function athleteScreens(store: AppStore, parts: string[], go: Go, prefix: string[], ownPlayerId: string | null): Screens {
  const { state } = store;
  const tab: AthleteTab = (ATHLETE_TABS as readonly string[]).includes(parts[0]) ? (parts[0] as AthleteTab) : 'portal';
  const athleteId = ownPlayerId ?? (state.players.some(p => p.id === parts[1]) ? parts[1] : state.players[0]?.id ?? '');
  const keep = ownPlayerId ? '' : athleteId;
  const item = (key: AthleteTab, short: string, long: string, icon: React.ReactNode): TabItem => ({
    key,
    short,
    long,
    icon,
    href: toHash([...prefix, key, keep]),
    active: tab === key,
    onSelect: () => go([...prefix, key, keep])
  });
  const tabs = [
    item('portal', 'My Portal', 'My Portal', <Home className="w-4 h-4" />),
    item('film', 'Film', 'Film from Coach', <Film className="w-4 h-4" />),
    item('room', 'Video', 'Video Room', <Video className="w-4 h-4" />)
  ];
  const player = state.players.find(p => p.id === athleteId);
  const content = !player ? (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-6 text-sm text-slate-300">Your athlete profile isn't set up yet. Ask Coach to check your invite.</div>
  ) : tab === 'portal' ? (
    <PlayerView
      store={store}
      athleteId={athleteId}
      onSwitchAthlete={ownPlayerId ? undefined : id => go([...prefix, 'portal', id], { scroll: false })}
      onOpen={t => go([...prefix, t, keep])}
    />
  ) : tab === 'film' ? (
    <FilmBreakdownStudio store={store} mode="athlete" athleteId={athleteId} />
  ) : (
    <VirtualMeetingRoom store={store} mode="athlete" athleteId={athleteId} />
  );
  const title = `${ATHLETE_TITLES[tab]}${tab === 'portal' && player ? ` · ${player.name}` : ''}`;
  return { title, tabBar: <TabBar tabs={tabs} label="Athlete sections" />, content };
}
