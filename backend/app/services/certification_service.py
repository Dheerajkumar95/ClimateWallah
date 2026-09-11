"""Database-backed certification types and versioned checklist snapshots."""
from __future__ import annotations

import copy
import re
import uuid

from database import db
from rating_template import PROJECT_TYPE_TEMPLATE, cat_slug
from seed import now_iso


DEFAULT_TYPES = [
    {
        "id": "cert-igbc",
        "code": "IGBC",
        "name": "IGBC",
        "full_name": "Indian Green Building Council",
        "description": "Indian green building certification pathway.",
        "accent": "#27F580",
        "display_order": 0,
        "active": True,
        "price_multiplier": 1.0,
    },
    {
        "id": "cert-well",
        "code": "WELL",
        "name": "WELL",
        "full_name": "WELL Building Standard",
        "description": "Health, wellbeing and indoor environment pathway.",
        "accent": "#3B82F6",
        "display_order": 1,
        "active": True,
        "price_multiplier": 1.0,
    },
    {
        "id": "cert-leed",
        "code": "LEED",
        "name": "LEED",
        "full_name": "Leadership in Energy and Environmental Design",
        "description": "International green building certification pathway.",
        "accent": "#7C5CFC",
        "display_order": 2,
        "active": True,
        "price_multiplier": 1.0,
    },
]

DEFAULT_THRESHOLDS = [
    {"band": "Uncertified", "min": 0, "max": 49},
    {"band": "Certified", "min": 50, "max": 59},
    {"band": "Silver", "min": 60, "max": 69},
    {"band": "Gold", "min": 70, "max": 79},
    {"band": "Platinum", "min": 80, "max": 100},
]


def normalise_code(value: str) -> str:
    code = re.sub(r"[^A-Za-z0-9_-]+", "-", (value or "").strip()).strip("-")
    return code.upper()


def raw_template(project_type: str, certification_code: str = "IGBC") -> dict:
    """Return a safe editable draft, falling back to the legacy IGBC data."""
    source = PROJECT_TYPE_TEMPLATE.get(project_type) if certification_code == "IGBC" else None
    if source:
        return copy.deepcopy(source)
    return {
        "id": f"{certification_code.lower()}-{project_type.lower()}-{uuid.uuid4().hex[:8]}",
        "project_type": project_type,
        "name": f"{certification_code} — {project_type}",
        "version": "1",
        "occupancy_variants": ["owner", "tenant"],
        "total_max": {"owner": 100, "tenant": 100},
        "thresholds": copy.deepcopy(DEFAULT_THRESHOLDS),
        "categories": [],
    }


def shape_template(template: dict, occupancy: str = "owner") -> dict:
    """Shape an editable template into the compact project-facing contract."""
    occupancy_variants = template.get("occupancy_variants") or ["owner", "tenant"]
    occ = occupancy if occupancy in occupancy_variants else occupancy_variants[0]
    categories = []
    visible_categories = [category for category in (template.get("categories") or []) if category.get("active", True) is not False]
    for order, category in enumerate(sorted(visible_categories, key=lambda item: item.get("order", 0))):
        criteria = []
        for criterion_order, criterion in enumerate(sorted(category.get("criteria") or [], key=lambda item: item.get("order", 0))):
            if criterion.get("active", True) is False:
                continue
            criteria.append({
                "id": criterion.get("id") or f"criterion-{uuid.uuid4().hex[:12]}",
                "code": criterion.get("code") or "Criterion",
                "name": criterion.get("name") or "Untitled criterion",
                "description": criterion.get("description") or "",
                "mandatory": bool(criterion.get("mandatory")),
                "max_points": 0 if criterion.get("mandatory") else float(
                    criterion.get("max_owner", 0) if occ == "owner" else criterion.get("max_tenant", 0)
                ),
                "evidence_required": criterion.get("evidence_required", True),
                "order": criterion_order,
            })
        categories.append({
            "id": category.get("id") or f"category-{uuid.uuid4().hex[:10]}",
            "slug": category.get("slug") or cat_slug(category.get("name") or "section"),
            "name": category.get("name") or "Untitled section",
            "order": order,
            "max_points": float((category.get("max_points") or {}).get(occ, 0)),
            "criteria": criteria,
        })
    return {
        "under_configuration": not bool(categories),
        "id": template.get("id"),
        "certification_code": template.get("certification_code", "IGBC"),
        "project_type": template.get("project_type"),
        "name": template.get("name"),
        "version": str(template.get("version", "1")),
        "occupancy": occ,
        "total_max": float((template.get("total_max") or {}).get(occ, 0)),
        "thresholds": copy.deepcopy(template.get("thresholds") or DEFAULT_THRESHOLDS),
        "categories": categories,
    }


async def published_template(certification_code: str, project_type: str, occupancy: str) -> dict:
    code = normalise_code(certification_code)
    doc = await db.certification_checklists.find_one(
        {"certification_code": code, "project_type": project_type, "status": "published"},
        {"_id": 0},
    )
    if doc and doc.get("published_template"):
        return shape_template(doc["published_template"], occupancy)
    if code == "IGBC" and PROJECT_TYPE_TEMPLATE.get(project_type):
        fallback = raw_template(project_type, code)
        fallback["certification_code"] = code
        return shape_template(fallback, occupancy)
    return {
        "under_configuration": True,
        "certification_code": code,
        "project_type": project_type,
        "name": f"{code} — {project_type}",
        "version": "1",
        "occupancy": occupancy,
        "total_max": 0,
        "thresholds": copy.deepcopy(DEFAULT_THRESHOLDS),
        "categories": [],
    }


async def ensure_marketplace_seed() -> None:
    for item in DEFAULT_TYPES:
        await db.certification_types.update_one(
            {"code": item["code"]},
            {"$setOnInsert": {**item, "created_at": now_iso(), "updated_at": now_iso()}},
            upsert=True,
        )

    # Publish existing authorised IGBC checklists as the initial DB versions.
    for project_type in PROJECT_TYPE_TEMPLATE:
        key = {"certification_code": "IGBC", "project_type": project_type}
        source = raw_template(project_type, "IGBC")
        source["certification_code"] = "IGBC"
        await db.certification_checklists.update_one(
            key,
            {"$setOnInsert": {
                "id": str(uuid.uuid4()),
                **key,
                "template": source,
                "published_template": copy.deepcopy(source),
                "status": "published",
                "version": 1,
                "created_at": now_iso(),
                "updated_at": now_iso(),
                "published_at": now_iso(),
            }},
            upsert=True,
        )

    await db.marketplace_settings.update_one(
        {"id": "billing"},
        {"$setOnInsert": {
            "id": "billing",
            "gst_rate": 18,
            "reviewer_monthly_plan_paise": 29900,
            "reviewer_project_earning_paise": 29900,
            "reviewer_plan_days": 30,
            "area_tiers": [
                {"id": "upto-1l", "max_sqft": 100000, "base_paise": 99900, "label": "Up to 1 lakh sq ft"},
                {"id": "1l-3l", "max_sqft": 300000, "base_paise": 299900, "label": "Above 1–3 lakh sq ft"},
                {"id": "3l-5l", "max_sqft": 500000, "base_paise": 499900, "label": "Above 3–5 lakh sq ft"},
                {"id": "5l-10l", "max_sqft": 1000000, "base_paise": 599900, "label": "Above 5–10 lakh sq ft"},
            ],
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }},
        upsert=True,
    )
