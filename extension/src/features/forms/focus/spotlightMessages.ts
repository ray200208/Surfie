export interface FocusSpotlightShowMessage {
  type: 'FOCUS_SPOTLIGHT_SHOW';
  selectors: string[];
  label?: string;
}

export interface FocusSpotlightClearMessage {
  type: 'FOCUS_SPOTLIGHT_CLEAR';
}

export type FocusSpotlightMessage =
  | FocusSpotlightShowMessage
  | FocusSpotlightClearMessage;

export interface FocusSpotlightResponse {
  ok: boolean;
  found: number;
}
