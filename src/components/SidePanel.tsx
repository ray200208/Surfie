import React, { useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Maximize2,
  Minimize2,
  ShieldCheck,
  Layers,
  Volume2,
} from 'lucide-react';
import { EXECUTION_LAYERS } from '../data/mockData';
import { ExecutionLayerId, LanguageCode, ModeId } from '../types';
import { PandaLogo } from './PandaLogo';

interface SidePanelProps {
  activeMode: ModeId;
  onSelectMode: (mode: ModeId) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  language: LanguageCode;
  onChangeLanguage: (lang: LanguageCode) => void;
  executionLayer: ExecutionLayerId;
  onOpenSecurityDrawer: () => void;
  onPromptSubmit: (prompt: string) => void;
  onSimulateTamilVoice: () => void;
  children: React.ReactNode;
}

const MODE_LABELS: Record<ModeId, string> = {
  1: 'Discover',
  2: 'Compare',
  3: 'Fill Form',
  4: 'Replay',
};

interface SpeechRecognitionEventLike {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

export const SidePanel: React.FC<SidePanelProps> = ({
  activeMode,
  onSelectMode,
  isExpanded,
  onToggleExpand,
  language,
  onChangeLanguage,
  executionLayer,
  onOpenSecurityDrawer,
  onPromptSubmit,
  onSimulateTamilVoice,
  children,
}) => {
  const [promptText, setPromptText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [micNote, setMicNote] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const layerMeta = EXECUTION_LAYERS[executionLayer];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptText.trim()) return;
    onPromptSubmit(promptText.trim());
    setPromptText('');
  };

  const handleToggleWebSpeech = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      setMicNote('Mic unavailable — running Tamil Voice sample');
      onSimulateTamilVoice();
      window.setTimeout(() => setMicNote(null), 2800);
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = language === 'TA' ? 'ta-IN' : language === 'HI' ? 'hi-IN' : 'en-IN';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript ?? '';
        if (transcript) {
          setPromptText(transcript);
          onPromptSubmit(transcript);
        }
      };
      rec.onerror = () => {
        setIsListening(false);
        setMicNote('Mic blocked — try Tamil Voice sample');
        window.setTimeout(() => setMicNote(null), 2800);
      };
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
      rec.start();
      setIsListening(true);
      setMicNote(`Listening (${rec.lang})...`);
    } catch {
      setIsListening(false);
      onSimulateTamilVoice();
    }
  };

  return (
    <aside className="flex h-full flex-col bg-[#F8F9FC] border-l border-[#E2E8F0] overflow-hidden">
      {/* 1. Clean Chrome Extension Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 py-3 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <PandaLogo size={26} />
            <h1 className="text-sm font-extrabold tracking-tight text-[#1E1B4B]">Surfie</h1>
            <span className="rounded-full bg-[#F3F0FF] border border-[#331E6D]/15 px-2 py-0.5 text-[10px] font-bold text-[#331E6D]">
              Auto: {MODE_LABELS[activeMode]}
            </span>
          </div>

          <button
            onClick={onToggleExpand}
            title={isExpanded ? 'Restore Split View' : 'Expand Side Panel'}
            className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-[#F8F9FC] px-2 py-1 text-[11px] font-semibold text-[#475569] hover:border-[#331E6D]/30 hover:text-[#331E6D] transition-colors cursor-pointer shrink-0"
          >
            {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Clean Human-Friendly Mode Tabs */}
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-[#F1F5F9] p-1">
          {([1, 2, 3, 4] as ModeId[]).map((modeId) => {
            const isActive = activeMode === modeId;
            return (
              <button
                key={modeId}
                onClick={() => onSelectMode(modeId)}
                className={`rounded-lg py-1.5 text-[11px] font-semibold transition-all cursor-pointer text-center ${
                  isActive
                    ? 'bg-white text-[#331E6D] shadow-xs font-bold'
                    : 'text-[#475569] hover:text-[#1E1B4B]'
                }`}
              >
                {MODE_LABELS[modeId]}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Streamlined Ask & Voice Bar */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 py-2.5 space-y-2 shrink-0">
        <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <input
              type="text"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder={
                language === 'TA'
                  ? 'தமிழ் / Tanglish-ல் கேளுங்கள்...'
                  : language === 'HI'
                    ? 'हिंदी में पूछें...'
                    : 'Ask Surfie anything about this page...'
              }
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8F9FC] pl-3 pr-8 py-1.5 text-xs text-[#1E1B4B] placeholder:text-[#94A3B8] focus:border-[#331E6D] focus:bg-white focus:outline-none transition-all"
            />
            <button
              type="submit"
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#331E6D] hover:bg-[#331E6D]/10 transition-colors cursor-pointer"
              title="Send"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={handleToggleWebSpeech}
            title="Voice Input (Web Speech API)"
            className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-all cursor-pointer shrink-0 ${
              isListening
                ? 'border-[#DC2626] bg-[#FEF2F2] text-[#DC2626] animate-pulse'
                : 'border-[#E2E8F0] bg-[#F8F9FC] text-[#331E6D] hover:border-[#331E6D]/40'
            }`}
          >
            {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </button>
        </form>

        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center rounded-lg bg-[#F1F5F9] p-0.5 text-[10px] font-semibold">
            {(
              [
                { code: 'EN', label: 'EN' },
                { code: 'HI', label: 'हिंदी' },
                { code: 'TA', label: 'தமிழ்' },
              ] as const
            ).map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => onChangeLanguage(item.code)}
                className={`rounded-md px-2 py-0.5 transition-all cursor-pointer ${
                  language === item.code
                    ? 'bg-white text-[#331E6D] shadow-xs font-bold'
                    : 'text-[#64748B] hover:text-[#1E1B4B]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onSimulateTamilVoice}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold text-[#331E6D] hover:bg-[#F3F0FF] transition-colors cursor-pointer"
          >
            <Volume2 className="h-3 w-3" />
            Try Tamil Voice
          </button>
        </div>

        {micNote && (
          <div className="rounded-lg bg-[#F3F0FF] px-2.5 py-1 text-[10px] font-medium text-[#331E6D]">
            {micNote}
          </div>
        )}
      </div>

      {/* 3. Main Active Mode Content */}
      <div className="flex-1 overflow-y-auto p-4">{children}</div>

      {/* 4. Compact Single-Row Trust & Telemetry Footer */}
      <div className="bg-white border-t border-[#E2E8F0] px-3.5 py-2.5 flex items-center justify-between gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenSecurityDrawer}
          title={layerMeta.description}
          className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#475569] hover:text-[#331E6D] transition-colors cursor-pointer min-w-0"
        >
          <Layers className="h-3.5 w-3.5 text-[#331E6D] shrink-0" />
          <span className="truncate">
            Layer {executionLayer} • {layerMeta.tokens}
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenSecurityDrawer}
          className="inline-flex items-center gap-1 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-1 text-[10px] font-bold text-[#059669] hover:bg-[#D1FAE5] transition-colors cursor-pointer shrink-0"
        >
          <ShieldCheck className="h-3 w-3" />
          0 Bytes PII • Inspect
        </button>
      </div>
    </aside>
  );
};
