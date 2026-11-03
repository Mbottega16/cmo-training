import React, { useCallback, useState } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2, HeartHandshake, DollarSign, Clock, History } from 'lucide-react';
import type { Booking } from '../types';
import type { AppStore } from '../store';
import { cancellationPreview, sessionPhase } from '../logic';
import { formatAgo, formatCountdown, formatHours, formatSessionTime, useNow } from '../format';
import { AthletePicker, Avatar, Toast, type ToastTone } from './ui';

const STATUS_TEXT: Record<Booking['status'], { label: string; tone: string }> = {
  confirmed: { label: 'Booked', tone: 'text-slate-300' },
  cancelled_early: { label: 'Cancelled in time · credit restored', tone: 'text-brand-green' },
  cancelled_late: { label: 'Late cancel · waiting on Coach', tone: 'text-brand-orange' },
  excused: { label: 'Late cancel waived · credit restored', tone: 'text-brand-green' },
  forfeited: { label: 'Late cancel enforced · credit used', tone: 'text-red-400' }
};

export const CancellationEngine: React.FC<{ store: AppStore }> = ({ store }) => {
  const { state, dispatch } = store;
  const { settings } = state;
  const LATE_CANCEL_HOURS = settings.lateCancelHours;
  const GRACE_HOURS = settings.graceHours;
  const now = useNow(1000);
  const [tryAthlete, setTryAthlete] = useState(state.players[0]?.id ?? '');
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  const lookup = (b: Booking) => ({
    player: state.players.find(p => p.id === b.playerId),
    session: state.sessions.find(s => s.id === b.sessionId)
  });

  const pending = state.bookings.filter(b => b.status === 'cancelled_late');
  const history = state.bookings
    .filter(b => b.status === 'cancelled_early' || b.status === 'excused' || b.status === 'forfeited')
    .sort((a, b) => new Date(b.decidedAt ?? b.cancelledAt ?? 0).getTime() - new Date(a.decidedAt ?? a.cancelledAt ?? 0).getTime())
    .slice(0, 8);

  const tryBookings = state.bookings.filter(b => {
    if (b.playerId !== tryAthlete || b.status !== 'confirmed') return false;
    const session = state.sessions.find(s => s.id === b.sessionId);
    return session ? sessionPhase(session, now) === 'upcoming' : false;
  });

  const act = async (type: 'waive' | 'enforce', bookingId: string, tone: ToastTone) => {
    const result = await dispatch({ type, bookingId }, { quiet: true });
    setToast({ message: result.message, tone: result.ok ? tone : 'bad' });
  };

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-brand-card to-brand-surface border border-brand-border rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-brand-orange" />
          <h2 className="text-lg font-bold text-white">Cancellations & 24-Hour Grace</h2>
        </div>
        <p className="text-xs text-slate-400 mt-1">Protects the coach's gym time while giving athletes a fair path for real emergencies.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 text-xs">
          <div className="p-4 rounded-xl border border-brand-green/40 bg-brand-card">
            <div className="flex items-center gap-2 mb-1.5 text-brand-green font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              Cancel {LATE_CANCEL_HOURS}+ hours before
            </div>
            <p className="text-slate-300">The spot opens up and the session credit comes back right away.</p>
          </div>
          <div className="p-4 rounded-xl border border-brand-orange/40 bg-brand-card">
            <div className="flex items-center gap-2 mb-1.5 text-brand-orange font-semibold">
              <AlertTriangle className="w-4 h-4" />
              Cancel under {LATE_CANCEL_HOURS} hours before
            </div>
            <p className="text-slate-300">
              The credit is held for {GRACE_HOURS} hours. Coach can waive it (injury, emergency) or enforce it. If Coach does nothing, it is
              used when the {GRACE_HOURS} hours run out.{' '}
              {settings.lateSpot === 'refill'
                ? 'Meanwhile the spot is open to others; if the session fills back up, the athlete gets the credit back automatically (empty spots fill first).'
                : 'The spot stays empty.'}
            </p>
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} tone={toast.tone} onDone={clearToast} />}

      <section className="bg-brand-card border border-brand-border rounded-2xl p-4 sm:p-5 space-y-3" aria-label="Late cancels waiting on you">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-brand-orange" /> Waiting on you ({pending.length})
        </h3>
        {pending.length === 0 && <p className="text-xs text-slate-400">No late cancels to review. Try one below.</p>}
        {pending.map(b => {
          const { player, session } = lookup(b);
          if (!player || !session) return null;
          const left = new Date(b.graceExpiresAt ?? 0).getTime() - now.getTime();
          return (
            <div key={b.id} className="bg-brand-surface border border-brand-orange/30 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Avatar player={player} size="sm" />
                <div className="min-w-0 flex-1 text-xs">
                  <div className="font-bold text-white text-sm">{player.name}</div>
                  <div className="text-slate-300">
                    {session.title} · {formatSessionTime(session.start, session.end, now)}
                  </div>
                  <div className="text-slate-400">
                    Cancelled with {formatHours(b.hoursNoticeAtCancel ?? 0)} notice · {b.cancelledAt ? formatAgo(b.cancelledAt, now) : ''}
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-[10px] text-slate-400 uppercase">Credit used in</div>
                  <div className="text-sm font-bold text-brand-orange" aria-live="off">
                    {formatCountdown(left)}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => act('waive', b.id, 'good')}
                  className="min-h-[44px] text-xs font-semibold bg-brand-success hover:bg-green-800 text-white py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5"
                >
                  <HeartHandshake className="w-4 h-4" /> Waive & excuse
                </button>
                <button
                  onClick={() => act('enforce', b.id, 'warn')}
                  className="min-h-[44px] text-xs font-semibold bg-brand-card hover:bg-red-500/20 border border-brand-border hover:border-red-500/40 text-slate-200 hover:text-red-300 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5"
                >
                  <DollarSign className="w-4 h-4" /> Enforce
                </button>
              </div>
            </div>
          );
        })}
      </section>

      <section className="bg-brand-card border border-brand-border rounded-2xl p-4 sm:p-5 space-y-3" aria-label="Cancel for an athlete">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white">Cancel for an athlete</h3>
            <p className="text-xs text-slate-400">If an athlete calls or texts to cancel, do it here. The same rules apply as when they cancel in their app.</p>
          </div>
          <AthletePicker players={state.players} value={tryAthlete} onChange={setTryAthlete} />
        </div>
        {tryBookings.length === 0 && <p className="text-xs text-slate-400">This athlete has no upcoming bookings.</p>}
        {tryBookings.map(b => {
          const { session } = lookup(b);
          if (!session) return null;
          const preview = cancellationPreview(session, now, settings);
          return (
            <div key={b.id} className="bg-brand-surface border border-brand-border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <div className="font-semibold text-white">{session.title}</div>
                <div className="text-slate-400">
                  {formatSessionTime(session.start, session.end, now)} · starts in {formatHours(preview.hoursNotice)}
                </div>
                <div className={preview.kind === 'early' ? 'text-brand-green' : 'text-brand-orange'}>
                  {preview.kind === 'early' ? 'Cancelling now restores the credit.' : `Cancelling now is a late cancel (${GRACE_HOURS}h grace).`}
                </div>
              </div>
              <button
                onClick={async () => {
                  const result = await dispatch({ type: 'cancel', bookingId: b.id }, { quiet: true });
                  setToast({ message: result.message, tone: result.ok ? (preview.kind === 'early' ? 'good' : 'warn') : 'bad' });
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-brand-card border border-brand-border hover:border-brand-orange text-slate-200 font-semibold"
              >
                Cancel for them
              </button>
            </div>
          );
        })}
      </section>

      {history.length > 0 && (
        <section className="bg-brand-card border border-brand-border rounded-2xl p-4 sm:p-5 space-y-2" aria-label="Recent decisions">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" /> Recent
          </h3>
          {history.map(b => {
            const { player, session } = lookup(b);
            if (!player || !session) return null;
            const s = b.decisionReason === 'refilled' ? { label: 'Spot refilled · credit restored', tone: 'text-brand-green' } : b.decisionReason === 'expired' ? { label: 'Grace ran out · credit used', tone: 'text-red-400' } : STATUS_TEXT[b.status];
            return (
              <div key={b.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs border-b border-brand-border/50 last:border-0 py-2">
                <span className="text-slate-200">
                  {player.name} · {session.title}
                </span>
                <span className={s.tone}>{s.label}</span>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
};
