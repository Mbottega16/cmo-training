import React, { useEffect, useRef } from 'react';

export interface TabItem {
  key: string;
  short: string;
  long: string;
  icon: React.ReactNode;
  href: string;
  active: boolean;
  onSelect: () => void;
  badge?: number;
}

/** A real link, so Cmd/Ctrl/middle-click opens the section in a new tab; a plain click stays in the app. */
const TabLink: React.FC<TabItem> = ({ short, long, icon, href, active, onSelect, badge }) => (
  <a
    href={href}
    onClick={e => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      onSelect();
    }}
    aria-current={active ? 'page' : undefined}
    className={`py-3 px-2 sm:px-3 border-b-2 text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 whitespace-nowrap transition-colors min-h-[44px] ${
      active ? 'border-brand-orange text-brand-orange' : 'border-transparent text-slate-400 hover:text-slate-200'
    }`}
  >
    <span className="max-[379px]:hidden" aria-hidden="true">
      {icon}
    </span>
    <span className="sm:hidden">{short}</span>
    <span className="hidden sm:inline">{long}</span>
    {badge ? (
      <span className="ml-0.5 text-[10px] bg-brand-action text-white rounded-full px-1.5 py-0.5 leading-none" aria-label={`${badge} waiting`}>
        {badge}
      </span>
    ) : null}
  </a>
);

export const TabBar: React.FC<{ tabs: TabItem[]; label: string }> = ({ tabs, label }) => {
  const ref = useRef<HTMLElement>(null);
  const active = tabs.find(t => t.active)?.key;
  // On narrow phones the bar can scroll sideways; keep the current section in view.
  useEffect(() => {
    ref.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);
  return (
    <nav ref={ref} className="border-t border-brand-border/60 bg-brand-card/70 overflow-x-auto scrollbar-none" aria-label={label}>
      <div className="max-w-6xl mx-auto px-1 sm:px-4 flex gap-0 sm:gap-2">
        {tabs.map(({ key, ...t }) => (
          <TabLink key={key} {...t} />
        ))}
      </div>
    </nav>
  );
};

/** Sticky page header: brand, which page this is, an optional control on the right, and the tab bar(s). */
export const Header: React.FC<{ pageLabel: string; right?: React.ReactNode; children?: React.ReactNode }> = ({ pageLabel, right, children }) => (
  <header className="sticky top-0 z-40 bg-brand-dark/95 backdrop-blur-md border-b border-brand-border pt-[env(safe-area-inset-top)]">
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br from-brand-orange to-red-600 flex items-center justify-center font-bold text-white shadow-lg shadow-brand-orange/20 text-sm tracking-wider" aria-hidden="true">
          CMO
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span translate="no" className="font-heading text-xl sm:text-2xl text-white tracking-wide leading-none">
              CMO TRAINING
            </span>
            <span className="text-[10px] font-semibold bg-brand-surface border border-brand-border px-1.5 py-0.5 rounded text-brand-orange uppercase">{pageLabel}</span>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-400 truncate">Elite Basketball Development</p>
        </div>
      </div>
      {right}
    </div>
    {children}
  </header>
);
