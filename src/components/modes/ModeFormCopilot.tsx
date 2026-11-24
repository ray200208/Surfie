import React, { useState } from 'react';
import {
  UserCheck,
  CheckCircle2,
  Lock,
  Mic,
  Volume2,
  Code2,
  Eye,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Send,
} from 'lucide-react';
import { PERSONAS, VOICE_ESSAY_PRESETS } from '../../data/mockData';
import { HackathonFormValues, PersonaType } from '../../types';

interface ModeFormCopilotProps {
  activePersona: PersonaType;
  onSwitchPersona: (persona: PersonaType) => void;
  formValues: HackathonFormValues;
  filledByPilot: Record<keyof HackathonFormValues, boolean>;
  onAcceptAllSafe: () => void;
  onResetForm: () => void;
  onChangeFormField: (field: keyof HackathonFormValues, value: string, fromOverride?: boolean) => void;
  focusMode: boolean;
  onToggleFocusMode: (enabled: boolean) => void;
  activeFocusField: keyof HackathonFormValues | null;
  onSelectFocusField: (field: keyof HackathonFormValues) => void;
  voiceSimActive: boolean;
  voiceTranscript: string | null;
  onTriggerTamilVoiceForm: () => void;
  onInsertEssay: (text: string) => void;
  savedOverridesCount: number;
}

const FOCUS_FIELDS: { key: keyof HackathonFormValues; label: string; safe: boolean }[] = [
  { key: 'fullName', label: 'Candidate Full Name', safe: true },
  { key: 'email', label: 'Institutional Email (.edu.in)', safe: true },
  { key: 'phone', label: 'Mobile Number', safe: true },
  { key: 'college', label: 'College / Institution', safe: true },
  { key: 'usn', label: 'USN / University Roll No', safe: true },
  { key: 'essay', label: 'Descriptive Essay ("Why select your team?")', safe: true },
  { key: 'passwordOtp', label: 'Portal Password / OTP', safe: false },
];

export const ModeFormCopilot: React.FC<ModeFormCopilotProps> = ({
  activePersona,
  onSwitchPersona,
  formValues,
  filledByPilot,
  onAcceptAllSafe,
  onResetForm,
  onChangeFormField,
  focusMode,
  onToggleFocusMode,
  activeFocusField,
  onSelectFocusField,
  voiceSimActive,
  voiceTranscript,
  onTriggerTamilVoiceForm,
  onInsertEssay,
  savedOverridesCount,
}) => {
  const [payloadOpen, setPayloadOpen] = useState(false);
  const [tone, setTone] = useState<'professional' | 'concise'>('professional');

  const persona = PERSONAS[activePersona];
  const currentFocusIndex = Math.max(
    0,
    FOCUS_FIELDS.findIndex((f) => f.key === (activeFocusField ?? 'fullName'))
  );
  const currentFocusMeta = FOCUS_FIELDS[currentFocusIndex];

  const handleToggleFocus = () => {
    const next = !focusMode;
    onToggleFocusMode(next);
    if (next && !activeFocusField) {
      onSelectFocusField('fullName');
    }
  };

  const refinedEssay =
    tone === 'professional' ? VOICE_ESSAY_PRESETS.professional : VOICE_ESSAY_PRESETS.concise;

  const filledSafeCount = (['fullName', 'email', 'phone', 'college', 'usn'] as const).filter(
    (k) => filledByPilot[k]
  ).length;

  return (
    <div className="space-y-3.5">
      {/* Header + Contextual Persona Vault */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-[#1E1B4B]">Smart Form Fill</h2>
            <p className="text-[11px] text-[#64748B]">{persona.badge}</p>
          </div>
          <div className="inline-flex rounded-lg bg-[#F1F5F9] p-0.5 text-[10px] font-bold">
            {(['college', 'personal'] as PersonaType[]).map((pType) => (
              <button
                key={pType}
                onClick={() => onSwitchPersona(pType)}
                className={`rounded-md px-2 py-1 transition-all cursor-pointer ${
                  activePersona === pType
                    ? 'bg-white text-[#331E6D] shadow-xs'
                    : 'text-[#64748B] hover:text-[#1E1B4B]'
                }`}
              >
                {pType === 'college' ? 'College' : 'Personal'}
              </button>
            ))}
          </div>
        </div>

        {/* Live Preview Chips */}
        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
          <div className="rounded-lg bg-[#F8F9FC] border border-[#E2E8F0] px-2.5 py-1.5 truncate">
            <span className="text-[#64748B]">Email: </span>
            <span className="font-semibold text-[#1E1B4B]">{persona.email}</span>
          </div>
          <div className="rounded-lg bg-[#F8F9FC] border border-[#E2E8F0] px-2.5 py-1.5 truncate">
            <span className="text-[#64748B]">USN: </span>
            <span className="font-mono font-semibold text-[#1E1B4B]">{persona.usn}</span>
          </div>
        </div>

        {/* Accept All Safe Fields + Reset */}
        <div className="flex items-center gap-2">
          <button
            onClick={onAcceptAllSafe}
            className="pp-cta-gradient flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white shadow-sm cursor-pointer"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Auto-fill Safe Fields ({filledSafeCount}/5)
          </button>
          <button
            onClick={onResetForm}
            title="Clear Form"
            className="rounded-xl border border-[#E2E8F0] bg-[#F8F9FC] p-2 text-[#475569] hover:bg-[#E2E8F0]/60 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Subtle Privacy & Credential Boundary Row */}
        <div className="flex items-center justify-between text-[10px] text-[#64748B] pt-0.5">
          <span className="inline-flex items-center gap-1 text-[#DC2626] font-semibold">
            <Lock className="h-3 w-3" /> Password/OTP stays manual
          </span>
          {savedOverridesCount > 0 ? (
            <span className="text-[#059669] font-semibold">{savedOverridesCount} saved locally</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[#059669] font-semibold">
              <UserCheck className="h-3 w-3" /> Local Vault
            </span>
          )}
        </div>
      </div>

      {/* Focus Mode + Zero-Leak Cloud Payload Inspector */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={handleToggleFocus}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all cursor-pointer border ${
              focusMode
                ? 'border-[#331E6D] bg-[#331E6D] text-white'
                : 'border-[#E2E8F0] bg-[#F8F9FC] text-[#1E1B4B] hover:border-[#331E6D]/40'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            Focus Mode: {focusMode ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={() => setPayloadOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-1.5 text-[11px] font-bold text-[#059669] hover:bg-[#D1FAE5] transition-colors cursor-pointer"
          >
            <Code2 className="h-3.5 w-3.5" />
            Inspect Cloud Payload
          </button>
        </div>

        {/* Focus Mode Single Calm Card */}
        {focusMode && (
          <div className="rounded-xl border-2 border-[#331E6D]/25 bg-[#F3F0FF]/50 p-3 space-y-2.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-[#331E6D]">
                Calm Card {currentFocusIndex + 1} of {FOCUS_FIELDS.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const prev =
                      (currentFocusIndex - 1 + FOCUS_FIELDS.length) % FOCUS_FIELDS.length;
                    onSelectFocusField(FOCUS_FIELDS[prev].key);
                  }}
                  className="rounded-md bg-white border border-[#E2E8F0] p-1 text-[#475569] hover:text-[#331E6D] cursor-pointer"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <button
                  onClick={() => {
                    const next = (currentFocusIndex + 1) % FOCUS_FIELDS.length;
                    onSelectFocusField(FOCUS_FIELDS[next].key);
                  }}
                  className="rounded-md bg-white border border-[#E2E8F0] p-1 text-[#475569] hover:text-[#331E6D] cursor-pointer"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>

            <div className="text-xs font-bold text-[#1E1B4B]">{currentFocusMeta.label}</div>

            {currentFocusMeta.safe ? (
              <input
                type="text"
                value={formValues[currentFocusMeta.key]}
                onChange={(e) => onChangeFormField(currentFocusMeta.key, e.target.value)}
                placeholder={`Type or auto-fill ${currentFocusMeta.label}...`}
                className="w-full rounded-lg border border-[#331E6D]/30 bg-white px-2.5 py-1.5 text-xs text-[#1E1B4B] focus:outline-none focus:border-[#331E6D]"
              />
            ) : (
              <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-2 text-[11px] text-[#DC2626] font-medium">
                Hard Credential Boundary: Enter your Password/OTP directly on the portal page.
              </div>
            )}
          </div>
        )}

        {/* Zero-Leak Cloud Payload Drawer */}
        {payloadOpen && (
          <div className="rounded-xl border border-[#A7F3D0] bg-[#0F172A] p-3 text-[10px] font-mono text-emerald-300 space-y-1.5">
            <div className="flex items-center justify-between text-emerald-400 font-sans font-bold text-[10px]">
              <span>POST /api/map-schema (Blank Labels Only • 0 Bytes PII)</span>
              <span className="rounded bg-emerald-500/20 px-1.5 py-0.5">VERIFIED</span>
            </div>
            <pre className="overflow-x-auto leading-relaxed text-[10px] text-slate-200">
{`{
  "domain": "portal.campusconnect.edu.in",
  "fields": {
    "f1": "Candidate Full Name",
    "f2": "Institutional Email (.edu.in)",
    "f3": "USN / University Roll No"
  },
  "pii_values_transmitted": 0
}`}
            </pre>
            <div className="font-sans text-[10px] text-emerald-300/90">
              Real PII ({persona.email}, {persona.usn}) is injected strictly on-device from local vault.
            </div>
          </div>
        )}
      </div>

      {/* Tamil / Tanglish Voice-to-Form Card */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F3F0FF] text-[#331E6D]">
              <Mic className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#1E1B4B]">Tamil / Tanglish Voice-to-Form</div>
              <div className="text-[10px] text-[#64748B]">Speak naturally for descriptive essay box</div>
            </div>
          </div>
          <button
            onClick={onTriggerTamilVoiceForm}
            className="inline-flex items-center gap-1 rounded-lg bg-[#331E6D] px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-[#271556] transition-colors cursor-pointer shrink-0"
          >
            <Volume2 className="h-3 w-3" />
            Simulate Tamil/Tanglish Voice
          </button>
        </div>

        {/* Live Waveform Animation */}
        {voiceSimActive && (
          <div className="flex items-center justify-center gap-1 rounded-xl bg-[#F3F0FF] border border-[#331E6D]/20 py-3">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((bar) => (
              <span
                key={bar}
                className="pp-wave-bar w-1 h-6 rounded-full bg-[#331E6D]"
                style={{ animationDelay: `${bar * 0.08}s` }}
              />
            ))}
            <span className="ml-2 text-[11px] font-bold text-[#331E6D]">
              Listening (ta-IN / Tanglish)...
            </span>
          </div>
        )}

        {/* Transcript + Tone Chips + Insert Button */}
        {voiceTranscript && !voiceSimActive && (
          <div className="space-y-2.5 pt-0.5">
            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8F9FC] p-2.5">
              <div className="text-[9px] font-bold uppercase tracking-wider text-[#64748B]">
                Captured Tanglish Transcript (ta-IN)
              </div>
              <p className="mt-1 text-[11px] italic text-[#1E1B4B]">&quot;{voiceTranscript}&quot;</p>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#331E6D] inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Refined English Output
              </span>
              <div className="inline-flex rounded-lg border border-[#E2E8F0] bg-[#F8F9FC] p-0.5 text-[10px] font-bold">
                <button
                  onClick={() => setTone('professional')}
                  className={`rounded-md px-2 py-0.5 cursor-pointer transition-all ${
                    tone === 'professional'
                      ? 'bg-[#331E6D] text-white'
                      : 'text-[#475569]'
                  }`}
                >
                  Professional
                </button>
                <button
                  onClick={() => setTone('concise')}
                  className={`rounded-md px-2 py-0.5 cursor-pointer transition-all ${
                    tone === 'concise'
                      ? 'bg-[#331E6D] text-white'
                      : 'text-[#475569]'
                  }`}
                >
                  Concise
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-[#A7F3D0] bg-[#ECFDF5]/60 p-2.5 text-[11px] text-[#065F46] leading-relaxed">
              {refinedEssay}
            </div>

            <button
              onClick={() => onInsertEssay(refinedEssay)}
              className="pp-cta-gradient w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white shadow-sm cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              Insert into Form
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
