import type {
  FocusSpotlightMessage,
  FocusSpotlightResponse,
} from '../features/forms/focus/spotlightMessages';

const HOST_ID = 'pandapilot-focus-spotlight-host';
const SVG_NS = 'http://www.w3.org/2000/svg';

let activeElements: Element[] = [];
let repositionHandler: (() => void) | null = null;

function clearOverlay(): void {
  if (repositionHandler) {
    window.removeEventListener('scroll', repositionHandler, true);
    window.removeEventListener('resize', repositionHandler);
    repositionHandler = null;
  }
  activeElements = [];
  document.getElementById(HOST_ID)?.remove();
}

function createSvgElement<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, tag);
}

function showOverlay(elements: Element[], label?: string): void {
  clearOverlay();
  activeElements = elements;

  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.position = 'fixed';
  host.style.inset = '0';
  host.style.zIndex = '2147483647';
  host.style.pointerEvents = 'none';
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    .pp-focus-overlay { position: fixed; inset: 0; width: 100vw; height: 100vh; pointer-events: none; }
    .pp-focus-label {
      position: fixed; max-width: min(320px, calc(100vw - 24px));
      padding: 7px 11px; border-radius: 8px;
      background: linear-gradient(135deg, #D9433B 0%, #9B2257 100%);
      color: #FFFFFF; font: 600 12px/1.35 Inter, system-ui, sans-serif;
      box-shadow: 0 8px 20px rgba(30, 27, 75, 0.24);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      pointer-events: none;
    }
  `;
  const svg = createSvgElement('svg');
  svg.classList.add('pp-focus-overlay');
  svg.setAttribute('aria-hidden', 'true');
  const defs = createSvgElement('defs');
  const mask = createSvgElement('mask');
  mask.id = 'pp-focus-cutouts';
  mask.setAttribute('maskUnits', 'userSpaceOnUse');
  mask.setAttribute('maskContentUnits', 'userSpaceOnUse');
  const maskBackground = createSvgElement('rect');
  maskBackground.setAttribute('fill', '#FFFFFF');
  mask.appendChild(maskBackground);
  const cutouts = elements.map(() => createSvgElement('rect'));
  for (const cutout of cutouts) {
    cutout.setAttribute('rx', '10');
    cutout.setAttribute('fill', '#000000');
    mask.appendChild(cutout);
  }
  defs.appendChild(mask);
  svg.appendChild(defs);

  const dimmer = createSvgElement('rect');
  dimmer.setAttribute('fill', 'rgba(30, 27, 75, 0.45)');
  dimmer.setAttribute('mask', 'url(#pp-focus-cutouts)');
  svg.appendChild(dimmer);

  const rings = elements.map(() => createSvgElement('rect'));
  for (const ring of rings) {
    ring.setAttribute('fill', 'none');
    ring.setAttribute('stroke', '#D9433B');
    ring.setAttribute('stroke-width', '2');
    ring.setAttribute('rx', '10');
    ring.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(ring);
  }

  const badge = document.createElement('div');
  badge.className = 'pp-focus-label';
  badge.textContent = label ?? 'Focus field';
  shadow.append(style, svg, badge);

  const updatePosition = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    maskBackground.setAttribute('x', '0');
    maskBackground.setAttribute('y', '0');
    maskBackground.setAttribute('width', String(width));
    maskBackground.setAttribute('height', String(height));
    dimmer.setAttribute('x', '0');
    dimmer.setAttribute('y', '0');
    dimmer.setAttribute('width', String(width));
    dimmer.setAttribute('height', String(height));

    const visibleRects: DOMRect[] = [];
    activeElements.forEach((element, index) => {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        rings[index].setAttribute('width', '0');
        rings[index].setAttribute('height', '0');
        cutouts[index].setAttribute('width', '0');
        cutouts[index].setAttribute('height', '0');
        return;
      }
      visibleRects.push(rect);
      const x = rect.left - 5;
      const y = rect.top - 5;
      const ringWidth = rect.width + 10;
      const ringHeight = rect.height + 10;
      cutouts[index].setAttribute('x', String(x));
      cutouts[index].setAttribute('y', String(y));
      cutouts[index].setAttribute('width', String(ringWidth));
      cutouts[index].setAttribute('height', String(ringHeight));

      rings[index].setAttribute('x', String(x));
      rings[index].setAttribute('y', String(y));
      rings[index].setAttribute('width', String(ringWidth));
      rings[index].setAttribute('height', String(ringHeight));
    });

    const firstRect = visibleRects[0];
    if (firstRect) {
      const badgeTop = firstRect.top > 44 ? firstRect.top - 38 : firstRect.bottom + 10;
      badge.style.top = `${Math.max(6, Math.min(height - 38, badgeTop))}px`;
      badge.style.left = `${Math.max(6, Math.min(width - 326, firstRect.left))}px`;
    }
  };

  repositionHandler = updatePosition;
  window.addEventListener('scroll', updatePosition, true);
  window.addEventListener('resize', updatePosition);
  updatePosition();
}

function findTargets(selectors: string[]): Element[] {
  const matches = new Set<Element>();
  for (const selector of selectors) {
    try {
      document.querySelectorAll(selector).forEach((element) => matches.add(element));
    } catch {
      // Ignore invalid selectors; a request with no matches clears the overlay.
    }
  }
  return [...matches];
}

function isFocusSpotlightMessage(message: unknown): message is FocusSpotlightMessage {
  if (typeof message !== 'object' || message === null || !('type' in message)) return false;
  const type = (message as { type?: unknown }).type;
  if (type === 'FOCUS_SPOTLIGHT_CLEAR') return true;
  return (
    type === 'FOCUS_SPOTLIGHT_SHOW' &&
    'selectors' in message &&
    Array.isArray((message as { selectors?: unknown }).selectors) &&
    (message as { selectors: unknown[] }).selectors.every((selector) => typeof selector === 'string')
  );
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isFocusSpotlightMessage(message)) return false;

  if (message.type === 'FOCUS_SPOTLIGHT_CLEAR') {
    clearOverlay();
    const response: FocusSpotlightResponse = { ok: true, found: 0 };
    sendResponse(response);
    return false;
  }

  const targets = findTargets(message.selectors);
  if (targets.length === 0) {
    clearOverlay();
    const response: FocusSpotlightResponse = { ok: true, found: 0 };
    sendResponse(response);
    return false;
  }

  targets[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  showOverlay(targets, message.label);
  window.setTimeout(() => repositionHandler?.(), 350);
  const response: FocusSpotlightResponse = { ok: true, found: targets.length };
  sendResponse(response);
  return false;
});
