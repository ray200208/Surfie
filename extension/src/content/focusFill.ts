import { getSensitiveFieldReason, isOtpInputMetadata } from '../features/forms/focus/fieldSafety';
import type {
  FocusFillFieldsRequest,
  FocusFillFieldsResponse,
  FocusFillItem,
} from '../features/forms/focus/fillMessages';
import type { ScannedFieldKind } from '../features/forms/focus/scanMessages';

function isInput(el: Element): el is HTMLInputElement {
  return el.tagName.toLowerCase() === 'input';
}

function isSelect(el: Element): el is HTMLSelectElement {
  return el.tagName.toLowerCase() === 'select';
}

function isTextArea(el: Element): el is HTMLTextAreaElement {
  return el.tagName.toLowerCase() === 'textarea';
}

function getRoots(root: Document | ShadowRoot, visited: Set<Document | ShadowRoot> = new Set()): (Document | ShadowRoot)[] {
  if (visited.has(root)) return [];
  visited.add(root);
  const roots: (Document | ShadowRoot)[] = [root];
  for (const node of Array.from(root.querySelectorAll('*'))) {
    if (node.shadowRoot) roots.push(...getRoots(node.shadowRoot, visited));
    if (node.tagName.toLowerCase() === 'iframe') {
      try {
        const frameDocument = (node as HTMLIFrameElement).contentDocument;
        if (frameDocument) roots.push(...getRoots(frameDocument, visited));
      } catch {
        // Cross-origin frames are not accessible from this content script.
      }
    }
  }
  return roots;
}

function queryAcrossRoots(selector: string): Element[] {
  const found: Element[] = [];
  for (const root of getRoots(document)) {
    try {
      found.push(...Array.from(root.querySelectorAll(selector)));
    } catch {
      return [];
    }
  }
  return Array.from(new Set(found));
}

function textFromIds(el: Element, ids: string): string {
  const root = el.getRootNode();
  if (root.nodeType !== Node.DOCUMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return '';
  const queryRoot = root as Document | ShadowRoot;
  return ids.split(/\s+/).map((id) => {
    try {
      return queryRoot.querySelector(`#${CSS.escape(id)}`)?.textContent?.trim() ?? '';
    } catch {
      return '';
    }
  }).filter(Boolean).join(' ');
}

function labelFor(el: Element): string {
  if (el.id) {
    try {
      const label = el.getRootNode() instanceof Document || el.getRootNode() instanceof ShadowRoot
        ? (el.getRootNode() as Document | ShadowRoot).querySelector(`label[for="${CSS.escape(el.id)}"]`)
        : null;
      if (label?.textContent?.trim()) return label.textContent.trim();
    } catch {
      // Continue through fallbacks.
    }
  }
  const wrapping = el.closest('label')?.textContent?.trim();
  if (wrapping) return wrapping;
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const text = textFromIds(el, labelledBy);
    if (text) return text;
  }
  return el.getAttribute('aria-label') ?? el.getAttribute('placeholder') ?? '';
}

function getSensitiveReason(el: Element): string | null {
  const input = isInput(el) ? el : null;
  let webkitTextSecurity: string | undefined;
  try {
    const style = el.ownerDocument.defaultView?.getComputedStyle(el) as
      | (CSSStyleDeclaration & { webkitTextSecurity?: string })
      | undefined;
    webkitTextSecurity = style?.webkitTextSecurity;
  } catch {
    return 'could not verify field safety';
  }
  return getSensitiveFieldReason({
    type: input?.getAttribute('type') ?? (isSelect(el) ? 'select' : isTextArea(el) ? 'textarea' : ''),
    autocomplete: el.getAttribute('autocomplete') ?? '',
    name: el.getAttribute('name') ?? '',
    id: el.getAttribute('id') ?? '',
    label: labelFor(el),
    placeholder: el.getAttribute('placeholder') ?? '',
    ariaLabel: el.getAttribute('aria-label') ?? '',
    webkitTextSecurity,
  });
}

function isOtpBox(el: HTMLInputElement): boolean {
  return isOtpInputMetadata(
    el.maxLength,
    el.getAttribute('type') ?? 'text',
    el.getAttribute('inputmode') ?? '',
    el.getAttribute('pattern') ?? ''
  );
}

function isOtpRowMember(el: Element): boolean {
  if (!isInput(el) || !isOtpBox(el) || !el.parentElement) return false;
  const siblings = Array.from(el.parentElement.children).filter(isInput);
  let run: HTMLInputElement[] = [];
  for (const sibling of [...siblings, document.createElement('input')]) {
    if (sibling === el) {
      // Continue evaluating the same contiguous run to learn its full size.
    }
    if (isOtpBox(sibling)) run.push(sibling);
    else {
      if (run.includes(el) && run.length >= 4 && run.length <= 8) return true;
      run = [];
    }
  }
  return run.includes(el) && run.length >= 4 && run.length <= 8;
}

function dispatch(el: Element, eventName: 'input' | 'change'): void {
  const EventConstructor = el.ownerDocument.defaultView?.Event ?? Event;
  el.dispatchEvent(new EventConstructor(eventName, { bubbles: true }));
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  dispatch(el, 'input');
  dispatch(el, 'change');
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function selectedTargetOption(select: HTMLSelectElement, value: string): HTMLOptionElement | undefined {
  const normalizedValue = normalize(value);
  return Array.from(select.options).find((option) => normalize(option.value) === normalizedValue) ??
    Array.from(select.options).find((option) => normalize(option.textContent ?? '') === normalizedValue);
}

function splitValues(value: string): string[] {
  return value === '' ? [] : value.split('\n').filter(Boolean);
}

function getOptionControl(item: FocusFillItem, value: string): HTMLInputElement | undefined {
  const optionSelector = item.optionSelectors?.[value];
  const bySelector = optionSelector ? queryAcrossRoots(optionSelector).find(isInput) : undefined;
  if (bySelector) return bySelector;
  return queryAcrossRoots(item.selector).filter(isInput).find((input) => normalize(input.value) === normalize(value));
}

function fillItem(item: FocusFillItem): string | { selector: string; reason: string } {
  const controls = queryAcrossRoots(item.selector);
  if (controls.length === 0) return { selector: item.selector, reason: 'field was not found' };

  if (controls.some((control) => getSensitiveReason(control) || isOtpRowMember(control))) {
    return { selector: item.selector, reason: 'sensitive field skipped' };
  }
  if (controls.some((control) => isInput(control) && ['file', 'button', 'submit', 'reset', 'image'].includes(control.type.toLowerCase()))) {
    return { selector: item.selector, reason: 'field type is not supported for filling' };
  }
  if (controls.some((control) =>
    ('disabled' in control && Boolean(control.disabled)) ||
    ('readOnly' in control && Boolean(control.readOnly))
  )) {
    return { selector: item.selector, reason: 'field is disabled or read-only' };
  }

  if (item.kind === 'text' || item.kind === 'textarea') {
    const control = controls[0];
    if (!control || (!isInput(control) && !isTextArea(control))) {
      return { selector: item.selector, reason: 'field type changed since scan' };
    }
    const currentValue = control.value;
    if (currentValue !== '' && currentValue !== item.value) {
      return { selector: item.selector, reason: 'page already has a value' };
    }
    if (currentValue !== item.value) setNativeValue(control, item.value);
    return item.selector;
  }

  if (item.kind === 'select' || item.kind === 'multiselect') {
    const control = controls.find(isSelect);
    if (!control) return { selector: item.selector, reason: 'field type changed since scan' };
    const targets = item.kind === 'multiselect' ? splitValues(item.value) : [item.value];
    const targetOptions = targets.map((value) => selectedTargetOption(control, value));
    if (targetOptions.some((option) => option === undefined)) {
      return { selector: item.selector, reason: 'matching option was not found' };
    }
    const desiredValues = new Set(targetOptions.map((option) => option!.value));
    const selectedValues = Array.from(control.selectedOptions)
      .map((option) => option.value)
      .filter((value) => value !== '');
    if (selectedValues.length > 0 &&
        (selectedValues.length !== desiredValues.size || selectedValues.some((value) => !desiredValues.has(value)))) {
      return { selector: item.selector, reason: 'page already has a value' };
    }
    for (const option of Array.from(control.options)) option.selected = desiredValues.has(option.value);
    dispatch(control, 'change');
    return item.selector;
  }

  if (item.kind === 'checkbox') {
    const control = controls.find(isInput);
    if (!control || control.type.toLowerCase() !== 'checkbox') {
      return { selector: item.selector, reason: 'field type changed since scan' };
    }
    const desired = item.value === 'true';
    if (control.checked && !desired) return { selector: item.selector, reason: 'page already has a value' };
    if (control.checked !== desired) control.click();
    return item.selector;
  }

  if (item.kind === 'radio-group') {
    const target = getOptionControl(item, item.value);
    if (!target || target.type.toLowerCase() !== 'radio') {
      return { selector: item.selector, reason: 'matching radio option was not found' };
    }
    const selected = controls.filter(isInput).find((input) => input.type.toLowerCase() === 'radio' && input.checked);
    if (selected && selected !== target) return { selector: item.selector, reason: 'page already has a value' };
    if (!target.checked) target.click();
    return item.selector;
  }

  if (item.kind === 'checkbox-group') {
    const checkboxControls = controls.filter(isInput).filter((input) => input.type.toLowerCase() === 'checkbox');
    const chosenValues = new Set(splitValues(item.value));
    const selectedValues = checkboxControls.filter((input) => input.checked).map((input) => input.value);
    if (selectedValues.length > 0 &&
        (selectedValues.length !== chosenValues.size || selectedValues.some((value) => !chosenValues.has(value)))) {
      return { selector: item.selector, reason: 'page already has a value' };
    }
    for (const value of chosenValues) {
      const option = getOptionControl(item, value);
      if (!option || option.type.toLowerCase() !== 'checkbox') {
        return { selector: item.selector, reason: 'matching checkbox option was not found' };
      }
    }
    for (const option of checkboxControls) {
      const shouldBeChecked = chosenValues.has(option.value);
      if (option.checked !== shouldBeChecked) option.click();
    }
    return item.selector;
  }

  return { selector: item.selector, reason: 'unsupported field type' };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isKind(value: unknown): value is ScannedFieldKind {
  return value === 'text' || value === 'textarea' || value === 'select' || value === 'multiselect' ||
    value === 'checkbox' || value === 'radio-group' || value === 'checkbox-group';
}

function isFillRequest(message: unknown): message is FocusFillFieldsRequest {
  if (!isRecord(message) || message.type !== 'FOCUS_FILL_FIELDS' || !Array.isArray(message.items)) return false;
  return message.items.every((item) => isRecord(item) && typeof item.selector === 'string' &&
    isKind(item.kind) && typeof item.value === 'string');
}

function fillFields(items: FocusFillItem[]): FocusFillFieldsResponse {
  const filled: string[] = [];
  const skipped: { selector: string; reason: string }[] = [];
  for (const item of items) {
    try {
      const result = fillItem(item);
      if (typeof result === 'string') filled.push(result);
      else skipped.push(result);
    } catch {
      skipped.push({ selector: item.selector, reason: 'field could not be filled safely' });
    }
  }
  return { filled, skipped };
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isFillRequest(message)) return false;
  sendResponse(fillFields(message.items));
  return false;
});
