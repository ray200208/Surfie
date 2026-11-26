import type {
  FillFieldInstruction,
  PersonaProfile,
  VisibleDomElement,
} from '../../../shared/types';

export type FocusFieldSource = 'vault' | 'voice' | 'inferred' | 'user';

export type FocusFieldInputType =
  | 'text'
  | 'email'
  | 'tel'
  | 'number'
  | 'date'
  | 'select'
  | 'textarea';

export type FocusVaultKey = Extract<
  keyof PersonaProfile,
  'fullName' | 'email' | 'phone' | 'institution' | 'usn'
>;

export interface FocusField {
  id: string;
  label: string;
  inputType: FocusFieldInputType;
  required: boolean;
  groupId: string;
  vaultKey?: FocusVaultKey;
  options?: { value: string; label: string }[];
  value: string;
  source: FocusFieldSource | null;
  confidence: number;
  selector?: VisibleDomElement['selector'];
}

export interface FocusGroup {
  id: string;
  title: string;
  fieldIds: string[];
}

export interface FocusForm {
  id: string;
  title: string;
  fields: FocusField[];
  groups: FocusGroup[];
}

export type FocusStepKind = 'group' | 'field' | 'review';

export interface FocusStep {
  kind: FocusStepKind;
  title: string;
  fieldIds: string[];
}

export type FocusMode = 'cards' | 'spotlight-only';

export interface FocusPlan {
  mode: FocusMode;
  autoFilledFieldIds: string[];
  gapFieldIds: string[];
  steps: FocusStep[];
}

export interface ReviewItem {
  fieldId: string;
  label: string;
  inputType: FocusField['inputType'];
  options?: { value: string; label: string }[];
  value: string;
  displayValue: string;
  source: FocusFieldSource | null;
  required: boolean;
  missing: boolean;
  sensitive: boolean;
}

/** Connects a Focus field to the existing safe-fill message contract. */
export interface FocusFillInstruction extends FillFieldInstruction {
  fieldId: FocusField['id'];
}
