// The backend's rules and access control, run on a real Postgres (PGlite, in-process) with small stand-ins for the
// parts of Supabase the schema touches (auth.users/auth.uid, storage, realtime). Run with `npm test`.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const SCHEMA = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');

const SUPABASE_STANDINS = `
create role anon nologin;
create role authenticated nologin;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
create schema auth;
grant usage on schema auth to anon, authenticated;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated;
create schema storage;
grant usage on schema storage to authenticated;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
create table storage.objects (id serial primary key, bucket_id text, name text);
grant all on storage.objects to authenticated;
grant usage, select on sequence storage.objects_id_seq to authenticated;
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
create schema realtime;
grant usage on schema realtime to authenticated;
create table realtime.messages (id serial primary key, topic text, payload text);
grant all on realtime.messages to authenticated;
grant usage, select on sequence realtime.messages_id_seq to authenticated;
alter table realtime.messages enable row level security;
create function realtime.topic() returns text language sql stable as $$ select current_setting('test.topic', true) $$;
create publication supabase_realtime;
`;

const OWNER = '00000000-0000-0000-0000-000000000001';
const COACH = '00000000-0000-0000-0000-000000000002';
const JORDAN = '00000000-0000-0000-0000-000000000003';
const MARCUS = '00000000-0000-0000-0000-000000000004';
const STRANGER = '00000000-0000-0000-0000-000000000005';

let db: PGlite;

/** Run SQL as a signed-in user (or anon with uid null), with row-level security applied. */
async function as<T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.query(`select set_config('test.uid', $1, false)`, [uid ?? '']);
  await db.exec(`set role ${uid ? 'authenticated' : 'anon'}`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec('reset role');
  }
}
async function rpc(uid: string | null, fn: string, args: unknown[] = []): Promise<{ ok?: boolean; message?: string; code?: string; error?: string }> {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(', ');
  const rows = await as<{ r: { ok?: boolean; message?: string } }>(uid, `select public.${fn}(${placeholders}) as r`, args);
  return rows[0].r as never;
}
const admin = (sql: string, params: unknown[] = []) => db.query<Record<string, any>>(sql, params).then(r => r.rows);
const credits = async (id: string) => (await admin('select credits from players where id = $1', [id]))[0].credits as number;
const status = async (id: string) => (await admin('select status, decision_reason from bookings where id = $1', [id]))[0];

/** A session `hours` from now with capacity `cap`. */
async function session(id: string, hours: number, cap = 4) {
  await admin(
    `insert into sessions (id, title, start_at, end_at, type, max_capacity) values ($1, $1, now() + make_interval(mins => $2::int), now() + make_interval(mins => $2::int + 60), $3, $4)`,
    [id, Math.round(hours * 60), cap === 1 ? 'one_on_one' : 'small_group', cap]
  );
}
async function bookingId(sessionId: string, playerId: string, st = 'confirmed'): Promise<string> {
  return (await admin('select id from bookings where session_id = $1 and player_id = $2 and status = $3', [sessionId, playerId, st]))[0]?.id;
}

before(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STANDINS);
  await db.exec(SCHEMA);
  await admin(`update app_config set owner_email = 'owner@example.com'`);
  await admin(`insert into auth.users (id, email) values ($1, 'Owner@Example.com'), ($2, 'coach@example.com'), ($3, 'jordan@example.com'), ($4, 'marcus@example.com'), ($5, 'stranger@example.com')`, [OWNER, COACH, JORDAN, MARCUS, STRANGER]);
  await admin(`insert into players (id, name, credits) values ('p1', 'Jordan', 4), ('p2', 'Marcus', 2), ('p3', 'Tariq', 0)`);
});

test('the schema loads cleanly and the owner e-mail (any case) becomes dev; everyone else starts pending', async () => {
  const roles = await admin('select user_id, role from profiles order by user_id');
  assert.deepEqual(roles.map(r => r.role), ['dev', 'pending', 'pending', 'pending', 'pending']);
});

test('invites: only the owner can invite a coach; codes link the account once and only once', async () => {
  assert.ok((await rpc(COACH, 'create_invite', ['coach'])).error, 'a pending user cannot invite');
  const coachInvite = await rpc(OWNER, 'create_invite', ['coach']);
  assert.match(coachInvite.code!, /^[0-9A-F]{8}$/);
  assert.equal((await rpc(COACH, 'claim_invite', [coachInvite.code!.toLowerCase()])).ok, true);
  assert.equal((await rpc(STRANGER, 'claim_invite', [coachInvite.code])).ok, false, 'single use');
  assert.ok((await rpc(COACH, 'create_invite', ['coach'])).error, 'a coach cannot mint coaches');
  const j = await rpc(COACH, 'create_invite', ['athlete', 'p1']);
  const m = await rpc(COACH, 'create_invite', ['athlete', 'p2']);
  assert.equal((await rpc(JORDAN, 'claim_invite', [j.code])).ok, true);
  assert.equal((await rpc(MARCUS, 'claim_invite', [m.code])).ok, true);
  const p = await admin('select role, player_id from profiles where user_id = $1', [JORDAN]);
  assert.deepEqual(p[0], { role: 'athlete', player_id: 'p1' });
  assert.equal((await rpc(STRANGER, 'claim_invite', ['NOPE1234'])).ok, false);
});

test('privacy: athletes see only themselves; strangers and anonymous visitors see nothing', async () => {
  await session('priv', 48);
  assert.equal((await rpc(MARCUS, 'book_session', ['priv'])).ok, true);
  assert.deepEqual((await as(JORDAN, 'select id from players')).map(r => r.id), ['p1']);
  assert.equal((await as(JORDAN, `select * from bookings where player_id = 'p2'`)).length, 0, "can't see Marcus's bookings");
  assert.equal((await as(STRANGER, 'select * from players')).length, 0);
  assert.equal((await as(STRANGER, 'select * from sessions')).length, 0, 'signed up without an invite: no schedule either');
  assert.equal((await as(STRANGER, 'select * from spots_left()')).length, 0);
  assert.equal((await as(null, 'select * from players')).length, 0);
  assert.equal((await as(null, 'select * from sessions')).length, 0);
  assert.equal((await as(JORDAN, 'select * from coach_notes')).length, 0);
  assert.equal((await rpc(null, 'book_session', ['priv'])).ok, false);
  const spots = await as<{ session_id: string; spots: number }>(JORDAN, `select * from spots_left() where session_id = 'priv'`);
  assert.equal(spots[0].spots, 3, 'spots_left shows counts without revealing who booked');
});

test("athletes can't change credits, XP or bookings directly, or act for someone else", async () => {
  await session('own', 48);
  await as(JORDAN, `update players set credits = 999, xp = 999 where id = 'p1'`).catch(() => undefined);
  assert.equal(await credits('p1'), 4);
  await assert.rejects(as(JORDAN, `insert into bookings (session_id, player_id) values ('own', 'p1')`));
  assert.equal((await rpc(JORDAN, 'book_session', ['own', 'p2'])).ok, false, 'cannot book for Marcus');
  assert.equal((await rpc(MARCUS, 'book_session', ['own'])).ok, true);
  assert.equal((await rpc(JORDAN, 'cancel_booking', [await bookingId('own', 'p2')])).ok, false, "cannot cancel Marcus's booking");
  assert.equal((await rpc(JORDAN, 'adjust_credits', ['p1', 50])).ok, false);
  await assert.rejects(as(JORDAN, 'select public._refund_refilled($1)', ['own']), /permission denied/);
  await assert.rejects(as(JORDAN, 'select public._expire_grace_all()'), /permission denied/);
});

test('booking uses a credit and refuses started, duplicate, full and no-credit bookings', async () => {
  await session('b1', 48, 1);
  await session('started', -0.5);
  const before = await credits('p1');
  assert.equal((await rpc(JORDAN, 'book_session', ['b1'])).ok, true);
  assert.equal(await credits('p1'), before - 1);
  assert.match((await rpc(JORDAN, 'book_session', ['b1'])).message!, /already booked/);
  assert.match((await rpc(MARCUS, 'book_session', ['b1'])).message!, /full/);
  assert.match((await rpc(JORDAN, 'book_session', ['started'])).message!, /already started/);
  await rpc(COACH, 'create_invite', ['athlete', 'p3']);
  assert.match((await rpc(COACH, 'book_session', ['b1', 'p3'])).message!, /full|credits/);
});

test("late cancel: server time decides, the credit is held, and only staff can waive (an athlete can't excuse themselves)", async () => {
  await session('late', 4);
  await session('early', 10);
  await rpc(JORDAN, 'book_session', ['late']);
  await rpc(JORDAN, 'book_session', ['early']);
  const c0 = await credits('p1');
  assert.equal((await rpc(JORDAN, 'cancel_booking', [await bookingId('early', 'p1')])).ok, true);
  assert.equal(await credits('p1'), c0 + 1, '6+ hours: credit back');
  const lateId = await bookingId('late', 'p1');
  assert.match((await rpc(JORDAN, 'cancel_booking', [lateId])).message!, /Late cancel/);
  const row = (await admin(`select status, extract(epoch from (grace_expires_at - cancelled_at)) / 3600 as grace from bookings where id = $1`, [lateId]))[0];
  assert.equal(row.status, 'cancelled_late');
  assert.equal(Math.round(Number(row.grace)), 24);
  assert.equal(await credits('p1'), c0 + 1, 'credit held, not returned');
  assert.equal((await rpc(JORDAN, 'waive_late_cancel', [lateId])).ok, false, 'athlete cannot waive');
  assert.equal((await rpc(MARCUS, 'waive_late_cancel', [lateId])).ok, false);
  assert.equal((await rpc(COACH, 'waive_late_cancel', [lateId])).ok, true);
  assert.equal(await credits('p1'), c0 + 2);
  assert.equal((await rpc(COACH, 'waive_late_cancel', [lateId])).ok, false, 'no double waive');
});

test('refill mode: a late-cancelled 1-on-1 that someone else books gives the canceller their credit back', async () => {
  await session('solo', 3, 1);
  await rpc(JORDAN, 'book_session', ['solo']);
  const id = await bookingId('solo', 'p1');
  await rpc(JORDAN, 'cancel_booking', [id]);
  const jordan = await credits('p1');
  const marcusTry = await rpc(MARCUS, 'book_session', ['solo']);
  assert.match(marcusTry.message!, /credits/, 'Marcus is out of credits at this point (spent in earlier tests)');
  await rpc(COACH, 'adjust_credits', ['p2', 3]);
  assert.equal((await rpc(MARCUS, 'book_session', ['solo'])).ok, true, 'the spot reopened');
  assert.deepEqual(await status(id), { status: 'excused', decision_reason: 'refilled' });
  assert.equal(await credits('p1'), jordan + 1);
});

test('refill mode: newcomers fill empty spots first; the canceller is refunded only when the session is full again', async () => {
  await admin(`update players set credits = 10 where id in ('p1', 'p2')`);
  await admin(`insert into players (id, name, credits) values ('p4', 'Devon', 5), ('p5', 'Sam', 5), ('p6', 'Lee', 5), ('p7', 'Kai', 5)`);
  await session('grp', 3, 4);
  await rpc(JORDAN, 'book_session', ['grp']);
  await rpc(COACH, 'book_session', ['grp', 'p4']); // 2 of 4
  const id = await bookingId('grp', 'p1');
  await rpc(JORDAN, 'cancel_booking', [id]); // late: 1 of 4
  await rpc(COACH, 'book_session', ['grp', 'p5']); // 2 of 4: an empty spot
  await rpc(COACH, 'book_session', ['grp', 'p6']); // 3 of 4: still an empty spot
  assert.equal((await status(id)).status, 'cancelled_late', "newcomers took empty spots, not Jordan's");
  await rpc(COACH, 'book_session', ['grp', 'p7']); // 4 of 4
  assert.equal((await status(id)).decision_reason, 'refilled');
});

test('refill mode: two late cancels are refunded oldest first, one per needed spot; a waived one counts as refunded', async () => {
  await admin(`update players set credits = 10 where id in ('p1', 'p2', 'p4', 'p5', 'p6')`);
  await session('pair', 3, 2);
  await rpc(JORDAN, 'book_session', ['pair']);
  await rpc(COACH, 'book_session', ['pair', 'p4']); // full
  const j = await bookingId('pair', 'p1');
  const d = await bookingId('pair', 'p4');
  await rpc(JORDAN, 'cancel_booking', [j]);
  await admin(`update bookings set cancelled_at = cancelled_at - interval '1 minute' where id = $1`, [j]); // Jordan first
  await rpc(COACH, 'cancel_booking', [d]);
  await rpc(COACH, 'book_session', ['pair', 'p5']);
  assert.equal((await status(j)).decision_reason, 'refilled');
  assert.equal((await status(d)).status, 'cancelled_late', 'only one spot needed so far');
  await session('pair2', 3, 2);
  await rpc(COACH, 'book_session', ['pair2', 'p6']);
  await rpc(COACH, 'book_session', ['pair2', 'p5']);
  const lee = await bookingId('pair2', 'p6');
  const sam = await bookingId('pair2', 'p5');
  await rpc(COACH, 'cancel_booking', [lee]);
  await rpc(COACH, 'cancel_booking', [sam]);
  await rpc(COACH, 'waive_late_cancel', [lee]); // coach excuses Lee
  await rpc(COACH, 'book_session', ['pair2', 'p4']);
  assert.equal((await status(sam)).status, 'cancelled_late', "the newcomer covers the waived spot, not Sam's");
});

test("lock mode: a late-cancelled spot can't be resold", async () => {
  await admin(`update settings set late_spot = 'lock'`);
  try {
    await session('locked', 3, 1);
    await rpc(JORDAN, 'book_session', ['locked']);
    await rpc(JORDAN, 'cancel_booking', [await bookingId('locked', 'p1')]);
    assert.match((await rpc(MARCUS, 'book_session', ['locked'])).message!, /full/);
  } finally {
    await admin(`update settings set late_spot = 'refill'`);
  }
});

test('grace windows run out into forfeits; enforce keeps the credit used', async () => {
  await session('gr', 2);
  await rpc(JORDAN, 'book_session', ['gr']);
  const id = await bookingId('gr', 'p1');
  await rpc(JORDAN, 'cancel_booking', [id]);
  await admin(`update bookings set grace_expires_at = now() - interval '1 minute' where id = $1`, [id]);
  assert.equal((await rpc(JORDAN, 'expire_grace')).ok, true);
  assert.deepEqual(await status(id), { status: 'forfeited', decision_reason: 'expired' });
  assert.equal((await rpc(null, 'expire_grace')).ok, false, 'anonymous visitors cannot trigger it');
});

test('check-in: staff only, inside the window, XP once', async () => {
  await session('now', -0.2);
  await session('later', 72);
  await admin(`insert into bookings (id, session_id, player_id) values ('bn', 'now', 'p2'), ('bl', 'later', 'p2')`);
  const xp0 = (await admin(`select xp from players where id = 'p2'`))[0].xp;
  assert.equal((await rpc(MARCUS, 'set_attendance', ['bn', 'present'])).ok, false, 'athletes cannot check themselves in');
  assert.equal((await rpc(COACH, 'set_attendance', ['bl', 'present'])).ok, false, 'not open days ahead');
  assert.equal((await rpc(COACH, 'set_attendance', ['bn', 'present'])).ok, true);
  await rpc(COACH, 'set_attendance', ['bn', 'present']);
  assert.equal((await admin(`select xp from players where id = 'p2'`))[0].xp, xp0 + 50);
});

test('deleting a session refunds everyone holding a credit for it', async () => {
  await session('del', 48);
  await rpc(MARCUS, 'book_session', ['del']);
  const c = await credits('p2');
  assert.equal((await rpc(JORDAN, 'delete_session', ['del'])).ok, false);
  assert.equal((await rpc(COACH, 'delete_session', ['del'])).ok, true);
  assert.equal(await credits('p2'), c + 1);
});

test('files: athletes read only their own folder; only staff upload', async () => {
  await admin(`insert into storage.objects (bucket_id, name) values ('media', 'films/p1/a.mp4'), ('media', 'films/p2/b.mp4')`);
  assert.deepEqual((await as(JORDAN, 'select name from storage.objects')).map(r => r.name), ['films/p1/a.mp4']);
  await assert.rejects(as(JORDAN, `insert into storage.objects (bucket_id, name) values ('media', 'films/p1/x.mp4')`));
  assert.equal((await as(COACH, 'select name from storage.objects')).length, 2);
});

test('video-call channels: an athlete can only use their own', async () => {
  const send = (uid: string, topic: string) => db.query(`select set_config('test.topic', $1, false)`, [topic]).then(() => as(uid, `insert into realtime.messages (topic, payload) values ($1, 'x')`, [topic]));
  await send(JORDAN, 'call-p1');
  await assert.rejects(send(JORDAN, 'call-p2'));
  await send(COACH, 'call-p2');
});

test('owner-only: roles can be changed by the owner, never by themselves or others', async () => {
  assert.equal((await rpc(COACH, 'set_role', [MARCUS, 'coach'])).ok, false);
  assert.equal((await rpc(JORDAN, 'set_role', [JORDAN, 'coach'])).ok, false);
  assert.equal((await rpc(OWNER, 'set_role', [OWNER, 'pending'])).ok, false, "owner can't lock themselves out");
  assert.equal((await rpc(OWNER, 'set_role', [STRANGER, 'coach'])).ok, true);
});

test('invite codes expire after 14 days, and 10 wrong guesses in an hour lock the account out', async () => {
  await admin(`insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000009', 'guesser@example.com')`);
  const GUESSER = '00000000-0000-0000-0000-000000000009';
  const old = await rpc(COACH, 'create_invite', ['athlete', 'p2']);
  await admin(`update invites set created_at = now() - interval '15 days' where code = $1`, [old.code]);
  assert.match((await rpc(GUESSER, 'claim_invite', [old.code])).message!, /expired/);
  for (let i = 0; i < 9; i++) await rpc(GUESSER, 'claim_invite', [`BAD${i}0000`]);
  const fresh = await rpc(COACH, 'create_invite', ['athlete', 'p2']);
  assert.match((await rpc(GUESSER, 'claim_invite', [fresh.code])).message!, /Too many/, 'locked out even with a right code');
  assert.equal((await as(GUESSER, 'select * from invite_attempts')).length, 0, 'attempt log is private');
});
