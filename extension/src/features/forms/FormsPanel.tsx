import React, { useEffect, useState } from 'react';
import { ScanSearch, Lock, UserCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { sendToActiveTab } from '../../shared/messages';
import { getVaultState, setActivePersonaId } from '../../shared/storage';
import type { ExecutionLayer, PersonaProfile, VisibleDomElement } from '../../shared/types';
import FocusEntry from './focus/FocusEntry';

interface FormsPanelProps {
  onLayerChange: (layer: ExecutionLayer) => void;
}

export const FormsPanel: React.FC<FormsPanelProps> = ({ onLayerChange }) => {
  const [personas, setPersonas] = useState<PersonaProfile[]>([]);
  const [activePersonaId, setLocalPersonaId] = useState<'college' | 'personal'>('college');
  const [elements, setElements] = useState<VisibleDomElement[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    getVaultState().then((vault) => {
      setPersonas(vault.personas);
      setLocalPersonaId(vault.activePersonaId);
    });
  }, []);

  const activePersona = personas.find((p) => p.id === activePersonaId) ?? personas[0];

  const handleSwitchPersona = async (id: 'college' | 'personal') => {
    setLocalPersonaId(id);
    const updated = await setActivePersonaId(id);
    setPersonas(updated.personas);
  };

  const handleScanInputs = async () => {
    setScanning(true);
    setScanError(null);
    onLayerChange('LAYER_C_DOM');

    try {
      const res = await sendToActiveTab({ type: 'EXTRACT_VISIBLE_DOM' });
      const inputsOnly = res.elements.filter((el) =>
        ['input', 'textarea', 'select'].includes(el.tag)
      );
      setElements(inputsOnly);
      if (inputsOnly.length === 0) {
        setScanError('No visible form inputs detected in the current viewport.');
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Unable to scan active tab.');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Focus Mode entry */}
      <section aria-label="Focus Mode">
        <FocusEntry activePersona={activePersona} />
      </section>

      {/* Local Persona Vault Card */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#331E6D]">
              Mode 3 • Form Co-Pilot
            </span>
            <h2 className="text-sm font-bold text-[#1E1B4B] mt-0.5">Local Persona Vault</h2>
          </div>

          <div className="inline-flex rounded-lg bg-[#F1F5F9] p-0.5 text-[10px] font-bold">
            {(['college', 'personal'] as const).map((id) => (
              <button
                key={id}
                onClick={() => handleSwitchPersona(id)}
                className={`rounded-md px-2 py-1 cursor-pointer transition-all ${
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
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8F9FC] p-3 space-y-1 text-[11px]">
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

        <button
          onClick={handleScanInputs}
          disabled={scanning}
          className="pp-cta-gradient w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white shadow-sm cursor-pointer disabled:opacity-65"
        >
          <ScanSearch className="h-3.5 w-3.5" />
          {scanning ? 'Scanning Viewport...' : 'Scan Page Inputs'}
        </button>

        {scanError && (
          <div className="flex items-center gap-2 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[11px] font-semibold text-[#D97706]">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{scanError}</span>
          </div>
        )}
      </div>

      {/* Detected Visible Inputs */}
      {elements.length > 0 && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-[#1E1B4B]">
            <span>Detected Viewport Inputs ({elements.length})</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#059669]">
              <CheckCircle2 className="h-3 w-3" /> Labels Only
            </span>
          </div>

          <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
            {elements.map((el) => (
              <div
                key={`${el.selector}-${el.index}`}
                className={`rounded-lg border p-2 text-[11px] flex items-center justify-between gap-2 ${
                  el.isSensitive
                    ? 'border-[#FECACA] bg-[#FEF2F2]'
                    : 'border-[#E2E8F0] bg-[#F8F9FC]'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-semibold text-[#1E1B4B] truncate">{el.label}</div>
                  <div className="font-mono text-[10px] text-[#64748B] truncate">
                    {el.tag}[type=&quot;{el.type}&quot;] • {el.selector}
                  </div>
                </div>
                {el.isSensitive ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#DC2626] px-2 py-0.5 text-[9px] font-bold text-white shrink-0">
                    <Lock className="h-2.5 w-2.5" /> Locked
                  </span>
                ) : (
                  <span className="rounded-full bg-[#ECFDF5] border border-[#A7F3D0] px-2 py-0.5 text-[9px] font-bold text-[#059669] shrink-0">
                    Safe
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
