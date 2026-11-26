import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Lock, ScanSearch, UserCheck } from 'lucide-react';
import { getVaultState, setActivePersonaId } from '../../shared/storage';
import type { ExecutionLayer, PersonaProfile } from '../../shared/types';
import { scanPage } from './focus/scanClient';
import type { FocusScanPageResponse, ScannedField } from './focus/scanMessages';
import FocusEntry from './focus/FocusEntry';

interface FormsPanelProps {
  onLayerChange: (layer: ExecutionLayer) => void;
}

type PersonaId = 'college' | 'personal';

const COUNT_TYPES: { label: string; count: (field: ScannedField) => boolean }[] = [
  { label: 'Text', count: (field) => field.kind === 'text' || field.kind === 'textarea' },
  { label: 'Dropdown', count: (field) => field.kind === 'select' },
  { label: 'Checkbox', count: (field) => field.kind === 'checkbox' || field.kind === 'checkbox-group' },
  { label: 'Radio', count: (field) => field.kind === 'radio-group' },
  { label: 'Multi-choice', count: (field) => field.kind === 'multiselect' },
];

function isFileExclusion(reason: string): boolean {
  return reason.toLowerCase().includes('file upload');
}

export const FormsPanel: React.FC<FormsPanelProps> = ({ onLayerChange }) => {
  const [personas, setPersonas] = useState<PersonaProfile[]>([]);
  const [activePersonaId, setLocalPersonaId] = useState<PersonaId>('college');
  const [scanResult, setScanResult] = useState<FocusScanPageResponse | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    getVaultState().then((vault) => {
      setPersonas(vault.personas);
      setLocalPersonaId(vault.activePersonaId);
    });
  }, []);

  const activePersona = personas.find((persona) => persona.id === activePersonaId) ?? personas[0];

  const handleSwitchPersona = async (id: PersonaId) => {
    setLocalPersonaId(id);
    const updated = await setActivePersonaId(id);
    setPersonas(updated.personas);
  };

  const handleScanPage = async () => {
    setScanning(true);
    setScanError(null);
    setScanResult(null);
    onLayerChange('LAYER_C_DOM');
    try {
      const result = await scanPage();
      if (!result.ok) {
        setScanError(result.reason ?? 'Unable to scan this page. Open a regular webpage and try again.');
        return;
      }
      setScanResult(result);
      if (result.elements.length === 0) setScanError('No usable form fields were found on this page.');
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Unable to scan this page.');
    } finally {
      setScanning(false);
    }
  };

  const sensitiveExclusions = scanResult?.excluded.filter((item) => !isFileExclusion(item.reason)) ?? [];
  const fileExclusions = scanResult?.excluded.filter((item) => isFileExclusion(item.reason)) ?? [];

  return (
    <div className="space-y-3.5">
      <section aria-label="Local Persona Vault" className="space-y-3 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#331E6D]">
              Mode 3 • Form Co-Pilot
            </span>
            <h2 className="mt-0.5 text-sm font-bold text-[#1E1B4B]">Local Persona Vault</h2>
          </div>

          <div className="inline-flex rounded-lg bg-[#F1F5F9] p-0.5 text-[10px] font-bold" aria-label="Choose persona">
            {(['college', 'personal'] as const).map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={activePersonaId === id}
                onClick={() => void handleSwitchPersona(id)}
                className={`rounded-md px-2 py-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#331E6D]/40 ${
                  activePersonaId === id
                    ? 'bg-white text-[#331E6D] shadow-xs'
                    : 'text-[#64748B] hover:text-[#1E1B4B]'
                }`}
              >
                {id === 'college' ? 'College' : 'Personal'}
              </button>
            ))}
          </div>
        </div>

        {activePersona && (
          <div className="space-y-1 rounded-xl border border-[#E2E8F0] bg-[#F8F9FC] p-3 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#1E1B4B]">{activePersona.fullName}</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#059669]">
                <UserCheck className="h-3 w-3" /> chrome.storage.local
              </span>
            </div>
            <div className="text-[#475569]">{activePersona.email}</div>
            <div className="text-[#64748B]">
              {activePersona.institution}
              {activePersona.usn ? ` • USN: ${activePersona.usn}` : ''}
            </div>
          </div>
        )}
      </section>

      <section aria-label="Scan page" className="space-y-3 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-[#1E1B4B]">Scan page</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-[#475569]">
            Scan the current webpage, including fields below the fold.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleScanPage()}
          disabled={scanning}
          className="pp-cta-gradient inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#331E6D]/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ScanSearch className="h-3.5 w-3.5" />
          {scanning ? 'Scanning entire page…' : 'Scan entire page'}
        </button>

        {scanError && (
          <div role="status" aria-live="polite" className="flex items-center gap-2 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[11px] font-semibold text-[#D97706]">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{scanError}</span>
          </div>
        )}

        {scanResult && (
          <div className="space-y-2" role="status" aria-live="polite">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#059669]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {scanResult.elements.length} usable fields on {scanResult.pageTitle || 'this page'}
            </div>
            <dl className="grid grid-cols-2 gap-1.5 rounded-xl bg-[#F8F9FC] p-3 text-[11px]">
              {COUNT_TYPES.map(({ label, count }) => (
                <div key={label} className="flex justify-between gap-2 text-[#475569]">
                  <dt>{label}</dt>
                  <dd className="font-bold text-[#1E1B4B]">{scanResult.elements.filter(count).length}</dd>
                </div>
              ))}
            </dl>

            <div className="space-y-1.5 text-[10px] text-[#475569]">
              <p className="flex items-center gap-1.5 font-semibold text-[#D97706]">
                <Lock className="h-3 w-3" />
                {sensitiveExclusions.length} sensitive fields skipped
              </p>
              {sensitiveExclusions.length > 0 && (
                <details className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-2">
                  <summary className="cursor-pointer font-semibold text-[#D97706] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#331E6D]/40">
                    Show skipped field labels
                  </summary>
                  <ul className="mt-2 list-inside list-disc space-y-1">
                    {sensitiveExclusions.map((item, index) => (
                      <li key={`${item.label}-${index}`}>{item.label} — {item.reason}</li>
                    ))}
                  </ul>
                </details>
              )}
              {fileExclusions.length > 0 && (
                <p>{fileExclusions.length} file upload field(s) skipped; choose files yourself.</p>
              )}
              {scanResult.stats.skippedFrames > 0 && (
                <p>{scanResult.stats.skippedFrames} cross-origin or inaccessible frame(s) skipped.</p>
              )}
              {scanResult.stats.capped && <p>Scan capped at 500 fields.</p>}
              <p>Multi-step forms: only the current step is scanned.</p>
            </div>
          </div>
        )}
      </section>

      <section aria-label="Focus Mode">
        <FocusEntry activePersona={activePersona} />
      </section>
    </div>
  );
};
