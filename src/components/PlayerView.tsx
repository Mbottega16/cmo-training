import React, { useState } from 'react';
import { 
  Calendar, Clock, MapPin, Dumbbell, CheckCircle2, 
  Circle, Film, Bell, Shield, Video, CreditCard, ChevronRight, Check 
} from 'lucide-react';
import type { Player, TrainingSession, HomeworkAssignment, FilmReview } from '../types';

interface PlayerViewProps {
  player: Player;
  sessions: TrainingSession[];
  homework: HomeworkAssignment[];
  onToggleHomework: (id: string) => void;
  onOpenFilmReview: () => void;
  onOpenVirtualRoom: () => void;
}

export const PlayerView: React.FC<PlayerViewProps> = ({
  player,
  sessions,
  homework,
  onToggleHomework,
  onOpenFilmReview,
  onOpenVirtualRoom
}) => {
  const [notifyPreferences, setNotifyPreferences] = useState({
    sms: true,
    email: true,
    push: true
  });
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookedSuccess, setBookedSuccess] = useState(false);

  const playerSessions = sessions.filter(s => s.enrolledPlayerIds.includes(player.id));
  const playerHomework = homework.filter(h => h.playerId === player.id);

  const toggleNotify = (key: 'sms' | 'email' | 'push') => {
    setNotifyPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6">
      {/* Athlete Profile Header */}
      <div className="bg-gradient-to-r from-brand-card via-brand-surface to-brand-card border border-brand-border rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <img
              src={player.avatar}
              alt={player.name}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-brand-orange shadow-md"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">{player.name}</h2>
                <span className="text-[11px] bg-brand-orange/20 text-brand-orange border border-brand-orange/40 px-2 py-0.5 rounded font-semibold">
                  {player.level}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Active Training Pass • <span className="text-white font-medium">{player.creditsRemaining} Session Credits Remaining</span> (Rollover Active)
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {player.focusAreas.map(tag => (
                  <span key={tag} className="text-[10px] bg-brand-surface border border-brand-border px-2 py-0.5 rounded text-slate-300">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowBookingModal(true)}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-brand-orange hover:bg-brand-orangeHover text-white text-xs font-bold transition-all shadow-lg shadow-brand-orange/20 flex items-center justify-center gap-2"
          >
            <CreditCard className="w-4 h-4" />
            Book Next Court Session
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Upcoming Sessions & Film Reviews */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Bookings */}
          <div className="bg-brand-card border border-brand-border rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-brand-border">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand-orange" />
                <h3 className="text-sm font-bold text-white">My Upcoming Training Slots</h3>
              </div>
              <span className="text-xs text-slate-400">{playerSessions.length} Scheduled</span>
            </div>

            <div className="space-y-3">
              {playerSessions.map(session => (
                <div
                  key={session.id}
                  className="bg-brand-surface border border-brand-border rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-sm">{session.title}</h4>
                      {session.isVirtual && (
                        <span className="text-[10px] bg-brand-accent/20 text-blue-300 px-2 py-0.5 rounded font-mono">
                          Live Video Room
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                      <span className="flex items-center gap-1 text-slate-200">
                        <Clock className="w-3.5 h-3.5 text-brand-orange" />
                        {session.startTime} – {session.endTime}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-brand-accent" />
                        {session.courtLocation}
                      </span>
                    </div>
                  </div>

                  {session.isVirtual ? (
                    <button
                      onClick={onOpenVirtualRoom}
                      className="px-3.5 py-2 rounded-xl bg-brand-accent hover:bg-blue-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md"
                    >
                      <Video className="w-3.5 h-3.5" />
                      Join Room
                    </button>
                  ) : (
                    <span className="text-[11px] text-brand-green font-medium bg-brand-green/10 border border-brand-green/30 px-2.5 py-1 rounded-lg">
                      Confirmed Spot
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Film Reviews / Virtual Breakdowns Available */}
          <div className="bg-brand-card border border-brand-border rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-brand-border">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-brand-orange" />
                <h3 className="text-sm font-bold text-white">Film Analysis from Coach</h3>
              </div>
              <span className="text-xs text-brand-orange font-medium cursor-pointer" onClick={onOpenFilmReview}>
                Open Studio &rarr;
              </span>
            </div>

            <div
              onClick={onOpenFilmReview}
              className="bg-brand-surface hover:bg-brand-border/40 border border-brand-border rounded-xl p-4 cursor-pointer transition-all flex items-center justify-between group"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-brand-green"></span>
                  <h4 className="text-sm font-semibold text-white group-hover:text-brand-orange transition-colors">
                    HS Game Tape — 4th Quarter Pick & Roll Possession
                  </h4>
                </div>
                <p className="text-xs text-slate-400">
                  Coach added 2 timestamped telestrator notes + 1 voice memo.
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>

        {/* Right Column: Homework Assignments & Notification Toggles */}
        <div className="space-y-6">
          {/* Assigned Homework Drills */}
          <div className="bg-brand-card border border-brand-border rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-brand-border">
              <div className="flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-brand-orange" />
                <h3 className="text-sm font-bold text-white">Assigned Drill Work</h3>
              </div>
              <span className="text-xs text-slate-400">
                {playerHomework.filter(h => h.completed).length}/{playerHomework.length} Done
              </span>
            </div>

            <div className="space-y-2.5">
              {playerHomework.map(item => (
                <div
                  key={item.id}
                  onClick={() => onToggleHomework(item.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    item.completed 
                      ? 'bg-brand-green/10 border-brand-green/30 text-slate-400' 
                      : 'bg-brand-surface border-brand-border text-white hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <button className="mt-0.5 text-brand-orange">
                      {item.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-brand-green" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                    <div>
                      <h5 className={`text-xs font-semibold ${item.completed ? 'line-through text-slate-400' : 'text-white'}`}>
                        {item.title}
                      </h5>
                      <div className="text-[11px] text-brand-orange mt-0.5">
                        Target: {item.repsOrMinutes}
                      </div>
                      {item.notes && (
                        <p className="text-[10px] text-slate-400 mt-1 italic">
                          "{item.notes}"
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notification Preferences with 3 Toggles */}
          <div className="bg-brand-card border border-brand-border rounded-2xl p-5 space-y-3.5">
            <div className="flex items-center gap-2 pb-2 border-b border-brand-border">
              <Bell className="w-4 h-4 text-brand-orange" />
              <h3 className="text-sm font-bold text-white">Reminders & Alerts</h3>
            </div>
            <p className="text-xs text-slate-400">
              Customize how CMO Training notifies you about scheduled gym slots and video reviews.
            </p>

            <div className="space-y-2 text-xs">
              {[
                { key: 'sms' as const, label: 'SMS Text Alerts', desc: 'Direct to phone 2 hrs prior' },
                { key: 'email' as const, label: 'Email Confirmations', desc: 'Calendar .ics invites & receipts' },
                { key: 'push' as const, label: 'Push Notifications', desc: 'App home screen alerts' }
              ].map(opt => (
                <div
                  key={opt.key}
                  onClick={() => toggleNotify(opt.key)}
                  className="bg-brand-surface border border-brand-border rounded-xl p-3 flex items-center justify-between cursor-pointer hover:border-slate-500 transition-all"
                >
                  <div>
                    <div className="font-semibold text-white">{opt.label}</div>
                    <div className="text-[10px] text-slate-400">{opt.desc}</div>
                  </div>
                  <div className={`w-8 h-4 rounded-full transition-colors relative flex items-center ${
                    notifyPreferences[opt.key] ? 'bg-brand-orange' : 'bg-slate-700'
                  }`}>
                    <div className={`w-3 h-3 rounded-full bg-white transition-transform ${
                      notifyPreferences[opt.key] ? 'translate-x-4' : 'translate-x-0.5'
                    }`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-brand-card border border-brand-border rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-brand-border">
              <h3 className="font-bold text-white text-base">Book a Session</h3>
              <button
                onClick={() => {
                  setShowBookingModal(false);
                  setBookedSuccess(false);
                }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {bookedSuccess ? (
              <div className="p-4 bg-brand-green/20 border border-brand-green text-green-300 rounded-xl text-center space-y-2 text-xs">
                <Check className="w-8 h-8 text-brand-green mx-auto" />
                <p className="font-bold text-sm">Session Reserved!</p>
                <p>1 session credit deducted. Confirmation sent via SMS & Email.</p>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-brand-surface border border-brand-border rounded-xl">
                  <div className="font-semibold text-white">Elite Guard Shooting Lab</div>
                  <div className="text-slate-400">Thursday, 6:00 PM – St. Jude Community Center</div>
                  <div className="text-brand-orange font-bold mt-1">1 Credit or $65 (Stripe Checkout)</div>
                </div>

                <div className="text-slate-400 text-[11px] leading-relaxed">
                  Reminder: Cancellations must be made at least <strong>6 hours</strong> prior to your session for an automatic credit restore.
                </div>

                <button
                  onClick={() => setBookedSuccess(true)}
                  className="w-full py-3 rounded-xl bg-brand-orange hover:bg-brand-orangeHover text-white font-bold transition-all shadow-lg shadow-brand-orange/20"
                >
                  Confirm with Session Credit
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
