import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Globe,
  Loader2,
  Maximize2,
  Plus,
  RefreshCw,
  RotateCcw,
  Server,
  Settings2,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { ExecutionLayer } from '../../shared/types';
import {
  checkBackendHealth,
  DEFAULT_BACKEND_URL,
  getBackendUrl,
  loadCompareSession,
  requestAnalyze,
  requestClarify,
  saveBackendUrl,
  saveCompareSession,
} from './apiClient';
import type {
  BackendHealth,
  ClarifyingQuestion,
  CompareCategory,
  CompareEntryMode,
  CompareFlowStep,
  CompareSessionState,
  RawTabExtraction,
  SiteCandidate,
  WhiteboardOption,
} from './compareTypes';
import { DEMO_SCENARIOS } from './demoScenarios';
import { RecommendedDecisionCard } from './RecommendedDecisionCard';
import { closeScannedTabs, detectCategory, openAndScanSites } from './sitePlanner';
import { extractFromTab, jumpAndHighlightTab } from './tabExtractor';
import { computeRecommendedDecision, recalculateOptionCost } from './trueCostEngine';
import { WhiteboardCanvas } from './WhiteboardCanvas';

interface ComparePanelProps {
  onLayerChange: (layer: ExecutionLayer) => void;
}

interface OpenTabItem {
  id: number;
  title: string;
  url: string;
}

interface ScanProgressItem {
  siteId: string;
  label: string;
  step: string;
  done: boolean;
}

export const ComparePanel: React.FC<ComparePanelProps> = ({ onLayerChange }) => {
  const [entryMode, setEntryMode] = useState<CompareEntryMode>('ask');
  const [flowStep, setFlowStep] = useState<CompareFlowStep>('input');

  // Backend status & settings
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  const [backendUrlInput, setBackendUrlInput] = useState(DEFAULT_BACKEND_URL);
  const [health, setHealth] = useState<BackendHealth>({ online: false, geminiConfigured: false });
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Ask & Browse state
  const [prompt, setPrompt] = useState('');
  const [category, setCategory] = useState<CompareCategory>('product');
  const [normalizedGoal, setNormalizedGoal] = useState('');
  const [questions, setQuestions] = useState<ClarifyingQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [sites, setSites] = useState<SiteCandidate[]>([]);
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
  const [customSiteUrl, setCustomSiteUrl] = useState('');
  const [poweredBy, setPoweredBy] = useState('Local Deterministic Engine');

  // Open Tabs state
  const [openTabs, setOpenTabs] = useState<OpenTabItem[]>([]);
  const [selectedTabIds, setSelectedTabIds] = useState<number[]>([]);
  const [loadingTabs, setLoadingTabs] = useState(false);

  // Scanning & Results
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<ScanProgressItem[]>([]);
  const [session, setSession] = useState<CompareSessionState | null>(null);
  const [firewallDrawerOpen, setFirewallDrawerOpen] = useState(false);
  const [anchorNote, setAnchorNote] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);

  const refreshHealth = useCallback(async (urlToTest: string) => {
    const res = await checkBackendHealth(urlToTest);
    setHealth(res);
  }, []);

  const loadOpenTabs = useCallback(() => {
    if (typeof chrome === 'undefined' || !chrome.tabs?.query) return;
    setLoadingTabs(true);
    chrome.tabs.query({ currentWindow: true }, (found) => {
      const normalized: OpenTabItem[] = found
        .filter((t): t is chrome.tabs.Tab & { id: number } => typeof t.id === 'number')
        .map((t) => ({
          id: t.id,
          title: t.title || t.url || 'Untitled Tab',
          url: t.url || '',
        }));
      setOpenTabs(normalized);
      setLoadingTabs(false);
    });
  }, []);

  useEffect(() => {
    onLayerChange('LAYER_A_STRUCTURED');
    loadOpenTabs();
    void (async () => {
      const url = await getBackendUrl();
      setBackendUrl(url);
      setBackendUrlInput(url);
      await refreshHealth(url);
      const saved = await loadCompareSession();
      if (saved) {
        setSession(saved);
        setFlowStep('whiteboard');
      }
    })();
  }, [loadOpenTabs, onLayerChange, refreshHealth]);

  const persistSession = useCallback(
    async (next: CompareSessionState) => {
      setSession(next);
      onLayerChange(next.executionLayer);
      await saveCompareSession(next);
    },
    [onLayerChange]
  );

  const handleSaveBackendUrl = async () => {
    const saved = await saveBackendUrl(backendUrlInput);
    setBackendUrl(saved);
    await refreshHealth(saved);
    setSettingsOpen(false);
  };

  const handleLoadDemo = async (presetKey: (typeof DEMO_SCENARIOS)[number]['key']) => {
    const found = DEMO_SCENARIOS.find((d) => d.key === presetKey);
    if (!found) return;
    setAnchorNote(null);
    setFirewallDrawerOpen(false);
    await persistSession({ ...found.session, updatedAt: new Date().toISOString() });
    setEntryMode('ask');
    setFlowStep('whiteboard');
  };

  const handleStartClarify = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = prompt.trim();
    if (!cleaned) return;
    setBusyMessage('Planning clarifying questions & candidate sites...');
    setAnchorNote(null);
    setFallbackNotice(null);

    const plan = await requestClarify(
      cleaned,
      openTabs.map((t) => t.title),
      backendUrl
    );
    if (plan.fallbackReason) {
      setFallbackNotice(plan.fallbackReason);
    }
    setCategory(plan.category);
    setNormalizedGoal(plan.normalizedGoal);
    setQuestions(plan.questions);
    const defaultAnswers: Record<string, string> = {};
    for (const q of plan.questions) {
      defaultAnswers[q.id] = q.chips[0] ?? '';
    }
    setAnswers(defaultAnswers);
    setSites(plan.suggestedSites);
    setSelectedSiteIds(plan.suggestedSites.filter((s) => s.defaultSelected).map((s) => s.id));
    setPoweredBy(plan.poweredBy);
    setBusyMessage(null);
    setFlowStep('clarify');
  };

  const applySiteCountPreset = (count: 3 | 5) => {
    setSelectedSiteIds(sites.slice(0, count).map((s) => s.id));
  };

  const handleAddCustomSite = () => {
    let raw = customSiteUrl.trim();
    if (!raw) return;
    if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
    try {
      const parsed = new URL(raw);
      const id = `custom-${Date.now()}`;
      const added: SiteCandidate = {
        id,
        name: parsed.hostname,
        domain: parsed.hostname,
        url: parsed.toString(),
        reason: 'User-approved custom site',
        defaultSelected: true,
      };
      setSites((prev) => [...prev, added]);
      setSelectedSiteIds((prev) => [...prev, id]);
      setCustomSiteUrl('');
    } catch {
      setAnchorNote('Please enter a valid website URL (e.g., https://example.com).');
    }
  };

  const finalizeAnalysis = async (
    goalPrompt: string,
    targetCategory: CompareCategory,
    userAnswers: Record<string, string>,
    extractions: RawTabExtraction[],
    openedTabIds: number[]
  ) => {
    onLayerChange('LAYER_C_DOM');
    setBusyMessage(
      health.online && health.geminiConfigured
        ? 'Synthesizing extracted prices via FastAPI + Gemini Flash...'
        : 'Running deterministic true-cost & dark-pattern engine...'
    );

    const analyzed = await requestAnalyze(
      goalPrompt,
      targetCategory,
      userAnswers,
      extractions,
      backendUrl
    );
    if (analyzed.fallbackReason) {
      setFallbackNotice(analyzed.fallbackReason);
    } else {
      setFallbackNotice(null);
    }
    const quarantinedInjections = extractions.flatMap((ext) => ext.quarantinedInjections);

    const nextSession: CompareSessionState = {
      id: `cmp-${Date.now()}`,
      prompt: goalPrompt,
      normalizedGoal: analyzed.normalizedGoal || normalizedGoal || goalPrompt,
      category: targetCategory,
      answers: userAnswers,
      options: analyzed.options,
      recommendation: analyzed.recommendation,
      quarantinedInjections,
      openedTabIds,
      poweredBy: analyzed.poweredBy,
      executionLayer: analyzed.executionLayer,
      updatedAt: new Date().toISOString(),
    };

    setBusyMessage(null);
    setFirewallDrawerOpen(false);
    await persistSession(nextSession);
    setFlowStep('whiteboard');
  };

  const handleBrowseAndCompare = async () => {
    const approvedSites = sites.filter((s) => selectedSiteIds.includes(s.id));
    if (approvedSites.length === 0) return;

    setFlowStep('scanning');
    setScanProgress(
      approvedSites.map((s) => ({
        siteId: s.id,
        label: s.name,
        step: 'Queued in allowlist...',
        done: false,
      }))
    );

    const { extractions, openedTabIds } = await openAndScanSites(approvedSites, (update) => {
      setScanProgress((prev) =>
        prev.map((item) =>
          item.siteId === update.siteId
            ? { ...item, step: update.step, done: update.done }
            : item
        )
      );
    });

    await finalizeAnalysis(prompt.trim(), category, answers, extractions, openedTabIds);
  };

  const handleCompareOpenTabs = async () => {
    const chosen = openTabs.filter((t) => selectedTabIds.includes(t.id));
    if (chosen.length === 0) return;

    setEntryMode('ask');
    setFlowStep('scanning');
    setScanProgress(
      chosen.map((t) => ({
        siteId: String(t.id),
        label: t.title.slice(0, 32),
        step: 'Scanning live DOM...',
        done: false,
      }))
    );

    const extractions: RawTabExtraction[] = [];
    for (const tab of chosen) {
      const snap = await extractFromTab(tab.id, tab.title, tab.url);
      extractions.push(snap);
      setScanProgress((prev) =>
        prev.map((item) =>
          item.siteId === String(tab.id)
            ? { ...item, step: `Extracted (${snap.detectedPrices.length} price signals)`, done: true }
            : item
        )
      );
    }

    const inferredPrompt = `Compare ${chosen.length} Open Chrome Tabs`;
    const inferredCategory = detectCategory(chosen.map((c) => c.title).join(' '));
    await finalizeAnalysis(inferredPrompt, inferredCategory, {}, extractions, []);
  };

  const handleToggleAddon = async (optionId: string) => {
    if (!session) return;
    const recalculated = session.options.map((opt) =>
      opt.id === optionId ? recalculateOptionCost(opt, !opt.addonEnabled) : opt
    );
    const { options, recommendation } = computeRecommendedDecision(recalculated, session.answers);
    await persistSession({
      ...session,
      options,
      recommendation,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleJumpToAnchor = async (
    option: WhiteboardOption,
    selector: string,
    message: string,
    variant: 'spotlight' | 'warning' | 'success'
  ) => {
    const res = await jumpAndHighlightTab(option.tabId, option.url, selector, message, variant);
    if (res.note) {
      setAnchorNote(res.note);
    } else {
      setAnchorNote(`Highlighted "${option.name}" on ${option.domain}.`);
    }
  };

  const handleOpenFullWhiteboard = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create && chrome.runtime?.getURL) {
      chrome.tabs.create({ url: chrome.runtime.getURL('whiteboard.html') });
    }
  };

  const handleCloseScannedTabs = async () => {
    if (!session?.openedTabIds.length) return;
    await closeScannedTabs(session.openedTabIds);
    await persistSession({ ...session, openedTabIds: [] });
    setAnchorNote('Closed background comparison tabs — workspace clutter cleared.');
  };

  const winnerOption = useMemo(
    () => session?.options.find((o) => o.id === session.recommendation.winnerId),
    [session]
  );

  return (
    <div className="space-y-3">
      {/* Top Mode & Backend Telemetry Bar */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-3.5 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex rounded-xl bg-[#F1F5F9] p-0.5 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => {
                if (entryMode === 'ask' && flowStep === 'whiteboard') {
                  setFlowStep('input');
                }
                setEntryMode('ask');
              }}
              className={`rounded-lg px-2.5 py-1 transition-all cursor-pointer ${
                entryMode === 'ask'
                  ? 'bg-white text-[#331E6D] shadow-xs font-bold'
                  : 'text-[#64748B] hover:text-[#1E1B4B]'
              }`}
            >
              Ask &amp; Browse
            </button>
            <button
              type="button"
              onClick={() => {
                setEntryMode('tabs');
                loadOpenTabs();
              }}
              className={`rounded-lg px-2.5 py-1 transition-all cursor-pointer ${
                entryMode === 'tabs'
                  ? 'bg-white text-[#331E6D] shadow-xs font-bold'
                  : 'text-[#64748B] hover:text-[#1E1B4B]'
              }`}
            >
              Open Tabs ({openTabs.length})
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSettingsOpen((prev) => !prev)}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold cursor-pointer ${
                health.online && health.geminiConfigured
                  ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]'
                  : health.online
                    ? 'border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]'
                    : 'border-[#E2E8F0] bg-[#F8F9FC] text-[#64748B]'
              }`}
              title="Configure FastAPI backend URL"
            >
              <Server className="h-3 w-3" />
              {health.online && health.geminiConfigured
                ? 'FastAPI + Gemini'
                : health.online
                  ? 'FastAPI (No Key)'
                  : 'Local Engine'}
              <Settings2 className="h-2.5 w-2.5 opacity-75" />
            </button>
          </div>
        </div>

        {settingsOpen && (
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8F9FC] p-2.5 space-y-2 text-[11px]">
            <div className="flex items-center justify-between font-bold text-[#1E1B4B]">
              <span>FastAPI Backend URL</span>
              <button
                type="button"
                onClick={() => void refreshHealth(backendUrl)}
                className="inline-flex items-center gap-1 text-[10px] text-[#331E6D] cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" /> Re-check
              </button>
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={backendUrlInput}
                onChange={(e) => setBackendUrlInput(e.target.value)}
                className="flex-1 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1 font-mono text-[10px] focus:border-[#331E6D] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void handleSaveBackendUrl()}
                className="rounded-lg bg-[#331E6D] px-2.5 py-1 text-[10px] font-bold text-white cursor-pointer"
              >
                Save
              </button>
            </div>
            <p className="text-[10px] text-[#64748B]">
              Start FastAPI locally in WSL2 to unlock Gemini Flash Q&amp;A and extraction; offline fallback stays active automatically.
            </p>
          </div>
        )}

        {/* Quick 1-Click Demo Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
            Instant Demo:
          </span>
          {DEMO_SCENARIOS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => void handleLoadDemo(preset.key)}
              className="rounded-full border border-[#E2E8F0] bg-[#F8F9FC] px-2.5 py-0.5 text-[10px] font-semibold text-[#331E6D] hover:border-[#331E6D] hover:bg-[#F3F0FF] transition-all cursor-pointer"
            >
              {preset.shortLabel}
            </button>
          ))}
        </div>
      </div>

      {fallbackNotice && (
        <div className="flex items-start justify-between gap-2 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[11px] font-medium text-[#92400E]">
          <span className="break-words">{fallbackNotice}</span>
          <button
            type="button"
            onClick={() => setFallbackNotice(null)}
            className="shrink-0 text-[#92400E] hover:text-[#78350F] cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ENTRY MODE: OPEN TABS PICKER */}
      {entryMode === 'tabs' && (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-3.5 shadow-xs space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-[#1E1B4B]">Compare Open Tabs</h2>
              <p className="text-[11px] text-[#475569]">
                Pick 2–5 open tabs to scan via Layer A/C and map onto the Visual Whiteboard.
              </p>
            </div>
            <button
              type="button"
              onClick={loadOpenTabs}
              title="Refresh Open Tabs"
              className="rounded-lg border border-[#E2E8F0] bg-[#F8F9FC] p-1.5 text-[#475569] hover:text-[#331E6D] cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingTabs ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
            {openTabs.map((tab) => {
              const checked = selectedTabIds.includes(tab.id);
              return (
                <label
                  key={tab.id}
                  className={`flex items-center gap-2.5 rounded-xl border p-2 cursor-pointer transition-all ${
                    checked
                      ? 'border-[#331E6D] bg-[#F3F0FF]/60'
                      : 'border-[#E2E8F0] bg-[#F8F9FC] hover:bg-white'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSelectedTabIds((prev) =>
                        prev.includes(tab.id) ? prev.filter((i) => i !== tab.id) : [...prev, tab.id]
                      )
                    }
                    className="h-3.5 w-3.5 accent-[#331E6D] cursor-pointer shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-[#1E1B4B] truncate">{tab.title}</div>
                    <div className="font-mono text-[10px] text-[#64748B] truncate">{tab.url}</div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      chrome.tabs?.update(tab.id, { active: true });
                    }}
                    className="rounded-md p-1 text-[#64748B] hover:text-[#331E6D] cursor-pointer"
                    title="Switch to tab"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </label>
              );
            })}
          </div>

          <button
            type="button"
            disabled={selectedTabIds.length === 0}
            onClick={() => void handleCompareOpenTabs()}
            className="pp-cta-gradient w-full rounded-xl py-2 text-xs font-bold text-white shadow-xs disabled:opacity-45 cursor-pointer"
          >
            Compare {selectedTabIds.length} Selected Tab{selectedTabIds.length === 1 ? '' : 's'}
          </button>
        </div>
      )}

      {/* ENTRY MODE: ASK & BROWSE STEPPER */}
      {entryMode === 'ask' && flowStep === 'input' && (
        <form
          onSubmit={(e) => void handleStartClarify(e)}
          className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-xs space-y-3"
        >
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#331E6D]">
              Mode 2 • Guided Visual Whiteboard
            </span>
            <h2 className="text-sm font-extrabold text-[#1E1B4B] mt-0.5">
              What do you want to compare?
            </h2>
            <p className="text-[11px] text-[#475569] mt-0.5">
              Products, broadband/SaaS services, or travel plans — PandaPilot asks quick questions, scans approved sites, and recommends the winner.
            </p>
          </div>

          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., Compare ANC headphones under ₹15,000 for coding & travel"
            className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8F9FC] p-2.5 text-xs text-[#1E1B4B] placeholder:text-[#94A3B8] focus:border-[#331E6D] focus:bg-white focus:outline-none resize-none"
          />

          <button
            type="submit"
            disabled={!prompt.trim() || Boolean(busyMessage)}
            className="pp-cta-gradient w-full inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold text-white shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {busyMessage ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {busyMessage}
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" /> Ask Clarifying Questions
              </>
            )}
          </button>

          {session && (
            <button
              type="button"
              onClick={() => setFlowStep('whiteboard')}
              className="w-full text-center text-[11px] font-semibold text-[#331E6D] hover:underline cursor-pointer"
            >
              Resume Last Whiteboard ({session.normalizedGoal}) →
            </button>
          )}
        </form>
      )}

      {/* STEP 2: CLARIFYING Q&A */}
      {entryMode === 'ask' && flowStep === 'clarify' && (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="rounded-full bg-[#F3F0FF] px-2 py-0.5 text-[10px] font-bold uppercase text-[#331E6D]">
                {category} • {poweredBy}
              </span>
              <h3 className="text-sm font-extrabold text-[#1E1B4B] mt-1">Quick Clarifications</h3>
            </div>
            <button
              type="button"
              onClick={() => setFlowStep('input')}
              className="text-[11px] font-semibold text-[#64748B] hover:text-[#1E1B4B] cursor-pointer"
            >
              Edit Prompt
            </button>
          </div>

          <div className="space-y-3">
            {questions.map((q, idx) => (
              <div key={q.id} className="rounded-xl border border-[#E2E8F0] bg-[#F8F9FC] p-2.5 space-y-2">
                <div className="text-xs font-bold text-[#1E1B4B]">
                  {idx + 1}. {q.question}
                </div>
                <div className="flex flex-wrap gap-1">
                  {q.chips.map((chip) => {
                    const active = answers[q.id] === chip;
                    return (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: chip }))}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all cursor-pointer border ${
                          active
                            ? 'border-[#331E6D] bg-[#331E6D] text-white'
                            : 'border-[#E2E8F0] bg-white text-[#475569] hover:border-[#331E6D]/50'
                        }`}
                      >
                        {chip}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder={q.placeholder || 'Or type your preference...'}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1 text-[11px] text-[#1E1B4B] focus:border-[#331E6D] focus:outline-none"
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setFlowStep('sites')}
            className="pp-cta-gradient w-full inline-flex items-center justify-center gap-1 rounded-xl py-2.5 text-xs font-bold text-white shadow-xs cursor-pointer"
          >
            Choose Sites to Browse <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* STEP 3: DOMAIN ALLOWLIST SITE PICKER (QUICK 3 / DEEP 5) */}
      {entryMode === 'ask' && flowStep === 'sites' && (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-xs space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#059669]">
                Zero-Trust Domain Allowlist
              </span>
              <h3 className="text-sm font-extrabold text-[#1E1B4B]">
                Approve Sites to Browse ({selectedSiteIds.length})
              </h3>
            </div>
            <div className="inline-flex rounded-lg bg-[#F1F5F9] p-0.5 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => applySiteCountPreset(3)}
                className={`rounded-md px-2 py-0.5 cursor-pointer ${
                  selectedSiteIds.length === 3 ? 'bg-white text-[#331E6D] shadow-xs' : 'text-[#64748B]'
                }`}
              >
                Quick 3
              </button>
              <button
                type="button"
                onClick={() => applySiteCountPreset(5)}
                className={`rounded-md px-2 py-0.5 cursor-pointer ${
                  selectedSiteIds.length >= 5 ? 'bg-white text-[#331E6D] shadow-xs' : 'text-[#64748B]'
                }`}
              >
                Deep 5
              </button>
            </div>
          </div>

          <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
            {sites.map((site) => {
              const checked = selectedSiteIds.includes(site.id);
              return (
                <label
                  key={site.id}
                  className={`flex items-start gap-2 rounded-xl border p-2.5 cursor-pointer transition-all ${
                    checked
                      ? 'border-[#331E6D] bg-[#F3F0FF]/50'
                      : 'border-[#E2E8F0] bg-[#F8F9FC] hover:bg-white'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSelectedSiteIds((prev) =>
                        prev.includes(site.id) ? prev.filter((i) => i !== site.id) : [...prev, site.id]
                      )
                    }
                    className="mt-0.5 h-3.5 w-3.5 accent-[#331E6D] cursor-pointer shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-[#1E1B4B]">{site.name}</span>
                      <span className="font-mono text-[10px] text-[#64748B]">{site.domain}</span>
                    </div>
                    <p className="text-[10px] text-[#475569] mt-0.5">{site.reason}</p>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="flex gap-1.5">
            <input
              type="text"
              value={customSiteUrl}
              onChange={(e) => setCustomSiteUrl(e.target.value)}
              placeholder="Add custom site URL (https://...)"
              className="flex-1 rounded-xl border border-[#E2E8F0] bg-[#F8F9FC] px-2.5 py-1.5 text-[11px] focus:border-[#331E6D] focus:bg-white focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAddCustomSite}
              className="inline-flex items-center gap-1 rounded-xl border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#331E6D] hover:bg-[#F3F0FF] cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFlowStep('clarify')}
              className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-bold text-[#475569] cursor-pointer"
            >
              Back
            </button>
            <button
              type="button"
              disabled={selectedSiteIds.length === 0}
              onClick={() => void handleBrowseAndCompare()}
              className="pp-cta-gradient flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold text-white shadow-xs disabled:opacity-45 cursor-pointer"
            >
              <Globe className="h-3.5 w-3.5" /> Approve &amp; Browse {selectedSiteIds.length} Sites
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: LIVE SCANNING PROGRESS */}
      {entryMode === 'ask' && flowStep === 'scanning' && (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-[#331E6D]" />
            <div>
              <h3 className="text-sm font-extrabold text-[#1E1B4B]">Browsing &amp; Extracting</h3>
              <p className="text-[11px] text-[#64748B]">
                {busyMessage || 'Scanning Layer A structured data & Layer C prices...'}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            {scanProgress.map((item) => (
              <div
                key={item.siteId}
                className="flex items-center justify-between gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8F9FC] px-3 py-2 text-[11px]"
              >
                <span className="font-bold text-[#1E1B4B] truncate">{item.label}</span>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold shrink-0 ${
                    item.done ? 'text-[#059669]' : 'text-[#331E6D]'
                  }`}
                >
                  {item.done ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  {item.step}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 5: VISUAL WHITEBOARD + RECOMMENDED DECISION */}
      {entryMode === 'ask' && flowStep === 'whiteboard' && session && (
        <div className="space-y-2.5">
          <RecommendedDecisionCard
            recommendation={session.recommendation}
            winnerOption={winnerOption}
            onOpenWinner={(opt) =>
              void handleJumpToAnchor(
                opt,
                opt.sourceSelector,
                `Winner: ${opt.name}`,
                'success'
              )
            }
          />

          {/* Whiteboard Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-2xl border border-[#E2E8F0] bg-white px-3 py-2 shadow-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleOpenFullWhiteboard}
                className="inline-flex items-center gap-1 rounded-xl bg-[#331E6D] px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-[#271556] cursor-pointer"
              >
                <Maximize2 className="h-3 w-3" /> Full-Tab Whiteboard
              </button>

              {session.openedTabIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => void handleCloseScannedTabs()}
                  className="inline-flex items-center gap-1 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-1.5 text-[10px] font-bold text-[#DC2626] hover:bg-[#FEE2E2] cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" /> Close {session.openedTabIds.length} Tabs
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setFlowStep('input');
                setAnchorNote(null);
              }}
              className="inline-flex items-center gap-1 rounded-xl border border-[#E2E8F0] bg-[#F8F9FC] px-2.5 py-1.5 text-[10px] font-bold text-[#475569] hover:text-[#1E1B4B] cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" /> New Compare
            </button>
          </div>

          {/* Quarantined Indirect Prompt Injection Pill */}
          {session.quarantinedInjections.length > 0 && (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setFirewallDrawerOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-1 text-[10px] font-bold text-[#DC2626] hover:bg-[#FEE2E2] cursor-pointer"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                {session.quarantinedInjections.length} Prompt Injection Quarantined
              </button>

              {firewallDrawerOpen && (
                <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-[11px] space-y-2">
                  <div className="flex items-center justify-between font-bold text-[#DC2626]">
                    <span>Untrusted Reader Firewall Evidence</span>
                    <button
                      type="button"
                      onClick={() => setFirewallDrawerOpen(false)}
                      className="cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {session.quarantinedInjections.map((inj) => (
                    <div key={inj.id} className="rounded-lg bg-white border border-[#FECACA] p-2 space-y-1">
                      <div className="font-mono text-[10px] text-[#991B1B] break-words">
                        &quot;{inj.snippet}&quot;
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-[#7F1D1D]">
                        <span>{inj.reason}</span>
                        <span className="font-mono font-bold">{inj.domain}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {anchorNote && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-[#DDD6FE] bg-[#F3F0FF] px-3 py-1.5 text-[10px] font-semibold text-[#331E6D]">
              <span className="truncate">{anchorNote}</span>
              <button type="button" onClick={() => setAnchorNote(null)} className="cursor-pointer">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          <WhiteboardCanvas
            session={session}
            compact
            onToggleAddon={(id) => void handleToggleAddon(id)}
            onJumpToAnchor={(opt, sel, msg, variant) => void handleJumpToAnchor(opt, sel, msg, variant)}
          />
        </div>
      )}
    </div>
  );
};
