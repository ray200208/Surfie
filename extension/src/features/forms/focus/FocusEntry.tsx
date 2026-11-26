import { useEffect, useState } from 'react';
import type { PersonaProfile } from '../../../shared/types';
import { getVaultState } from '../../../shared/storage';
import { autoFillFromVault } from './plan';
import { fillConfirmedFields } from './fillConfirmed';
import { scanActivePageForm } from './liveForm';
import { clearSpotlight } from './spotlightClient';
import { useSpotlight } from './useSpotlight';
import FocusPanel from './FocusPanel';
import type { FocusForm } from './types';

interface FocusEntryProps {
  activePersona?: PersonaProfile;
}

type CompletionState = {
  kind: 'success' | 'warning';
  message: string;
  failedFields: string[];
};

const EMPTY_FORM: FocusForm = { id: 'empty', title: '', fields: [], groups: [] };

export default function FocusEntry({ activePersona }: FocusEntryProps) {
  const [fillingPersona, setFillingPersona] = useState(activePersona);
  const [view, setView] = useState<'entry' | 'focus' | 'done'>('entry');
  const [activeForm, setActiveForm] = useState<FocusForm | null>(null);
  const [activeFieldIds, setActiveFieldIds] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanReason, setScanReason] = useState<string | null>(null);
  const [completion, setCompletion] = useState<CompletionState | null>(null);

  useEffect(() => {
    if (!activePersona) return;
    let stillMounted = true;
    void getVaultState()
      .then((vault) => {
        if (!stillMounted) return;
        setFillingPersona(
          vault.personas.find((persona) => persona.id === activePersona.id) ?? activePersona
        );
      })
      .catch(() => {
        if (stillMounted) setFillingPersona(activePersona);
      });
    return () => { stillMounted = false; };
  }, [activePersona]);

  useSpotlight(activeFieldIds, activeForm ?? EMPTY_FORM);

  const startLiveForm = async () => {
    if (scanning) return;
    setScanning(true);
    setScanReason(null);
    try {
      const vault = await getVaultState();
      const persona = vault.personas.find((item) => item.id === vault.activePersonaId) ??
        vault.personas[0] ?? activePersona;
      if (!persona) {
        setScanReason('No active persona is available. Choose a persona in the Local Persona Vault.');
        return;
      }
      setFillingPersona(persona);
      const result = await scanActivePageForm(persona);
      if (!result.ok || !result.form) {
        setScanReason(result.reason ?? 'No usable form fields were found. Try a page with a form.');
        return;
      }
      setActiveForm(autoFillFromVault(result.form, persona));
      setActiveFieldIds([]);
      setCompletion(null);
      setView('focus');
    } catch (error) {
      setScanReason(error instanceof Error ? error.message : 'Could not start Focus Mode. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  const leaveFocus = () => {
    void clearSpotlight();
    setActiveFieldIds([]);
    setActiveForm(null);
    setView('entry');
  };

  const confirmValues = async (values: Record<string, string>) => {
    if (!activeForm) return;
    const result = await fillConfirmedFields(values, activeForm);
    void clearSpotlight();
    setActiveFieldIds([]);
    if (result.ok) {
      setCompletion({
        kind: 'success',
        message: 'Fields filled. Review the page and press Submit yourself.',
        failedFields: [],
      });
    } else {
      const failedFields = Array.from(
        new Set([
          ...result.failedFields,
          ...result.skippedFields.map((field) => field.label),
        ])
      );
      setCompletion({
        kind: 'warning',
        message: result.reason ?? 'Some fields could not be filled.',
        failedFields,
      });
    }
    setView('done');
  };

  if (view === 'focus' && activeForm) {
    return (
      <div className="space-y-2">
        <p aria-live="polite" className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-[11px] font-semibold text-[#475569]">
          Filling with: <span className="text-[#331E6D]">{fillingPersona?.label ?? fillingPersona?.fullName ?? 'No persona selected'}</span>
        </p>
        <FocusPanel
          form={activeForm}
          onFormChange={setActiveForm}
          onActiveFieldsChange={setActiveFieldIds}
          onExit={leaveFocus}
          onConfirm={confirmValues}
        />
      </div>
    );
  }

  if (view === 'done' && completion) {
    const isSuccess = completion.kind === 'success';
    return (
      <section className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
        <p className="mb-3 text-[11px] font-semibold text-[#475569]">
          Filling with: <span className="text-[#331E6D]">{fillingPersona?.label ?? fillingPersona?.fullName ?? 'No persona selected'}</span>
        </p>
        <div
          role="status"
          aria-live="polite"
          className={`rounded-xl border px-3 py-2.5 text-xs font-semibold ${
            isSuccess
              ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]'
              : 'border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]'
          }`}
        >
          {completion.message}
          {completion.failedFields.length > 0 && (
            <ul className="mt-1 list-inside list-disc font-medium">
              {completion.failedFields.map((field) => <li key={field}>{field}</li>)}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={leaveFocus}
          className="mt-3 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8F9FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#331E6D]/40"
        >
          Back to Forms
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
      <div>
        <h2 className="text-sm font-bold text-[#1E1B4B]">Focus Mode</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-[#475569]">
          Fill forms step by step. Nothing is submitted without your OK.
        </p>
        <p aria-live="polite" className="mt-2 text-[11px] font-semibold text-[#475569]">
          Filling with: <span className="text-[#331E6D]">{fillingPersona?.label ?? fillingPersona?.fullName ?? 'No persona selected'}</span>
        </p>
      </div>

      {scanReason && (
        <p role="status" aria-live="polite" className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[11px] font-semibold text-[#D97706]">
          {scanReason}
        </p>
      )}

      <button
        type="button"
        onClick={() => void startLiveForm()}
        disabled={scanning}
        className="pp-cta-gradient w-full rounded-xl px-3 py-2 text-xs font-bold text-white shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#331E6D]/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {scanning ? 'Scanning page…' : 'Start Focus Mode'}
      </button>

    </section>
  );
}
