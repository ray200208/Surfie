import type {
  CompareCategory,
  RawTabExtraction,
  RecommendedDecision,
  WhiteboardOption,
} from './compareTypes';

export function formatMoney(amount: number | null, currency = 'INR'): string {
  if (amount === null || Number.isNaN(amount)) return 'Not stated';
  const symbol =
    currency === 'USD'
      ? '$'
      : currency === 'EUR'
        ? '€'
        : currency === 'GBP'
          ? '£'
          : '₹';
  return `${symbol}${Math.round(amount).toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US')}`;
}

export function recalculateOptionCost(
  option: WhiteboardOption,
  includeAddons: boolean
): WhiteboardOption {
  if (option.basePrice === null) {
    return {
      ...option,
      addonEnabled: includeAddons,
      effectiveMonthly: null,
      totalCost: null,
      totalWithoutAddons: null,
      savingsIfAddonsRemoved: 0,
    };
  }

  const taxMultiplier = 1 + Math.max(0, option.taxPercent) / 100;
  const setup = Math.max(0, option.setupFee);
  const extraFee = Math.max(0, option.lateOrShippingFee);
  const addon = Math.max(0, option.addonCost);

  if (option.category === 'service') {
    const annualBase =
      option.billingCycle === 'monthly'
        ? option.basePrice * 12
        : option.billingCycle === 'quarterly'
          ? option.basePrice * 4
          : option.basePrice;

    const annualAddon = option.addonRecurring ? addon * 12 : addon;
    const subtotalWith = annualBase + setup + extraFee + (includeAddons ? annualAddon : 0);
    const subtotalWithout = annualBase + setup + extraFee;
    const maxWithAddon = Math.round((annualBase + setup + extraFee + annualAddon) * taxMultiplier);

    const totalCost = Math.round(subtotalWith * taxMultiplier);
    const totalWithoutAddons = Math.round(subtotalWithout * taxMultiplier);
    const effectiveMonthly = Math.round(totalCost / 12);

    return {
      ...option,
      addonEnabled: includeAddons,
      totalCost,
      totalWithoutAddons,
      effectiveMonthly,
      savingsIfAddonsRemoved: Math.max(0, maxWithAddon - totalWithoutAddons),
    };
  }

  const subtotalWith = option.basePrice + setup + extraFee + (includeAddons ? addon : 0);
  const subtotalWithout = option.basePrice + setup + extraFee;
  const maxWithAddon = Math.round((option.basePrice + setup + extraFee + addon) * taxMultiplier);

  const totalCost = Math.round(subtotalWith * taxMultiplier);
  const totalWithoutAddons = Math.round(subtotalWithout * taxMultiplier);

  return {
    ...option,
    addonEnabled: includeAddons,
    totalCost,
    totalWithoutAddons,
    effectiveMonthly: null,
    savingsIfAddonsRemoved: Math.max(0, maxWithAddon - totalWithoutAddons),
  };
}

function parseBudget(answers: Record<string, string>): number | null {
  const joined = Object.values(answers).join(' ');
  const match = joined.match(/(?:₹|rs\.?|inr|\$)?\s*([\d,]{3,7})/i);
  if (!match) return null;
  const parsed = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePriority(answers: Record<string, string>): 'lowest_cost' | 'fewest_traps' | 'best_specs' {
  const joined = Object.values(answers).join(' ').toLowerCase();
  if (joined.includes('trap') || joined.includes('hidden') || joined.includes('safe')) {
    return 'fewest_traps';
  }
  if (
    joined.includes('spec') ||
    joined.includes('quality') ||
    joined.includes('comfort') ||
    joined.includes('speed') ||
    joined.includes('rating')
  ) {
    return 'best_specs';
  }
  return 'lowest_cost';
}

export function computeRecommendedDecision(
  options: WhiteboardOption[],
  answers: Record<string, string>
): { options: WhiteboardOption[]; recommendation: RecommendedDecision } {
  if (options.length === 0) {
    return {
      options: [],
      recommendation: {
        winnerId: '',
        runnerUpId: null,
        winnerName: 'No Options',
        headline: 'No comparable pages scanned yet',
        rationale: ['Run a guided comparison or select open browser tabs.'],
        savingsSummary: '₹0',
      },
    };
  }

  const maxBudget = parseBudget(answers);
  const priority = parsePriority(answers);
  const priced = options.filter((o) => o.totalCost !== null);
  const minCost = priced.length ? Math.min(...priced.map((o) => o.totalCost as number)) : 0;

  const scored = [...options].sort((a, b) => {
    const score = (opt: WhiteboardOption): number => {
      if (opt.totalCost === null) return 10_000_000 + opt.darkPatterns.length * 5000;
      let penalty = 0;
      if (maxBudget !== null && opt.totalCost > maxBudget) {
        penalty += (opt.totalCost - maxBudget) * 2.5;
      }
      if (priority === 'fewest_traps') {
        penalty += opt.darkPatterns.length * 5000;
      } else if (priority === 'best_specs') {
        penalty += opt.darkPatterns.length * 750 - (opt.rating ? 600 : 0) - opt.pros.length * 300;
      } else {
        penalty += opt.darkPatterns.length * 1200;
      }
      return opt.totalCost + penalty;
    };
    return score(a) - score(b);
  });

  const winner = scored[0];
  const runnerUp = scored[1] ?? null;

  const updatedOptions = options.map((opt) => {
    let badge = 'Candidate';
    if (opt.id === winner.id) {
      badge = 'Recommended Winner';
    } else if (opt.darkPatterns.length > 0) {
      badge = 'Fee Trap';
    } else if (runnerUp && opt.id === runnerUp.id) {
      badge = 'Balanced Pick';
    }
    return { ...opt, badge };
  });

  const rationale: string[] = [];
  if (winner.totalCost !== null) {
    if (winner.totalCost === minCost) {
      rationale.push(`Lowest normalized true cost at ${formatMoney(winner.totalCost, winner.currency)}.`);
    } else {
      rationale.push(
        `Best match for "${priority.replace('_', ' ')}" at ${formatMoney(winner.totalCost, winner.currency)}.`
      );
    }
  } else {
    rationale.push('Selected based on extracted specs (pricing was not clearly stated on page).');
  }

  if (maxBudget !== null && winner.totalCost !== null) {
    rationale.push(
      winner.totalCost <= maxBudget
        ? `Stays inside your ${formatMoney(maxBudget, winner.currency)} budget cap.`
        : `Closest fit to your ${formatMoney(maxBudget, winner.currency)} target budget.`
    );
  }

  if (winner.darkPatterns.length === 0) {
    rationale.push('Zero pre-ticked add-ons or hidden checkout traps detected.');
  } else {
    rationale.push(
      `Flagged ${winner.darkPatterns.length} fee/policy warning(s) — verify add-ons before checkout.`
    );
  }

  let savingsSummary = 'Best overall match';
  if (
    winner.totalCost !== null &&
    runnerUp?.totalCost !== null &&
    runnerUp &&
    (runnerUp.totalCost as number) > winner.totalCost
  ) {
    const diff = (runnerUp.totalCost as number) - winner.totalCost;
    savingsSummary = `Saves ${formatMoney(diff, winner.currency)} vs. ${runnerUp.name}`;
  } else if (winner.savingsIfAddonsRemoved > 0) {
    savingsSummary = `Save ${formatMoney(winner.savingsIfAddonsRemoved, winner.currency)} by unchecking add-ons`;
  }

  return {
    options: updatedOptions,
    recommendation: {
      winnerId: winner.id,
      runnerUpId: runnerUp?.id ?? null,
      winnerName: winner.name,
      headline: `Recommended: ${winner.name}`,
      rationale,
      savingsSummary,
    },
  };
}

export function buildLocalOptionsFromExtractions(
  extractions: RawTabExtraction[],
  category: CompareCategory,
  answers: Record<string, string>
): { options: WhiteboardOption[]; recommendation: RecommendedDecision } {
  const initial: WhiteboardOption[] = extractions.map((ext, idx) => {
    const basePrice = ext.numericPrices.length > 0 ? ext.numericPrices[0] : null;
    const rawOpt: WhiteboardOption = {
      id: `opt-${idx + 1}`,
      tabId: ext.tabId,
      name: ext.title.split('|')[0].split(' - ')[0].trim().slice(0, 44) || ext.domain,
      domain: ext.domain,
      url: ext.url,
      category,
      currency: ext.currency || 'INR',
      basePrice,
      billingCycle: ext.billingCycle,
      setupFee: ext.setupFee,
      addonLabel: ext.addonLabel,
      addonCost: ext.addonCost,
      addonRecurring: ext.billingCycle === 'monthly' && ext.addonCost > 0,
      addonPreTicked: ext.addonPreTicked,
      addonEnabled: ext.addonPreTicked,
      lateOrShippingFee: ext.lateOrShippingFee,
      taxPercent: ext.taxPercent,
      effectiveMonthly: null,
      totalCost: null,
      totalWithoutAddons: null,
      savingsIfAddonsRemoved: 0,
      specs: ext.specs,
      rating: ext.rating,
      contractOrPolicy: ext.contractOrPolicy,
      pros: [
        ext.rating ? `Rated ${ext.rating}` : `Live source from ${ext.domain}`,
        ext.darkPatterns.length === 0 ? 'Clean checkout signals' : 'Price anchor verified on page',
      ],
      cons:
        ext.darkPatterns.length > 0
          ? ext.darkPatterns.slice(0, 2).map((d) => d.label)
          : basePrice === null
            ? ['Exact numeric price not detected on page']
            : ['Verify final cart delivery/tax at checkout'],
      darkPatterns: ext.darkPatterns,
      sourceSelector: ext.priceSelector,
      badge: 'Candidate',
    };

    return recalculateOptionCost(rawOpt, rawOpt.addonEnabled);
  });

  return computeRecommendedDecision(initial, answers);
}
