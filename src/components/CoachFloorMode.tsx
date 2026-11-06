import React, { useCallback, useMemo, useState } from 'react';
import { Check, X, Clock, MapPin, Dumbbell, Send, Users } from 'lucide-react';
import type { Player } from '../types';
import type { AppStore } from '../store';
import { attendanceWindow, confirmedBookings, sessionPhase } from '../logic';
import { formatSessionTime, plural, sessionTypeLabel, useNow } from '../format';
import { Avatar, Modal, Toast, XpBadge } from './ui';

const DRILL_CATEGORIES = ['Ball Handling', 'Shooting Mechanics', 'Finishing & Footwork', 'Decision Making / Reads', 'Conditioning & Agility', 'Defense'];

interface DrillPreset {
  title: string;
  category: string;
  repsOrMinutes: string;
  notes: string;
}

const DRILL_PRESETS: DrillPreset[] = [
  { title: 'Form Shooting 5-Spot', category: 'Shooting Mechanics', repsOrMinutes: '100 makes (20/spot)', notes: 'Elbow aligned under ball, hold follow-through until swish.' },
  { title: 'Two-Ball Pound & Cross', category: 'Ball Handling', repsOrMinutes: '10 mins continuous', notes: 'Eyes up, continuous heavy pound below knee level.' },
  { title: 'Mikan & Reverse Mikan', category: 'Finishing & Footwork', repsOrMinutes: '50 makes left & right', notes: 'High release off glass, do not let ball drop below chin.' },
  { title: 'Pick & Roll Read Series', category: 'Decision Making / Reads', repsOrMinutes: '20 live reps / video', notes: 'Snake vs drop, pocket pass vs weakside drift read.' },
  { title: 'Defensive Slides & Closeout', category: 'Defense', repsOrMinutes: '6 sets of 30s', notes: 'Choppy feet on closeout, contest with high hand without fouling.' },
  { title: 'Full-Court 17s Sprints', category: 'Conditioning & Agility', repsOrMinutes: '3 sets (under 65s)', notes: 'Touch sidelines with foot, recover with nasal breathing.' },
];

export const CoachFloorMode: React.FC<{ store: AppStore }> = ({ store }) => {
  const { state, dispatch } = store;
  const { settings } = state;
  const now = useNow(30_000);

  const sortedSessions = useMemo(
    () => [...state.sessions].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
    [state.sessions]
  );
  const defaultSession =
    sortedSessions.find(s => sessionPhase(s, now) === 'live') ?? sortedSessions.find(s => sessionPhase(s, now) === 'upcoming') ?? sortedSessions[0];
  const [selectedId, setSelectedId] = useState<string>(defaultSession?.id ?? '');
  const session = state.sessions.find(s => s.id === selectedId) ?? defaultSession;

  const [assignTo, setAssignTo] = useState<Player | null>(null);
  const [drillTitle, setDrillTitle] = useState('');
  const [drillCategory, setDrillCategory] = useState(DRILL_CATEGORIES[0]);
  const [drillReps, setDrillReps] = useState('100 reps / 10 mins');
  const [drillNote, setDrillNote] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);
  const closeModal = useCallback(() => setAssignTo(null), []);

  if (!session) {
    return <div className="bg-brand-card border border-brand-border rounded-2xl p-6 text-sm text-slate-400">No sessions yet.</div>;
  }

  const phase = sessionPhase(session, now);
  const roster = confirmedBookings(state, session.id)
    .map(b => ({ booking: b, player: state.players.find(p => p.id === b.playerId) }))
    .filter((r): r is { booking: typeof r.booking; player: Player } => Boolean(r.player));
  const checkedIn = roster.filter(r => r.booking.attendance === 'present').length;
  const checkInWindow = attendanceWindow(session, now, settings);
  const checkInOpen = checkInWindow === 'open';

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTo || !drillTitle.trim()) return;
    const who = assignTo.name;
    void dispatch({
      type: 'homework.assign',
      hw: { playerId: assignTo.id, title: drillTitle.trim(), category: drillCategory.trim() || 'General', repsOrMinutes: drillReps.trim(), notes: drillNote.trim() }
    }).then(r => r.ok && setToast(`Drill assigned to ${who}. It's in their portal now.`));
    setDrillTitle('');
    setDrillNote('');
    setAssignTo(null);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="bg-gradient-to-br from-brand-card to-brand-surface border border-brand-border rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-brand-border">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {phase === 'live' ? (
                <>
                  <span className="relative flex w-3 h-3">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-brand-orange opacity-75 animate-ping" />
                    <span className="relative inline-flex w-3 h-3 rounded-full bg-brand-orange" />
                  </span>
                  <span className="text-xs font-bold text-brand-orange uppercase tracking-wider font-mono">Live now</span>
                </>
              ) : (
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">{phase === 'upcoming' ? 'Upcoming session' : 'Ended'}</span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{session.title}</h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300 mt-1">
              <span className="flex items-center gap-1 font-medium text-white">
                <Clock className="w-3.5 h-3.5 text-brand-orange" />
                {formatSessionTime(session.start, session.end, now)}
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-brand-accent" />
                {session.courtLocation}
              </span>
              <span className="bg-brand-surface border border-brand-border px-2 py-0.5 rounded text-[11px] text-slate-300">
                {sessionTypeLabel(session.type, session.maxCapacity)}
              </span>
            </div>
          </div>

          <label className="w-full sm:w-auto">
            <span className="sr-only">Choose a session</span>
            <select
              value={session.id}
              onChange={e => setSelectedId(e.target.value)}
              className="w-full sm:w-72 bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-sm font-medium text-white focus:outline-none focus:border-brand-orange"
            >
              {sortedSessions.map(s => (
                <option key={s.id} value={s.id}>
                  {formatSessionTime(s.start, s.end, now).split(',')[0]} · {s.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="pt-3 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            {roster.length} / {session.maxCapacity} booked · {checkedIn} checked in
          </span>
          <span className="text-brand-orange font-medium">Check-in = +{settings.checkInXp} XP</span>
        </div>
      </div>

      {toast && <Toast message={toast} onDone={clearToast} />}

      {!checkInOpen && roster.length > 0 && (
        <div className="bg-brand-surface border border-brand-border rounded-xl px-4 py-3 text-xs text-slate-300">
          {checkInWindow === 'early'
            ? `Check-in opens ${settings.checkInOpensMinutes} minutes before the session starts. You can still assign drills.`
            : 'Check-in for this session is closed.'}
        </div>
      )}

      <section className="space-y-3" aria-label="Court roster and check-in">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">Court Roster & Check-In</h3>

        {roster.length === 0 && (
          <div className="bg-brand-card border border-dashed border-brand-border rounded-2xl p-6 text-center text-sm text-slate-400">
            Nobody is booked for this session yet. Athletes book from their portal.
          </div>
        )}

        {roster.map(({ booking, player }) => {
          const status = booking.attendance;
          return (
            <div
              key={booking.id}
              className={`bg-brand-card border rounded-2xl p-4 transition ${
                status === 'present' ? 'border-brand-green/50 bg-brand-green/5' : status === 'absent' ? 'border-red-500/50 bg-red-500/5' : 'border-brand-border'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <Avatar player={player} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-white text-base">{player.name}</h4>
                      <span className="text-[10px] bg-brand-surface border border-brand-border px-2 py-0.5 rounded text-slate-300 font-medium">{player.level}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-1">
                      <span>{plural(player.creditsRemaining, 'credit')} left</span>
                      <XpBadge xp={player.xp} />
                    </div>
                  </div>
                </div>

                <div className="flex items-stretch gap-2">
                  <button
                    onClick={() => void dispatch({ type: 'attendance', bookingId: booking.id, attendance: status === 'present' ? 'pending' : 'present' })}
                    disabled={!checkInOpen}
                    aria-pressed={status === 'present'}
                    className={`flex-1 sm:flex-initial min-h-[48px] py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition disabled:opacity-40 disabled:cursor-not-allowed ${
                      status === 'present'
                        ? 'bg-brand-success text-white shadow-lg shadow-brand-green/20'
                        : 'bg-brand-surface border border-brand-border hover:border-brand-green/60 text-slate-200'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    {status === 'present' ? `Checked in (+${settings.checkInXp} XP)` : 'Check in'}
                  </button>

                  <button
                    onClick={() => void dispatch({ type: 'attendance', bookingId: booking.id, attendance: status === 'absent' ? 'pending' : 'absent' })}
                    disabled={!checkInOpen}
                    aria-pressed={status === 'absent'}
                    aria-label={status === 'absent' ? `Undo no-show for ${player.name}` : `Mark ${player.name} as a no-show`}
                    title="No-show"
                    className={`min-h-[48px] min-w-[48px] px-3 rounded-xl text-sm font-bold flex items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed ${
                      status === 'absent' ? 'bg-red-600 text-white' : 'bg-brand-surface border border-brand-border text-slate-400 hover:text-red-400'
                    }`}
                  >
                    <X className="w-4 h-4" />
                    {status === 'absent' && <span className="ml-1">No-show</span>}
                  </button>

                  <button
                    onClick={() => setAssignTo(player)}
                    className="flex-1 sm:flex-initial min-h-[48px] py-3 px-4 rounded-xl text-sm font-bold bg-brand-surface border border-brand-border hover:border-brand-orange text-slate-200 hover:text-white flex items-center justify-center gap-2 transition"
                  >
                    <Dumbbell className="w-4 h-4 text-brand-orange" />
                    Assign drill
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {assignTo && (
        <Modal
          title="Assign Homework Drill"
          subtitle={
            <>
              Assigning to <span className="text-brand-orange font-semibold">{assignTo.name}</span>
            </>
          }
          onClose={closeModal}
        >
          <form onSubmit={handleAssign} className="space-y-3.5 text-sm">
            <div>
              <span className="block text-slate-300 font-semibold mb-1 text-xs">Quick presets (fill the form, then edit)</span>
              <div className="flex gap-2 overflow-x-auto pb-1.5">
                {DRILL_PRESETS.map(p => (
                  <button
                    key={p.title}
                    type="button"
                    aria-pressed={drillTitle === p.title}
                    onClick={() => {
                      setDrillTitle(p.title);
                      setDrillCategory(p.category);
                      setDrillReps(p.repsOrMinutes);
                      setDrillNote(p.notes);
                    }}
                    className={`shrink-0 min-h-[44px] text-xs px-3 rounded-lg border transition font-medium ${
                      drillTitle === p.title ? 'border-brand-orange bg-brand-orange/10 text-white' : 'bg-brand-surface border-brand-border hover:border-brand-orange text-slate-300 hover:text-white'
                    }`}
                  >
                    {p.title}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="block text-slate-300 font-semibold mb-1 text-xs">Drill / focus</span>
              <input
                type="text"
                required
                maxLength={120}
                placeholder="e.g. Punch dribble to drop cross"
                value={drillTitle}
                onChange={e => setDrillTitle(e.target.value)}
                className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-brand-orange"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-slate-300 font-semibold mb-1 text-xs">Category (pick or type your own)</span>
                <input
                  list="drill-categories"
                  maxLength={60}
                  value={drillCategory}
                  onChange={e => setDrillCategory(e.target.value)}
                  className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-brand-orange"
                />
                <datalist id="drill-categories">
                  {DRILL_CATEGORIES.map(c => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>

              <label className="block">
                <span className="block text-slate-300 font-semibold mb-1 text-xs">Target volume / reps</span>
                <input
                  type="text"
                  maxLength={60}
                  value={drillReps}
                  onChange={e => setDrillReps(e.target.value)}
                  placeholder="e.g. 50 makes, 15 mins"
                  className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-brand-orange"
                />
              </label>
            </div>

            <label className="block">
              <span className="block text-slate-300 font-semibold mb-1 text-xs">Key teaching cue</span>
              <textarea
                rows={2}
                maxLength={400}
                placeholder="e.g. Stay low on the second gather"
                value={drillNote}
                onChange={e => setDrillNote(e.target.value)}
                className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-brand-orange"
              />
            </label>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={closeModal} className="flex-1 py-3 rounded-xl border border-brand-border text-slate-400 hover:text-white">
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl bg-brand-action hover:bg-brand-actionHover text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-orange/20"
              >
                <Send className="w-4 h-4" />
                Assign drill
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
