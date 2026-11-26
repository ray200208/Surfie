import type {
  FocusSpotlightClearMessage,
  FocusSpotlightResponse,
  FocusSpotlightShowMessage,
} from './spotlightMessages';

const NO_TARGET: FocusSpotlightResponse = { ok: false, found: 0 };

function isRestrictedUrl(url: string): boolean {
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:')
  );
}

async function sendSpotlightMessage(
  message: FocusSpotlightShowMessage | FocusSpotlightClearMessage
): Promise<FocusSpotlightResponse> {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query || !chrome.tabs?.sendMessage) {
    return NO_TARGET;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (typeof tab?.id !== 'number' || isRestrictedUrl(tab.url ?? '')) return NO_TARGET;

    return await new Promise((resolve) => {
      chrome.tabs.sendMessage(
        tab.id!,
        message,
        (response: FocusSpotlightResponse | undefined) => {
          if (chrome.runtime.lastError || !response) {
            resolve(NO_TARGET);
            return;
          }
          resolve(response);
        }
      );
    });
  } catch {
    return NO_TARGET;
  }
}

export function showSpotlight(
  selectors: string[],
  label?: string
): Promise<FocusSpotlightResponse> {
  return sendSpotlightMessage({ type: 'FOCUS_SPOTLIGHT_SHOW', selectors, label });
}

export function clearSpotlight(): Promise<FocusSpotlightResponse> {
  return sendSpotlightMessage({ type: 'FOCUS_SPOTLIGHT_CLEAR' });
}
