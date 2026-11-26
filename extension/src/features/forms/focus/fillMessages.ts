import type { ScannedFieldKind } from './scanMessages';

export interface FocusFillItem {
  selector: string;
  kind: ScannedFieldKind;
  value: string;
  optionSelectors?: Record<string, string>;
}

export interface FocusFillFieldsRequest {
  type: 'FOCUS_FILL_FIELDS';
  items: FocusFillItem[];
}

export interface FocusFillFieldsResponse {
  filled: string[];
  skipped: { selector: string; reason: string }[];
}
