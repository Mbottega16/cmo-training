import React, { useCallback, useState } from 'react';
import { Calendar, Clock, MapPin, Dumbbell, CheckCircle2, Circle, Film, Bell, Video, CreditCard, ChevronRight, Phone, MessageSquare, ShoppingBag, Sparkles, Send } from 'lucide-react';
import type { Booking, NotifyPrefs, TrainingSession } from '../types';
import type { AppStore } from '../store';
import { cancellationPreview, DEFAULT_NOTIFY, sessionPhase, spotsLeft } from '../logic';
import { COACH } from '../seed';
import { formatAgo, formatCountdown, formatHours, formatSessionTime, plural, sessionTypeLabel, useNow } from '../format';
import { AthletePicker, Avatar, Modal, Switch, Toast, XpBadge, type ToastTone } from './ui';

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  pricePerSession: number;
  popular?: boolean;
  savings?: string;
}

const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 'single', name: '1 Drop-In Session', credits: 1, price: 65, pricePerSession: 65 },
  { id: 'pack_5', name: '5 Sessions Pack', credits: 5, price: 300, pricePerSession: 60, popular: true, savings: 'Save $25' },
  { id: 'pack_10', name: '10 Sessions Pack', credits: 10, price: 550, pricePerSession: 55, savings: 'Save $100' },
];

function downloadIcs(session: TrainingSession) {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const formatUtc = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

  const start = new Date(session.start);
  const end = new Date(session.end);
  const icsData = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CMO Training//Sessions//EN',
    'BEGIN:VEVENT',
    `UID:cmo-${session.id}@cmotraining.com`,
    `DTSTAMP:${formatUtc(new Date())}`,
    `DTSTART:${formatUtc(start)}`,
    `DTEND:${formatUtc(end)}`,
    `SUMMARY:${session.title} - CMO Training`,
    `LOCATION:${session.courtLocation}${session.courtAddress ? ` (${session.courtAddress})` : ''}`,
    'DESCRIPTION:Basketball training session with CMO Training Coach.',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${session.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

interface PlayerViewProps {
  store: AppStore;
  athleteId: string;
  /** Demo and dev page only: switch which athlete you are viewing as. */
  onSwitchAthlete?: (id: string) => void;
  onOpen: (tab: 'film' | 'room') => void;
}

export const PlayerView: React.FC<PlayerViewProps> = ({ store, athleteId, onSwitchAthlete, onOpen }) => {
  const { state, dispatch } = store;
  const { settings } = state;
  const LATE_CANCEL_HOURS = settings.lateCancelHours;
  const GRACE_HOURS = settings.graceHours;
  const now = useNow(1000);
  const player = state.players.find(p => p.id === athleteId) ?? state.players[0];

  const [bookingOpen, setBookingOpen] = useState(false);
  const [buyCreditsOpen, setBuyCreditsOpen] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<CreditPackage>(CREDIT_PACKAGES[1]);
  const [purchasing, setPurchasing] = useState(false);
  const [pickedSession, setPickedSession] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const clearToast = useCallback(() => setToast(null), []);
  const closeBooking = useCallback(() => {
    setBookingOpen(false);
    setPickedSession(null);
  }, []);
  const closeCancel = useCallback(() => setCancelTarget(null), []);

  if (!player) return null;

  const prefs: NotifyPrefs = state.notifyPrefs[player.id] ?? DEFAULT_NOTIFY;
  const myBookings = state.bookings
    .filter(b => b.playerId === player.id && (b.status === 'confirmed' || b.status === 'cancelled_late'))
    .map(b => ({ booking: b, session: state.sessions.find(s => s.id === b.sessionId) }))
    .filter((x): x is { booking: Booking; session: NonNullable<typeof x.session> } => Boolean(x.session) && sessionPhase(x.session!, now) !== 'ended')
    .sort((a, b) => new Date(a.session.start).getTime() - new Date(b.session.start).getTime());
  const myHomework = state.homework.filter(h => h.playerId === player.id);
  const myFilms = state.films.filter(f => f.playerId === player.id);
  const openSessions = state.sessions
    .filter(
      s =>
        sessionPhase(s, now) === 'upcoming' &&
        spotsLeft(state, s) > 0 &&
        !state.bookings.some(b => b.sessionId === s.id && b.playerId === player.id && b.status === 'confirmed')
    )
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const picked = openSessions.find(s => s.id === pickedSession) ?? null;

  const handlePurchase = async (pkg: CreditPackage) => {
    setPurchasing(true);
    const res = await dispatch({ type: 'player.credits', id: player.id, delta: pkg.credits }, { quiet: true });
    setPurchasing(false);
    if (res.ok) {
      setToast({
        message: `Purchased ${pkg.name}! Added ${plural(pkg.credits, 'credit')}.`,
        tone: 'good'
      });
      setBuyCreditsOpen(false);
    } else {
      setToast({ message: res.message || 'Payment could not be completed.', tone: 'bad' });
    }
  };

  const toggleNotify = async (key: keyof NotifyPrefs) => {
    const nextVal = !prefs[key];
    if (key === 'push' && nextVal && typeof Notification !== 'undefined') {
      if (Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          setToast({ message: 'Push notifications are blocked in your browser settings.', tone: 'warn' });
          return;
        }
      }
      try {
        new Notification('CMO Training', {
          body: "Notifications enabled! You'll receive alerts for sessions and new film breakdown reviews.",
          icon: '/icons/icon-192.png'
        });
      } catch {
        // Notification constructor handled
      }
    }
    void dispatch({ type: 'notify', playerId: player.id, prefs: { ...prefs, [key]: nextVal } });
  };

  const sendTestNotification = () => {
    if (typeof Notification === 'undefined') {
      setToast({ message: 'Notifications are not supported by this browser.', tone: 'bad' });
      return;
    }
    if (Notification.permission !== 'granted') {
      Notification.requestPermission().then(p => {
        if (p === 'granted') {
          new Notification('CMO Training', {
            body: 'Upcoming session: Ball Screen Reads at 6:00 PM at Court 2!',
            icon: '/icons/icon-192.png'
          });
          setToast({ message: 'Test notification sent to your screen!', tone: 'good' });
        } else {
          setToast({ message: 'Please allow notifications in your browser first.', tone: 'warn' });
        }
      });
      return;
    }
    new Notification('CMO Training', {
      body: 'Upcoming session: Ball Screen Reads at 6:00 PM at Court 2!',
      icon: '/icons/icon-192.png'
    });
    setToast({ message: 'Test notification sent to your screen!', tone: 'good' });
  };

  const confirmBooking = async () => {
    if (!picked) return;
    const result = await dispatch({ type: 'book', sessionId: picked.id, playerId: player.id }, { quiet: true });
    setToast({ message: result.message, tone: result.ok ? 'good' : 'bad' });
    if (result.ok) closeBooking();
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    const result = await dispatch({ type: 'cancel', bookingId: cancelTarget.id }, { quiet: true });
    const late = result.ok && result.message.startsWith('Late cancel');
    setToast({ message: result.message, tone: !result.ok ? 'bad' : late ? 'warn' : 'good' });
    setCancelTarget(null);
  };

  const cancelSession = cancelTarget ? state.sessions.find(s => s.id === cancelTarget.sessionId) : undefined;
  const cancelPreview = cancelSession ? cancellationPreview(cancelSession, now, settings) : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      {onSwitchAthlete && (
        <div className="flex justify-end">
          <AthletePicker label="Viewing as" players={state.players} value={player.id} onChange={onSwitchAthlete} />
        </div>
      )}

      <div className="bg-gradient-to-r from-brand-card via-brand-surface to-brand-card border border-brand-border rounded-2xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Avatar player={player} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-white">{player.name}</h2>
                <span className="text-[11px] bg-brand-orange/20 text-brand-orange border border-brand-orange/40 px-2 py-0.5 rounded font-semibold">{player.level}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                <span className="text-white font-medium">{plural(player.creditsRemaining, 'session credit')}</span> left ·{' '}
                <button type="button" onClick={() => setBuyCreditsOpen(true)} className="text-brand-orange hover:underline font-semibold">
                  + Add credits
                </button>
              </p>
              <div className="mt-1.5">
                <XpBadge xp={player.xp} />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {player.focusAreas.map(tag => (
                  <span key={tag} className="text-[10px] bg-brand-surface border border-brand-border px-2 py-0.5 rounded text-slate-300">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={() => setBuyCreditsOpen(true)}
              className="min-h-[48px] px-4 py-3 rounded-xl bg-brand-surface border border-brand-border hover:border-brand-orange text-white text-sm font-semibold transition flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-4 h-4 text-brand-orange" />
              Buy credits
            </button>
            <button
              onClick={() => setBookingOpen(true)}
              className="min-h-[48px] px-5 py-3 rounded-xl bg-brand-action hover:bg-brand-actionHover text-white text-sm font-bold transition shadow-lg shadow-brand-orange/20 flex items-center justify-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              Book a session
            </button>
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} tone={toast.tone} onDone={clearToast} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <section className="bg-brand-card border border-brand-border rounded-2xl p-4 sm:p-5 space-y-4" aria-label="My upcoming sessions">
            <div className="flex items-center justify-between pb-3 border-b border-brand-border">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand-orange" />
                <h3 className="text-sm font-bold text-white">My upcoming sessions</h3>
              </div>
              <span className="text-xs text-slate-400">{myBookings.filter(b => b.booking.status === 'confirmed').length} booked</span>
            </div>

            {myBookings.length === 0 && <p className="text-xs text-slate-400">Nothing booked. Use “Book a session”.</p>}

            <div className="space-y-3">
              {myBookings.map(({ booking, session }) => {
                const phase = sessionPhase(session, now);
                const late = booking.status === 'cancelled_late';
                return (
                  <div
                    key={booking.id}
                    className={`bg-brand-surface border rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
                      late ? 'border-brand-orange/40' : 'border-brand-border'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className={`font-bold text-sm ${late ? 'text-slate-400 line-through' : 'text-white'}`}>{session.title}</h4>
                        <span className="text-[10px] bg-brand-card border border-brand-border px-2 py-0.5 rounded text-slate-300">
                          {sessionTypeLabel(session.type, session.maxCapacity)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-1">
                        <span className="flex items-center gap-1 text-slate-200">
                          <Clock className="w-3.5 h-3.5 text-brand-orange" />
                          {formatSessionTime(session.start, session.end, now)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-brand-accent" />
                          {session.courtLocation}
                        </span>
                      </div>
                      {late && (
                        <div className="mt-2 text-xs text-orange-200 space-y-1">
                          <p>
                            Late cancel. Your credit is used in <span className="font-mono font-bold">{formatCountdown(new Date(booking.graceExpiresAt ?? 0).getTime() - now.getTime())}</span>{' '}
                            unless Coach waives it.
                          </p>
                          <p className="text-slate-400">Injury or emergency? Contact Coach:</p>
                          <div className="flex gap-2">
                            <a href={`sms:${COACH.phone}`} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-brand-card border border-brand-border text-slate-200 min-h-[44px]">
                              <MessageSquare className="w-3.5 h-3.5" /> Text
                            </a>
                            <a href={`tel:${COACH.phone}`} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-brand-card border border-brand-border text-slate-200 min-h-[44px]">
                              <Phone className="w-3.5 h-3.5" /> Call
                            </a>
                          </div>
                        </div>
                      )}
                    </div>

                    {!late && (
                      <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => downloadIcs(session)}
                          title="Add to Apple Calendar or Google Calendar (.ics)"
                          className="flex-1 sm:flex-initial min-h-[44px] px-3 py-2 rounded-xl bg-brand-surface border border-brand-border hover:border-slate-400 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                        >
                          <Calendar className="w-3.5 h-3.5 text-brand-orange" /> Calendar
                        </button>
                        {session.type === 'virtual_live' && (
                          <button
                            onClick={() => onOpen('room')}
                            className="flex-1 sm:flex-initial min-h-[44px] px-3.5 py-2 rounded-xl bg-brand-info hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                          >
                            <Video className="w-3.5 h-3.5" /> Join room
                          </button>
                        )}
                        {phase === 'live' ? (
                          <span className="text-[11px] text-brand-green font-medium bg-brand-green/10 border border-brand-green/30 px-2.5 py-2 rounded-lg flex items-center">Happening now</span>
                        ) : (
                          <button
                            onClick={() => setCancelTarget(booking)}
                            className="flex-1 sm:flex-initial min-h-[44px] px-3.5 py-2 rounded-xl bg-brand-card border border-brand-border hover:border-red-500/50 text-slate-300 hover:text-red-300 text-xs font-semibold"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="bg-brand-card border border-brand-border rounded-2xl p-4 sm:p-5 space-y-3" aria-label="Film from Coach">
            <div className="flex items-center gap-2 pb-3 border-b border-brand-border">
              <Film className="w-4 h-4 text-brand-orange" />
              <h3 className="text-sm font-bold text-white">Film from Coach</h3>
            </div>
            {myFilms.length === 0 && <p className="text-xs text-slate-400">No film reviews yet.</p>}
            {myFilms.map(f => {
              const strokes = f.drawings.reduce((n, d) => n + d.strokes.length, 0);
              return (
                <button
                  key={f.id}
                  onClick={() => onOpen('film')}
                  className="w-full text-left bg-brand-surface hover:bg-brand-border/40 border border-brand-border rounded-xl p-4 transition flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-white group-hover:text-brand-orange transition-colors truncate">{f.title}</h4>
                    <p className="text-xs text-slate-400">
                      {plural(f.notes.length, 'note')} · {plural(f.voiceNotes.length, 'voice memo')} · {plural(strokes, 'drawing')} · {formatAgo(f.uploadedAt, now)}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 group-hover:translate-x-1 transition-transform" />
                </button>
              );
            })}
          </section>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <section className="bg-brand-card border border-brand-border rounded-2xl p-4 sm:p-5 space-y-4" aria-label="Assigned drills">
            <div className="flex items-center justify-between pb-3 border-b border-brand-border">
              <div className="flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-brand-orange" />
                <h3 className="text-sm font-bold text-white">Assigned drills</h3>
              </div>
              <span className="text-xs text-slate-400">
                {myHomework.filter(h => h.completed).length}/{myHomework.length} done
              </span>
            </div>
            {myHomework.length === 0 && <p className="text-xs text-slate-400">No drills assigned yet.</p>}
            <div className="space-y-2.5">
              {myHomework.map(item => (
                <button
                  key={item.id}
                  role="checkbox"
                  aria-checked={item.completed}
                  onClick={() => void dispatch({ type: 'homework.toggle', id: item.id })}
                  className={`w-full text-left p-3 rounded-xl border transition ${
                    item.completed ? 'bg-brand-green/10 border-brand-green/30 text-slate-400' : 'bg-brand-surface border-brand-border text-white hover:border-slate-500'
                  }`}
                >
                  <span className="flex items-start gap-2.5">
                    <span className="mt-0.5 shrink-0">
                      {item.completed ? <CheckCircle2 className="w-4 h-4 text-brand-green" /> : <Circle className="w-4 h-4 text-slate-400" />}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-xs font-semibold ${item.completed ? 'line-through text-slate-400' : 'text-white'}`}>{item.title}</span>
                      <span className="block text-[11px] text-brand-orange mt-0.5">
                        {item.category} · {item.repsOrMinutes}
                      </span>
                      {item.notes && <span className="block text-[11px] text-slate-400 mt-1 italic">“{item.notes}”</span>}
                      <span className="block text-[10px] text-slate-400 mt-1">Assigned {formatAgo(item.assignedAt, now)}</span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="bg-brand-card border border-brand-border rounded-2xl p-4 sm:p-5 space-y-3" aria-label="Reminders and alerts">
            <div className="flex items-center gap-2 pb-2 border-b border-brand-border">
              <Bell className="w-4 h-4 text-brand-orange" />
              <h3 className="text-sm font-bold text-white">Reminders & alerts</h3>
            </div>
            <p className="text-xs text-slate-400">Manage your notifications for upcoming sessions, coach film breakdowns, and homework updates.</p>
            <div className="space-y-2 text-xs">
              <Switch checked={prefs.sms} onChange={() => toggleNotify('sms')} label="Text reminders" description="2 hours before each session" />
              <Switch checked={prefs.email} onChange={() => toggleNotify('email')} label="Email confirmations" description="Calendar invites and receipts" />
              <Switch checked={prefs.push} onChange={() => toggleNotify('push')} label="Push notifications" description="Alerts on your home screen or browser" />
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={sendTestNotification}
                className="w-full min-h-[44px] py-2 rounded-xl bg-brand-surface border border-brand-border hover:border-brand-orange text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <Bell className="w-3.5 h-3.5 text-brand-orange" /> Send test push notification
              </button>
            </div>
          </section>
        </div>
      </div>

      {bookingOpen && (
        <Modal title="Book a session" subtitle={`${plural(player.creditsRemaining, 'credit')} available`} onClose={closeBooking}>
          <div className="space-y-3 text-xs">
            {openSessions.length === 0 && <p className="text-slate-400">No open sessions right now.</p>}
            <div className="space-y-2" role="radiogroup" aria-label="Open sessions">
              {openSessions.map(s => {
                const hours = cancellationPreview(s, now, settings).hoursNotice;
                return (
                  <button
                    key={s.id}
                    role="radio"
                    aria-checked={pickedSession === s.id}
                    onClick={() => setPickedSession(s.id)}
                    className={`w-full text-left p-3 rounded-xl border transition ${
                      pickedSession === s.id ? 'border-brand-orange bg-brand-orange/10' : 'border-brand-border bg-brand-surface hover:border-slate-500'
                    }`}
                  >
                    <span className="block font-semibold text-white text-sm">{s.title}</span>
                    <span className="block text-slate-400">
                      {formatSessionTime(s.start, s.end, now)} · {s.courtLocation}
                    </span>
                    <span className="block text-slate-400">
                      {sessionTypeLabel(s.type, s.maxCapacity)} · {plural(spotsLeft(state, s), 'spot')} left · 1 credit or ${s.price}
                    </span>
                    {hours < LATE_CANCEL_HOURS && (
                      <span className="block text-brand-orange mt-1">Starts in {formatHours(hours)}: cancelling this one would count as late.</span>
                    )}
                  </button>
                );
              })}
            </div>

            <p className="text-slate-400 text-[11px] leading-relaxed">
              Cancel at least <strong>{LATE_CANCEL_HOURS} hours</strong> before to get the credit back. Later than that, the credit is held for {GRACE_HOURS} hours
              while Coach reviews it.
            </p>

            <button
              disabled={!picked || player.creditsRemaining < 1}
              onClick={confirmBooking}
              className="w-full min-h-[48px] py-3 rounded-xl bg-brand-action hover:bg-brand-actionHover disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition"
            >
              {player.creditsRemaining < 1 ? 'No credits left' : picked ? 'Book with 1 credit' : 'Pick a session'}
            </button>
            <button
              onClick={() => {
                closeBooking();
                setBuyCreditsOpen(true);
              }}
              className="w-full min-h-[44px] py-2.5 rounded-xl border border-brand-border hover:border-brand-orange text-slate-200 hover:text-white font-medium flex items-center justify-center gap-2 transition"
            >
              <CreditCard className="w-4 h-4 text-brand-orange" /> Pay with card or buy credits
            </button>
          </div>
        </Modal>
      )}

      {buyCreditsOpen && (
        <Modal title="Buy Session Credits" subtitle={`${player.name} · ${plural(player.creditsRemaining, 'credit')} current balance`} onClose={() => setBuyCreditsOpen(false)}>
          <div className="space-y-4 text-xs">
            <p className="text-slate-300 leading-relaxed">
              Credits never expire. They can be used for any 1-on-1, small group, or virtual film session with Coach.
            </p>

            <div className="space-y-2.5" role="radiogroup" aria-label="Credit packages">
              {CREDIT_PACKAGES.map(pkg => (
                <button
                  key={pkg.id}
                  type="button"
                  role="radio"
                  aria-checked={selectedPkg.id === pkg.id}
                  onClick={() => setSelectedPkg(pkg)}
                  className={`w-full text-left p-3.5 rounded-xl border transition flex items-center justify-between ${
                    selectedPkg.id === pkg.id
                      ? 'border-brand-orange bg-brand-orange/10'
                      : 'border-brand-border bg-brand-surface hover:border-slate-500'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{pkg.name}</span>
                      {pkg.popular && (
                        <span className="text-[10px] bg-brand-orange/20 text-brand-orange border border-brand-orange/40 px-2 py-0.5 rounded-full font-bold">
                          Popular
                        </span>
                      )}
                      {pkg.savings && (
                        <span className="text-[10px] bg-brand-green/20 text-brand-green border border-brand-green/40 px-2 py-0.5 rounded-full font-bold">
                          {pkg.savings}
                        </span>
                      )}
                    </div>
                    <span className="text-slate-400 text-xs mt-0.5 block">
                      ${pkg.pricePerSession} per session · Instant account credit
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-extrabold text-white font-mono">${pkg.price}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="p-3 bg-brand-surface rounded-xl border border-brand-border space-y-1.5 text-[11px] text-slate-400">
              <div className="flex justify-between text-white font-semibold">
                <span>Selected: {selectedPkg.name}</span>
                <span>${selectedPkg.price}</span>
              </div>
              <div>Includes 100% money-back guarantee if cancelled 6+ hours before court time.</div>
            </div>

            <button
              disabled={purchasing}
              onClick={() => handlePurchase(selectedPkg)}
              className="w-full min-h-[48px] py-3 rounded-xl bg-brand-action hover:bg-brand-actionHover disabled:opacity-50 text-white font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-brand-orange/20 text-sm"
            >
              <CreditCard className="w-4 h-4" />
              {purchasing ? 'Processing…' : `Pay $${selectedPkg.price} with Apple Pay / Card`}
            </button>
          </div>
        </Modal>
      )}

      {cancelTarget && cancelSession && cancelPreview && (
        <Modal title="Cancel this session?" subtitle={cancelSession.title} onClose={closeCancel}>
          <div className="space-y-3 text-sm">
            <p className="text-slate-300">
              {formatSessionTime(cancelSession.start, cancelSession.end, now)} · starts in {formatHours(cancelPreview.hoursNotice)}.
            </p>
            {cancelPreview.kind === 'early' ? (
              <p className="p-3 rounded-xl bg-brand-green/10 border border-brand-green/30 text-green-200 text-xs">
                That's {LATE_CANCEL_HOURS}+ hours' notice, so your credit comes back right away.
              </p>
            ) : (
              <p className="p-3 rounded-xl bg-brand-orange/10 border border-brand-orange/30 text-orange-200 text-xs">
                That's under {LATE_CANCEL_HOURS} hours' notice, a late cancel. Your credit is held for {GRACE_HOURS} hours. Coach can waive it for an injury
                or emergency; otherwise it's used.
                {settings.lateSpot === 'refill' && ' If the session fills back up before it starts, you get the credit back automatically.'}
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={closeCancel} className="flex-1 min-h-[44px] rounded-xl border border-brand-border text-slate-300">
                Keep it
              </button>
              <button onClick={confirmCancel} className="flex-1 min-h-[44px] rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold">
                Cancel session
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
