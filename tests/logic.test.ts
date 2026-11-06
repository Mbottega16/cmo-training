// Run with `npm test` (Node 22.6+ runs TypeScript directly; tests/run.mjs adds the flag Node 22 needs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeed, DEFAULT_SETTINGS, STATE_VERSION } from '../src/seed.ts';
import {
  addStroke,
  applyCommand,
  bookSession,
  cancelBooking,
  cancellationPreview,
  clearFrame,
  enforceLateCancel,
  expireGraceWindows,
  isValidState,
  sessionPhase,
  setAttendance,
  spotsLeft,
  undoStroke,
  waiveLateCancel,
  weeklyStarts,
  MAX_REPEAT_WEEKS
} from '../src/logic.ts';
import type { DemoState, Settings, Stroke } from '../src/types.ts';

const NOW = new Date('2026-11-03T15:00:00Z');
const HOUR = 3_600_000;
const later = (hours: number) => new Date(NOW.getTime() + hours * HOUR);
const credits = (s: DemoState, id: string) => s.players.find(p => p.id === id)!.creditsRemaining;
const xp = (s: DemoState, id: string) => s.players.find(p => p.id === id)!.xp;
const booking = (s: DemoState, id: string) => s.bookings.find(b => b.id === id)!;
const withSettings = (s: DemoState, patch: Partial<Settings>): DemoState => ({ ...s, settings: { ...s.settings, ...patch } });

/** One session `hoursOut` from NOW (capacity `cap`) with Jordan (p1) booked as b-test. */
function withSessionIn(hoursOut: number, cap = 2): DemoState {
  const s = createSeed(NOW);
  const start = later(hoursOut);
  return {
    ...s,
    sessions: [...s.sessions, { id: 'sx', title: 'Test', courtLocation: '', courtAddress: '', start: start.toISOString(), end: new Date(start.getTime() + HOUR).toISOString(), type: cap === 1 ? 'one_on_one' : 'small_group', maxCapacity: cap, price: 65 }],
    bookings: [...s.bookings, { id: 'b-test', sessionId: 'sx', playerId: 'p1', status: 'confirmed', attendance: 'pending', bookedAt: NOW.toISOString() }]
  };
}
const sx = (s: DemoState) => s.sessions.find(x => x.id === 'sx')!;

test('the seed has a live session, a late-cancel session and an early-cancel session for Jordan', () => {
  const s = createSeed(NOW);
  const byId = (id: string) => s.sessions.find(x => x.id === id)!;
  assert.equal(sessionPhase(byId('s1'), NOW), 'live');
  assert.equal(cancellationPreview(byId('s2'), NOW, s.settings).kind, 'late');
  assert.equal(cancellationPreview(byId('s3'), NOW, s.settings).kind, 'early');
  assert.deepEqual(s.settings, DEFAULT_SETTINGS);
});

test('booking uses one credit and refuses full, started, duplicate and no-credit bookings', () => {
  const s = createSeed(NOW);
  const r = bookSession(s, 's4', 'p1', NOW);
  assert.equal(r.ok, true);
  assert.equal(credits(r.state, 'p1'), credits(s, 'p1') - 1);
  assert.equal(bookSession(r.state, 's4', 'p1', NOW).ok, false, 'no double booking');
  assert.equal(bookSession(s, 's1', 'p3', NOW).ok, false, 'live session cannot be booked');
  const one = bookSession(s, 's6', 'p1', NOW).state;
  assert.equal(bookSession(one, 's6', 'p3', NOW).ok, false, '1-on-1 is full after one booking');
  const broke = { ...s, players: s.players.map(p => (p.id === 'p1' ? { ...p, creditsRemaining: 0 } : p)) };
  const refused = bookSession(broke, 's4', 'p1', NOW);
  assert.equal(refused.ok, false);
  assert.equal(refused.state, broke, 'a refused booking changes nothing');
});

test('cancelling 6+ hours out restores the credit at once; exactly 6 hours counts as on time', () => {
  for (const h of [10, 6]) {
    const s = withSessionIn(h);
    const r = cancelBooking(s, 'b-test', NOW);
    assert.equal(booking(r.state, 'b-test').status, 'cancelled_early', `${h}h`);
    assert.equal(credits(r.state, 'p1'), credits(s, 'p1') + 1);
  }
});

test('cancelling under 6 hours holds the credit, starts the grace window, and records how full the session was', () => {
  const s = withSessionIn(5.9);
  const r = cancelBooking(s, 'b-test', NOW);
  const b = booking(r.state, 'b-test');
  assert.equal(b.status, 'cancelled_late');
  assert.equal(credits(r.state, 'p1'), credits(s, 'p1'));
  assert.equal(new Date(b.graceExpiresAt!).getTime(), NOW.getTime() + 24 * HOUR);
  assert.equal(b.confirmedAtCancel, 1);
});

test('the late-cancel threshold and grace window come from settings', () => {
  const s = withSettings(withSessionIn(5), { lateCancelHours: 4, graceHours: 2 });
  assert.equal(booking(cancelBooking(s, 'b-test', NOW).state, 'b-test').status, 'cancelled_early', '5h is on time when the line is 4h');
  const t = withSettings(withSessionIn(3), { lateCancelHours: 4, graceHours: 2 });
  const b = booking(cancelBooking(t, 'b-test', NOW).state, 'b-test');
  assert.equal(new Date(b.graceExpiresAt!).getTime(), NOW.getTime() + 2 * HOUR);
});

test('a session that has started cannot be cancelled', () => {
  const s = withSessionIn(-0.1);
  const r = cancelBooking(s, 'b-test', NOW);
  assert.equal(r.ok, false);
  assert.equal(r.state, s);
});

test('waiving restores the credit once; enforcing keeps it used and cannot then be waived', () => {
  const late = cancelBooking(withSessionIn(2), 'b-test', NOW).state;
  const waived = waiveLateCancel(late, 'b-test', NOW);
  assert.deepEqual([booking(waived.state, 'b-test').status, booking(waived.state, 'b-test').decisionReason], ['excused', 'coach']);
  assert.equal(credits(waived.state, 'p1'), credits(late, 'p1') + 1);
  assert.equal(waiveLateCancel(waived.state, 'b-test', NOW).ok, false);
  const enforced = enforceLateCancel(late, 'b-test', NOW);
  assert.equal(booking(enforced.state, 'b-test').status, 'forfeited');
  assert.equal(credits(enforced.state, 'p1'), credits(late, 'p1'));
  assert.equal(waiveLateCancel(enforced.state, 'b-test', NOW).ok, false);
});

test('the grace window runs out into a forfeit, not before', () => {
  const late = cancelBooking(withSessionIn(2), 'b-test', NOW).state;
  assert.equal(expireGraceWindows(late, later(23.9)), late);
  const expired = expireGraceWindows(late, later(24));
  assert.deepEqual([booking(expired, 'b-test').status, booking(expired, 'b-test').decisionReason], ['forfeited', 'expired']);
});

test('refill (default): a late-cancelled 1-on-1 reopens, and when someone books it the canceller gets the credit back', () => {
  const late = cancelBooking(withSessionIn(3, 1), 'b-test', NOW).state;
  assert.equal(spotsLeft(late, sx(late)), 1, 'spot reopened');
  const r = bookSession(late, 'sx', 'p3', NOW);
  assert.equal(r.ok, true);
  assert.deepEqual([booking(r.state, 'b-test').status, booking(r.state, 'b-test').decisionReason], ['excused', 'refilled']);
  assert.equal(credits(r.state, 'p1'), credits(late, 'p1') + 1, 'Jordan refunded');
  assert.equal(credits(r.state, 'p3'), credits(late, 'p3') - 1, 'Tariq paid');
});

const addAthlete = (s: DemoState, name: string, credits = 5) => {
  const r = applyCommand(s, { type: 'player.add', player: { name, level: '', focusAreas: [], phone: '', email: '', creditsRemaining: credits } }, NOW);
  return { state: r.state, id: r.state.players.at(-1)!.id };
};

test('refill: newcomers fill empty spots first; the canceller is refunded only when the session is full again', () => {
  let s = withSessionIn(3, 4); // Jordan
  s = bookSession(s, 'sx', 'p3', NOW).state; // 2 of 4
  s = cancelBooking(s, 'b-test', NOW).state; // Jordan late: 1 of 4
  const a = addAthlete(s, 'A');
  s = bookSession(a.state, 'sx', a.id, NOW).state; // 2 of 4: an empty spot
  assert.equal(booking(s, 'b-test').status, 'cancelled_late', 'took an empty spot, not Jordan\'s');
  const b = addAthlete(s, 'B');
  s = bookSession(b.state, 'sx', b.id, NOW).state; // 3 of 4: still an empty spot
  assert.equal(booking(s, 'b-test').status, 'cancelled_late');
  const c = addAthlete(s, 'C');
  const before = credits(c.state, 'p1');
  s = bookSession(c.state, 'sx', c.id, NOW).state; // 4 of 4: Jordan's spot was needed
  assert.deepEqual([booking(s, 'b-test').status, booking(s, 'b-test').decisionReason], ['excused', 'refilled']);
  assert.equal(credits(s, 'p1'), before + 1);
});

test('refill: two late cancels are refunded oldest first, one per needed spot', () => {
  let s = withSessionIn(3, 2); // Jordan
  s = bookSession(s, 'sx', 'p3', NOW).state; // full
  const tariq = s.bookings.find(b => b.sessionId === 'sx' && b.playerId === 'p3')!.id;
  s = cancelBooking(s, 'b-test', NOW).state; // Jordan first
  s = cancelBooking(s, tariq, new Date(NOW.getTime() + 60_000)).state; // Tariq a minute later
  const a = addAthlete(s, 'A');
  s = bookSession(a.state, 'sx', a.id, NOW).state;
  assert.equal(booking(s, 'b-test').decisionReason, 'refilled');
  assert.equal(booking(s, tariq).status, 'cancelled_late', 'only one spot needed so far');
  const b = addAthlete(s, 'B');
  s = bookSession(b.state, 'sx', b.id, NOW).state;
  assert.equal(booking(s, tariq).decisionReason, 'refilled');
});

test('refill: a late cancel the coach already waived counts as refunded', () => {
  let s = withSessionIn(3, 2);
  s = bookSession(s, 'sx', 'p3', NOW).state;
  const tariq = s.bookings.find(b => b.sessionId === 'sx' && b.playerId === 'p3')!.id;
  s = cancelBooking(s, 'b-test', NOW).state;
  s = cancelBooking(s, tariq, new Date(NOW.getTime() + 60_000)).state;
  s = waiveLateCancel(s, 'b-test', NOW).state; // coach excuses Jordan
  const a = addAthlete(s, 'A');
  s = bookSession(a.state, 'sx', a.id, NOW).state;
  assert.equal(booking(s, tariq).status, 'cancelled_late', "the newcomer's credit covers the waived spot, not Tariq's");
});

test('refill also covers a forfeited spot until the session starts', () => {
  const late = cancelBooking(withSessionIn(3, 1), 'b-test', NOW).state;
  const forfeited = enforceLateCancel(late, 'b-test', NOW).state;
  assert.equal(booking(bookSession(forfeited, 'sx', 'p3', NOW).state, 'b-test').status, 'excused');
  assert.equal(bookSession(forfeited, 'sx', 'p3', later(3.5)).ok, false, 'a started session cannot be booked at all');
});

test('lock mode: a late-cancelled or forfeited spot stays held and is never resold', () => {
  const s = withSettings(withSessionIn(3, 1), { lateSpot: 'lock' });
  const late = cancelBooking(s, 'b-test', NOW).state;
  assert.equal(spotsLeft(late, sx(late)), 0);
  assert.match(bookSession(late, 'sx', 'p3', NOW).message, /full/);
  assert.equal(spotsLeft(waiveLateCancel(late, 'b-test', NOW).state, sx(late)), 1, 'a waiver frees it');
});

test('check-in gives the configured XP once; undoing or switching to no-show takes it back', () => {
  const s = createSeed(NOW); // b2 = Marcus in live s1
  const present = setAttendance(s, 'b2', 'present', NOW);
  assert.equal(xp(present, 'p2'), xp(s, 'p2') + 50);
  assert.equal(setAttendance(present, 'b2', 'present', NOW), present);
  assert.equal(xp(setAttendance(present, 'b2', 'absent', NOW), 'p2'), xp(s, 'p2'));
  const custom = setAttendance(withSettings(s, { checkInXp: 20 }), 'b2', 'present', NOW);
  assert.equal(xp(custom, 'p2'), xp(s, 'p2') + 20);
});

test('check-in only works inside its window, and attendance belongs to one booking', () => {
  const s = createSeed(NOW); // b7 = Marcus in s5, three days out
  assert.equal(setAttendance(s, 'b7', 'present', NOW), s);
  const start = new Date(s.sessions.find(x => x.id === 's5')!.start).getTime();
  const end = new Date(s.sessions.find(x => x.id === 's5')!.end).getTime();
  assert.equal(booking(setAttendance(s, 'b7', 'present', new Date(start - 29 * 60_000)), 'b7').attendance, 'present');
  assert.equal(setAttendance(s, 'b7', 'present', new Date(start - 31 * 60_000)), s);
  assert.equal(setAttendance(s, 'b7', 'present', new Date(end + 13 * HOUR)), s);
  assert.equal(booking(setAttendance(s, 'b2', 'present', NOW), 'b7').attendance, 'pending');
});

test('coach tools: add an athlete, add credits, add/edit/delete sessions (with refunds), and settings are clamped', () => {
  let s = createSeed(NOW);
  const added = applyCommand(s, { type: 'player.add', player: { name: ' Sam ', level: 'HS', focusAreas: [], phone: '', email: '', creditsRemaining: 3 } }, NOW);
  assert.equal(added.ok, true);
  const sam = added.state.players.at(-1)!;
  assert.deepEqual([sam.name, sam.creditsRemaining, sam.xp], ['Sam', 3, 0]);
  assert.equal(applyCommand(s, { type: 'player.add', player: { name: '  ', level: '', focusAreas: [], phone: '', email: '' } }, NOW).ok, false);
  s = applyCommand(added.state, { type: 'player.credits', id: sam.id, delta: 5 }, NOW).state;
  assert.equal(credits(s, sam.id), 8);
  assert.equal(credits(applyCommand(s, { type: 'player.credits', id: sam.id, delta: -50 }, NOW).state, sam.id), 0, 'never below zero');
  const bad = applyCommand(s, { type: 'session.add', session: { title: 'X', courtLocation: '', courtAddress: '', start: later(5).toISOString(), end: later(4).toISOString(), type: 'small_group', maxCapacity: 4, price: 0 } }, NOW);
  assert.match(bad.message, /end after/);
  const del = applyCommand(s, { type: 'session.delete', id: 's2' }, NOW);
  assert.equal(credits(del.state, 'p1'), credits(s, 'p1') + 1, 'Jordan was booked on s2');
  assert.equal(del.state.bookings.some(b => b.sessionId === 's2'), false);
  const st = applyCommand(s, { type: 'settings.update', patch: { lateCancelHours: -5, graceHours: 9999, checkInXp: 25 } }, NOW).state.settings;
  assert.deepEqual([st.lateCancelHours, st.graceHours, st.checkInXp], [0, 336, 25]);
});

test('drawings join the frame within 0.15 s, start a new frame beyond it, and undo/clear only that frame', () => {
  const pen = (id: string): Stroke => ({ id, tool: 'pen', color: '#fff', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] });
  let d = addStroke([], 3.2, pen('a'));
  d = addStroke(d, 3.3, pen('b'));
  assert.equal(d.length, 1);
  d = addStroke(d, 5, pen('c'));
  assert.equal(d.length, 2);
  d = undoStroke(d, 3.2);
  assert.equal(d.find(f => f.timestamp === 3.2)!.strokes.length, 1);
  assert.deepEqual(clearFrame(d, 5).map(f => f.timestamp), [3.2]);
});

test('one damaged record anywhere makes the whole saved state untrusted', () => {
  assert.equal(isValidState(createSeed(NOW), STATE_VERSION), true);
  const broken: Array<[string, (s: any) => void]> = [
    ['old version', s => { s.version = 3; }],
    ['missing settings', s => { delete s.settings; }],
    ['bad late-spot setting', s => { s.settings.lateSpot = 'maybe'; }],
    ['film without notes', s => { delete s.films[0].notes; }],
    ['bare film record', s => { s.films = [{ id: 'f', playerId: 'p1' }]; }],
    ['unknown booking status', s => { s.bookings[0].status = 'paid'; }],
    ['unknown decision reason', s => { s.bookings[0].decisionReason = 'bribe'; }],
    ['drawing point not a number', s => { s.films[0].drawings[0].strokes[0].points[0].x = 'a'; }],
    ['homework missing title', s => { delete s.homework[0].title; }],
    ['notification prefs not booleans', s => { s.notifyPrefs = { p1: { sms: 'yes', email: true, push: true } }; }],
    ['coach note with bad date', s => { s.coachNotes[0].createdAt = 'tomorrow'; }]
  ];
  for (const [label, damage] of broken) {
    const s = structuredClone(createSeed(NOW));
    damage(s);
    assert.equal(isValidState(s, STATE_VERSION), false, label);
  }
});

/** Runs `fn` with the process in another time zone, then puts the old one back. */
function inZone(zone: string, fn: () => void) {
  const before = process.env.TZ;
  process.env.TZ = zone;
  try {
    fn();
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
}

test('weekly repeats keep the local start time across daylight-saving changes', () => {
  const WEEK = 7 * 24 * HOUR;
  inZone('America/New_York', () => {
    // Clocks go forward on Sunday 14 March 2027: a Monday 6 PM session is still 6 PM a week later.
    const spring = weeklyStarts(new Date(2027, 2, 8, 18, 0), 2);
    assert.deepEqual(spring.map(d => [d.getDate(), d.getHours(), d.getMinutes()]), [[8, 18, 0], [15, 18, 0]]);
    assert.equal(spring[1].getTime() - spring[0].getTime(), WEEK - HOUR, 'the real gap is one hour short of 7 × 24 h');

    // Clocks go back on Sunday 1 November 2026.
    const fall = weeklyStarts(new Date(2026, 9, 30, 18, 30), 2);
    assert.deepEqual(fall.map(d => [d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]), [[9, 30, 18, 30], [10, 6, 18, 30]]);
    assert.equal(fall[1].getTime() - fall[0].getTime(), WEEK + HOUR);
  });
});

test('weekly repeats: one session per week, same weekday, between 1 and the maximum', () => {
  const first = new Date(2026, 10, 9, 17, 0); // a Monday
  const eight = weeklyStarts(first, 8);
  assert.equal(eight.length, 8);
  assert.ok(eight.every(d => d.getDay() === first.getDay() && d.getHours() === 17));
  assert.equal(weeklyStarts(first, 0).length, 1, 'never fewer than the one session asked for');
  assert.equal(weeklyStarts(first, 99).length, MAX_REPEAT_WEEKS);
  assert.deepEqual(weeklyStarts(new Date('not a date'), 4), [], 'a bad start time makes no sessions');
});
