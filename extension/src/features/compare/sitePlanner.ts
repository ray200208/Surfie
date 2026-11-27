import type {
  ClarifyingQuestion,
  CompareCategory,
  RawTabExtraction,
  SiteCandidate,
} from './compareTypes';
import { extractFromTab } from './tabExtractor';

export function detectCategory(prompt: string): CompareCategory {
  const lower = prompt.toLowerCase();
  if (
    /\b(flight|hotel|trip|travel|goa|bali|kerala|stay|resort|booking|vacation|train|bus|itinerary)\b/.test(
      lower
    )
  ) {
    return 'travel';
  }
  if (
    /\b(broadband|fiber|wifi|internet|plan|subscription|saas|hosting|mobile|recharge|sim|ott|insurance|vpn)\b/.test(
      lower
    )
  ) {
    return 'service';
  }
  if (
    /\b(buy|headphone|headphones|earbuds|laptop|phone|mobile|monitor|keyboard|watch|camera|shoes|tv|ac|fridge|chair|desk)\b/.test(
      lower
    )
  ) {
    return 'product';
  }
  return 'general';
}

export function buildLocalClarifyPlan(prompt: string): {
  category: CompareCategory;
  normalizedGoal: string;
  questions: ClarifyingQuestion[];
  suggestedSites: SiteCandidate[];
  poweredBy: string;
} {
  const category = detectCategory(prompt);
  const encodedQuery = encodeURIComponent(prompt.trim());
  const normalizedGoal = prompt.trim().slice(0, 64) || 'Compare Top Options';

  if (category === 'travel') {
    return {
      category,
      normalizedGoal,
      questions: [
        {
          id: 'budget',
          question: 'What is your total trip budget per person?',
          chips: ['Under ₹10,000', 'Under ₹20,000', 'Under ₹40,000', 'Flexible'],
          placeholder: 'e.g., ₹18,000 all-in',
        },
        {
          id: 'priority',
          question: 'What matters most for this trip?',
          chips: ['Lowest All-In Cost', 'Fewest Hidden Traps', 'Best Ratings & Comfort'],
          placeholder: 'e.g., Direct flight + refundable hotel',
        },
        {
          id: 'context',
          question: 'Dates / duration & traveler preference?',
          chips: ['Weekend (2 Nights)', '4–5 Days', 'Solo / Couple', 'Family Group'],
          placeholder: 'e.g., Next Friday–Sunday, carry-on only',
        },
      ],
      suggestedSites: [
        {
          id: 'mmt',
          name: 'MakeMyTrip',
          domain: 'makemytrip.com',
          url: `https://www.google.com/search?q=site:makemytrip.com+${encodedQuery}`,
          reason: 'Checks Indian flight + hotel combo fares and convenience fees',
          defaultSelected: true,
        },
        {
          id: 'skyscanner',
          name: 'Skyscanner',
          domain: 'skyscanner.co.in',
          url: `https://www.google.com/search?q=site:skyscanner.co.in+${encodedQuery}`,
          reason: 'Cross-checks base airline fares across OTAs',
          defaultSelected: true,
        },
        {
          id: 'booking',
          name: 'Booking.com',
          domain: 'booking.com',
          url: `https://www.booking.com/searchresults.html?ss=${encodedQuery}`,
          reason: 'Verifies stay taxes, cancellation rules, and guest ratings',
          defaultSelected: true,
        },
        {
          id: 'goibibo',
          name: 'Goibibo',
          domain: 'goibibo.com',
          url: `https://www.google.com/search?q=site:goibibo.com+${encodedQuery}`,
          reason: 'Extra OTA check for coupon vs. convenience fee math',
          defaultSelected: false,
        },
        {
          id: 'agoda',
          name: 'Agoda',
          domain: 'agoda.com',
          url: `https://www.google.com/search?q=site:agoda.com+${encodedQuery}`,
          reason: 'Useful for checking pre-tax vs. post-tax hotel pricing',
          defaultSelected: false,
        },
      ],
      poweredBy: 'Local Deterministic Engine',
    };
  }

  if (category === 'service') {
    const isBroadband = /\b(broadband|fiber|wifi|internet|isp)\b/i.test(prompt);
    return {
      category,
      normalizedGoal,
      questions: [
        {
          id: 'budget',
          question: 'What is your comfortable monthly or annual budget?',
          chips: ['Under ₹800/mo', 'Under ₹1,200/mo', 'Under ₹12,000/yr', 'Flexible'],
          placeholder: 'e.g., ₹1,000/mo incl. GST',
        },
        {
          id: 'priority',
          question: 'What should PandaPilot optimize for?',
          chips: ['Lowest True 1-Yr Cost', 'Fewest Hidden Traps', 'Best Speed & Specs'],
          placeholder: 'e.g., No installation trap or lock-in',
        },
        {
          id: 'context',
          question: 'Expected usage / commitment length?',
          chips: ['12+ Months', '3–6 Months', 'Work / Coding Heavy', 'Light Browsing'],
          placeholder: 'e.g., 1 year in Chennai apartment',
        },
      ],
      suggestedSites: isBroadband
        ? [
            {
              id: 'airtel',
              name: 'Airtel Xstream Fiber',
              domain: 'airtel.in',
              url: `https://www.airtel.in/broadband/`,
              reason: 'Official fiber plan pricing, installation & router terms',
              defaultSelected: true,
            },
            {
              id: 'jiofiber',
              name: 'JioFiber Plans',
              domain: 'jio.com',
              url: `https://www.jio.com/fiber`,
              reason: 'Checks quarterly/annual plans + OTT bundles & GST',
              defaultSelected: true,
            },
            {
              id: 'act',
              name: 'ACT Fibernet',
              domain: 'actcorp.in',
              url: `https://www.actcorp.in/`,
              reason: 'Popular metro fiber plans & router add-on checks',
              defaultSelected: true,
            },
            {
              id: 'tataplay',
              name: 'Tata Play Fiber',
              domain: 'tataplayfiber.com',
              url: `https://www.google.com/search?q=site:tataplayfiber.com+${encodedQuery}`,
              reason: 'Alternative ISP pricing comparison',
              defaultSelected: false,
            },
            {
              id: 'broadband-search',
              name: 'Plan Reviews & Terms',
              domain: 'google.com',
              url: `https://www.google.com/search?q=${encodedQuery}+installation+fee+gst`,
              reason: 'Catches hidden installation & cancellation charges',
              defaultSelected: false,
            },
          ]
        : [
            {
              id: 'g2',
              name: 'G2 Comparisons',
              domain: 'g2.com',
              url: `https://www.google.com/search?q=site:g2.com+${encodedQuery}`,
              reason: 'Verified user ratings & tier breakdowns',
              defaultSelected: true,
            },
            {
              id: 'capterra',
              name: 'Capterra Pricing',
              domain: 'capterra.com',
              url: `https://www.google.com/search?q=site:capterra.com+${encodedQuery}`,
              reason: 'Per-seat monthly vs. annual pricing comparison',
              defaultSelected: true,
            },
            {
              id: 'official-pricing',
              name: 'Official Pricing Search',
              domain: 'google.com',
              url: `https://www.google.com/search?q=${encodedQuery}+pricing+plans`,
              reason: 'Finds official plan pages & auto-renew terms',
              defaultSelected: true,
            },
            {
              id: 'alternativeto',
              name: 'AlternativeTo',
              domain: 'alternativeto.net',
              url: `https://alternativeto.net/browse/search/?q=${encodedQuery}`,
              reason: 'Surfaces open-source or lower-cost alternatives',
              defaultSelected: false,
            },
            {
              id: 'trustpilot',
              name: 'Trustpilot Reviews',
              domain: 'trustpilot.com',
              url: `https://www.google.com/search?q=site:trustpilot.com+${encodedQuery}`,
              reason: 'Checks cancellation & billing trap complaints',
              defaultSelected: false,
            },
          ],
      poweredBy: 'Local Deterministic Engine',
    };
  }

  return {
    category,
    normalizedGoal,
    questions: [
      {
        id: 'budget',
        question: 'What is your maximum all-in budget?',
        chips: ['Under ₹5,000', 'Under ₹15,000', 'Under ₹50,000', 'Flexible'],
        placeholder: 'e.g., ₹15,000 including shipping',
      },
      {
        id: 'priority',
        question: 'Which factor matters most to you?',
        chips: ['Lowest All-In Price', 'Best Specs & Rating', 'Fewest Hidden Traps'],
        placeholder: 'e.g., Long battery + clean warranty',
      },
      {
        id: 'context',
        question: 'Primary use case or must-have feature?',
        chips: ['Daily Coding / Study', 'Travel & Commute', 'Gaming / Heavy Use', 'Value Gift'],
        placeholder: 'e.g., Comfortable for 6h+ coding',
      },
    ],
    suggestedSites: [
      {
        id: 'amazon',
        name: 'Amazon India',
        domain: 'amazon.in',
        url: `https://www.amazon.in/s?k=${encodedQuery}`,
        reason: 'Live product listings, ratings, and extended warranty add-ons',
        defaultSelected: true,
      },
      {
        id: 'flipkart',
        name: 'Flipkart',
        domain: 'flipkart.com',
        url: `https://www.flipkart.com/search?q=${encodedQuery}`,
        reason: 'Checks competing prices, platform fees, and bank offers',
        defaultSelected: true,
      },
      {
        id: 'croma',
        name: 'Croma',
        domain: 'croma.com',
        url: `https://www.croma.com/searchB?q=${encodedQuery}%3Arelevance`,
        reason: 'Official retail pricing & warranty terms',
        defaultSelected: true,
      },
      {
        id: 'reliancedigital',
        name: 'Reliance Digital',
        domain: 'reliancedigital.in',
        url: `https://www.google.com/search?q=site:reliancedigital.in+${encodedQuery}`,
        reason: 'Additional retail price benchmark',
        defaultSelected: false,
      },
      {
        id: 'smartprix',
        name: 'Smartprix / Specs',
        domain: 'smartprix.com',
        url: `https://www.google.com/search?q=site:smartprix.com+${encodedQuery}`,
        reason: 'Side-by-side spec sheet verification',
        defaultSelected: false,
      },
    ],
    poweredBy: 'Local Deterministic Engine',
  };
}

function waitForTabComplete(tabId: number, timeoutMs = 7000): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      window.clearTimeout(timer);
      resolve();
    };

    const onUpdated = (updatedId: number, info: { status?: string }) => {
      if (updatedId === tabId && info.status === 'complete') {
        // Give SPA frameworks a brief moment to paint prices
        window.setTimeout(finish, 450);
      }
    };

    const timer = window.setTimeout(finish, timeoutMs);
    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

export async function openAndScanSites(
  sites: SiteCandidate[],
  onProgress: (status: { siteId: string; step: string; done: boolean }) => void
): Promise<{ extractions: RawTabExtraction[]; openedTabIds: number[] }> {
  const openedTabIds: number[] = [];
  const extractions: RawTabExtraction[] = [];

  for (const site of sites) {
    onProgress({ siteId: site.id, step: `Opening ${site.domain}...`, done: false });
    const created = await chrome.tabs.create({ url: site.url, active: false });
    const tabId = created.id ?? null;
    if (tabId !== null) {
      openedTabIds.push(tabId);
      onProgress({ siteId: site.id, step: `Waiting for ${site.domain} to load...`, done: false });
      await waitForTabComplete(tabId);
      onProgress({ siteId: site.id, step: `Extracting Layer A/C DOM from ${site.domain}...`, done: false });
      const snap = await extractFromTab(tabId, site.name, site.url);
      extractions.push(snap);
    }
    onProgress({ siteId: site.id, step: `Scanned ${site.domain}`, done: true });
  }

  // Group opened tabs tidily when Chrome supports tabGroups
  if (openedTabIds.length > 1 && typeof chrome.tabs.group === 'function') {
    try {
      const groupId = await chrome.tabs.group({
        tabIds: openedTabIds as [number, ...number[]],
      });
      if (chrome.tabGroups?.update) {
        await chrome.tabGroups.update(groupId, { title: 'PandaPilot Compare', color: 'purple' });
      }
    } catch {
      // Tab grouping is optional visual polish
    }
  }

  return { extractions, openedTabIds };
}

export async function closeScannedTabs(tabIds: number[]): Promise<void> {
  if (!tabIds.length || typeof chrome === 'undefined' || !chrome.tabs?.remove) return;
  try {
    await chrome.tabs.remove(tabIds);
  } catch {
    // Some tabs may already have been closed manually by user
  }
}
