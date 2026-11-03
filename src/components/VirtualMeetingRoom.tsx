import React, { useEffect, useRef, useState } from 'react';
import { Video, VideoOff, Mic, MicOff, PhoneOff, MessageSquare, Copy, Check, Radio, Send, AlertTriangle, Link2 } from 'lucide-react';
import type { AppStore } from '../store';
import { sessionPhase } from '../logic';
import { formatAgo, formatSessionTime, useNow } from '../format';
import { Call, type CallStatus } from '../rtc';
import { AthletePicker, Avatar } from './ui';

interface VirtualMeetingRoomProps {
  store: AppStore;
  mode: 'coach' | 'athlete';
  athleteId: string;
  onAthleteChange?: (id: string) => void;
  /** Where the athlete joins this room (the athlete page). */
  inviteLink?: string;
}

function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError') return 'Camera or microphone permission was denied. You can still see and hear the other person; allow access in the browser settings to be seen.';
  if (name === 'NotFoundError') return 'No camera or microphone was found. You can still see and hear the other person.';
  if (name === 'NotReadableError') return 'The camera is in use by another app.';
  return 'The camera could not start.';
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

const STATUS_TEXT: Record<CallStatus, string> = {
  waiting: 'Waiting for the other person',
  connecting: 'Connecting…',
  connected: 'Connected',
  unreachable: "Can't connect",
  ended: 'Not in the room'
};

export const VirtualMeetingRoom: React.FC<VirtualMeetingRoomProps> = ({ store, mode, athleteId, onAthleteChange, inviteLink }) => {
  const { state, dispatch, backend } = store;
  const athlete = state.players.find(p => p.id === athleteId) ?? state.players[0];
  const now = useNow(1000);

  const [inCall, setInCall] = useState(false);
  const [callStart, setCallStart] = useState<number | null>(null);
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<CallStatus>('ended');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [newNote, setNewNote] = useState('');
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const callRef = useRef<Call | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const hangUp = () => {
    callRef.current?.leave();
    callRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setLocal(null);
    setRemote(null);
    setInCall(false);
    setCallStart(null);
    setStatus('ended');
  };

  // Leaving the screen, or switching athlete, ends the call and turns the camera and mic off.
  useEffect(() => hangUp, [athleteId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (localRef.current) localRef.current.srcObject = local;
  }, [local, inCall]);
  useEffect(() => {
    if (remoteRef.current) remoteRef.current.srcObject = remote;
  }, [remote]);

  if (!athlete) return null;

  const otherName = mode === 'coach' ? athlete.name : 'Coach';
  const coachNotes = state.coachNotes.filter(n => n.playerId === athlete.id);
  const nextVirtual = state.bookings
    .filter(b => b.playerId === athlete.id && b.status === 'confirmed')
    .map(b => state.sessions.find(s => s.id === b.sessionId))
    .filter((s): s is NonNullable<typeof s> => Boolean(s) && s!.type === 'virtual_live' && sessionPhase(s!, now) !== 'ended')
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0];

  const join = async () => {
    setCamError(null);
    setIsMuted(false);
    setIsVideoOff(false);
    let media = new MediaStream();
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError('This page needs a secure (https) address to use the camera. You can still see and hear the other person.');
    } else {
      try {
        media = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (err) {
        setCamError(cameraErrorMessage(err));
      }
    }
    streamRef.current = media;
    setLocal(media);
    setInCall(true);
    setCallStart(Date.now());
    const call = new Call(backend, athlete.id, media, setRemote, setStatus);
    callRef.current = call;
    call.start();
  };

  const toggleMic = () => {
    const next = !isMuted;
    streamRef.current?.getAudioTracks().forEach(t => (t.enabled = !next));
    setIsMuted(next);
  };

  const toggleVideo = () => {
    const next = !isVideoOff;
    streamRef.current?.getVideoTracks().forEach(t => (t.enabled = !next));
    setIsVideoOff(next);
  };

  const handleCopy = async () => {
    if (!inviteLink) return;
    const ok = await copyText(inviteLink);
    setCopyState(ok ? 'copied' : 'failed');
    window.setTimeout(() => setCopyState('idle'), 4000);
  };

  const addNote = (e: React.FormEvent) => {
    e.preventDefault();
    const text = newNote.trim();
    if (!text) return;
    void dispatch({ type: 'coachNote.add', playerId: athlete.id, text });
    setNewNote('');
  };

  const elapsed = callStart ? Math.max(0, Math.floor((now.getTime() - callStart) / 1000)) : 0;
  const timer = `${Math.floor(elapsed / 60).toString().padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}`;
  const hasOwnVideo = Boolean(local && local.getVideoTracks().length > 0 && !isVideoOff);
  const connected = status === 'connected' && remote;
  const across = backend.kind === 'supabase' ? `${otherName} joins from their own phone or computer.` : `In the demo, ${otherName} joins from another tab of this browser (open the invite link there).`;

  return (
    <div className="space-y-4">
      <div className="bg-brand-card border border-brand-border rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-white">CMO Video Room</h2>
            <span
              role="status"
              className={`text-[11px] border px-2 py-0.5 rounded ${
                status === 'connected' ? 'bg-brand-success/20 border-brand-green/50 text-green-200' : status === 'unreachable' ? 'bg-red-500/10 border-red-500/40 text-red-200' : 'bg-brand-surface border-brand-border text-slate-300'
              }`}
            >
              {STATUS_TEXT[status]}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {mode === 'coach' ? (
              <>
                Private 1-on-1 with <span className="text-white font-medium">{athlete.name}</span>
              </>
            ) : (
              <>Your private video session with Coach</>
            )}
            {' · '}
            {across}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          {mode === 'coach' && onAthleteChange && <AthletePicker players={state.players} value={athlete.id} onChange={onAthleteChange} />}
          {mode === 'coach' && inviteLink && (
            <button onClick={handleCopy} className="min-h-[44px] text-xs bg-brand-surface border border-brand-border hover:border-slate-500 text-slate-300 px-3 py-2 rounded-xl flex items-center justify-center gap-1.5">
              {copyState === 'copied' ? <Check className="w-3.5 h-3.5 text-brand-green" /> : <Copy className="w-3.5 h-3.5" />}
              {copyState === 'copied' ? 'Link copied' : copyState === 'failed' ? 'Copy failed: see link below' : 'Copy invite link'}
            </button>
          )}
          {!inCall ? (
            <button onClick={join} className="min-h-[44px] text-xs font-semibold bg-brand-action hover:bg-brand-actionHover text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2">
              <Radio className="w-4 h-4" />
              {mode === 'coach' ? 'Open the room' : 'Join the room'}
            </button>
          ) : (
            <button onClick={hangUp} className="min-h-[44px] text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2">
              <PhoneOff className="w-4 h-4" />
              Leave
            </button>
          )}
        </div>
      </div>

      {mode === 'coach' && inviteLink && copyState === 'failed' && (
        <div className="bg-brand-surface border border-brand-border rounded-xl p-3 text-xs flex items-center gap-2">
          <Link2 className="w-4 h-4 text-slate-400 shrink-0" />
          <input readOnly value={inviteLink} onFocus={e => e.currentTarget.select()} className="flex-1 bg-transparent text-slate-200 outline-none" aria-label="Invite link" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-brand-card border border-brand-border rounded-2xl overflow-hidden flex flex-col">
          <div className="relative aspect-video bg-black flex items-center justify-center">
            {inCall ? (
              <>
                <video ref={remoteRef} autoPlay playsInline aria-label={`${otherName}'s camera`} className={`absolute inset-0 w-full h-full object-cover ${connected ? '' : 'hidden'}`} />
                <video
                  ref={localRef}
                  autoPlay
                  playsInline
                  muted
                  aria-label="Your camera"
                  className={`object-cover -scale-x-100 transition ${hasOwnVideo ? '' : 'hidden'} ${
                    connected ? 'absolute bottom-3 right-3 w-28 sm:w-44 aspect-video rounded-xl border-2 border-white/30 shadow-2xl z-10' : 'w-full h-full'
                  }`}
                />
                {!connected && (
                  <div className={`${hasOwnVideo ? 'absolute top-3 right-3 w-44 sm:w-52' : 'relative w-64'} rounded-xl border-2 border-dashed border-brand-orange/60 bg-brand-dark/90 p-3 text-center`}>
                    {!hasOwnVideo && (
                      <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-brand-surface border border-brand-border flex items-center justify-center text-sm font-bold text-white">
                        {mode === 'coach' ? 'CMO' : <Avatar player={athlete} size="sm" />}
                      </div>
                    )}
                    <p className="text-[11px] text-white font-medium">{otherName}</p>
                    <p className="text-[10px] text-slate-300 mt-0.5">{status === 'unreachable' ? "Can't connect on this network" : status === 'connecting' ? 'Connecting…' : 'Not here yet'}</p>
                  </div>
                )}
                <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-mono text-white flex items-center gap-1.5 border border-white/10 z-20">
                  <span className={`w-2 h-2 rounded-full ${connected ? 'bg-brand-green' : 'bg-red-500'}`} />
                  {timer}
                </div>
              </>
            ) : (
              <div className="text-center p-6 sm:p-8 max-w-sm">
                <div className="w-14 h-14 rounded-2xl bg-brand-surface border border-brand-border flex items-center justify-center mx-auto mb-3 text-brand-orange">
                  <Video className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">Room ready</h3>
                <p className="text-xs text-slate-300">No Zoom or Meet account needed. The video goes straight between your two devices.</p>
              </div>
            )}
          </div>

          {(camError || status === 'unreachable') && (
            <div className="px-4 py-3 bg-brand-orange/10 border-t border-brand-orange/30 text-xs text-orange-200 flex items-start gap-2" role="alert">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {camError}
                {status === 'unreachable' &&
                  ` ${camError ? ' ' : ''}The two devices couldn't reach each other directly. This happens on some strict mobile or office networks; try Wi-Fi on both sides.`}
              </span>
            </div>
          )}

          <div className="p-3 bg-brand-surface border-t border-brand-border flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                disabled={!inCall || !local?.getAudioTracks().length}
                onClick={toggleMic}
                aria-pressed={isMuted}
                aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border transition disabled:opacity-40 ${
                  isMuted ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-brand-card border-brand-border text-slate-200 hover:text-white'
                }`}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button
                disabled={!inCall || !local?.getVideoTracks().length}
                onClick={toggleVideo}
                aria-pressed={isVideoOff}
                aria-label={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
                className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border transition disabled:opacity-40 ${
                  isVideoOff ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-brand-card border-brand-border text-slate-200 hover:text-white'
                }`}
              >
                {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
              </button>
            </div>
            <div className="text-[11px] text-slate-400 text-right">{inCall ? STATUS_TEXT[status] : 'Standby'}</div>
          </div>
        </div>

        {mode === 'coach' ? (
          <div className="bg-brand-card border border-brand-border rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-brand-border mb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-brand-orange" />
                  <h3 className="text-sm font-bold text-white">Coaching notes</h3>
                </div>
                <span className="text-[10px] text-slate-400">Private to coaches</span>
              </div>
              <div className="space-y-2 max-h-64 sm:max-h-80 overflow-y-auto overscroll-contain pr-1 text-xs">
                {coachNotes.length === 0 && <p className="text-slate-400">No notes yet.</p>}
                {coachNotes.map((note, index) => (
                  <div key={note.id} className="bg-brand-surface border border-brand-border/70 rounded-xl p-2.5 text-slate-200">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span>Point #{index + 1}</span>
                      <span>{formatAgo(note.createdAt, now)}</span>
                    </div>
                    <p className="break-words">{note.text}</p>
                  </div>
                ))}
              </div>
            </div>
            <form onSubmit={addNote} className="mt-4 pt-3 border-t border-brand-border flex gap-2">
              <input
                type="text"
                maxLength={300}
                placeholder="Log a key teaching point…"
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                aria-label="New coaching note"
                className="flex-1 min-w-0 bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-orange"
              />
              <button type="submit" aria-label="Save note" className="bg-brand-action hover:bg-brand-actionHover text-white min-w-[44px] rounded-xl flex items-center justify-center">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-brand-card border border-brand-border rounded-2xl p-4 text-xs space-y-2">
            <h3 className="text-sm font-bold text-white">Your next video session</h3>
            {nextVirtual ? (
              <>
                <p className="text-slate-200">{nextVirtual.title}</p>
                <p className="text-slate-400">{formatSessionTime(nextVirtual.start, nextVirtual.end, now)}</p>
              </>
            ) : (
              <p className="text-slate-400">None booked. Book one from your portal.</p>
            )}
            <p className="text-slate-400 pt-2">Tip: set your phone sideways on a stand so Coach can see your full body and footwork.</p>
          </div>
        )}
      </div>
    </div>
  );
};
