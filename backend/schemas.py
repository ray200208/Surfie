"""Pydantic v2 schema firewall between untrusted webpage data and trusted UI."""

from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field

CompareCategory = Literal["product", "service", "travel", "general"]
BillingCycle = Literal["one_time", "monthly", "quarterly", "annual"]


class ClarifyingQuestion(BaseModel):
    id: str
    question: str
    chips: list[str] = Field(default_factory=list)
    placeholder: str = ""


class SiteCandidate(BaseModel):
    id: str
    name: str
    domain: str
    url: str
    reason: str
    default_selected: bool = False


class ClarifyRequest(BaseModel):
    prompt: str = Field(..., min_length=2, max_length=600)
    open_tab_titles: list[str] = Field(default_factory=list)


class ClarifyResponse(BaseModel):
    category: CompareCategory
    normalized_goal: str
    questions: list[ClarifyingQuestion]
    suggested_sites: list[SiteCandidate]
    powered_by: str = "FastAPI + Gemini Flash"


class DarkPatternInput(BaseModel):
    id: str
    kind: str
    label: str
    severity: Literal["amber", "crimson"] = "amber"
    selector: str = ""
    detail: str = ""


class TabSnapshotInput(BaseModel):
    tab_id: int | None = None
    url: str
    domain: str
    title: str
    json_ld_summary: str = ""
    visible_text: str = ""
    detected_prices: list[str] = Field(default_factory=list)
    dark_patterns: list[DarkPatternInput] = Field(default_factory=list)
    quarantined_injections: int = 0
    price_selector: str = ""


class AnalyzeRequest(BaseModel):
    prompt: str = Field(..., min_length=2, max_length=600)
    category: CompareCategory = "general"
    answers: dict[str, str] = Field(default_factory=dict)
    tabs: list[TabSnapshotInput] = Field(..., min_length=1)


class NormalizedOption(BaseModel):
    id: str
    tab_id: int | None = None
    name: str
    domain: str
    url: str
    category: CompareCategory
    currency: str = "INR"
    base_price: float | None = None
    billing_cycle: BillingCycle = "one_time"
    setup_fee: float = 0.0
    addon_label: str | None = None
    addon_cost: float = 0.0
    addon_recurring: bool = False
    addon_pre_ticked: bool = False
    late_or_shipping_fee: float = 0.0
    tax_percent: float = 0.0
    effective_monthly: int | None = None
    total_cost: int | None = None
    total_without_addons: int | None = None
    savings_if_addons_removed: int = 0
    specs: dict[str, str | None] = Field(default_factory=dict)
    rating: str | None = None
    contract_or_policy: str | None = None
    pros: list[str] = Field(default_factory=list)
    cons: list[str] = Field(default_factory=list)
    dark_patterns: list[DarkPatternInput] = Field(default_factory=list)
    source_selector: str = ""
    badge: str = "Candidate"


class RecommendedDecision(BaseModel):
    winner_id: str
    runner_up_id: str | None = None
    winner_name: str
    headline: str
    rationale: list[str]
    savings_summary: str


class AnalyzeResponse(BaseModel):
    category: CompareCategory
    normalized_goal: str
    options: list[NormalizedOption]
    recommendation: RecommendedDecision
    powered_by: str = "FastAPI + Gemini Flash"
    execution_layer: str = "LAYER_C_DOM"
