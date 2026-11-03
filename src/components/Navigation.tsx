import React from 'react';
import type { Role } from '../types';
import { Video, ShieldAlert, ClipboardCheck, Film, User, Dumbbell, Sparkles } from 'lucide-react';

interface NavigationProps {
  currentRole: Role;
  setCurrentRole: (role: Role) => void;
  activeTab: 'floor' | 'film' | 'virtual' | 'policy' | 'player';
  setActiveTab: (tab: 'floor' | 'film' | 'virtual' | 'policy' | 'player') => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentRole,
  setCurrentRole,
  activeTab,
  setActiveTab
}) => {
  return (
    <header className="sticky top-0 z-50 bg-brand-dark/95 backdrop-blur-md border-b border-brand-border">
      {/* Top Banner */}
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-orange to-red-600 flex items-center justify-center font-bold text-white shadow-lg shadow-brand-orange/20 text-lg tracking-wider">
            CMO
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading text-2xl text-white tracking-wide leading-none">CMO TRAINING</span>
              <span className="text-[10px] font-semibold bg-brand-surface border border-brand-border px-1.5 py-0.5 rounded text-brand-orange uppercase">
                Proof of Concept
              </span>
            </div>
            <p className="text-xs text-slate-400">Elite Basketball Development</p>
          </div>
        </div>

        {/* Role Toggle Switcher */}
        <div className="flex items-center bg-brand-surface border border-brand-border rounded-xl p-1 text-xs">
          <button
            onClick={() => {
              setCurrentRole('coach');
              if (activeTab === 'player') setActiveTab('floor');
            }}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              currentRole === 'coach'
                ? 'bg-brand-orange text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Dumbbell className="w-3.5 h-3.5" />
            Coach View
          </button>
          <button
            onClick={() => {
              setCurrentRole('player');
              setActiveTab('player');
            }}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              currentRole === 'player'
                ? 'bg-brand-orange text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Athlete View
          </button>
        </div>
      </div>

      {/* Feature Tabs (The 4 Core Priorities) */}
      <div className="border-t border-brand-border/60 bg-brand-card/70 overflow-x-auto scrollbar-none">
        <div className="max-w-6xl mx-auto px-4 flex gap-1 sm:gap-2">
          {currentRole === 'coach' ? (
            <>
              <button
                onClick={() => setActiveTab('floor')}
                className={`py-2.5 px-3 border-b-2 text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap transition-colors ${
                  activeTab === 'floor'
                    ? 'border-brand-orange text-brand-orange'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <ClipboardCheck className="w-4 h-4" />
                Floor Mode (Court View)
              </button>

              <button
                onClick={() => setActiveTab('film')}
                className={`py-2.5 px-3 border-b-2 text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap transition-colors ${
                  activeTab === 'film'
                    ? 'border-brand-orange text-brand-orange'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Film className="w-4 h-4" />
                Film Studio (Telestrator)
              </button>

              <button
                onClick={() => setActiveTab('virtual')}
                className={`py-2.5 px-3 border-b-2 text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap transition-colors ${
                  activeTab === 'virtual'
                    ? 'border-brand-orange text-brand-orange'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Video className="w-4 h-4" />
                Live Video Room
              </button>

              <button
                onClick={() => setActiveTab('policy')}
                className={`py-2.5 px-3 border-b-2 text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap transition-colors ${
                  activeTab === 'policy'
                    ? 'border-brand-orange text-brand-orange'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                Cancellation & 24h Grace
              </button>
            </>
          ) : (
            <button
              onClick={() => setActiveTab('player')}
              className="py-2.5 px-3 border-b-2 border-brand-orange text-brand-orange text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap"
            >
              <User className="w-4 h-4" />
              Athlete Portal (Jordan Cole)
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
