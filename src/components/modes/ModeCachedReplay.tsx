import React from 'react';
import {
  Play,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Zap,
  RotateCcw,
  PauseCircle,
  Loader2,
} from 'lucide-react';
import { ReplayStep } from '../../types';

interface ModeCachedReplayProps {
  steps: ReplayStep[];
  isReplaying: boolean;
  onRunReplay: () => void;
  onOpenSafetyGate: () => void;
  onResetReplay: () => void;
  aborted: boolean;
  receipt: { timestamp: string; receiptId: string } | null;
}

export const ModeCachedReplay: React.FC<ModeCachedReplayProps> = ({
  steps,
  isReplaying,
  onRunReplay,
  onOpenSafetyGate,
  onResetReplay,
  aborted,
  receipt,
}) => {
  const readyForGate = steps.every((s) => s.status === 'done' || s.status === 'paused') &&
    steps.some((s) => s.status === 'paused');

  return (
    <div className="space-y-3.5">
      {/* Header Card */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-[#1E1B4B]">Saved Workflow</h2>
            <p className="text-[11px] text-[#64748B]">SSN LMS Weekly Lab Submission</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] px-2 py-0.5 text-[10px] font-bold text-[#059669]">
            <Zap className="h-3 w-3" /> ₹0 • &lt;1s
          </span>
        </div>

        {/* Primary CTA */}
        <div className="flex items-center gap-2">
          <button
            onClick={onRunReplay}
            disabled={isReplaying}
            className="pp-cta-gradient flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white shadow-sm cursor-pointer disabled:opacity-65"
          >
            {isReplaying ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Running Steps...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                Run Saved Workflow (₹0)
              </>
            )}
          </button>
          <button
            onClick={onResetReplay}
            title="Reset Demo"
            className="rounded-xl border border-[#E2E8F0] bg-[#F8F9FC] p-2.5 text-[#475569] hover:bg-[#E2E8F0]/60 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Step-by-Step Replay Execution Timeline */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between text-[11px] font-bold text-[#1E1B4B]">
          <span>Steps</span>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#64748B]">
            <Clock className="h-3 w-3 text-[#331E6D]" /> Runs locally
          </span>
        </div>

        <div className="space-y-2">
          {steps.map((step, index) => {
            const isDone = step.status === 'done';
            const isRunning = step.status === 'running';
            const isPaused = step.status === 'paused';
            const isAborted = step.status === 'aborted';

            return (
              <div
                key={step.id}
                className={`rounded-xl border p-2.5 transition-all ${
                  isAborted
                    ? 'border-[#DC2626] bg-[#FEF2F2]'
                    : isDone
                      ? 'border-[#A7F3D0] bg-[#ECFDF5]/60'
                      : isPaused
                        ? 'border-[#FDE68A] bg-[#FFFBEB]'
                        : isRunning
                          ? 'border-[#331E6D] bg-[#F3F0FF]'
                          : 'border-[#E2E8F0] bg-[#F8F9FC]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 shrink-0">
                      {isAborted ? (
                        <ShieldAlert className="h-4 w-4 text-[#DC2626]" />
                      ) : isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-[#059669]" />
                      ) : isPaused ? (
                        <PauseCircle className="h-4 w-4 text-[#D97706]" />
                      ) : isRunning ? (
                        <Loader2 className="h-4 w-4 text-[#331E6D] animate-spin" />
                      ) : (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[#CBD5E1] bg-white text-[9px] font-bold text-[#64748B]">
                          {index + 1}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#1E1B4B]">{step.title}</div>
                      <div className="text-[11px] text-[#475569]">{step.actionDesc}</div>
                    </div>
                  </div>
                  {step.durationMs && isDone && (
                    <span className="rounded bg-white border border-[#A7F3D0] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#059669] shrink-0">
                      {step.durationMs}ms
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Re-open Safety Gate CTA if paused */}
        {readyForGate && !receipt && (
          <button
            onClick={onOpenSafetyGate}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#331E6D] px-3 py-2 text-xs font-bold text-white hover:bg-[#271556] transition-colors cursor-pointer"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Open Pre-Submit Safety Gate
          </button>
        )}
      </div>

      {/* Status Outcome Banner */}
      {aborted && (
        <div className="rounded-xl border-2 border-[#DC2626] bg-[#FEF2F2] p-3.5 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-extrabold text-[#DC2626]">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            SAFETY GATE ABORTED
          </div>
          <p className="text-[11px] text-[#7F1D1D] leading-relaxed">
            Target button mutated from <strong>&quot;Submit Assignment&quot;</strong> to{' '}
            <strong>&quot;Submit &amp; Pay ₹500 Fine&quot;</strong> milliseconds before click. Execution blocked!
          </p>
        </div>
      )}

      {receipt && (
        <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] p-3.5 space-y-1">
          <div className="flex items-center gap-2 text-xs font-extrabold text-[#059669]">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Confirmed &amp; Executed Safely
          </div>
          <p className="text-[11px] font-mono text-[#047857]">
            {receipt.receiptId} • {receipt.timestamp}
          </p>
        </div>
      )}
    </div>
  );
};
