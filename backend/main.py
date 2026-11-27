"""FastAPI + Pydantic firewall server for PandaPilot Mode 2 (Compare)."""

from __future__ import annotations

import re
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import gemini_service
from schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    ClarifyRequest,
    ClarifyResponse,
    NormalizedOption,
    RecommendedDecision,
)
from true_cost import normalize_option_cost, rank_options

app = FastAPI(
    title="PandaPilot Compare Backend",
    version="0.1.0",
    description="Stateless FastAPI + Pydantic schema firewall with Gemini Flash extraction and deterministic true-cost math.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _parse_budget_from_answers(answers: dict[str, str]) -> float | None:
    raw = " ".join(answers.values())
    match = re.search(r"(?:₹|rs\.?|inr|\$)?\s*([\d,]{3,7})", raw, flags=re.IGNORECASE)
    if not match:
        return None
    try:
        return float(match.group(1).replace(",", ""))
    except ValueError:
        return None


def _parse_priority_from_answers(answers: dict[str, str]) -> str:
    joined = " ".join(answers.values()).lower()
    if "trap" in joined or "hidden" in joined or "safe" in joined:
        return "fewest_traps"
    if "spec" in joined or "quality" in joined or "comfort" in joined or "speed" in joined or "feature" in joined:
        return "best_specs"
    return "lowest_cost"


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "geminiConfigured": gemini_service.is_gemini_configured(),
        "fastModel": gemini_service.FAST_MODEL,
        "proModel": gemini_service.PRO_MODEL,
    }


@app.post("/api/compare/clarify", response_model=ClarifyResponse)
def clarify_compare(req: ClarifyRequest) -> ClarifyResponse:
    if not gemini_service.is_gemini_configured():
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY not configured on backend; client fallback active.",
        )
    try:
        return gemini_service.generate_clarify_plan(req)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Gemini clarify error: {exc}") from exc


@app.post("/api/compare/analyze", response_model=AnalyzeResponse)
def analyze_compare(req: AnalyzeRequest) -> AnalyzeResponse:
    if not gemini_service.is_gemini_configured():
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY not configured on backend; client fallback active.",
        )
    try:
        normalized_goal, extracted_list = gemini_service.extract_options_from_tabs(req)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Gemini extraction error: {exc}") from exc

    extracted_by_idx = {item.get("tab_index", idx): item for idx, item in enumerate(extracted_list)}
    options_as_dicts: list[dict[str, Any]] = []

    for idx, tab in enumerate(req.tabs):
        raw = extracted_by_idx.get(idx, {})
        cost = normalize_option_cost(
            category=req.category,
            base_price=raw.get("base_price"),
            billing_cycle=raw.get("billing_cycle") or "one_time",
            setup_fee=float(raw.get("setup_fee") or 0.0),
            addon_cost=float(raw.get("addon_cost") or 0.0),
            addon_recurring=bool(raw.get("addon_recurring", False)),
            late_or_shipping_fee=float(raw.get("late_or_shipping_fee") or 0.0),
            tax_percent=float(raw.get("tax_percent") or 0.0),
            include_addons=True,
        )

        opt_dict: dict[str, Any] = {
            "id": f"opt-{idx + 1}",
            "tab_id": tab.tab_id,
            "name": raw.get("name") or tab.title[:48] or tab.domain,
            "domain": tab.domain,
            "url": tab.url,
            "category": req.category,
            "currency": raw.get("currency") or "INR",
            "base_price": raw.get("base_price"),
            "billing_cycle": raw.get("billing_cycle") or "one_time",
            "setup_fee": float(raw.get("setup_fee") or 0.0),
            "addon_label": raw.get("addon_label"),
            "addon_cost": float(raw.get("addon_cost") or 0.0),
            "addon_recurring": bool(raw.get("addon_recurring", False)),
            "addon_pre_ticked": bool(raw.get("addon_pre_ticked", False)),
            "late_or_shipping_fee": float(raw.get("late_or_shipping_fee") or 0.0),
            "tax_percent": float(raw.get("tax_percent") or 0.0),
            "effective_monthly": cost["effective_monthly"],
            "total_cost": cost["total_cost"],
            "total_without_addons": cost["total_without_addons"],
            "savings_if_addons_removed": cost["savings_if_addons_removed"],
            "specs": raw.get("specs") or {},
            "rating": raw.get("rating"),
            "contract_or_policy": raw.get("contract_or_policy"),
            "pros": raw.get("pros") or [],
            "cons": raw.get("cons") or [],
            "dark_patterns": [dp.model_dump() for dp in tab.dark_patterns],
            "source_selector": tab.price_selector,
            "badge": "Candidate",
        }
        options_as_dicts.append(opt_dict)

    priority = _parse_priority_from_answers(req.answers)
    max_budget = _parse_budget_from_answers(req.answers)
    rec = rank_options(options_as_dicts, priority=priority, max_budget=max_budget)

    for opt in options_as_dicts:
        if opt["id"] == rec["winner_id"]:
            opt["badge"] = "Recommended Winner"
        elif len(opt["dark_patterns"]) > 0:
            opt["badge"] = "Fee Trap"
        elif opt["id"] == rec["runner_up_id"]:
            opt["badge"] = "Balanced Pick"

    return AnalyzeResponse(
        category=req.category,
        normalized_goal=normalized_goal or req.prompt,
        options=[NormalizedOption.model_validate(o) for o in options_as_dicts],
        recommendation=RecommendedDecision.model_validate(rec),
        powered_by=f"FastAPI + {gemini_service.FAST_MODEL}",
        execution_layer="LAYER_C_DOM",
    )
