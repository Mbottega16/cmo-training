import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { DemoState, FilmReview } from '../types';
import type { AuthApi, Backend, CommandResult, Profile, Role, SignalChannel } from './types';
import { applyCommand, validSession, type Command } from '../logic';
import { createSeed } from '../seed';
import { filmToRow, rowToFilm, rowsToState, sessionToRow, settingsToRow, type Rows } from './mapping';
import { now } from '../clock';

const okResult = (message = ''): CommandResult => ({ ok: true, message });
const failResult = (message: string): CommandResult => ({ ok: false, message });

function friendly(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return 'Something went wrong.';
  if (error.code === '42501' || /row-level security|permission denied/i.test(error.message ?? '')) return 'You are not allowed to do that.';
  if (/Failed to fetch|NetworkError/i.test(error.message ?? '')) return 'No connection. Check your signal and try again.';
  return error.message ?? 'Something went wrong.';
}

/** The real backend: Supabase (free plan). Rules run in Postgres functions; row-level security decides who sees what. */
export function createSupabaseBackend(url: string, anonKey: string): Backend {
  const sb: SupabaseClient = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'cmo-training-auth' } });
  let current: DemoState = { ...createSeed(now()), players: [], sessions: [], bookings: [], homework: [], films: [], coachNotes: [], notifyPrefs: {} };
  const listeners = new Set<(s: DemoState) => void>();
  const errorListeners = new Set<(m: string) => void>();

  async function load(): Promise<void> {
    const [settings, players, sessions, bookings, homework, films, coachNotes, notifyPrefs, spots] = await Promise.all([
      sb.from('settings').select('*').eq('id', 1).maybeSingle(),
      sb.from('players').select('*').order('created_at'),
      sb.from('sessions').select('*').order('start_at'),
      sb.from('bookings').select('*'),
      sb.from('homework').select('*').order('assigned_at', { ascending: false }),
      sb.from('films').select('*').order('uploaded_at', { ascending: false }),
      sb.from('coach_notes').select('*').order('created_at'),
      sb.from('notify_prefs').select('*'),
      sb.rpc('spots_left')
    ]);
    const firstError = [settings, players, sessions, bookings, homework, films, coachNotes, notifyPrefs, spots].find(r => r.error)?.error;
    if (firstError) throw firstError;
    const rows: Rows = {
      settings: settings.data,
      players: players.data ?? [],
      sessions: sessions.data ?? [],
      bookings: bookings.data ?? [],
      homework: homework.data ?? [],
      films: films.data ?? [],
      coachNotes: coachNotes.data ?? [],
      notifyPrefs: notifyPrefs.data ?? [],
      spots: (spots.data as Rows['spots']) ?? []
    };
    current = rowsToState(rows);
    listeners.forEach(l => l(current));
  }

  let reloadTimer: number | undefined;
  const reloadSoon = () => {
    window.clearTimeout(reloadTimer);
    reloadTimer = window.setTimeout(() => void load().catch(e => errorListeners.forEach(l => l(friendly(e)))), 250);
  };

  async function rpc(fn: string, args: Record<string, unknown> = {}): Promise<CommandResult> {
    const { data, error } = await sb.rpc(fn, args);
    if (error) return failResult(friendly(error));
    const r = (data ?? {}) as { ok?: boolean; message?: string };
    return r.ok ? okResult(r.message ?? '') : failResult(r.message ?? 'Not allowed.');
  }

  async function write(op: PromiseLike<{ error: { message?: string; code?: string } | null }>, message = ''): Promise<CommandResult> {
    const { error } = await op;
    return error ? failResult(friendly(error)) : okResult(message);
  }

  /** Film edits reuse the same rules as the demo, then save the film row. */
  async function editFilm(cmd: Command & { filmId: string }): Promise<CommandResult> {
    const { data, error } = await sb.from('films').select('*').eq('id', cmd.filmId).maybeSingle();
    if (error) return failResult(friendly(error));
    if (!data) return failResult('That film no longer exists.');
    const film = rowToFilm(data);
    const result = applyCommand({ ...current, films: [film] }, cmd, now());
    if (!result.ok) return failResult(result.message);
    const next = result.state.films[0] as FilmReview;
    return write(sb.from('films').update({ notes: next.notes, voice_notes: next.voiceNotes, drawings: next.drawings }).eq('id', film.id));
  }

  async function dispatch(cmd: Command): Promise<CommandResult> {
    let result: CommandResult;
    switch (cmd.type) {
      case 'book':
        result = await rpc('book_session', { p_session_id: cmd.sessionId, p_player_id: cmd.playerId });
        break;
      case 'cancel':
        result = await rpc('cancel_booking', { p_booking_id: cmd.bookingId });
        break;
      case 'waive':
        result = await rpc('waive_late_cancel', { p_booking_id: cmd.bookingId });
        break;
      case 'enforce':
        result = await rpc('enforce_late_cancel', { p_booking_id: cmd.bookingId });
        break;
      case 'attendance':
        result = await rpc('set_attendance', { p_booking_id: cmd.bookingId, p_attendance: cmd.attendance });
        break;
      case 'expire':
        result = await rpc('expire_grace');
        break;
      case 'homework.assign':
        result = await write(
          sb.from('homework').insert({ player_id: cmd.hw.playerId, title: cmd.hw.title, category: cmd.hw.category, reps_or_minutes: cmd.hw.repsOrMinutes, notes: cmd.hw.notes }),
          'Drill assigned.'
        );
        break;
      case 'homework.toggle':
        result = await rpc('toggle_homework', { p_id: cmd.id });
        break;
      case 'notify':
        result = await rpc('set_notify_prefs', { p_player_id: cmd.playerId, p_sms: cmd.prefs.sms, p_email: cmd.prefs.email, p_push: cmd.prefs.push });
        break;
      case 'coachNote.add':
        result = await write(sb.from('coach_notes').insert({ player_id: cmd.playerId, text: cmd.text }));
        break;
      case 'film.add':
        result = await write(sb.from('films').insert(filmToRow(cmd.film)));
        break;
      case 'film.delete':
        result = await write(sb.from('films').delete().eq('id', cmd.filmId));
        break;
      case 'film.note.add':
      case 'film.note.delete':
      case 'film.stroke.add':
      case 'film.stroke.undo':
      case 'film.frame.clear':
      case 'film.memo.add':
      case 'film.memo.delete':
        result = await editFilm(cmd);
        break;
      case 'player.add': {
        if (!cmd.player.name.trim()) return failResult('Give the athlete a name.');
        result = await write(
          sb.from('players').insert({
            name: cmd.player.name.trim(),
            level: cmd.player.level,
            focus_areas: cmd.player.focusAreas,
            phone: cmd.player.phone,
            email: cmd.player.email,
            credits: Math.max(0, Math.round(cmd.player.creditsRemaining ?? 0))
          }),
          `${cmd.player.name.trim()} added.`
        );
        break;
      }
      case 'player.update': {
        const p = cmd.patch;
        const row: Record<string, unknown> = {};
        if (p.name !== undefined) row.name = p.name;
        if (p.level !== undefined) row.level = p.level;
        if (p.focusAreas !== undefined) row.focus_areas = p.focusAreas;
        if (p.phone !== undefined) row.phone = p.phone;
        if (p.email !== undefined) row.email = p.email;
        if (p.xp !== undefined) row.xp = Math.max(0, Math.round(p.xp));
        result = await write(sb.from('players').update(row).eq('id', cmd.id));
        break;
      }
      case 'player.credits':
        result = await rpc('adjust_credits', { p_player_id: cmd.id, p_delta: Math.round(cmd.delta) });
        break;
      case 'session.add': {
        const problem = validSession(cmd.session);
        if (problem) return failResult(problem);
        result = await write(sb.from('sessions').insert(sessionToRow(cmd.session)), 'Session added.');
        break;
      }
      case 'session.update': {
        const existing = current.sessions.find(s => s.id === cmd.id);
        if (!existing) return failResult('That session no longer exists.');
        const merged = { ...existing, ...cmd.patch };
        const problem = validSession(merged);
        if (problem) return failResult(problem);
        result = await write(sb.from('sessions').update(sessionToRow(merged)).eq('id', cmd.id), 'Session saved.');
        break;
      }
      case 'session.delete':
        result = await rpc('delete_session', { p_session_id: cmd.id });
        break;
      case 'settings.update': {
        const clamped = applyCommand(current, cmd, now()).state.settings;
        result = await write(sb.from('settings').update(settingsToRow(clamped)).eq('id', 1), 'Settings saved.');
        break;
      }
    }
    if (result.ok) await load().catch(() => reloadSoon());
    return result;
  }

  const auth: AuthApi = {
    async profile(): Promise<Profile | null> {
      const { data } = await sb.auth.getUser();
      const user = data.user;
      if (!user) return null;
      const { data: p } = await sb.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
      return { userId: user.id, email: user.email ?? '', role: ((p?.role as Role) ?? 'pending'), playerId: p?.player_id ?? null };
    },
    onChange(fn) {
      const { data } = sb.auth.onAuthStateChange(() => {
        fn();
        reloadSoon();
      });
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      return error ? (/invalid/i.test(error.message) ? 'Wrong e-mail or password.' : friendly(error)) : null;
    },
    async signUp(email, password) {
      const { data, error } = await sb.auth.signUp({ email: email.trim(), password });
      if (error) return friendly(error);
      if (!data.session) return 'Account created. Confirm the e-mail Supabase sent, then sign in. (The owner can turn this step off.)';
      return null;
    },
    async claimInvite(code) {
      const r = await rpc('claim_invite', { p_code: code.trim() });
      if (r.ok) reloadSoon();
      return r.ok ? null : r.message;
    },
    async signOut() {
      await sb.auth.signOut();
    },
    async createInvite(role, playerId) {
      const { data, error } = await sb.rpc('create_invite', { p_role: role, p_player_id: playerId ?? null });
      if (error) return { error: friendly(error) };
      return data as { code?: string; error?: string };
    },
    async listProfiles() {
      const { data } = await sb.from('profiles').select('*').order('email');
      return (data ?? []).map(p => ({ userId: p.user_id, email: p.email, role: p.role, playerId: p.player_id }));
    },
    async setRole(userId, role) {
      const r = await rpc('set_role', { p_user_id: userId, p_role: role });
      return r.ok ? null : r.message;
    }
  };

  return {
    kind: 'supabase',
    label: `Supabase (${new URL(url).host})`,
    subscribe(onState, onError) {
      listeners.add(onState);
      errorListeners.add(onError);
      void rpc('expire_grace').finally(() => load().catch(e => onError(friendly(e))));
      const channel = sb
        .channel('cmo-db')
        .on('postgres_changes', { event: '*', schema: 'public' }, () => reloadSoon())
        .subscribe();
      const timer = window.setInterval(() => void rpc('expire_grace').then(r => r.ok && reloadSoon()), 60_000);
      return () => {
        listeners.delete(onState);
        errorListeners.delete(onError);
        window.clearInterval(timer);
        void sb.removeChannel(channel);
      };
    },
    dispatch,
    media: {
      async put(key, blob) {
        const { error } = await sb.storage.from('media').upload(key, blob, { upsert: true, contentType: blob.type || 'application/octet-stream' });
        if (error) throw new Error(friendly(error));
      },
      async get(key) {
        const { data, error } = await sb.storage.from('media').download(key);
        if (error) return undefined;
        return data ?? undefined;
      },
      async remove(key) {
        await sb.storage.from('media').remove([key]);
      }
    },
    signal(room, onMessage): SignalChannel {
      const channel = sb.channel(`call-${room}`, { config: { private: true, broadcast: { self: false } } });
      channel.on('broadcast', { event: 'signal' }, ({ payload }) => onMessage(payload)).subscribe();
      return {
        send: message => void channel.send({ type: 'broadcast', event: 'signal', payload: message }),
        close: () => void sb.removeChannel(channel)
      };
    },
    auth
  };
}
