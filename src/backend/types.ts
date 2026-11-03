import type { DemoState } from '../types';
import type { Command } from '../logic';

export type Role = 'dev' | 'coach' | 'athlete' | 'pending';

export interface Profile {
  userId: string;
  email: string;
  role: Role;
  playerId: string | null;
}

export interface CommandResult {
  ok: boolean;
  message: string;
}

export interface MediaStore {
  put(key: string, blob: Blob): Promise<void>;
  get(key: string): Promise<Blob | undefined>;
  remove(key: string): Promise<void>;
}

/** A tiny message channel for setting up a video call between two devices. */
export interface SignalChannel {
  send(message: unknown): void;
  close(): void;
}

export interface AuthApi {
  profile(): Promise<Profile | null>;
  onChange(fn: () => void): () => void;
  /** Each returns an error message, or null on success. */
  signIn(email: string, password: string): Promise<string | null>;
  signUp(email: string, password: string): Promise<string | null>;
  claimInvite(code: string): Promise<string | null>;
  signOut(): Promise<void>;
  createInvite(role: 'coach' | 'athlete', playerId?: string): Promise<{ code?: string; error?: string }>;
  listProfiles(): Promise<Profile[]>;
  setRole(userId: string, role: Role): Promise<string | null>;
}

export interface Backend {
  kind: 'local' | 'supabase';
  /** Shown on the dev page. */
  label: string;
  /** Loads the data and keeps it fresh; calls onState on every change. Returns a stop function. */
  subscribe(onState: (state: DemoState) => void, onError: (message: string) => void): () => void;
  dispatch(cmd: Command): Promise<CommandResult>;
  media: MediaStore;
  signal(room: string, onMessage: (message: unknown) => void): SignalChannel;
  /** Present only with the real backend. */
  auth?: AuthApi;
  /** Demo only: start over / load a saved copy. */
  reset?(): Promise<void>;
  replaceState?(state: DemoState): Promise<CommandResult>;
}
