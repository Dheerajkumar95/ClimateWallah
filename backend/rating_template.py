"""Authorised checklist STRUCTURE for the private RES certification workflow.

Only the rating structure (categories, criteria names, point ceilings) is stored
here for the internal assessment — the full copyrighted IGBC guide is NOT
reproduced. Commercial (IGBC Green New Buildings v4) is the first template.
"""

# project_type -> rating system config. Only Commercial is authorised for Phase 1.
COMMERCIAL_TEMPLATE = {
    "id": "igbc-gnb-v4-commercial",
    "project_type": "Commercial",
    "name": "IGBC Green New Buildings — Commercial (Version 4)",
    "version": "4",
    "occupancy_variants": ["owner", "tenant"],
    "total_max": {"owner": 100, "tenant": 100},
    "thresholds": [
        {"band": "Uncertified", "min": 0, "max": 49},
        {"band": "Certified", "min": 50, "max": 59},
        {"band": "Silver", "min": 60, "max": 69},
        {"band": "Gold", "min": 70, "max": 79},
        {"band": "Platinum", "min": 80, "max": 100},
    ],
    "categories": [
        {
            "id": "ssp",
            "name": "Site Selection and Planning",
            "order": 0,
            "max_points": {"owner": 15, "tenant": 15},
            "criteria": [
                {"id": "ssp-p1", "code": "SSP Mandatory 1", "name": "Local Building Regulations", "mandatory": True, "max_owner": 0, "max_tenant": 0},
                {"id": "ssp-1", "code": "SSP Credit 1", "name": "Site Selection & Preservation", "mandatory": False, "max_owner": 3, "max_tenant": 3},
                {"id": "ssp-2", "code": "SSP Credit 2", "name": "Heat Island Reduction", "mandatory": False, "max_owner": 3, "max_tenant": 3},
                {"id": "ssp-3", "code": "SSP Credit 3", "name": "Basic Amenities & Public Transport", "mandatory": False, "max_owner": 3, "max_tenant": 3},
                {"id": "ssp-4", "code": "SSP Credit 4", "name": "Green Site & Landscape Design", "mandatory": False, "max_owner": 3, "max_tenant": 3},
                {"id": "ssp-5", "code": "SSP Credit 5", "name": "Universal Design & Accessibility", "mandatory": False, "max_owner": 3, "max_tenant": 3},
            ],
        },
        {
            "id": "wc",
            "name": "Water Conservation",
            "order": 1,
            "max_points": {"owner": 20, "tenant": 20},
            "criteria": [
                {"id": "wc-p1", "code": "WC Mandatory 1", "name": "Rainwater Harvesting (Minimum)", "mandatory": True, "max_owner": 0, "max_tenant": 0},
                {"id": "wc-p2", "code": "WC Mandatory 2", "name": "Water Efficient Fixtures (Minimum)", "mandatory": True, "max_owner": 0, "max_tenant": 0},
                {"id": "wc-1", "code": "WC Credit 1", "name": "Rainwater Harvesting Enhancement", "mandatory": False, "max_owner": 5, "max_tenant": 5},
                {"id": "wc-2", "code": "WC Credit 2", "name": "Water Efficient Landscaping", "mandatory": False, "max_owner": 4, "max_tenant": 4},
                {"id": "wc-3", "code": "WC Credit 3", "name": "Water Metering & Management", "mandatory": False, "max_owner": 4, "max_tenant": 4},
                {"id": "wc-4", "code": "WC Credit 4", "name": "Wastewater Treatment & Reuse", "mandatory": False, "max_owner": 4, "max_tenant": 4},
                {"id": "wc-5", "code": "WC Credit 5", "name": "Water Use Reduction", "mandatory": False, "max_owner": 3, "max_tenant": 3},
            ],
        },
        {
            "id": "ee",
            "name": "Energy Efficiency",
            "order": 2,
            "max_points": {"owner": 26, "tenant": 29},
            "criteria": [
                {"id": "ee-p1", "code": "EE Mandatory 1", "name": "Minimum Energy Performance", "mandatory": True, "max_owner": 0, "max_tenant": 0},
                {"id": "ee-p2", "code": "EE Mandatory 2", "name": "CFC-Free Equipment", "mandatory": True, "max_owner": 0, "max_tenant": 0},
                {"id": "ee-1", "code": "EE Credit 1", "name": "Enhanced Energy Performance", "mandatory": False, "max_owner": 10, "max_tenant": 12},
                {"id": "ee-2", "code": "EE Credit 2", "name": "On-site Renewable Energy", "mandatory": False, "max_owner": 6, "max_tenant": 6},
                {"id": "ee-3", "code": "EE Credit 3", "name": "Energy Metering & Monitoring", "mandatory": False, "max_owner": 4, "max_tenant": 4},
                {"id": "ee-4", "code": "EE Credit 4", "name": "Commissioning of Building Systems", "mandatory": False, "max_owner": 3, "max_tenant": 4},
                {"id": "ee-5", "code": "EE Credit 5", "name": "Efficient Lighting", "mandatory": False, "max_owner": 3, "max_tenant": 3},
            ],
        },
        {
            "id": "bmr",
            "name": "Building Materials and Resources",
            "order": 3,
            "max_points": {"owner": 13, "tenant": 13},
            "criteria": [
                {"id": "bmr-p1", "code": "BMR Mandatory 1", "name": "Segregation of Waste", "mandatory": True, "max_owner": 0, "max_tenant": 0},
                {"id": "bmr-1", "code": "BMR Credit 1", "name": "Sustainable Building Materials", "mandatory": False, "max_owner": 4, "max_tenant": 4},
                {"id": "bmr-2", "code": "BMR Credit 2", "name": "Local Materials", "mandatory": False, "max_owner": 3, "max_tenant": 3},
                {"id": "bmr-3", "code": "BMR Credit 3", "name": "Recycled Content Materials", "mandatory": False, "max_owner": 3, "max_tenant": 3},
                {"id": "bmr-4", "code": "BMR Credit 4", "name": "Construction Waste Management", "mandatory": False, "max_owner": 3, "max_tenant": 3},
            ],
        },
        {
            "id": "ieq",
            "name": "Indoor Environmental Quality",
            "order": 4,
            "max_points": {"owner": 15, "tenant": 12},
            "criteria": [
                {"id": "ieq-p1", "code": "IEQ Mandatory 1", "name": "Minimum Fresh Air Ventilation", "mandatory": True, "max_owner": 0, "max_tenant": 0},
                {"id": "ieq-p2", "code": "IEQ Mandatory 2", "name": "Tobacco Smoke Control", "mandatory": True, "max_owner": 0, "max_tenant": 0},
                {"id": "ieq-1", "code": "IEQ Credit 1", "name": "Enhanced Fresh Air Ventilation", "mandatory": False, "max_owner": 4, "max_tenant": 3},
                {"id": "ieq-2", "code": "IEQ Credit 2", "name": "Low-VOC Materials", "mandatory": False, "max_owner": 3, "max_tenant": 3},
                {"id": "ieq-3", "code": "IEQ Credit 3", "name": "Daylighting", "mandatory": False, "max_owner": 4, "max_tenant": 3},
                {"id": "ieq-4", "code": "IEQ Credit 4", "name": "Outdoor Views", "mandatory": False, "max_owner": 2, "max_tenant": 2},
                {"id": "ieq-5", "code": "IEQ Credit 5", "name": "Indoor Air Quality Management", "mandatory": False, "max_owner": 2, "max_tenant": 1},
            ],
        },
        {
            "id": "id",
            "name": "Innovation and Decarbonisation",
            "order": 5,
            "max_points": {"owner": 11, "tenant": 11},
            "criteria": [
                {"id": "id-1", "code": "ID Credit 1", "name": "Innovation in Design", "mandatory": False, "max_owner": 4, "max_tenant": 4},
                {"id": "id-2", "code": "ID Credit 2", "name": "Decarbonisation Measures", "mandatory": False, "max_owner": 4, "max_tenant": 4},
                {"id": "id-3", "code": "ID Credit 3", "name": "IGBC Accredited Professional", "mandatory": False, "max_owner": 3, "max_tenant": 3},
            ],
        },
    ],
}

PROJECT_TYPE_TEMPLATE = {
    "Commercial": COMMERCIAL_TEMPLATE,
    # Residential / Hotel / Hospital pending authorised data (Phase 2).
}


def template_for_type(project_type: str):
    return PROJECT_TYPE_TEMPLATE.get(project_type)


def view_template(project_type: str, occupancy: str = "owner") -> dict:
    """Return the template shaped for a given occupancy variant, with per-criterion max."""
    tpl = template_for_type(project_type)
    if not tpl:
        return {"under_configuration": True, "project_type": project_type}
    occ = occupancy if occupancy in tpl["occupancy_variants"] else "owner"
    cats = []
    for c in tpl["categories"]:
        criteria = [
            {
                "id": cr["id"],
                "code": cr["code"],
                "name": cr["name"],
                "mandatory": cr["mandatory"],
                "max_points": cr["max_owner"] if occ == "owner" else cr["max_tenant"],
            }
            for cr in c["criteria"]
        ]
        cats.append({
            "id": c["id"],
            "name": c["name"],
            "order": c["order"],
            "max_points": c["max_points"][occ],
            "criteria": criteria,
        })
    return {
        "under_configuration": False,
        "id": tpl["id"],
        "project_type": tpl["project_type"],
        "name": tpl["name"],
        "version": tpl["version"],
        "occupancy": occ,
        "total_max": tpl["total_max"][occ],
        "thresholds": tpl["thresholds"],
        "categories": cats,
    }


def band_for_score(project_type: str, score: float) -> str:
    tpl = template_for_type(project_type)
    if not tpl:
        return "Pending"
    for t in tpl["thresholds"]:
        if t["min"] <= score <= t["max"]:
            return t["band"]
    return "Uncertified"


def score_project(project: dict) -> dict:
    """Compute claimed score/band from a project's responses. Never fabricates."""
    tpl = template_for_type(project.get("project_type"))
    if not tpl:
        return {"under_configuration": True, "claimed_total": 0, "band": "Pending", "categories": {}, "mandatory_ok": None}
    occ = project.get("occupancy_type", "owner")
    occ = occ if occ in tpl["occupancy_variants"] else "owner"
    responses = project.get("responses", {}) or {}
    cat_scores = {}
    total = 0
    mandatory_ok = True
    for c in tpl["categories"]:
        cmax = c["max_points"][occ]
        csum = 0
        for cr in c["criteria"]:
            r = responses.get(cr["id"], {}) or {}
            crmax = cr["max_owner"] if occ == "owner" else cr["max_tenant"]
            if cr["mandatory"]:
                if not r.get("met", False):
                    mandatory_ok = False
            else:
                pts = r.get("claimed_points", 0) or 0
                try:
                    pts = float(pts)
                except (TypeError, ValueError):
                    pts = 0
                pts = max(0, min(pts, crmax))
                csum += pts
        csum = min(csum, cmax)
        cat_scores[c["id"]] = round(csum, 1)
        total += csum
    total = round(min(total, tpl["total_max"][occ]), 1)
    return {
        "under_configuration": False,
        "claimed_total": total,
        "total_max": tpl["total_max"][occ],
        "band": band_for_score(project.get("project_type"), total),
        "categories": cat_scores,
        "mandatory_ok": mandatory_ok,
    }
