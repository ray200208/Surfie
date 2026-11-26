export interface ScannedOption {
  value: string;
  label: string;
  selector?: string;
}

export type ScannedFieldKind =
  | 'text'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'radio-group'
  | 'checkbox-group';

export interface ScannedField {
  id: string;
  selector: string;
  kind: ScannedFieldKind;
  inputType: string;
  label: string;
  placeholder: string;
  name: string;
  required: boolean;
  disabled: boolean;
  readOnly: boolean;
  hasValue: boolean;
  groupHint: string;
  autocomplete: string;
  options: ScannedOption[];
}

export interface ExcludedScannedField {
  label: string;
  reason: string;
}

export interface FocusScanStats {
  frames: number;
  skippedFrames: number;
  shadowRoots: number;
  capped: boolean;
}

export interface FocusScanPageRequest {
  type: 'FOCUS_SCAN_PAGE';
}

export interface FocusScanPageResponse {
  ok: boolean;
  elements: ScannedField[];
  excluded: ExcludedScannedField[];
  stats: FocusScanStats;
  pageTitle: string;
  reason?: string;
}
