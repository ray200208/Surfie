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

export type FocusStepKind = 'group' | 'review';

export type FocusMode = 'cards' | 'spotlight-only';

export interface FocusPlan {
  mode: FocusMode;
  autoFilledFieldIds: string[];
  gapFieldIds: string[];
  steps: { kind: FocusStepKind; groupId?: string }[];
}

/** Connects a Focus field to the existing safe-fill message contract. */
export interface FocusFillInstruction extends FillFieldInstruction {
  fieldId: FocusField['id'];
}
