import { useCallback, useEffect, useRef, useState } from 'react';
import type { DemoState } from './types';
import { createSeed, STATE_VERSION } from './seed';
import { expireGraceWindows, isValidState } from './logic';
import { clearMedia } from './media';

const STORAGE_KEY = 'cmo-training-demo';

function readSaved(raw: string | null): DemoState | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isValidState(parsed, STATE_VERSION) ? parsed : null;
  } catch {
    return null;
  }
}

function loadState(): DemoState {
  try {
    return readSaved(localStorage.getItem(STORAGE_KEY)) ?? createSeed();
  } catch {
    return createSeed(); // storage blocked (private mode, settings)
  }
}

export interface DemoStore {
  state: DemoState;
  /** Apply a change to the latest state. */
  update: (fn: (s: DemoState) => DemoState) => void;
  /** Run a rule that returns a result message, and keep its new state. */
  run: <R extends { state: DemoState }>(fn: (s: DemoState) => R) => R;
  reset: () => void;
  saveFailed: boolean;
}

/**
 * The demo's whole state, saved in this browser only. Other tabs of the app stay in sync,
 * so a coach tab and an athlete tab can be open side by side.
 */
export function useDemoStore(): DemoStore {
  const [state, setState] = useState<DemoState>(() => expireGraceWindows(loadState(), new Date()));
  const [saveFailed, setSaveFailed] = useState(false);
  const ref = useRef(state);
  ref.current = state;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
  }, [state]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const next = expireGraceWindows(ref.current, new Date());
      if (next !== ref.current) setState(next);
    }, 15_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const next = readSaved(e.newValue);
      if (next) setState(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = useCallback((fn: (s: DemoState) => DemoState) => {
    const next = fn(ref.current);
    ref.current = next;
    setState(next);
  }, []);

  const run = useCallback(<R extends { state: DemoState }>(fn: (s: DemoState) => R): R => {
    const result = fn(ref.current);
    ref.current = result.state;
    setState(result.state);
    return result;
  }, []);

  const reset = useCallback(() => {
    void clearMedia();
    const fresh = createSeed();
    ref.current = fresh;
    setState(fresh);
  }, []);

  return { state, update, run, reset, saveFailed };
}
