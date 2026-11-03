import { useEffect, useState } from 'react';
import type { SessionType } from './types';

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

function dayLabel(d: Date, now: Date): string {
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(d) - start(now)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return dayFmt.format(d);
}

export function formatSessionTime(startIso: string, endIso: string, now: Date): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return `${dayLabel(start, now)}, ${timeFmt.format(start)} – ${timeFmt.format(end)}`;
}

export function formatDay(iso: string, now: Date): string {
  return dayLabel(new Date(iso), now);
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
}

export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.max(0, Math.round(hours * 60))} min`;
  return `${Math.round(hours * 10) / 10} hours`;
}

export function formatAgo(iso: string, now: Date): string {
  const mins = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return dayFmt.format(new Date(iso));
}

/** Video time as m:ss.t */
export function formatSecs(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const totalTenths = Math.floor(s * 10 + 1e-6); // the tiny nudge stops 7.8 showing as 7.7
  const mins = Math.floor(totalTenths / 600);
  const secs = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;
  return `${mins}:${secs.toString().padStart(2, '0')}.${tenths}`;
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function sessionTypeLabel(type: SessionType, maxCapacity: number): string {
  if (type === 'one_on_one') return '1-on-1';
  if (type === 'virtual_live') return 'Virtual (video)';
  return `Small group (max ${maxCapacity})`;
}

/** A clock that re-renders the caller every `intervalMs`. */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
