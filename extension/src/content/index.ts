import type { PandaMessage, ReplayStepResult } from '../shared/messages';
import type {
  DomainType,
  FillFieldInstruction,
  FillFieldsResult,
  PageContext,
  VisibleDomElement,
  StepTarget,
  WorkflowStep,
} from '../shared/types';
import { clearHighlights, highlightElement } from './shadowOverlay';

function detectDomainType(url: string): DomainType {
  const lower = url.toLowerCase();
  if (
    lower.includes('.edu') ||
    lower.includes('lms.') ||
    lower.includes('moodle') ||
    lower.includes('classroom') ||
    lower.includes('campus')
  ) {
    return 'college';
  }
  if (
    lower.includes('amazon') ||
    lower.includes('flipkart') ||
    lower.includes('pricing') ||
    lower.includes('plans') ||
    lower.includes('shop') ||
    lower.includes('cart')
  ) {
    return 'shopping';
  }
  if (
    lower.includes('.gov') ||
    lower.includes('portal') ||
    lower.includes('apply') ||
    lower.includes('register')
  ) {
    return 'portal';
  }
  return 'general';
}

function isElementVisibleInViewport(el: Element): boolean {
  const style = window.getComputedStyle(el);
  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    parseFloat(style.opacity || '1') === 0
  ) {
    return false;
  }

  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;

  return (
    rect.bottom >= 0 &&
    rect.right >= 0 &&
    rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.left <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

function buildSelectorForElement(el: Element, fallbackIndex = 0): string {
  if (el.id) {
    return `#${CSS.escape(el.id)}`;
  }
  const nameAttr = el.getAttribute('name');
  if (nameAttr) {
    return `${el.tagName.toLowerCase()}[name="${CSS.escape(nameAttr)}"]`;
  }
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) {
    return `${el.tagName.toLowerCase()}[aria-label="${CSS.escape(ariaLabel)}"]`;
  }
  const parent = el.parentElement;
  if (parent) {
    const sameTagSiblings = Array.from(parent.children).filter(
      (child) => child.tagName === el.tagName
    );
    const idx = sameTagSiblings.indexOf(el);
    if (idx >= 0) {
      return `${el.tagName.toLowerCase()}:nth-of-type(${idx + 1})`;
    }
  }
  return `${el.tagName.toLowerCase()}:nth-of-type(${fallbackIndex + 1})`;
}

function resolveLabelText(el: Element): string {
  if (el.id) {
    const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label?.textContent?.trim()) return label.textContent.trim();
  }
  const parentLabel = el.closest('label');
  if (parentLabel?.textContent?.trim()) return parentLabel.textContent.trim();

  const aria = el.getAttribute('aria-label');
  if (aria?.trim()) return aria.trim();

  const placeholder = el.getAttribute('placeholder');
  if (placeholder?.trim()) return placeholder.trim();

  const text = el.textContent?.trim();
  if (text) return text.slice(0, 60);

  return el.getAttribute('name') || el.tagName.toLowerCase();
}

function isSensitiveField(el: Element): boolean {
  if (!(el instanceof HTMLInputElement)) return false;
  const type = (el.type || '').toLowerCase();
  if (type === 'password') return true;
  const descriptor = `${el.name} ${el.id} ${el.placeholder} ${el.getAttribute('autocomplete') ?? ''}`.toLowerCase();
  return (
    descriptor.includes('password') ||
    descriptor.includes('otp') ||
    descriptor.includes('cvv') ||
    descriptor.includes('pin')
  );
}

function isFinalSubmitElement(el: Element): boolean {
  if (el instanceof HTMLButtonElement && el.type.toLowerCase() === 'submit') return true;
  if (el instanceof HTMLInputElement && el.type.toLowerCase() === 'submit') return true;
  const label = `${el.textContent ?? ''} ${el.getAttribute('value') ?? ''} ${el.getAttribute('aria-label') ?? ''}`.toLowerCase();
  return /\b(submit|place order|confirm|pay now|checkout|complete)\b/.test(label);
}

function buildPageContext(): PageContext {
  const inputs = Array.from(document.querySelectorAll('input, textarea, select')).filter((el) =>
    isElementVisibleInViewport(el)
  );
  return {
    tabId: -1,
    url: window.location.href,
    title: document.title || window.location.hostname,
    inputCount: inputs.length,
    hasForm: document.querySelectorAll('form').length > 0 || inputs.length >= 2,
    detectedDomainType: detectDomainType(window.location.href),
  };
}

function extractVisibleInteractiveDom(): VisibleDomElement[] {
  const candidates = Array.from(
    document.querySelectorAll('input, textarea, select, button, a[href]')
  );
  const results: VisibleDomElement[] = [];

  for (const el of candidates) {
    if (!isElementVisibleInViewport(el)) continue;
    if (el instanceof HTMLInputElement && el.type.toLowerCase() === 'hidden') continue;

    const index = results.length;
    results.push({
      index,
      tag: el.tagName.toLowerCase(),
      type:
        el instanceof HTMLInputElement
          ? (el.type || 'text').toLowerCase()
          : el.tagName.toLowerCase(),
      selector: buildSelectorForElement(el, index),
      label: resolveLabelText(el),
      placeholder: el.getAttribute('placeholder') ?? '',
      name: el.getAttribute('name') ?? '',
      isSensitive: isSensitiveField(el),
    });

    if (results.length >= 40) break;
  }

  return results;
}

function fillSafeFields(fields: FillFieldInstruction[]): FillFieldsResult {
  let filledCount = 0;
  let skippedSensitiveCount = 0;
  const missingSelectors: string[] = [];

  for (const item of fields) {
    let el: Element | null = null;
    try {
      el = document.querySelector(item.selector);
    } catch {
      missingSelectors.push(item.selector);
      continue;
    }

    if (!el) {
      missingSelectors.push(item.selector);
      continue;
    }

    // HARD CREDENTIAL BOUNDARY: Never auto-fill password or sensitive inputs
    if (el instanceof HTMLInputElement && (el.type.toLowerCase() === 'password' || isSensitiveField(el))) {
      skippedSensitiveCount += 1;
      continue;
    }

    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
    ) {
      el.focus();
      el.value = item.value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      filledCount += 1;
    }
  }

  return { filledCount, skippedSensitiveCount, missingSelectors };
}

// ==================== RECORDING (MODE 4) ====================
// Recording state lives in chrome.storage.local so it survives page navigations
// and follows the user across tabs. Keep key in sync with features/replay/replayEngine.ts.
const REC_KEY = 'pandapilot_rec_buffer_v1';
interface RecBuffer {
  active: boolean;
  steps: WorkflowStep[];
  rev: number;
  startUrl?: string;
}

let isRecording = false;
let recordedSteps: WorkflowStep[] = [];
let recRev = 0;
let recStartUrl: string | undefined;

function persistBuffer(): void {
  recRev += 1;
  chrome.storage.local.set({
    [REC_KEY]: { active: isRecording, steps: recordedSteps, rev: recRev, startUrl: recStartUrl },
  });
}

const normText = (s?: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();

function buildRobustSelector(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `#${CSS.escape(el.id)}`;
  const unique = (sel: string) => {
    try {
      return document.querySelectorAll(sel).length === 1;
    } catch {
      return false;
    }
  };
  const nameAttr = el.getAttribute('name');
  if (nameAttr) {
    const s = `${tag}[name="${CSS.escape(nameAttr)}"]`;
    if (unique(s)) return s;
  }
  const aria = el.getAttribute('aria-label');
  if (aria) {
    const s = `${tag}[aria-label="${CSS.escape(aria)}"]`;
    if (unique(s)) return s;
  }
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== document.body && cur !== document.documentElement) {
    if (cur.id) {
      parts.unshift(`#${CSS.escape(cur.id)}`);
      break;
    }
    const node: Element = cur;
    const parent: Element | null = node.parentElement;
    const t = node.tagName.toLowerCase();
    if (!parent) {
      parts.unshift(t);
      break;
    }
    const idx = Array.from(parent.children).filter((c) => c.tagName === node.tagName).indexOf(node) + 1;
    parts.unshift(`${t}:nth-of-type(${idx})`);
    cur = parent;
  }
  if (!parts.length) return tag;
  if (!parts[0].startsWith('#')) parts.unshift('body');
  return parts.join(' > ');
}

function xpathFor(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== document.documentElement) {
    let i = 1;
    let sib = cur.previousElementSibling;
    while (sib) {
      if (sib.tagName === cur.tagName) i += 1;
      sib = sib.previousElementSibling;
    }
    parts.unshift(`${cur.tagName.toLowerCase()}[${i}]`);
    cur = cur.parentElement;
  }
  return `/html/${parts.join('/')}`;
}

function describeTarget(el: Element): StepTarget {
  const parents: string[] = [];
  let p = el.parentElement;
  while (p && parents.length < 3 && p !== document.body) {
    parents.push(`${p.tagName.toLowerCase()}${p.id ? `#${p.id}` : ''}${p.getAttribute('role') ? `[role=${p.getAttribute('role')}]` : ''}`);
    p = p.parentElement;
  }
  let href: string | undefined;
  if (el instanceof HTMLAnchorElement && el.href) {
    try {
      href = new URL(el.href).pathname + new URL(el.href).search;
    } catch {
      href = undefined;
    }
  }
  return {
    tag: el.tagName.toLowerCase(),
    type: el instanceof HTMLInputElement ? el.type : undefined,
    id: el.id || undefined,
    name: el.getAttribute('name') || undefined,
    ariaLabel: el.getAttribute('aria-label') || undefined,
    placeholder: el.getAttribute('placeholder') || undefined,
    role: el.getAttribute('role') || undefined,
    text: normText(el.textContent).slice(0, 80) || undefined,
    href,
    xpath: xpathFor(el),
    parents,
  };
}

function buildStep(action: WorkflowStep['action'], el: Element, extra: Partial<WorkflowStep> = {}): WorkflowStep {
  return {
    selector: buildRobustSelector(el),
    action,
    label: resolveLabelText(el),
    target: describeTarget(el),
    ...extra,
  };
}

function pushStep(step: WorkflowStep): void {
  const s: WorkflowStep = { ...step, url: window.location.href, ts: Date.now() };
  const prev = recordedSteps[recordedSteps.length - 1];
  const mergeable =
    prev &&
    prev.url === s.url &&
    prev.action === s.action &&
    prev.selector === s.selector &&
    (s.action === 'fill' || s.action === 'scroll' || s.action === 'seek');
  if (mergeable) recordedSteps[recordedSteps.length - 1] = s;
  else recordedSteps.push(s);
  persistBuffer();
}

// Debounced actions (scroll / video seek): committed once the user settles.
let scrollTimer: number | undefined;
let seekTimer: number | undefined;
let pendingVideo: HTMLVideoElement | null = null;

function commitScroll(): void {
  scrollTimer = undefined;
  if (!isRecording) return;
  const x = Math.round(window.scrollX);
  const y = Math.round(window.scrollY);
  if (x === 0 && y === 0) return;
  pushStep({ selector: 'body', action: 'scroll', value: `${x},${y}`, label: `Scroll to y=${y}` });
}

function commitSeek(): void {
  seekTimer = undefined;
  const v = pendingVideo;
  pendingVideo = null;
  if (!isRecording || !v || v.currentTime < 0.5) return;
  const t = Math.round(v.currentTime * 10) / 10;
  pushStep(buildStep('seek', v, { value: String(t), label: `Seek video to ${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` }));
}

function flushPending(): void {
  if (scrollTimer !== undefined) {
    window.clearTimeout(scrollTimer);
    commitScroll();
  }
  if (seekTimer !== undefined) {
    window.clearTimeout(seekTimer);
    commitSeek();
  }
}

function cancelPending(): void {
  if (scrollTimer !== undefined) window.clearTimeout(scrollTimer);
  if (seekTimer !== undefined) window.clearTimeout(seekTimer);
  scrollTimer = undefined;
  seekTimer = undefined;
  pendingVideo = null;
}

const CLICKABLE =
  'button, a, input, textarea, select, summary, video, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [onclick]';

function handleRecordClick(event: MouseEvent): void {
  if (!isRecording) return;
  if (!(event.target instanceof Element)) return;
  if (event.target.closest('#pandapilot-shadow-root')) return;
  let target: Element | null = event.target.closest(CLICKABLE);
  if (!target && event.target instanceof HTMLElement && event.target !== document.body && event.target !== document.documentElement) {
    target = event.target;
  }
  if (!target) return;
  if (isSensitiveField(target)) return;
  if (target instanceof HTMLInputElement && ['checkbox', 'radio', 'password'].includes(target.type.toLowerCase())) return;
  flushPending();
  pushStep(buildStep('click', target));
}

function handleRecordChange(event: Event): void {
  if (!isRecording) return;
  const target = event.target;
  if (
    !(target instanceof HTMLInputElement) &&
    !(target instanceof HTMLTextAreaElement) &&
    !(target instanceof HTMLSelectElement)
  ) {
    return;
  }

  // HARD CREDENTIAL BOUNDARY: Never record passwords, OTPs, CVVs, or PINs
  if (target instanceof HTMLInputElement && (target.type.toLowerCase() === 'password' || isSensitiveField(target))) {
    return;
  }
  flushPending();

  if (target instanceof HTMLInputElement && (target.type === 'checkbox' || target.type === 'radio')) {
    pushStep(buildStep('check', target, { value: String(target.checked) }));
    return;
  }
  pushStep(buildStep('fill', target, { value: target.value }));
}

function handleKeydown(event: KeyboardEvent): void {
  if (!isRecording || event.key !== 'Enter' || event.isComposing) return;
  const active = document.activeElement instanceof Element ? document.activeElement : document.body;
  if (active.closest('#pandapilot-shadow-root')) return;
  if (isSensitiveField(active)) return;
  flushPending();
  // Make sure the typed text is stored as its own step before Enter (the change event may fire late).
  if ((active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) && active.value !== '') {
    pushStep(buildStep('fill', active, { value: active.value }));
  }
  pushStep(buildStep('keypress', active, { value: 'Enter', label: `Press Enter (${resolveLabelText(active)})` }));
}

function handleScroll(event: Event): void {
  if (!isRecording || event.target !== document) return;
  if (scrollTimer !== undefined) window.clearTimeout(scrollTimer);
  scrollTimer = window.setTimeout(commitScroll, 500);
}

function handleVideoEvent(event: Event): void {
  if (!isRecording || !(event.target instanceof HTMLVideoElement)) return;
  pendingVideo = event.target;
  if (seekTimer !== undefined) window.clearTimeout(seekTimer);
  seekTimer = window.setTimeout(commitSeek, 600);
}

function attachRecordListeners(): void {
  document.addEventListener('click', handleRecordClick, true);
  document.addEventListener('change', handleRecordChange, true);
  document.addEventListener('keydown', handleKeydown, true);
  document.addEventListener('seeked', handleVideoEvent, true);
  document.addEventListener('pause', handleVideoEvent, true);
  window.addEventListener('scroll', handleScroll, true);
  window.addEventListener('pagehide', flushPending);
}

function detachRecordListeners(): void {
  document.removeEventListener('click', handleRecordClick, true);
  document.removeEventListener('change', handleRecordChange, true);
  document.removeEventListener('keydown', handleKeydown, true);
  document.removeEventListener('seeked', handleVideoEvent, true);
  document.removeEventListener('pause', handleVideoEvent, true);
  window.removeEventListener('scroll', handleScroll, true);
  window.removeEventListener('pagehide', flushPending);
  cancelPending();
}

function applyBuffer(buf: RecBuffer | undefined): void {
  const active = Boolean(buf?.active);
  const rev = buf?.rev ?? 0;
  if (rev >= recRev) {
    recordedSteps = buf?.steps ?? [];
    recStartUrl = buf?.startUrl;
    recRev = rev;
  }
  if (active && !isRecording) {
    isRecording = true;
    attachRecordListeners();
  } else if (!active && isRecording) {
    isRecording = false;
    detachRecordListeners();
  }
}

// Resume recording after navigation / in newly opened tabs.
chrome.storage.local.get([REC_KEY], (r) => applyBuffer(r[REC_KEY] as RecBuffer | undefined));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[REC_KEY]) applyBuffer(changes[REC_KEY].newValue as RecBuffer | undefined);
});

function startRecording(): { ok: boolean; recording: boolean } {
  recordedSteps = [];
  recStartUrl = window.location.href;
  if (!isRecording) {
    isRecording = true;
    attachRecordListeners();
  }
  persistBuffer();
  return { ok: true, recording: true };
}

function stopRecording(): { ok: boolean; steps: WorkflowStep[] } {
  flushPending();
  const snapshot = [...recordedSteps];
  if (isRecording) {
    isRecording = false;
    detachRecordListeners();
  }
  recordedSteps = [];
  persistBuffer();
  return { ok: true, steps: snapshot };
}

// ==================== STEP REPLAY WITH SAFETY GATE (MODE 4) ====================
const lc = (s?: string | null) => normText(s).toLowerCase();

/** Leading identifying phrase (e.g. person's name before a changing message preview/timestamp). */
function leadPhrase(s: string): string {
  const words = s.split(' ').filter(Boolean);
  return words.slice(0, 2).join(' ').slice(0, 24);
}

/** For clicks, the recorded text must still be compatible so we never hit an unrelated element. */
function textCompatible(el: Element, step: WorkflowStep): boolean {
  const want = lc(step.target?.text);
  if (!want || step.action !== 'click') return true;
  const have = lc(el.textContent);
  if (!have) return true;
  const lead = leadPhrase(want);
  return (
    have.includes(want.slice(0, 30)) ||
    want.includes(have.slice(0, 30)) ||
    (lead.length >= 3 && have.includes(lead))
  );
}

/** Resolve the recorded element: selector → id → XPath → stable attributes → exact text. Never guesses further. */
function resolveStepElement(step: WorkflowStep): Element | null {
  const t = step.target;
  const ok = (el: Element | null): el is Element =>
    !!el && (!t || el.tagName.toLowerCase() === t.tag) && textCompatible(el, step);

  try {
    const el = document.querySelector(step.selector);
    if (ok(el)) return el;
  } catch {
    /* invalid selector, fall through */
  }
  if (!t) return null;

  if (t.id) {
    const el = document.getElementById(t.id);
    if (ok(el)) return el;
  }
  if (t.xpath) {
    try {
      const n = document.evaluate(t.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      if (n instanceof Element && ok(n)) return n;
    } catch {
      /* ignore */
    }
  }

  const cands = Array.from(document.getElementsByTagName(t.tag)).filter((el) => ok(el));
  const byAttr = cands.find((el) => {
    if (t.name && el.getAttribute('name') === t.name) return true;
    if (t.ariaLabel && el.getAttribute('aria-label') === t.ariaLabel) return true;
    if (t.placeholder && el.getAttribute('placeholder') === t.placeholder) return true;
    if (t.href && el instanceof HTMLAnchorElement) {
      try {
        const u = new URL(el.href);
        return u.pathname + u.search === t.href;
      } catch {
        return false;
      }
    }
    return false;
  });
  if (byAttr) return byAttr;

  const wantText = lc(t.text);
  if (wantText) {
    const byText = cands.filter((el) => lc(el.textContent) === wantText);
    if (byText.length) {
      return byText.find((el) => isElementVisibleInViewport(el)) ?? byText[0];
    }
    const lead = leadPhrase(wantText);
    if (lead.length >= 3) {
      const byLead = cands.filter((el) => {
        const txt = lc(el.textContent);
        return txt.startsWith(lead) || txt.includes(lead);
      });
      if (byLead.length) {
        return byLead.find((el) => isElementVisibleInViewport(el)) ?? byLead[0];
      }
    }
  }
  return null;
}

/** Event-based wait: resolves as soon as the element appears in the DOM. */
function waitForStepElement(step: WorkflowStep, timeoutMs = 8000): Promise<Element | null> {
  return new Promise((resolve) => {
    const first = resolveStepElement(step);
    if (first) {
      resolve(first);
      return;
    }
    let obs: MutationObserver | null = null;
    let timer = 0;
    const finish = (el: Element | null) => {
      obs?.disconnect();
      window.clearTimeout(timer);
      resolve(el);
    };
    obs = new MutationObserver(() => {
      const el = resolveStepElement(step);
      if (el) finish(el);
    });
    timer = window.setTimeout(() => finish(resolveStepElement(step)), timeoutMs);
    obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  });
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  const proto = Object.getPrototypeOf(el);
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
}

async function replayStep(step: WorkflowStep, confirmed = false): Promise<ReplayStepResult> {
  if (step.action === 'scroll') {
    const [x, y] = (step.value ?? '0,0').split(',').map(Number);
    window.scrollTo({ left: x || 0, top: y || 0, behavior: 'auto' });
    return { ok: true, status: 'executed', matchedText: step.label };
  }

  const el = await waitForStepElement(step);
  if (!el) {
    return {
      ok: false,
      status: 'not_found',
      error: `Could not find "${step.label || step.selector}" on ${window.location.href}`,
    };
  }

  // Hard Credential Boundary: strictly skip password / sensitive inputs
  if (el instanceof HTMLInputElement && (el.type.toLowerCase() === 'password' || isSensitiveField(el))) {
    return {
      ok: false,
      status: 'skipped_sensitive',
      error: 'Hard credential boundary: password/sensitive fields cannot be replayed automatically.',
    };
  }

  const matchedText = resolveLabelText(el);

  if (step.action === 'click') {
    // Mandatory Pre-Submit Safety Gate: never auto-click a final submit without explicit confirmed: true
    if (isFinalSubmitElement(el) && !confirmed) {
      return {
        ok: false,
        status: 'requires_confirmation',
        matchedText,
        error: `Pre-Submit Safety Gate paused before clicking "${matchedText}". Pass confirmed: true after user approval.`,
      };
    }
    if (el instanceof HTMLElement) {
      const clickTarget =
        el instanceof HTMLAnchorElement || el instanceof HTMLButtonElement
          ? el
          : (el.closest('a[href], button') as HTMLElement | null) ?? el;
      clickTarget.scrollIntoView({ behavior: 'auto', block: 'center' });
      // Respond first: the click may navigate away and kill this page's message channel.
      window.setTimeout(() => {
        const opts = { bubbles: true, cancelable: true, view: window };
        clickTarget.dispatchEvent(new PointerEvent('pointerdown', opts));
        clickTarget.dispatchEvent(new MouseEvent('mousedown', opts));
        clickTarget.dispatchEvent(new PointerEvent('pointerup', opts));
        clickTarget.dispatchEvent(new MouseEvent('mouseup', opts));
        clickTarget.click();
      }, 40);
      return { ok: true, status: 'executed', matchedText };
    }
  }

  if (step.action === 'check' && el instanceof HTMLInputElement) {
    el.checked = step.value === undefined ? true : step.value === 'true';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, status: 'executed', matchedText };
  }

  if (
    step.action === 'fill' &&
    (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)
  ) {
    el.scrollIntoView({ behavior: 'auto', block: 'center' });
    el.focus();
    setNativeValue(el, step.value ?? '');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, status: 'executed', matchedText };
  }

  if (step.action === 'keypress') {
    const key = step.value || 'Enter';
    const target = el as HTMLElement;
    target.focus?.();
    window.setTimeout(() => {
      const init = { key, code: key, keyCode: 13, which: 13, bubbles: true, cancelable: true };
      const notPrevented = target.dispatchEvent(new KeyboardEvent('keydown', init));
      target.dispatchEvent(new KeyboardEvent('keypress', init));
      target.dispatchEvent(new KeyboardEvent('keyup', init));
      // Synthetic key events don't submit forms natively, so do it for the Enter case.
      if (notPrevented && key === 'Enter') {
        const form = (target as HTMLInputElement).form;
        if (form) {
          const searchy = form.getAttribute('role') === 'search' || /search/i.test(form.getAttribute('action') ?? '');
          if (target instanceof HTMLInputElement || (target instanceof HTMLTextAreaElement && searchy)) form.requestSubmit();
        }
      }
    }, 40);
    return { ok: true, status: 'executed', matchedText };
  }

  if (step.action === 'seek' && el instanceof HTMLVideoElement) {
    if (el.readyState < 1) {
      await new Promise<void>((resolve) => {
        el.addEventListener('loadedmetadata', () => resolve(), { once: true });
        window.setTimeout(resolve, 5000);
      });
    }
    el.currentTime = Number(step.value ?? 0);
    return { ok: true, status: 'executed', matchedText: step.label };
  }

  return {
    ok: false,
    status: 'not_found',
    error: `Element "${step.selector}" does not support action "${step.action}".`,
  };
}

chrome.runtime.onMessage.addListener((message: PandaMessage, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false;

  switch (message.type) {
    case 'PING_PAGE': {
      sendResponse(buildPageContext());
      return false;
    }
    case 'HIGHLIGHT_ELEMENT': {
      const res = highlightElement(message.payload);
      sendResponse(res);
      return false;
    }
    case 'CLEAR_HIGHLIGHTS': {
      clearHighlights();
      sendResponse({ ok: true });
      return false;
    }
    case 'EXTRACT_VISIBLE_DOM': {
      sendResponse({
        elements: extractVisibleInteractiveDom(),
        url: window.location.href,
      });
      return false;
    }
    case 'FILL_SAFE_FIELDS': {
      const result = fillSafeFields(message.payload.fields);
      sendResponse(result);
      return false;
    }
    case 'START_RECORDING': {
      sendResponse(startRecording());
      return false;
    }
    case 'STOP_RECORDING': {
      sendResponse(stopRecording());
      return false;
    }
    case 'REPLAY_STEP': {
      replayStep(message.payload.step, Boolean(message.payload.confirmed)).then(sendResponse);
      return true;
    }
    default:
      return false;
  }
});
