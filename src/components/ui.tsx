import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { Player } from '../types';

const AVATAR_COLORS = ['from-orange-500 to-red-600', 'from-sky-500 to-blue-700', 'from-emerald-500 to-teal-700', 'from-violet-500 to-purple-700'];

/** Initials instead of stock photos: no outside image requests, no stranger's face on a made-up athlete. */
export const Avatar: React.FC<{ player: Pick<Player, 'id' | 'name'>; size?: 'sm' | 'md' | 'lg' }> = ({ player, size = 'md' }) => {
  const initials = player.name
    .split(/\s+/)
    .map(w => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const index = [...player.id].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  const dims = size === 'lg' ? 'w-16 h-16 text-xl' : size === 'sm' ? 'w-9 h-9 text-xs' : 'w-12 h-12 text-sm';
  return (
    <div
      aria-hidden="true"
      className={`${dims} shrink-0 rounded-xl bg-gradient-to-br ${AVATAR_COLORS[index]} flex items-center justify-center font-bold text-white border border-white/10`}
    >
      {initials}
    </div>
  );
};

export const Modal: React.FC<{ title: string; subtitle?: React.ReactNode; onClose: () => void; children: React.ReactNode }> = ({
  title,
  subtitle,
  onClose,
  children
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useRef(`modal-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])');
    (first ?? panel)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && panel) {
        const items = [...panel.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href]')].filter(el => !el.hasAttribute('disabled'));
        if (items.length === 0) return;
        const firstItem = items[0];
        const lastItem = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstItem) {
          e.preventDefault();
          lastItem.focus();
        } else if (!e.shiftKey && document.activeElement === lastItem) {
          e.preventDefault();
          firstItem.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="bg-brand-card border border-brand-border rounded-t-2xl sm:rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))] outline-none"
      >
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-brand-border">
          <div>
            <h3 id={titleId} className="font-bold text-white text-base">
              {title}
            </h3>
            {subtitle && <div className="text-xs text-slate-400 mt-0.5">{subtitle}</div>}
          </div>
          <button data-close onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-white p-2 -m-2 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export type ToastTone = 'good' | 'warn' | 'bad';

export const Toast: React.FC<{ message: string; tone?: ToastTone; onDone: () => void }> = ({ message, tone = 'good', onDone }) => {
  useEffect(() => {
    const id = window.setTimeout(onDone, 4000);
    return () => window.clearTimeout(id);
  }, [message, onDone]);
  const colors =
    tone === 'good'
      ? 'bg-brand-green/20 border-brand-green text-green-200'
      : tone === 'warn'
      ? 'bg-brand-orange/20 border-brand-orange text-orange-200'
      : 'bg-red-500/20 border-red-500 text-red-200';
  return (
    <div role="status" aria-live="polite" className={`${colors} border px-4 py-3 rounded-xl text-sm animate-fade-in`}>
      {message}
    </div>
  );
};

/** An on/off switch that screen readers announce as one. */
export const Switch: React.FC<{ checked: boolean; onChange: () => void; label: string; description?: string }> = ({
  checked,
  onChange,
  label,
  description
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onChange}
    className="w-full text-left bg-brand-surface border border-brand-border rounded-xl p-3 flex items-center justify-between gap-3 hover:border-slate-500 transition-all min-h-[44px]"
  >
    <span>
      <span className="block font-semibold text-white">{label}</span>
      {description && <span className="block text-[11px] text-slate-400">{description}</span>}
    </span>
    <span className={`w-10 h-6 shrink-0 rounded-full transition-colors relative flex items-center ${checked ? 'bg-brand-orange' : 'bg-slate-700'}`}>
      <span className={`w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </span>
  </button>
);

export const AthletePicker: React.FC<{ players: Player[]; value: string; onChange: (id: string) => void; label?: string }> = ({
  players,
  value,
  onChange,
  label = 'Athlete'
}) => (
  <label className="flex items-center gap-2 text-xs text-slate-400">
    <span className="shrink-0">{label}</span>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-brand-surface border border-brand-border rounded-xl px-3 py-2 text-sm font-medium text-white focus:outline-none focus:border-brand-orange min-h-[40px]"
    >
      {players.map(p => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  </label>
);

export function levelFromXp(xp: number): { level: number; into: number; span: number } {
  const span = 500;
  return { level: Math.floor(xp / span) + 1, into: xp % span, span };
}

export const XpBadge: React.FC<{ xp: number }> = ({ xp }) => {
  const { level, into, span } = levelFromXp(xp);
  return (
    <span className="inline-flex items-center gap-2 text-[11px] text-slate-300">
      <span className="bg-brand-gold/20 text-brand-gold border border-brand-gold/40 px-2 py-0.5 rounded font-semibold">Lv {level}</span>
      <span className="font-mono">{xp.toLocaleString()} XP</span>
      <span className="w-16 h-1.5 bg-brand-surface rounded-full overflow-hidden" aria-hidden="true">
        <span className="block h-full bg-brand-gold" style={{ width: `${(into / span) * 100}%` }} />
      </span>
    </span>
  );
};
