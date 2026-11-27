export type CompareCategory = 'product' | 'service' | 'travel' | 'general';

export type BillingCycle = 'one_time' | 'monthly' | 'quarterly' | 'annual';

export type CompareFlowStep = 'input' | 'clarify' | 'sites' | 'scanning' | 'whiteboard';

export type CompareEntryMode = 'ask' | 'tabs';

export interface ClarifyingQuestion {
  id: string;
  question: string;
  chips: string[];
  placeholder: string;
}

export interface SiteCandidate {
  id: string;
  name: string;
  domain: string;
  url: string;
  reason: string;
  defaultSelected: boolean;
}

export interface DarkPatternFlag {
  id: string;
  kind: 'pre_ticked_addon' | 'hidden_fee' | 'auto_renew' | 'non_refundable';
  label: string;
  severity: 'amber' | 'crimson';
  selector: string;
  detail: string;
}

export interface QuarantinedInjection {
  id: string;
  tabId: number | null;
  domain: string;
  selector: string;
  snippet: string;
  reason: string;
}

export interface RawTabExtraction {
  tabId: number | null;
  url: string;
  domain: string;
  title: string;
  jsonLdSummary: string;
  visibleText: string;
  detectedPrices: string[];
  numericPrices: number[];
  currency: string;
  priceSelector: string;
  specs: Record<string, string | null>;
  rating: string | null;
  contractOrPolicy: string | null;
  darkPatterns: DarkPatternFlag[];
  quarantinedInjections: QuarantinedInjection[];
  addonLabel: string | null;
  addonCost: number;
  addonPreTicked: boolean;
  lateOrShippingFee: number;
  setupFee: number;
  taxPercent: number;
  billingCycle: BillingCycle;
  scanStatus: 'ok' | 'limited' | 'error';
  scanNote?: string;
}

export interface WhiteboardOption {
  id: string;
  tabId: number | null;
  name: string;
  domain: string;
  url: string;
  category: CompareCategory;
  currency: string;
  basePrice: number | null;
  billingCycle: BillingCycle;
  setupFee: number;
  addonLabel: string | null;
  addonCost: number;
  addonRecurring: boolean;
  addonPreTicked: boolean;
  addonEnabled: boolean;
  lateOrShippingFee: number;
  taxPercent: number;
  effectiveMonthly: number | null;
  totalCost: number | null;
  totalWithoutAddons: number | null;
  savingsIfAddonsRemoved: number;
  specs: Record<string, string | null>;
  rating: string | null;
  contractOrPolicy: string | null;
  pros: string[];
  cons: string[];
  darkPatterns: DarkPatternFlag[];
  sourceSelector: string;
  badge: string;
}

export interface RecommendedDecision {
  winnerId: string;
  runnerUpId: string | null;
  winnerName: string;
  headline: string;
  rationale: string[];
  savingsSummary: string;
}

export interface CompareSessionState {
  id: string;
  prompt: string;
  normalizedGoal: string;
  category: CompareCategory;
  answers: Record<string, string>;
  options: WhiteboardOption[];
  recommendation: RecommendedDecision;
  quarantinedInjections: QuarantinedInjection[];
  openedTabIds: number[];
  poweredBy: string;
  executionLayer: 'LAYER_A_STRUCTURED' | 'LAYER_C_DOM';
  updatedAt: string;
}

export interface BackendHealth {
  online: boolean;
  geminiConfigured: boolean;
  fastModel?: string;
}
