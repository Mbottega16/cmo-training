// Run with `npm test` (Node 23.6+ runs TypeScript directly).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeed, STATE_VERSION } from '../src/seed.ts';
import {
  addStroke,
  bookSession,
  cancelBooking,
  cancellationPreview,
  CHECK_IN_XP,
  clearFrame,
  enforceLateCancel,
  expireGraceWindows,
  GRACE_HOURS,
  isValidState,
  sessionPhase,
  setAttendance,
  spotsLeft,
  undoStroke,
  waiveLateCancel
} from '../src/logic.ts';
import type { DemoState, Stroke } from '../src/types.ts';

const NOW = new Date('2026-11-03T15:00:00Z');
const HOUR = 3_600_000;
const later = (hours: number) => new Date(NOW.getTime() + hours * HOUR);
const credits = (s: DemoState, id: string) => s.players.find(p => p.id === id)!.creditsRemaining;
const xp = (s: DemoState, id: string) => s.players.find(p => p.id === id)!.xp;
const booking = (s: DemoState, id: string) => s.bookings.find(b => b.id === id)!;

/** A state with one session `hoursOut` from NOW and Jordan (p1) booked on it as b-test. */
function withSessionIn(hoursOut: number): DemoState {
  const s = createSeed(NOW);
  const start = later(hoursOut);
  return {
    ...s,
    sessions: [...s.sessions, { id: 'sx', title: 'Test', courtLocation: '', courtAddress: '', start: start.toISOString(), end: new Date(start.getTime() + HOUR).toISOString(), type: 'small_group', maxCapacity: 2, price: 65 }],
    bookings: [...s.bookings, { id: 'b-test', sessionId: 'sx', playerId: 'p1', status: 'confirmed', attendance: 'pending', bookedAt: NOW.toISOString() }]
  };
}

test('the seed has a live session, a late-cancel session and an early-cancel session for Jordan', () => {
  const s = createSeed(NOW);
  const byId = (id: string) => s.sessions.find(x => x.id === id)!;
  assert.equal(sessionPhase(byId('s1'), NOW), 'live');
  assert.equal(cancellationPreview(byId('s2'), NOW).kind, 'late');
  assert.equal(cancellationPreview(byId('s3'), NOW).kind, 'early');
  assert.ok(s.bookings.some(b => b.sessionId === 's2' && b.playerId === 'p1'));
  assert.ok(s.bookings.some(b => b.sessionId === 's3' && b.playerId === 'p1'));
});

test('booking uses one credit and refuses full, started, duplicate and no-credit bookings', () => {
  const s = createSeed(NOW);
  const ok = bookSession(s, 's4', 'p1', NOW);
  assert.equal(ok.ok, true);
  assert.equal(credits(ok.state, 'p1'), credits(s, 'p1') - 1);

  assert.equal(bookSession(ok.state, 's4', 'p1', NOW).ok, false, 'no double booking');
  assert.equal(bookSession(s, 's1', 'p3', NOW).ok, false, 'live session cannot be booked');
  assert.equal(bookSession(s, 's6', 'p1', NOW).ok, true);
  const full = bookSession(bookSession(s, 's6', 'p1', NOW).state, 's6', 'p3', NOW);
  assert.equal(full.ok, false, '1-on-1 is full after one booking');

  const broke = { ...s, players: s.players.map(p => (p.id === 'p1' ? { ...p, creditsRemaining: 0 } : p)) };
  const refused = bookSession(broke, 's4', 'p1', NOW);
  assert.equal(refused.ok, false);
  assert.equal(refused.state, broke, 'a refused booking changes nothing');
});

test('cancelling 6+ hours out restores the credit at once', () => {
  const s = withSessionIn(10);
  const r = cancelBooking(s, 'b-test', NOW);
  assert.equal(r.ok, true);
  assert.equal(booking(r.state, 'b-test').status, 'cancelled_early');
  assert.equal(credits(r.state, 'p1'), credits(s, 'p1') + 1);
});

test('exactly 6 hours counts as on time', () => {
  const r = cancelBooking(withSessionIn(6), 'b-test', NOW);
  assert.equal(booking(r.state, 'b-test').status, 'cancelled_early');
});

test('cancelling under 6 hours holds the credit and starts a 24-hour grace window', () => {
  const s = withSessionIn(5.9);
  const r = cancelBooking(s, 'b-test', NOW);
  const b = booking(r.state, 'b-test');
  assert.equal(b.status, 'cancelled_late');
  assert.equal(credits(r.state, 'p1'), credits(s, 'p1'), 'credit neither restored nor taken again');
  assert.equal(new Date(b.graceExpiresAt!).getTime(), NOW.getTime() + GRACE_HOURS * HOUR);
});

test('a session that has started cannot be cancelled', () => {
  const s = withSessionIn(-0.1);
  const r = cancelBooking(s, 'b-test', NOW);
  assert.equal(r.ok, false);
  assert.equal(r.state, s);
});

test('waiving a late cancel restores the credit once; a second waive does nothing', () => {
  const late = cancelBooking(withSessionIn(2), 'b-test', NOW).state;
  const waived = waiveLateCancel(late, 'b-test', NOW);
  assert.equal(booking(waived.state, 'b-test').status, 'excused');
  assert.equal(credits(waived.state, 'p1'), credits(late, 'p1') + 1);
  const again = waiveLateCancel(waived.state, 'b-test', NOW);
  assert.equal(again.ok, false);
  assert.equal(credits(again.state, 'p1'), credits(waived.state, 'p1'));
});

test('enforcing keeps the credit used, and an enforced cancel cannot then be waived', () => {
  const late = cancelBooking(withSessionIn(2), 'b-test', NOW).state;
  const enforced = enforceLateCancel(late, 'b-test', NOW);
  assert.equal(booking(enforced.state, 'b-test').status, 'forfeited');
  assert.equal(credits(enforced.state, 'p1'), credits(late, 'p1'));
  assert.equal(waiveLateCancel(enforced.state, 'b-test', NOW).ok, false);
});

test('the grace window runs out into a forfeit, not before', () => {
  const late = cancelBooking(withSessionIn(2), 'b-test', NOW).state;
  assert.equal(expireGraceWindows(late, later(23.9)), late, 'unchanged inside the window');
  const expired = expireGraceWindows(late, later(GRACE_HOURS));
  assert.equal(booking(expired, 'b-test').status, 'forfeited');
  assert.equal(credits(expired, 'p1'), credits(late, 'p1'));
});

test('check-in gives XP once, and undoing or switching to no-show takes it back', () => {
  const s = createSeed(NOW); // b2 = Marcus in s1, pending
  const present = setAttendance(s, 'b2', 'present', NOW);
  assert.equal(xp(present, 'p2'), xp(s, 'p2') + CHECK_IN_XP);
  assert.equal(setAttendance(present, 'b2', 'present', NOW), present, 'checking in twice changes nothing');
  assert.equal(xp(setAttendance(present, 'b2', 'pending', NOW), 'p2'), xp(s, 'p2'));
  assert.equal(xp(setAttendance(present, 'b2', 'absent', NOW), 'p2'), xp(s, 'p2'));
});

test('attendance belongs to one booking: checking Marcus in today does not touch his later session', () => {
  const s = createSeed(NOW); // b2 = Marcus in s1, b7 = Marcus in s5
  const next = setAttendance(s, 'b2', 'present', NOW);
  assert.equal(booking(next, 'b2').attendance, 'present');
  assert.equal(booking(next, 'b7').attendance, 'pending');
});

test('drawings join the frame within 0.15 s, start a new frame beyond it, and undo/clear only that frame', () => {
  const pen = (id: string): Stroke => ({ id, tool: 'pen', color: '#fff', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] });
  let d = addStroke([], 3.2, pen('a'));
  d = addStroke(d, 3.3, pen('b'));
  assert.equal(d.length, 1);
  assert.equal(d[0].strokes.length, 2);
  d = addStroke(d, 5, pen('c'));
  assert.equal(d.length, 2);
  d = undoStroke(d, 3.2);
  assert.equal(d.find(f => f.timestamp === 3.2)!.strokes.length, 1);
  d = clearFrame(d, 5);
  assert.deepEqual(d.map(f => f.timestamp), [3.2]);
});

test('saved data is only trusted when it has the expected shape', () => {
  assert.equal(isValidState(createSeed(NOW), STATE_VERSION), true);
  assert.equal(isValidState(null, STATE_VERSION), false);
  assert.equal(isValidState({ ...createSeed(NOW), version: 1 }, STATE_VERSION), false);
  assert.equal(isValidState({ ...createSeed(NOW), players: [{ id: 'x' }] }, STATE_VERSION), false);
  assert.equal(isValidState({ ...createSeed(NOW), sessions: [{ id: 's', start: 'nope', end: 'nope' }] }, STATE_VERSION), false);
});

test('check-in only works from 30 minutes before a session until 12 hours after it', () => {
  const s = createSeed(NOW); // b7 = Marcus in s5, three days out
  assert.equal(setAttendance(s, 'b7', 'present', NOW), s, 'refused days ahead');
  const start = new Date(s.sessions.find(x => x.id === 's5')!.start).getTime();
  const end = new Date(s.sessions.find(x => x.id === 's5')!.end).getTime();
  assert.equal(booking(setAttendance(s, 'b7', 'present', new Date(start - 29 * 60_000)), 'b7').attendance, 'present', 'open 29 min before');
  assert.equal(setAttendance(s, 'b7', 'present', new Date(start - 31 * 60_000)), s, 'still shut 31 min before');
  assert.equal(setAttendance(s, 'b7', 'present', new Date(end + 13 * HOUR)), s, 'closed 13 h after');
});

test('a late-cancelled spot stays locked; a waiver frees it, a forfeit does not', () => {
  const s = withSessionIn(2); // sx: capacity 2, Jordan booked
  const session = (st: DemoState) => st.sessions.find(x => x.id === 'sx')!;
  assert.equal(spotsLeft(s, session(s)), 1);
  const late = cancelBooking(s, 'b-test', NOW).state;
  assert.equal(spotsLeft(late, session(late)), 1, 'late cancel keeps the spot held');
  assert.equal(spotsLeft(enforceLateCancel(late, 'b-test', NOW).state, session(late)), 1, 'forfeit keeps it held');
  const waived = waiveLateCancel(late, 'b-test', NOW).state;
  assert.equal(spotsLeft(waived, session(waived)), 2, 'waiver frees it');
  const early = cancelBooking(withSessionIn(10), 'b-test', NOW).state;
  assert.equal(spotsLeft(early, early.sessions.find(x => x.id === 'sx')!), 2, 'timely cancel frees it');
});

test('one damaged record anywhere makes the whole saved state untrusted', () => {
  const seed = () => createSeed(NOW);
  const broken: Array<[string, (s: any) => void]> = [
    ['film without notes', s => { delete s.films[0].notes; }],
    ['bare film record', s => { s.films = [{ id: 'f', playerId: 'p1' }]; }],
    ['unknown booking status', s => { s.bookings[0].status = 'paid'; }],
    ['drawing point not a number', s => { s.films[0].drawings[0].strokes[0].points[0].x = 'a'; }],
    ['homework missing title', s => { delete s.homework[0].title; }],
    ['notification prefs not booleans', s => { s.notifyPrefs = { p1: { sms: 'yes', email: true, push: true } }; }],
    ['coach note with bad date', s => { s.coachNotes[0].createdAt = 'tomorrow'; }]
  ];
  for (const [label, damage] of broken) {
    const s = structuredClone(seed());
    damage(s);
    assert.equal(isValidState(s, STATE_VERSION), false, label);
  }
});
