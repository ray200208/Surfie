import type {
  BillingCycle,
  DarkPatternFlag,
  QuarantinedInjection,
  RawTabExtraction,
} from './compareTypes';

interface InjectedPageSnapshot {
  url: string;
  domain: string;
  title: string;
  jsonLdSummary: string;
  visibleText: string;
  detectedPrices: string[];
  numericPrices: number[];
  currency: string;
  priceSelector: string;
  specs: Record<string, string | null>;
  rating: string | null;
  contractOrPolicy: string | null;
  darkPatterns: DarkPatternFlag[];
  quarantinedInjections: QuarantinedInjection[];
  addonLabel: string | null;
  addonCost: number;
  addonPreTicked: boolean;
  lateOrShippingFee: number;
  setupFee: number;
  taxPercent: number;
  billingCycle: BillingCycle;
}

/**
 * Self-contained function executed inside the target Chrome tab via chrome.scripting.executeScript.
 * Must NOT reference any outer imports or variables.
 */
function extractPageSnapshotInTab(): InjectedPageSnapshot {
  const buildSelector = (el: Element | null): string => {
    if (!el) return '';
    if (el.id) return `#${CSS.escape(el.id)}`;
    const testId = el.getAttribute('data-testid');
    if (testId) return `[data-testid="${CSS.escape(testId)}"]`;
    const nameAttr = el.getAttribute('name');
    if (nameAttr) return `${el.tagName.toLowerCase()}[name="${CSS.escape(nameAttr)}"]`;
    const parts: string[] = [];
    let cur: Element | null = el;
    let depth = 0;
    while (cur && cur.tagName.toLowerCase() !== 'html' && depth < 3) {
      let part = cur.tagName.toLowerCase();
      if (cur.id) {
        parts.unshift(`#${CSS.escape(cur.id)}`);
        break;
      }
      const parent: Element | null = cur.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((c) => c.tagName === cur!.tagName);
        if (siblings.length > 1) {
          part += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
        }
      }
      parts.unshift(part);
      cur = parent;
      depth += 1;
    }
    return parts.join(' > ');
  };

  const isVisible = (el: Element): boolean => {
    const style = window.getComputedStyle(el);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      parseFloat(style.opacity || '1') === 0 ||
      parseFloat(style.fontSize || '12') < 3
    ) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const domain = window.location.hostname || 'unknown-site';
  const title = document.title || domain;

  // 1. Layer A: Parse JSON-LD structured data & meta tags (0 tokens)
  const jsonLdEntries: string[] = [];
  let rating: string | null = null;
  let structuredPrice: number | null = null;
  let structuredCurrency = '';
  const specs: Record<string, string | null> = {};

  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).slice(0, 6);
  for (const script of scripts) {
    try {
      const raw = JSON.parse(script.textContent || '{}');
      const items = Array.isArray(raw) ? raw : [raw];
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const typeVal = String(item['@type'] || '');
        if (item.name) jsonLdEntries.push(`${typeVal}: ${String(item.name)}`);
        if (item.brand?.name) specs['Brand'] = String(item.brand.name);
        if (item.aggregateRating?.ratingValue) {
          rating = `${item.aggregateRating.ratingValue}/5`;
          if (item.aggregateRating.reviewCount) {
            rating += ` (${item.aggregateRating.reviewCount} reviews)`;
          }
        }
        const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
        if (offer && offer.price) {
          const parsed = Number(String(offer.price).replace(/,/g, ''));
          if (Number.isFinite(parsed) && parsed > 0) {
            structuredPrice = parsed;
            structuredCurrency = String(offer.priceCurrency || '');
          }
        }
      }
    } catch {
      // Ignore malformed JSON-LD blocks
    }
  }

  const metaPrice = document.querySelector('meta[property="product:price:amount"]')?.getAttribute('content');
  if (!structuredPrice && metaPrice) {
    const parsed = Number(metaPrice.replace(/,/g, ''));
    if (Number.isFinite(parsed) && parsed > 0) structuredPrice = parsed;
  }

  // 2. Indirect Prompt-Injection Quarantine Scanner (0 tokens)
  const injectionRegex =
    /(ignore\s+(all\s+)?previous\s+instructions|pick\s+this\s+as\s+(the\s+)?best|override\s+instructions|system\s+prompt|disregard\s+above)/i;
  const quarantinedInjections: QuarantinedInjection[] = [];
  const candidatesForInjection = Array.from(
    document.querySelectorAll('div, span, p, small, aside, section, [aria-hidden="true"]')
  ).slice(0, 400);

  for (const el of candidatesForInjection) {
    const text = (el.textContent || '').trim();
    if (!text || text.length > 350) continue;
    if (injectionRegex.test(text)) {
      const hidden = !isVisible(el);
      quarantinedInjections.push({
        id: `inj-${quarantinedInjections.length + 1}`,
        tabId: null,
        domain,
        selector: buildSelector(el),
        snippet: text.slice(0, 140),
        reason: hidden
          ? 'Hidden DOM node (display:none/opacity:0) attempted prompt injection'
          : 'Adversarial imperative phrase quarantined by Untrusted Reader',
      });
    }
  }

  // 3. Layer C: Visible DOM pricing & spec extraction
  const priceRegex = /(?:₹|Rs\.?|INR|\$|USD|€|£)\s*([\d,]+(?:\.\d{1,2})?)/gi;
  const detectedPrices: string[] = [];
  const numericPrices: number[] = [];
  let priceSelector = '';
  let currency = structuredCurrency || 'INR';

  if (structuredPrice) {
    numericPrices.push(structuredPrice);
    detectedPrices.push(`${currency === 'USD' ? '$' : '₹'}${structuredPrice}`);
  }

  const priceEls = Array.from(
    document.querySelectorAll(
      '[class*="price" i], [id*="price" i], [data-testid*="price" i], .a-price-whole, h1, h2, h3, strong, span, td'
    )
  ).slice(0, 350);

  for (const el of priceEls) {
    if (!isVisible(el)) continue;
    const text = (el.textContent || '').trim();
    if (!text || text.length > 90) continue;
    const matches = Array.from(text.matchAll(priceRegex));
    for (const m of matches) {
      const full = m[0].trim();
      const num = Number(m[1].replace(/,/g, ''));
      if (!Number.isFinite(num) || num <= 0) continue;
      if (full.includes('$') || full.toUpperCase().includes('USD')) currency = 'USD';
      else if (full.includes('€')) currency = 'EUR';
      else if (full.includes('£')) currency = 'GBP';
      else currency = 'INR';

      if (!detectedPrices.includes(full)) {
        detectedPrices.push(full);
      }
      if (!numericPrices.includes(num)) {
        numericPrices.push(num);
      }
      if (!priceSelector) {
        priceSelector = buildSelector(el);
      }
      if (detectedPrices.length >= 8) break;
    }
    if (detectedPrices.length >= 8) break;
  }

  // Extract clean visible text (stripped of quarantined injection lines)
  const rawBody = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
  const sanitizedText = rawBody.replace(injectionRegex, '[QUARANTINED]').slice(0, 1800);

  // 4. Deterministic Dark-Pattern Scanner (0 tokens)
  const darkPatterns: DarkPatternFlag[] = [];
  let addonLabel: string | null = null;
  let addonCost = 0;
  let addonPreTicked = false;
  let lateOrShippingFee = 0;
  let setupFee = 0;
  let taxPercent = 0;

  const addonKeywordRegex =
    /(warranty|protection|insurance|router|care|baggage|seat|priority|donation|add-on|addon|cover|plan)/i;

  const checkedBoxes = Array.from(document.querySelectorAll('input[type="checkbox"]:checked')).slice(0, 30);
  for (const box of checkedBoxes) {
    const container = box.closest('label, div, li, tr') || box.parentElement;
    const labelText = (container?.textContent || '').replace(/\s+/g, ' ').trim();
    if (labelText && addonKeywordRegex.test(labelText)) {
      addonPreTicked = true;
      addonLabel = labelText.slice(0, 60);
      const priceMatch = labelText.match(/(?:₹|Rs\.?|\$)\s*([\d,]+)/i);
      if (priceMatch) {
        addonCost = Number(priceMatch[1].replace(/,/g, '')) || 0;
      }
      darkPatterns.push({
        id: `dp-addon-${darkPatterns.length + 1}`,
        kind: 'pre_ticked_addon',
        label: `Pre-ticked add-on: ${labelText.slice(0, 42)}`,
        severity: 'amber',
        selector: buildSelector(container || box),
        detail: labelText.slice(0, 120),
      });
    }
  }

  // Fee & policy scans on visible text blocks
  const feeBlocks = Array.from(document.querySelectorAll('p, li, span, div, small, td')).slice(0, 350);
  const feeRegex = /(convenience fee|installation fee|setup fee|platform fee|handling fee|delivery charge)/i;
  const policyRegex = /(auto-renew|automatically renew|non-refundable|cancellation fee|lock-in)/i;
  let contractOrPolicy: string | null = null;

  for (const el of feeBlocks) {
    if (!isVisible(el)) continue;
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length > 140) continue;

    if (feeRegex.test(text) && darkPatterns.length < 4) {
      const m = text.match(/(?:₹|Rs\.?|\$)\s*([\d,]+)/i);
      const feeVal = m ? Number(m[1].replace(/,/g, '')) : 0;
      if (text.toLowerCase().includes('setup') || text.toLowerCase().includes('installation')) {
        setupFee = Math.max(setupFee, feeVal);
      } else {
        lateOrShippingFee = Math.max(lateOrShippingFee, feeVal);
      }
      if (!darkPatterns.some((d) => d.kind === 'hidden_fee')) {
        darkPatterns.push({
          id: `dp-fee-${darkPatterns.length + 1}`,
          kind: 'hidden_fee',
          label: `Extra fee noted: ${text.slice(0, 44)}`,
          severity: 'amber',
          selector: buildSelector(el),
          detail: text,
        });
      }
    }

    if (policyRegex.test(text) && darkPatterns.length < 4) {
      contractOrPolicy = text.slice(0, 70);
      if (!darkPatterns.some((d) => d.kind === 'auto_renew' || d.kind === 'non_refundable')) {
        const isNonRef = /non-refundable/i.test(text);
        darkPatterns.push({
          id: `dp-pol-${darkPatterns.length + 1}`,
          kind: isNonRef ? 'non_refundable' : 'auto_renew',
          label: isNonRef ? 'Non-refundable fare/policy' : 'Auto-renewal / lock-in fine print',
          severity: 'crimson',
          selector: buildSelector(el),
          detail: text,
        });
      }
    }
  }

  if (/18%\s*gst|plus\s*gst|\+\s*gst/i.test(sanitizedText)) {
    taxPercent = 18;
  }

  let billingCycle: BillingCycle = 'one_time';
  if (/\/\s*mo\b|per month|\bmonthly\b/i.test(sanitizedText)) {
    billingCycle = 'monthly';
  } else if (/\/\s*yr\b|per year|\bannual(ly)?\b/i.test(sanitizedText)) {
    billingCycle = 'annual';
  } else if (/quarterly|3 months/i.test(sanitizedText)) {
    billingCycle = 'quarterly';
  }

  return {
    url: window.location.href,
    domain,
    title,
    jsonLdSummary: jsonLdEntries.join(' | '),
    visibleText: sanitizedText,
    detectedPrices,
    numericPrices,
    currency,
    priceSelector,
    specs,
    rating,
    contractOrPolicy,
    darkPatterns,
    quarantinedInjections,
    addonLabel,
    addonCost,
    addonPreTicked,
    lateOrShippingFee,
    setupFee,
    taxPercent,
    billingCycle,
  };
}

function isRestrictedUrl(url: string): boolean {
  return (
    !url ||
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('https://chromewebstore.google.com')
  );
}

export async function extractFromTab(
  tabId: number,
  fallbackTitle = 'Browser Tab',
  fallbackUrl = ''
): Promise<RawTabExtraction> {
  let domain = 'tab';
  try {
    domain = new URL(fallbackUrl).hostname || 'tab';
  } catch {
    // ignore
  }

  if (isRestrictedUrl(fallbackUrl)) {
    return {
      tabId,
      url: fallbackUrl,
      domain,
      title: fallbackTitle,
      jsonLdSummary: '',
      visibleText: '',
      detectedPrices: [],
      numericPrices: [],
      currency: 'INR',
      priceSelector: '',
      specs: {},
      rating: null,
      contractOrPolicy: null,
      darkPatterns: [],
      quarantinedInjections: [],
      addonLabel: null,
      addonCost: 0,
      addonPreTicked: false,
      lateOrShippingFee: 0,
      setupFee: 0,
      taxPercent: 0,
      billingCycle: 'one_time',
      scanStatus: 'limited',
      scanNote: 'Chrome internal/restricted page cannot be scanned.',
    };
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractPageSnapshotInTab,
    });
    const snap = results?.[0]?.result as InjectedPageSnapshot | undefined;
    if (!snap) {
      throw new Error('Empty extraction snapshot.');
    }

    return {
      ...snap,
      tabId,
      quarantinedInjections: snap.quarantinedInjections.map((q) => ({ ...q, tabId })),
      scanStatus: 'ok',
    };
  } catch (err) {
    return {
      tabId,
      url: fallbackUrl,
      domain,
      title: fallbackTitle,
      jsonLdSummary: '',
      visibleText: '',
      detectedPrices: [],
      numericPrices: [],
      currency: 'INR',
      priceSelector: '',
      specs: {},
      rating: null,
      contractOrPolicy: null,
      darkPatterns: [],
      quarantinedInjections: [],
      addonLabel: null,
      addonCost: 0,
      addonPreTicked: false,
      lateOrShippingFee: 0,
      setupFee: 0,
      taxPercent: 0,
      billingCycle: 'one_time',
      scanStatus: 'error',
      scanNote: err instanceof Error ? err.message : 'Unable to scan tab DOM.',
    };
  }
}

export async function jumpAndHighlightTab(
  tabId: number | null,
  url: string,
  selector: string,
  message: string,
  variant: 'spotlight' | 'warning' | 'success' = 'spotlight'
): Promise<{ ok: boolean; note?: string }> {
  if (typeof chrome === 'undefined' || !chrome.tabs) {
    return { ok: false, note: 'Chrome tabs API unavailable in preview context.' };
  }

  let targetTabId = tabId;
  if (targetTabId !== null) {
    try {
      await chrome.tabs.get(targetTabId);
      await chrome.tabs.update(targetTabId, { active: true });
    } catch {
      targetTabId = null;
    }
  }

  if (targetTabId === null) {
    if (!url || url.startsWith('demo://')) {
      return {
        ok: true,
        note: `Demo source anchor: ${message} (${url || 'simulated tab'})`,
      };
    }
    const created = await chrome.tabs.create({ url, active: true });
    targetTabId = created.id ?? null;
  }

  if (targetTabId !== null && selector) {
    try {
      await chrome.tabs.sendMessage(targetTabId, {
        type: 'HIGHLIGHT_ELEMENT',
        payload: { selector, message, variant },
      });
    } catch {
      // Content script may still be initializing on newly opened tab
    }
  }

  return { ok: true };
}
