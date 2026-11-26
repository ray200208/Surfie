import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  ShieldCheck,
  Zap,
  CircleDot,
  Square,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
  Save,
  Trash2,
} from 'lucide-react';
import { sendToActiveTab } from '../../shared/messages';
import { getVaultState } from '../../shared/storage';
import type { ExecutionLayer, WorkflowRecipe, WorkflowStep } from '../../shared/types';
import {
  type StepStatus,
  buildRecipe,
  isHighStakesStep,
  isSensitiveStep,
  humanDelay,
  persistRecipe,
  removeRecipe,
  getRecBuffer,
  setRecActive,
  watchRecBuffer,
  ensureStepPage,
  sendStepWithRetry,
  getActiveTab,
  pageKey,
} from './replayEngine';

interface ReplayPanelProps {
  onLayerChange: (layer: ExecutionLayer) => void;
  onReplayingChange?: (replaying: boolean) => void;
}

const RECORDED_ID = '__recorded__';

export const ReplayPanel: React.FC<ReplayPanelProps> = ({ onLayerChange, onReplayingChange }) => {
  const [workflows, setWorkflows] = useState<WorkflowRecipe[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordedSteps, setRecordedSteps] = useState<WorkflowStep[]>([]);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const [isReplaying, setIsReplaying] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<WorkflowStep | null>(null);
  const [replayResult, setReplayResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [recipeName, setRecipeName] = useState('');
  const [liveCount, setLiveCount] = useState(0);
  const [liveSteps, setLiveSteps] = useState<WorkflowStep[]>([]);
  const [recordedStart, setRecordedStart] = useState<string | undefined>(undefined);
  const [stepOverrides, setStepOverrides] = useState<Record<number, string>>({});

  const abortRef = useRef(false);
  const confirmResolverRef = useRef<((ok: boolean) => void) | null>(null);

  useEffect(() => {
    onLayerChange('LAYER_B_CACHED');
    getVaultState().then((vault) => {
      setWorkflows(vault.workflows);
    });
  }, [onLayerChange]);

  useEffect(() => {
    onReplayingChange?.(isReplaying);
    return () => onReplayingChange?.(false);
  }, [isReplaying, onReplayingChange]);

  useEffect(() => {
    setStepOverrides({});
    setStepStatuses([]);
    setReplayResult(null);
  }, [selectedId]);

  const activeSteps: WorkflowStep[] =
    selectedId === RECORDED_ID
      ? recordedSteps
      : workflows.find((w) => w.id === selectedId)?.steps ?? [];

  // Recording buffer lives in chrome.storage so it survives navigations & tab switches.
  useEffect(() => {
    getRecBuffer().then((b) => {
      if (b.active) {
        setRecording(true);
        setLiveCount(b.steps.length);
        setLiveSteps(b.steps);
      }
    });
    return watchRecBuffer((b) => {
      setLiveCount(b.steps.length);
      setLiveSteps(b.steps);
    });
  }, []);

  const handleDelete = async (wf: WorkflowRecipe) => {
    if (isReplaying) return;
    if (!window.confirm(`Delete workflow "${wf.name}"?`)) return;
    const next = await removeRecipe(wf.id);
    setWorkflows(next);
    if (selectedId === wf.id) setSelectedId(null);
    setStepStatuses([]);
    setStatusNote(`Deleted "${wf.name}".`);
  };

  const handleToggleRecording = async () => {
    setStatusNote(null);
    try {
      if (!recording) {
        const startTab = await getActiveTab();
        await setRecActive(true, startTab?.url);
        setRecording(true);
        setLiveSteps([]);
        setRecordedSteps([]);
        setLiveCount(0);
        try {
          await sendToActiveTab({ type: 'PING_PAGE' });
          setStatusNote('Recording… you can click links, navigate and switch tabs freely.');
        } catch (err) {
          setStatusNote(
            `Recording started, but this tab can't be recorded yet: ${err instanceof Error ? err.message : 'unreachable'
            }`
          );
        }
      } else {
        const prev = await setRecActive(false);
        setRecording(false);
        const safe = (prev.steps ?? []).filter((s) => !isSensitiveStep(s));
        setRecordedSteps(safe);
        setRecordedStart(prev.startUrl);
        setLiveSteps([]);
        if (safe.length) setSelectedId(RECORDED_ID);
        setStatusNote(`Captured ${safe.length} step(s) locally.`);
      }
    } catch (err) {
      setRecording(false);
      setStatusNote(err instanceof Error ? err.message : 'Unable to reach active tab.');
    }
  };

  const waitForConfirmation = (step: WorkflowStep) =>
    new Promise<boolean>((resolve) => {
      setPendingConfirm(step);
      confirmResolverRef.current = (ok) => {
        confirmResolverRef.current = null;
        setPendingConfirm(null);
        resolve(ok);
      };
    });

  const setStatusAt = (i: number, s: StepStatus) =>
    setStepStatuses((prev) => prev.map((p, idx) => (idx === i ? s : p)));

  const handleStartReplay = async () => {
    const steps = activeSteps;
    if (!steps.length || isReplaying) return;

    // Validate starting URL before replay (stored on the workflow, not guessed)
    const wf = workflows.find((w) => w.id === selectedId);
    const firstStepUrl = selectedId === RECORDED_ID ? recordedStart ?? steps[0]?.url : wf?.startUrl ?? steps[0]?.url;
    if (firstStepUrl) {
      try {
        const tab = await getActiveTab();
        const currentUrl = tab?.url ?? '';
        if (pageKey(currentUrl) !== pageKey(firstStepUrl)) {
          setReplayResult({
            ok: false,
            msg: `Replay blocked. Expected starting URL: ${firstStepUrl} / Current URL: ${currentUrl}. Navigate to the starting page first, then replay.`,
          });
          return;
        }
      } catch (e) {
        // ignore, continue
      }
    }

    abortRef.current = false;
    setIsReplaying(true);
    setReplayResult(null);
    setStepStatuses(steps.map(() => 'pending'));

    // Removed duplicate initialization block

    let failed = false;
    for (let i = 0; i < steps.length; i++) {
      if (abortRef.current) break;
      const rawStep = steps[i];
      const ov = stepOverrides[i];
      const step: WorkflowStep =
        ov !== undefined && ov.trim() !== ''
          ? rawStep.action === 'fill'
            ? { ...rawStep, value: ov }
            : rawStep.action === 'click'
              ? {
                  ...rawStep,
                  selector: '',
                  label: ov.trim(),
                  target: { ...(rawStep.target ?? { tag: '*' }), text: ov.trim() },
                }
              : rawStep
          : rawStep;
      setActiveStepIndex(i);

      if (isSensitiveStep(step)) {
        setStatusAt(i, 'skipped');
        continue;
      }

      let confirmed = false;
      if (isHighStakesStep(step)) {
        setStatusAt(i, 'awaiting');
        confirmed = await waitForConfirmation(step);
        if (!confirmed || abortRef.current) {
          setStatusAt(i, 'failed');
          abortRef.current = true;
          break;
        }
      }

      setStatusAt(i, 'running');
      const aborted = () => abortRef.current;
      try {
        // Follow navigations / tab switches that happened during recording.
        await ensureStepPage(step, aborted);
        if (aborted()) break;
        let res = await sendStepWithRetry(step, confirmed, aborted);

        // Content script may flag something as high-stakes that we didn't detect.
        if (res.status === 'requires_confirmation' && !confirmed) {
          setStatusAt(i, 'awaiting');
          const ok = await waitForConfirmation(step);
          if (!ok || abortRef.current) {
            setStatusAt(i, 'failed');
            abortRef.current = true;
            break;
          }
          setStatusAt(i, 'running');
          res = await sendStepWithRetry(step, true, aborted);
        }

        if (res.status === 'skipped_sensitive') {
          setStatusAt(i, 'skipped');
        } else if (!res.ok) {
          setStatusAt(i, 'failed');
          setReplayResult({
            ok: false,
            msg: `Step ${i + 1} failed: ${res.error ?? res.status} (${step.label || step.selector})`,
          });
          failed = true;
          break;
        } else {
          setStatusAt(i, 'completed');
        }
      } catch (err) {
        setStatusAt(i, 'failed');
        setReplayResult({ ok: false, msg: `Step ${i + 1} failed: ${err instanceof Error ? err.message : 'Replay failed.'}` });
        failed = true;
        break;
      }

      if (i < steps.length - 1) await humanDelay();
    }

    if (!failed) {
      setReplayResult(
        abortRef.current
          ? { ok: false, msg: 'Replay aborted.' }
          : { ok: true, msg: `Replayed ${steps.length} step(s) successfully.` }
      );
    }
    setIsReplaying(false);
    setActiveStepIndex(null);
  };

  const handleAbort = () => {
    abortRef.current = true;
    confirmResolverRef.current?.(false);
  };

  const handleSave = async () => {
    const name = recipeName.trim();
    if (!name || !recordedSteps.length) return;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const recipe = buildRecipe(name, recordedSteps, recordedStart ?? tab?.url);
      const next = await persistRecipe(recipe);
      setWorkflows(next);
      setSelectedId(recipe.id);
      setRecordedSteps([]);
      setRecipeName('');
      setStatusNote(`Saved "${name}" to local vault.`);
    } catch (err) {
      setStatusNote(err instanceof Error ? err.message : 'Failed to save workflow.');
    }
  };

  const statusIcon = (s: StepStatus | undefined) => {
    switch (s) {
      case 'running':
        return <Loader2 className="h-3.5 w-3.5 text-[#331E6D] animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="h-3.5 w-3.5 text-[#059669]" />;
      case 'failed':
        return <XCircle className="h-3.5 w-3.5 text-[#DC2626]" />;
      case 'awaiting':
        return <AlertTriangle className="h-3.5 w-3.5 text-[#D97706]" />;
      case 'skipped':
        return <ShieldCheck className="h-3.5 w-3.5 text-[#64748B]" />;
      default:
        return <Circle className="h-3.5 w-3.5 text-[#CBD5E1]" />;
    }
  };

  const rowClass = (s: StepStatus | undefined, active: boolean) => {
    if (s === 'failed') return 'border-[#FCA5A5] bg-[#FEF2F2]';
    if (s === 'completed') return 'border-[#A7F3D0] bg-[#ECFDF5]/60';
    if (s === 'awaiting') return 'border-[#FCD34D] bg-[#FFFBEB]';
    if (active || s === 'running') return 'border-[#331E6D] bg-[#F3F0FF]/70';
    return 'border-[#E2E8F0] bg-[#F8F9FC]';
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
          disabled={isReplaying}
          className={`w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white shadow-sm cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${recording ? 'bg-[#DC2626] hover:bg-[#B91C1C]' : 'pp-cta-gradient'
            }`}
        >
          {recording ? (
            <>
              <Square className="h-3.5 w-3.5 fill-current" /> Stop Recording ({liveCount} captured)
            </>
          ) : (
            <>
              <CircleDot className="h-3.5 w-3.5" /> Record Steps on Active Tab
            </>
          )}
        </button>

        {statusNote && (
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8F9FC] px-3 py-2 text-[11px] font-medium text-[#331E6D]">
            {statusNote}
          </div>
        )}

        {recordedSteps.length > 0 && !recording && (
          <div
            onClick={() => !isReplaying && setSelectedId(RECORDED_ID)}
            className={`rounded-xl border p-3 space-y-2 cursor-pointer transition-all ${selectedId === RECORDED_ID ? 'border-[#331E6D] bg-[#F3F0FF]/50' : 'border-[#E2E8F0] bg-[#F8F9FC]'
              }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-[#1E1B4B]">Unsaved Recording</div>
              <span className="rounded-md bg-white border border-[#E2E8F0] px-1.5 py-0.5 text-[10px] font-semibold text-[#475569]">
                {recordedSteps.length} steps
              </span>
            </div>
            <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={recipeName}
                onChange={(e) => setRecipeName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder="Recipe name, e.g. Search on Amazon"
                className="flex-1 min-w-0 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[11px] text-[#1E1B4B] outline-none focus:border-[#331E6D]"
              />
              <button
                type="button"
                onClick={handleSave}
                disabled={!recipeName.trim()}
                className="inline-flex items-center gap-1 rounded-lg bg-[#331E6D] px-2.5 py-1.5 text-[11px] font-bold text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save className="h-3 w-3" /> Save
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              onClick={() => !isReplaying && setSelectedId(wf.id)}
              className={`rounded-xl border p-3 cursor-pointer transition-all ${selectedId === wf.id ? 'border-[#331E6D] bg-[#F3F0FF]/50' : 'border-[#E2E8F0] bg-[#F8F9FC]'
                }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold text-[#1E1B4B]">{wf.name}</div>
                <div className="flex items-center gap-1.5">
                  <span className="rounded-md bg-white border border-[#E2E8F0] px-1.5 py-0.5 text-[10px] font-semibold text-[#475569]">
                    {wf.steps.length} steps
                  </span>
                  <button
                    type="button"
                    title="Delete workflow"
                    disabled={isReplaying}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(wf);
                    }}
                    className="rounded-md p-1 text-[#94A3B8] hover:bg-[#FEF2F2] hover:text-[#DC2626] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-[#64748B]">{wf.urlPattern}</div>
            </div>
          ))}
        </div>

        {recording && liveSteps.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">
              Recording… {liveSteps.length} action(s)
            </div>
            {liveSteps.map((s, idx) => (
              <div key={`live-${idx}`} className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8F9FC] px-2.5 py-1.5 text-[10px]">
                <span className="font-bold uppercase text-[#331E6D]">{s.action}</span>
                <span className="text-[#1E1B4B] truncate">{s.label || s.selector}{s.value && s.action !== 'check' ? ` → ${s.value}` : ''}</span>
              </div>
            ))}
          </div>
        )}

        {activeSteps.length > 0 && (() => {
          let seenRecipient = false;
          const customizable = activeSteps
            .map((s, idx) => {
              if (s.action === 'fill' && !isSensitiveStep(s)) {
                return { idx, kind: 'fill' as const, fieldLabel: s.label || 'Message / Text', defaultVal: s.value ?? '' };
              }
              if (
                !seenRecipient &&
                s.action === 'click' &&
                !isHighStakesStep(s) &&
                s.url &&
                /\/(messaging|messages|chat|dm)/i.test(s.url) &&
                s.target?.role !== 'textbox' &&
                !/write a message|type a message|send|messaging|messages|close|attach|emoji/i.test((s.label || '').trim())
              ) {
                seenRecipient = true;
                return { idx, kind: 'click' as const, fieldLabel: 'Recipient / User', defaultVal: s.label || s.target?.text || '' };
              }
              return null;
            })
            .filter((x): x is NonNullable<typeof x> => x !== null);

          return (
            <div className="space-y-2">
              {customizable.length > 0 && (
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8F9FC] p-2.5 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#331E6D]">
                    Customize Before Replay
                  </div>
                  {customizable.map((item) => (
                    <label key={`ov-${item.idx}`} className="block space-y-0.5">
                      <span className="text-[10px] font-semibold text-[#475569]">{item.fieldLabel}</span>
                      <input
                        type="text"
                        disabled={isReplaying}
                        value={stepOverrides[item.idx] ?? item.defaultVal}
                        onChange={(e) =>
                          setStepOverrides((prev) => ({ ...prev, [item.idx]: e.target.value }))
                        }
                        placeholder={item.kind === 'fill' ? 'Enter text to type…' : 'Enter user / chat name…'}
                        className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1 text-[11px] text-[#1E1B4B] outline-none focus:border-[#331E6D] disabled:opacity-60"
                      />
                    </label>
                  ))}
                </div>
              )}

              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                  Steps to Replay ({activeSteps.length})
                </div>
                {activeSteps.map((s, idx) => {
                  const st = stepStatuses[idx];
                  return (
                    <div
                      key={`${s.selector}-${idx}`}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[10px] transition-all ${rowClass(
                        st,
                        activeStepIndex === idx
                      )}`}
                    >
                      {statusIcon(st)}
                      <span className="font-bold uppercase text-[#331E6D]">{s.action}</span>
                      <span className="text-[#1E1B4B] truncate">
                        {s.label || s.selector}
                        {s.action === 'fill' && (stepOverrides[idx] ?? s.value) ? `: ${stepOverrides[idx] ?? s.value}` : ''}
                      </span>
                      {isHighStakesStep(s) && (
                        <span className="ml-auto rounded bg-[#FEF3C7] px-1 text-[9px] font-bold text-[#B45309]">
                          GATED
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {pendingConfirm && (
          <div className="rounded-xl border border-[#FCD34D] bg-[#FFFBEB] p-3 space-y-2">
            <div className="flex items-start gap-2 text-[11px] text-[#92400E]">
              <AlertTriangle className="h-4 w-4 text-[#D97706] shrink-0 mt-0.5" />
              <span>
                <strong>High-stakes action:</strong> “{pendingConfirm.label || pendingConfirm.selector}”. This may
                submit data or place an order.
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => confirmResolverRef.current?.(true)}
                className="flex-1 rounded-lg bg-[#059669] hover:bg-[#047857] px-2 py-1.5 text-[11px] font-bold text-white cursor-pointer"
              >
                Confirm Execution
              </button>
              <button
                type="button"
                onClick={() => confirmResolverRef.current?.(false)}
                className="flex-1 rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-[11px] font-bold text-[#475569] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {replayResult && !isReplaying && (
          <div
            className={`rounded-lg border px-3 py-2 text-[11px] font-medium ${replayResult.ok
              ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]'
              : 'border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C]'
              }`}
          >
            {replayResult.msg}
          </div>
        )}

        <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5]/60 p-3 flex items-start gap-2 text-[11px] text-[#065F46]">
          <ShieldCheck className="h-4 w-4 text-[#059669] shrink-0 mt-0.5" />
          <span>
            <strong>Safety Gate Enforced:</strong> <code className="font-mono">REPLAY_STEP</code> skips passwords and
            blocks final Submit clicks unless <code className="font-mono">confirmed: true</code>.
          </span>
        </div>

        {isReplaying ? (
          <button
            type="button"
            onClick={handleAbort}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] px-3 py-2 text-xs font-bold text-white cursor-pointer"
          >
            <Square className="h-3.5 w-3.5 fill-current" /> Abort / Stop Replay
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStartReplay}
            disabled={!activeSteps.length || recording}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl pp-cta-gradient px-3 py-2 text-xs font-bold text-white shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play className="h-3.5 w-3.5" /> Run Replay ({activeSteps.length} steps)
          </button>
        )}
      </div>
    </div>
  );
};
