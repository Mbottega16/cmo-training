// Calendar files for booked sessions (src/calendar.ts). Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { icsFileName, icsText, icsTime, sessionIcs } from '../src/calendar.ts';
import type { TrainingSession } from '../src/types.ts';

const session: TrainingSession = {
  id: 's_abc123',
  title: 'Shooting, Reads; Finishing',
  courtLocation: 'The Fieldhouse — Court 2',
  courtAddress: '12 Main St, Springfield',
  start: '2026-11-06T23:00:00.000Z',
  end: '2026-11-07T00:00:00.000Z',
  type: 'small_group',
  maxCapacity: 6,
  price: 65
};

test('calendar file: one event in UTC times, with commas and semicolons escaped', () => {
  const ics = sessionIcs(session, new Date('2026-11-06T12:00:00.000Z'));
  assert.ok(ics.endsWith('\r\n'));
  const lines = ics.trimEnd().split('\r\n');
  assert.equal(lines[0], 'BEGIN:VCALENDAR');
  assert.equal(lines.at(-1), 'END:VCALENDAR');
  assert.ok(lines.includes('DTSTART:20261106T230000Z'));
  assert.ok(lines.includes('DTEND:20261107T000000Z'));
  assert.ok(lines.includes('DTSTAMP:20261106T120000Z'));
  assert.ok(lines.includes('UID:cmo-training-s_abc123'));
  assert.ok(lines.includes('SUMMARY:Shooting\\, Reads\\; Finishing - CMO Training'));
  assert.ok(lines.includes('LOCATION:The Fieldhouse — Court 2 (12 Main St\\, Springfield)'));
  assert.equal(icsText('a\\b\nc'), 'a\\\\b\\nc', 'backslashes and line breaks are escaped too');
  assert.equal(icsTime(new Date('2027-01-02T03:04:05.678Z')), '20270102T030405Z');
});

test('calendar file: long lines fold at 75 bytes without splitting a character', () => {
  const long = { ...session, title: 'Él — '.repeat(30).trim() }; // two- and three-byte characters
  const ics = sessionIcs(long, new Date('2026-11-06T12:00:00.000Z'));
  const physical = ics.trimEnd().split('\r\n');
  const bytes = (s: string) => new TextEncoder().encode(s).length;
  assert.ok(physical.every(line => bytes(line) <= 75), 'no line over 75 bytes');
  const unfolded = ics.replace(/\r\n /g, '');
  assert.ok(unfolded.includes(`SUMMARY:${long.title} - CMO Training`), 'unfolding gives back the whole title');
});

test('calendar file names keep letters and digits only', () => {
  assert.equal(icsFileName(session), 'Shooting-Reads-Finishing.ics');
  assert.equal(icsFileName({ ...session, title: '***' }), 'session.ics');
});
