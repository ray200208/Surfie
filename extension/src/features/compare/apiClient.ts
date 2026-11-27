import type {
  BackendHealth,
  ClarifyingQuestion,
  CompareCategory,
  CompareSessionState,
  RawTabExtraction,
  RecommendedDecision,
  SiteCandidate,
  WhiteboardOption,
} from './compareTypes';
import { buildLocalClarifyPlan } from './sitePlanner';
import { buildLocalOptionsFromExtractions } from './trueCostEngine';

export const COMPARE_SESSION_STORAGE_KEY = 'pandapilot_compare_session_v1';
export const COMPARE_CONFIG_STORAGE_KEY = 'pandapilot_compare_config_v1';
export const DEFAULT_BACKEND_URL = 'http://127.0.0.1:8000';

export async function getBackendUrl(): Promise<string> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get([COMPARE_CONFIG_STORAGE_KEY], (res) => {
        const cfg = res[COMPARE_CONFIG_STORAGE_KEY] as { backendUrl?: string } | undefined;
        resolve(cfg?.backendUrl || DEFAULT_BACKEND_URL);
      });
    });
  }
  return localStorage.getItem(COMPARE_CONFIG_STORAGE_KEY) || DEFAULT_BACKEND_URL;
}

export async function saveBackendUrl(url: string): Promise<string> {
  const cleaned = url.trim().replace(/\/+$/, '') || DEFAULT_BACKEND_URL;
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({ [COMPARE_CONFIG_STORAGE_KEY]: { backendUrl: cleaned } });
  } else {
    localStorage.setItem(COMPARE_CONFIG_STORAGE_KEY, cleaned);
  }
  return cleaned;
}

export async function saveCompareSession(session: CompareSessionState): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({ [COMPARE_SESSION_STORAGE_KEY]: session });
  } else {
    localStorage.setItem(COMPARE_SESSION_STORAGE_KEY, JSON.stringify(session));
  }
}

export async function loadCompareSession(): Promise<CompareSessionState | null> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get([COMPARE_SESSION_STORAGE_KEY], (res) => {
        resolve((res[COMPARE_SESSION_STORAGE_KEY] as CompareSessionState | undefined) ?? null);
      });
    });
  }
  const raw = localStorage.getItem(COMPARE_SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CompareSessionState;
  } catch {
    return null;
  }
}

export async function checkBackendHealth(baseUrl: string): Promise<BackendHealth> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(`${baseUrl}/health`, { signal: controller.signal });
    if (!res.ok) return { online: false, geminiConfigured: false };
    const data = (await res.json()) as {
      status?: string;
      geminiConfigured?: boolean;
      fastModel?: string;
    };
    return {
      online: data.status === 'ok',
      geminiConfigured: Boolean(data.geminiConfigured),
      fastModel: data.fastModel,
    };
  } catch {
    return { online: false, geminiConfigured: false };
  } finally {
    window.clearTimeout(timer);
  }
}

export interface ClarifyPlanResult {
  category: CompareCategory;
  normalizedGoal: string;
  questions: ClarifyingQuestion[];
  suggestedSites: SiteCandidate[];
  poweredBy: string;
}

export async function requestClarify(
  prompt: string,
  openTabTitles: string[],
  baseUrl: string
): Promise<ClarifyPlanResult> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${baseUrl}/api/compare/clarify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, open_tab_titles: openTabTitles }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const raw = (await res.json()) as {
      category: CompareCategory;
      normalized_goal: string;
      questions: ClarifyingQuestion[];
      suggested_sites: Array<{
        id: string;
        name: string;
        domain: string;
        url: string;
        reason: string;
        default_selected: boolean;
      }>;
      powered_by: string;
    };
    return {
      category: raw.category,
      normalizedGoal: raw.normalized_goal,
      questions: raw.questions,
      suggestedSites: raw.suggested_sites.map((s) => ({
        id: s.id,
        name: s.name,
        domain: s.domain,
        url: s.url,
        reason: s.reason,
        defaultSelected: s.default_selected,
      })),
      poweredBy: raw.powered_by || 'FastAPI + Gemini Flash',
    };
  } catch {
    return buildLocalClarifyPlan(prompt);
  } finally {
    window.clearTimeout(timer);
  }
}

export interface AnalyzeResult {
  normalizedGoal: string;
  options: WhiteboardOption[];
  recommendation: RecommendedDecision;
  poweredBy: string;
  executionLayer: 'LAYER_A_STRUCTURED' | 'LAYER_C_DOM';
}

export async function requestAnalyze(
  prompt: string,
  category: CompareCategory,
  answers: Record<string, string>,
  extractions: RawTabExtraction[],
  baseUrl: string
): Promise<AnalyzeResult> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 14000);
  try {
    const payload = {
      prompt,
      category,
      answers,
      tabs: extractions.map((ext) => ({
        tab_id: ext.tabId,
        url: ext.url,
        domain: ext.domain,
        title: ext.title,
        json_ld_summary: ext.jsonLdSummary,
        visible_text: ext.visibleText,
        detected_prices: ext.detectedPrices,
        dark_patterns: ext.darkPatterns,
        quarantined_injections: ext.quarantinedInjections.length,
        price_selector: ext.priceSelector,
      })),
    };

    const res = await fetch(`${baseUrl}/api/compare/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const raw = (await res.json()) as {
      normalized_goal: string;
      powered_by: string;
      execution_layer: 'LAYER_A_STRUCTURED' | 'LAYER_C_DOM';
      options: Array<{
        id: string;
        tab_id: number | null;
        name: string;
        domain: string;
        url: string;
        category: CompareCategory;
        currency: string;
        base_price: number | null;
        billing_cycle: 'one_time' | 'monthly' | 'quarterly' | 'annual';
        setup_fee: number;
        addon_label: string | null;
        addon_cost: number;
        addon_recurring: boolean;
        addon_pre_ticked: boolean;
        late_or_shipping_fee: number;
        tax_percent: number;
        effective_monthly: number | null;
        total_cost: number | null;
        total_without_addons: number | null;
        savings_if_addons_removed: number;
        specs: Record<string, string | null>;
        rating: string | null;
        contract_or_policy: string | null;
        pros: string[];
        cons: string[];
        dark_patterns: RawTabExtraction['darkPatterns'];
        source_selector: string;
        badge: string;
      }>;
      recommendation: {
        winner_id: string;
        runner_up_id: string | null;
        winner_name: string;
        headline: string;
        rationale: string[];
        savings_summary: string;
      };
    };

    return {
      normalizedGoal: raw.normalized_goal,
      poweredBy: raw.powered_by,
      executionLayer: raw.execution_layer || 'LAYER_C_DOM',
      options: raw.options.map((o) => ({
        id: o.id,
        tabId: o.tab_id,
        name: o.name,
        domain: o.domain,
        url: o.url,
        category: o.category,
        currency: o.currency,
        basePrice: o.base_price,
        billingCycle: o.billing_cycle,
        setupFee: o.setup_fee,
        addonLabel: o.addon_label,
        addonCost: o.addon_cost,
        addonRecurring: o.addon_recurring,
        addonPreTicked: o.addon_pre_ticked,
        addonEnabled: o.addon_pre_ticked,
        lateOrShippingFee: o.late_or_shipping_fee,
        taxPercent: o.tax_percent,
        effectiveMonthly: o.effective_monthly,
        totalCost: o.total_cost,
        totalWithoutAddons: o.total_without_addons,
        savingsIfAddonsRemoved: o.savings_if_addons_removed,
        specs: o.specs,
        rating: o.rating,
        contractOrPolicy: o.contract_or_policy,
        pros: o.pros,
        cons: o.cons,
        darkPatterns: o.dark_patterns,
        sourceSelector: o.source_selector,
        badge: o.badge,
      })),
      recommendation: {
        winnerId: raw.recommendation.winner_id,
        runnerUpId: raw.recommendation.runner_up_id,
        winnerName: raw.recommendation.winner_name,
        headline: raw.recommendation.headline,
        rationale: raw.recommendation.rationale,
        savingsSummary: raw.recommendation.savings_summary,
      },
    };
  } catch {
    const local = buildLocalOptionsFromExtractions(extractions, category, answers);
    return {
      normalizedGoal: prompt,
      options: local.options,
      recommendation: local.recommendation,
      poweredBy: 'Local Deterministic Engine',
      executionLayer: extractions.some((e) => e.jsonLdSummary) ? 'LAYER_A_STRUCTURED' : 'LAYER_C_DOM',
    };
  } finally {
    window.clearTimeout(timer);
  }
}
