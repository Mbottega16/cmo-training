import type { Backend } from './types';
import { createLocalBackend } from './local';

const FORCE_DEMO_KEY = 'cmo-force-demo';
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim() || undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || undefined;
export const backendConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** The dev page can make one browser use demo data even when the real backend is set up. */
export function demoForced(): boolean {
  try {
    return localStorage.getItem(FORCE_DEMO_KEY) === '1';
  } catch {
    return false;
  }
}
export function setDemoForced(on: boolean): void {
  try {
    if (on) localStorage.setItem(FORCE_DEMO_KEY, '1');
    else localStorage.removeItem(FORCE_DEMO_KEY);
  } catch {
    // storage blocked
  }
}

export async function createBackend(): Promise<Backend> {
  if (backendConfigured && !demoForced()) {
    const { createSupabaseBackend } = await import('./supabase'); // only downloaded when the backend is in use
    return createSupabaseBackend(SUPABASE_URL!, SUPABASE_ANON_KEY!);
  }
  return createLocalBackend();
}
