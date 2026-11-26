import type { PandaMessage } from '../shared/messages';

/**
 * Configure Chrome Side Panel to open automatically when clicking the toolbar icon.
 */
function enableSidePanelOnActionClick(): void {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((err) => console.warn('[PandaPilot] setPanelBehavior failed:', err));
  }
}

chrome.runtime.onInstalled.addListener(() => {
  enableSidePanelOnActionClick();
});

chrome.runtime.onStartup.addListener(() => {
  enableSidePanelOnActionClick();
});

// Ensure behavior is active immediately when the worker wakes up.
enableSidePanelOnActionClick();

/**
 * Broadcast active tab metadata to any open Side Panel listener.
 */
function broadcastActiveTab(tabId: number, url?: string, title?: string): void {
  const message: PandaMessage = {
    type: 'ACTIVE_TAB_UPDATED',
    payload: {
      tabId,
      url: url ?? '',
      title: title ?? '',
    },
  };

  chrome.runtime.sendMessage(message).catch(() => {
    // Side Panel may not be open; ignore expected "receiving end does not exist" error.
  });
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    broadcastActiveTab(tabId, tab.url, tab.title);
  } catch {
    // Tab may have been closed before query completed.
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.status === 'complete' || changeInfo.url || changeInfo.title)) {
    broadcastActiveTab(tabId, tab.url, tab.title);
  }
});

/**
 * Route messages cleanly between the Side Panel and the active tab's content script.
 */
chrome.runtime.onMessage.addListener((message: PandaMessage, _sender, sendResponse) => {
  if (message?.type === 'ROUTE_TO_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab?.id) {
        sendResponse({ ok: false, error: 'No active tab available.' });
        return;
      }

      chrome.tabs.sendMessage(activeTab.id, message.payload, (response) => {
        const err = chrome.runtime.lastError;
        if (err) {
          sendResponse({ ok: false, error: err.message });
          return;
        }
        sendResponse(response);
      });
    });
    return true; // Keep async message channel open
  }

  return false;
});
