import React, { useState } from 'react';
import { Sparkles, Eraser, CheckCircle2, AlertTriangle, Globe } from 'lucide-react';
import { sendToActiveTab } from '../../shared/messages';
import type { ExecutionLayer, LanguageCode, PageContext } from '../../shared/types';

interface DiscoveryPanelProps {
  language: LanguageCode;
  onLayerChange: (layer: ExecutionLayer) => void;
}

export const DiscoveryPanel: React.FC<DiscoveryPanelProps> = ({ language, onLayerChange }) => {
  const [pageContext, setPageContext] = useState<PageContext | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePingAndSpotlight = async () => {
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);
    onLayerChange('LAYER_A_STRUCTURED');

    try {
      const ctx = await sendToActiveTab({ type: 'PING_PAGE' });
      setPageContext(ctx);

      const spotlightLabel =
        language === 'TA'
          ? 'PandaPilot வழிகாட்டி: இங்கே கவனிக்கவும்!'
          : language === 'HI'
            ? 'PandaPilot गाइड: यहाँ क्लिक करें!'
            : 'PandaPilot Spotlight: Verified target on this page';

      const hl = await sendToActiveTab({
        type: 'HIGHLIGHT_ELEMENT',
        payload: {
          selector: 'h1, button, a[href]',
          message: spotlightLabel,
          variant: 'spotlight',
        },
      });

      if (hl.ok) {
        setStatusMessage(`Highlighted "${hl.matchedSelector}" via Shadow DOM.`);
      } else {
        setErrorMessage(hl.error ?? 'Could not find a visible heading or button to spotlight.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to reach active tab.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearOverlay = async () => {
    setErrorMessage(null);
    try {
      await sendToActiveTab({ type: 'CLEAR_HIGHLIGHTS' });
      setStatusMessage('Cleared PandaPilot Shadow DOM overlay.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to clear overlay.');
    }
  };

  return (
    <div className="space-y-3.5">
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs space-y-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#331E6D]">
            Mode 1 • Teammate 1 (Discovery &amp; Spotlight)
          </span>
          <h2 className="text-sm font-bold text-[#1E1B4B] mt-0.5">
            Guided Spotlight &amp; Page Inspector
          </h2>
          <p className="text-[11px] text-[#475569] mt-0.5">
            Ping the live webpage and draw an isolated Shadow DOM spotlight ring onto the first visible heading or button.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePingAndSpotlight}
            disabled={loading}
            className="pp-cta-gradient flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white shadow-sm cursor-pointer disabled:opacity-65"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {loading ? 'Pinging Tab...' : 'Ping Active Page & Test Spotlight'}
          </button>

          <button
            onClick={handleClearOverlay}
            className="inline-flex items-center gap-1 rounded-xl border border-[#E2E8F0] bg-[#F8F9FC] px-3 py-2 text-xs font-semibold text-[#475569] hover:bg-[#F1F5F9] cursor-pointer"
          >
            <Eraser className="h-3.5 w-3.5" />
            Clear Overlay
          </button>
        </div>

        {statusMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-3 py-2 text-[11px] font-semibold text-[#059669]">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[11px] font-semibold text-[#D97706]">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {pageContext && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1E1B4B]">
              <Globe className="h-3.5 w-3.5 text-[#331E6D]" />
              Live PageContext
            </span>
            <span className="rounded-full bg-[#F3F0FF] px-2 py-0.5 text-[10px] font-bold text-[#331E6D] uppercase">
              {pageContext.detectedDomainType}
            </span>
          </div>
          <div className="text-xs font-semibold text-[#1E1B4B] truncate">{pageContext.title}</div>
          <div className="font-mono text-[10px] text-[#64748B] truncate">{pageContext.url}</div>
          <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
            <div className="rounded-lg bg-[#F8F9FC] border border-[#E2E8F0] px-2.5 py-1.5">
              Visible Inputs: <strong className="text-[#1E1B4B]">{pageContext.inputCount}</strong>
            </div>
            <div className="rounded-lg bg-[#F8F9FC] border border-[#E2E8F0] px-2.5 py-1.5">
              Form Detected:{' '}
              <strong className="text-[#059669]">{pageContext.hasForm ? 'Yes' : 'No'}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
