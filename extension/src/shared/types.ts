export type PandaMode = 'discovery' | 'compare' | 'forms' | 'replay';

export type ExecutionLayer =
  | 'LAYER_A_STRUCTURED'
  | 'LAYER_B_CACHED'
  | 'LAYER_C_DOM'
  | 'LAYER_D_VISION';

export type LanguageCode = 'EN' | 'HI' | 'TA';

export type DomainType = 'college' | 'shopping' | 'portal' | 'general';

export interface PageContext {
  tabId: number;
  url: string;
  title: string;
  inputCount: number;
  hasForm: boolean;
  detectedDomainType: DomainType;
}

export interface PersonaProfile {
  id: 'college' | 'personal';
  label: string;
  fullName: string;
  email: string;
  phone: string;
  institution?: string;
  usn?: string;
}

export interface HighlightTarget {
  selector: string;
  message: string;
  variant: 'spotlight' | 'warning' | 'success';
}

export interface WorkflowStep {
  selector: string;
  action: 'fill' | 'click' | 'check' | 'scroll' | 'keypress' | 'seek';
  personaKey?: keyof PersonaProfile;
  value?: string;
  label?: string;
  /** Page URL where the step was recorded (enables cross-page / cross-tab replay). */
  url?: string;
  /** Epoch ms when the step was recorded. */
  ts?: number;
  /** Stable identifying info about the target element (used when the selector breaks). */
  target?: StepTarget;
}

export interface StepTarget {
  tag: string;
  type?: string;
  id?: string;
  name?: string;
  ariaLabel?: string;
  placeholder?: string;
  role?: string;
  text?: string;
  href?: string;
  xpath?: string;
  parents?: string[];
}

export interface WorkflowRecipe {
  id: string;
  name: string;
  urlPattern: string;
  steps: WorkflowStep[];
  /** URL the workflow was recorded from; replay is blocked unless the browser is here. */
  startUrl?: string;
  createdAt?: number;
}

export interface VisibleDomElement {
  index: number;
  tag: string;
  type: string;
  selector: string;
  label: string;
  placeholder: string;
  name: string;
  isSensitive: boolean;
}

export interface FillFieldInstruction {
  selector: string;
  value: string;
}

export interface FillFieldsResult {
  filledCount: number;
  skippedSensitiveCount: number;
  missingSelectors: string[];
}
