function isRestrictedUrl(url: string): boolean {
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('devtools://')
  );
}

export async function sendToActiveTab<TMessage, TResponse>(
  message: TMessage,
  fallback: TResponse
): Promise<TResponse> {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query || !chrome.tabs?.sendMessage) {
    return fallback;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (typeof tab?.id !== 'number' || isRestrictedUrl(tab.url ?? '')) return fallback;

    return await new Promise<TResponse>((resolve) => {
      chrome.tabs.sendMessage(tab.id!, message, (response: TResponse | undefined) => {
        if (chrome.runtime.lastError || response === undefined) {
          resolve(fallback);
          return;
        }
        resolve(response);
      });
    });
  } catch {
    return fallback;
  }
}
