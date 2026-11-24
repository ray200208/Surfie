import { BroadbandPlanRaw, NormalizedPlan } from '../types';

/**
 * Deterministic True-Cost Normalization (Layer A: 0 AI Tokens).
 * Pure code converts monthly, quarterly, and annual pricing into apples-to-apples
 * Effective Monthly Cost and 1st-Year Total (including setup fees, pre-ticked add-ons,
 * late checkout fees, and stated GST).
 */
export function normalizeBroadbandPlan(
  plan: BroadbandPlanRaw,
  includeRouterAddon: boolean
): NormalizedPlan {
  const annualBase =
    plan.billingCycle === 'monthly'
      ? plan.basePrice * 12
      : plan.billingCycle === 'quarterly'
        ? plan.basePrice * 4
        : plan.basePrice;

  const annualAddon = includeRouterAddon ? plan.routerAddonMonthly * 12 : 0;
  const subtotalWithAddon = annualBase + plan.setupFee + annualAddon + plan.lateCheckoutFee;
  const subtotalWithoutAddon = annualBase + plan.setupFee + plan.lateCheckoutFee;

  const gstMultiplier = 1 + plan.gstPercent / 100;
  const firstYearTotal = Math.round(subtotalWithAddon * gstMultiplier);
  const effectiveMonthly = Math.round(firstYearTotal / 12);

  const firstYearWithoutAddon = Math.round(subtotalWithoutAddon * gstMultiplier);
  const effectiveMonthlyWithoutAddon = Math.round(firstYearWithoutAddon / 12);

  let badge: NormalizedPlan['badge'] = 'Best 1-Yr Value';
  if (plan.id === 'fiberfast') {
    badge = 'Hidden Fee Risk';
  } else if (plan.id === 'metronet') {
    badge = 'Hidden Fee Risk';
  } else if (plan.id === 'airwave') {
    badge = 'Best 1-Yr Value';
  }

  return {
    ...plan,
    firstYearTotal,
    effectiveMonthly,
    firstYearWithoutAddon,
    effectiveMonthlyWithoutAddon,
    badge,
  };
}

export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}
