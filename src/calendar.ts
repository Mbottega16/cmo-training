/**
 * Calendar files (.ics, RFC 5545) for a booked session, so an athlete can add it to Apple, Google or Outlook.
 * Plain text building only, no browser APIs, so tests/calendar.test.ts runs it under Node.
 */
import type { TrainingSession } from './types';

/** TEXT values: escape backslashes, semicolons and commas, and turn line breaks into \n. */
export function icsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
}

/** UTC date-time, for example 20261106T230000Z. */
export function icsTime(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '');
}

const encoder = new TextEncoder();

/** Lines longer than 75 bytes continue on the next line, which starts with a space. Never splits a character. */
function fold(line: string): string {
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74; // a continuation line spends one byte on its leading space
    if (bytes + size > limit) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/** One event for one session. `stamp` is when the file was made (use the trusted clock). */
export function sessionIcs(session: TrainingSession, stamp: Date): string {
  const where = session.courtAddress ? `${session.courtLocation} (${session.courtAddress})` : session.courtLocation;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CMO Training//Sessions//EN',
    'BEGIN:VEVENT',
    `UID:cmo-training-${session.id}`,
    `DTSTAMP:${icsTime(stamp)}`,
    `DTSTART:${icsTime(new Date(session.start))}`,
    `DTEND:${icsTime(new Date(session.end))}`,
    `SUMMARY:${icsText(`${session.title} - CMO Training`)}`,
    `LOCATION:${icsText(where)}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ];
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

/** A safe file name from the session title, for example "Ball-Screen-Reads.ics". */
export function icsFileName(session: TrainingSession): string {
  const base = session.title.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return `${base || 'session'}.ics`;
}
