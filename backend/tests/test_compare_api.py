"""Unit and API contract tests for PandaPilot Compare backend."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from true_cost import normalize_option_cost, rank_options


def test_service_monthly_vs_annual_with_gst_and_addon():
    monthly_plan = normalize_option_cost(
        category="service",
        base_price=699,
        billing_cycle="monthly",
        setup_fee=1000,
        addon_cost=99,
        addon_recurring=True,
        late_or_shipping_fee=0,
        tax_percent=18,
        include_addons=True,
    )
    # (699*12 + 1000 + 99*12) * 1.18 = 10576 * 1.18 = 12479.68 -> 12480
    assert monthly_plan["total_cost"] == 12480
    assert monthly_plan["effective_monthly"] == 1040
    assert monthly_plan["savings_if_addons_removed"] == 1402


def test_product_all_in_cost_and_missing_price():
    product = normalize_option_cost(
        category="product",
        base_price=12999,
        billing_cycle="one_time",
        setup_fee=0,
        addon_cost=1299,
        addon_recurring=False,
        late_or_shipping_fee=99,
        tax_percent=0,
        include_addons=True,
    )
    assert product["total_cost"] == 14397
    assert product["total_without_addons"] == 13098
    assert product["effective_monthly"] is None

    missing = normalize_option_cost(category="product", base_price=None)
    assert missing["total_cost"] is None
    assert missing["cost_label"] == "Price not stated"


def test_travel_all_in_and_ranking():
    opt_a = {
        "id": "opt-1",
        "name": "IndiGo Combo",
        "currency": "INR",
        "total_cost": 14800,
        "dark_patterns": [],
        "rating": "4.6",
        "pros": ["Free cabin bag"],
    }
    opt_b = {
        "id": "opt-2",
        "name": "Hidden Fee Carrier",
        "currency": "INR",
        "total_cost": 15200,
        "dark_patterns": [{"label": "Pre-ticked seat fee"}],
        "rating": "4.1",
        "pros": [],
    }
    rec = rank_options([opt_b, opt_a], priority="lowest_cost", max_budget=16000)
    assert rec["winner_id"] == "opt-1"
    assert rec["runner_up_id"] == "opt-2"


def test_fastapi_endpoints_with_mocked_gemini(monkeypatch):
    import pytest

    fastapi = pytest.importorskip("fastapi")
    assert fastapi is not None
    from fastapi.testclient import TestClient

    import gemini_service
    import main
    from schemas import ClarifyingQuestion, ClarifyResponse, SiteCandidate

    monkeypatch.setattr(gemini_service, "is_gemini_configured", lambda: True)
    monkeypatch.setattr(
        gemini_service,
        "generate_clarify_plan",
        lambda req: ClarifyResponse(
            category="product",
            normalized_goal="ANC Headphones under 15k",
            questions=[
                ClarifyingQuestion(id="budget", question="Max budget?", chips=["₹10,000", "₹15,000"])
            ],
            suggested_sites=[
                SiteCandidate(
                    id="s1",
                    name="Amazon India",
                    domain="amazon.in",
                    url="https://www.amazon.in/s?k=anc+headphones",
                    reason="Wide selection",
                    default_selected=True,
                )
            ],
        ),
    )
    monkeypatch.setattr(
        gemini_service,
        "extract_options_from_tabs",
        lambda req: (
            "ANC Headphones",
            [
                {
                    "tab_index": 0,
                    "name": "Sony WH-CH720N",
                    "currency": "INR",
                    "base_price": 9990,
                    "billing_cycle": "one_time",
                    "setup_fee": 0,
                    "addon_label": "Extended Warranty",
                    "addon_cost": 999,
                    "addon_recurring": False,
                    "addon_pre_ticked": True,
                    "late_or_shipping_fee": 0,
                    "tax_percent": 0,
                    "specs": {"Battery": "35h"},
                    "rating": "4.5/5",
                    "contract_or_policy": "7-day replacement",
                    "pros": ["Lightweight"],
                    "cons": ["No case"],
                }
            ],
        ),
    )

    client = TestClient(main.app)
    health_res = client.get("/health")
    assert health_res.status_code == 200
    assert health_res.json()["geminiConfigured"] is True
    assert "keyMode" in health_res.json()

    clarify_res = client.post("/api/compare/clarify", json={"prompt": "Best ANC headphones"})
    assert clarify_res.status_code == 200
    assert clarify_res.json()["category"] == "product"

    analyze_res = client.post(
        "/api/compare/analyze",
        json={
            "prompt": "Best ANC headphones",
            "category": "product",
            "answers": {"budget": "₹15,000"},
            "tabs": [
                {
                    "url": "https://www.amazon.in/dp/test",
                    "domain": "amazon.in",
                    "title": "Sony WH-CH720N",
                    "detected_prices": ["₹9,990"],
                }
            ],
        },
    )
    assert analyze_res.status_code == 200
    body = analyze_res.json()
    assert body["options"][0]["total_cost"] == 10989
    assert body["recommendation"]["winner_id"] == "opt-1"


def test_key_mode_detection(monkeypatch):
    import gemini_service

    monkeypatch.setenv("GEMINI_API_KEY", "AQ.Ab8RN6ExampleAIStudioKey1234567890")
    monkeypatch.delenv("GOOGLE_GENAI_USE_VERTEXAI", raising=False)
    assert gemini_service.get_key_mode() == "ai_studio"

    monkeypatch.setenv("GOOGLE_GENAI_USE_VERTEXAI", "true")
    assert gemini_service.get_key_mode() == "vertex_express"

    monkeypatch.delenv("GOOGLE_GENAI_USE_VERTEXAI", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "AIzaSyExampleAIStudioKey1234567890")
    assert gemini_service.get_key_mode() == "ai_studio"

    monkeypatch.setenv("GEMINI_API_KEY", "")
    assert gemini_service.get_key_mode() == "none"
