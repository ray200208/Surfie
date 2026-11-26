import React, { useEffect, useRef, useState } from 'react';
import { Layers, Mic, MicOff, Send, ShieldCheck, Globe } from 'lucide-react';
import type { PandaMessage } from '../shared/messages';
import type { ExecutionLayer, LanguageCode, PandaMode } from '../shared/types';
import { PandaEmblem } from './PandaEmblem';
import { DiscoveryPanel } from '../features/discovery/DiscoveryPanel';
import { ComparePanel } from '../features/compare/ComparePanel';
import { FormsPanel } from '../features/forms/FormsPanel';
import { ReplayPanel } from '../features/replay/ReplayPanel';
import { getRecBuffer } from '../features/replay/replayEngine';

const MODE_TABS: { id: PandaMode; label: string }[] = [
  { id: 'discovery', label: 'Spotlight' },
  { id: 'compare', label: 'Compare' },
  { id: 'forms', label: 'Forms' },
  { id: 'replay', label: 'Replay' },
];

const LAYER_LABELS: Record<ExecutionLayer, string> = {
  LAYER_A_STRUCTURED: 'Layer A: Structured (0 Tokens)',
  LAYER_B_CACHED: 'Layer B: Cached Replay (0 Tokens)',
  LAYER_C_DOM: 'Layer C: Viewport DOM',
  LAYER_D_VISION: 'Layer D: Vision Fallback',
};

interface SpeechRecognitionEventLike {
  results: { [index: number]: { [index: number]: { transcript: string } } };
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

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname || 'New Tab';
  } catch {
    return 'Active Tab';
  }
}

function autoDetectMode(url: string): PandaMode {
  const lower = url.toLowerCase();
  if (lower.includes('lms.') || lower.includes('moodle')) return 'replay';
  if (lower.includes('apply') || lower.includes('register') || lower.includes('form')) return 'forms';
  if (lower.includes('pricing') || lower.includes('plans') || lower.includes('shop')) return 'compare';
  return 'discovery';
}

export function App() {
  const [activeMode, setActiveMode] = useState<PandaMode>('discovery');
  const [executionLayer, setExecutionLayer] = useState<ExecutionLayer>('LAYER_A_STRUCTURED');
  const [language, setLanguage] = useState<LanguageCode>('EN');
  const [activeUrl, setActiveUrl] = useState<string>('');
  const [activeTitle, setActiveTitle] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const isReplayingRef = useRef(false);

  // Sync active tab metadata on mount + listen for live tab switches from service worker
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.tabs?.query) return;

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      const rec = await getRecBuffer().catch(() => null);
      if (tab?.url) {
        setActiveUrl(tab.url);
        setActiveTitle(tab.title ?? '');
        setActiveMode(rec?.active ? 'replay' : autoDetectMode(tab.url));
      } else if (rec?.active) {
        setActiveMode('replay');
      }
    });

    const handleRuntimeMessage = (message: PandaMessage) => {
      if (message?.type === 'ACTIVE_TAB_UPDATED') {
        setActiveUrl(message.payload.url);
        setActiveTitle(message.payload.title);
        if (message.payload.url && !isReplayingRef.current) {
          getRecBuffer()
            .then((rec) => {
              if (!rec.active && !isReplayingRef.current) {
                setActiveMode(autoDetectMode(message.payload.url));
              }
            })
            .catch(() => {
              if (!isReplayingRef.current) {
                setActiveMode(autoDetectMode(message.payload.url));
              }
            });
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    return () => chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
  }, []);

  // Update telemetry layer cleanly as modes change
  useEffect(() => {
    if (activeMode === 'discovery' || activeMode === 'compare') {
      setExecutionLayer('LAYER_A_STRUCTURED');
    } else if (activeMode === 'forms') {
      setExecutionLayer('LAYER_C_DOM');
    } else {
      setExecutionLayer('LAYER_B_CACHED');
    }
  }, [activeMode]);

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = prompt.trim();
    if (!cleaned) return;
    setLastCommand(cleaned);
    const lower = cleaned.toLowerCase();
    if (lower.includes('compare') || lower.includes('tab') || lower.includes('price')) {
      setActiveMode('compare');
    } else if (lower.includes('form') || lower.includes('fill') || lower.includes('persona')) {
      setActiveMode('forms');
    } else if (lower.includes('replay') || lower.includes('workflow') || lower.includes('lms')) {
      setActiveMode('replay');
    } else {
      setActiveMode('discovery');
    }
    setPrompt('');
  };

  const handleToggleVoice = () => {
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
      setLastCommand('Web Speech API not available in this browser context.');
      return;
    }

    const rec = new SpeechRec();
    rec.lang = language === 'TA' ? 'ta-IN' : language === 'HI' ? 'hi-IN' : 'en-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? '';
      if (transcript) {
        setPrompt(transcript);
        setLastCommand(`Voice (${rec.lang}): "${transcript}"`);
      }
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  };

  return (
    <div className="flex h-screen w-full flex-col bg-[#F8F9FC] text-[#1E1B4B] overflow-hidden">
      {/* Persistent Header */}
      <header className="bg-white border-b border-[#E2E8F0] px-4 py-3 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <PandaEmblem size={26} />
            <span className="text-sm font-extrabold tracking-tight text-[#1E1B4B]">PandaPilot</span>
          </div>

          <div
            title={activeTitle || activeUrl}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#E2E8F0] bg-[#F8F9FC] px-2.5 py-1 text-[10px] font-semibold text-[#475569] max-w-[200px]"
          >
            <Globe className="h-3 w-3 text-[#331E6D] shrink-0" />
            <span className="truncate">{hostnameFromUrl(activeUrl)}</span>
            <span className="rounded bg-[#F3F0FF] px-1.5 py-0.2 text-[9px] font-bold text-[#331E6D] uppercase shrink-0">
              {activeMode}
            </span>
          </div>
        </div>

        {/* 4 Clean Mode Tabs */}
        <nav className="grid grid-cols-4 gap-1 rounded-xl bg-[#F1F5F9] p-1">
          {MODE_TABS.map((tab) => {
            const isActive = activeMode === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveMode(tab.id)}
                className={`rounded-lg py-1.5 text-[11px] font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-[#331E6D] shadow-xs font-bold'
                    : 'text-[#475569] hover:text-[#1E1B4B]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Persistent Multilingual Text + Voice Bar */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 py-2.5 space-y-2 shrink-0">
        <form onSubmit={handlePromptSubmit} className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                language === 'TA'
                  ? 'தமிழ் / Tanglish-ல் கேளுங்கள்...'
                  : language === 'HI'
                    ? 'हिंदी में पूछें...'
                    : 'Ask PandaPilot about this tab...'
              }
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8F9FC] pl-3 pr-8 py-1.5 text-xs text-[#1E1B4B] placeholder:text-[#94A3B8] focus:border-[#331E6D] focus:bg-white focus:outline-none"
            />
            <button
              type="submit"
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#331E6D] hover:bg-[#331E6D]/10 cursor-pointer"
              title="Send Command"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={handleToggleVoice}
            title="Web Speech API Voice Input"
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
            {(['EN', 'HI', 'TA'] as LanguageCode[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLanguage(code)}
                className={`rounded-md px-2 py-0.5 transition-all cursor-pointer ${
                  language === code
                    ? 'bg-white text-[#331E6D] shadow-xs font-bold'
                    : 'text-[#64748B] hover:text-[#1E1B4B]'
                }`}
              >
                {code}
              </button>
            ))}
          </div>

          {lastCommand && (
            <span className="truncate text-[10px] font-medium text-[#331E6D] max-w-[180px]">
              {lastCommand}
            </span>
          )}
        </div>
      </div>

      {/* Active Feature Panel */}
      <main className="flex-1 overflow-y-auto p-4">
        {activeMode === 'discovery' && (
          <DiscoveryPanel language={language} onLayerChange={setExecutionLayer} />
        )}
        {activeMode === 'compare' && <ComparePanel onLayerChange={setExecutionLayer} />}
        {activeMode === 'forms' && <FormsPanel onLayerChange={setExecutionLayer} />}
        {activeMode === 'replay' && (
          <ReplayPanel
            onLayerChange={setExecutionLayer}
            onReplayingChange={(v) => {
              isReplayingRef.current = v;
            }}
          />
        )}
      </main>

      {/* Persistent Telemetry Footer */}
      <footer className="bg-white border-t border-[#E2E8F0] px-3.5 py-2.5 flex items-center justify-between gap-2 shrink-0">
        <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#475569] min-w-0">
          <Layers className="h-3.5 w-3.5 text-[#331E6D] shrink-0" />
          <span className="truncate">{LAYER_LABELS[executionLayer]}</span>
        </div>

        <span className="inline-flex items-center gap-1 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-0.5 text-[10px] font-bold text-[#059669] shrink-0">
          <ShieldCheck className="h-3 w-3" />
          Zero PII Sent • Local Vault
        </span>
      </footer>
    </div>
  );
}

export default App;
