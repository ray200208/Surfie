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
  action: 'fill' | 'click' | 'check';
  personaKey?: keyof PersonaProfile;
  value?: string;
  label?: string;
}

export interface WorkflowRecipe {
  id: string;
  name: string;
  urlPattern: string;
  steps: WorkflowStep[];
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
