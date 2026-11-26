import { sendToActiveTab } from './tabMessaging';
import type { FocusScanPageResponse } from './scanMessages';

const SCAN_FAILURE: FocusScanPageResponse = {
  ok: false,
  elements: [],
  excluded: [],
  stats: { frames: 0, skippedFrames: 0, shadowRoots: 0, capped: false },
  pageTitle: '',
  reason: 'This page cannot be scanned. Open a regular webpage and try again.',
};

export async function scanPage(): Promise<FocusScanPageResponse> {
  try {
    return await sendToActiveTab({ type: 'FOCUS_SCAN_PAGE' as const }, SCAN_FAILURE);
  } catch {
    return SCAN_FAILURE;
  }
}
