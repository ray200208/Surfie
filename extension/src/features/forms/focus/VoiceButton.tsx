import { useEffect, useRef, useState } from 'react';
import type { LanguageCode } from '../../../shared/types';
import { FOCUS_LANGUAGES } from './constants';

export interface VoiceButtonProps {
  language: LanguageCode;
  onLanguageChange: (language: LanguageCode) => void;
  onTranscript?: (text: string) => void;
}

export default function VoiceButton({ language, onLanguageChange }: VoiceButtonProps) {
  const [showNotice, setShowNotice] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
  }, []);

  const handleVoiceClick = () => {
    // TODO: Plug a future speech handler in here; this prototype never records audio.
    setShowNotice(true);
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setShowNotice(false);
      timeoutRef.current = null;
    }, 4000);
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={handleVoiceClick}
        aria-label="Voice input"
        title="Voice input"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#331E6D] transition hover:bg-[#F8F9FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#331E6D]/40"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
          <rect x="9" y="3" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="2" />
          <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3m-4 0h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <label htmlFor="focus-language" className="sr-only">Voice language</label>
      <select
        id="focus-language"
        value={language}
        onChange={(event) => onLanguageChange(event.target.value as LanguageCode)}
        className="h-8 rounded-lg border border-[#E2E8F0] bg-white px-2 text-[10px] font-semibold text-[#475569] outline-none focus:border-[#331E6D] focus:ring-2 focus:ring-[#331E6D]/20"
      >
        {FOCUS_LANGUAGES.map((item) => (
          <option key={item.code} value={item.code}>{item.label}</option>
        ))}
      </select>
      {showNotice && (
        <p
          role="status"
          aria-live="polite"
          className="basis-full rounded-lg bg-[#F1F5F9] px-2.5 py-1.5 text-[10px] leading-relaxed text-[#475569]"
        >
          Voice input is coming soon. Supported languages: English, Hindi, Tamil.
        </p>
      )}
    </div>
  );
}
