import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  LayoutGrid,
  Network,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { PandaEmblem } from '../../sidepanel/PandaEmblem';
import {
  COMPARE_SESSION_STORAGE_KEY,
  loadCompareSession,
  saveCompareSession,
} from './apiClient';
import type { CompareSessionState, WhiteboardOption } from './compareTypes';
import { DEMO_SCENARIOS } from './demoScenarios';
import { RecommendedDecisionCard } from './RecommendedDecisionCard';
import { closeScannedTabs } from './sitePlanner';
import { jumpAndHighlightTab } from './tabExtractor';
import {
  computeRecommendedDecision,
  formatMoney,
  recalculateOptionCost,
} from './trueCostEngine';
import { WhiteboardCanvas } from './WhiteboardCanvas';

export const FullWhiteboardPage: React.FC = () => {
  const [session, setSession] = useState<CompareSessionState | null>(null);
  const [viewMode, setViewMode] = useState<'canvas' | 'matrix'>('canvas');
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const saved = await loadCompareSession();
      if (saved) {
        setSession(saved);
        setSelectedOptionId(saved.recommendation.winnerId);
      } else {
        setSession(DEMO_SCENARIOS[0].session);
        setSelectedOptionId(DEMO_SCENARIOS[0].session.recommendation.winnerId);
      }
    })();

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      const listener = (
        changes: Record<string, chrome.storage.StorageChange>,
        areaName: string
      ) => {
        if (areaName === 'local' && changes[COMPARE_SESSION_STORAGE_KEY]?.newValue) {
          const updated = changes[COMPARE_SESSION_STORAGE_KEY].newValue as CompareSessionState;
          setSession(updated);
        }
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    }
    return undefined;
  }, []);

  const persist = useCallback(async (next: CompareSessionState) => {
    setSession(next);
    await saveCompareSession(next);
  }, []);

  const handleToggleAddon = async (optionId: string) => {
    if (!session) return;
    const recalculated = session.options.map((opt) =>
      opt.id === optionId ? recalculateOptionCost(opt, !opt.addonEnabled) : opt
    );
    const { options, recommendation } = computeRecommendedDecision(recalculated, session.answers);
    await persist({ ...session, options, recommendation, updatedAt: new Date().toISOString() });
  };

  const handleJump = async (
    option: WhiteboardOption,
    selector: string,
    message: string,
    variant: 'spotlight' | 'warning' | 'success'
  ) => {
    const res = await jumpAndHighlightTab(option.tabId, option.url, selector, message, variant);
    setStatusNote(res.note || `Switched to ${option.domain} and highlighted source element.`);
  };

  const handleCloseTabs = async () => {
    if (!session?.openedTabIds.length) return;
    await closeScannedTabs(session.openedTabIds);
    await persist({ ...session, openedTabIds: [] });
    setStatusNote('Closed background comparison tabs.');
  };

  const winnerOption = useMemo(
    () => session?.options.find((o) => o.id === session.recommendation.winnerId),
    [session]
  );

  const selectedOption = useMemo(
    () =>
      session?.options.find((o) => o.id === selectedOptionId) ??
      winnerOption ??
      session?.options[0] ??
      null,
    [session, selectedOptionId, winnerOption]
  );

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FC] text-sm font-semibold text-[#475569]">
        Loading PandaPilot Visual Whiteboard...
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#F8F9FC] text-[#1E1B4B] overflow-hidden">
      {/* Top Bar */}
      <header className="bg-white border-b border-[#E2E8F0] px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <PandaEmblem size={30} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-tight text-[#1E1B4B] truncate">
                {session.normalizedGoal || session.prompt}
              </h1>
              <span className="rounded-full bg-[#F3F0FF] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#331E6D]">
                {session.category}
              </span>
            </div>
            <p className="text-xs text-[#64748B] truncate">
              {session.poweredBy} • Zero PII Sent • Deterministic True-Cost &amp; Dark-Pattern Engine
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-[#F1F5F9] p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('canvas')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 cursor-pointer ${
                viewMode === 'canvas' ? 'bg-white text-[#331E6D] shadow-xs font-bold' : 'text-[#64748B]'
              }`}
            >
              <Network className="h-3.5 w-3.5" /> Whiteboard Map
            </button>
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 cursor-pointer ${
                viewMode === 'matrix' ? 'bg-white text-[#331E6D] shadow-xs font-bold' : 'text-[#64748B]'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Side-by-Side Matrix
            </button>
          </div>

          {session.openedTabIds.length > 0 && (
            <button
              type="button"
              onClick={() => void handleCloseTabs()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-1.5 text-xs font-bold text-[#DC2626] hover:bg-[#FEE2E2] cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" /> Close {session.openedTabIds.length} Scanned Tabs
            </button>
          )}
        </div>
      </header>

      {/* Main Split Workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 overflow-hidden">
        {/* Left/Main Whiteboard Area */}
        <div className="lg:col-span-8 flex flex-col gap-3 overflow-hidden">
          <RecommendedDecisionCard
            recommendation={session.recommendation}
            winnerOption={winnerOption}
            onOpenWinner={(opt) =>
              void handleJump(opt, opt.sourceSelector, `Winner: ${opt.name}`, 'success')
            }
          />

          {statusNote && (
            <div className="rounded-xl border border-[#DDD6FE] bg-[#F3F0FF] px-3.5 py-2 text-xs font-semibold text-[#331E6D] shrink-0">
              {statusNote}
            </div>
          )}

          {viewMode === 'canvas' ? (
            <div className="flex-1 min-h-0">
              <WhiteboardCanvas
                session={session}
                compact={false}
                onToggleAddon={(id) => void handleToggleAddon(id)}
                onJumpToAnchor={(opt, sel, msg, variant) => void handleJump(opt, sel, msg, variant)}
                onSelectOption={(opt) => setSelectedOptionId(opt.id)}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-auto rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                    <th className="py-2.5 pr-4 font-bold">Option</th>
                    <th className="py-2.5 pr-4 font-bold">True Total</th>
                    <th className="py-2.5 pr-4 font-bold">Base / Fees</th>
                    <th className="py-2.5 pr-4 font-bold">Policy / Contract</th>
                    <th className="py-2.5 font-bold">Dark Patterns</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {session.options.map((opt) => {
                    const isWinner = opt.id === session.recommendation.winnerId;
                    return (
                      <tr
                        key={opt.id}
                        onClick={() => setSelectedOptionId(opt.id)}
                        className={`cursor-pointer hover:bg-[#F8F9FC] ${
                          isWinner ? 'bg-[#ECFDF5]/40' : ''
                        }`}
                      >
                        <td className="py-3 pr-4">
                          <div className="font-extrabold text-[#1E1B4B]">{opt.name}</div>
                          <div className="font-mono text-[10px] text-[#64748B]">{opt.domain}</div>
                        </td>
                        <td className="py-3 pr-4 font-extrabold text-[#331E6D]">
                          {formatMoney(opt.totalCost, opt.currency)}
                          {opt.effectiveMonthly !== null && (
                            <div className="text-[10px] font-normal text-[#64748B]">
                              {formatMoney(opt.effectiveMonthly, opt.currency)}/mo
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-[#475569]">
                          Base: {formatMoney(opt.basePrice, opt.currency)}
                          {opt.setupFee > 0 && <div>Setup: {formatMoney(opt.setupFee, opt.currency)}</div>}
                          {opt.lateOrShippingFee > 0 && (
                            <div>Extra fee: {formatMoney(opt.lateOrShippingFee, opt.currency)}</div>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {opt.contractOrPolicy || (
                            <span className="italic font-semibold text-[#D97706]">
                              Not stated on this page
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          {opt.darkPatterns.length === 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-bold text-[#059669]">
                              <CheckCircle2 className="h-3 w-3" /> Clean
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#FFFBEB] px-2 py-0.5 text-[10px] font-bold text-[#D97706]">
                              <AlertTriangle className="h-3 w-3" /> {opt.darkPatterns.length} Warning(s)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right-Hand Option Inspector & Firewall Sidebar */}
        <aside className="lg:col-span-4 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-xs overflow-y-auto space-y-4">
          {selectedOption ? (
            <>
              <div className="flex items-start justify-between gap-2 border-b border-[#E2E8F0] pb-3">
                <div>
                  <span className="rounded-full bg-[#F3F0FF] px-2.5 py-0.5 text-[10px] font-bold text-[#331E6D]">
                    {selectedOption.badge}
                  </span>
                  <h2 className="mt-1.5 text-base font-extrabold text-[#1E1B4B]">
                    {selectedOption.name}
                  </h2>
                  <p className="font-mono text-xs text-[#64748B]">{selectedOption.domain}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void handleJump(
                      selectedOption,
                      selectedOption.sourceSelector,
                      `${selectedOption.name}`,
                      'spotlight'
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-xl bg-[#331E6D] px-3 py-1.5 text-xs font-bold text-white cursor-pointer shrink-0"
                >
                  Open Tab <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="rounded-xl bg-[#F8F9FC] border border-[#E2E8F0] p-3 space-y-1.5 text-xs">
                <div className="font-bold text-[#1E1B4B]">Deterministic Cost Breakdown</div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Base Price ({selectedOption.billingCycle}):</span>
                  <span className="font-semibold">
                    {formatMoney(selectedOption.basePrice, selectedOption.currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Setup / Installation Fee:</span>
                  <span className="font-semibold">
                    {formatMoney(selectedOption.setupFee, selectedOption.currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Shipping / Convenience Fee:</span>
                  <span className="font-semibold">
                    {formatMoney(selectedOption.lateOrShippingFee, selectedOption.currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Optional Add-on:</span>
                  <span className="font-semibold">
                    {selectedOption.addonEnabled
                      ? formatMoney(selectedOption.addonCost, selectedOption.currency)
                      : 'Excluded (₹0)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Tax / GST:</span>
                  <span className="font-semibold">{selectedOption.taxPercent}%</span>
                </div>
                <div className="border-t border-[#E2E8F0] pt-1.5 flex justify-between font-extrabold text-[#331E6D]">
                  <span>Normalized True Total:</span>
                  <span>{formatMoney(selectedOption.totalCost, selectedOption.currency)}</span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="font-bold text-[#1E1B4B]">Extracted Specifications</div>
                {Object.entries(selectedOption.specs).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between gap-2 rounded-lg bg-[#F8F9FC] px-2.5 py-1.5"
                  >
                    <span className="text-[#64748B]">{k}</span>
                    <span className="font-semibold text-[#1E1B4B]">{v || 'Not stated'}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {session.quarantinedInjections.length > 0 && (
            <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-[#DC2626]">
                <ShieldAlert className="h-4 w-4" />
                Quarantined Prompt Injections ({session.quarantinedInjections.length})
              </div>
              {session.quarantinedInjections.map((inj) => (
                <div key={inj.id} className="rounded-lg bg-white border border-[#FECACA] p-2">
                  <div className="font-mono text-[10px] text-[#991B1B]">&quot;{inj.snippet}&quot;</div>
                  <div className="mt-1 text-[10px] text-[#7F1D1D]">{inj.reason}</div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
