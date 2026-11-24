import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  X,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { LmsFormValues } from '../types';

interface SafetyGateModalProps {
  open: boolean;
  onClose: () => void;
  lmsValues: LmsFormValues;
  simulateTampering: boolean;
  onToggleTampering: (val: boolean) => void;
  onConfirmExecute: () => void;
  aborted: boolean;
  mutatedButtonText: string | null;
  onResetAbort: () => void;
}

export const SafetyGateModal: React.FC<SafetyGateModalProps> = ({
  open,
  onClose,
  lmsValues,
  simulateTampering,
  onToggleTampering,
  onConfirmExecute,
  aborted,
  mutatedButtonText,
  onResetAbort,
}) => {
  const [verifying, setVerifying] = useState(false);

  if (!open) return null;

  const handleConfirmClick = () => {
    setVerifying(true);
    window.setTimeout(() => {
      setVerifying(false);
      onConfirmExecute();
    }, 520);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E1B4B]/45 backdrop-blur-[2px] p-4">
      <div className="w-full max-w-lg rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Banner */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-b ${
            aborted
              ? 'bg-[#FEF2F2] border-[#FECACA]'
              : 'bg-[#F8F9FC] border-[#E2E8F0]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                aborted
                  ? 'bg-[#DC2626] border-[#B91C1C] text-white'
                  : 'bg-[#331E6D] border-[#271556] text-white'
              }`}
            >
              {aborted ? <ShieldAlert className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
            </div>
            <div>
              <h3 className={`text-sm font-bold ${aborted ? 'text-[#DC2626]' : 'text-[#1E1B4B]'}`}>
                {aborted
                  ? 'SAFETY GATE ABORTED'
                  : 'Mandatory Pre-Submit Safety Gate'}
              </h3>
              <p className="text-[11px] text-[#475569]">
                {aborted
                  ? 'Just-in-Time DOM Re-Verification detected unauthorized mutation'
                  : 'Human confirmation required before consequential action'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#475569] hover:bg-black/5 cursor-pointer"
            aria-label="Close Safety Gate"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {aborted ? (
            <div className="rounded-xl border-2 border-[#DC2626] bg-[#FEF2F2] p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 text-[#DC2626] shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-extrabold text-[#DC2626]">
                    SAFETY GATE ABORTED — Target button mutated between preview and click!
                  </div>
                  <p className="text-xs text-[#7F1D1D] mt-1 leading-relaxed">
                    Milliseconds before executing the click on <code className="font-mono font-semibold">lms.ssn.edu.in</code>, Surfie re-read the live DOM target and blocked execution.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="rounded-lg bg-white border border-[#FECACA] p-2.5">
                  <div className="text-[10px] font-semibold uppercase text-[#64748B]">
                    Expected Label (Preview)
                  </div>
                  <div className="mt-1 font-mono font-bold text-[#059669]">
                    &quot;Submit Assignment&quot;
                  </div>
                </div>
                <div className="rounded-lg bg-white border border-[#DC2626] p-2.5">
                  <div className="text-[10px] font-semibold uppercase text-[#DC2626]">
                    Live DOM Label (Detected)
                  </div>
                  <div className="mt-1 font-mono font-bold text-[#DC2626]">
                    &quot;{mutatedButtonText || 'Submit & Pay ₹500 Fine'}&quot;
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-medium text-[#991B1B]">
                  Zero clicks dispatched • Submission safely cancelled
                </span>
                <button
                  onClick={onResetAbort}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-[#FECACA] px-3 py-1.5 text-xs font-semibold text-[#DC2626] hover:bg-[#FEE2E2] transition-colors cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reset &amp; Re-verify
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Plain-English Summary */}
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8F9FC] p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#331E6D]">
                    Action Preview Summary
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] px-2 py-0.5 text-[10px] font-bold text-[#059669]">
                    <Zap className="h-3 w-3" /> Layer B • ₹0 Tokens
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[#64748B]">Target Domain:</span>
                    <div className="font-mono font-semibold text-[#1E1B4B]">lms.ssn.edu.in</div>
                  </div>
                  <div>
                    <span className="text-[#64748B]">Target Button:</span>
                    <div className="font-mono font-semibold text-[#059669]">&quot;Submit Assignment&quot;</div>
                  </div>
                  <div>
                    <span className="text-[#64748B]">Course &amp; Lab:</span>
                    <div className="font-semibold text-[#1E1B4B]">
                      {lmsValues.course} — {lmsValues.labWeek}
                    </div>
                  </div>
                  <div>
                    <span className="text-[#64748B]">Attached File:</span>
                    <div className="inline-flex items-center gap-1 font-semibold text-[#1E1B4B]">
                      <FileText className="h-3.5 w-3.5 text-[#331E6D]" />
                      {lmsValues.fileName}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tampering Demo Toggle */}
              <div
                className={`rounded-xl border p-3.5 transition-all ${
                  simulateTampering
                    ? 'border-[#F59E0B] bg-[#FFFBEB]'
                    : 'border-[#E2E8F0] bg-white'
                }`}
              >
                <label className="flex items-start justify-between gap-3 cursor-pointer">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#1E1B4B]">
                      <AlertTriangle
                        className={`h-4 w-4 ${
                          simulateTampering ? 'text-[#D97706]' : 'text-[#64748B]'
                        }`}
                      />
                      Simulate Dynamic Page Tampering
                    </div>
                    <p className="text-[11px] text-[#475569] mt-0.5">
                      When enabled, a malicious script mutates the Submit button to{' '}
                      <span className="font-mono font-semibold text-[#DC2626]">
                        &quot;Submit &amp; Pay ₹500 Fine&quot;
                      </span>{' '}
                      milliseconds before click to test Surfie&apos;s abort guard.
                    </p>
                  </div>
                  <div className="relative inline-flex items-center shrink-0 mt-0.5">
                    <input
                      type="checkbox"
                      checked={simulateTampering}
                      onChange={(e) => onToggleTampering(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5.5 bg-[#CBD5E1] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-[#DC2626]" />
                  </div>
                </label>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 border-t border-[#E2E8F0] bg-[#F8F9FC] px-5 py-3.5">
          <button
            onClick={onClose}
            className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          {!aborted && (
            <button
              onClick={handleConfirmClick}
              disabled={verifying}
              className="pp-cta-gradient inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm transition-all cursor-pointer disabled:opacity-70"
            >
              {verifying ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Re-verifying Live DOM...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Confirm &amp; Execute
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
