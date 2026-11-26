import type { PandaMessage, ReplayStepResult } from '../shared/messages';
import type {
  DomainType,
  FillFieldInstruction,
  FillFieldsResult,
  PageContext,
  VisibleDomElement,
  WorkflowStep,
} from '../shared/types';
import { clearHighlights, highlightElement } from './shadowOverlay';
import './focusSpotlight';
import './focusScan';

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

// ==================== CLICK & INPUT RECORDING (MODE 4) ====================
let isRecording = false;
let recordedSteps: WorkflowStep[] = [];

function recordOrUpdateStep(step: WorkflowStep): void {
  const prev = recordedSteps[recordedSteps.length - 1];
  if (prev && prev.selector === step.selector && prev.action === step.action) {
    recordedSteps[recordedSteps.length - 1] = step;
    return;
  }
  recordedSteps.push(step);
}

function handleRecordClick(event: MouseEvent): void {
  if (!isRecording) return;
  const target = event.target instanceof Element ? event.target.closest('button, a, input[type="submit"], input[type="button"], [role="button"]') : null;
  if (!target) return;
  if (target.closest('#pandapilot-shadow-root')) return;

  recordOrUpdateStep({
    selector: buildSelectorForElement(target),
    action: 'click',
    label: resolveLabelText(target),
  });
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

  if (target instanceof HTMLInputElement && (target.type === 'checkbox' || target.type === 'radio')) {
    recordOrUpdateStep({
      selector: buildSelectorForElement(target),
      action: 'check',
      value: String(target.checked),
      label: resolveLabelText(target),
    });
    return;
  }

  recordOrUpdateStep({
    selector: buildSelectorForElement(target),
    action: 'fill',
    value: target.value,
    label: resolveLabelText(target),
  });
}

function startRecording(): { ok: boolean; recording: boolean } {
  if (!isRecording) {
    recordedSteps = [];
    isRecording = true;
    document.addEventListener('click', handleRecordClick, true);
    document.addEventListener('change', handleRecordChange, true);
  }
  return { ok: true, recording: true };
}

function stopRecording(): { ok: boolean; steps: WorkflowStep[] } {
  if (isRecording) {
    isRecording = false;
    document.removeEventListener('click', handleRecordClick, true);
    document.removeEventListener('change', handleRecordChange, true);
  }
  const snapshot = [...recordedSteps];
  recordedSteps = [];
  return { ok: true, steps: snapshot };
}

// ==================== STEP REPLAY WITH SAFETY GATE (MODE 4) ====================
function replayStep(step: WorkflowStep, confirmed = false): ReplayStepResult {
  let el: Element | null = null;
  try {
    el = document.querySelector(step.selector);
  } catch {
    return { ok: false, status: 'not_found', error: `Invalid CSS selector: ${step.selector}` };
  }

  if (!el) {
    return { ok: false, status: 'not_found', error: `Element not found: ${step.selector}` };
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
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.click();
      return { ok: true, status: 'executed', matchedText };
    }
  }

  if (step.action === 'check' && el instanceof HTMLInputElement) {
    const desired = step.value === undefined ? true : step.value === 'true';
    el.checked = desired;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, status: 'executed', matchedText };
  }

  if (
    step.action === 'fill' &&
    (el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement)
  ) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.focus();
    el.value = step.value ?? '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, status: 'executed', matchedText };
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
      sendResponse(replayStep(message.payload.step, Boolean(message.payload.confirmed)));
      return false;
    }
    default:
      return false;
  }
});
