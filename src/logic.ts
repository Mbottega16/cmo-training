/**
 * Every rule of the demo as plain functions: (state, input, now) -> new state.
 * No React and no browser APIs here, so tests/logic.test.ts can run it under Node.
 * When the backend exists these same rules must run on the server; the browser copy
 * is only for the demo (anyone can edit their own browser storage).
 */
import type {
  Booking,
  DemoState,
  DrawingFrame,
  HomeworkAssignment,
  NotifyPrefs,
  Stroke,
  TrainingSession
} from './types';

export const LATE_CANCEL_HOURS = 6;
export const GRACE_HOURS = 24;
export const CHECK_IN_XP = 50;
/** Two drawings closer than this (seconds) belong to the same frame. */
export const FRAME_MATCH_SECONDS = 0.15;

const HOUR = 3_600_000;

export type Result<T = DemoState> = { ok: true; state: T; message: string } | { ok: false; state: T; message: string };

let counter = 0;
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function hoursUntil(iso: string, now: Date): number {
  return (new Date(iso).getTime() - now.getTime()) / HOUR;
}

export function sessionPhase(session: TrainingSession, now: Date): 'upcoming' | 'live' | 'ended' {
  const start = new Date(session.start).getTime();
  const end = new Date(session.end).getTime();
  const n = now.getTime();
  if (n < start) return 'upcoming';
  if (n < end) return 'live';
  return 'ended';
}

export function confirmedBookings(state: DemoState, sessionId: string): Booking[] {
  return state.bookings.filter(b => b.sessionId === sessionId && b.status === 'confirmed');
}

/**
 * A late cancel keeps the court time locked (the policy: "late cancellations lock court time"), so its spot is not
 * resold while the athlete's credit is held or after it is used. Only a timely cancel or a coach waiver frees it.
 */
export function holdsSpot(b: Booking): boolean {
  return b.status === 'confirmed' || b.status === 'cancelled_late' || b.status === 'forfeited';
}

export function spotsLeft(state: DemoState, session: TrainingSession): number {
  return session.maxCapacity - state.bookings.filter(b => b.sessionId === session.id && holdsSpot(b)).length;
}

/** Check-in opens shortly before a session and closes a while after it, so XP can't be given for future sessions. */
export const CHECK_IN_OPENS_MINUTES = 30;
export const CHECK_IN_CLOSES_HOURS = 12;

export function attendanceWindow(session: TrainingSession, now: Date): 'early' | 'open' | 'closed' {
  const opens = new Date(session.start).getTime() - CHECK_IN_OPENS_MINUTES * 60_000;
  const closes = new Date(session.end).getTime() + CHECK_IN_CLOSES_HOURS * HOUR;
  const n = now.getTime();
  if (n < opens) return 'early';
  return n <= closes ? 'open' : 'closed';
}

/** What a cancel right now would mean, before the athlete confirms it. */
export function cancellationPreview(session: TrainingSession, now: Date): { kind: 'early' | 'late' | 'started'; hoursNotice: number } {
  const hoursNotice = hoursUntil(session.start, now);
  if (hoursNotice <= 0) return { kind: 'started', hoursNotice };
  return { kind: hoursNotice >= LATE_CANCEL_HOURS ? 'early' : 'late', hoursNotice };
}

function updatePlayerCredits(state: DemoState, playerId: string, delta: number): DemoState {
  return {
    ...state,
    players: state.players.map(p => (p.id === playerId ? { ...p, creditsRemaining: Math.max(0, p.creditsRemaining + delta) } : p))
  };
}

function updateBooking(state: DemoState, bookingId: string, patch: Partial<Booking>): DemoState {
  return { ...state, bookings: state.bookings.map(b => (b.id === bookingId ? { ...b, ...patch } : b)) };
}

export function bookSession(state: DemoState, sessionId: string, playerId: string, now: Date): Result {
  const session = state.sessions.find(s => s.id === sessionId);
  const player = state.players.find(p => p.id === playerId);
  if (!session || !player) return { ok: false, state, message: 'That session or athlete no longer exists.' };
  if (sessionPhase(session, now) !== 'upcoming') return { ok: false, state, message: 'That session has already started.' };
  if (confirmedBookings(state, sessionId).some(b => b.playerId === playerId)) {
    return { ok: false, state, message: `${player.name} is already booked for this session.` };
  }
  if (spotsLeft(state, session) <= 0) return { ok: false, state, message: 'That session is full.' };
  if (player.creditsRemaining < 1) return { ok: false, state, message: 'No session credits left. Card payments arrive with the Stripe connection.' };

  const booking: Booking = {
    id: uid('b'),
    sessionId,
    playerId,
    status: 'confirmed',
    attendance: 'pending',
    bookedAt: now.toISOString()
  };
  const next = updatePlayerCredits({ ...state, bookings: [...state.bookings, booking] }, playerId, -1);
  return { ok: true, state: next, message: `Booked ${session.title}. 1 credit used.` };
}

export function cancelBooking(state: DemoState, bookingId: string, now: Date): Result {
  const booking = state.bookings.find(b => b.id === bookingId);
  if (!booking || booking.status !== 'confirmed') return { ok: false, state, message: 'That booking is not active.' };
  const session = state.sessions.find(s => s.id === booking.sessionId);
  if (!session) return { ok: false, state, message: 'That session no longer exists.' };

  const preview = cancellationPreview(session, now);
  if (preview.kind === 'started') {
    return { ok: false, state, message: 'The session has started, so it can no longer be cancelled.' };
  }
  const hoursNoticeAtCancel = Math.round(preview.hoursNotice * 10) / 10;
  if (preview.kind === 'early') {
    const next = updatePlayerCredits(
      updateBooking(state, bookingId, { status: 'cancelled_early', cancelledAt: now.toISOString(), hoursNoticeAtCancel }),
      booking.playerId,
      1
    );
    return { ok: true, state: next, message: `Cancelled with ${hoursNoticeAtCancel} hours' notice. Your credit is back.` };
  }
  const next = updateBooking(state, bookingId, {
    status: 'cancelled_late',
    cancelledAt: now.toISOString(),
    graceExpiresAt: new Date(now.getTime() + GRACE_HOURS * HOUR).toISOString(),
    hoursNoticeAtCancel
  });
  return {
    ok: true,
    state: next,
    message: `Late cancel (${hoursNoticeAtCancel} hours' notice). The credit is held for ${GRACE_HOURS} hours while Coach reviews it.`
  };
}

export function waiveLateCancel(state: DemoState, bookingId: string, now: Date): Result {
  const booking = state.bookings.find(b => b.id === bookingId);
  if (!booking || booking.status !== 'cancelled_late') return { ok: false, state, message: 'Only a pending late cancel can be waived.' };
  const next = updatePlayerCredits(updateBooking(state, bookingId, { status: 'excused', decidedAt: now.toISOString() }), booking.playerId, 1);
  return { ok: true, state: next, message: 'Waived. The credit is restored.' };
}

export function enforceLateCancel(state: DemoState, bookingId: string, now: Date): Result {
  const booking = state.bookings.find(b => b.id === bookingId);
  if (!booking || booking.status !== 'cancelled_late') return { ok: false, state, message: 'Only a pending late cancel can be enforced.' };
  return {
    ok: true,
    state: updateBooking(state, bookingId, { status: 'forfeited', decidedAt: now.toISOString() }),
    message: 'Enforced. The credit stays used.'
  };
}

/** Late cancels whose grace window has run out become forfeits. */
export function expireGraceWindows(state: DemoState, now: Date): DemoState {
  const expired = state.bookings.filter(
    b => b.status === 'cancelled_late' && b.graceExpiresAt && new Date(b.graceExpiresAt).getTime() <= now.getTime()
  );
  if (expired.length === 0) return state;
  const ids = new Set(expired.map(b => b.id));
  return {
    ...state,
    bookings: state.bookings.map(b => (ids.has(b.id) ? { ...b, status: 'forfeited', decidedAt: b.graceExpiresAt } : b))
  };
}

/**
 * Check-in, no-show, or back to pending, only while the session's check-in window is open.
 * Check-in earns XP; undoing it takes the XP back.
 */
export function setAttendance(state: DemoState, bookingId: string, attendance: Booking['attendance'], now: Date): DemoState {
  const booking = state.bookings.find(b => b.id === bookingId);
  if (!booking || booking.status !== 'confirmed' || booking.attendance === attendance) return state;
  const session = state.sessions.find(s => s.id === booking.sessionId);
  if (!session || attendanceWindow(session, now) !== 'open') return state;
  const xpDelta = (attendance === 'present' ? CHECK_IN_XP : 0) - (booking.attendance === 'present' ? CHECK_IN_XP : 0);
  const next = updateBooking(state, bookingId, { attendance });
  return {
    ...next,
    players: next.players.map(p => (p.id === booking.playerId ? { ...p, xp: Math.max(0, p.xp + xpDelta) } : p))
  };
}

export function assignHomework(state: DemoState, hw: Omit<HomeworkAssignment, 'id' | 'assignedAt' | 'completed'>, now: Date): DemoState {
  return {
    ...state,
    homework: [{ ...hw, id: uid('hw'), assignedAt: now.toISOString(), completed: false }, ...state.homework]
  };
}

export function toggleHomework(state: DemoState, id: string): DemoState {
  return { ...state, homework: state.homework.map(h => (h.id === id ? { ...h, completed: !h.completed } : h)) };
}

export function setNotifyPrefs(state: DemoState, playerId: string, prefs: NotifyPrefs): DemoState {
  return { ...state, notifyPrefs: { ...state.notifyPrefs, [playerId]: prefs } };
}

export const DEFAULT_NOTIFY: NotifyPrefs = { sms: true, email: true, push: true };

export function findFrame(drawings: DrawingFrame[], time: number): DrawingFrame | undefined {
  return drawings.find(f => Math.abs(f.timestamp - time) <= FRAME_MATCH_SECONDS);
}

/** Add a stroke to the frame at `time`, creating the frame if none is close enough. */
export function addStroke(drawings: DrawingFrame[], time: number, stroke: Stroke): DrawingFrame[] {
  const frame = findFrame(drawings, time);
  if (frame) return drawings.map(f => (f.id === frame.id ? { ...f, strokes: [...f.strokes, stroke] } : f));
  const ts = Math.round(time * 100) / 100;
  return [...drawings, { id: uid('d'), timestamp: ts, strokes: [stroke] }].sort((a, b) => a.timestamp - b.timestamp);
}

export function undoStroke(drawings: DrawingFrame[], time: number): DrawingFrame[] {
  const frame = findFrame(drawings, time);
  if (!frame) return drawings;
  if (frame.strokes.length <= 1) return drawings.filter(f => f.id !== frame.id);
  return drawings.map(f => (f.id === frame.id ? { ...f, strokes: f.strokes.slice(0, -1) } : f));
}

export function clearFrame(drawings: DrawingFrame[], time: number): DrawingFrame[] {
  const frame = findFrame(drawings, time);
  return frame ? drawings.filter(f => f.id !== frame.id) : drawings;
}

// ---- Saved-data checks: every record the screens read is checked, so damaged data is replaced, not rendered. ----
type Rec = Record<string, unknown>;
const isObj = (x: unknown): x is Rec => typeof x === 'object' && x !== null && !Array.isArray(x);
const str = (x: unknown) => typeof x === 'string';
const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
const bool = (x: unknown) => typeof x === 'boolean';
const date = (x: unknown) => typeof x === 'string' && !Number.isNaN(Date.parse(x));
const optDate = (x: unknown) => x === undefined || date(x);
const strings = (x: unknown) => Array.isArray(x) && x.every(str);
const list = (x: unknown, ok: (r: Rec) => boolean) => Array.isArray(x) && x.every(r => isObj(r) && ok(r));

const BOOKING_STATUSES = ['confirmed', 'cancelled_early', 'cancelled_late', 'excused', 'forfeited'];
const ATTENDANCE = ['pending', 'present', 'absent'];
const SESSION_TYPES = ['one_on_one', 'small_group', 'virtual_live'];
const TOOLS = ['pen', 'arrow', 'circle'];
const point = (p: unknown) => isObj(p) && num(p.x) && num(p.y);

/** A saved state is only trusted if every record has the shape this version expects. */
export function isValidState(value: unknown, version: number): value is DemoState {
  if (!isObj(value) || value.version !== version || !date(value.seededAt)) return false;
  const v = value;
  return (
    list(v.players, p => str(p.id) && str(p.name) && str(p.level) && strings(p.focusAreas) && num(p.creditsRemaining) && num(p.xp) && str(p.phone) && str(p.email)) &&
    list(v.sessions, s => str(s.id) && str(s.title) && str(s.courtLocation) && str(s.courtAddress) && date(s.start) && date(s.end) && SESSION_TYPES.includes(s.type as string) && num(s.maxCapacity) && num(s.price)) &&
    list(v.bookings, b => str(b.id) && str(b.sessionId) && str(b.playerId) && BOOKING_STATUSES.includes(b.status as string) && ATTENDANCE.includes(b.attendance as string) && date(b.bookedAt) && optDate(b.cancelledAt) && optDate(b.graceExpiresAt) && optDate(b.decidedAt)) &&
    list(v.homework, h => str(h.id) && str(h.playerId) && str(h.title) && str(h.category) && str(h.repsOrMinutes) && str(h.notes) && date(h.assignedAt) && bool(h.completed)) &&
    list(v.films, f =>
      str(f.id) && str(f.playerId) && str(f.title) && date(f.uploadedAt) &&
      (f.videoUrl === undefined || str(f.videoUrl)) && (f.videoKey === undefined || str(f.videoKey)) &&
      list(f.notes, n => str(n.id) && num(n.timestamp) && str(n.text) && str(n.author)) &&
      list(f.voiceNotes, n => str(n.id) && num(n.timestamp) && num(n.duration) && str(n.mediaKey)) &&
      list(f.drawings, d => str(d.id) && num(d.timestamp) && list(d.strokes, s => str(s.id) && TOOLS.includes(s.tool as string) && str(s.color) && Array.isArray(s.points) && s.points.every(point)))
    ) &&
    list(v.coachNotes, n => str(n.id) && str(n.playerId) && str(n.text) && date(n.createdAt)) &&
    isObj(v.notifyPrefs) &&
    Object.values(v.notifyPrefs).every(p => isObj(p) && bool(p.sms) && bool(p.email) && bool(p.push))
  );
}
