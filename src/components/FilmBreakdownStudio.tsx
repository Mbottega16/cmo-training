import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Play, Pause, Volume2, Mic, Square, Trash2, PenTool, Circle, MoveRight, MessageSquare, Clock, Plus,
  Undo2, Upload, Pencil, AlertTriangle, StopCircle
} from 'lucide-react';
import type { DrawTool, FilmReview, Point, Stroke } from '../types';
import type { AppStore } from '../store';
import { findFrame, uid } from '../logic';
import { now as clockNow } from '../clock';
import { pageUrl } from '../router';

/** Sample clips are stored relative to the site root; pages live in sub-folders (/coach/, /athlete/). */
const resolveClip = (u: string) => (/^(https?:|blob:|data:)/.test(u) ? u : pageUrl('') + u.replace(/^\.\//, ''));
import { formatSecs, useNow } from '../format';
import { AthletePicker } from './ui';

const FRAME_SECONDS = 1 / 30;
const MAX_MEMO_SECONDS = 60;
const COLORS = [
  { hex: '#facc15', label: 'Yellow' },
  { hex: '#ef4444', label: 'Red' },
  { hex: '#06b6d4', label: 'Cyan' },
  { hex: '#ffffff', label: 'White' }
];

interface FilmBreakdownStudioProps {
  store: AppStore;
  mode: 'coach' | 'athlete';
  athleteId: string;
  onAthleteChange?: (id: string) => void;
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, w: number, h: number) {
  const pts = stroke.points.map(p => ({ x: p.x * w, y: p.y * h }));
  if (pts.length === 0) return;
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = Math.max(2.5, w / 220);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (stroke.tool === 'pen') {
    ctx.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    if (pts.length === 1) ctx.lineTo(pts[0].x + 0.1, pts[0].y + 0.1);
    ctx.stroke();
    return;
  }
  const [a, b = a] = pts;
  if (stroke.tool === 'circle') {
    ctx.arc(a.x, a.y, Math.hypot(b.x - a.x, b.y - a.y), 0, 2 * Math.PI);
    ctx.stroke();
    return;
  }
  const head = Math.max(12, w / 45);
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.moveTo(b.x - head * Math.cos(angle - Math.PI / 6), b.y - head * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(b.x - head * Math.cos(angle + Math.PI / 6), b.y - head * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
}

function micErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError') return 'Microphone permission was denied. Allow it in the browser settings and try again.';
  if (name === 'NotFoundError') return 'No microphone was found on this device.';
  return 'The microphone could not start.';
}

type FeedItem =
  | { kind: 'note'; id: string; t: number; text: string; author: string }
  | { kind: 'memo'; id: string; t: number; duration: number; mediaKey: string }
  | { kind: 'drawing'; id: string; t: number; count: number };

export const FilmBreakdownStudio: React.FC<FilmBreakdownStudioProps> = ({ store, mode, athleteId, onAthleteChange }) => {
  const { state, dispatch, backend } = store;
  const media = backend.media;
  // Demo clips stay in this browser (up to 300 MB); the free Supabase plan takes files up to 50 MB.
  const MAX_VIDEO_BYTES = (backend.kind === 'supabase' ? 50 : 300) * 1024 * 1024;
  const isCoach = mode === 'coach';
  const athlete = state.players.find(p => p.id === athleteId) ?? state.players[0];
  const films = state.films.filter(f => f.playerId === athlete?.id);
  const [selectedFilmId, setSelectedFilmId] = useState<string | null>(null);
  const film: FilmReview | undefined = films.find(f => f.id === selectedFilmId) ?? films[0];
  const filmId = film?.id;

  const [videoSrc, setVideoSrc] = useState<string | undefined>(undefined);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [tool, setTool] = useState<DrawTool>('pen');
  const [color, setColor] = useState(COLORS[0].hex);
  const [newNoteText, setNewNoteText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordStartedAt, setRecordStartedAt] = useState<number | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [playingMemo, setPlayingMemo] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const now = useNow(isRecording ? 250 : 5000);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const draft = useRef<{ stroke: Stroke; time: number } | null>(null);
  /** A finished stroke still being saved: drawn until the saved copy arrives, so slow connections don't flicker. */
  const pending = useRef<{ stroke: Stroke; time: number } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordTimer = useRef<number | null>(null);
  const audioRef = useRef<{ audio: HTMLAudioElement; url: string } | null>(null);


  // A new athlete starts on their first film.
  useEffect(() => setSelectedFilmId(null), [athleteId]);

  // Resolve the video: a web sample, or a clip stored in this browser.
  useEffect(() => {
    setVideoError(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if (!film) {
      setVideoSrc(undefined);
      return;
    }
    if (film.videoUrl) {
      setVideoSrc(resolveClip(film.videoUrl));
      return;
    }
    if (!film.videoKey) {
      setVideoSrc(undefined);
      return;
    }
    const videoKey = film.videoKey;
    let cancelled = false;
    let url: string | undefined;
    setVideoSrc(undefined);

    (async () => {
      try {
        if (media.getUrl) {
          const directUrl = await media.getUrl(videoKey);
          if (cancelled) return;
          if (directUrl) {
            setVideoSrc(directUrl);
            return;
          }
        }
        const blob = await media.get(videoKey);
        if (cancelled) return;
        if (!blob) {
          setVideoError('This clip was saved in a different browser, or the browser cleared it. Load the file again.');
          return;
        }
        url = URL.createObjectURL(blob);
        setVideoSrc(url);
      } catch {
        if (!cancelled) setVideoError('This browser could not open its saved clips.');
      }
    })();

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filmId, film?.videoUrl, film?.videoKey]);

  // Stop any recording or playback when leaving the studio.
  useEffect(
    () => () => {
      recorderRef.current?.state === 'recording' && recorderRef.current.stop();
      if (recordTimer.current) window.clearTimeout(recordTimer.current);
      if (audioRef.current) {
        audioRef.current.audio.pause();
        URL.revokeObjectURL(audioRef.current.url);
      }
    },
    []
  );

  const visibleFrame = film && !isPlaying ? findFrame(film.drawings, currentTime) : undefined;

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    const { width, height } = box.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const pw = Math.round(width * dpr);
    const ph = Math.round(height * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    visibleFrame?.strokes.forEach(s => drawStroke(ctx, s, width, height));
    if (pending.current && !visibleFrame?.strokes.some(st => st.id === pending.current!.stroke.id)) drawStroke(ctx, pending.current.stroke, width, height);
    if (draft.current) drawStroke(ctx, draft.current.stroke, width, height);
    // filmId: the video box mounts when the first film appears, so sizing must re-run then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleFrame, filmId]);

  useLayoutEffect(() => {
    redraw();
  }, [redraw]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => redraw());
    ro.observe(box);
    return () => ro.disconnect();
  }, [redraw]);

  if (!athlete) return null;

  const pause = () => videoRef.current?.pause();

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) {
      v.play().catch(() => setVideoError('The video could not play. Tap play again, or load a different clip.'));
    } else {
      v.pause();
    }
  };

  const seekTo = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = t;
    setCurrentTime(t);
  };

  const stepFrame = (dir: 1 | -1) => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    const t = Math.max(0, Math.min(v.duration || 0, v.currentTime + dir * FRAME_SECONDS));
    v.currentTime = t;
    setCurrentTime(t);
  };

  const toPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isCoach || !film || !videoSrc) return;
    e.preventDefault();
    pause();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toPoint(e);
    const time = videoRef.current?.currentTime ?? currentTime;
    draft.current = { stroke: { id: uid('st'), tool, color, points: tool === 'pen' ? [p] : [p, p] }, time };
    redraw();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = draft.current;
    if (!d) return;
    const p = toPoint(e);
    if (d.stroke.tool === 'pen') d.stroke.points.push(p);
    else d.stroke.points[1] = p;
    redraw();
  };

  const onPointerUp = () => {
    const d = draft.current;
    draft.current = null;
    if (!d || !film) return;
    const [a, b] = d.stroke.points;
    const big = d.stroke.tool === 'pen' ? d.stroke.points.length > 1 : b && Math.hypot(b.x - a.x, b.y - a.y) > 0.01;
    if (big) {
      setCurrentTime(d.time);
      pending.current = d;
      void dispatch({ type: 'film.stroke.add', filmId: film.id, time: d.time, stroke: d.stroke }).finally(() => {
        pending.current = null;
        redraw();
      });
    } else {
      redraw();
    }
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    const text = newNoteText.trim();
    if (!text || !film) return;
    const t = Math.round((videoRef.current?.currentTime ?? currentTime) * 10) / 10;
    void dispatch({ type: 'film.note.add', filmId: film.id, note: { timestamp: t, text, author: 'Coach' } });
    setNewNoteText('');
  };

  const startRecording = async () => {
    if (!film) return;
    setMediaError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMediaError('Voice memos need a secure (https) address and a browser that can record audio.');
      return;
    }
    let mic: MediaStream;
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setMediaError(micErrorMessage(err));
      return;
    }
    pause();
    const at = Math.round((videoRef.current?.currentTime ?? currentTime) * 10) / 10;
    const forFilm = film.id;
    const forPlayer = film.playerId;
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(mic);
    const startedAt = Date.now();
    rec.ondataavailable = e => e.data.size > 0 && chunks.push(e.data);
    rec.onstop = async () => {
      mic.getTracks().forEach(t => t.stop());
      setIsRecording(false);
      setRecordStartedAt(null);
      if (recordTimer.current) window.clearTimeout(recordTimer.current);
      const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      if (blob.size === 0) {
        setMediaError('Nothing was recorded.');
        return;
      }
      const key = `memos/${forPlayer}/${uid('vm')}`;
      try {
        await media.put(key, blob);
        await dispatch({ type: 'film.memo.add', filmId: forFilm, memo: { timestamp: at, duration: seconds, mediaKey: key } });
      } catch {
        setMediaError('The memo could not be saved. This browser may be out of storage.');
      }
    };
    rec.start();
    recorderRef.current = rec;
    setIsRecording(true);
    setRecordStartedAt(startedAt);
    recordTimer.current = window.setTimeout(() => rec.state === 'recording' && rec.stop(), MAX_MEMO_SECONDS * 1000);
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };

  const stopMemo = () => {
    if (audioRef.current) {
      audioRef.current.audio.pause();
      URL.revokeObjectURL(audioRef.current.url);
      audioRef.current = null;
    }
    setPlayingMemo(null);
  };

  const playMemo = async (id: string, mediaKey: string, t: number) => {
    stopMemo();
    seekTo(t);
    setMediaError(null);
    try {
      const blob = await media.get(mediaKey);
      if (!blob) {
        setMediaError('This memo was recorded in a different browser, or the browser cleared it.');
        return;
      }
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = { audio, url };
      audio.onended = stopMemo;
      setPlayingMemo(id);
      await audio.play();
    } catch {
      stopMemo();
      setMediaError('The memo could not play.');
    }
  };

  const deleteMemo = (id: string, mediaKey: string) => {
    if (!film || !window.confirm('Delete this voice memo?')) return;
    if (playingMemo === id) stopMemo();
    void media.remove(mediaKey).catch(() => undefined);
    void dispatch({ type: 'film.memo.delete', filmId: film.id, memoId: id });
  };

  const deleteNote = (id: string) => {
    if (!film || !window.confirm('Delete this note?')) return;
    void dispatch({ type: 'film.note.delete', filmId: film.id, noteId: id });
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMediaError(null);
    if (!file.type.startsWith('video/')) {
      setMediaError('That file is not a video.');
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setMediaError(`That clip is ${Math.round(file.size / 1048576)} MB. Clips can be up to ${MAX_VIDEO_BYTES / 1048576} MB here; trim it first.`);
      return;
    }
    setUploading(true);
    const key = `films/${athlete.id}/${uid('vid')}`;
    const defaultTitle = file.name.replace(/\.[^.]+$/, '').slice(0, 80) || 'Game film';
    const customTitle = window.prompt(`Title this clip for ${athlete.name}:`, defaultTitle)?.trim() || defaultTitle;
    try {
      await media.put(key, file);
      const review: FilmReview = {
        id: uid('f'),
        playerId: athlete.id,
        title: customTitle,
        videoKey: key,
        uploadedAt: clockNow().toISOString(),
        notes: [],
        voiceNotes: [],
        drawings: []
      };
      const saved = await dispatch({ type: 'film.add', film: review });
      if (saved.ok) setSelectedFilmId(review.id);
    } catch {
      setMediaError(backend.kind === 'supabase' ? 'The clip could not be uploaded. Check the connection and the 1 GB free storage limit.' : 'The clip could not be saved. This browser may be out of storage.');
    } finally {
      setUploading(false);
    }
  };

  const deleteFilm = () => {
    if (!film || !window.confirm(`Delete “${film.title}” with all its notes, drawings and voice memos?`)) return;
    stopMemo();
    if (film.videoKey) void media.remove(film.videoKey).catch(() => undefined);
    film.voiceNotes.forEach(v => void media.remove(v.mediaKey).catch(() => undefined));
    void dispatch({ type: 'film.delete', filmId: film.id });
    setSelectedFilmId(null);
  };

  const feed: FeedItem[] = film
    ? [
        ...film.notes.map(n => ({ kind: 'note' as const, id: n.id, t: n.timestamp, text: n.text, author: n.author })),
        ...film.voiceNotes.map(v => ({ kind: 'memo' as const, id: v.id, t: v.timestamp, duration: v.duration, mediaKey: v.mediaKey })),
        ...film.drawings.map(d => ({ kind: 'drawing' as const, id: d.id, t: d.timestamp, count: d.strokes.length }))
      ].sort((a, b) => a.t - b.t)
    : [];

  const recordedSeconds = recordStartedAt ? Math.floor((now.getTime() - recordStartedAt) / 1000) : 0;

  return (
    <div className="space-y-4">
      <div className="bg-brand-card border border-brand-border rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-white">{isCoach ? 'Film Studio' : 'Film from Coach'}</h2>
          <p className="text-xs text-slate-400 mt-1">
            {isCoach ? 'Pause on a frame and draw on it. Drawings, notes and voice memos stay on that moment of the clip.' : 'Tap any note, drawing or memo to jump to that moment.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {isCoach && onAthleteChange && <AthletePicker players={state.players} value={athlete.id} onChange={onAthleteChange} />}
          {films.length > 1 && (
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <span className="sr-only">Film</span>
              <select
                value={film?.id}
                onChange={e => setSelectedFilmId(e.target.value)}
                className="bg-brand-surface border border-brand-border rounded-xl px-3 py-2 text-sm text-white min-h-[44px] max-w-[14rem]"
              >
                {films.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {isCoach && (
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={handleFile} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="min-h-[44px] text-xs bg-brand-surface border border-brand-border hover:border-brand-orange text-slate-200 px-3 py-2 rounded-xl flex items-center gap-1.5 disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" /> {uploading ? 'Saving…' : 'Load film'}
              </button>
              {film && (
                <button
                  onClick={deleteFilm}
                  aria-label="Delete this film review"
                  className="min-h-[44px] min-w-[44px] text-xs bg-brand-surface border border-brand-border hover:border-red-500/40 text-slate-400 hover:text-red-400 px-2.5 rounded-xl flex items-center justify-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {mediaError && (
        <div className="bg-brand-orange/10 border border-brand-orange/30 rounded-xl px-4 py-3 text-xs text-orange-200 flex items-start gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {mediaError}
        </div>
      )}

      {!film ? (
        <div className="bg-brand-card border border-dashed border-brand-border rounded-2xl p-8 text-center text-sm text-slate-400">
          {isCoach ? `No film for ${athlete.name} yet. Use “Load film” to pick a clip from this device.` : 'Coach has not shared any film with you yet.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-brand-card border border-brand-border rounded-2xl overflow-hidden flex flex-col">
            <div ref={boxRef} className="relative aspect-video bg-black select-none">
              <video
                ref={videoRef}
                src={videoSrc}
                onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
                onSeeked={e => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                onError={() => videoSrc && setVideoError('This video could not load. Check the connection, or load a clip from this device.')}
                className="absolute inset-0 w-full h-full object-contain"
                playsInline
                preload="metadata"
              />
              <canvas
                ref={canvasRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                aria-label={isCoach ? 'Drawing layer. Draw with a finger, pen or mouse.' : 'Coach drawings'}
                className={`absolute inset-0 w-full h-full z-10 ${isCoach ? 'cursor-crosshair touch-none' : 'pointer-events-none'}`}
              />
              <div className="absolute top-2 right-2 z-20 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-mono text-brand-orange border border-white/10 pointer-events-none">
                {formatSecs(currentTime)} / {formatSecs(duration)}
              </div>
              {visibleFrame && (
                <div className="absolute top-10 right-2 z-20 bg-black/70 px-2 py-1 rounded-lg text-[10px] text-white border border-white/10 pointer-events-none">
                  {visibleFrame.strokes.length} drawing{visibleFrame.strokes.length === 1 ? '' : 's'} on this frame
                </div>
              )}
              {videoError && (
                <div className="absolute inset-x-0 bottom-0 z-20 bg-black/80 text-xs text-orange-200 px-3 py-2" role="alert">
                  {videoError}
                </div>
              )}
            </div>

            {film.videoUrl && (
              <p className="px-3 py-2 text-[11px] text-slate-400 border-t border-brand-border">
                Sample animated play for practising the tools. {isCoach && 'Use “Load film” to try it on real game film.'}
              </p>
            )}

            <div className="p-3 bg-brand-surface border-t border-brand-border flex flex-wrap items-center justify-between gap-3 text-xs">
              {isCoach && (
                <div className="flex items-center gap-1 bg-brand-card p-1 rounded-xl border border-brand-border" role="group" aria-label="Drawing tool">
                  {([
                    ['pen', 'Pen', <PenTool key="p" className="w-4 h-4" />],
                    ['arrow', 'Arrow', <MoveRight key="a" className="w-4 h-4" />],
                    ['circle', 'Spotlight circle', <Circle key="c" className="w-4 h-4" />]
                  ] as const).map(([key, label, icon]) => (
                    <button
                      key={key}
                      onClick={() => setTool(key)}
                      aria-pressed={tool === key}
                      aria-label={label}
                      title={label}
                      className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition ${
                        tool === key ? 'bg-brand-action text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                  <button
                    onClick={() => void dispatch({ type: 'film.stroke.undo', filmId: film.id, time: currentTime })}
                    disabled={!visibleFrame}
                    aria-label="Undo last drawing on this frame"
                    title="Undo"
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white disabled:opacity-30"
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => void dispatch({ type: 'film.frame.clear', filmId: film.id, time: currentTime })}
                    disabled={!visibleFrame}
                    aria-label="Clear drawings on this frame"
                    title="Clear this frame"
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-400 disabled:opacity-30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              {isCoach && (
                <div className="flex items-center gap-2" role="group" aria-label="Drawing colour">
                  {COLORS.map(c => (
                    <button
                      key={c.hex}
                      onClick={() => setColor(c.hex)}
                      aria-pressed={color === c.hex}
                      aria-label={c.label}
                      title={c.label}
                      className="w-11 h-11 flex items-center justify-center rounded-full"
                    >
                      <span
                        style={{ backgroundColor: c.hex }}
                        className={`w-6 h-6 rounded-full transition-transform ${color === c.hex ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-brand-surface' : 'opacity-80'}`}
                      />
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1 bg-brand-card p-1 rounded-xl border border-brand-border" role="group" aria-label="Playback">
                <button onClick={() => stepFrame(-1)} className="min-h-[44px] px-2.5 text-slate-300 hover:text-white font-mono text-[11px]" title="Back one frame">
                  −1 frame
                </button>
                <button
                  onClick={togglePlay}
                  disabled={!videoSrc}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-brand-action hover:bg-brand-actionHover text-white rounded-lg disabled:opacity-40"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button onClick={() => stepFrame(1)} className="min-h-[44px] px-2.5 text-slate-300 hover:text-white font-mono text-[11px]" title="Forward one frame">
                  +1 frame
                </button>
              </div>

              {isCoach && (
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`min-h-[44px] px-3 py-2 rounded-xl font-semibold flex items-center gap-1.5 transition ${
                    isRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-brand-card border border-brand-border text-slate-200 hover:border-brand-orange hover:text-white'
                  }`}
                >
                  {isRecording ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-brand-orange" />}
                  {isRecording ? `Stop (${recordedSeconds}s / ${MAX_MEMO_SECONDS}s)` : 'Record voice memo'}
                </button>
              )}
            </div>
          </div>

          <div className="bg-brand-card border border-brand-border rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-brand-border mb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-brand-orange" />
                  <h3 className="text-sm font-bold text-white">Breakdown</h3>
                </div>
                <span className="text-[10px] text-slate-400">Tap to jump</span>
              </div>

              <div className="space-y-2.5 max-h-80 sm:max-h-96 overflow-y-auto overscroll-contain pr-1 text-xs">
                {feed.length === 0 && <p className="text-slate-400">{isCoach ? 'Pause anywhere, then draw, type a note, or record a memo.' : 'No notes yet.'}</p>}
                {feed.map(item => (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-3 flex items-start gap-2 ${
                      item.kind === 'memo' ? 'bg-brand-orange/10 border-brand-orange/30' : item.kind === 'drawing' ? 'bg-sky-500/10 border-sky-500/30' : 'bg-brand-surface border-brand-border/70'
                    }`}
                  >
                    <button onClick={() => (item.kind === 'memo' ? (playingMemo === item.id ? stopMemo() : playMemo(item.id, item.mediaKey, item.t)) : seekTo(item.t))} className="flex-1 text-left min-w-0">
                      <span className="flex items-center justify-between mb-1">
                        <span className="font-mono text-brand-orange font-bold text-[11px] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatSecs(item.t)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {item.kind === 'note' ? item.author : item.kind === 'memo' ? `Voice memo · ${item.duration}s` : 'Drawing'}
                        </span>
                      </span>
                      {item.kind === 'note' && <span className="block text-slate-200 leading-relaxed break-words">{item.text}</span>}
                      {item.kind === 'memo' && (
                        <span className="flex items-center gap-1.5 text-brand-orange font-medium">
                          {playingMemo === item.id ? <StopCircle className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                          {playingMemo === item.id ? 'Playing… tap to stop' : 'Tap to play'}
                        </span>
                      )}
                      {item.kind === 'drawing' && (
                        <span className="flex items-center gap-1.5 text-sky-300">
                          <Pencil className="w-3.5 h-3.5" /> {item.count} mark{item.count === 1 ? '' : 's'} on this frame
                        </span>
                      )}
                    </button>
                    {isCoach && item.kind !== 'drawing' && (
                      <button
                        onClick={() => (item.kind === 'memo' ? deleteMemo(item.id, item.mediaKey) : deleteNote(item.id))}
                        aria-label={item.kind === 'memo' ? 'Delete voice memo' : 'Delete note'}
                        className="min-w-[44px] min-h-[44px] -m-2 flex items-center justify-center rounded text-slate-400 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {isCoach && (
              <form onSubmit={handleAddNote} className="mt-4 pt-3 border-t border-brand-border space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Note at</span>
                  <span className="font-mono text-brand-orange font-bold">{formatSecs(currentTime)}</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={500}
                    placeholder="Teaching note for this moment…"
                    value={newNoteText}
                    onChange={e => setNewNoteText(e.target.value)}
                    aria-label="New note"
                    className="flex-1 min-w-0 bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-orange"
                  />
                  <button type="submit" aria-label="Add note" className="bg-brand-action hover:bg-brand-actionHover text-white min-w-[44px] rounded-xl flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
