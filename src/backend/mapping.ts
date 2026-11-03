/** Converts Supabase rows (snake_case, one table each) into the app's state shape, and back. Pure; unit-tested. */
import type { Booking, DemoState, FilmReview, NotifyPrefs, Player, Settings, TrainingSession } from '../types';
import { DEFAULT_SETTINGS, STATE_VERSION } from '../seed';

type Row = Record<string, any>;

export interface Rows {
  settings: Row | null;
  players: Row[];
  sessions: Row[];
  bookings: Row[];
  homework: Row[];
  films: Row[];
  coachNotes: Row[];
  notifyPrefs: Row[];
  spots: Row[];
}

const iso = (v: unknown): string | undefined => (v == null ? undefined : new Date(String(v)).toISOString());
const optNum = (v: unknown): number | undefined => (v == null ? undefined : Number(v));

export function rowsToSettings(r: Row | null): Settings {
  if (!r) return { ...DEFAULT_SETTINGS };
  return {
    lateCancelHours: Number(r.late_cancel_hours),
    graceHours: Number(r.grace_hours),
    lateSpot: r.late_spot === 'lock' ? 'lock' : 'refill',
    checkInXp: Number(r.check_in_xp),
    checkInOpensMinutes: Number(r.check_in_opens_minutes),
    checkInClosesHours: Number(r.check_in_closes_hours)
  };
}

export function settingsToRow(s: Settings): Row {
  return {
    late_cancel_hours: s.lateCancelHours,
    grace_hours: s.graceHours,
    late_spot: s.lateSpot,
    check_in_xp: s.checkInXp,
    check_in_opens_minutes: s.checkInOpensMinutes,
    check_in_closes_hours: s.checkInClosesHours
  };
}

export function rowToPlayer(r: Row): Player {
  return {
    id: r.id,
    name: r.name,
    level: r.level ?? '',
    focusAreas: Array.isArray(r.focus_areas) ? r.focus_areas : [],
    creditsRemaining: Number(r.credits),
    xp: Number(r.xp),
    phone: r.phone ?? '',
    email: r.email ?? ''
  };
}

export function rowToSession(r: Row): TrainingSession {
  return {
    id: r.id,
    title: r.title,
    courtLocation: r.court_location ?? '',
    courtAddress: r.court_address ?? '',
    start: iso(r.start_at)!,
    end: iso(r.end_at)!,
    type: r.type,
    maxCapacity: Number(r.max_capacity),
    price: Number(r.price)
  };
}

export function sessionToRow(s: Omit<TrainingSession, 'id'>): Row {
  return {
    title: s.title,
    court_location: s.courtLocation,
    court_address: s.courtAddress,
    start_at: s.start,
    end_at: s.end,
    type: s.type,
    max_capacity: s.maxCapacity,
    price: s.price
  };
}

export function rowToBooking(r: Row): Booking {
  const b: Booking = {
    id: r.id,
    sessionId: r.session_id,
    playerId: r.player_id,
    status: r.status,
    attendance: r.attendance,
    bookedAt: iso(r.booked_at)!
  };
  if (r.cancelled_at != null) b.cancelledAt = iso(r.cancelled_at);
  if (r.grace_expires_at != null) b.graceExpiresAt = iso(r.grace_expires_at);
  if (r.hours_notice_at_cancel != null) b.hoursNoticeAtCancel = optNum(r.hours_notice_at_cancel);
  if (r.confirmed_at_cancel != null) b.confirmedAtCancel = optNum(r.confirmed_at_cancel);
  if (r.decided_at != null) b.decidedAt = iso(r.decided_at);
  if (r.decision_reason != null) b.decisionReason = r.decision_reason;
  return b;
}

export function rowToFilm(r: Row): FilmReview {
  const f: FilmReview = {
    id: r.id,
    playerId: r.player_id,
    title: r.title,
    uploadedAt: iso(r.uploaded_at)!,
    notes: Array.isArray(r.notes) ? r.notes : [],
    voiceNotes: Array.isArray(r.voice_notes) ? r.voice_notes : [],
    drawings: Array.isArray(r.drawings) ? r.drawings : []
  };
  if (r.video_url) f.videoUrl = r.video_url;
  if (r.video_key) f.videoKey = r.video_key;
  return f;
}

export function filmToRow(f: FilmReview): Row {
  return {
    id: f.id,
    player_id: f.playerId,
    title: f.title,
    video_url: f.videoUrl ?? null,
    video_key: f.videoKey ?? null,
    uploaded_at: f.uploadedAt,
    notes: f.notes,
    voice_notes: f.voiceNotes,
    drawings: f.drawings
  };
}

export function rowsToState(rows: Rows): DemoState {
  const notifyPrefs: Record<string, NotifyPrefs> = {};
  for (const r of rows.notifyPrefs) notifyPrefs[r.player_id] = { sms: !!r.sms, email: !!r.email, push: !!r.push };
  const spotCounts: Record<string, number> = {};
  for (const r of rows.spots) spotCounts[r.session_id] = Number(r.spots);
  return {
    version: STATE_VERSION,
    seededAt: new Date(0).toISOString(),
    players: rows.players.map(rowToPlayer),
    sessions: rows.sessions.map(rowToSession),
    bookings: rows.bookings.map(rowToBooking),
    homework: rows.homework.map(r => ({
      id: r.id,
      playerId: r.player_id,
      title: r.title,
      category: r.category ?? '',
      repsOrMinutes: r.reps_or_minutes ?? '',
      notes: r.notes ?? '',
      assignedAt: iso(r.assigned_at)!,
      completed: !!r.completed
    })),
    films: rows.films.map(rowToFilm),
    coachNotes: rows.coachNotes.map(r => ({ id: r.id, playerId: r.player_id, text: r.text, createdAt: iso(r.created_at)! })),
    notifyPrefs,
    settings: rowsToSettings(rows.settings),
    spotCounts
  };
}
