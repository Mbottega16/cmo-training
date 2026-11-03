import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Database, Clock3, SlidersHorizontal, Users, Download, Upload, RotateCcw, Activity, KeyRound } from 'lucide-react';
import type { AppStore } from '../store';
import type { Settings } from '../types';
import type { Profile, Role } from '../backend/types';
import { backendConfigured, demoForced, setDemoForced, SUPABASE_URL } from '../backend';
import { clockInfo, setDevOffset, useNow } from '../clock';
import { pageUrl } from '../router';
import { Toast, type ToastTone } from './ui';
import { plural } from '../format';

const card = 'bg-brand-card border border-brand-border rounded-2xl p-4 sm:p-5 space-y-3';
const field = 'w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-orange';
const btn = 'min-h-[44px] px-3 rounded-xl border border-brand-border text-slate-200 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5';

const HOUR = 3_600_000;

/** The owner's page: change the rules, test with time travel, edit data, manage people. */
export const DevTools: React.FC<{ store: AppStore }> = ({ store }) => {
  const { state, dispatch, backend } = store;
  const now = useNow(1000);
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const clearToast = useCallback(() => setToast(null), []);
  const report = (r: { ok: boolean; message: string }) => setToast({ message: r.message || (r.ok ? 'Done.' : 'That did not work.'), tone: r.ok ? 'good' : 'bad' });
  const [draft, setDraft] = useState<Settings>(state.settings);
  useEffect(() => setDraft(state.settings), [state.settings]);
  const [offset, setOffset] = useState(clockInfo().devOffsetMs);
  const fileRef = useRef<HTMLInputElement>(null);
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [storageUse, setStorageUse] = useState<string>('…');
  const [swState, setSwState] = useState('…');

  useEffect(() => () => setDevOffset(0), []); // time travel only lasts while you're on this page
  useEffect(() => {
    void navigator.storage?.estimate?.().then(e => setStorageUse(`${((e.usage ?? 0) / 1048576).toFixed(1)} MB used of ${((e.quota ?? 0) / 1073741824).toFixed(1)} GB`));
    void navigator.serviceWorker?.getRegistration?.('../').then(r => setSwState(r?.active ? 'active (offline ready)' : 'not installed (only on the built site)'));
    if (backend.auth) void backend.auth.listProfiles().then(setProfiles);
  }, [backend]);

  const travel = (ms: number) => {
    const next = ms === 0 ? 0 : offset + ms;
    setOffset(next);
    setDevOffset(next);
    if (backend.kind === 'local') void dispatch({ type: 'expire' });
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    report(await dispatch({ type: 'settings.update', patch: draft }, { quiet: true }));
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cmo-training-demo-${now.toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !backend.replaceState) return;
    try {
      report(await backend.replaceState(JSON.parse(await file.text())));
    } catch {
      report({ ok: false, message: 'That file is not valid JSON.' });
    }
  };

  const setRole = async (userId: string, role: Role) => {
    if (!backend.auth) return;
    const error = await backend.auth.setRole(userId, role);
    report({ ok: !error, message: error ?? 'Role updated.' });
    setProfiles(await backend.auth.listProfiles());
  };

  const coachInvite = async () => {
    if (!backend.auth) return;
    const r = await backend.auth.createInvite('coach');
    setToast(r.code ? { message: `Coach invite code: ${r.code} (send it with ${pageUrl('coach')})`, tone: 'good' } : { message: r.error ?? 'Could not create an invite.', tone: 'bad' });
  };

  const num = (key: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft(d => ({ ...d, [key]: Number(e.target.value) }));
  const info = clockInfo();

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.message} tone={toast.tone} onDone={clearToast} />}

      <section className={card} aria-label="Data source">
        <h2 className="text-base font-bold text-white flex items-center gap-2"><Database className="w-4 h-4 text-brand-orange" /> Data source</h2>
        <p className="text-sm text-slate-300">Now using: <strong className="text-white">{backend.label}</strong></p>
        {backendConfigured ? (
          <label className="flex items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              className="w-5 h-5"
              checked={demoForced()}
              onChange={e => {
                setDemoForced(e.target.checked);
                window.location.reload();
              }}
            />
            Use demo data in this browser instead of the real backend (only affects this browser)
          </label>
        ) : (
          <p className="text-xs text-slate-400">The real backend isn't connected yet, so every page uses demo data saved in this browser. See SETUP-BACKEND.md in the repo (about 10 minutes, free).</p>
        )}
        <div className="flex flex-wrap gap-2">
          <a className={btn} href={pageUrl('coach')}>Open the coach page</a>
          <a className={btn} href={pageUrl('athlete')}>Open the athlete page</a>
        </div>
      </section>

      <section className={card} aria-label="Rules">
        <h2 className="text-base font-bold text-white flex items-center gap-2"><SlidersHorizontal className="w-4 h-4 text-brand-orange" /> Rules</h2>
        <form onSubmit={saveSettings} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <label>
            <span className="block text-xs font-semibold text-slate-300 mb-1">Late if cancelled under (hours)</span>
            <input type="number" min={0} max={168} value={draft.lateCancelHours} onChange={num('lateCancelHours')} className={field} />
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-300 mb-1">Grace window (hours)</span>
            <input type="number" min={0} max={336} value={draft.graceHours} onChange={num('graceHours')} className={field} />
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-300 mb-1">A late-cancelled spot…</span>
            <select value={draft.lateSpot} onChange={e => setDraft(d => ({ ...d, lateSpot: e.target.value === 'lock' ? 'lock' : 'refill' }))} className={field}>
              <option value="refill">Reopens; refund if the session refills</option>
              <option value="lock">Stays locked</option>
            </select>
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-300 mb-1">XP per check-in</span>
            <input type="number" min={0} max={1000} value={draft.checkInXp} onChange={num('checkInXp')} className={field} />
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-300 mb-1">Check-in opens (minutes before)</span>
            <input type="number" min={0} max={1440} value={draft.checkInOpensMinutes} onChange={num('checkInOpensMinutes')} className={field} />
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-300 mb-1">Check-in closes (hours after)</span>
            <input type="number" min={0} max={168} value={draft.checkInClosesHours} onChange={num('checkInClosesHours')} className={field} />
          </label>
          <button type="submit" className="sm:col-span-3 min-h-[44px] rounded-xl bg-brand-action hover:bg-brand-actionHover text-white font-semibold text-sm">Save rules</button>
        </form>
      </section>

      <section className={card} aria-label="Time travel">
        <h2 className="text-base font-bold text-white flex items-center gap-2"><Clock3 className="w-4 h-4 text-brand-orange" /> Time travel</h2>
        <p className="text-sm text-slate-300">
          App time here: <strong className="text-white font-mono">{now.toLocaleString()}</strong>
          {offset !== 0 && <span className="text-brand-orange"> ({offset > 0 ? '+' : ''}{(offset / HOUR).toFixed(1)} h)</span>}
        </p>
        {backend.kind === 'local' ? (
          <>
            <div className="flex flex-wrap gap-2">
              {[['−1 day', -24 * HOUR], ['−1 h', -HOUR], ['+1 h', HOUR], ['+6 h', 6 * HOUR], ['+1 day', 24 * HOUR]].map(([l, ms]) => (
                <button key={l as string} onClick={() => travel(ms as number)} className={btn}>{l}</button>
              ))}
              <button onClick={() => travel(0)} className={btn}>Back to now</button>
            </div>
            <p className="text-xs text-slate-400">Only this dev page moves in time; grace windows that run out while you travel are applied to the demo data.</p>
          </>
        ) : (
          <p className="text-xs text-slate-400">With the real backend the server's clock decides, so time travel is off. Switch this browser to demo data to use it.</p>
        )}
        <p className="text-xs text-slate-400">Clock check: {!info.synced ? 'not checked yet (works on the hosted site)' : Math.abs(info.serverOffsetMs) < 1500 ? "matched to the server; this device's clock is right" : `matched to the server; this device's clock is off by ${Math.round(Math.abs(info.serverOffsetMs) / 1000)} s, and the app ignores it`}.</p>
      </section>

      <section className={card} aria-label="Edit athletes">
        <h2 className="text-base font-bold text-white flex items-center gap-2"><Users className="w-4 h-4 text-brand-orange" /> Edit athletes</h2>
        <p className="text-xs text-slate-400">Credits are on the coach's Manage tab. Here you can fix names, levels and XP.</p>
        <ul className="space-y-2">
          {state.players.map(p => (
            <li key={`${p.id}-${p.name}-${p.level}-${p.xp}`} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end border-b border-brand-border/50 pb-3 last:border-0">
              <label className="block"><span className="block text-[11px] text-slate-400 mb-0.5">Name</span><input aria-label={`${p.name}: name`} defaultValue={p.name} maxLength={80} onBlur={e => e.target.value.trim() && e.target.value !== p.name && void dispatch({ type: 'player.update', id: p.id, patch: { name: e.target.value.trim() } })} className={field} /></label>
              <label className="block"><span className="block text-[11px] text-slate-400 mb-0.5">Level</span><input aria-label={`${p.name}: level`} defaultValue={p.level} maxLength={80} onBlur={e => e.target.value !== p.level && void dispatch({ type: 'player.update', id: p.id, patch: { level: e.target.value } })} className={field} /></label>
              <label className="block"><span className="block text-[11px] text-slate-400 mb-0.5">XP</span><input aria-label={`${p.name}: XP`} type="number" min={0} defaultValue={p.xp} onBlur={e => Number(e.target.value) !== p.xp && void dispatch({ type: 'player.update', id: p.id, patch: { xp: Number(e.target.value) } })} className={field} /></label>
              <span className="text-xs text-slate-400 font-mono">{p.id}</span>
            </li>
          ))}
        </ul>
      </section>

      {backend.auth && (
        <section className={card} aria-label="People">
          <h2 className="text-base font-bold text-white flex items-center gap-2"><KeyRound className="w-4 h-4 text-brand-orange" /> People and roles</h2>
          <button onClick={() => void coachInvite()} className={btn}>Create a coach invite code</button>
          {profiles === null ? (
            <p className="text-xs text-slate-400">Loading…</p>
          ) : (
            <ul className="space-y-2">
              {profiles.map(p => (
                <li key={p.userId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-brand-surface border border-brand-border rounded-xl p-3 text-sm">
                  <span className="text-white break-all">{p.email}{p.playerId ? <span className="text-slate-400"> · {state.players.find(x => x.id === p.playerId)?.name ?? p.playerId}</span> : null}</span>
                  {p.role === 'dev' ? (
                    <span className="text-xs text-brand-orange font-semibold">Owner</span>
                  ) : (
                    <select aria-label={`Role for ${p.email}`} value={p.role} onChange={e => void setRole(p.userId, e.target.value as Role)} className={`${field} sm:w-40`}>
                      <option value="coach">Coach</option>
                      <option value="athlete">Athlete</option>
                      <option value="pending">No access</option>
                    </select>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {backend.kind === 'local' && (
        <section className={card} aria-label="Demo data">
          <h2 className="text-base font-bold text-white">Demo data</h2>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportData} className={btn}><Download className="w-4 h-4" /> Export</button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={importData} />
            <button onClick={() => fileRef.current?.click()} className={btn}><Upload className="w-4 h-4" /> Import</button>
            <button
              onClick={() => {
                if (window.confirm('Reset the demo? This clears every booking, note, drawing and voice memo saved in this browser.')) void backend.reset?.().then(() => setToast({ message: 'Demo reset with fresh session times.', tone: 'good' }));
              }}
              className={btn}
            >
              <RotateCcw className="w-4 h-4" /> Reset demo
            </button>
          </div>
        </section>
      )}

      <section className={card} aria-label="Health">
        <h2 className="text-base font-bold text-white flex items-center gap-2"><Activity className="w-4 h-4 text-brand-orange" /> Health</h2>
        <ul className="text-xs text-slate-300 space-y-1">
          <li>Storage on this device: {storageUse}</li>
          <li>Offline support: {swState}</li>
          <li>Backend: {backendConfigured ? `configured (${SUPABASE_URL ? new URL(SUPABASE_URL).host : ''})` : 'not configured'}</li>
          <li>{plural(state.players.length, 'athlete')} · {plural(state.sessions.length, 'session')} · {plural(state.bookings.length, 'booking')} · {plural(state.films.length, 'film')}</li>
        </ul>
      </section>
    </div>
  );
};
