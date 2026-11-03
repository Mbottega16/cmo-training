import React, { useState } from 'react';
import { 
  Check, X, Clock, MapPin, Users, Plus, Dumbbell, 
  Sparkles, Award, ChevronRight, FileText, Send 
} from 'lucide-react';
import type { Player, TrainingSession, HomeworkAssignment } from '../types';

interface CoachFloorModeProps {
  sessions: TrainingSession[];
  players: Player[];
  onAssignHomework: (hw: HomeworkAssignment) => void;
}

export const CoachFloorMode: React.FC<CoachFloorModeProps> = ({
  sessions,
  players,
  onAssignHomework
}) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string>(sessions[0]?.id || '');
  const [attendanceState, setAttendanceState] = useState<Record<string, 'present' | 'absent' | 'pending'>>({
    p1: 'present',
    p2: 'pending',
    p4: 'pending'
  });
  
  // Homework Assigner Modal State
  const [assignModalPlayer, setAssignModalPlayer] = useState<Player | null>(null);
  const [drillTitle, setDrillTitle] = useState('');
  const [drillCategory, setDrillCategory] = useState('Ball Handling');
  const [drillReps, setDrillReps] = useState('100 reps / 10 mins');
  const [drillNote, setDrillNote] = useState('');
  const [assignedToast, setAssignedToast] = useState(false);

  const currentSession = sessions.find(s => s.id === selectedSessionId) || sessions[0];
  const enrolledPlayers = players.filter(p => currentSession?.enrolledPlayerIds.includes(p.id));

  const toggleAttendance = (playerId: string, status: 'present' | 'absent') => {
    setAttendanceState(prev => ({
      ...prev,
      [playerId]: prev[playerId] === status ? 'pending' : status
    }));
  };

  const handleCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalPlayer || !drillTitle.trim()) return;

    const newHw: HomeworkAssignment = {
      id: 'hw_' + Date.now(),
      playerId: assignModalPlayer.id,
      title: drillTitle.trim(),
      category: drillCategory,
      repsOrMinutes: drillReps.trim(),
      notes: drillNote.trim(),
      assignedDate: 'Just now (Floor Mode)',
      completed: false
    };

    onAssignHomework(newHw);
    setDrillTitle('');
    setDrillNote('');
    setAssignModalPlayer(null);
    setAssignedToast(true);
    setTimeout(() => setAssignedToast(false), 2500);
  };

  return (
    <div className="space-y-5">
      {/* Court Header Card */}
      <div className="bg-gradient-to-br from-brand-card to-brand-surface border border-brand-border rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-brand-border">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full bg-brand-orange animate-ping"></span>
              <span className="text-xs font-bold text-brand-orange uppercase tracking-wider font-mono">
                ACTIVE ON-COURT SESSION
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {currentSession.title}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 mt-1">
              <span className="flex items-center gap-1 font-medium text-white">
                <Clock className="w-3.5 h-3.5 text-brand-orange" />
                {currentSession.startTime} – {currentSession.endTime}
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-brand-accent" />
                {currentSession.courtLocation}
              </span>
              <span className="bg-brand-surface border border-brand-border px-2 py-0.5 rounded text-[11px] text-slate-300">
                {currentSession.type === 'small_group' ? 'Small Group (Max 6)' : '1-on-1'}
              </span>
            </div>
          </div>

          {/* Quick Session Switcher Dropdown */}
          <div className="w-full sm:w-auto">
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-brand-orange"
            >
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.startTime.split(',')[0]} - {s.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Progress Bar / Headcount */}
        <div className="pt-3 flex items-center justify-between text-xs text-slate-400">
          <span>Roster: {enrolledPlayers.length} / {currentSession.maxCapacity} players registered</span>
          <span className="text-brand-orange font-medium">1-Tap Court Actions</span>
        </div>
      </div>

      {/* Success Notification Toast */}
      {assignedToast && (
        <div className="bg-brand-green/20 border border-brand-green text-green-300 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between animate-fade-in">
          <span>Drill homework assigned & push notification dispatched to athlete!</span>
          <Check className="w-4 h-4 text-brand-green" />
        </div>
      )}

      {/* Athlete Roster Cards (Court-Optimized) */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
          Court Roster & Check-In
        </h3>

        {enrolledPlayers.map((player) => {
          const status = attendanceState[player.id] || 'pending';

          return (
            <div
              key={player.id}
              className={`bg-brand-card border rounded-2xl p-4 transition-all ${
                status === 'present'
                  ? 'border-brand-green/50 bg-brand-green/5'
                  : status === 'absent'
                  ? 'border-red-500/50 bg-red-500/5'
                  : 'border-brand-border'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Player Profile & Details */}
                <div className="flex items-center gap-3.5">
                  <img
                    src={player.avatar}
                    alt={player.name}
                    className="w-12 h-12 rounded-xl object-cover border border-brand-border"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-base">{player.name}</h4>
                      <span className="text-[10px] bg-brand-surface border border-brand-border px-2 py-0.5 rounded text-slate-300 font-medium">
                        {player.level}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                      <span>{player.creditsRemaining} credits left</span>
                      <span>•</span>
                      <span className="text-brand-orange">{player.focusAreas[0]}</span>
                    </div>
                  </div>
                </div>

                {/* Big Court Touch Actions */}
                <div className="flex items-center gap-2">
                  {/* Check-In Button */}
                  <button
                    onClick={() => toggleAttendance(player.id, 'present')}
                    className={`flex-1 sm:flex-initial py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      status === 'present'
                        ? 'bg-brand-green text-white shadow-lg shadow-brand-green/20'
                        : 'bg-brand-surface border border-brand-border hover:border-brand-green/60 text-slate-200'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    {status === 'present' ? 'Checked In (+50 XP)' : 'Check In'}
                  </button>

                  {/* No-Show / Absent Button */}
                  <button
                    onClick={() => toggleAttendance(player.id, 'absent')}
                    className={`py-3 px-3 rounded-xl text-xs font-bold transition-all ${
                      status === 'absent'
                        ? 'bg-red-600 text-white'
                        : 'bg-brand-surface border border-brand-border text-slate-400 hover:text-red-400'
                    }`}
                    title="Mark No-Show"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  {/* Assign Homework Drill Button */}
                  <button
                    onClick={() => setAssignModalPlayer(player)}
                    className="flex-1 sm:flex-initial py-3 px-4 rounded-xl text-xs font-bold bg-brand-surface border border-brand-border hover:border-brand-orange text-slate-200 hover:text-white flex items-center justify-center gap-2 transition-all"
                  >
                    <Dumbbell className="w-4 h-4 text-brand-orange" />
                    Assign Drill
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Drill Assigner Modal */}
      {assignModalPlayer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-brand-card border border-brand-border rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-brand-border">
              <div>
                <h3 className="font-bold text-white text-base">Assign Homework Drill</h3>
                <p className="text-xs text-slate-400">
                  Assigning to <span className="text-brand-orange font-semibold">{assignModalPlayer.name}</span>
                </p>
              </div>
              <button
                onClick={() => setAssignModalPlayer(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Drill / Focus Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Punch Dribble to Drop Cross, Heavy Ball Series..."
                  value={drillTitle}
                  onChange={(e) => setDrillTitle(e.target.value)}
                  className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-brand-orange"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Category (Flexible)
                  </label>
                  <select
                    value={drillCategory}
                    onChange={(e) => setDrillCategory(e.target.value)}
                    className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-brand-orange"
                  >
                    <option value="Ball Handling">Ball Handling</option>
                    <option value="Shooting Mechanics">Shooting Mechanics</option>
                    <option value="Finishing & Footwork">Finishing & Footwork</option>
                    <option value="Decision Making / Reads">Decision Making / Reads</option>
                    <option value="Conditioning & Agility">Conditioning & Agility</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Target Volume / Reps
                  </label>
                  <input
                    type="text"
                    value={drillReps}
                    onChange={(e) => setDrillReps(e.target.value)}
                    placeholder="e.g. 50 makes, 15 mins"
                    className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-brand-orange"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Coach Key Teaching Cue
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Stay low on the second gather; don't raise eyes until second bounce..."
                  value={drillNote}
                  onChange={(e) => setDrillNote(e.target.value)}
                  className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-brand-orange"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignModalPlayer(null)}
                  className="flex-1 py-2.5 rounded-xl border border-brand-border text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-brand-orange hover:bg-brand-orangeHover text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-orange/20"
                >
                  <Send className="w-4 h-4" />
                  Dispatch Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
