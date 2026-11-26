import type {
  ExcludedScannedField,
  FocusScanPageRequest,
  FocusScanPageResponse,
  FocusScanStats,
  ScannedField,
  ScannedFieldKind,
  ScannedOption,
} from '../features/forms/focus/scanMessages';
import { getSensitiveFieldReason, isOtpInputMetadata } from '../features/forms/focus/fieldSafety';

const MAX_FIELDS = 500;

interface ScanContext {
  elements: ScannedField[];
  excluded: ExcludedScannedField[];
  stats: FocusScanStats;
  visitedRoots: Set<Document | ShadowRoot>;
  scannedControls: number;
  nextId: number;
  pageTitle: string;
}

interface Candidate {
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  root: Document | ShadowRoot;
  selector: string;
  label: string;
  placeholder: string;
  name: string;
  type: string;
  autocomplete: string;
  required: boolean;
  disabled: boolean;
  readOnly: boolean;
  hasValue: boolean;
  groupHint: string;
  kind: ScannedFieldKind;
  inputType: string;
  options: ScannedOption[];
}

function isInput(el: Element): el is HTMLInputElement {
  return el.tagName.toLowerCase() === 'input';
}

function isTextArea(el: Element): el is HTMLTextAreaElement {
  return el.tagName.toLowerCase() === 'textarea';
}

function isSelect(el: Element): el is HTMLSelectElement {
  return el.tagName.toLowerCase() === 'select';
}

function rootQuery(root: Document | ShadowRoot, selector: string): Element[] {
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch {
    return [];
  }
}

function escapeCss(value: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);
}

function selectorMatches(root: Document | ShadowRoot, selector: string): number {
  try {
    return root.querySelectorAll(selector).length;
  } catch {
    return 0;
  }
}

function buildUniqueSelector(element: Element, root: Document | ShadowRoot): string {
  if (element.id) {
    const byId = `#${escapeCss(element.id)}`;
    if (selectorMatches(root, byId) === 1) return byId;
  }

  const tag = element.tagName.toLowerCase();
  const name = element.getAttribute('name');
  if (name) {
    const byName = `${tag}[name="${escapeCss(name)}"]`;
    if (selectorMatches(root, byName) === 1) return byName;
  }

  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current.getRootNode() === root) {
    const currentTag = current.tagName.toLowerCase();
    const parentElement: Element | null = current.parentElement;
    if (!parentElement) {
      parts.unshift(currentTag);
      break;
    }
    const siblings: Element[] = Array.from(parentElement.children).filter(
      (child: Element) => child.tagName === currentTag.toUpperCase()
    );
    const currentIndex = siblings.indexOf(current);
    parts.unshift(`${currentTag}:nth-of-type(${currentIndex + 1})`);
    const path = parts.join(' > ');
    if (selectorMatches(root, path) === 1) return path;
    current = parentElement;
  }
  return parts.join(' > ') || tag;
}

function textFromIds(root: Document | ShadowRoot, ids: string): string {
  return ids
    .split(/\s+/)
    .map((id) => {
      try {
        return root.querySelector(`#${escapeCss(id)}`)?.textContent?.trim() ?? '';
      } catch {
        return '';
      }
    })
    .filter(Boolean)
    .join(' ');
}

function resolveLabel(el: Element, root: Document | ShadowRoot): string {
  if (el.id) {
    try {
      const label = root.querySelector(`label[for="${escapeCss(el.id)}"]`);
      if (label?.textContent?.trim()) return label.textContent.trim();
    } catch {
      // Continue through the label fallbacks.
    }
  }

  const wrapping = el.closest('label')?.textContent?.trim();
  if (wrapping) return wrapping;

  const ariaLabelledBy = el.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const labelledText = textFromIds(root, ariaLabelledBy);
    if (labelledText) return labelledText;
  }

  const ariaLabel = el.getAttribute('aria-label')?.trim();
  if (ariaLabel) return ariaLabel;

  const fieldsetLegend = el.closest('fieldset')?.querySelector(':scope > legend')?.textContent?.trim();
  if (fieldsetLegend) return fieldsetLegend;

  const placeholder = el.getAttribute('placeholder')?.trim();
  if (placeholder) return placeholder;

  let sibling = el.previousElementSibling;
  while (sibling) {
    const text = sibling.textContent?.trim();
    if (text) return text.slice(0, 120);
    sibling = sibling.previousElementSibling;
  }

  return el.getAttribute('name')?.trim() || 'Form field';
}

function precedingHeading(el: Element): string {
  let current: Element | null = el;
  while (current) {
    let sibling = current.previousElementSibling;
    while (sibling) {
      if (/^H[1-6]$/.test(sibling.tagName)) {
        const text = sibling.textContent?.trim();
        if (text) return text;
      }
      const nested = sibling.querySelector('h1, h2, h3, h4, h5, h6');
      if (nested?.textContent?.trim()) return nested.textContent.trim();
      sibling = sibling.previousElementSibling;
    }
    current = current.parentElement;
  }
  return '';
}

function groupHintFor(el: Element): string {
  const fieldsetLegend = el.closest('fieldset')?.querySelector(':scope > legend')?.textContent?.trim();
  if (fieldsetLegend) return fieldsetLegend;
  return (
    precedingHeading(el) ||
    el.closest('section[aria-label], [role="group"][aria-label], [aria-label]')?.getAttribute('aria-label')?.trim() ||
    ''
  );
}

function hasHiddenAncestor(el: Element): boolean {
  let current: Element | null = el;
  while (current) {
    if (current.hasAttribute('hidden')) return true;
    try {
      const style = current.ownerDocument.defaultView?.getComputedStyle(current);
      if (style?.display === 'none' || style?.visibility === 'hidden') return true;
    } catch {
      return true;
    }
    if (current.parentElement) {
      current = current.parentElement;
      continue;
    }
    const root = current.getRootNode();
    current = root.nodeType === Node.DOCUMENT_FRAGMENT_NODE && 'host' in root
      ? (root as ShadowRoot).host
      : null;
  }
  return false;
}

function sensitiveReason(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  label: string
): string | null {
  const style = el.ownerDocument.defaultView?.getComputedStyle(el) as
    | (CSSStyleDeclaration & { webkitTextSecurity?: string })
    | undefined;
  try {
    return getSensitiveFieldReason({
      type: isInput(el) ? (el.getAttribute('type') ?? 'text') : '',
      autocomplete: el.getAttribute('autocomplete') ?? '',
      name: el.getAttribute('name') ?? '',
      id: el.getAttribute('id') ?? '',
      label,
      placeholder: el.getAttribute('placeholder') ?? '',
      ariaLabel: el.getAttribute('aria-label') ?? '',
      webkitTextSecurity: style?.webkitTextSecurity,
    });
  } catch {
    return 'could not verify field safety';
  }
}

function isOtpBox(el: HTMLInputElement): boolean {
  return isOtpInputMetadata(
    el.maxLength,
    el.getAttribute('type') ?? 'text',
    el.getAttribute('inputmode') ?? '',
    el.getAttribute('pattern') ?? ''
  );
}

function findOtpRows(root: Document | ShadowRoot): Set<HTMLInputElement> {
  const result = new Set<HTMLInputElement>();
  const allInputs = rootQuery(root, 'input').filter(isInput);
  const byParent = new Map<Element, HTMLInputElement[]>();
  allInputs.forEach((input) => {
    const parent = input.parentElement;
    if (!parent) return;
    const siblings = byParent.get(parent) ?? [];
    siblings.push(input);
    byParent.set(parent, siblings);
  });

  for (const siblings of byParent.values()) {
    let run: HTMLInputElement[] = [];
    const flush = () => {
      if (run.length >= 4 && run.length <= 8) run.forEach((input) => result.add(input));
      run = [];
    };
    for (const input of siblings) {
      if (isOtpBox(input) && !hasHiddenAncestor(input)) run.push(input);
      else flush();
    }
    flush();
  }
  return result;
}

function optionLabelFor(el: Element, root: Document | ShadowRoot): string {
  return resolveLabel(el, root).replace(/\s+/g, ' ').trim();
}

function visibleOptions(el: HTMLSelectElement, root: Document | ShadowRoot): ScannedOption[] {
  return Array.from(el.options)
    .filter((option) => option.value.trim() !== '' && option.textContent?.trim())
    .map((option) => ({
      value: option.value,
      label: option.textContent?.trim() ?? option.value,
      selector: buildUniqueSelector(option, root),
    }));
}

function createCandidate(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  root: Document | ShadowRoot,
  label: string
): Candidate | null {
  const selector = buildUniqueSelector(el, root);
  const placeholder = el.getAttribute('placeholder') ?? '';
  const name = el.getAttribute('name') ?? '';
  const type = isInput(el) ? (el.getAttribute('type') ?? 'text').toLowerCase() :
    isSelect(el) ? (el.multiple ? 'select-multiple' : 'select') : 'textarea';
  const required = el.hasAttribute('required') || el.getAttribute('aria-required') === 'true';
  const disabled = 'disabled' in el && el.disabled;
  const readOnly = 'readOnly' in el && el.readOnly;
  const groupHint = groupHintFor(el);
  const options = isSelect(el)
    ? visibleOptions(el, root)
    : isInput(el) && (type === 'checkbox' || type === 'radio')
      ? [{ value: el.value, label: optionLabelFor(el, root), selector }]
      : [];

  if (isSelect(el)) {
    return {
      element: el,
      root,
      selector,
      label,
      placeholder,
      name,
      type,
      autocomplete: el.getAttribute('autocomplete') ?? '',
      required,
      disabled,
      readOnly,
      hasValue: el.multiple ? Array.from(el.selectedOptions).some((option) => option.value !== '') : el.value !== '',
      groupHint,
      kind: el.multiple ? 'multiselect' : 'select',
      inputType: el.multiple ? 'multiselect' : 'select',
      options,
    };
  }
  if (isTextArea(el)) {
    return {
      element: el,
      root,
      selector,
      label,
      placeholder,
      name,
      type,
      autocomplete: el.getAttribute('autocomplete') ?? '',
      required,
      disabled,
      readOnly,
      hasValue: el.value !== '',
      groupHint,
      kind: 'textarea',
      inputType: 'textarea',
      options,
    };
  }

  const kind: ScannedFieldKind = type === 'checkbox' ? 'checkbox' : type === 'radio' ? 'radio-group' : 'text';
  return {
    element: el,
    root,
    selector,
    label,
    placeholder,
    name,
    type,
    autocomplete: el.getAttribute('autocomplete') ?? '',
    required,
    disabled,
    readOnly,
    hasValue: type === 'checkbox' || type === 'radio' ? el.checked : el.value !== '',
    groupHint,
    kind,
    inputType: ['email', 'tel', 'number', 'date'].includes(type) ? type : 'text',
    options,
  };
}

function isSkippedControl(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): boolean {
  if (isInput(el) && (el.getAttribute('type') ?? '').toLowerCase() === 'hidden') return false;
  if (hasHiddenAncestor(el)) return true;
  if (isInput(el)) {
    const type = (el.getAttribute('type') ?? 'text').toLowerCase();
    if (['submit', 'button', 'reset', 'image'].includes(type)) return true;
  }
  return false;
}

function appendExcluded(context: ScanContext, label: string, reason: string): void {
  context.excluded.push({ label: label || 'Sensitive field', reason });
}

function groupCandidates(candidates: Candidate[], context: ScanContext): void {
  const grouped = new Map<string, Candidate[]>();
  const emitted = new Set<Candidate>();

  candidates.forEach((candidate) => {
    const type = candidate.type;
    if (!candidate.name || (type !== 'radio' && type !== 'checkbox')) return;
    const key = `${candidate.root === document ? 'document' : 'root'}|${type}|${candidate.name}`;
    const group = grouped.get(key) ?? [];
    group.push(candidate);
    grouped.set(key, group);
  });

  for (const group of grouped.values()) {
    const first = group[0];
    if (!first || group.length < 2) continue;
    const optionType = first.type;
    const kind: ScannedFieldKind = optionType === 'radio' ? 'radio-group' : 'checkbox-group';
    const selector = group.map((candidate) => candidate.selector).join(', ');
    const options = group.flatMap((candidate) => candidate.options);
    const legend = first.element.closest('fieldset')?.querySelector(':scope > legend')?.textContent?.trim();
    context.elements.push({
      id: `focus-scan-${context.nextId++}`,
      selector,
      kind,
      inputType: optionType,
      label: legend || first.name || first.label,
      placeholder: '',
      name: first.name,
      required: group.some((candidate) => candidate.required),
      disabled: group.every((candidate) => candidate.disabled),
      readOnly: false,
      hasValue: group.some((candidate) => candidate.hasValue),
      groupHint: first.groupHint,
      autocomplete: first.autocomplete,
      options,
    });
    group.forEach((candidate) => emitted.add(candidate));
  }

  for (const candidate of candidates) {
    if (emitted.has(candidate)) continue;
    context.elements.push({
      id: `focus-scan-${context.nextId++}`,
      selector: candidate.selector,
      kind: candidate.kind,
      inputType: candidate.inputType,
      label: candidate.label,
      placeholder: candidate.placeholder,
      name: candidate.name,
      required: candidate.required,
      disabled: candidate.disabled,
      readOnly: candidate.readOnly,
      hasValue: candidate.hasValue,
      groupHint: candidate.groupHint,
      autocomplete: candidate.autocomplete,
      options: candidate.options,
    });
  }
}

function scanRoot(root: Document | ShadowRoot, context: ScanContext): void {
  if (context.visitedRoots.has(root) || context.stats.capped) return;
  context.visitedRoots.add(root);
  const candidates: Candidate[] = [];
  const controls = rootQuery(root, 'input, select, textarea');
  const otpBoxes = findOtpRows(root);

  for (const node of controls) {
    if (context.scannedControls >= MAX_FIELDS) {
      context.stats.capped = true;
      break;
    }
    if (!isInput(node) && !isSelect(node) && !isTextArea(node)) continue;
    if (isSkippedControl(node)) continue;
    context.scannedControls += 1;

    const label = resolveLabel(node, root);
    const reason = sensitiveReason(node, label);
    if (reason) {
      appendExcluded(context, label, reason);
      continue;
    }
    if (isInput(node) && otpBoxes.has(node)) {
      appendExcluded(context, label || 'One-time code', 'one-time code entry');
      continue;
    }
    if (isInput(node) && (node.getAttribute('type') ?? '').toLowerCase() === 'file') {
      appendExcluded(context, label, 'file upload, you choose the file');
      continue;
    }

    const candidate = createCandidate(node, root, label);
    if (candidate) candidates.push(candidate);
  }
  groupCandidates(candidates, context);

  for (const node of rootQuery(root, '*')) {
    if (node.shadowRoot) {
      context.stats.shadowRoots += 1;
      scanRoot(node.shadowRoot, context);
    }
    if (node.tagName.toLowerCase() === 'iframe') {
      context.stats.frames += 1;
      try {
        const frameDocument = (node as HTMLIFrameElement).contentDocument;
        if (!frameDocument) {
          context.stats.skippedFrames += 1;
          continue;
        }
        scanRoot(frameDocument, context);
      } catch {
        context.stats.skippedFrames += 1;
      }
    }
    if (context.stats.capped) return;
  }
}

function scanPage(): FocusScanPageResponse {
  const context: ScanContext = {
    elements: [],
    excluded: [],
    stats: { frames: 0, skippedFrames: 0, shadowRoots: 0, capped: false },
    visitedRoots: new Set(),
    scannedControls: 0,
    nextId: 0,
    pageTitle: document.title || window.location.hostname,
  };
  scanRoot(document, context);
  return {
    ok: true,
    elements: context.elements.slice(0, MAX_FIELDS),
    excluded: context.excluded,
    stats: context.stats,
    pageTitle: context.pageTitle,
  };
}

function isScanRequest(message: unknown): message is FocusScanPageRequest {
  return typeof message === 'object' && message !== null &&
    'type' in message && message.type === 'FOCUS_SCAN_PAGE';
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isScanRequest(message)) return false;
  try {
    sendResponse(scanPage());
  } catch {
    sendResponse({
      ok: false,
      elements: [],
      excluded: [],
      stats: { frames: 0, skippedFrames: 0, shadowRoots: 0, capped: false },
      pageTitle: document.title || '',
      reason: 'The page could not be scanned safely. Please try again.',
    } satisfies FocusScanPageResponse);
  }
  return false;
});
