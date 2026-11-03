/**
 * Every rule of the app as plain functions: (state, command, now) -> new state + message.
 * No React and no browser APIs here, so tests/logic.test.ts runs it under Node.
 * The demo runs these in the browser. With the backend, the same rules run on the server
 * (supabase/schema.sql) with the server's clock; tests/sql.test.ts checks both agree.
 */
import type {
  Attendance,
  Booking,
  DemoState,
  DrawingFrame,
  FilmNote,
  FilmReview,
  HomeworkAssignment,
  NotifyPrefs,
  Player,
  Settings,
  Stroke,
  TrainingSession,
  VoiceNote
} from './types';

/** Two drawings closer than this (seconds) belong to the same frame. */
export const FRAME_MATCH_SECONDS = 0.15;
const HOUR = 3_600_000;

export interface Result {
  ok: boolean;
  state: DemoState;
  message: string;
}
const ok = (state: DemoState, message = ''): Result => ({ ok: true, state, message });
const fail = (state: DemoState, message: string): Result => ({ ok: false, state, message });

let counter = 0;
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function hoursUntil(iso: string, now: Date): number {
  return (new Date(iso).getTime() - now.getTime()) / HOUR;
}

export function sessionPhase(session: TrainingSession, now: Date): 'upcoming' | 'live' | 'ended' {
  const n = now.getTime();
  if (n < new Date(session.start).getTime()) return 'upcoming';
  if (n < new Date(session.end).getTime()) return 'live';
  return 'ended';
}

export function confirmedBookings(state: DemoState, sessionId: string): Booking[] {
  return state.bookings.filter(b => b.sessionId === sessionId && b.status === 'confirmed');
}

/** In 'lock' mode a late cancel keeps its spot (pending or forfeited). In 'refill' mode only confirmed bookings hold spots. */
export function holdsSpot(b: Booking, settings: Settings): boolean {
  if (b.status === 'confirmed') return true;
  return settings.lateSpot === 'lock' && (b.status === 'cancelled_late' || b.status === 'forfeited');
}

export function spotsLeft(state: DemoState, session: TrainingSession): number {
  const known = state.spotCounts?.[session.id];
  if (known !== undefined) return known;
  return session.maxCapacity - state.bookings.filter(b => b.sessionId === session.id && holdsSpot(b, state.settings)).length;
}

/** What a cancel right now would mean, before the athlete confirms it. */
export function cancellationPreview(session: TrainingSession, now: Date, settings: Settings): { kind: 'early' | 'late' | 'started'; hoursNotice: number } {
  const hoursNotice = hoursUntil(session.start, now);
  if (hoursNotice <= 0) return { kind: 'started', hoursNotice };
  return { kind: hoursNotice >= settings.lateCancelHours ? 'early' : 'late', hoursNotice };
}

/** Check-in opens shortly before a session and closes a while after it, so XP can't be given for future sessions. */
export function attendanceWindow(session: TrainingSession, now: Date, settings: Settings): 'early' | 'open' | 'closed' {
  const opens = new Date(session.start).getTime() - settings.checkInOpensMinutes * 60_000;
  const closes = new Date(session.end).getTime() + settings.checkInClosesHours * HOUR;
  const n = now.getTime();
  if (n < opens) return 'early';
  return n <= closes ? 'open' : 'closed';
}

function patchPlayer(state: DemoState, playerId: string, fn: (p: Player) => Player): DemoState {
  return { ...state, players: state.players.map(p => (p.id === playerId ? fn(p) : p)) };
}
const addCredits = (state: DemoState, playerId: string, delta: number) =>
  patchPlayer(state, playerId, p => ({ ...p, creditsRemaining: Math.max(0, p.creditsRemaining + delta) }));

function patchBooking(state: DemoState, bookingId: string, patch: Partial<Booking>): DemoState {
  return { ...state, bookings: state.bookings.map(b => (b.id === bookingId ? { ...b, ...patch } : b)) };
}

/**
 * 'refill' mode: newcomers fill empty spots first. Only once a session is fuller than it could be without the late
 * cancels has a late canceller's spot really been needed, and then that canceller (oldest first) gets the credit back,
 * one per needed spot. Late cancels the coach already waived count as already refunded. Only before the session starts.
 */
function refundRefilled(state: DemoState, sessionId: string, now: Date): { state: DemoState; refunded: Booking[] } {
  if (state.settings.lateSpot !== 'refill') return { state, refunded: [] };
  const session = state.sessions.find(s => s.id === sessionId);
  if (!session || sessionPhase(session, now) !== 'upcoming') return { state, refunded: [] };
  const inSession = state.bookings.filter(b => b.sessionId === sessionId);
  const late = inSession.filter(b => b.status === 'cancelled_late' || b.status === 'forfeited' || b.status === 'excused');
  const confirmed = inSession.filter(b => b.status === 'confirmed').length;
  const neededLateSpots = Math.max(0, confirmed - (session.maxCapacity - late.length));
  let due = neededLateSpots - late.filter(b => b.status === 'excused').length;
  let next = state;
  const refunded: Booking[] = [];
  const held = late.filter(b => b.status !== 'excused').sort((a, b) => new Date(a.cancelledAt ?? 0).getTime() - new Date(b.cancelledAt ?? 0).getTime());
  for (const b of held) {
    if (due <= 0) break;
    next = addCredits(patchBooking(next, b.id, { status: 'excused', decidedAt: now.toISOString(), decisionReason: 'refilled' }), b.playerId, 1);
    refunded.push(b);
    due -= 1;
  }
  return { state: next, refunded };
}

export function bookSession(state: DemoState, sessionId: string, playerId: string, now: Date): Result {
  const session = state.sessions.find(s => s.id === sessionId);
  const player = state.players.find(p => p.id === playerId);
  if (!session || !player) return fail(state, 'That session or athlete no longer exists.');
  if (sessionPhase(session, now) !== 'upcoming') return fail(state, 'That session has already started.');
  if (confirmedBookings(state, sessionId).some(b => b.playerId === playerId)) return fail(state, `${player.name} is already booked for this session.`);
  if (spotsLeft(state, session) <= 0) return fail(state, 'That session is full.');
  if (player.creditsRemaining < 1) return fail(state, 'No session credits left. Ask Coach to add credits.');
  const booking: Booking = { id: uid('b'), sessionId, playerId, status: 'confirmed', attendance: 'pending', bookedAt: now.toISOString() };
  const booked = addCredits({ ...state, bookings: [...state.bookings, booking] }, playerId, -1);
  const { state: next, refunded } = refundRefilled(booked, sessionId, now);
  return ok(next, `Booked ${session.title}. 1 credit used.${refunded.length ? ' That filled a late-cancelled spot.' : ''}`);
}

export function cancelBooking(state: DemoState, bookingId: string, now: Date): Result {
  const booking = state.bookings.find(b => b.id === bookingId);
  if (!booking || booking.status !== 'confirmed') return fail(state, 'That booking is not active.');
  const session = state.sessions.find(s => s.id === booking.sessionId);
  if (!session) return fail(state, 'That session no longer exists.');
  const { settings } = state;
  const preview = cancellationPreview(session, now, settings);
  if (preview.kind === 'started') return fail(state, 'The session has started, so it can no longer be cancelled.');
  const hoursNoticeAtCancel = Math.round(preview.hoursNotice * 10) / 10;
  if (preview.kind === 'early') {
    const next = addCredits(patchBooking(state, bookingId, { status: 'cancelled_early', cancelledAt: now.toISOString(), hoursNoticeAtCancel }), booking.playerId, 1);
    return ok(next, `Cancelled with ${hoursNoticeAtCancel} hours' notice. Your credit is back.`);
  }
  const next = patchBooking(state, bookingId, {
    status: 'cancelled_late',
    cancelledAt: now.toISOString(),
    graceExpiresAt: new Date(now.getTime() + settings.graceHours * HOUR).toISOString(),
    hoursNoticeAtCancel,
    confirmedAtCancel: confirmedBookings(state, booking.sessionId).length
  });
  const refill = settings.lateSpot === 'refill' ? ' If the session fills back up, you get it back automatically.' : '';
  return ok(next, `Late cancel (${hoursNoticeAtCancel} hours' notice). The credit is held for ${settings.graceHours} hours while Coach reviews it.${refill}`);
}

export function waiveLateCancel(state: DemoState, bookingId: string, now: Date): Result {
  const booking = state.bookings.find(b => b.id === bookingId);
  if (!booking || booking.status !== 'cancelled_late') return fail(state, 'Only a pending late cancel can be waived.');
  return ok(addCredits(patchBooking(state, bookingId, { status: 'excused', decidedAt: now.toISOString(), decisionReason: 'coach' }), booking.playerId, 1), 'Waived. The credit is restored.');
}

export function enforceLateCancel(state: DemoState, bookingId: string, now: Date): Result {
  const booking = state.bookings.find(b => b.id === bookingId);
  if (!booking || booking.status !== 'cancelled_late') return fail(state, 'Only a pending late cancel can be enforced.');
  return ok(patchBooking(state, bookingId, { status: 'forfeited', decidedAt: now.toISOString(), decisionReason: 'coach' }), 'Enforced. The credit stays used.');
}

/** Late cancels whose grace window has run out become forfeits. */
export function expireGraceWindows(state: DemoState, now: Date): DemoState {
  const expired = state.bookings.filter(b => b.status === 'cancelled_late' && b.graceExpiresAt && new Date(b.graceExpiresAt).getTime() <= now.getTime());
  if (expired.length === 0) return state;
  const ids = new Set(expired.map(b => b.id));
  return {
    ...state,
    bookings: state.bookings.map(b => (ids.has(b.id) ? { ...b, status: 'forfeited', decidedAt: b.graceExpiresAt, decisionReason: 'expired' } : b))
  };
}

/** Check-in, no-show, or back to pending, only while the check-in window is open. Check-in earns XP; undoing it takes it back. */
export function setAttendance(state: DemoState, bookingId: string, attendance: Attendance, now: Date): DemoState {
  const booking = state.bookings.find(b => b.id === bookingId);
  if (!booking || booking.status !== 'confirmed' || booking.attendance === attendance) return state;
  const session = state.sessions.find(s => s.id === booking.sessionId);
  if (!session || attendanceWindow(session, now, state.settings) !== 'open') return state;
  const xp = state.settings.checkInXp;
  const delta = (attendance === 'present' ? xp : 0) - (booking.attendance === 'present' ? xp : 0);
  return patchPlayer(patchBooking(state, bookingId, { attendance }), booking.playerId, p => ({ ...p, xp: Math.max(0, p.xp + delta) }));
}

export const DEFAULT_NOTIFY: NotifyPrefs = { sms: true, email: true, push: true };

// ---- Drawings ----
export function findFrame(drawings: DrawingFrame[], time: number): DrawingFrame | undefined {
  return drawings.find(f => Math.abs(f.timestamp - time) <= FRAME_MATCH_SECONDS);
}
/** Add a stroke to the frame at `time`, creating the frame if none is close enough. */
export function addStroke(drawings: DrawingFrame[], time: number, stroke: Stroke): DrawingFrame[] {
  const frame = findFrame(drawings, time);
  if (frame) return drawings.map(f => (f.id === frame.id ? { ...f, strokes: [...f.strokes, stroke] } : f));
  return [...drawings, { id: uid('d'), timestamp: Math.round(time * 100) / 100, strokes: [stroke] }].sort((a, b) => a.timestamp - b.timestamp);
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

// ---- Commands: the one way anything changes ----
export type NewPlayer = Pick<Player, 'name' | 'level' | 'focusAreas' | 'phone' | 'email'> & { creditsRemaining?: number };
export type NewSession = Omit<TrainingSession, 'id'>;

export type Command =
  | { type: 'book'; sessionId: string; playerId: string }
  | { type: 'cancel'; bookingId: string }
  | { type: 'waive'; bookingId: string }
  | { type: 'enforce'; bookingId: string }
  | { type: 'attendance'; bookingId: string; attendance: Attendance }
  | { type: 'expire' }
  | { type: 'homework.assign'; hw: Omit<HomeworkAssignment, 'id' | 'assignedAt' | 'completed'> }
  | { type: 'homework.toggle'; id: string }
  | { type: 'notify'; playerId: string; prefs: NotifyPrefs }
  | { type: 'coachNote.add'; playerId: string; text: string }
  | { type: 'film.add'; film: FilmReview }
  | { type: 'film.delete'; filmId: string }
  | { type: 'film.note.add'; filmId: string; note: Omit<FilmNote, 'id'> }
  | { type: 'film.note.delete'; filmId: string; noteId: string }
  | { type: 'film.stroke.add'; filmId: string; time: number; stroke: Stroke }
  | { type: 'film.stroke.undo'; filmId: string; time: number }
  | { type: 'film.frame.clear'; filmId: string; time: number }
  | { type: 'film.memo.add'; filmId: string; memo: Omit<VoiceNote, 'id'> }
  | { type: 'film.memo.delete'; filmId: string; memoId: string }
  | { type: 'player.add'; player: NewPlayer }
  | { type: 'player.update'; id: string; patch: Partial<Pick<Player, 'name' | 'level' | 'focusAreas' | 'phone' | 'email' | 'xp'>> }
  | { type: 'player.credits'; id: string; delta: number }
  | { type: 'session.add'; session: NewSession }
  | { type: 'session.update'; id: string; patch: Partial<NewSession> }
  | { type: 'session.delete'; id: string }
  | { type: 'settings.update'; patch: Partial<Settings> };

function patchFilm(state: DemoState, filmId: string, fn: (f: FilmReview) => FilmReview): Result {
  if (!state.films.some(f => f.id === filmId)) return fail(state, 'That film no longer exists.');
  return ok({ ...state, films: state.films.map(f => (f.id === filmId ? fn(f) : f)) });
}

const clampInt = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number.isFinite(n) ? n : min)));

export function validSession(s: NewSession): string | null {
  if (!s.title.trim()) return 'Give the session a title.';
  if (Number.isNaN(Date.parse(s.start)) || Number.isNaN(Date.parse(s.end))) return 'Pick a start and end time.';
  if (new Date(s.end).getTime() <= new Date(s.start).getTime()) return 'The session must end after it starts.';
  if (!(s.maxCapacity >= 1 && s.maxCapacity <= 50)) return 'Capacity must be between 1 and 50.';
  return null;
}

export function applyCommand(state: DemoState, cmd: Command, now: Date): Result {
  switch (cmd.type) {
    case 'book':
      return bookSession(state, cmd.sessionId, cmd.playerId, now);
    case 'cancel':
      return cancelBooking(state, cmd.bookingId, now);
    case 'waive':
      return waiveLateCancel(state, cmd.bookingId, now);
    case 'enforce':
      return enforceLateCancel(state, cmd.bookingId, now);
    case 'attendance': {
      const next = setAttendance(state, cmd.bookingId, cmd.attendance, now);
      return next === state ? fail(state, 'Check-in is not open for this session.') : ok(next);
    }
    case 'expire':
      return ok(expireGraceWindows(state, now));
    case 'homework.assign':
      return ok({ ...state, homework: [{ ...cmd.hw, id: uid('hw'), assignedAt: now.toISOString(), completed: false }, ...state.homework] }, 'Drill assigned.');
    case 'homework.toggle':
      return ok({ ...state, homework: state.homework.map(h => (h.id === cmd.id ? { ...h, completed: !h.completed } : h)) });
    case 'notify':
      return ok({ ...state, notifyPrefs: { ...state.notifyPrefs, [cmd.playerId]: cmd.prefs } });
    case 'coachNote.add':
      return ok({ ...state, coachNotes: [...state.coachNotes, { id: uid('c'), playerId: cmd.playerId, text: cmd.text, createdAt: now.toISOString() }] });
    case 'film.add':
      return ok({ ...state, films: [cmd.film, ...state.films] });
    case 'film.delete':
      return ok({ ...state, films: state.films.filter(f => f.id !== cmd.filmId) });
    case 'film.note.add':
      return patchFilm(state, cmd.filmId, f => ({ ...f, notes: [...f.notes, { ...cmd.note, id: uid('n') }].sort((a, b) => a.timestamp - b.timestamp) }));
    case 'film.note.delete':
      return patchFilm(state, cmd.filmId, f => ({ ...f, notes: f.notes.filter(n => n.id !== cmd.noteId) }));
    case 'film.stroke.add':
      return patchFilm(state, cmd.filmId, f => ({ ...f, drawings: addStroke(f.drawings, cmd.time, cmd.stroke) }));
    case 'film.stroke.undo':
      return patchFilm(state, cmd.filmId, f => ({ ...f, drawings: undoStroke(f.drawings, cmd.time) }));
    case 'film.frame.clear':
      return patchFilm(state, cmd.filmId, f => ({ ...f, drawings: clearFrame(f.drawings, cmd.time) }));
    case 'film.memo.add':
      return patchFilm(state, cmd.filmId, f => ({ ...f, voiceNotes: [...f.voiceNotes, { ...cmd.memo, id: uid('v') }] }));
    case 'film.memo.delete':
      return patchFilm(state, cmd.filmId, f => ({ ...f, voiceNotes: f.voiceNotes.filter(v => v.id !== cmd.memoId) }));
    case 'player.add': {
      if (!cmd.player.name.trim()) return fail(state, 'Give the athlete a name.');
      const player: Player = { ...cmd.player, id: uid('p'), name: cmd.player.name.trim(), creditsRemaining: clampInt(cmd.player.creditsRemaining ?? 0, 0, 500), xp: 0 };
      return ok({ ...state, players: [...state.players, player] }, `${player.name} added.`);
    }
    case 'player.update':
      if (!state.players.some(p => p.id === cmd.id)) return fail(state, 'That athlete no longer exists.');
      return ok(patchPlayer(state, cmd.id, p => ({ ...p, ...cmd.patch, xp: cmd.patch.xp === undefined ? p.xp : clampInt(cmd.patch.xp, 0, 10_000_000) })));
    case 'player.credits': {
      const p = state.players.find(x => x.id === cmd.id);
      if (!p) return fail(state, 'That athlete no longer exists.');
      const delta = clampInt(cmd.delta, -500, 500);
      return ok(addCredits(state, cmd.id, delta), `${p.name}: ${Math.max(0, p.creditsRemaining + delta)} credits.`);
    }
    case 'session.add': {
      const problem = validSession(cmd.session);
      if (problem) return fail(state, problem);
      return ok({ ...state, sessions: [...state.sessions, { ...cmd.session, id: uid('s'), title: cmd.session.title.trim() }] }, 'Session added.');
    }
    case 'session.update': {
      const current = state.sessions.find(s => s.id === cmd.id);
      if (!current) return fail(state, 'That session no longer exists.');
      const merged = { ...current, ...cmd.patch };
      const problem = validSession(merged);
      if (problem) return fail(state, problem);
      return ok({ ...state, sessions: state.sessions.map(s => (s.id === cmd.id ? merged : s)) }, 'Session saved.');
    }
    case 'session.delete': {
      // Deleting a session gives every athlete who still holds a credit for it their credit back.
      let next: DemoState = state;
      for (const b of state.bookings.filter(x => x.sessionId === cmd.id && (x.status === 'confirmed' || x.status === 'cancelled_late'))) {
        next = addCredits(next, b.playerId, 1);
      }
      next = { ...next, sessions: next.sessions.filter(s => s.id !== cmd.id), bookings: next.bookings.filter(b => b.sessionId !== cmd.id) };
      return ok(next, 'Session deleted. Booked athletes got their credits back.');
    }
    case 'settings.update': {
      const s = { ...state.settings, ...cmd.patch };
      const settings: Settings = {
        lateCancelHours: clampInt(s.lateCancelHours, 0, 168),
        graceHours: clampInt(s.graceHours, 0, 336),
        lateSpot: s.lateSpot === 'lock' ? 'lock' : 'refill',
        checkInXp: clampInt(s.checkInXp, 0, 1000),
        checkInOpensMinutes: clampInt(s.checkInOpensMinutes, 0, 1440),
        checkInClosesHours: clampInt(s.checkInClosesHours, 0, 168)
      };
      return ok({ ...state, settings }, 'Settings saved.');
    }
  }
}

// ---- Saved-data checks: every record the screens read is checked, so damaged data is replaced, not rendered. ----
type Rec = Record<string, unknown>;
const isObj = (x: unknown): x is Rec => typeof x === 'object' && x !== null && !Array.isArray(x);
const str = (x: unknown) => typeof x === 'string';
const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
const bool = (x: unknown) => typeof x === 'boolean';
const date = (x: unknown) => typeof x === 'string' && !Number.isNaN(Date.parse(x));
const optDate = (x: unknown) => x === undefined || date(x);
const optNum = (x: unknown) => x === undefined || num(x);
const strings = (x: unknown) => Array.isArray(x) && x.every(str);
const list = (x: unknown, check: (r: Rec) => boolean) => Array.isArray(x) && x.every(r => isObj(r) && check(r));

const BOOKING_STATUSES = ['confirmed', 'cancelled_early', 'cancelled_late', 'excused', 'forfeited'];
const ATTENDANCE = ['pending', 'present', 'absent'];
const SESSION_TYPES = ['one_on_one', 'small_group', 'virtual_live'];
const TOOLS = ['pen', 'arrow', 'circle'];
const REASONS = [undefined, 'coach', 'expired', 'refilled'];
const point = (p: unknown) => isObj(p) && num(p.x) && num(p.y);

/** A saved state is only trusted if every record has the shape this version expects. */
export function isValidState(value: unknown, version: number): value is DemoState {
  if (!isObj(value) || value.version !== version || !date(value.seededAt)) return false;
  const v = value;
  const st = v.settings;
  return (
    isObj(st) && num(st.lateCancelHours) && num(st.graceHours) && (st.lateSpot === 'refill' || st.lateSpot === 'lock') && num(st.checkInXp) && num(st.checkInOpensMinutes) && num(st.checkInClosesHours) &&
    list(v.players, p => str(p.id) && str(p.name) && str(p.level) && strings(p.focusAreas) && num(p.creditsRemaining) && num(p.xp) && str(p.phone) && str(p.email)) &&
    list(v.sessions, s => str(s.id) && str(s.title) && str(s.courtLocation) && str(s.courtAddress) && date(s.start) && date(s.end) && SESSION_TYPES.includes(s.type as string) && num(s.maxCapacity) && num(s.price)) &&
    list(v.bookings, b => str(b.id) && str(b.sessionId) && str(b.playerId) && BOOKING_STATUSES.includes(b.status as string) && ATTENDANCE.includes(b.attendance as string) && date(b.bookedAt) && optDate(b.cancelledAt) && optDate(b.graceExpiresAt) && optDate(b.decidedAt) && optNum(b.confirmedAtCancel) && REASONS.includes(b.decisionReason as string | undefined)) &&
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
