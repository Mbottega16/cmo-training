import React, { useCallback, useState } from 'react';
import { Plus, Minus, UserPlus, CalendarPlus, Trash2, KeyRound } from 'lucide-react';
import type { AppStore } from '../store';
import type { SessionType } from '../types';
import { confirmedBookings, sessionPhase } from '../logic';
import { formatSessionTime, plural, sessionTypeLabel, useNow } from '../format';
import { pageUrl } from '../router';
import { Avatar, Toast, XpBadge, type ToastTone } from './ui';

const field = 'w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-orange';
const label = 'block text-xs font-semibold text-slate-300 mb-1';

function localInputValue(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The coach's admin: athletes (credits, invites) and the schedule. Payments happen outside the app for now, so credits are added here. */
export const CoachManage: React.FC<{ store: AppStore }> = ({ store }) => {
  const { state, dispatch, backend } = store;
  const now = useNow(60_000);
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const clearToast = useCallback(() => setToast(null), []);
  const [invite, setInvite] = useState<{ name: string; code: string } | null>(null);

  const [name, setName] = useState('');
  const [level, setLevel] = useState('');
  const [startCredits, setStartCredits] = useState(0);

  const tomorrow = new Date(now.getTime() + 24 * 3_600_000);
  tomorrow.setMinutes(0, 0, 0);
  const [title, setTitle] = useState('');
  const [where, setWhere] = useState('');
  const [startAt, setStartAt] = useState(localInputValue(tomorrow));
  const [minutes, setMinutes] = useState(60);
  const [type, setType] = useState<SessionType>('small_group');
  const [capacity, setCapacity] = useState(6);
  const [price, setPrice] = useState(65);

  const report = (r: { ok: boolean; message: string }) => r.message && setToast({ message: r.message, tone: r.ok ? 'good' : 'bad' });

  const addAthlete = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await dispatch({ type: 'player.add', player: { name, level: level.trim(), focusAreas: [], phone: '', email: '', creditsRemaining: startCredits } }, { quiet: true });
    report(r);
    if (r.ok) {
      setName('');
      setLevel('');
      setStartCredits(0);
    }
  };

  const addSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const start = new Date(startAt);
    const r = await dispatch(
      {
        type: 'session.add',
        session: {
          title: title.trim(),
          courtLocation: type === 'virtual_live' ? 'CMO Video Room' : where.trim(),
          courtAddress: type === 'virtual_live' ? 'Online' : '',
          start: Number.isNaN(start.getTime()) ? '' : start.toISOString(),
          end: Number.isNaN(start.getTime()) ? '' : new Date(start.getTime() + minutes * 60_000).toISOString(),
          type,
          maxCapacity: type === 'one_on_one' || type === 'virtual_live' ? 1 : capacity,
          price
        }
      },
      { quiet: true }
    );
    report(r);
    if (r.ok) setTitle('');
  };

  const makeInvite = async (playerId: string, playerName: string) => {
    if (!backend.auth) return;
    const r = await backend.auth.createInvite('athlete', playerId);
    if (r.code) setInvite({ name: playerName, code: r.code });
    else setToast({ message: r.error ?? 'Could not create an invite.', tone: 'bad' });
  };

  const upcoming = [...state.sessions].filter(s => sessionPhase(s, now) !== 'ended').sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.message} tone={toast.tone} onDone={clearToast} />}

      <section className="bg-brand-card border border-brand-border rounded-2xl p-4 sm:p-5 space-y-4" aria-label="Athletes">
        <div>
          <h2 className="text-base font-bold text-white">Athletes</h2>
          <p className="text-xs text-slate-400">Payments happen outside the app for now (cash, Venmo, e-transfer), so add credits here when an athlete pays.</p>
        </div>

        {invite && (
          <div role="status" className="bg-brand-info/10 border border-brand-accent/40 rounded-xl p-3 text-sm text-blue-100 space-y-1">
            <p>
              Invite for <strong>{invite.name}</strong>: <span className="font-mono text-lg tracking-widest text-white">{invite.code}</span>
            </p>
            <p className="text-xs text-blue-200 break-all">
              Send them this link and the code: {pageUrl('athlete')}. They create an account, then enter the code once.
            </p>
          </div>
        )}

        <ul className="space-y-2">
          {state.players.map(p => (
            <li key={p.id} className="bg-brand-surface border border-brand-border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar player={p} size="sm" />
                <div className="min-w-0">
                  <div className="font-semibold text-white text-sm truncate">{p.name}</div>
                  <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-2">
                    <span>{p.level || 'No level set'}</span>
                    <XpBadge xp={p.xp} />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => void dispatch({ type: 'player.credits', id: p.id, delta: -1 })} disabled={p.creditsRemaining < 1} aria-label={`Remove a credit from ${p.name}`} className="min-w-[44px] min-h-[44px] rounded-xl border border-brand-border text-slate-200 flex items-center justify-center disabled:opacity-40">
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-sm text-white font-mono w-20 text-center" aria-live="polite">
                  {plural(p.creditsRemaining, 'credit')}
                </span>
                <button onClick={() => void dispatch({ type: 'player.credits', id: p.id, delta: 1 })} aria-label={`Add a credit for ${p.name}`} className="min-w-[44px] min-h-[44px] rounded-xl border border-brand-border text-slate-200 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </button>
                <button onClick={() => void dispatch({ type: 'player.credits', id: p.id, delta: 5 })} className="min-h-[44px] px-3 rounded-xl border border-brand-border text-slate-200 text-xs font-semibold">
                  +5
                </button>
                {backend.auth && (
                  <button onClick={() => void makeInvite(p.id, p.name)} className="min-h-[44px] px-3 rounded-xl border border-brand-border text-slate-200 text-xs font-semibold flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" /> Invite
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        <form onSubmit={addAthlete} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end pt-2 border-t border-brand-border">
          <label className="sm:col-span-2">
            <span className={label}>New athlete's name</span>
            <input required maxLength={80} value={name} onChange={e => setName(e.target.value)} className={field} placeholder="e.g. Sam Rivera" />
          </label>
          <label>
            <span className={label}>Level (optional)</span>
            <input maxLength={80} value={level} onChange={e => setLevel(e.target.value)} className={field} placeholder="e.g. HS Junior" />
          </label>
          <label>
            <span className={label}>Starting credits</span>
            <input type="number" min={0} max={500} inputMode="numeric" value={startCredits} onChange={e => setStartCredits(Number(e.target.value))} className={field} />
          </label>
          <button type="submit" className="sm:col-span-4 min-h-[44px] rounded-xl bg-brand-action hover:bg-brand-actionHover text-white font-semibold text-sm flex items-center justify-center gap-2">
            <UserPlus className="w-4 h-4" /> Add athlete
          </button>
        </form>
      </section>

      <section className="bg-brand-card border border-brand-border rounded-2xl p-4 sm:p-5 space-y-4" aria-label="Schedule">
        <h2 className="text-base font-bold text-white">Schedule</h2>
        {upcoming.length === 0 && <p className="text-xs text-slate-400">No upcoming sessions.</p>}
        <ul className="space-y-2">
          {upcoming.map(s => (
            <li key={s.id} className="bg-brand-surface border border-brand-border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <div className="font-semibold text-white text-sm">{s.title}</div>
                <div className="text-slate-400">
                  {formatSessionTime(s.start, s.end, now)} · {s.courtLocation || 'No location'} · {sessionTypeLabel(s.type, s.maxCapacity)} · {confirmedBookings(state, s.id).length}/{s.maxCapacity} booked
                </div>
              </div>
              <button
                onClick={() => {
                  if (window.confirm(`Delete “${s.title}”? Everyone booked gets their credit back.`)) void dispatch({ type: 'session.delete', id: s.id }, { quiet: true }).then(report);
                }}
                aria-label={`Delete ${s.title}`}
                className="min-w-[44px] min-h-[44px] self-end sm:self-auto rounded-xl border border-brand-border text-slate-400 hover:text-red-400 flex items-center justify-center"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>

        <form onSubmit={addSession} className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end pt-2 border-t border-brand-border">
          <label className="sm:col-span-3">
            <span className={label}>Session title</span>
            <input required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} className={field} placeholder="e.g. Ball Screen Reads" />
          </label>
          <label className="sm:col-span-3">
            <span className={label}>Gym / court</span>
            <input maxLength={120} value={where} onChange={e => setWhere(e.target.value)} disabled={type === 'virtual_live'} className={`${field} disabled:opacity-50`} placeholder="e.g. The Fieldhouse — Court 2" />
          </label>
          <label className="sm:col-span-2">
            <span className={label}>Starts</span>
            <input type="datetime-local" required value={startAt} onChange={e => setStartAt(e.target.value)} className={field} />
          </label>
          <label>
            <span className={label}>Minutes</span>
            <input type="number" min={15} max={240} step={15} inputMode="numeric" value={minutes} onChange={e => setMinutes(Number(e.target.value))} className={field} />
          </label>
          <label>
            <span className={label}>Type</span>
            <select value={type} onChange={e => setType(e.target.value as SessionType)} className={field}>
              <option value="small_group">Small group</option>
              <option value="one_on_one">1-on-1</option>
              <option value="virtual_live">Video</option>
            </select>
          </label>
          <label>
            <span className={label}>Spots</span>
            <input type="number" min={1} max={50} inputMode="numeric" value={type === 'small_group' ? capacity : 1} disabled={type !== 'small_group'} onChange={e => setCapacity(Number(e.target.value))} className={`${field} disabled:opacity-50`} />
          </label>
          <label>
            <span className={label}>Price ($)</span>
            <input type="number" min={0} max={10000} inputMode="decimal" value={price} onChange={e => setPrice(Number(e.target.value))} className={field} />
          </label>
          <button type="submit" className="sm:col-span-6 min-h-[44px] rounded-xl bg-brand-action hover:bg-brand-actionHover text-white font-semibold text-sm flex items-center justify-center gap-2">
            <CalendarPlus className="w-4 h-4" /> Add session
          </button>
        </form>
      </section>
    </div>
  );
};
