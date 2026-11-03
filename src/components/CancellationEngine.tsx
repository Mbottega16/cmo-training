import React, { useState } from 'react';
import { 
  ShieldAlert, Clock, AlertTriangle, CheckCircle2, 
  RotateCcw, HeartHandshake, DollarSign, BellRing, ArrowRight 
} from 'lucide-react';
import type { Player } from '../types';

interface CancellationEngineProps {
  player: Player;
}

export const CancellationEngine: React.FC<CancellationEngineProps> = ({ player }) => {
  // Demo simulation state
  const [simulationScenario, setSimulationScenario] = useState<'normal' | 'late' | null>('late');
  const [coachForgiven, setCoachForgiven] = useState(false);
  const [forfeitureConfirmed, setForfeitureConfirmed] = useState(false);
  const [credits, setCredits] = useState(player.creditsRemaining);

  const resetDemo = (scenario: 'normal' | 'late') => {
    setSimulationScenario(scenario);
    setCoachForgiven(false);
    setForfeitureConfirmed(false);
    setCredits(player.creditsRemaining);
  };

  const handleCoachExcuse = () => {
    setCoachForgiven(true);
    setForfeitureConfirmed(false);
    setCredits(player.creditsRemaining); // Restores credit
  };

  const handleConfirmForfeit = () => {
    setForfeitureConfirmed(true);
    setCoachForgiven(false);
    setCredits(Math.max(0, player.creditsRemaining - 1)); // Deducts credit
  };

  return (
    <div className="space-y-6">
      {/* Policy Summary Card */}
      <div className="bg-gradient-to-r from-brand-card to-brand-surface border border-brand-border rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-brand-orange" />
              <h2 className="text-lg font-bold text-white">Cancellation & 24-Hour Grace Engine</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Guarantees coach's reserved gym time while giving athletes fair recourse for true emergencies.
            </p>
          </div>

          {/* Scenario Trigger Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => resetDemo('normal')}
              className={`text-xs px-3 py-2 rounded-xl font-medium border transition-all ${
                simulationScenario === 'normal'
                  ? 'bg-brand-green/20 border-brand-green text-green-300'
                  : 'bg-brand-surface border-brand-border text-slate-400 hover:text-white'
              }`}
            >
              Test Cancel &gt; 6 hrs out
            </button>
            <button
              onClick={() => resetDemo('late')}
              className={`text-xs px-3 py-2 rounded-xl font-medium border transition-all ${
                simulationScenario === 'late'
                  ? 'bg-brand-orange/20 border-brand-orange text-orange-300'
                  : 'bg-brand-surface border-brand-border text-slate-400 hover:text-white'
              }`}
            >
              Test Cancel &lt; 6 hrs out (Late)
            </button>
          </div>
        </div>
      </div>

      {/* Rules Breakdown Diagram */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Rule 1: Normal */}
        <div className={`p-4 rounded-2xl border transition-all ${
          simulationScenario === 'normal' ? 'bg-brand-card border-brand-green/60 shadow-lg shadow-brand-green/5' : 'bg-brand-card/50 border-brand-border opacity-70'
        }`}>
          <div className="flex items-center gap-2 mb-2 text-brand-green font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Scenario A: Cancelled &gt; 6 Hours Before</span>
          </div>
          <p className="text-slate-300 mb-3">
            If an athlete cancels with at least 6 hours of notice, the spot opens back up to the waiting list and their session credit is restored instantly.
          </p>
          <div className="bg-brand-surface rounded-xl p-3 border border-brand-border/60 flex items-center justify-between">
            <span className="text-slate-400">Action:</span>
            <span className="text-brand-green font-medium">Automatic Credit Restored / 100% Refund</span>
          </div>
        </div>

        {/* Rule 2: Late Cancel with 24h grace */}
        <div className={`p-4 rounded-2xl border transition-all ${
          simulationScenario === 'late' ? 'bg-brand-card border-brand-orange/60 shadow-lg shadow-brand-orange/5' : 'bg-brand-card/50 border-brand-border opacity-70'
        }`}>
          <div className="flex items-center gap-2 mb-2 text-brand-orange font-semibold">
            <AlertTriangle className="w-4 h-4" />
            <span>Scenario B: Cancelled &lt; 6 Hours Before (Late Cancel)</span>
          </div>
          <p className="text-slate-300 mb-3">
            Late cancellations lock court time. A 24-hour grace timer starts. Athlete receives an SMS/app prompt to reach out to Coach for emergency/injury waivers.
          </p>
          <div className="bg-brand-surface rounded-xl p-3 border border-brand-border/60 flex items-center justify-between">
            <span className="text-slate-400">Action:</span>
            <span className="text-brand-orange font-medium">24h Grace Countdown + Coach Override Option</span>
          </div>
        </div>
      </div>

      {/* Live Interactive Simulation View */}
      {simulationScenario === 'normal' && (
        <div className="bg-brand-card border border-brand-green/30 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-brand-green mb-3">
            <CheckCircle2 className="w-5 h-5" />
            <h3 className="font-bold text-white text-sm">Athlete Screen: Timely Cancellation Confirmed</h3>
          </div>
          <div className="bg-brand-surface border border-brand-border rounded-xl p-4 space-y-2 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>Session:</span>
              <span className="font-medium text-white">Elite Guard Skills & Footwork (Today 4:00 PM)</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Cancellation Notice:</span>
              <span className="text-brand-green font-medium">10.5 hours before session (Eligible for full restore)</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Account Balance:</span>
              <span className="font-bold text-brand-green">{credits} Session Credits Available</span>
            </div>
            <div className="p-3 bg-brand-green/10 border border-brand-green/20 rounded-lg text-green-300 text-[11px] mt-2">
              Notification sent to {player.name}: "Your booking was cancelled with 6+ hours notice. Your credit has been restored."
            </div>
          </div>
        </div>
      )}

      {simulationScenario === 'late' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Athlete's Phone View */}
          <div className="bg-brand-card border border-brand-orange/40 rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-brand-orange">
                  <BellRing className="w-4 h-4 animate-bounce" />
                  <span className="text-xs font-bold uppercase tracking-wider">Athlete App View</span>
                </div>
                <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded font-mono">
                  Late Cancellation
                </span>
              </div>

              {/* Warning Notice Box */}
              <div className="bg-brand-orange/10 border border-brand-orange/30 rounded-xl p-4 text-xs space-y-3 mb-4">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-brand-orange shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-white text-sm">Notice: Late Cancellation (Under 6 Hours)</h4>
                    <p className="text-slate-300 text-xs mt-1 leading-relaxed">
                      You cancelled with <strong>1.5 hours</strong> before court time. Per CMO Training policy, 1 session credit ($65) is scheduled for deduction in:
                    </p>
                  </div>
                </div>

                {/* Countdown Timer */}
                <div className="bg-black/40 rounded-xl p-3 border border-brand-orange/20 flex items-center justify-center gap-3 font-mono text-center">
                  <div>
                    <div className="text-lg font-bold text-white">23</div>
                    <div className="text-[9px] text-slate-400">HOURS</div>
                  </div>
                  <span className="text-brand-orange font-bold text-lg">:</span>
                  <div>
                    <div className="text-lg font-bold text-white">48</div>
                    <div className="text-[9px] text-slate-400">MINUTES</div>
                  </div>
                  <span className="text-brand-orange font-bold text-lg">:</span>
                  <div>
                    <div className="text-lg font-bold text-white">12</div>
                    <div className="text-[9px] text-slate-400">SECONDS</div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400">
                  <span className="text-white font-semibold">Have an injury or emergency?</span> Please reach out directly to Coach via text or call to request an exception.
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 text-center">
              Current athlete balance: {credits} credits
            </div>
          </div>

          {/* Coach's Override Dashboard */}
          <div className="bg-brand-card border border-brand-border rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-white">
                  <ShieldAlert className="w-4 h-4 text-brand-orange" />
                  <span className="text-xs font-bold uppercase tracking-wider">Coach Override Panel</span>
                </div>
                <span className="text-[10px] text-slate-400">
                  Full Discretion
                </span>
              </div>

              <p className="text-xs text-slate-400 mb-4">
                {player.name} cancelled late for today's session. You have the ultimate authority to excuse them or enforce the policy.
              </p>

              {/* Status Display based on coach action */}
              {coachForgiven ? (
                <div className="p-4 bg-brand-green/10 border border-brand-green/30 rounded-xl mb-4 text-xs space-y-1">
                  <div className="flex items-center gap-2 text-brand-green font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Fee Waived / Credit Restored</span>
                  </div>
                  <p className="text-slate-300">
                    You pardoned this cancellation. No funds or credits were deducted from {player.name}.
                  </p>
                </div>
              ) : forfeitureConfirmed ? (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl mb-4 text-xs space-y-1">
                  <div className="flex items-center gap-2 text-red-400 font-bold">
                    <DollarSign className="w-4 h-4" />
                    <span>Forfeiture Enforced Immediately</span>
                  </div>
                  <p className="text-slate-300">
                    1 credit was deducted from {player.name}'s package.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-brand-surface border border-brand-border rounded-xl mb-4 text-xs">
                  <div className="text-slate-300 mb-1 font-medium">Pending Action:</div>
                  <p className="text-slate-400">
                    Will auto-forfeit in 23h 48m if no action is taken.
                  </p>
                </div>
              )}
            </div>

            {/* Coach Decision Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={handleCoachExcuse}
                className="text-xs font-semibold bg-brand-green hover:bg-green-600 text-white py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                <HeartHandshake className="w-4 h-4" />
                Waive & Excuse
              </button>

              <button
                onClick={handleConfirmForfeit}
                className="text-xs font-semibold bg-brand-surface hover:bg-red-500/20 border border-brand-border hover:border-red-500/40 text-slate-200 hover:text-red-400 py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5"
              >
                <DollarSign className="w-4 h-4" />
                Enforce Forfeiture
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
