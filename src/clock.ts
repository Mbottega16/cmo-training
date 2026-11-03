import { useEffect, useState } from 'react';

/**
 * The app's clock. Rules never use the phone's own clock directly:
 * - On the hosted site, `syncClock()` reads the time from the web server's `Date` header, so setting the phone's clock
 *   back can't turn a late cancel into an on-time one. (With the backend, the server applies the rules with its own
 *   clock anyway; this keeps the screens honest too.)
 * - The dev page can add a pretend offset to test grace windows and check-in times. It lives in memory on that page only.
 */
let serverOffsetMs = 0;
let devOffsetMs = 0;
let synced = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

export function now(): Date {
  return new Date(Date.now() + serverOffsetMs + devOffsetMs);
}

export function clockInfo(): { synced: boolean; serverOffsetMs: number; devOffsetMs: number } {
  return { synced, serverOffsetMs, devOffsetMs };
}

export function setDevOffset(ms: number): void {
  devOffsetMs = ms;
  notify();
}

/** Measure the device clock's error against the server. Call once at startup and when the app comes back online. */
export async function syncClock(url: string = window.location.href): Promise<void> {
  try {
    const sent = Date.now();
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    const received = Date.now();
    const header = res.headers.get('date');
    if (!header) return;
    const serverTime = Date.parse(header);
    if (Number.isNaN(serverTime)) return;
    // The header has 1-second resolution and was stamped somewhere during the round trip.
    serverOffsetMs = serverTime + 500 - (sent + received) / 2;
    synced = true;
    notify();
  } catch {
    // Offline: keep the last known offset (0 if never synced).
  }
}

export function subscribeClock(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** A clock that re-renders the caller every `intervalMs` and whenever the clock is corrected. */
export function useNow(intervalMs = 1000): Date {
  const [t, setT] = useState(now);
  useEffect(() => {
    const id = window.setInterval(() => setT(now()), intervalMs);
    const off = subscribeClock(() => setT(now()));
    return () => {
      window.clearInterval(id);
      off();
    };
  }, [intervalMs]);
  return t;
}
