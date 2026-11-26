import { sendToActiveTab, type ReplayStepResult } from '../../shared/messages';
import { deleteWorkflowRecipe, saveWorkflowRecipe } from '../../shared/storage';
import type { WorkflowRecipe, WorkflowStep } from '../../shared/types';

export type StepStatus = 'pending' | 'running' | 'awaiting' | 'completed' | 'failed' | 'skipped';

const HIGH_STAKES = /(submit|place\s*order|checkout|pay\b|pay\s*now|buy\s*now|confirm\s*order|purchase|book\s*now|finali[sz]e)/i;
const SENSITIVE = /(password|passwd|pwd|otp|cvv|cvc|pin\b|card.?number)/i;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Click steps that likely submit a form / place an order. */
export function isHighStakesStep(step: WorkflowStep): boolean {
  if (step.action !== 'click') return false;
  const text = `${step.label ?? ''} ${step.selector}`;
  return HIGH_STAKES.test(text) || /type=["']?submit/i.test(step.selector);
}

/** Password / OTP / card fields are never replayed. */
export function isSensitiveStep(step: WorkflowStep): boolean {
  return step.action === 'fill' && SENSITIVE.test(`${step.label ?? ''} ${step.selector}`);
}

/** Random 500–800ms pause to mimic a human. */
export function humanDelay(): Promise<void> {
  return sleep(500 + Math.random() * 300);
}

export function buildRecipe(name: string, steps: WorkflowStep[], startUrl?: string): WorkflowRecipe {
  const rawStart = startUrl ?? steps.find((s) => s.url)?.url;
  const start = rawStart ? normalizeUrl(rawStart) : undefined;
  let urlPattern = '*://*/*';
  try {
    const first = start;
    if (first) urlPattern = `*://${new URL(first).hostname}/*`;
  } catch {
    /* keep default */
  }
  return {
    id: `wf-${Date.now()}`,
    name,
    urlPattern,
    startUrl: start,
    createdAt: Date.now(),
    steps: steps
      .filter((s) => !isSensitiveStep(s))
      .map((s) => ({ ...s, url: s.url ? normalizeUrl(s.url) : undefined })),
  };
}

export const persistRecipe = (recipe: WorkflowRecipe) => saveWorkflowRecipe(recipe);
export const removeRecipe = (id: string) => deleteWorkflowRecipe(id);

// ==================== Cross-tab recording buffer ====================
// Keep key in sync with src/content/index.ts
export const REC_KEY = 'pandapilot_rec_buffer_v1';
export interface RecBuffer {
  active: boolean;
  steps: WorkflowStep[];
  rev: number;
  startUrl?: string;
}
const EMPTY_BUFFER: RecBuffer = { active: false, steps: [], rev: 0 };

export async function getRecBuffer(): Promise<RecBuffer> {
  const r = await chrome.storage.local.get(REC_KEY);
  return (r[REC_KEY] as RecBuffer | undefined) ?? EMPTY_BUFFER;
}

/** Start/stop recording in every tab. Returns the buffer as it was before the change. */
export async function setRecActive(active: boolean, startUrl?: string): Promise<RecBuffer> {
  const cur = await getRecBuffer();
  const next: RecBuffer = { active, steps: [], rev: cur.rev + 1, startUrl: active ? startUrl : undefined };
  await chrome.storage.local.set({ [REC_KEY]: next });
  return cur;
}

export function watchRecBuffer(cb: (b: RecBuffer) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && changes[REC_KEY]) cb((changes[REC_KEY].newValue as RecBuffer) ?? EMPTY_BUFFER);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

// ==================== Navigation-aware replay ====================
const KEEP_PARAMS = ['q', 'v', 'search_query', 'list', 'id'];

/** Shorten noisy URLs (e.g. Google `/webhp?hl=...&zx=...` -> `https://www.google.com/`). */
export function normalizeUrl(url?: string): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    let pathname = u.pathname;
    if (/(^|\.)google\./i.test(u.hostname) && pathname === '/webhp') {
      pathname = '/';
    }
    const kept = new URLSearchParams();
    for (const key of KEEP_PARAMS) {
      const val = u.searchParams.get(key);
      if (val) kept.set(key, val);
    }
    const qs = kept.toString();
    return `${u.origin}${pathname}${qs ? `?${qs}` : ''}`;
  } catch {
    return url;
  }
}

/** Page identity: normalized URL without trailing slash. */
export const pageKey = (url?: string) => {
  const norm = normalizeUrl(url);
  if (!norm) return '';
  try {
    const u = new URL(norm);
    return `${u.origin}${u.pathname}`.replace(/\/$/, '') + u.search;
  } catch {
    return '';
  }
};

export async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/** Resolve on the next tab update/activation event, or after `ms` as a safety net. */
function nextTabEvent(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      chrome.tabs.onUpdated.removeListener(done);
      chrome.tabs.onActivated.removeListener(done);
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(done, ms);
    chrome.tabs.onUpdated.addListener(done);
    chrome.tabs.onActivated.addListener(done);
  });
}

/** Event-driven wait until the active tab finished loading. */
async function waitForActiveTabLoaded(timeoutMs = 15000): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const tab = await getActiveTab();
    if (tab && tab.status === 'complete') return;
    await nextTabEvent(500);
  }
}

/** Flexible page match for mid-workflow steps (allows SPA sub-routes like /messaging vs /messaging/thread/<id>). */
function pageMatchesStep(currentUrl?: string, stepUrl?: string): boolean {
  if (!stepUrl) return true;
  if (pageKey(currentUrl) === pageKey(stepUrl)) return true;
  try {
    const cur = new URL(currentUrl ?? '');
    const want = new URL(stepUrl);
    if (cur.origin !== want.origin) return false;
    const curSeg = cur.pathname.split('/').filter(Boolean)[0];
    const wantSeg = want.pathname.split('/').filter(Boolean)[0];
    return Boolean(curSeg && curSeg === wantSeg && !want.searchParams.get('q') && !want.searchParams.get('v'));
  } catch {
    return false;
  }
}

/**
 * Make sure the active tab is on the page where `step` was recorded.
 * 1. Waits (event-based) for a click-triggered navigation to settle.
 * 2. If another tab already has that page open, switches to it.
 * 3. Otherwise navigates the active tab to `step.url` (mid-workflow fallback; starting URL is already validated).
 */
export async function ensureStepPage(step: WorkflowStep, isAborted: () => boolean): Promise<void> {
  if (!step.url) return;
  const end = Date.now() + 4000;
  while (Date.now() < end) {
    if (isAborted()) return;
    const tab = await getActiveTab();
    if (tab && pageMatchesStep(tab.url, step.url)) {
      await waitForActiveTabLoaded();
      return;
    }
    await nextTabEvent(300);
  }

  const tabs = await chrome.tabs.query({ currentWindow: true });
  const match = tabs.find((t) => pageMatchesStep(t.url, step.url));
  if (match?.id) {
    await chrome.tabs.update(match.id, { active: true });
    await waitForActiveTabLoaded();
    return;
  }

  const cur = await getActiveTab();
  if (cur?.id) {
    await chrome.tabs.update(cur.id, { url: step.url });
    await nextTabEvent(500);
    await waitForActiveTabLoaded();
    return;
  }
  throw new Error(`Expected page ${step.url} but the browser is on ${cur?.url ?? 'an unknown page'}`);
}

/** Send REPLAY_STEP; only retries when the content script isn't reachable yet (page still loading). */
export async function sendStepWithRetry(
  step: WorkflowStep,
  confirmed: boolean,
  isAborted: () => boolean,
  timeoutMs = 10000
): Promise<ReplayStepResult> {
  const end = Date.now() + timeoutMs;
  let lastErr = 'Timed out';
  while (Date.now() < end && !isAborted()) {
    try {
      await waitForActiveTabLoaded(8000);
      return await sendToActiveTab({ type: 'REPLAY_STEP', payload: { step, confirmed } });
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
    await nextTabEvent(400);
  }
  return { ok: false, status: 'not_found', error: lastErr };
}
