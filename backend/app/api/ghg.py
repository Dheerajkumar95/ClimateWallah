"""GHG Emissions Calculator API (public multi-step tool + admin listing)."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from database import db
from auth import get_current_admin
from app.services.ghg_factors import GHG_SCOPES, FACTOR_SOURCE, get_activity

router = APIRouter(prefix="/api/tools/ghg")


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


@router.get("/factors")
async def factors():
    return {"scopes": GHG_SCOPES, "source": FACTOR_SOURCE}


class CalcInput(BaseModel):
    organization: Optional[str] = ""
    name: Optional[str] = ""
    email: Optional[str] = ""
    reporting_period: Optional[str] = ""
    entries: dict = {}  # {activity_id: quantity}


@router.post("/calculate")
async def calculate(data: CalcInput):
    scope_totals = {s["id"]: {"id": s["id"], "name": s["name"], "total_kg": 0.0, "items": []}
                    for s in GHG_SCOPES}
    total_kg = 0.0
    for activity_id, qty in (data.entries or {}).items():
        act = get_activity(activity_id)
        if not act:
            continue
        try:
            q = float(qty)
        except (TypeError, ValueError):
            continue
        if q <= 0:
            continue
        emissions = round(q * act["factor"], 3)
        total_kg += emissions
        scope_totals[act["scope"]]["items"].append({
            "id": activity_id, "name": act["name"], "unit": act["unit"],
            "quantity": q, "factor": act["factor"], "emissions_kg": emissions,
        })
        scope_totals[act["scope"]]["total_kg"] += emissions

    scopes = []
    for s in GHG_SCOPES:
        st = scope_totals[s["id"]]
        st["total_kg"] = round(st["total_kg"], 3)
        st["total_t"] = round(st["total_kg"] / 1000, 4)
        scopes.append(st)

    result = {
        "id": str(uuid.uuid4()),
        "organization": data.organization or "",
        "name": data.name or "",
        "email": (data.email or "").lower(),
        "reporting_period": data.reporting_period or "",
        "total_kg": round(total_kg, 3),
        "total_t": round(total_kg / 1000, 4),
        "scopes": scopes,
        "source": FACTOR_SOURCE,
        "created_at": _now_iso(),
    }
    await db.ghg_calculations.insert_one(dict(result))
    result.pop("_id", None)
    return result


@router.get("/admin/calculations")
async def list_calculations(admin: dict = Depends(get_current_admin), page: int = 1, limit: int = 50):
    total = await db.ghg_calculations.count_documents({})
    items = await db.ghg_calculations.find({}, {"_id": 0}).sort("created_at", -1) \
        .skip((page - 1) * limit).limit(limit).to_list(limit)
    return {"items": items, "total": total}
