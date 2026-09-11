"""Fast, database-free checks for marketplace business rules."""
import hashlib
import hmac
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi import HTTPException


os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "climatewallah_test")
os.environ.setdefault("JWT_SECRET", "unit-test-secret-that-is-not-used-in-production")
os.environ.setdefault("COOKIE_SECURE", "false")
os.environ.setdefault("EMAIL_ENABLED", "false")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.pricing_service import area_in_sqft  # noqa: E402
from app.services import razorpay_service  # noqa: E402
from app.services.storage import safe_content_type  # noqa: E402
from marketplace import CertificationTypeInput, _strong, _subscription_state, _validate_template  # noqa: E402


def test_area_conversion_and_unit_selection():
    assert area_in_sqft({"target_area": 100, "target_unit": "sq.m"}) == 1076
    assert area_in_sqft({"target_area": 125000, "target_unit": "sq.ft"}) == 125000
    assert area_in_sqft({"built_up_area": -5, "built_up_unit": "sq.ft"}) == 0
    assert area_in_sqft({
        "target_area": "0",
        "target_unit": "sq.m",
        "built_up_area": 500,
        "built_up_unit": "sq.ft",
    }) == 500


def test_password_policy():
    assert _strong("Climate9Wallah") == "Climate9Wallah"
    with pytest.raises(ValueError):
        _strong("alllowercase")
    with pytest.raises(ValueError):
        _strong("NoNumberHere")


def test_subscription_states():
    assert _subscription_state({"requires_subscription": False})["grandfathered"] is True
    assert _subscription_state({"requires_subscription": True})["status"] == "not_started"

    active = _subscription_state({
        "requires_subscription": True,
        "subscription": {
            "status": "active",
            "ends_at": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat(),
        },
    })
    assert active["active"] is True
    assert 5 <= active["days_remaining"] <= 6

    expired = _subscription_state({
        "requires_subscription": True,
        "subscription": {
            "status": "active",
            "ends_at": (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat(),
        },
    })
    assert expired["active"] is False
    assert expired["status"] == "expired"


def test_razorpay_checkout_signature(monkeypatch):
    monkeypatch.setattr(razorpay_service, "KEY_SECRET", "checkout-secret")
    expected = hmac.new(
        b"checkout-secret",
        b"order_123|pay_456",
        hashlib.sha256,
    ).hexdigest()
    assert razorpay_service.verify_checkout_signature("order_123", "pay_456", expected)
    assert not razorpay_service.verify_checkout_signature("order_123", "pay_456", "bad-signature")


def test_checklist_requires_unique_criterion_ids():
    valid = {
        "name": "IGBC Residential",
        "categories": [{
            "id": "water",
            "name": "Water Conservation",
            "criteria": [
                {"id": "wc-mr-1", "name": "Rainwater harvesting"},
                {"id": "wc-cr-1", "name": "Water metering"},
            ],
        }],
    }
    _validate_template(valid)

    duplicate = {
        "name": "Broken checklist",
        "categories": [{
            "id": "section",
            "name": "Section",
            "criteria": [
                {"id": "same", "name": "One"},
                {"id": "same", "name": "Two"},
            ],
        }],
    }
    with pytest.raises(HTTPException) as exc:
        _validate_template(duplicate)
    assert exc.value.status_code == 400


def test_certification_price_multiplier_must_be_positive():
    assert CertificationTypeInput(code="IGBC", name="IGBC", price_multiplier=1.25).price_multiplier == 1.25
    with pytest.raises(ValueError):
        CertificationTypeInput(code="BAD", name="Bad", price_multiplier=0)


def test_checklist_rejects_missing_category_id_and_negative_points():
    missing_id = {"name": "Template", "categories": [{"name": "Section", "criteria": []}]}
    with pytest.raises(HTTPException):
        _validate_template(missing_id)

    negative = {
        "name": "Template",
        "categories": [{
            "id": "section",
            "name": "Section",
            "max_points": {"owner": -1},
            "criteria": [],
        }],
    }
    with pytest.raises(HTTPException):
        _validate_template(negative)


def test_checklist_rejects_invalid_numbers_and_empty_sections():
    with pytest.raises(HTTPException):
        _validate_template({"name": "Empty", "categories": []})

    invalid = {
        "name": "Template",
        "categories": [{
            "id": "water",
            "name": "Water",
            "max_points": {"owner": "not-a-number"},
            "criteria": [{"id": "wc-1", "name": "Metering"}],
        }],
    }
    with pytest.raises(HTTPException):
        _validate_template(invalid)


def test_upload_content_type_is_derived_from_extension():
    assert safe_content_type("evidence/photo.png", "text/html") == "image/png"
    assert safe_content_type("report.pdf", "text/html") == "application/pdf"
    assert safe_content_type("unknown.bin", "text/html") == "application/octet-stream"
