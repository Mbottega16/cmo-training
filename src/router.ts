import { useCallback, useEffect, useState } from 'react';

/** The part of the address after `#/`, split on `/`. Each page decides what the parts mean. */
export function hashParts(): string[] {
  return window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
}

/** Re-renders on back/forward and returns a `go` that updates the address. */
export function useHashParts(): [string[], (parts: string[], opts?: { scroll?: boolean }) => void] {
  const [parts, setParts] = useState(hashParts);
  useEffect(() => {
    const onHash = () => setParts(hashParts());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = useCallback((next: string[], opts?: { scroll?: boolean }) => {
    const hash = `#/${next.filter(Boolean).join('/')}`;
    if (window.location.hash !== hash) window.location.hash = hash;
    setParts(next.filter(Boolean));
    if (opts?.scroll !== false) window.scrollTo({ top: 0 });
  }, []);
  return [parts, go];
}

export const toHash = (parts: string[]) => `#/${parts.filter(Boolean).join('/')}`;

/** Sibling page URL, e.g. pageUrl('athlete', ['room', 'p1']) from /coach/ gives /athlete/#/room/p1. Works under any base path. */
export function pageUrl(page: 'coach' | 'athlete' | 'dev' | '', parts: string[] = []): string {
  const here = window.location.pathname;
  const root = here.replace(/(coach|athlete|dev)\/(index\.html)?$/, '').replace(/index\.html$/, '');
  return `${window.location.origin}${root}${page ? `${page}/` : ''}${parts.length ? toHash(parts) : ''}`;
}
