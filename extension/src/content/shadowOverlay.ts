import type { HighlightTarget } from '../shared/types';

const SHADOW_HOST_ID = 'pandapilot-shadow-root';

let activeTargetEl: Element | null = null;
let repositionHandler: (() => void) | null = null;

function getVariantColors(variant: HighlightTarget['variant']) {
  if (variant === 'warning') {
    return {
      ring: '#D97706',
      glow: 'rgba(217, 119, 6, 0.35)',
      badgeBg: '#D97706',
    };
  }
  if (variant === 'success') {
    return {
      ring: '#059669',
      glow: 'rgba(5, 150, 105, 0.35)',
      badgeBg: '#059669',
    };
  }
  return {
    ring: '#331E6D',
    glow: 'rgba(51, 30, 109, 0.42)',
    badgeBg: '#331E6D',
  };
}

function getOrCreateShadowRoot(): ShadowRoot {
  let host = document.getElementById(SHADOW_HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = SHADOW_HOST_ID;
    host.style.position = 'fixed';
    host.style.inset = '0';
    host.style.zIndex = '2147483647';
    host.style.pointerEvents = 'none';
    document.documentElement.appendChild(host);
  }
  return host.shadowRoot ?? host.attachShadow({ mode: 'open' });
}

export function clearHighlights(): void {
  if (repositionHandler) {
    window.removeEventListener('scroll', repositionHandler, true);
    window.removeEventListener('resize', repositionHandler);
    repositionHandler = null;
  }
  activeTargetEl = null;

  const host = document.getElementById(SHADOW_HOST_ID);
  if (host) {
    host.remove();
  }
}

export function highlightElement(target: HighlightTarget): {
  ok: boolean;
  matchedSelector?: string;
  error?: string;
} {
  clearHighlights();

  const selectors = target.selector
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  let matchedEl: Element | null = null;
  let matchedSelector = target.selector;

  for (const sel of selectors) {
    try {
      const candidate = document.querySelector(sel);
      if (candidate) {
        const rect = candidate.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          matchedEl = candidate;
          matchedSelector = sel;
          break;
        }
      }
    } catch {
      // Ignore invalid CSS selector fragments
    }
  }

  if (!matchedEl) {
    return {
      ok: false,
      error: `No visible element matched selector "${target.selector}".`,
    };
  }

  activeTargetEl = matchedEl;
  matchedEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

  const shadow = getOrCreateShadowRoot();
  const colors = getVariantColors(target.variant);

  shadow.innerHTML = `
    <style>
      @keyframes ppPulse {
        0% { box-shadow: 0 0 0 0 ${colors.glow}; }
        70% { box-shadow: 0 0 0 12px rgba(0, 0, 0, 0); }
        100% { box-shadow: 0 0 0 0 rgba(0, 0, 0, 0); }
      }
      .pp-ring {
        position: fixed;
        border: 3px solid ${colors.ring};
        border-radius: 10px;
        background: rgba(51, 30, 109, 0.06);
        animation: ppPulse 1.8s infinite;
        transition: all 140ms ease;
        pointer-events: none;
        box-sizing: border-box;
      }
      .pp-badge {
        position: fixed;
        max-width: 320px;
        background: ${colors.badgeBg};
        color: #FFFFFF;
        font-family: Inter, system-ui, -apple-system, sans-serif;
        font-size: 12px;
        font-weight: 600;
        line-height: 1.35;
        padding: 8px 12px;
        border-radius: 10px;
        box-shadow: 0 10px 25px rgba(30, 27, 75, 0.25);
        pointer-events: auto;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .pp-close {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: #FFFFFF;
        border-radius: 6px;
        width: 20px;
        height: 20px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 700;
        line-height: 1;
        flex-shrink: 0;
      }
      .pp-close:hover {
        background: rgba(255, 255, 255, 0.35);
      }
    </style>
    <div class="pp-ring" id="pp-ring"></div>
    <div class="pp-badge" id="pp-badge">
      <span id="pp-msg"></span>
      <button class="pp-close" id="pp-close" title="Dismiss highlight">×</button>
    </div>
  `;

  const ringEl = shadow.getElementById('pp-ring') as HTMLDivElement | null;
  const badgeEl = shadow.getElementById('pp-badge') as HTMLDivElement | null;
  const msgEl = shadow.getElementById('pp-msg') as HTMLSpanElement | null;
  const closeBtn = shadow.getElementById('pp-close') as HTMLButtonElement | null;

  if (msgEl) {
    msgEl.textContent = target.message;
  }

  closeBtn?.addEventListener('click', () => clearHighlights());

  const updatePosition = () => {
    if (!activeTargetEl || !ringEl || !badgeEl) return;
    const rect = activeTargetEl.getBoundingClientRect();
    const pad = 6;
    ringEl.style.top = `${Math.max(2, rect.top - pad)}px`;
    ringEl.style.left = `${Math.max(2, rect.left - pad)}px`;
    ringEl.style.width = `${rect.width + pad * 2}px`;
    ringEl.style.height = `${rect.height + pad * 2}px`;

    const badgeTop = rect.top > 56 ? rect.top - 48 : rect.bottom + 12;
    badgeEl.style.top = `${Math.max(8, Math.min(window.innerHeight - 52, badgeTop))}px`;
    badgeEl.style.left = `${Math.max(8, Math.min(window.innerWidth - 336, rect.left))}px`;
  };

  repositionHandler = updatePosition;
  window.addEventListener('scroll', updatePosition, true);
  window.addEventListener('resize', updatePosition);

  // Position immediately and once more after smooth scroll settles
  updatePosition();
  window.setTimeout(updatePosition, 350);

  return { ok: true, matchedSelector };
}
