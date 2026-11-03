import type { DemoState } from '../types';
import type { Backend, CommandResult, SignalChannel } from './types';
import { createSeed, STATE_VERSION } from '../seed';
import { applyCommand, expireGraceWindows, isValidState, type Command } from '../logic';
import { clearMedia, deleteMedia, getMedia, putMedia } from '../media';
import { now } from '../clock';

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
 * Runs `fn` while holding a lock shared by every tab and page of the app, so two tabs never act on stale data
 * (for example both booking the last spot). Browsers without the Web Locks API run it directly.
 */
function withLock<T>(fn: () => T): Promise<T> {
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  if (!locks) return Promise.resolve(fn());
  return locks.request(LOCK_NAME, () => fn()) as Promise<T>;
}

/** The demo backend: everything lives in this browser (localStorage + IndexedDB). Coach, athlete and dev pages share it. */
export function createLocalBackend(): Backend {
  let current: DemoState = expireGraceWindows(readStorage() ?? createSeed(now()), now());
  writeStorage(current);
  const listeners = new Set<(s: DemoState) => void>();
  const emit = () => listeners.forEach(l => l(current));

  const commit = (fn: (s: DemoState) => { state: DemoState; ok: boolean; message: string }): CommandResult => {
    const base = readStorage() ?? current;
    const result = fn(base);
    if (result.ok && !writeStorage(result.state)) {
      return { ok: false, message: 'This browser is blocking storage, so the change could not be saved.' };
    }
    if (result.ok) {
      current = result.state;
      emit();
    }
    return { ok: result.ok, message: result.message };
  };

  window.addEventListener('storage', e => {
    if (e.key !== STORAGE_KEY) return;
    const next = readSaved(e.newValue);
    if (next) {
      current = next;
      emit();
    }
  });

  return {
    kind: 'local',
    label: 'Demo data in this browser',
    subscribe(onState) {
      listeners.add(onState);
      onState(current);
      const id = window.setInterval(() => {
        void withLock(() => commit(s => applyCommand(s, { type: 'expire' }, now())));
      }, 15_000);
      return () => {
        listeners.delete(onState);
        window.clearInterval(id);
      };
    },
    dispatch(cmd: Command) {
      return withLock(() => commit(s => applyCommand(s, cmd, now())));
    },
    media: { put: putMedia, get: getMedia, remove: deleteMedia },
    signal(room, onMessage): SignalChannel {
      // Two tabs of the same browser can call each other in the demo; across devices needs the backend.
      if (typeof BroadcastChannel === 'undefined') return { send() {}, close() {} };
      const channel = new BroadcastChannel(`cmo-call-${room}`);
      channel.onmessage = e => onMessage(e.data);
      return { send: m => channel.postMessage(m), close: () => channel.close() };
    },
    async reset() {
      await clearMedia();
      await withLock(() => commit(() => ({ ok: true, state: createSeed(now()), message: 'Demo reset.' })));
    },
    async replaceState(state) {
      if (!isValidState(state, STATE_VERSION)) return { ok: false, message: 'That file is not a saved CMO Training demo (or it is from another version).' };
      return withLock(() => commit(() => ({ ok: true, state, message: 'Demo data loaded.' })));
    }
  };
}
