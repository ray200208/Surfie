import React, { useState } from 'react';
import {
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  MapPin,
  Eye,
  ArrowRight,
  ExternalLink,
  Search,
  MessageSquare,
} from 'lucide-react';
import { DISCOVERY_ALTERNATIVES, SPOTLIGHT_STEPS } from '../../data/mockData';
import { BrowserTabId, LanguageCode } from '../../types';

interface ModeDiscoveryProps {
  activeTabId: BrowserTabId;
  language: LanguageCode;
  spotlightEnabled: boolean;
  spotlightStep: number;
  onToggleSpotlight: (enabled: boolean) => void;
  onSelectSpotlightStep: (step: number) => void;
  paywallChatOpen: boolean;
  onTogglePaywallChat: (open: boolean) => void;
  onJumpToAnchor: (tabId: BrowserTabId, anchorId: string) => void;
}

export const ModeDiscovery: React.FC<ModeDiscoveryProps> = ({
  activeTabId,
  language,
  spotlightEnabled,
  spotlightStep,
  onToggleSpotlight,
  onSelectSpotlightStep,
  paywallChatOpen,
  onTogglePaywallChat,
  onJumpToAnchor,
}) => {
  const [followUpAnswer, setFollowUpAnswer] = useState<string | null>(null);
  const isPortalPage = activeTabId === 'portal-guide';

  const handleToggleSpotlightClick = () => {
    const next = !spotlightEnabled;
    onToggleSpotlight(next);
    if (next) {
      onJumpToAnchor('portal-guide', `guide-step-${spotlightStep}`);
    }
  };

  // Context-aware view: On the Scholarship Portal tab, show ONLY the calm Guided Spotlight flow
  if (isPortalPage) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-xs space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F3F0FF] text-[#331E6D]">
                <Eye className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#1E1B4B]">Guided Spotlight</h2>
                <p className="text-[11px] text-[#64748B]">
                  Hides page clutter and guides you step by step
                </p>
              </div>
            </div>

            <button
              onClick={handleToggleSpotlightClick}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer shrink-0 ${
                spotlightEnabled
                  ? 'pp-cta-gradient text-white shadow-sm'
                  : 'bg-[#331E6D] text-white hover:bg-[#271556]'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {spotlightEnabled ? 'On' : 'Start Guide'}
            </button>
          </div>

          <div className="space-y-2 pt-1">
            {SPOTLIGHT_STEPS.map((s) => {
              const isCurrent = spotlightEnabled && spotlightStep === s.step;
              const title =
                language === 'TA' ? s.titleTa : language === 'HI' ? s.titleHi : s.titleEn;
              const desc =
                language === 'TA' ? s.descTa : language === 'HI' ? s.descHi : s.descEn;

              return (
                <button
                  key={s.step}
                  onClick={() => {
                    onToggleSpotlight(true);
                    onSelectSpotlightStep(s.step);
                    onJumpToAnchor(s.tabId, s.anchorId);
                  }}
                  className={`w-full text-left rounded-xl border p-3 transition-all cursor-pointer ${
                    isCurrent
                      ? 'border-[#331E6D] bg-[#F3F0FF]/80 ring-1 ring-[#331E6D]/20'
                      : 'border-[#E2E8F0] bg-[#F8F9FC] hover:border-[#331E6D]/35 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#1E1B4B]">{title}</span>
                    <ArrowRight
                      className={`h-3.5 w-3.5 shrink-0 ${
                        isCurrent ? 'text-[#331E6D]' : 'text-[#94A3B8]'
                      }`}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-[#475569] leading-relaxed">{desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Context-aware view: On Google Search or SlideCraft AI
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#FDE68A] bg-white p-4 shadow-xs space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-[#D97706]">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1E1B4B]">Paywall Alert</h2>
              <p className="text-[11px] text-[#64748B]">
                {activeTabId === 'slidecraft-tool'
                  ? 'Hidden limits detected on SlideCraft AI'
                  : 'Verified free picks for your search'}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-[#FFFBEB]/75 border border-[#FDE68A] p-3 text-xs text-[#92400E] flex items-center justify-between gap-2">
          <span className="leading-snug">
            <strong>SlideCraft AI</strong> caps free exports at 3 slides and adds watermarks.
          </span>
          <button
            onClick={() => onJumpToAnchor('slidecraft-tool', 'slidecraft-free-trap')}
            className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-white border border-[#FDE68A] px-2 py-1 text-[10px] font-bold text-[#D97706] hover:bg-[#FFFBEB] cursor-pointer"
          >
            <MapPin className="h-3 w-3" /> Show
          </button>
        </div>

        {/* Before clicking "Click to chat": clean button to open the comparison chat */}
        {!paywallChatOpen ? (
          <button
            onClick={() => onTogglePaywallChat(true)}
            className="pp-cta-gradient w-full inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white shadow-sm cursor-pointer"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Compare 2 Free Alternatives
          </button>
        ) : (
          /* Opened Comparison Chat View (triggers visibly when user clicks "Click to chat") */
          <div className="space-y-3 pt-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="rounded-xl bg-[#F3F0FF] border border-[#331E6D]/15 p-3 text-xs text-[#1E1B4B] leading-relaxed">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#331E6D] mb-1">
                Surfie Comparison
              </div>
              Skip SlideCraft AI&apos;s ₹1,499/mo paywall — here are <strong>2 genuinely free</strong> tools with unlimited exports and zero watermarks:
            </div>

            {DISCOVERY_ALTERNATIVES.map((alt) => (
              <div
                key={alt.id}
                className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5]/60 p-3 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#065F46]">{alt.name}</span>
                  <span className="rounded-full bg-[#059669] px-2 py-0.5 text-[10px] font-bold text-white shrink-0">
                    {alt.costBadge}
                  </span>
                </div>
                <p className="text-[11px] text-[#047857]">{alt.exportLimit}</p>
                <div className="flex items-center justify-between pt-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#065F46]">
                    <CheckCircle2 className="h-3 w-3" /> {alt.verdict}
                  </span>
                  <button
                    onClick={() => onJumpToAnchor(alt.tabId, alt.anchorId)}
                    className="inline-flex items-center gap-1 rounded-lg bg-white border border-[#A7F3D0] px-2 py-0.5 text-[10px] font-bold text-[#059669] hover:bg-[#D1FAE5] cursor-pointer"
                  >
                    <ExternalLink className="h-2.5 w-2.5" /> View
                  </button>
                </div>
              </div>
            ))}

            {/* Interactive Quick Follow-Up Chips */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[10px] font-semibold text-[#64748B]">Quick follow-up:</div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() =>
                    setFollowUpAnswer(
                      'Canva for Education unlocks automatically when you sign in with your @ssn.edu.in college email — zero credit card required.'
                    )
                  }
                  className="rounded-full border border-[#E2E8F0] bg-[#F8F9FC] px-2.5 py-1 text-[10px] font-semibold text-[#331E6D] hover:border-[#331E6D]/40 cursor-pointer"
                >
                  Does Canva work with .edu.in?
                </button>
                <button
                  onClick={() =>
                    setFollowUpAnswer(
                      'Marp runs 100% locally in VS Code or CLI — zero signup, zero internet required, and exports crisp PPTX/PDF decks.'
                    )
                  }
                  className="rounded-full border border-[#E2E8F0] bg-[#F8F9FC] px-2.5 py-1 text-[10px] font-semibold text-[#331E6D] hover:border-[#331E6D]/40 cursor-pointer"
                >
                  Which needs zero signup?
                </button>
              </div>
              {followUpAnswer && (
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8F9FC] p-2.5 text-[11px] text-[#1E1B4B]">
                  {followUpAnswer}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[#E2E8F0] bg-white/70 px-3.5 py-2.5 flex items-center gap-2 text-[11px] text-[#64748B]">
        <Search className="h-3.5 w-3.5 text-[#331E6D] shrink-0" />
        Switch to the Scholarship Guide tab to try Guided Spotlight.
      </div>
    </div>
  );
};
