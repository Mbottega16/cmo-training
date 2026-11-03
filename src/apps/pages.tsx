import React from 'react';
import { Dumbbell, User, Wrench } from 'lucide-react';
import type { AppStore } from '../store';
import type { Profile } from '../backend/types';
import { Header } from '../components/Navigation';
import { Shell } from '../components/Shell';
import { SignOutButton } from '../components/AuthGate';
import { DevTools } from '../components/DevTools';
import { useHashParts, pageUrl, toHash } from '../router';
import { athleteScreens, coachScreens } from './screens';

const signOut = (store: AppStore, profile: Profile | null) => (profile && store.backend.auth ? <SignOutButton backend={store.backend} email={profile.email} /> : null);

/** The coach's own page: /coach/ */
export const CoachPage: React.FC<{ store: AppStore; profile: Profile | null }> = ({ store, profile }) => {
  const [parts, go] = useHashParts();
  const s = coachScreens(store, parts, go, []);
  return (
    <Shell title={s.title} store={store} header={<Header pageLabel="Coach" right={signOut(store, profile)}>{s.tabBar}</Header>}>
      {s.content}
    </Shell>
  );
};

/** The athlete's own page: /athlete/ */
export const AthletePage: React.FC<{ store: AppStore; profile: Profile | null }> = ({ store, profile }) => {
  const [parts, go] = useHashParts();
  const own = profile?.role === 'athlete' ? profile.playerId : null;
  const s = athleteScreens(store, parts, go, [], own);
  return (
    <Shell title={s.title} store={store} header={<Header pageLabel="Athlete" right={signOut(store, profile)}>{s.tabBar}</Header>}>
      {s.content}
    </Shell>
  );
};

type DevView = 'coach' | 'athlete' | 'tools';

/** The owner's page: /dev/ — switch between the coach and athlete views, and tweak everything in Dev tools. */
export const DevPage: React.FC<{ store: AppStore; profile: Profile | null }> = ({ store, profile }) => {
  const [parts, go] = useHashParts();
  const view: DevView = parts[0] === 'athlete' || parts[0] === 'tools' ? parts[0] : 'coach';
  const rest = parts.slice(1);
  const s =
    view === 'coach' ? coachScreens(store, rest, go, ['coach']) :
    view === 'athlete' ? athleteScreens(store, rest, go, ['athlete'], null) :
    { title: 'Dev tools', tabBar: null, content: <DevTools store={store} /> };

  const seg = (key: DevView, labelText: string, icon: React.ReactNode) => (
    <a
      href={toHash([key])}
      onClick={e => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        go([key]);
      }}
      aria-current={view === key ? 'page' : undefined}
      className={`flex-1 sm:flex-initial justify-center px-2.5 sm:px-3 min-h-[40px] rounded-lg font-medium flex items-center gap-1.5 ${view === key ? 'bg-brand-action text-white' : 'text-slate-300 hover:text-white'}`}
    >
      {icon}
      <span>{labelText}</span>
    </a>
  );

  const toggle = (
    <div className="flex items-center gap-2 w-full sm:w-auto">
      <nav className="flex flex-1 sm:flex-initial items-center bg-brand-surface border border-brand-border rounded-xl p-1 text-xs" aria-label="View">
        {seg('coach', 'Coach', <Dumbbell className="w-3.5 h-3.5" />)}
        {seg('athlete', 'Athlete', <User className="w-3.5 h-3.5" />)}
        {seg('tools', 'Dev', <Wrench className="w-3.5 h-3.5" />)}
      </nav>
      {signOut(store, profile)}
    </div>
  );

  return (
    <Shell title={`${s.title} (dev)`} store={store} showDemoTools header={<Header pageLabel="Dev" right={toggle}>{s.tabBar}</Header>}>
      {s.content}
    </Shell>
  );
};

/** The front door: / — pick coach or athlete. */
export const Landing: React.FC = () => (
  <Shell title="Welcome" header={<Header pageLabel="Training" />}>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
      <a href={pageUrl('athlete')} className="bg-brand-card border border-brand-border hover:border-brand-orange rounded-2xl p-6 space-y-2 block">
        <User className="w-8 h-8 text-brand-orange" />
        <h2 className="text-xl font-bold text-white">I'm an athlete</h2>
        <p className="text-sm text-slate-300">Book sessions, see your drills and film from Coach, join video sessions.</p>
      </a>
      <a href={pageUrl('coach')} className="bg-brand-card border border-brand-border hover:border-brand-orange rounded-2xl p-6 space-y-2 block">
        <Dumbbell className="w-8 h-8 text-brand-orange" />
        <h2 className="text-xl font-bold text-white">I'm the coach</h2>
        <p className="text-sm text-slate-300">Check in the roster on court, break down film, run video sessions, manage cancellations and credits.</p>
      </a>
    </div>
    <p className="text-xs text-slate-400 text-center pt-6">
      Tip: add your page to your phone's home screen so it opens like an app. · <a className="underline" href={pageUrl('dev')}>Owner</a>
    </p>
  </Shell>
);
