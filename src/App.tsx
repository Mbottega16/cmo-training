import React, { useState } from 'react';
import type { Role, HomeworkAssignment, Player } from './types';
import { INITIAL_PLAYERS, INITIAL_SESSIONS, INITIAL_HOMEWORK, SAMPLE_FILM_REVIEWS } from './mockData';
import { Navigation } from './components/Navigation';
import { CoachFloorMode } from './components/CoachFloorMode';
import { FilmBreakdownStudio } from './components/FilmBreakdownStudio';
import { VirtualMeetingRoom } from './components/VirtualMeetingRoom';
import { CancellationEngine } from './components/CancellationEngine';
import { PlayerView } from './components/PlayerView';
import { Info } from 'lucide-react';

export const App: React.FC = () => {
  const [currentRole, setCurrentRole] = useState<Role>('coach');
  const [activeTab, setActiveTab] = useState<'floor' | 'film' | 'virtual' | 'policy' | 'player'>('floor');
  const [sessions] = useState(INITIAL_SESSIONS);
  const [players] = useState<Player[]>(INITIAL_PLAYERS);
  const [homework, setHomework] = useState<HomeworkAssignment[]>(INITIAL_HOMEWORK);

  const selectedAthlete = players[0]; // Jordan Cole
  const sampleFilm = SAMPLE_FILM_REVIEWS[0];

  const handleAssignHomework = (newHw: HomeworkAssignment) => {
    setHomework(prev => [newHw, ...prev]);
  };

  const handleToggleHomework = (id: string) => {
    setHomework(prev => prev.map(hw => hw.id === id ? { ...hw, completed: !hw.completed } : hw));
  };

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col">
      {/* Top Navigation */}
      <Navigation
        currentRole={currentRole}
        setCurrentRole={setCurrentRole}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Prototype Guidance Banner */}
        <div className="bg-brand-surface/60 border border-brand-border/80 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Info className="w-4 h-4 text-brand-orange shrink-0" />
            <span className="text-slate-300">
              <strong className="text-white">Proof of Concept:</strong> This working prototype demonstrates the 4 priority modules for CMO Training. Switch between <strong className="text-brand-orange">Coach View</strong> and <strong className="text-brand-orange">Athlete View</strong> in the top right to test both workflows.
            </span>
          </div>
          <span className="hidden md:inline text-[11px] bg-brand-card border border-brand-border px-2 py-1 rounded text-slate-400 font-mono">
            v0.1-poc
          </span>
        </div>

        {/* View Switcher based on Active Tab */}
        {currentRole === 'coach' ? (
          <>
            {activeTab === 'floor' && (
              <CoachFloorMode
                sessions={sessions}
                players={players}
                onAssignHomework={handleAssignHomework}
              />
            )}

            {activeTab === 'film' && (
              <FilmBreakdownStudio initialReview={sampleFilm} />
            )}

            {activeTab === 'virtual' && (
              <VirtualMeetingRoom athlete={selectedAthlete} />
            )}

            {activeTab === 'policy' && (
              <CancellationEngine player={selectedAthlete} />
            )}
          </>
        ) : (
          <PlayerView
            player={selectedAthlete}
            sessions={sessions}
            homework={homework}
            onToggleHomework={handleToggleHomework}
            onOpenFilmReview={() => {
              setCurrentRole('coach');
              setActiveTab('film');
            }}
            onOpenVirtualRoom={() => {
              setCurrentRole('coach');
              setActiveTab('virtual');
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-brand-border/60 py-4 text-center text-xs text-slate-500 bg-brand-dark">
        CMO Training App Prototype • Built for Review & Collaborative Feedback
      </footer>
    </div>
  );
};
export default App;
