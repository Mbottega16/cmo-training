import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, Pause, RotateCcw, Volume2, Mic, Square, Trash2, 
  PenTool, Circle, MoveRight, Check, MessageSquare, Clock, Plus, Send 
} from 'lucide-react';
import type { FilmReview } from '../types';

interface FilmBreakdownStudioProps {
  initialReview: FilmReview;
}

export const FilmBreakdownStudio: React.FC<FilmBreakdownStudioProps> = ({ initialReview }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [tool, setTool] = useState<'pen' | 'arrow' | 'circle'>('pen');
  const [color, setColor] = useState('#facc15'); // Neon yellow default
  const [notes, setNotes] = useState(initialReview.notes);
  const [newNoteText, setNewNoteText] = useState('');
  
  // Voice Recording state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceNotes, setVoiceNotes] = useState<{ id: string; timestamp: number; duration: number }[]>([
    { id: 'v1', timestamp: 3.2, duration: 8 }
  ]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const startPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Handle Video Time Updates
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      syncCanvasDimensions();
    }
  };

  const syncCanvasDimensions = () => {
    if (canvasRef.current && videoRef.current) {
      canvasRef.current.width = videoRef.current.clientWidth;
      canvasRef.current.height = videoRef.current.clientHeight;
    }
  };

  useEffect(() => {
    window.addEventListener('resize', syncCanvasDimensions);
    return () => window.removeEventListener('resize', syncCanvasDimensions);
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const seekTo = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const stepFrame = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
      videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
    }
  };

  // Canvas Drawing Handlers (Telestrator)
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Automatically pause video when drawing starts so the coach can telestrate the exact frame
    if (videoRef.current && isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    isDrawing.current = true;
    startPos.current = { x, y };

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'pen') {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === 'pen') {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === 'circle') {
      const radius = Math.sqrt(Math.pow(x - startPos.current.x, 2) + Math.pow(y - startPos.current.y, 2));
      ctx.beginPath();
      ctx.arc(startPos.current.x, startPos.current.y, radius, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (tool === 'arrow') {
      drawArrow(ctx, startPos.current.x, startPos.current.y, x, y);
    }
  };

  const drawArrow = (ctx: CanvasRenderingContext2D, fromx: number, fromy: number, tox: number, toy: number) => {
    const headlen = 12;
    const dx = tox - fromx;
    const dy = toy - fromy;
    const angle = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(tox, toy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  };

  const clearTelestrator = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Add Timestamped Note
  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    setNotes(prev => [
      ...prev,
      { timestamp: parseFloat(currentTime.toFixed(1)), text: newNoteText.trim(), author: 'Coach' }
    ].sort((a, b) => a.timestamp - b.timestamp));

    setNewNoteText('');
  };

  // Voice Note toggle simulation
  const toggleVoiceRecording = () => {
    if (!isRecordingVoice) {
      setIsRecordingVoice(true);
    } else {
      setIsRecordingVoice(false);
      setVoiceNotes(prev => [
        ...prev,
        { id: 'v_' + Date.now(), timestamp: parseFloat(currentTime.toFixed(1)), duration: 6 }
      ]);
    }
  };

  const formatSecs = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="space-y-4">
      {/* Studio Header */}
      <div className="bg-brand-card border border-brand-border rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-orange"></span>
            <h2 className="text-base font-bold text-white">Interactive Telestrator & Film Studio</h2>
            <span className="text-[10px] bg-brand-surface border border-brand-border px-2 py-0.5 rounded text-brand-orange font-semibold">
              ASYNCHRONOUS REVIEW
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Analyzing: <span className="text-slate-200 font-medium">{initialReview.title}</span>
          </p>
        </div>

        <button
          onClick={clearTelestrator}
          className="text-xs bg-brand-surface border border-brand-border hover:border-red-500/40 text-slate-300 hover:text-red-400 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear Drawings
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Video & Telestrator Canvas */}
        <div className="lg:col-span-2 bg-brand-card border border-brand-border rounded-2xl overflow-hidden flex flex-col">
          {/* Video Container with Overlaid Canvas */}
          <div className="relative aspect-video bg-black flex items-center justify-center select-none">
            <video
              ref={videoRef}
              src={initialReview.videoUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              className="w-full h-full object-contain"
              playsInline
            />

            {/* Telestrator Drawing Layer */}
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              className="absolute inset-0 w-full h-full cursor-crosshair z-10"
            />

            {/* Frame Indicator */}
            <div className="absolute top-3 left-3 z-20 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-mono text-brand-orange border border-white/10">
              {formatSecs(currentTime)} / {formatSecs(duration)}
            </div>
          </div>

          {/* Interactive Telestrator Tool Toolbar */}
          <div className="p-3 bg-brand-surface border-t border-brand-border flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Tool selectors */}
            <div className="flex items-center gap-1 bg-brand-card p-1 rounded-xl border border-brand-border">
              <button
                onClick={() => setTool('pen')}
                className={`p-1.5 rounded-lg transition-all ${
                  tool === 'pen' ? 'bg-brand-orange text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Pen / Freehand"
              >
                <PenTool className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTool('arrow')}
                className={`p-1.5 rounded-lg transition-all ${
                  tool === 'arrow' ? 'bg-brand-orange text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Driving Lane Arrow"
              >
                <MoveRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTool('circle')}
                className={`p-1.5 rounded-lg transition-all ${
                  tool === 'circle' ? 'bg-brand-orange text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Spotlight Circle"
              >
                <Circle className="w-4 h-4" />
              </button>
            </div>

            {/* Color Palette */}
            <div className="flex items-center gap-1.5">
              {[
                { hex: '#facc15', label: 'Neon Yellow' },
                { hex: '#ef4444', label: 'Red' },
                { hex: '#06b6d4', label: 'Cyan' },
                { hex: '#ffffff', label: 'White' }
              ].map(c => (
                <button
                  key={c.hex}
                  onClick={() => setColor(c.hex)}
                  style={{ backgroundColor: c.hex }}
                  className={`w-5 h-5 rounded-full transition-transform ${
                    color === c.hex ? 'scale-125 ring-2 ring-white' : 'opacity-80 hover:opacity-100'
                  }`}
                  title={c.label}
                />
              ))}
            </div>

            {/* Video Transport Controls */}
            <div className="flex items-center gap-1 bg-brand-card p-1 rounded-xl border border-brand-border">
              <button
                onClick={() => stepFrame(-0.1)}
                className="px-2 py-1 text-slate-300 hover:text-white font-mono text-[11px]"
                title="Step back 1 frame"
              >
                -1f
              </button>

              <button
                onClick={togglePlay}
                className="p-1.5 bg-brand-orange hover:bg-brand-orangeHover text-white rounded-lg"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>

              <button
                onClick={() => stepFrame(0.1)}
                className="px-2 py-1 text-slate-300 hover:text-white font-mono text-[11px]"
                title="Step forward 1 frame"
              >
                +1f
              </button>
            </div>

            {/* Record Voice Note Button */}
            <button
              onClick={toggleVoiceRecording}
              className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all ${
                isRecordingVoice
                  ? 'bg-red-600 text-white animate-pulse'
                  : 'bg-brand-card border border-brand-border text-slate-200 hover:border-brand-orange hover:text-white'
              }`}
            >
              {isRecordingVoice ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-brand-orange" />}
              {isRecordingVoice ? 'Stop Recording' : 'Record Voice Memo'}
            </button>
          </div>
        </div>

        {/* Timestamped Coaching Feedback Feed */}
        <div className="bg-brand-card border border-brand-border rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-brand-border mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-brand-orange" />
                <h3 className="text-sm font-bold text-white">Coaching Breakdown</h3>
              </div>
              <span className="text-[10px] text-slate-400">Click to Jump</span>
            </div>

            {/* List of Timestamped Notes & Voice Memos */}
            <div className="space-y-2.5 max-h-72 sm:max-h-96 overflow-y-auto pr-1 text-xs">
              {notes.map((note, idx) => (
                <div
                  key={idx}
                  onClick={() => seekTo(note.timestamp)}
                  className="bg-brand-surface hover:bg-brand-border/40 border border-brand-border/70 rounded-xl p-3 cursor-pointer transition-all group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-brand-orange font-bold text-[11px] group-hover:underline flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatSecs(note.timestamp)}
                    </span>
                    <span className="text-[10px] text-slate-400">{note.author}</span>
                  </div>
                  <p className="text-slate-200 leading-relaxed">{note.text}</p>
                </div>
              ))}

              {/* Recorded Voice Memos */}
              {voiceNotes.map(vn => (
                <div
                  key={vn.id}
                  onClick={() => seekTo(vn.timestamp)}
                  className="bg-brand-orange/10 border border-brand-orange/30 rounded-xl p-3 cursor-pointer transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 text-brand-orange font-medium">
                    <Volume2 className="w-4 h-4" />
                    <span>Voice Memo ({vn.duration}s)</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400">at {formatSecs(vn.timestamp)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Add Timestamp Note Form */}
          <form onSubmit={handleAddNote} className="mt-4 pt-3 border-t border-brand-border space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Timestamp cue:</span>
              <span className="font-mono text-brand-orange font-bold">{formatSecs(currentTime)}</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Drop teaching note at this frame..."
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                className="flex-1 bg-brand-surface border border-brand-border rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-orange"
              />
              <button
                type="submit"
                className="bg-brand-orange hover:bg-brand-orangeHover text-white p-2 rounded-xl transition-all"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
