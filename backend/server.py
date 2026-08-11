import os
import re
import io
import csv
import uuid
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List

from dotenv import load_dotenv
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, Query
from fastapi.responses import StreamingResponse, FileResponse, PlainTextResponse
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field, field_validator

from database import db, create_indexes
from app.services import storage
from app.api.files import router as files_router
from auth import (
    hash_password, verify_password, create_access_token, set_auth_cookies,
    clear_auth_cookies, new_csrf_token, get_current_admin, admin_write,
    check_lockout, register_failed, clear_attempts,
)
from email_service import send_enquiry_notification
from seed import run_seed, now_iso

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="RES API")
api = APIRouter(prefix="/api")
BACKEND_URL = os.environ.get("FRONTEND_URL", "")
MAX_SIZE = int(os.environ.get("UPLOAD_MAX_SIZE_MB", "10")) * 1024 * 1024


def slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower().strip())
    return re.sub(r"-+", "-", s).strip("-")


def clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


# ---------------- Health ----------------
@api.get("/health")
async def health():
    return {"status": "ok", "time": now_iso()}


# ---------------- Auth schemas ----------------
class LoginInput(BaseModel):
    identifier: str
    password: str


class ChangePasswordInput(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def strong(cls, v):
        if len(v) < 8 or not re.search(r"[A-Z]", v) or not re.search(r"[a-z]", v) or not re.search(r"\d", v):
            raise ValueError("Password must be at least 8 characters with upper, lower and numeric characters.")
        return v


# ---------------- Auth routes ----------------
@api.post("/admin/auth/login")
async def login(data: LoginInput, request: Request, response: Response):
    ident = data.identifier.strip().lower()
    ip = request.client.host if request.client else "unknown"
    key = f"{ip}:{ident}"
    await check_lockout(key)
    admin = await db.admins.find_one({"$or": [{"login_id": ident}, {"email": ident}]})
    if not admin or not verify_password(data.password, admin["password_hash"]):
        await register_failed(key)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    await clear_attempts(key)
    token = create_access_token(admin["id"])
    csrf = new_csrf_token()
    set_auth_cookies(response, token, csrf)
    return {"id": admin["id"], "login_id": admin["login_id"], "email": admin["email"], "name": admin["name"]}


@api.post("/admin/auth/logout")
async def logout(response: Response, admin: dict = Depends(get_current_admin)):
    clear_auth_cookies(response)
    return {"message": "Logged out"}


@api.get("/admin/auth/me")
async def me(admin: dict = Depends(get_current_admin)):
    return admin


@api.post("/admin/auth/change-password")
async def change_password(data: ChangePasswordInput, admin: dict = Depends(admin_write)):
    if data.new_password != data.confirm_password:
        raise HTTPException(status_code=400, detail="New passwords do not match")
    full = await db.admins.find_one({"id": admin["id"]})
    if not verify_password(data.current_password, full["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    await db.admins.update_one({"id": admin["id"]}, {"$set": {
        "password_hash": hash_password(data.new_password), "updated_at": now_iso()}})
    return {"message": "Password changed successfully"}


# ---------------- Generic content CRUD ----------------
async def next_order(coll):
    last = await db[coll].find_one(sort=[("display_order", -1)])
    return (last.get("display_order", -1) + 1) if last else 0


async def unique_slug(coll, base, exclude_id=None):
    slug, i = base, 1
    while True:
        q = {"slug": slug}
        if exclude_id:
            q["id"] = {"$ne": exclude_id}
        if not await db[coll].find_one(q):
            return slug
        i += 1
        slug = f"{base}-{i}"


def register_crud(coll, slug_field=None, admin_only_list=False):
    @api.get(f"/admin/{coll}", name=f"admin_list_{coll}")
    async def list_items(admin: dict = Depends(get_current_admin), search: Optional[str] = None):
        q = {}
        if search:
            q["$or"] = [{"title": {"$regex": search, "$options": "i"}},
                        {"name": {"$regex": search, "$options": "i"}}]
        items = await db[coll].find(q, {"_id": 0}).sort("display_order", 1).to_list(1000)
        return items

    @api.post(f"/admin/{coll}", name=f"admin_create_{coll}")
    async def create_item(payload: dict, admin: dict = Depends(admin_write)):
        payload.pop("_id", None)
        payload["id"] = str(uuid.uuid4())
        payload["display_order"] = payload.get("display_order", await next_order(coll))
        if slug_field:
            base = slugify(payload.get("slug") or payload.get(slug_field, ""))
            payload["slug"] = await unique_slug(coll, base or str(uuid.uuid4())[:8])
        payload["created_at"] = now_iso()
        payload["updated_at"] = now_iso()
        payload["created_by"] = admin["email"]
        await db[coll].insert_one(dict(payload))
        return clean(payload)

    @api.get(f"/admin/{coll}/{{item_id}}", name=f"admin_get_{coll}")
    async def get_item(item_id: str, admin: dict = Depends(get_current_admin)):
        doc = await db[coll].find_one({"id": item_id}, {"_id": 0})
        if not doc:
            raise HTTPException(404, "Not found")
        return doc

    @api.put(f"/admin/{coll}/{{item_id}}", name=f"admin_update_{coll}")
    async def update_item(item_id: str, payload: dict, admin: dict = Depends(admin_write)):
        payload.pop("_id", None)
        payload.pop("id", None)
        if slug_field and payload.get("slug"):
            payload["slug"] = await unique_slug(coll, slugify(payload["slug"]), exclude_id=item_id)
        payload["updated_at"] = now_iso()
        payload["updated_by"] = admin["email"]
        res = await db[coll].update_one({"id": item_id}, {"$set": payload})
        if res.matched_count == 0:
            raise HTTPException(404, "Not found")
        return await db[coll].find_one({"id": item_id}, {"_id": 0})

    @api.delete(f"/admin/{coll}/{{item_id}}", name=f"admin_delete_{coll}")
    async def delete_item(item_id: str, admin: dict = Depends(admin_write)):
        await db[coll].delete_one({"id": item_id})
        return {"message": "Deleted"}


register_crud("services", slug_field="title")
register_crud("projects", slug_field="title")
register_crud("team_members")
register_crud("blog_posts", slug_field="title")


class ReorderInput(BaseModel):
    ids: List[str]


@api.patch("/admin/{coll}/reorder/apply")
async def reorder(coll: str, data: ReorderInput, admin: dict = Depends(admin_write)):
    if coll not in ("services", "projects", "team_members", "blog_posts", "industries", "methodology_steps", "resources", "partners", "events", "certification_rules", "assessment_questions"):
        raise HTTPException(400, "Invalid collection")
    for i, _id in enumerate(data.ids):
        await db[coll].update_one({"id": _id}, {"$set": {"display_order": i}})
    return {"message": "Reordered"}


# ==================== PHASE 1: LEADS + MODULES ====================
async def create_lead(source, data, service=None):
    lead = {
        "id": str(uuid.uuid4()),
        "name": data.get("name", ""),
        "company": data.get("company", ""),
        "email": (data.get("email", "") or "").lower(),
        "phone": data.get("phone", ""),
        "source": source,
        "interested_service": service or data.get("interested_service") or data.get("service") or "",
        "message": data.get("message", ""),
        "status": "New",
        "admin_note": "",
        "follow_up_date": "",
        "utm_source": data.get("utm_source", ""),
        "utm_medium": data.get("utm_medium", ""),
        "utm_campaign": data.get("utm_campaign", ""),
        "ref_id": data.get("ref_id", ""),
        "created_at": now_iso(),
    }
    await db.leads.insert_one(dict(lead))
    return lead


# New content collections (reuse generic CRUD)
register_crud("industries", slug_field="title")
register_crud("methodology_steps")
register_crud("resources", slug_field="title")
register_crud("partners")
register_crud("events", slug_field="title")
register_crud("certification_rules")
register_crud("assessment_questions")


# ---- Generic document upload (PDF/DOCX) for resources & RFP ----
ALLOWED_DOC = {"application/pdf": ".pdf",
               "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
               "application/msword": ".doc"}


@api.post("/admin/uploads/document")
async def upload_document(file: UploadFile = File(...), admin: dict = Depends(admin_write)):
    if file.content_type not in ALLOWED_DOC or not file.filename.lower().endswith((".pdf", ".docx", ".doc")):
        raise HTTPException(400, "Only PDF or DOCX documents are allowed")
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(400, "File too large")
    fname = f"{uuid.uuid4().hex}{ALLOWED_DOC[file.content_type]}"
    await storage.save_bytes(f"documents/{fname}", content, file.content_type, original_name=file.filename)
    url = f"{BACKEND_URL}/api/uploads/documents/{fname}"
    return {"url": url, "filename": fname, "original_name": file.filename, "size": len(content)}


# ---- Public content endpoints ----
@api.get("/public/industries")
async def public_industries():
    return await db.industries.find({"active": True}, {"_id": 0}).sort("display_order", 1).to_list(100)


@api.get("/public/industries/{slug}")
async def public_industry(slug: str):
    doc = await db.industries.find_one({"slug": slug, "active": True}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Industry not found")
    return doc


@api.get("/public/methodology")
async def public_methodology():
    return await db.methodology_steps.find({"active": True}, {"_id": 0}).sort("display_order", 1).to_list(100)


@api.get("/public/partners")
async def public_partners():
    return await db.partners.find({"active": True}, {"_id": 0}).sort("display_order", 1).to_list(100)


@api.get("/public/events")
async def public_events():
    items = await db.events.find({"active": True}, {"_id": 0}).sort("event_date", -1).to_list(200)
    today = now_iso()
    upcoming = [e for e in items if (e.get("event_date") or "") >= today]
    past = [e for e in items if (e.get("event_date") or "") < today]
    return {"upcoming": sorted(upcoming, key=lambda x: x.get("event_date", "")), "past": past}


@api.get("/public/resources")
async def public_resources(category: Optional[str] = None):
    q = {"status": "published"}
    if category and category != "All":
        q["category"] = category
    items = await db.resources.find(q, {"_id": 0}).sort("display_order", 1).to_list(500)
    all_docs = await db.resources.find({"status": "published"}, {"_id": 0, "category": 1}).to_list(500)
    cats = sorted({d.get("category") for d in all_docs if d.get("category")})
    return {"items": items, "categories": cats}


class ResourceLeadInput(BaseModel):
    name: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""
    company: Optional[str] = ""


@api.post("/public/resources/{rid}/download")
async def download_resource(rid: str, data: ResourceLeadInput):
    doc = await db.resources.find_one({"id": rid, "status": "published"}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Resource not found")
    await db.resources.update_one({"id": rid}, {"$inc": {"download_count": 1}})
    if doc.get("require_lead") and data.email:
        await create_lead("Resource Download", data.model_dump(), service=doc.get("title"))
    return {"url": doc.get("file_url", "")}


# ---- Booking a Discovery / Free Consultation ----
class BookingInput(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: Optional[str] = ""
    company: Optional[str] = ""
    service: Optional[str] = ""
    project_type: Optional[str] = ""
    preferred_date: Optional[str] = ""
    preferred_time: Optional[str] = ""
    meeting_mode: Optional[str] = ""
    project_location: Optional[str] = ""
    message: Optional[str] = ""


@api.post("/public/bookings")
async def create_booking(data: BookingInput, request: Request):
    ip = request.client.host if request.client else "unknown"
    since = datetime.now(timezone.utc).timestamp() - 60
    if await db.bookings.count_documents({"ip": ip, "ts": {"$gt": since}}) >= 3:
        raise HTTPException(429, "Too many submissions. Please try again shortly.")
    doc = {"id": str(uuid.uuid4()), **data.model_dump(), "email": data.email.lower(),
           "status": "New", "admin_note": "", "ip": ip,
           "ts": datetime.now(timezone.utc).timestamp(), "created_at": now_iso()}
    await db.bookings.insert_one(dict(doc))
    await create_lead("Discovery Call", doc, service=data.service)
    try:
        await send_enquiry_notification({
            "name": data.name, "email": data.email, "phone": data.phone, "company": data.company,
            "subject": "New Discovery Call Booking", "service_of_interest": data.service,
            "source_page": "Book a Consultation",
            "message": f"Preferred: {data.preferred_date} {data.preferred_time} | Mode: {data.meeting_mode} | "
                       f"Type: {data.project_type} | Location: {data.project_location}\n\n{data.message}",
        })
    except Exception as e:
        logger.error(f"booking notify failed: {e}")
    return {"message": "Thank you. Your consultation request has been received."}


@api.get("/admin/bookings")
async def list_bookings(admin: dict = Depends(get_current_admin), status: Optional[str] = None,
                        search: Optional[str] = None, page: int = 1, limit: int = 50):
    q = {}
    if status and status != "All":
        q["status"] = status
    if search:
        q["$or"] = [{"name": {"$regex": search, "$options": "i"}}, {"email": {"$regex": search, "$options": "i"}},
                    {"company": {"$regex": search, "$options": "i"}}]
    total = await db.bookings.count_documents(q)
    items = await db.bookings.find(q, {"_id": 0}).sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    return {"items": items, "total": total}


class BookingUpdate(BaseModel):
    status: Optional[str] = None
    admin_note: Optional[str] = None


@api.patch("/admin/bookings/{bid}")
async def update_booking(bid: str, data: BookingUpdate, admin: dict = Depends(admin_write)):
    upd = {k: v for k, v in data.model_dump().items() if v is not None}
    res = await db.bookings.update_one({"id": bid}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    return await db.bookings.find_one({"id": bid}, {"_id": 0})


@api.delete("/admin/bookings/{bid}")
async def delete_booking(bid: str, admin: dict = Depends(admin_write)):
    await db.bookings.delete_one({"id": bid})
    return {"message": "Deleted"}


# ---- Certification Finder ----
class FinderInput(BaseModel):
    name: str = Field(min_length=2)
    email: EmailStr
    phone: Optional[str] = ""
    company: Optional[str] = ""
    building_type: Optional[str] = ""
    location: Optional[str] = ""
    construction_type: Optional[str] = ""
    project_stage: Optional[str] = ""
    floor_area: Optional[str] = ""
    priorities: List[str] = []
    desired_outcome: Optional[str] = ""
    timeline: Optional[str] = ""
    budget_range: Optional[str] = ""


DISCLAIMER = ("This is a preliminary suggestion based on the information you provided and is not an "
              "official certification eligibility decision. Please book a consultation for a detailed review.")


@api.post("/public/certification-finder")
async def certification_finder(data: FinderInput):
    rules = await db.certification_rules.find({"active": True}, {"_id": 0}).sort("display_order", 1).to_list(100)
    scored = []
    for r in rules:
        score, reasons = 0, []
        if data.building_type and data.building_type in (r.get("building_types") or []):
            score += 2
            reasons.append(f"suited to {data.building_type} projects")
        if data.construction_type and data.construction_type in (r.get("construction_types") or []):
            score += 1
            reasons.append(f"supports {data.construction_type.lower()}")
        overlap = set(data.priorities) & set(r.get("priorities") or [])
        if overlap:
            score += len(overlap)
            reasons.append("aligns with your priorities: " + ", ".join(sorted(overlap)))
        if data.desired_outcome and data.desired_outcome.upper() in (r.get("framework") or "").upper():
            score += 2
            reasons.append("matches your desired certification outcome")
        if score > 0:
            scored.append({"framework": r["framework"], "score": score,
                           "why": r.get("blurb", ""), "reasons": reasons})
    scored.sort(key=lambda x: x["score"], reverse=True)
    if not scored:
        scored = [{"framework": r["framework"], "score": 0, "why": r.get("blurb", ""),
                   "reasons": ["A commonly applicable framework worth exploring"]} for r in rules[:3]]
    suggestions = scored[:4]
    result = {
        "id": str(uuid.uuid4()), **data.model_dump(), "email": data.email.lower(),
        "suggestions": suggestions, "disclaimer": DISCLAIMER,
        "next_steps": ["Book a consultation with RES", "Share detailed project drawings and goals",
                       "Receive a tailored certification roadmap"],
        "created_at": now_iso(),
    }
    await db.certification_results.insert_one(dict(result))
    await create_lead("Certification Finder", result, service="Building Certification")
    return {"suggestions": suggestions, "disclaimer": DISCLAIMER, "next_steps": result["next_steps"]}


@api.get("/admin/certification-results")
async def list_cert_results(admin: dict = Depends(get_current_admin), page: int = 1, limit: int = 50):
    total = await db.certification_results.count_documents({})
    items = await db.certification_results.find({}, {"_id": 0}).sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    return {"items": items, "total": total}


# ---- Sustainability Readiness Assessment ----
@api.get("/public/assessment-questions")
async def public_assessment_questions():
    qs = await db.assessment_questions.find({"active": True}, {"_id": 0}).sort("display_order", 1).to_list(100)
    for q in qs:
        q.pop("weight", None)
        for o in q.get("options", []):
            o.pop("score", None)
    return qs


BANDS = [(0, 40, "Getting Started"), (41, 60, "Developing"), (61, 80, "Ready"), (81, 100, "Leading")]
CATEGORY_RECS = {
    "Governance & Strategy": "Formalise a sustainability policy with clear ownership and targets.",
    "Energy Management": "Commission an energy audit and set measurable efficiency targets.",
    "Water Management": "Baseline water use and introduce conservation and reuse measures.",
    "Waste Management": "Implement waste segregation, tracking and diversion targets.",
    "Indoor Environmental Quality": "Assess air quality, lighting and thermal comfort against WELL/IGBC benchmarks.",
    "Carbon & Climate Reporting": "Begin GHG accounting and align disclosures to recognised frameworks.",
    "Green Building Readiness": "Undertake a certification gap analysis (LEED/IGBC/GRIHA).",
}
CATEGORY_SERVICE = {
    "Energy Management": "Audit & Energy", "Green Building Readiness": "Building Certification",
    "Carbon & Climate Reporting": "Data Management & Reporting", "Governance & Strategy": "Climate Action Plan",
}


class AssessmentInput(BaseModel):
    name: str = Field(min_length=2)
    email: EmailStr
    phone: Optional[str] = ""
    company: Optional[str] = ""
    answers: dict = {}  # {question_id: option_index}


@api.post("/public/assessment")
async def submit_assessment(data: AssessmentInput):
    qs = await db.assessment_questions.find({"active": True}, {"_id": 0}).to_list(100)
    cat_scores, cat_max = {}, {}
    for q in qs:
        opts = q.get("options", [])
        picked = data.answers.get(q["id"])
        if picked is None:
            continue
        try:
            score = float(opts[int(picked)].get("score", 0))
        except (ValueError, IndexError, TypeError):
            score = 0
        w = float(q.get("weight", 1) or 1)
        cat = q.get("category", "General")
        cat_scores[cat] = cat_scores.get(cat, 0) + score * w
        cat_max[cat] = cat_max.get(cat, 0) + 4 * w
    category_scores = {c: round(cat_scores[c] / cat_max[c] * 100) if cat_max.get(c) else 0 for c in cat_scores}
    overall = round(sum(category_scores.values()) / len(category_scores)) if category_scores else 0
    band = next((name for lo, hi, name in BANDS if lo <= overall <= hi), "Getting Started")
    gaps = [c for c, s in category_scores.items() if s < 60]
    recommendations = [CATEGORY_RECS.get(c) for c in gaps if CATEGORY_RECS.get(c)]
    services = sorted({CATEGORY_SERVICE[c] for c in gaps if c in CATEGORY_SERVICE})
    result = {
        "id": str(uuid.uuid4()), "name": data.name, "email": data.email.lower(),
        "phone": data.phone, "company": data.company,
        "overall_score": overall, "band": band, "category_scores": category_scores,
        "gaps": gaps, "recommendations": recommendations, "suggested_services": services,
        "created_at": now_iso(),
    }
    await db.assessment_results.insert_one(dict(result))
    await create_lead("Readiness Assessment", result)
    result.pop("_id", None)
    return {"overall_score": overall, "band": band, "category_scores": category_scores,
            "gaps": gaps, "recommendations": recommendations, "suggested_services": services,
            "disclaimer": "This readiness score is indicative only and not a formal audit."}


@api.get("/admin/assessment-results")
async def list_assessment_results(admin: dict = Depends(get_current_admin), page: int = 1, limit: int = 50):
    total = await db.assessment_results.count_documents({})
    items = await db.assessment_results.find({}, {"_id": 0}).sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    return {"items": items, "total": total}


# ---- Unified Leads ----
LEAD_STATUSES = ["New", "Contacted", "Follow-up", "Qualified", "Converted", "Closed"]


@api.get("/admin/leads")
async def list_leads(admin: dict = Depends(get_current_admin), status: Optional[str] = None,
                     source: Optional[str] = None, search: Optional[str] = None, page: int = 1, limit: int = 25):
    q = {}
    if status and status != "All":
        q["status"] = status
    if source and source != "All":
        q["source"] = source
    if search:
        q["$or"] = [{"name": {"$regex": search, "$options": "i"}}, {"email": {"$regex": search, "$options": "i"}},
                    {"company": {"$regex": search, "$options": "i"}}]
    total = await db.leads.count_documents(q)
    items = await db.leads.find(q, {"_id": 0}).sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    sources = sorted(await db.leads.distinct("source"))
    return {"items": items, "total": total, "page": page, "limit": limit, "sources": sources}


@api.get("/admin/leads/export")
async def export_leads(admin: dict = Depends(get_current_admin)):
    items = await db.leads.find({}, {"_id": 0}).sort("created_at", -1).to_list(10000)
    buf = io.StringIO()
    fields = ["created_at", "name", "company", "email", "phone", "source", "interested_service",
              "status", "follow_up_date", "admin_note", "message"]
    w = csv.DictWriter(buf, fieldnames=fields, extrasaction="ignore")
    w.writeheader()
    for it in items:
        w.writerow(it)
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=leads.csv"})


class LeadUpdate(BaseModel):
    status: Optional[str] = None
    admin_note: Optional[str] = None
    follow_up_date: Optional[str] = None


@api.patch("/admin/leads/{lid}")
async def update_lead(lid: str, data: LeadUpdate, admin: dict = Depends(admin_write)):
    upd = {k: v for k, v in data.model_dump().items() if v is not None}
    res = await db.leads.update_one({"id": lid}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    return await db.leads.find_one({"id": lid}, {"_id": 0})


@api.delete("/admin/leads/{lid}")
async def delete_lead(lid: str, admin: dict = Depends(admin_write)):
    await db.leads.delete_one({"id": lid})
    return {"message": "Deleted"}




# ---------------- Enquiries ----------------
class EnquiryInput(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: Optional[str] = ""
    company: Optional[str] = ""
    subject: Optional[str] = ""
    service_of_interest: Optional[str] = ""
    message: str = Field(min_length=5, max_length=4000)
    source_page: Optional[str] = ""


@api.post("/public/enquiries")
async def create_enquiry(data: EnquiryInput, request: Request):
    ip = request.client.host if request.client else "unknown"
    since = datetime.now(timezone.utc).timestamp() - 60
    recent = await db.enquiries.count_documents({"ip": ip, "ts": {"$gt": since}})
    if recent >= 3:
        raise HTTPException(429, "Too many submissions. Please try again shortly.")
    dup = await db.enquiries.find_one({"email": data.email.lower(), "message": data.message, "ts": {"$gt": since}})
    if dup:
        raise HTTPException(400, "Duplicate submission detected.")
    doc = {
        "id": str(uuid.uuid4()), **data.model_dump(),
        "email": data.email.lower(), "status": "New", "admin_note": "",
        "ip": ip, "ts": datetime.now(timezone.utc).timestamp(),
        "created_at": now_iso(),
    }
    await db.enquiries.insert_one(dict(doc))
    await create_lead("Contact Form", {**doc, "interested_service": data.service_of_interest})
    try:
        await send_enquiry_notification(doc)
    except Exception as e:
        logger.error(f"notify failed: {e}")
    return {"message": "Thank you. Your enquiry has been received."}


@api.get("/admin/enquiries")
async def list_enquiries(admin: dict = Depends(get_current_admin), status: Optional[str] = None,
                         search: Optional[str] = None, page: int = 1, limit: int = 20):
    q = {}
    if status and status != "All":
        q["status"] = status
    if search:
        q["$or"] = [{"name": {"$regex": search, "$options": "i"}},
                    {"email": {"$regex": search, "$options": "i"}},
                    {"company": {"$regex": search, "$options": "i"}},
                    {"subject": {"$regex": search, "$options": "i"}}]
    total = await db.enquiries.count_documents(q)
    items = await db.enquiries.find(q, {"_id": 0}).sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    return {"items": items, "total": total, "page": page, "limit": limit}


@api.get("/admin/enquiries/export")
async def export_enquiries(admin: dict = Depends(get_current_admin)):
    items = await db.enquiries.find({}, {"_id": 0}).sort("created_at", -1).to_list(10000)
    buf = io.StringIO()
    fields = ["created_at", "name", "email", "phone", "company", "subject",
              "service_of_interest", "source_page", "status", "admin_note", "message"]
    w = csv.DictWriter(buf, fieldnames=fields, extrasaction="ignore")
    w.writeheader()
    for it in items:
        w.writerow(it)
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=enquiries.csv"})


@api.get("/admin/enquiries/{eid}")
async def get_enquiry(eid: str, admin: dict = Depends(get_current_admin)):
    doc = await db.enquiries.find_one({"id": eid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    if doc.get("status") == "New":
        await db.enquiries.update_one({"id": eid}, {"$set": {"status": "Read"}})
        doc["status"] = "Read"
    return doc


class EnquiryUpdate(BaseModel):
    status: Optional[str] = None
    admin_note: Optional[str] = None


@api.patch("/admin/enquiries/{eid}")
async def update_enquiry(eid: str, data: EnquiryUpdate, admin: dict = Depends(admin_write)):
    upd = {k: v for k, v in data.model_dump().items() if v is not None}
    if not upd:
        raise HTTPException(400, "Nothing to update")
    res = await db.enquiries.update_one({"id": eid}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    return await db.enquiries.find_one({"id": eid}, {"_id": 0})


@api.delete("/admin/enquiries/{eid}")
async def delete_enquiry(eid: str, admin: dict = Depends(admin_write)):
    await db.enquiries.delete_one({"id": eid})
    return {"message": "Deleted"}


# ---------------- Singletons (settings, homepage, about, seo) ----------------
async def get_singleton(coll, _id):
    doc = await db[coll].find_one({"id": _id}, {"_id": 0})
    return doc or {}


def register_singleton(coll, _id):
    @api.get(f"/admin/{coll}", name=f"admin_get_singleton_{coll}")
    async def get_s(admin: dict = Depends(get_current_admin)):
        return await get_singleton(coll, _id)

    @api.put(f"/admin/{coll}", name=f"admin_put_singleton_{coll}")
    async def put_s(payload: dict, admin: dict = Depends(admin_write)):
        payload.pop("_id", None)
        payload["id"] = _id
        payload["updated_at"] = now_iso()
        await db[coll].update_one({"id": _id}, {"$set": payload}, upsert=True)
        return await get_singleton(coll, _id)


register_singleton("website_settings", "settings")
register_singleton("homepage", "homepage")
register_singleton("about", "about")
register_singleton("seo_settings", "seo")


# ---------------- Legal pages ----------------
@api.get("/admin/legal")
async def admin_legal(admin: dict = Depends(get_current_admin)):
    return await db.legal_pages.find({}, {"_id": 0}).to_list(50)


@api.put("/admin/legal/{slug}")
async def update_legal(slug: str, payload: dict, admin: dict = Depends(admin_write)):
    payload.pop("_id", None)
    payload["updated_at"] = now_iso()
    await db.legal_pages.update_one({"slug": slug}, {"$set": payload})
    return await db.legal_pages.find_one({"slug": slug}, {"_id": 0})


# ---------------- Uploads / Media ----------------
ALLOWED_IMG = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


@api.post("/admin/uploads")
async def upload_image(file: UploadFile = File(...), admin: dict = Depends(admin_write)):
    if file.content_type not in ALLOWED_IMG:
        raise HTTPException(400, "Only JPEG, PNG and WebP images are allowed")
    ext = ALLOWED_IMG[file.content_type]
    if not file.filename.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
        raise HTTPException(400, "Invalid file extension")
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(400, "File too large")
    fname = f"{uuid.uuid4().hex}{ext}"
    await storage.save_bytes(f"images/{fname}", content, file.content_type, original_name=file.filename)
    url = f"{BACKEND_URL}/api/uploads/images/{fname}"
    doc = {"id": str(uuid.uuid4()), "filename": fname, "url": url, "size": len(content),
           "content_type": file.content_type, "original_name": file.filename, "created_at": now_iso()}
    await db.media.insert_one(dict(doc))
    return clean(doc)


@api.get("/admin/uploads")
async def list_media(admin: dict = Depends(get_current_admin)):
    return await db.media.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.delete("/admin/uploads/{mid}")
async def delete_media(mid: str, admin: dict = Depends(admin_write)):
    doc = await db.media.find_one({"id": mid})
    if doc:
        await storage.delete_by_key(f"images/{doc['filename']}")
        await db.media.delete_one({"id": mid})
    return {"message": "Deleted"}


# ---------------- Capability PDF ----------------
@api.post("/admin/capability-profile")
async def upload_capability(file: UploadFile = File(...), admin: dict = Depends(admin_write)):
    if file.content_type != "application/pdf" or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF documents are allowed")
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(400, "File too large")
    fname = f"capability-{uuid.uuid4().hex}.pdf"
    await storage.save_bytes(f"documents/{fname}", content, "application/pdf", original_name=file.filename)
    url = f"{BACKEND_URL}/api/uploads/documents/{fname}"
    doc = {"id": "capability", "filename": fname, "url": url, "size": len(content),
           "original_name": file.filename, "updated_at": now_iso()}
    old = await db.documents.find_one({"id": "capability"})
    if old and old.get("filename"):
        await storage.delete_by_key(f"documents/{old['filename']}")
    await db.documents.update_one({"id": "capability"}, {"$set": doc}, upsert=True)
    return clean(doc)


@api.get("/admin/capability-profile")
async def admin_capability(admin: dict = Depends(get_current_admin)):
    return await db.documents.find_one({"id": "capability"}, {"_id": 0}) or {}


# ---------------- Dashboard ----------------
@api.get("/admin/dashboard")
async def dashboard(admin: dict = Depends(get_current_admin)):
    recent = await db.enquiries.find({}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    top_res = await db.resources.find({}, {"_id": 0, "title": 1, "download_count": 1}).sort("download_count", -1).limit(5).to_list(5)
    dl_agg = await db.resources.aggregate([{"$group": {"_id": None, "t": {"$sum": "$download_count"}}}]).to_list(1)
    return {
        "total_projects": await db.projects.count_documents({}),
        "published_projects": await db.projects.count_documents({"status": "published"}),
        "total_services": await db.services.count_documents({}),
        "total_team": await db.team_members.count_documents({}),
        "total_blogs": await db.blog_posts.count_documents({}),
        "draft_blogs": await db.blog_posts.count_documents({"status": "draft"}),
        "total_enquiries": await db.enquiries.count_documents({}),
        "new_enquiries": await db.enquiries.count_documents({"status": "New"}),
        "total_leads": await db.leads.count_documents({}),
        "new_leads": await db.leads.count_documents({"status": "New"}),
        "follow_up_leads": await db.leads.count_documents({"status": "Follow-up"}),
        "total_bookings": await db.bookings.count_documents({}),
        "new_bookings": await db.bookings.count_documents({"status": "New"}),
        "assessment_completions": await db.assessment_results.count_documents({}),
        "certification_completions": await db.certification_results.count_documents({}),
        "total_industries": await db.industries.count_documents({}),
        "total_resources": await db.resources.count_documents({}),
        "resource_downloads": (dl_agg[0]["t"] if dl_agg else 0),
        "most_downloaded": top_res,
        "recent_enquiries": recent,
    }


# ======================= PUBLIC =======================
@api.get("/public/settings")
async def public_settings():
    s = await get_singleton("website_settings", "settings")
    seo = await get_singleton("seo_settings", "seo")
    return {"settings": s, "seo": seo}


@api.get("/public/home")
async def public_home():
    home = await get_singleton("homepage", "homepage")
    services = await db.services.find({"active": True}, {"_id": 0}).sort("display_order", 1).to_list(100)
    projects = await db.projects.find({"status": "published", "featured": True}, {"_id": 0}).sort("display_order", 1).to_list(6)
    if not projects:
        projects = await db.projects.find({"status": "published"}, {"_id": 0}).sort("display_order", 1).to_list(6)
    team = await db.team_members.find({"active": True}, {"_id": 0}).sort("display_order", 1).to_list(100)
    blogs = await db.blog_posts.find({"status": "published"}, {"_id": 0}).sort("created_at", -1).to_list(3)
    settings = await get_singleton("website_settings", "settings")
    return {"home": home, "services": services, "projects": projects, "team": team,
            "blogs": blogs, "credentials": settings.get("credentials", []),
            "credential_logos": settings.get("credential_logos", []),
            "collaborations": settings.get("collaborations", [])}


@api.get("/public/about")
async def public_about():
    return await get_singleton("about", "about")


@api.get("/public/services")
async def public_services():
    return await db.services.find({"active": True}, {"_id": 0}).sort("display_order", 1).to_list(100)


@api.get("/public/services/{slug}")
async def public_service(slug: str):
    doc = await db.services.find_one({"slug": slug, "active": True}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Service not found")
    return doc


@api.get("/public/projects")
async def public_projects(category: Optional[str] = None, location: Optional[str] = None,
                          search: Optional[str] = None, featured: Optional[bool] = None):
    q = {"status": "published"}
    if category and category != "All":
        q["category"] = category
    if location and location != "All":
        q["location"] = location
    if featured is not None:
        q["featured"] = featured
    if search:
        q["$or"] = [{"title": {"$regex": search, "$options": "i"}},
                    {"location": {"$regex": search, "$options": "i"}},
                    {"certification": {"$regex": search, "$options": "i"}}]
    items = await db.projects.find(q, {"_id": 0}).sort("display_order", 1).to_list(500)
    all_docs = await db.projects.find({"status": "published"}, {"_id": 0, "category": 1, "location": 1}).to_list(500)
    categories = sorted({d["category"] for d in all_docs if d.get("category")})
    locations = sorted({d["location"] for d in all_docs if d.get("location")})
    return {"items": items, "categories": categories, "locations": locations}


@api.get("/public/projects/{slug}")
async def public_project(slug: str):
    doc = await db.projects.find_one({"slug": slug, "status": "published"}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Project not found")
    return doc


@api.get("/public/team")
async def public_team():
    return await db.team_members.find({"active": True}, {"_id": 0}).sort("display_order", 1).to_list(100)


@api.get("/public/blogs")
async def public_blogs(category: Optional[str] = None, search: Optional[str] = None, featured: Optional[bool] = None):
    q = {"status": "published"}
    if category and category != "All":
        q["category"] = category
    if featured is not None:
        q["featured"] = featured
    if search:
        q["$or"] = [{"title": {"$regex": search, "$options": "i"}},
                    {"excerpt": {"$regex": search, "$options": "i"}}]
    items = await db.blog_posts.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    all_docs = await db.blog_posts.find({"status": "published"}, {"_id": 0, "category": 1}).to_list(500)
    categories = sorted({d.get("category") for d in all_docs if d.get("category")})
    return {"items": items, "categories": categories}


@api.get("/public/blogs/{slug}")
async def public_blog(slug: str):
    doc = await db.blog_posts.find_one({"slug": slug, "status": "published"}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Post not found")
    related = await db.blog_posts.find(
        {"status": "published", "slug": {"$ne": slug}, "category": doc.get("category")},
        {"_id": 0}).limit(3).to_list(3)
    return {"post": doc, "related": related}


@api.get("/public/legal/{slug}")
async def public_legal(slug: str):
    doc = await db.legal_pages.find_one({"slug": slug}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    return doc


@api.get("/public/capability-profile")
async def public_capability():
    doc = await db.documents.find_one({"id": "capability"}, {"_id": 0})
    return doc or {}


# ---------------- SEO helpers ----------------
@api.get("/robots.txt", response_class=PlainTextResponse)
async def robots():
    return f"User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: {BACKEND_URL}/api/sitemap.xml\n"


@api.get("/sitemap.xml")
async def sitemap():
    urls = ["", "about", "services", "projects", "team", "blog", "contact"]
    services = await db.services.find({"active": True}, {"slug": 1, "_id": 0}).to_list(100)
    projects = await db.projects.find({"status": "published"}, {"slug": 1, "_id": 0}).to_list(500)
    blogs = await db.blog_posts.find({"status": "published"}, {"slug": 1, "_id": 0}).to_list(500)
    loc = lambda p: f"{BACKEND_URL}/{p}".rstrip("/")
    entries = [f"<url><loc>{loc(u)}</loc></url>" for u in urls]
    entries += [f"<url><loc>{loc('services/' + s['slug'])}</loc></url>" for s in services]
    entries += [f"<url><loc>{loc('projects/' + p['slug'])}</loc></url>" for p in projects]
    entries += [f"<url><loc>{loc('blog/' + b['slug'])}</loc></url>" for b in blogs]
    xml = f"<?xml version='1.0' encoding='UTF-8'?><urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'>{''.join(entries)}</urlset>"
    return Response(content=xml, media_type="application/xml")


app.include_router(api)
from portal import portal as portal_router
app.include_router(portal_router)
app.include_router(files_router)
from app.api.ghg import router as ghg_router
app.include_router(ghg_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    try:
        await create_indexes()
    except Exception as e:
        logger.warning(f"index creation: {e}")
    await run_seed()
    logger.info("RES backend ready")


@app.on_event("shutdown")
async def shutdown():
    from database import client
    client.close()
