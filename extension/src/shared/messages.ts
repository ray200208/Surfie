import type {
  FillFieldInstruction,
  FillFieldsResult,
  HighlightTarget,
  PageContext,
  VisibleDomElement,
  WorkflowStep,
} from './types';

export interface ReplayStepResult {
  ok: boolean;
  status: 'executed' | 'skipped_sensitive' | 'requires_confirmation' | 'not_found';
  matchedText?: string;
  error?: string;
}

export type PandaMessage =
  | { type: 'PING_PAGE' }
  | { type: 'HIGHLIGHT_ELEMENT'; payload: HighlightTarget }
  | { type: 'CLEAR_HIGHLIGHTS' }
  | { type: 'EXTRACT_VISIBLE_DOM' }
  | { type: 'FILL_SAFE_FIELDS'; payload: { fields: FillFieldInstruction[] } }
  | { type: 'START_RECORDING' }
  | { type: 'STOP_RECORDING' }
  | { type: 'REPLAY_STEP'; payload: { step: WorkflowStep; confirmed?: boolean } }
  | { type: 'ACTIVE_TAB_UPDATED'; payload: { tabId: number; url: string; title: string } }
  | { type: 'ROUTE_TO_ACTIVE_TAB'; payload: Exclude<PandaMessage, { type: 'ROUTE_TO_ACTIVE_TAB' }> };

export interface PandaResponseMap {
  PING_PAGE: PageContext;
  HIGHLIGHT_ELEMENT: { ok: boolean; matchedSelector?: string; error?: string };
  CLEAR_HIGHLIGHTS: { ok: boolean };
  EXTRACT_VISIBLE_DOM: { elements: VisibleDomElement[]; url: string };
  FILL_SAFE_FIELDS: FillFieldsResult;
  START_RECORDING: { ok: boolean; recording: boolean };
  STOP_RECORDING: { ok: boolean; steps: WorkflowStep[] };
  REPLAY_STEP: ReplayStepResult;
}

export type RequestMessageType = keyof PandaResponseMap;

/**
 * Send a strictly typed message to the background service worker.
 */
export async function sendToBackground<T = unknown>(message: PandaMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: T) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve(response);
    });
  });
}

/**
 * Send a strictly typed message directly to the currently active Chrome tab's content script.
 * Automatically returns a helpful error on restricted chrome:// or extension pages.
 */
export async function sendToActiveTab<T extends RequestMessageType>(
  message: Extract<PandaMessage, { type: T }>
): Promise<PandaResponseMap[T]> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!activeTab?.id) {
    throw new Error('No active browser tab found.');
  }

  const url = activeTab.url ?? '';
  if (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:')
  ) {
    throw new Error('PandaPilot cannot inspect Chrome internal pages. Open any normal website tab.');
  }

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(activeTab.id!, message, (response: PandaResponseMap[T]) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(
          new Error(
            'Content script not loaded on this tab yet. Refresh the webpage once and try again.'
          )
        );
        return;
      }
      resolve(response);
    });
  });
}
