import React, { useEffect, useState } from 'react';
import { Play, ShieldCheck, Zap, CircleDot, Square } from 'lucide-react';
import { sendToActiveTab } from '../../shared/messages';
import { getVaultState } from '../../shared/storage';
import type { ExecutionLayer, WorkflowRecipe, WorkflowStep } from '../../shared/types';

interface ReplayPanelProps {
  onLayerChange: (layer: ExecutionLayer) => void;
}

export const ReplayPanel: React.FC<ReplayPanelProps> = ({ onLayerChange }) => {
  const [workflows, setWorkflows] = useState<WorkflowRecipe[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordedSteps, setRecordedSteps] = useState<WorkflowStep[]>([]);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  useEffect(() => {
    onLayerChange('LAYER_B_CACHED');
    getVaultState().then((vault) => {
      setWorkflows(vault.workflows);
      if (vault.workflows[0]) setSelectedId(vault.workflows[0].id);
    });
  }, [onLayerChange]);

  const handleToggleRecording = async () => {
    setStatusNote(null);
    try {
      if (!recording) {
        await sendToActiveTab({ type: 'START_RECORDING' });
        setRecording(true);
        setRecordedSteps([]);
        setStatusNote('Recording clicks & safe inputs on active tab...');
      } else {
        const res = await sendToActiveTab({ type: 'STOP_RECORDING' });
        setRecording(false);
        setRecordedSteps(res.steps);
        setStatusNote(`Captured ${res.steps.length} step(s) locally.`);
      }
    } catch (err) {
      setRecording(false);
      setStatusNote(err instanceof Error ? err.message : 'Unable to reach active tab.');
    }
  };

  return (
    <div className="space-y-3.5">
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#331E6D]">
              Mode 4 • Cached Replay
            </span>
            <h2 className="text-sm font-bold text-[#1E1B4B] mt-0.5">Saved Local Workflows</h2>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] px-2 py-0.5 text-[10px] font-bold text-[#059669]">
            <Zap className="h-3 w-3" /> ₹0 Tokens
          </span>
        </div>

        <button
          type="button"
          onClick={handleToggleRecording}
          className={`w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white shadow-sm cursor-pointer transition-all ${
            recording ? 'bg-[#DC2626] hover:bg-[#B91C1C]' : 'pp-cta-gradient'
          }`}
        >
          {recording ? (
            <>
              <Square className="h-3.5 w-3.5 fill-current" />
              Stop Recording
            </>
          ) : (
            <>
              <CircleDot className="h-3.5 w-3.5" />
              Record Steps on Active Tab
            </>
          )}
        </button>

        {statusNote && (
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8F9FC] px-3 py-2 text-[11px] font-medium text-[#331E6D]">
            {statusNote}
          </div>
        )}

        {recordedSteps.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
              Recorded Steps ({recordedSteps.length})
            </div>
            {recordedSteps.map((s, idx) => (
              <div
                key={`${s.selector}-${idx}`}
                className="rounded-lg border border-[#E2E8F0] bg-[#F8F9FC] px-2.5 py-1.5 text-[10px]"
              >
                <span className="font-bold uppercase text-[#331E6D]">{s.action}</span>{' '}
                <span className="text-[#1E1B4B]">{s.label || s.selector}</span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              onClick={() => setSelectedId(wf.id)}
              className={`rounded-xl border p-3 cursor-pointer transition-all ${
                selectedId === wf.id
                  ? 'border-[#331E6D] bg-[#F3F0FF]/50'
                  : 'border-[#E2E8F0] bg-[#F8F9FC]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold text-[#1E1B4B]">{wf.name}</div>
                <span className="rounded-md bg-white border border-[#E2E8F0] px-1.5 py-0.5 text-[10px] font-semibold text-[#475569]">
                  {wf.steps.length} steps
                </span>
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-[#64748B]">{wf.urlPattern}</div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5]/60 p-3 flex items-start gap-2 text-[11px] text-[#065F46]">
          <ShieldCheck className="h-4 w-4 text-[#059669] shrink-0 mt-0.5" />
          <span>
            <strong>Safety Gate Enforced:</strong> <code className="font-mono">REPLAY_STEP</code>{' '}
            skips passwords and blocks final Submit clicks unless{' '}
            <code className="font-mono">confirmed: true</code>.
          </span>
        </div>

        <button
          type="button"
          disabled
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#331E6D]/15 px-3 py-2 text-xs font-bold text-[#331E6D] cursor-not-allowed"
        >
          <Play className="h-3.5 w-3.5" />
          Ready for Step-by-Step Replay UI
        </button>
      </div>
    </div>
  );
};
