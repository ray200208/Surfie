export type ModeId = 1 | 2 | 3 | 4;

export type LanguageCode = 'EN' | 'HI' | 'TA';

export type ExecutionLayerId = 'A' | 'B' | 'C' | 'D';

export type BrowserTabId =
  | 'search-ppt'
  | 'slidecraft-tool'
  | 'portal-guide'
  | 'isp-fiberfast'
  | 'isp-metronet'
  | 'isp-airwave'
  | 'hackathon-portal'
  | 'lms-portal';

export interface BrowserTabMeta {
  id: BrowserTabId;
  title: string;
  shortTitle: string;
  url: string;
  domain: string;
  mode: ModeId;
  faviconBg: string;
  faviconText: string;
  allowlisted: boolean;
}

export interface ExecutionLayerMeta {
  id: ExecutionLayerId;
  label: string;
  shortLabel: string;
  tokens: string;
  cost: string;
  description: string;
}

export interface BroadbandPlanRaw {
  id: 'fiberfast' | 'metronet' | 'airwave';
  tabId: BrowserTabId;
  name: string;
  providerUrl: string;
  speedMbps: number;
  dataCap: string;
  billingCycle: 'monthly' | 'quarterly' | 'annual';
  basePrice: number;
  setupFee: number;
  gstPercent: number;
  routerAddonMonthly: number;
  routerAddonPreTicked: boolean;
  lateCheckoutFee: number;
  contractTerm: string | null; // null => "Not stated on this page"
  autoRenewPrice: number | null;
  hiddenPromptInjection?: string;
  warnings: {
    id: string;
    label: string;
    severity: 'amber' | 'crimson';
    targetAnchor: string;
    detail: string;
  }[];
}

export interface NormalizedPlan extends BroadbandPlanRaw {
  firstYearTotal: number;
  effectiveMonthly: number;
  firstYearWithoutAddon: number;
  effectiveMonthlyWithoutAddon: number;
  badge: 'Best 1-Yr Value' | 'Hidden Fee Risk' | 'Auto-Renew Trap';
}

export type PersonaType = 'college' | 'personal';

export interface PersonaProfile {
  type: PersonaType;
  label: string;
  badge: string;
  fullName: string;
  email: string;
  phone: string;
  college: string;
  usn: string;
}

export interface HackathonFormValues {
  fullName: string;
  email: string;
  phone: string;
  college: string;
  usn: string;
  essay: string;
  passwordOtp: string;
}

export interface LmsFormValues {
  course: string;
  labWeek: string;
  fileName: string;
  declarationChecked: boolean;
}

export interface ReplayStep {
  id: string;
  title: string;
  selector: string;
  actionDesc: string;
  status: 'idle' | 'running' | 'done' | 'paused' | 'aborted';
  durationMs?: number;
}
