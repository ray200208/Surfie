"""Deterministic true-cost normalization and ranking (zero LLM math)."""

from __future__ import annotations

from typing import Any


def normalize_option_cost(
    category: str,
    base_price: float | None,
    billing_cycle: str = "one_time",
    setup_fee: float = 0.0,
    addon_cost: float = 0.0,
    addon_recurring: bool = False,
    late_or_shipping_fee: float = 0.0,
    tax_percent: float = 0.0,
    include_addons: bool = True,
) -> dict[str, Any]:
    """Compute normalized all-in or 1st-year total cost deterministically."""
    if base_price is None:
        return {
            "effective_monthly": None,
            "total_cost": None,
            "total_without_addons": None,
            "savings_if_addons_removed": 0,
            "cost_label": "Price not stated",
        }

    tax_multiplier = 1.0 + (max(0.0, tax_percent) / 100.0)
    setup = max(0.0, setup_fee)
    extra_fee = max(0.0, late_or_shipping_fee)
    addon = max(0.0, addon_cost)

    if category == "service":
        if billing_cycle == "monthly":
            annual_base = base_price * 12.0
        elif billing_cycle == "quarterly":
            annual_base = base_price * 4.0
        else:
            annual_base = base_price

        annual_addon = addon * 12.0 if addon_recurring else addon
        subtotal_with = annual_base + setup + extra_fee + (annual_addon if include_addons else 0.0)
        subtotal_without = annual_base + setup + extra_fee

        total_cost = int(round(subtotal_with * tax_multiplier))
        total_without_addons = int(round(subtotal_without * tax_multiplier))
        effective_monthly = int(round(total_cost / 12.0))
        savings = max(0, int(round((annual_base + setup + extra_fee + annual_addon) * tax_multiplier)) - total_without_addons)

        return {
            "effective_monthly": effective_monthly,
            "total_cost": total_cost,
            "total_without_addons": total_without_addons,
            "savings_if_addons_removed": savings,
            "cost_label": "1st-Year Total",
        }

    # Products, travel, and general one-time comparisons
    subtotal_with = base_price + setup + extra_fee + (addon if include_addons else 0.0)
    subtotal_without = base_price + setup + extra_fee

    total_cost = int(round(subtotal_with * tax_multiplier))
    total_without_addons = int(round(subtotal_without * tax_multiplier))
    savings = max(0, int(round((base_price + setup + extra_fee + addon) * tax_multiplier)) - total_without_addons)

    return {
        "effective_monthly": None,
        "total_cost": total_cost,
        "total_without_addons": total_without_addons,
        "savings_if_addons_removed": savings,
        "cost_label": "All-In Trip Cost" if category == "travel" else "All-In Price",
    }


def rank_options(
    options: list[dict[str, Any]],
    priority: str = "lowest_cost",
    max_budget: float | None = None,
) -> dict[str, Any]:
    """Score normalized options deterministically against cost, traps, and budget."""
    if not options:
        return {
            "winner_id": "",
            "runner_up_id": None,
            "winner_name": "No Options",
            "headline": "No comparable options extracted yet",
            "rationale": ["Open or select tabs with pricing details to compare."],
            "savings_summary": "0",
        }

    priced = [o for o in options if o.get("total_cost") is not None]
    min_cost = min((o["total_cost"] for o in priced), default=0)

    def score_option(opt: dict[str, Any]) -> tuple[float, float]:
        total = opt.get("total_cost")
        traps = len(opt.get("dark_patterns") or [])
        has_rating = 1 if opt.get("rating") else 0

        if total is None:
            return (10_000_000.0 + traps * 5000.0, 0.0)

        penalty = 0.0
        if max_budget is not None and total > max_budget:
            penalty += (total - max_budget) * 2.5

        if priority == "fewest_traps":
            penalty += traps * 5000.0
        elif priority == "best_specs":
            penalty += traps * 750.0 - has_rating * 600.0 - len(opt.get("pros") or []) * 300.0
        else:
            penalty += traps * 1200.0

        return (float(total) + penalty, float(total))

    sorted_opts = sorted(options, key=score_option)
    winner = sorted_opts[0]
    runner_up = sorted_opts[1] if len(sorted_opts) > 1 else None

    winner_cost = winner.get("total_cost")
    runner_cost = runner_up.get("total_cost") if runner_up else None

    rationale: list[str] = []
    if winner_cost is not None:
        if winner_cost == min_cost:
            rationale.append(f"Lowest normalized true cost at {winner.get('currency', 'INR')} {winner_cost:,}.")
        else:
            rationale.append(f"Best balance for your priority ({priority.replace('_', ' ')}) at {winner.get('currency', 'INR')} {winner_cost:,}.")
    else:
        rationale.append("Selected based on available specs; pricing was not stated on page.")

    if max_budget is not None and winner_cost is not None:
        if winner_cost <= max_budget:
            rationale.append(f"Fits within your {winner.get('currency', 'INR')} {int(max_budget):,} budget cap.")
        else:
            rationale.append(f"Closest option to your {winner.get('currency', 'INR')} {int(max_budget):,} budget cap.")

    winner_traps = len(winner.get("dark_patterns") or [])
    if winner_traps == 0:
        rationale.append("Zero dark-pattern add-ons or hidden checkout fees detected.")
    else:
        rationale.append(f"Flagged {winner_traps} fee/policy item(s) — strip optional add-ons before checkout.")

    savings_summary = "Best overall match"
    if winner_cost is not None and runner_cost is not None and runner_cost > winner_cost:
        diff = runner_cost - winner_cost
        savings_summary = f"Saves {winner.get('currency', 'INR')} {diff:,} vs. {runner_up['name']}"
    elif winner.get("savings_if_addons_removed", 0) > 0:
        savings_summary = f"Save {winner.get('currency', 'INR')} {winner['savings_if_addons_removed']:,} by unchecking pre-ticked add-ons"

    return {
        "winner_id": winner["id"],
        "runner_up_id": runner_up["id"] if runner_up else None,
        "winner_name": winner["name"],
        "headline": f"Recommended: {winner['name']}",
        "rationale": rationale,
        "savings_summary": savings_summary,
    }
