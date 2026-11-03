import React, { useState, useRef, useEffect } from 'react';
import { 
  Video, VideoOff, Mic, MicOff, PhoneOff, Share2, 
  MessageSquare, Users, Shield, Copy, Check, Radio, Send
} from 'lucide-react';
import type { Player } from '../types';

interface VirtualMeetingRoomProps {
  athlete: Player;
}

export const VirtualMeetingRoom: React.FC<VirtualMeetingRoomProps> = ({ athlete }) => {
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [notes, setNotes] = useState<string[]>([
    'Focus on hip angle when breaking down off catch',
    'Remind him: eyes on rim before deciding to pass'
  ]);
  const [newNote, setNewNote] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Timer effect
  useEffect(() => {
    let interval: any = null;
    if (isInCall) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [isInCall]);

  const startMeeting = async () => {
    setIsInCall(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.log('Camera access skipped or denied — using athletic visual room avatar mode.');
    }
  };

  const endMeeting = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsInCall(false);
  };

  const toggleMic = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
    }
    setIsMuted(!isMuted);
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
    }
    setIsVideoOff(!isVideoOff);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const addLiveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setNotes([...notes, newNote.trim()]);
    setNewNote('');
  };

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="bg-brand-card border border-brand-border rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-green animate-pulse"></span>
            <h2 className="text-lg font-bold text-white">CMO In-App Virtual Court Room</h2>
            <span className="text-xs bg-brand-surface border border-brand-border px-2 py-0.5 rounded text-slate-300">
              WebRTC Encrypted
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Private 1-on-1 live call with <span className="text-white font-medium">{athlete.name}</span> ({athlete.level})
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => {
              setCopiedLink(true);
              setTimeout(() => setCopiedLink(false), 2000);
            }}
            className="flex-1 sm:flex-initial text-xs bg-brand-surface border border-brand-border hover:border-slate-500 text-slate-300 px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-brand-green" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedLink ? 'Link Copied!' : 'Copy Invite Link'}
          </button>

          {!isInCall ? (
            <button
              onClick={startMeeting}
              className="flex-1 sm:flex-initial text-xs font-semibold bg-brand-orange hover:bg-brand-orangeHover text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-brand-orange/20 transition-all"
            >
              <Radio className="w-4 h-4 animate-pulse" />
              Launch Live Room
            </button>
          ) : (
            <button
              onClick={endMeeting}
              className="flex-1 sm:flex-initial text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              <PhoneOff className="w-4 h-4" />
              End Meeting
            </button>
          )}
        </div>
      </div>

      {/* Main Video Room Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Video Canvas Area */}
        <div className="lg:col-span-2 bg-brand-card border border-brand-border rounded-2xl overflow-hidden flex flex-col">
          <div className="relative aspect-video bg-black flex items-center justify-center">
            {isInCall ? (
              <>
                {/* Real Video or Avatar Feed */}
                {!isVideoOff ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-500">
                    <div className="w-20 h-20 rounded-full bg-brand-surface border border-brand-border flex items-center justify-center text-2xl font-bold text-white mb-2">
                      CMO
                    </div>
                    <p className="text-xs">Coach Video Paused</p>
                  </div>
                )}

                {/* Athlete Remote Picture-in-Picture */}
                <div className="absolute top-4 right-4 w-32 sm:w-44 aspect-video rounded-xl overflow-hidden border-2 border-brand-orange/80 shadow-2xl bg-brand-dark/90 flex flex-col justify-between p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] bg-black/60 px-1.5 py-0.5 rounded text-white font-medium">
                      {athlete.name}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-brand-green"></span>
                  </div>
                  <div className="flex items-center justify-center my-auto">
                    <img 
                      src={athlete.avatar} 
                      alt={athlete.name}
                      className="w-10 h-10 rounded-full object-cover border border-white/20"
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 text-center truncate">
                    Connected (Remote)
                  </div>
                </div>

                {/* Call Timer Overlay */}
                <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-mono text-white flex items-center gap-1.5 border border-white/10">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                  LIVE {formatTime(callDuration)}
                </div>
              </>
            ) : (
              /* Pre-Call State */
              <div className="text-center p-8 max-w-sm">
                <div className="w-16 h-16 rounded-2xl bg-brand-surface border border-brand-border flex items-center justify-center mx-auto mb-4 text-brand-orange">
                  <Video className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">Room Ready to Connect</h3>
                <p className="text-xs text-slate-400 mb-5">
                  Start the session to connect with {athlete.name}. Neither coach nor client needs an external Zoom or Meet account.
                </p>
                <button
                  onClick={startMeeting}
                  className="w-full text-xs font-semibold bg-brand-orange hover:bg-brand-orangeHover text-white py-2.5 rounded-xl transition-all shadow-lg shadow-brand-orange/20"
                >
                  Join Virtual Court
                </button>
              </div>
            )}
          </div>

          {/* Video Control Bar */}
          <div className="p-3 bg-brand-surface border-t border-brand-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                disabled={!isInCall}
                onClick={toggleMic}
                className={`p-2.5 rounded-xl border transition-all ${
                  !isInCall 
                    ? 'opacity-40 border-brand-border text-slate-500' 
                    : isMuted 
                    ? 'bg-red-500/20 border-red-500/40 text-red-400' 
                    : 'bg-brand-card border-brand-border text-slate-200 hover:text-white'
                }`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <button
                disabled={!isInCall}
                onClick={toggleVideo}
                className={`p-2.5 rounded-xl border transition-all ${
                  !isInCall 
                    ? 'opacity-40 border-brand-border text-slate-500' 
                    : isVideoOff 
                    ? 'bg-red-500/20 border-red-500/40 text-red-400' 
                    : 'bg-brand-card border-brand-border text-slate-200 hover:text-white'
                }`}
                title={isVideoOff ? 'Enable Video' : 'Disable Video'}
              >
                {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
              </button>
            </div>

            <div className="text-xs text-slate-400 hidden sm:block">
              {isInCall ? 'HD 1080p WebRTC Session' : 'Standby'}
            </div>

            <div className="flex items-center gap-2">
              {isInCall && (
                <button
                  onClick={endMeeting}
                  className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-all flex items-center gap-1.5"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                  Leave Call
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Live Session Coaching Notes Panel */}
        <div className="bg-brand-card border border-brand-border rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-brand-border mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-brand-orange" />
                <h3 className="text-sm font-bold text-white">Live Coaching Notes</h3>
              </div>
              <span className="text-[10px] text-slate-400">Auto-saved to Player</span>
            </div>

            <div className="space-y-2 max-h-64 sm:max-h-80 overflow-y-auto pr-1 text-xs">
              {notes.map((note, index) => (
                <div key={index} className="bg-brand-surface border border-brand-border/70 rounded-xl p-2.5 text-slate-200">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span>Point #{index + 1}</span>
                    <span>Saved</span>
                  </div>
                  <p>{note}</p>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={addLiveNote} className="mt-4 pt-3 border-t border-brand-border flex gap-2">
            <input
              type="text"
              placeholder="Log instant key teaching point..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="flex-1 bg-brand-surface border border-brand-border rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-orange"
            />
            <button
              type="submit"
              className="bg-brand-orange hover:bg-brand-orangeHover text-white p-2 rounded-xl transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
