import { useCallback, useEffect, useRef, useState } from 'react';
import type { DemoState } from './types';
import { createSeed, STATE_VERSION } from './seed';
import { expireGraceWindows, isValidState } from './logic';
import { clearMedia } from './media';

export const STORAGE_KEY = 'cmo-training-demo';
const LOCK_NAME = 'cmo-training-state';

function readSaved(raw: string | null): DemoState | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isValidState(parsed, STATE_VERSION) ? parsed : null;
  } catch {
    return null;
  }
}

function readStorage(): DemoState | null {
  try {
    return readSaved(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null; // storage blocked (private mode, settings)
  }
}

function writeStorage(state: DemoState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** Clears everything the demo saved in this browser. Used by Reset and by the crash screen. */
export async function wipeSavedData(): Promise<void> {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage blocked
  }
  await clearMedia();
}

/**
 * Runs `fn` while holding a lock shared by every tab of the app, so two tabs can never both act on stale data
 * (for example both booking the last spot). Browsers without the Web Locks API run it directly.
 */
function withLock<T>(fn: () => T): Promise<T> {
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  if (!locks) return Promise.resolve(fn());
  return locks.request(LOCK_NAME, () => fn()) as Promise<T>;
}

export interface DemoStore {
  state: DemoState;
  /** Apply a change to the latest saved state. */
  update: (fn: (s: DemoState) => DemoState) => Promise<void>;
  /** Run a rule that returns a result message on the latest saved state, and keep its new state. */
  run: <R extends { state: DemoState }>(fn: (s: DemoState) => R) => Promise<R>;
  reset: () => Promise<void>;
  saveFailed: boolean;
}

/**
 * The demo's whole state, saved in this browser only. Every change re-reads the saved copy inside a cross-tab lock,
 * applies the rule, and saves before releasing the lock. Other tabs update through the storage event.
 */
export function useDemoStore(): DemoStore {
  const [state, setState] = useState<DemoState>(() => expireGraceWindows(readStorage() ?? createSeed(), new Date()));
  const [saveFailed, setSaveFailed] = useState(false);
  const ref = useRef(state);
  ref.current = state;

  // Saves the first state (a fresh seed or expired grace windows) and anything set without `commit`.
  useEffect(() => {
    setSaveFailed(!writeStorage(state));
  }, [state]);

  const commit = useCallback(<R extends { state: DemoState }>(fn: (s: DemoState) => R): R => {
    const base = readStorage() ?? ref.current;
    const result = fn(base);
    setSaveFailed(!writeStorage(result.state));
    ref.current = result.state;
    setState(result.state);
    return result;
  }, []);

  const run = useCallback(<R extends { state: DemoState }>(fn: (s: DemoState) => R) => withLock(() => commit(fn)), [commit]);

  const update = useCallback(
    async (fn: (s: DemoState) => DemoState) => {
      await run(s => ({ state: fn(s) }));
    },
    [run]
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      void run(s => ({ state: expireGraceWindows(s, new Date()) }));
    }, 15_000);
    return () => window.clearInterval(id);
  }, [run]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const next = readSaved(e.newValue);
      if (next) {
        ref.current = next;
        setState(next);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const reset = useCallback(async () => {
    await clearMedia();
    await run(() => ({ state: createSeed() }));
  }, [run]);

  return { state, update, run, reset, saveFailed };
}
