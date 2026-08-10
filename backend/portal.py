"""Client Certification Portal API — multi-role auth (client OTP registration,
unified login), client projects + sequential IGBC wizard, reviewer assignments,
and admin portal management. Kept isolated from the existing CMS/public APIs.
"""
import re
import uuid
import random
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Depends, Request, Response
from pydantic import BaseModel, EmailStr, field_validator

from database import db
from auth import (
    hash_password, verify_password, create_access_token, set_auth_cookies,
    clear_auth_cookies, new_csrf_token, check_lockout, register_failed, clear_attempts,
)
from portal_auth import (
    get_current_user, current_client, current_client_write,
    current_reviewer, current_reviewer_write,
    current_admin_portal, current_admin_portal_write,
)
from rating_template import view_template, score_project, score_responses, template_for_type
from email_service import send_otp_email
from seed import now_iso

logger = logging.getLogger(__name__)
portal = APIRouter(prefix="/api")

OTP_TTL_MIN = 5
OTP_MAX_ATTEMPTS = 5
OTP_MAX_RESENDS = 5
OTP_RESEND_COOLDOWN_SEC = 45

PROJECT_TYPES = ["Commercial", "Residential", "Hotel", "Hospital"]


def _strong(v: str) -> str:
    if len(v) < 8 or not re.search(r"[A-Z]", v) or not re.search(r"[a-z]", v) or not re.search(r"\d", v):
        raise ValueError("Password must be at least 8 characters with upper, lower and numeric characters.")
    return v


def _gen_otp() -> str:
    return f"{random.randint(0, 999999):06d}"


def _now():
    return datetime.now(timezone.utc)


# ---------------- Schemas ----------------
class RegisterInput(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str | None = None
    organization: str | None = None

    @field_validator("password")
    @classmethod
    def strong(cls, v):
        return _strong(v)


class VerifyOtpInput(BaseModel):
    email: EmailStr
    otp: str


class ResendOtpInput(BaseModel):
    email: EmailStr


class LoginInput(BaseModel):
    identifier: str
    password: str


class CreateProjectInput(BaseModel):
    name: str
    project_type: str
    occupancy_type: str = "owner"
    building_info: dict = {}
    location: dict = {}
    settings: dict = {}
    team: list = []

    @field_validator("project_type")
    @classmethod
    def valid_type(cls, v):
        if v not in PROJECT_TYPES:
            raise ValueError(f"project_type must be one of {PROJECT_TYPES}")
        return v


class ResponsesInput(BaseModel):
    responses: dict = {}
    completed_categories: list | None = None
    current_category_index: int | None = None


class CreateReviewerInput(BaseModel):
    name: str
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def strong(cls, v):
        return _strong(v)


class AssignInput(BaseModel):
    project_id: str
    reviewer_id: str


class RecommendationsInput(BaseModel):
    recommendations: dict = {}
    reviewer_comment: str | None = None


class CommentInput(BaseModel):
    comment: str | None = None


class FinalizeInput(BaseModel):
    final: dict = {}
    decision: str  # 'certified' | 'rejected'
    certificate: dict = {}

    @field_validator("decision")
    @classmethod
    def valid_decision(cls, v):
        if v not in ("certified", "rejected"):
            raise ValueError("decision must be 'certified' or 'rejected'")
        return v


# ---------------- helpers ----------------
async def _email_taken(email: str) -> bool:
    email = email.lower()
    if await db.admins.find_one({"email": email}):
        return True
    if await db.users.find_one({"email": email}):
        return True
    return False


def _public_user(u: dict) -> dict:
    return {
        "id": u["id"], "name": u.get("name"), "email": u["email"],
        "role": u.get("role"), "phone": u.get("phone"), "organization": u.get("organization"),
    }


def _issue_session(response: Response, sub: str, role: str):
    token = create_access_token(sub, role)
    csrf = new_csrf_token()
    set_auth_cookies(response, token, csrf)


# ---------------- Auth: client registration (OTP) ----------------
@portal.post("/auth/client/register")
async def client_register(data: RegisterInput):
    email = data.email.lower()
    if await _email_taken(email):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    otp = _gen_otp()
    await db.pending_registrations.update_one(
        {"email": email},
        {"$set": {
            "email": email,
            "name": data.name.strip(),
            "phone": (data.phone or "").strip() or None,
            "organization": (data.organization or "").strip() or None,
            "password_hash": hash_password(data.password),
            "otp_hash": hash_password(otp),
            "expires_at": (_now() + timedelta(minutes=OTP_TTL_MIN)).isoformat(),
            "attempts": 0,
            "resend_count": 0,
            "last_sent": _now().isoformat(),
            "created_at": now_iso(),
        }},
        upsert=True,
    )
    sent = await send_otp_email(email, data.name, otp)
    resp = {"message": "Verification code sent to your email.", "email": email, "expires_in_minutes": OTP_TTL_MIN}
    if not sent:
        logger.warning(f"OTP for {email} could not be emailed; delivery disabled.")
    return resp


@portal.post("/auth/client/verify-otp")
async def client_verify_otp(data: VerifyOtpInput, response: Response):
    email = data.email.lower()
    pending = await db.pending_registrations.find_one({"email": email})
    if not pending:
        raise HTTPException(status_code=404, detail="No pending registration. Please register again.")
    if datetime.fromisoformat(pending["expires_at"]) < _now():
        await db.pending_registrations.delete_one({"email": email})
        raise HTTPException(status_code=410, detail="Code expired. Please request a new one.")
    if pending.get("attempts", 0) >= OTP_MAX_ATTEMPTS:
        await db.pending_registrations.delete_one({"email": email})
        raise HTTPException(status_code=429, detail="Too many incorrect attempts. Please register again.")
    if not verify_password(data.otp.strip(), pending["otp_hash"]):
        await db.pending_registrations.update_one({"email": email}, {"$inc": {"attempts": 1}})
        remaining = OTP_MAX_ATTEMPTS - (pending.get("attempts", 0) + 1)
        raise HTTPException(status_code=400, detail=f"Invalid code. {max(remaining,0)} attempt(s) left.")
    if await _email_taken(email):
        await db.pending_registrations.delete_one({"email": email})
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    user = {
        "id": str(uuid.uuid4()),
        "name": pending["name"],
        "email": email,
        "phone": pending.get("phone"),
        "organization": pending.get("organization"),
        "password_hash": pending["password_hash"],
        "role": "client",
        "active": True,
        "email_verified": True,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.users.insert_one(user)
    await db.pending_registrations.delete_one({"email": email})
    _issue_session(response, user["id"], "client")
    return _public_user(user)


@portal.post("/auth/client/resend-otp")
async def client_resend_otp(data: ResendOtpInput):
    email = data.email.lower()
    pending = await db.pending_registrations.find_one({"email": email})
    if not pending:
        raise HTTPException(status_code=404, detail="No pending registration. Please register again.")
    if pending.get("resend_count", 0) >= OTP_MAX_RESENDS:
        raise HTTPException(status_code=429, detail="Resend limit reached. Please register again later.")
    last_sent = pending.get("last_sent")
    if last_sent and (_now() - datetime.fromisoformat(last_sent)).total_seconds() < OTP_RESEND_COOLDOWN_SEC:
        raise HTTPException(status_code=429, detail="Please wait a moment before requesting another code.")
    otp = _gen_otp()
    await db.pending_registrations.update_one(
        {"email": email},
        {"$set": {
            "otp_hash": hash_password(otp),
            "expires_at": (_now() + timedelta(minutes=OTP_TTL_MIN)).isoformat(),
            "attempts": 0,
            "last_sent": _now().isoformat(),
        }, "$inc": {"resend_count": 1}},
    )
    await send_otp_email(email, pending.get("name", ""), otp)
    return {"message": "A new verification code has been sent.", "email": email}


# ---------------- Auth: unified login / logout / me ----------------
@portal.post("/auth/login")
async def unified_login(data: LoginInput, request: Request, response: Response):
    ident = data.identifier.strip().lower()
    ip = request.client.host if request.client else "unknown"
    key = f"portal:{ip}:{ident}"
    await check_lockout(key)
    # Admin first (login by login_id or email)
    admin = await db.admins.find_one({"$or": [{"login_id": ident}, {"email": ident}]})
    if admin and verify_password(data.password, admin["password_hash"]):
        await clear_attempts(key)
        _issue_session(response, admin["id"], "admin")
        return {"id": admin["id"], "email": admin["email"], "name": admin["name"], "role": "admin"}
    # Client / reviewer by email
    user = await db.users.find_one({"email": ident})
    if user and user.get("active", True) and verify_password(data.password, user["password_hash"]):
        await clear_attempts(key)
        _issue_session(response, user["id"], user["role"])
        return _public_user(user)
    await register_failed(key)
    raise HTTPException(status_code=401, detail="Invalid credentials")


@portal.post("/auth/logout")
async def portal_logout(response: Response):
    clear_auth_cookies(response)
    return {"message": "Logged out"}


@portal.get("/auth/me")
async def portal_me(user: dict = Depends(get_current_user)):
    if user.get("role") == "admin":
        return {"id": user["id"], "email": user["email"], "name": user["name"], "role": "admin"}
    return _public_user(user)


# ---------------- Client: projects + wizard ----------------
def _project_summary(p: dict) -> dict:
    score = score_project(p)
    return {
        "id": p["id"], "name": p["name"], "project_type": p["project_type"],
        "occupancy_type": p.get("occupancy_type", "owner"), "status": p.get("status", "draft"),
        "claimed_total": score.get("claimed_total", 0), "total_max": score.get("total_max"),
        "band": score.get("band"), "under_configuration": score.get("under_configuration", False),
        "reviewer_id": p.get("reviewer_id"), "created_at": p.get("created_at"),
        "updated_at": p.get("updated_at"), "submitted_at": p.get("submitted_at"),
    }


@portal.get("/client/projects")
async def list_client_projects(user: dict = Depends(current_client)):
    docs = await db.certification_projects.find({"client_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [_project_summary(p) for p in docs]


@portal.post("/client/projects")
async def create_client_project(data: CreateProjectInput, user: dict = Depends(current_client_write)):
    tpl = template_for_type(data.project_type)
    occ = data.occupancy_type if data.occupancy_type in ("owner", "tenant") else "owner"
    project = {
        "id": str(uuid.uuid4()),
        "client_id": user["id"],
        "name": data.name.strip(),
        "project_type": data.project_type,
        "occupancy_type": occ,
        "building_info": data.building_info,
        "location": data.location,
        "settings": data.settings,
        "team": data.team,
        "media": [],
        "rating_system_id": tpl["id"] if tpl else None,
        "under_configuration": tpl is None,
        "status": "draft",
        "responses": {},
        "completed_categories": [],
        "current_category_index": 0,
        "version": 0,
        "reviewer_id": None,
        "snapshots": [],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.certification_projects.insert_one(project)
    return _project_summary(project)


async def _get_owned_project(project_id: str, user: dict) -> dict:
    p = await db.certification_projects.find_one({"id": project_id, "client_id": user["id"]}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p


@portal.get("/client/projects/{project_id}")
async def get_client_project(project_id: str, user: dict = Depends(current_client)):
    p = await _get_owned_project(project_id, user)
    p["score"] = score_project(p)
    # Reviewer's internal per-criterion recommendations are confidential — never expose to the client.
    p.pop("reviewer_recommendations", None)
    p.pop("recommended_score", None)
    if p.get("status") in ("certified", "rejected") and p.get("official_record"):
        p["final_score"] = score_responses(p["project_type"], p.get("occupancy_type", "owner"), p.get("final_responses") or {}, "final_points")
    return p


@portal.get("/client/projects/{project_id}/template")
async def get_client_project_template(project_id: str, user: dict = Depends(current_client)):
    p = await _get_owned_project(project_id, user)
    return view_template(p["project_type"], p.get("occupancy_type", "owner"))


@portal.put("/client/projects/{project_id}/responses")
async def save_client_responses(project_id: str, data: ResponsesInput, user: dict = Depends(current_client_write)):
    p = await _get_owned_project(project_id, user)
    if p.get("status") not in ("draft", "changes_requested"):
        raise HTTPException(status_code=409, detail="Project can no longer be edited.")
    responses = {**(p.get("responses") or {}), **(data.responses or {})}
    update = {"responses": responses, "updated_at": now_iso()}
    if data.completed_categories is not None:
        update["completed_categories"] = data.completed_categories
    if data.current_category_index is not None:
        update["current_category_index"] = data.current_category_index
    await db.certification_projects.update_one({"id": project_id}, {"$set": update})
    merged = {**p, **update}
    return {"saved": True, "score": score_project(merged)}


@portal.post("/client/projects/{project_id}/submit")
async def submit_client_project(project_id: str, user: dict = Depends(current_client_write)):
    p = await _get_owned_project(project_id, user)
    if p.get("under_configuration"):
        raise HTTPException(status_code=409, detail="Checklist under configuration — this project type cannot be submitted yet.")
    if p.get("status") not in ("draft", "changes_requested"):
        raise HTTPException(status_code=409, detail="Project is already under review.")
    score = score_project(p)
    if not score.get("mandatory_ok", False):
        raise HTTPException(status_code=400, detail="All mandatory criteria must be marked as met before submitting.")
    snapshot = {
        "version": p.get("version", 0) + 1,
        "responses": p.get("responses", {}),
        "score": score,
        "submitted_at": now_iso(),
    }
    # If a reviewer is already assigned (resubmission after changes), route back to review
    new_status = "under_review" if p.get("reviewer_id") else "submitted"
    await db.certification_projects.update_one(
        {"id": project_id},
        {"$set": {
            "status": new_status,
            "version": snapshot["version"],
            "submitted_at": snapshot["submitted_at"],
            "updated_at": now_iso(),
        }, "$push": {"snapshots": snapshot}},
    )
    return {"submitted": True, "version": snapshot["version"], "score": score, "status": new_status}


# ---------------- Reviewer ----------------
@portal.get("/reviewer/assignments")
async def reviewer_assignments(user: dict = Depends(current_reviewer)):
    docs = await db.certification_projects.find({"reviewer_id": user["id"]}, {"_id": 0}).sort("submitted_at", -1).to_list(500)
    out = []
    for p in docs:
        s = _project_summary(p)
        client = await db.users.find_one({"id": p["client_id"]}, {"_id": 0, "name": 1, "email": 1, "organization": 1})
        s["client"] = client or {}
        out.append(s)
    return out


@portal.get("/reviewer/projects/{project_id}")
async def reviewer_project(project_id: str, user: dict = Depends(current_reviewer)):
    p = await db.certification_projects.find_one({"id": project_id, "reviewer_id": user["id"]}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Assignment not found")
    p["score"] = score_project(p)
    p["template"] = view_template(p["project_type"], p.get("occupancy_type", "owner"))
    rec = p.get("reviewer_recommendations") or {}
    p["recommended_score"] = score_responses(p["project_type"], p.get("occupancy_type", "owner"), rec, "recommended_points")
    client = await db.users.find_one({"id": p["client_id"]}, {"_id": 0, "name": 1, "email": 1, "organization": 1})
    p["client"] = client or {}
    return p


REVIEWER_EDITABLE = ("assigned", "submitted", "under_review")


async def _get_reviewer_project(project_id: str, user: dict) -> dict:
    p = await db.certification_projects.find_one({"id": project_id, "reviewer_id": user["id"]}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return p


@portal.put("/reviewer/projects/{project_id}/recommendations")
async def reviewer_save_recommendations(project_id: str, data: RecommendationsInput, user: dict = Depends(current_reviewer_write)):
    p = await _get_reviewer_project(project_id, user)
    if p.get("status") not in REVIEWER_EDITABLE:
        raise HTTPException(status_code=409, detail="This project is no longer open for review.")
    rec = {**(p.get("reviewer_recommendations") or {}), **(data.recommendations or {})}
    update = {"reviewer_recommendations": rec, "status": "under_review", "updated_at": now_iso()}
    if data.reviewer_comment is not None:
        update["reviewer_comment"] = data.reviewer_comment
    await db.certification_projects.update_one({"id": project_id}, {"$set": update})
    return {"saved": True, "recommended_score": score_responses(p["project_type"], p.get("occupancy_type", "owner"), rec, "recommended_points")}


@portal.post("/reviewer/projects/{project_id}/request-changes")
async def reviewer_request_changes(project_id: str, data: CommentInput, user: dict = Depends(current_reviewer_write)):
    p = await _get_reviewer_project(project_id, user)
    if p.get("status") not in REVIEWER_EDITABLE:
        raise HTTPException(status_code=409, detail="This project is no longer open for review.")
    await db.certification_projects.update_one({"id": project_id}, {"$set": {
        "status": "changes_requested", "reviewer_comment": data.comment or p.get("reviewer_comment"),
        "updated_at": now_iso(),
    }})
    return {"status": "changes_requested"}


@portal.post("/reviewer/projects/{project_id}/forward")
async def reviewer_forward(project_id: str, data: CommentInput, user: dict = Depends(current_reviewer_write)):
    p = await _get_reviewer_project(project_id, user)
    if p.get("status") not in REVIEWER_EDITABLE:
        raise HTTPException(status_code=409, detail="This project cannot be forwarded from its current state.")
    rec = p.get("reviewer_recommendations") or {}
    rec_score = score_responses(p["project_type"], p.get("occupancy_type", "owner"), rec, "recommended_points")
    if not rec_score.get("mandatory_ok", False):
        raise HTTPException(status_code=400, detail="Mark all mandatory criteria as met in your recommendation before forwarding.")
    update = {"status": "forwarded", "recommended_score": rec_score, "forwarded_at": now_iso(), "updated_at": now_iso()}
    if data.comment:
        update["reviewer_comment"] = data.comment
    await db.certification_projects.update_one({"id": project_id}, {"$set": update})
    return {"status": "forwarded", "recommended_score": rec_score}


# ---------------- Admin portal ----------------
@portal.get("/admin/portal/dashboard")
async def admin_portal_dashboard(user: dict = Depends(current_admin_portal)):
    clients = await db.users.count_documents({"role": "client"})
    reviewers = await db.users.count_documents({"role": "reviewer"})
    projects = await db.certification_projects.count_documents({})
    submitted = await db.certification_projects.count_documents({"status": "submitted"})
    assigned = await db.certification_projects.count_documents({"status": "assigned"})
    unassigned = await db.certification_projects.count_documents({"status": "submitted", "reviewer_id": None})
    return {
        "clients": clients, "reviewers": reviewers, "projects": projects,
        "submitted": submitted, "assigned": assigned, "awaiting_assignment": unassigned,
    }


@portal.get("/admin/portal/clients")
async def admin_portal_clients(user: dict = Depends(current_admin_portal)):
    docs = await db.users.find({"role": "client"}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    for d in docs:
        d["project_count"] = await db.certification_projects.count_documents({"client_id": d["id"]})
    return docs


@portal.get("/admin/portal/reviewers")
async def admin_portal_reviewers(user: dict = Depends(current_admin_portal)):
    return await db.users.find({"role": "reviewer"}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)


@portal.post("/admin/portal/reviewers")
async def admin_create_reviewer(data: CreateReviewerInput, user: dict = Depends(current_admin_portal_write)):
    email = data.email.lower()
    if await _email_taken(email):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    reviewer = {
        "id": str(uuid.uuid4()),
        "name": data.name.strip(),
        "email": email,
        "password_hash": hash_password(data.password),
        "role": "reviewer",
        "active": True,
        "email_verified": True,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.users.insert_one(reviewer)
    return _public_user(reviewer)


@portal.get("/admin/portal/certification-projects")
async def admin_portal_projects(user: dict = Depends(current_admin_portal)):
    docs = await db.certification_projects.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    out = []
    for p in docs:
        s = _project_summary(p)
        client = await db.users.find_one({"id": p["client_id"]}, {"_id": 0, "name": 1, "email": 1, "organization": 1})
        s["client"] = client or {}
        if p.get("reviewer_id"):
            rv = await db.users.find_one({"id": p["reviewer_id"]}, {"_id": 0, "name": 1, "email": 1})
            s["reviewer"] = rv or {}
        out.append(s)
    return out


@portal.post("/admin/portal/assign")
async def admin_assign_reviewer(data: AssignInput, user: dict = Depends(current_admin_portal_write)):
    project = await db.certification_projects.find_one({"id": data.project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    reviewer = await db.users.find_one({"id": data.reviewer_id, "role": "reviewer"})
    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found")
    if project.get("status") not in ("submitted", "changes_requested"):
        raise HTTPException(status_code=409, detail="Only submitted projects can be assigned to a reviewer.")
    await db.certification_projects.update_one(
        {"id": data.project_id},
        {"$set": {"reviewer_id": data.reviewer_id, "status": "assigned", "updated_at": now_iso()}},
    )
    await db.review_assignments.insert_one({
        "id": str(uuid.uuid4()),
        "project_id": data.project_id,
        "reviewer_id": data.reviewer_id,
        "assigned_by": user["id"],
        "assigned_at": now_iso(),
    })
    return {"assigned": True}


@portal.get("/admin/portal/certification-projects/{project_id}")
async def admin_portal_project_detail(project_id: str, user: dict = Depends(current_admin_portal)):
    p = await db.certification_projects.find_one({"id": project_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    occ = p.get("occupancy_type", "owner")
    p["template"] = view_template(p["project_type"], occ)
    p["claimed_score"] = score_project(p)
    p["recommended_score"] = score_responses(p["project_type"], occ, p.get("reviewer_recommendations") or {}, "recommended_points")
    if p.get("final_responses"):
        p["final_score"] = score_responses(p["project_type"], occ, p.get("final_responses"), "final_points")
    p["client"] = await db.users.find_one({"id": p["client_id"]}, {"_id": 0, "name": 1, "email": 1, "organization": 1}) or {}
    if p.get("reviewer_id"):
        p["reviewer"] = await db.users.find_one({"id": p["reviewer_id"]}, {"_id": 0, "name": 1, "email": 1}) or {}
    return p


@portal.post("/admin/portal/projects/{project_id}/finalize")
async def admin_finalize_project(project_id: str, data: FinalizeInput, user: dict = Depends(current_admin_portal_write)):
    p = await db.certification_projects.find_one({"id": project_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    if p.get("under_configuration"):
        raise HTTPException(status_code=409, detail="This project type has no configured checklist.")
    occ = p.get("occupancy_type", "owner")
    final_resp = data.final or {}
    final_score = score_responses(p["project_type"], occ, final_resp, "final_points")
    if data.decision == "certified":
        if not final_score.get("mandatory_ok", False):
            raise HTTPException(status_code=400, detail="All mandatory criteria must be met to certify this project.")
        if not (data.certificate or {}).get("number"):
            raise HTTPException(status_code=400, detail="A certificate number is required to certify this project.")
    official = {
        "decision": data.decision,
        "band": final_score.get("band") if data.decision == "certified" else "Rejected",
        "final_total": final_score.get("claimed_total", 0),
        "total_max": final_score.get("total_max"),
        "certificate_number": (data.certificate or {}).get("number"),
        "issued_date": (data.certificate or {}).get("issued_date"),
        "valid_until": (data.certificate or {}).get("valid_until"),
        "notes": (data.certificate or {}).get("notes"),
        "finalized_by": user["id"],
        "finalized_at": now_iso(),
    }
    await db.certification_projects.update_one(
        {"id": project_id},
        {"$set": {
            "final_responses": final_resp,
            "final_score": final_score,
            "official_record": official,
            "status": "certified" if data.decision == "certified" else "rejected",
            "updated_at": now_iso(),
        }},
    )
    return {"status": official["decision"], "official_record": official, "final_score": final_score}
