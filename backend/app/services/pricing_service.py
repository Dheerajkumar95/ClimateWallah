"""Server-authoritative GST and project review pricing."""
from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from database import db

SQM_TO_SQFT = Decimal("10.7639104167")


def _money(value) -> int:
    return int(Decimal(str(value)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def area_in_sqft(building_info: dict) -> int:
    info = building_info or {}
    try:
        target_area = Decimal(str(info.get("target_area") or 0))
    except Exception:
        target_area = Decimal("0")
    try:
        built_up_area = Decimal(str(info.get("built_up_area") or 0))
    except Exception:
        built_up_area = Decimal("0")

    # The browser can submit the string "0" for target_area. It is truthy in
    # Python, but it must not hide a valid gross built-up area.
    if target_area > 0:
        area = target_area
        unit = info.get("target_unit") or "sq.m"
    else:
        area = built_up_area
        unit = info.get("built_up_unit") or "sq.m"
    if str(unit).lower().replace(" ", "") in {"sq.m", "sqm", "m2", "m²"}:
        area *= SQM_TO_SQFT
    return max(0, _money(area))


async def billing_settings() -> dict:
    return await db.marketplace_settings.find_one({"id": "billing"}, {"_id": 0}) or {}


async def project_review_quote(project: dict) -> dict:
    settings = await billing_settings()
    square_feet = area_in_sqft(project.get("building_info") or {})
    if square_feet <= 0:
        return {
            "custom_quote": True,
            "area_sqft": square_feet,
            "message": "Enter a valid certification or built-up area before requesting a review quote.",
        }
    tier = next(
        (item for item in settings.get("area_tiers", []) if square_feet <= int(item.get("max_sqft", 0))),
        None,
    )
    if not tier:
        return {
            "custom_quote": True,
            "area_sqft": square_feet,
            "message": "Projects above 10 lakh sq ft require a custom quotation.",
        }

    cert = await db.certification_types.find_one(
        {"code": project.get("certification_type", "IGBC")}, {"_id": 0}
    ) or {}
    multiplier = Decimal(str(cert.get("price_multiplier", 1)))
    subtotal = _money(Decimal(str(tier.get("base_paise", 0))) * multiplier)
    gst_rate = Decimal(str(settings.get("gst_rate", 18)))
    gst = _money(Decimal(subtotal) * gst_rate / Decimal("100"))
    return {
        "custom_quote": False,
        "currency": "INR",
        "area_sqft": square_feet,
        "tier_id": tier.get("id"),
        "tier_label": tier.get("label"),
        "certification_type": project.get("certification_type", "IGBC"),
        "subtotal_paise": subtotal,
        "gst_rate": float(gst_rate),
        "gst_paise": gst,
        "total_paise": subtotal + gst,
    }


async def reviewer_plan_quote() -> dict:
    settings = await billing_settings()
    subtotal = int(settings.get("reviewer_monthly_plan_paise", 29900))
    gst_rate = Decimal(str(settings.get("gst_rate", 18)))
    gst = _money(Decimal(subtotal) * gst_rate / Decimal("100"))
    return {
        "currency": "INR",
        "plan_days": int(settings.get("reviewer_plan_days", 30)),
        "subtotal_paise": subtotal,
        "gst_rate": float(gst_rate),
        "gst_paise": gst,
        "total_paise": subtotal + gst,
    }
