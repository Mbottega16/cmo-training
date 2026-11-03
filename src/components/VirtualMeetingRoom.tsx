import React, { useEffect, useRef, useState } from 'react';
import { Video, VideoOff, Mic, MicOff, PhoneOff, MessageSquare, Copy, Check, Radio, Send, AlertTriangle, Link2 } from 'lucide-react';
import type { DemoStore } from '../store';
import { sessionPhase, uid } from '../logic';
import { formatAgo, formatSessionTime, useNow } from '../format';
import { AthletePicker, Avatar } from './ui';

interface VirtualMeetingRoomProps {
  store: DemoStore;
  mode: 'coach' | 'athlete';
  athleteId: string;
  onAthleteChange?: (id: string) => void;
}

function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError') return 'Camera or microphone permission was denied. Allow it in the browser settings and try again.';
  if (name === 'NotFoundError') return 'No camera or microphone was found on this device.';
  if (name === 'NotReadableError') return 'The camera is in use by another app.';
  return 'The camera could not start.';
}

function inviteLink(athleteId: string): string {
  return `${window.location.origin}${window.location.pathname}#/athlete/${athleteId}/room`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the old way
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

export const VirtualMeetingRoom: React.FC<VirtualMeetingRoomProps> = ({ store, mode, athleteId, onAthleteChange }) => {
  const { state, update } = store;
  const athlete = state.players.find(p => p.id === athleteId) ?? state.players[0];
  const now = useNow(1000);

  const [inCall, setInCall] = useState(false);
  const [callStart, setCallStart] = useState<number | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [newNote, setNewNote] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setStream(null);
  };

  // Leaving the tab mid-call must turn the camera and mic off.
  useEffect(() => () => streamRef.current?.getTracks().forEach(t => t.stop()), []);

  // The video element stays mounted during a call; re-attach whenever the stream changes.
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream, inCall]);

  if (!athlete) return null;

  const otherName = mode === 'coach' ? athlete.name : 'Coach';
  const coachNotes = state.coachNotes.filter(n => n.playerId === athlete.id);
  const nextVirtual = state.bookings
    .filter(b => b.playerId === athlete.id && b.status === 'confirmed')
    .map(b => state.sessions.find(s => s.id === b.sessionId))
    .filter((s): s is NonNullable<typeof s> => Boolean(s) && s!.type === 'virtual_live' && sessionPhase(s!, now) !== 'ended')
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0];

  const startMeeting = async () => {
    setCamError(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setInCall(true);
    setCallStart(Date.now());
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError('This page needs a secure (https) address to use the camera. It works on localhost and on the hosted site.');
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = media;
      setStream(media);
    } catch (err) {
      setCamError(cameraErrorMessage(err));
    }
  };

  const endMeeting = () => {
    stopStream();
    setInCall(false);
    setCallStart(null);
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
    const ok = await copyText(inviteLink(athlete.id));
    setCopyState(ok ? 'copied' : 'failed');
    window.setTimeout(() => setCopyState('idle'), 4000);
  };

  const addNote = (e: React.FormEvent) => {
    e.preventDefault();
    const text = newNote.trim();
    if (!text) return;
    update(s => ({ ...s, coachNotes: [...s.coachNotes, { id: uid('c'), playerId: athlete.id, text, createdAt: new Date().toISOString() }] }));
    setNewNote('');
  };

  const elapsed = callStart ? Math.max(0, Math.floor((now.getTime() - callStart) / 1000)) : 0;
  const timer = `${Math.floor(elapsed / 60).toString().padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}`;
  const showOwnVideo = inCall && stream && !isVideoOff;

  return (
    <div className="space-y-4">
      <div className="bg-brand-card border border-brand-border rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-white">CMO Video Room</h2>
            <span className="text-[11px] bg-brand-surface border border-brand-border px-2 py-0.5 rounded text-slate-300">Demo: your camera only</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {mode === 'coach' ? (
              <>
                Private 1-on-1 with <span className="text-white font-medium">{athlete.name}</span> ({athlete.level})
              </>
            ) : (
              <>Your private video session with Coach</>
            )}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          {mode === 'coach' && onAthleteChange && <AthletePicker players={state.players} value={athlete.id} onChange={onAthleteChange} />}
          {mode === 'coach' && (
            <button
              onClick={handleCopy}
              className="min-h-[44px] text-xs bg-brand-surface border border-brand-border hover:border-slate-500 text-slate-300 px-3 py-2 rounded-xl flex items-center justify-center gap-1.5"
            >
              {copyState === 'copied' ? <Check className="w-3.5 h-3.5 text-brand-green" /> : <Copy className="w-3.5 h-3.5" />}
              {copyState === 'copied' ? 'Link copied' : copyState === 'failed' ? 'Copy failed: see link below' : 'Copy invite link'}
            </button>
          )}
          {!inCall ? (
            <button
              onClick={startMeeting}
              className="min-h-[44px] text-xs font-semibold bg-brand-action hover:bg-brand-actionHover text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-brand-orange/20"
            >
              <Radio className="w-4 h-4" />
              {mode === 'coach' ? 'Open the room' : 'Join the room'}
            </button>
          ) : (
            <button onClick={endMeeting} className="min-h-[44px] text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2">
              <PhoneOff className="w-4 h-4" />
              Leave
            </button>
          )}
        </div>
      </div>

      {mode === 'coach' && copyState === 'failed' && (
        <div className="bg-brand-surface border border-brand-border rounded-xl p-3 text-xs flex items-center gap-2">
          <Link2 className="w-4 h-4 text-slate-400 shrink-0" />
          <input readOnly value={inviteLink(athlete.id)} onFocus={e => e.currentTarget.select()} className="flex-1 bg-transparent text-slate-200 outline-none" aria-label="Invite link" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-brand-card border border-brand-border rounded-2xl overflow-hidden flex flex-col">
          <div className="relative aspect-video bg-black flex items-center justify-center">
            {inCall ? (
              <>
                <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover -scale-x-100 ${showOwnVideo ? '' : 'hidden'}`} />
                {!showOwnVideo && (
                  <div className="flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                    <div className="w-20 h-20 rounded-full bg-brand-surface border border-brand-border flex items-center justify-center text-xl font-bold text-white mb-2">
                      {mode === 'coach' ? 'CMO' : <Avatar player={athlete} />}
                    </div>
                    <p className="text-xs">{camError ? 'Camera off' : isVideoOff ? 'Your video is off' : 'Starting camera…'}</p>
                  </div>
                )}

                <div className="absolute top-3 right-3 w-36 sm:w-48 aspect-video rounded-xl overflow-hidden border-2 border-dashed border-brand-orange/60 bg-brand-dark/90 flex flex-col items-center justify-center p-2 text-center">
                  <span className="text-[11px] text-white font-medium">{otherName}</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Waiting to join…</span>
                </div>

                <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-mono text-white flex items-center gap-1.5 border border-white/10">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  {timer}
                </div>
              </>
            ) : (
              <div className="text-center p-6 sm:p-8 max-w-sm">
                <div className="w-14 h-14 rounded-2xl bg-brand-surface border border-brand-border flex items-center justify-center mx-auto mb-3 text-brand-orange">
                  <Video className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">Room ready</h3>
                <p className="text-xs text-slate-400">No Zoom or Meet account needed. In this demo you'll see your own camera; {otherName} can't join yet.</p>
              </div>
            )}
          </div>

          {camError && (
            <div className="px-4 py-3 bg-brand-orange/10 border-t border-brand-orange/30 text-xs text-orange-200 flex items-start gap-2" role="alert">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {camError}
            </div>
          )}

          <div className="p-3 bg-brand-surface border-t border-brand-border flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                disabled={!inCall || !stream}
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
                disabled={!inCall || !stream}
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
            <div className="text-[11px] text-slate-400 text-right">
              {inCall ? 'Live calls with a second person turn on when the video service is connected.' : 'Standby'}
            </div>
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
                <span className="text-[10px] text-slate-400">Saved to {athlete.name.split(' ')[0]}'s file</span>
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
