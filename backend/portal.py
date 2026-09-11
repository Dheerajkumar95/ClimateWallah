"""Client Certification Portal API — multi-role auth (client OTP registration,
unified login), client projects + sequential IGBC wizard, reviewer assignments,
and admin portal management. Kept isolated from the existing CMS/public APIs.
"""
import re
import os
import uuid
import random
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter,BackgroundTasks, HTTPException, Depends, Request, Response, UploadFile, File, Form
from pydantic import BaseModel, EmailStr, Field, field_validator

from database import db
from app.services import storage
from auth import (
    hash_password, verify_password, create_access_token, set_auth_cookies,
    clear_auth_cookies, new_csrf_token, check_lockout, register_failed, clear_attempts,
)
from portal_auth import (
    get_current_user, current_client, current_client_write,
    current_reviewer, current_reviewer_write,
    current_admin_portal, current_admin_portal_write,
)
from rating_template import (
    project_view_template,
    score_project,
    score_project_responses,
)
from app.services.certification_service import normalise_code, published_template
from app.services.pricing_service import area_in_sqft, billing_settings
from app.services.account_ids import next_public_id
from app.services.audit_service import record_audit
from marketplace import _subscription_state, reviewer_is_eligible
from email_service import send_otp_email, send_email
from seed import now_iso

logger = logging.getLogger(__name__)
portal = APIRouter(prefix="/api")

OTP_TTL_MIN = 5
OTP_MAX_ATTEMPTS = 5
OTP_MAX_RESENDS = 5
OTP_RESEND_COOLDOWN_SEC = 60

PROJECT_TYPES = ["Commercial", "Residential", "Hotel", "Hospital"]

BACKEND_URL = os.environ.get("FRONTEND_URL", "")
MAX_UPLOAD = int(os.environ.get("UPLOAD_MAX_SIZE_MB", "15")) * 1024 * 1024
ALLOWED_UPLOAD_EXT = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".png", ".jpg", ".jpeg", ".webp", ".dwg", ".zip"}


def _strong(v: str) -> str:
    if len(v) < 8 or not re.search(r"[A-Z]", v) or not re.search(r"[a-z]", v) or not re.search(r"\d", v):
        raise ValueError("Password must be at least 8 characters with upper, lower and numeric characters.")
    return v


def _gen_otp() -> str:
    return f"{random.randint(0, 999999):06d}"


def _now():
    return datetime.now(timezone.utc)


async def _portal_notify(user_id: str | None, key: str, title: str, message: str, level: str = "info") -> None:
    if not user_id:
        return
    await db.notifications.update_one(
        {"user_id": user_id, "key": key},
        {"$setOnInsert": {"id": str(uuid.uuid4()), "user_id": user_id, "key": key, "title": title, "message": message, "level": level, "read": False, "created_at": now_iso()}},
        upsert=True,
    )


async def _portal_email(
    user_id: str | None,
    subject: str,
    message: str,
) -> None:
    if not user_id:
        return

    owner = await db.users.find_one(
        {"id": user_id},
        {
            "_id": 0,
            "email": 1,
            "name": 1,
        },
    )

    if not owner or not owner.get("email"):
        return

    name = owner.get("name") or "there"

    plain_body = (
        f"Hello {name},\n\n"
        f"{message}\n\n"
        "Regards,\n"
        "ClimateWallah"
    )

    html_body = (
        f"<p>Hello {name},</p>"
        f"<p>{message}</p>"
        "<p>Regards,<br/>ClimateWallah</p>"
    )

    try:
        await send_email(
            owner["email"],
            subject,
            plain_body,
            html_body,
        )
    except Exception as exc:
        logger.exception(
            "Portal notification email failed for user %s: %s",
            user_id,
            exc,
        )

# ---------------- Schemas ----------------
class RegisterInput(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str
    organization: str

    @field_validator("name", "phone", "organization")
    @classmethod
    def required_registration_text(cls, value):
        value = (value or "").strip()
        if len(value) < 2:
            raise ValueError("This field must contain at least 2 characters.")
        return value

    @field_validator("password")
    @classmethod
    def strong(cls, v):
        return _strong(v)


class VerifyOtpInput(BaseModel):
    email: EmailStr
    otp: str


class ResendOtpInput(BaseModel):
    email: EmailStr


class PasswordForgotInput(BaseModel):
    identifier: str


class PasswordResetInput(BaseModel):
    identifier: str
    otp: str
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def strong_password(cls, value):
        return _strong(value)


class LoginInput(BaseModel):
    identifier: str
    password: str


class CreateProjectInput(BaseModel):
    name: str
    certification_type: str = "IGBC"
    project_type: str
    occupancy_type: str = "owner"
    building_info: dict = Field(default_factory=dict)
    location: dict = Field(default_factory=dict)
    privacy: dict = Field(default_factory=dict)
    settings: dict = Field(default_factory=dict)
    team: list = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def valid_name(cls, value):
        value = (value or "").strip()
        if len(value) < 2:
            raise ValueError("Project name must contain at least 2 characters.")
        return value

    @field_validator("project_type")
    @classmethod
    def valid_type(cls, v):
        if v not in PROJECT_TYPES:
            raise ValueError(f"project_type must be one of {PROJECT_TYPES}")
        return v


class ResponsesInput(BaseModel):
    responses: dict = Field(default_factory=dict)
    completed_categories: list | None = None
    current_category_index: int | None = None


class CreateReviewerInput(BaseModel):
    name: str
    email: EmailStr
    password: str
    specialisation: str | None = None
    project_types: list = Field(default_factory=list)
    rating_systems: list = Field(default_factory=list)
    max_workload: int = 5

    @field_validator("password")
    @classmethod
    def strong(cls, v):
        return _strong(v)

class ReviewerPasswordInput(BaseModel):
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def strong(cls, value):
        return _strong(value)

class AssignInput(BaseModel):
    project_id: str
    reviewer_id: str
    due_date: str | None = None
    priority: str = "normal"
    instructions: str | None = None


class RecommendationsInput(BaseModel):
    recommendations: dict = Field(default_factory=dict)
    reviewer_comment: str | None = None


class CommentInput(BaseModel):
    comment: str | None = None


class FinalizeInput(BaseModel):
    final: dict = Field(default_factory=dict)
    decision: str  # 'certified' | 'rejected'
    certificate: dict = Field(default_factory=dict)

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
    result = {
        "id": u["id"], "public_id": u.get("public_id"), "name": u.get("name"), "email": u["email"],
        "role": u.get("role"), "phone": u.get("phone"), "organization": u.get("organization"),
    }
    if u.get("role") == "reviewer":
        result.update({
            "reviewer_status": u.get("reviewer_status", "approved"),
            "requires_subscription": u.get("requires_subscription", False),
            "subscription": _subscription_state(u),
        })
    return result


def _issue_session(response: Response, sub: str, role: str):
    token = create_access_token(sub, role)
    csrf = new_csrf_token()
    set_auth_cookies(response, token, csrf)

# ---------------- Auth: client registration (OTP) ----------------

@portal.post("/auth/client/register", status_code=202)
async def client_register(data: RegisterInput):
    email = data.email.strip().lower()

    if await _email_taken(email):
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        )

    otp = _gen_otp()

    await db.pending_registrations.update_one(
        {"email": email},
        {
            "$set": {
                "email": email,
                "name": data.name.strip(),
                "phone": (data.phone or "").strip() or None,
                "organization": (
                    data.organization or ""
                ).strip() or None,
                "password_hash": hash_password(data.password),
                "otp_hash": hash_password(otp),
                "expires_at": (
                    _now() + timedelta(minutes=OTP_TTL_MIN)
                ).isoformat(),
                "attempts": 0,
                "resend_count": 0,
                "last_sent": _now().isoformat(),
                "created_at": now_iso(),
            }
        },
        upsert=True,
    )

    sent = await send_otp_email(
        to_email=email,
        name=data.name,
        otp=otp,
    )

    if not sent:
        await db.pending_registrations.delete_one(
            {"email": email}
        )

        raise HTTPException(
            status_code=503,
            detail=(
                "Unable to send verification email. "
                "Please try again."
            ),
        )

    return {
        "message": "Verification code sent to your email.",
        "email": email,
        "expires_in_minutes": OTP_TTL_MIN,
    }


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
        raise HTTPException(status_code=429, detail="Too many verification attempts. Please try again later.")
    if not verify_password(data.otp.strip(), pending["otp_hash"]):
        next_attempts = pending.get("attempts", 0) + 1
        await db.pending_registrations.update_one({"email": email}, {"$inc": {"attempts": 1}})
        if next_attempts >= OTP_MAX_ATTEMPTS:
            raise HTTPException(status_code=429, detail="Too many verification attempts. Please try again later.")
        remaining = OTP_MAX_ATTEMPTS - next_attempts
        raise HTTPException(status_code=400, detail=f"Invalid code. {remaining} attempt(s) left.")
    if await _email_taken(email):
        await db.pending_registrations.delete_one({"email": email})
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    user = {
        "id": str(uuid.uuid4()),
        "public_id": await next_public_id("client"),
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
        raise HTTPException(status_code=429, detail="Too many verification attempts. Please try again later.")
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


# ---------------- Auth: password recovery ----------------
async def _find_portal_user(identifier: str) -> dict | None:
    ident = (identifier or "").strip().lower()
    if not ident:
        return None
    return await db.users.find_one({
        "$or": [{"email": ident}, {"public_id": ident.upper()}],
        "active": {"$ne": False},
        "role": {"$in": ["client", "reviewer"]},
    })


@portal.post("/auth/password/forgot")
async def forgot_password(data: PasswordForgotInput):
    user = await _find_portal_user(data.identifier)
    # Generic success keeps account existence private.
    if not user:
        return {"message": "If the account exists, a verification code has been sent."}
    otp = _gen_otp()
    await db.pending_password_resets.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "user_id": user["id"], "email": user["email"], "otp_hash": hash_password(otp),
            "expires_at": (_now() + timedelta(minutes=OTP_TTL_MIN)).isoformat(),
            "attempts": 0, "resend_count": 0, "last_sent": _now().isoformat(),
            "created_at": now_iso(),
        }}, upsert=True,
    )
    sent = await send_otp_email(user["email"], user.get("name") or "", otp)
    if not sent:
        await db.pending_password_resets.delete_one({"user_id": user["id"]})
        raise HTTPException(status_code=503, detail="Unable to send verification email. Please try again.")
    return {"message": "If the account exists, a verification code has been sent.", "expires_in_minutes": OTP_TTL_MIN}


@portal.post("/auth/password/resend")
async def resend_password_otp(data: PasswordForgotInput):
    user = await _find_portal_user(data.identifier)
    if not user:
        return {"message": "If the account exists, a verification code has been sent."}
    pending = await db.pending_password_resets.find_one({"user_id": user["id"]})
    if not pending:
        return await forgot_password(data)
    if pending.get("resend_count", 0) >= OTP_MAX_RESENDS:
        raise HTTPException(status_code=429, detail="Too many verification attempts. Please try again later.")
    last_sent = pending.get("last_sent")
    if last_sent:
        remaining = OTP_RESEND_COOLDOWN_SEC - int((_now() - datetime.fromisoformat(last_sent)).total_seconds())
        if remaining > 0:
            raise HTTPException(status_code=429, detail=f"Please wait {remaining} seconds before requesting another code.")
    otp = _gen_otp()
    await db.pending_password_resets.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "otp_hash": hash_password(otp), "expires_at": (_now() + timedelta(minutes=OTP_TTL_MIN)).isoformat(),
            "attempts": 0, "last_sent": _now().isoformat(),
        }, "$inc": {"resend_count": 1}},
    )
    if not await send_otp_email(user["email"], user.get("name") or "", otp):
        raise HTTPException(status_code=503, detail="Unable to send verification email. Please try again.")
    return {"message": "A new verification code has been sent."}


@portal.post("/auth/password/reset")
async def reset_password(data: PasswordResetInput):
    if data.new_password != data.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match.")
    user = await _find_portal_user(data.identifier)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification request.")
    pending = await db.pending_password_resets.find_one({"user_id": user["id"]})
    if not pending:
        raise HTTPException(status_code=400, detail="Invalid or expired verification request.")
    if datetime.fromisoformat(pending["expires_at"]) < _now():
        raise HTTPException(status_code=410, detail="Code expired. Please request a new one.")
    if pending.get("attempts", 0) >= OTP_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many verification attempts. Please try again later.")
    if not verify_password(data.otp.strip(), pending["otp_hash"]):
        next_attempts = pending.get("attempts", 0) + 1
        await db.pending_password_resets.update_one({"user_id": user["id"]}, {"$inc": {"attempts": 1}})
        if next_attempts >= OTP_MAX_ATTEMPTS:
            raise HTTPException(status_code=429, detail="Too many verification attempts. Please try again later.")
        raise HTTPException(status_code=400, detail=f"Invalid code. {OTP_MAX_ATTEMPTS-next_attempts} attempt(s) left.")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(data.new_password), "updated_at": now_iso()}})
    await db.pending_password_resets.delete_one({"user_id": user["id"]})
    await db.login_attempts.delete_many({"identifier": {"$regex": re.escape((data.identifier or '').strip()), "$options": "i"}})
    return {"message": "Password reset successfully. You can now sign in."}


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
    # Client / reviewer by email or generated CLI-/REV- ID.
    user = await db.users.find_one({"$or": [
        {"email": ident},
        {"public_id": ident.upper()},
    ]})
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
        "certification_type": p.get("certification_type", "IGBC"),
        "occupancy_type": p.get("occupancy_type", "owner"), "status": p.get("status", "draft"),
        "claimed_total": score.get("claimed_total", 0), "total_max": score.get("total_max"),
        "band": score.get("band"), "under_configuration": score.get("under_configuration", False),
        "reviewer_id": p.get("reviewer_id"), "created_at": p.get("created_at"),
        "updated_at": p.get("updated_at"), "submitted_at": p.get("submitted_at"),
        "review_payment": p.get("review_payment"),
    }


@portal.get("/client/projects")
async def list_client_projects(user: dict = Depends(current_client)):
    docs = await db.certification_projects.find({"client_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [_project_summary(p) for p in docs]


@portal.post("/client/projects")
async def create_client_project(data: CreateProjectInput, user: dict = Depends(current_client_write)):
    occ = data.occupancy_type if data.occupancy_type in ("owner", "tenant") else "owner"
    certification_type = normalise_code(data.certification_type or "IGBC")
    certification = await db.certification_types.find_one(
        {"code": certification_type, "active": True}, {"_id": 0}
    )
    if not certification:
        raise HTTPException(status_code=400, detail="Invalid or inactive certification type.")
    if area_in_sqft(data.building_info) <= 0:
        raise HTTPException(status_code=400, detail="A valid target certification or built-up area is required.")
    tpl = await published_template(certification_type, data.project_type, occ)
    project = {
        "id": str(uuid.uuid4()),
        "client_id": user["id"],
        "name": data.name.strip(),
        "project_type": data.project_type,
        "certification_type": certification_type,
        "occupancy_type": occ,
        "building_info": data.building_info,
        "location": data.location,
        "privacy": data.privacy,
        "settings": data.settings,
        "team": data.team,
        "media": [],
        "evidence": {},
        "rating_system_id": tpl.get("id"),
        "template_snapshot": tpl,
        "under_configuration": tpl.get("under_configuration", True),
        "status": "draft",
        "responses": {},
        "completed_categories": [],
        "current_category_index": 0,
        "version": 0,
        "reviewer_id": None,
        "snapshots": [],
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "timeline": [{"event": "Project Created", "from": None, "to": "draft", "actor": user.get("name") or "Client", "at": now_iso()}],
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
        p["final_score"] = score_project_responses(p, p.get("final_responses") or {}, "final_points")
    return p


@portal.get("/client/projects/{project_id}/template")
async def get_client_project_template(project_id: str, user: dict = Depends(current_client)):
    p = await _get_owned_project(project_id, user)
    return project_view_template(p)


async def _add_timeline(project_id: str, event: str, frm, to, actor: str, note: str = None):
    ev = {"event": event, "from": frm, "to": to, "actor": actor, "at": now_iso()}
    if note:
        ev["note"] = note
    await db.certification_projects.update_one({"id": project_id}, {"$push": {"timeline": ev}})


def _section_states(p: dict, tpl: dict):
    """Return per-section lock/complete state for the sequential wizard."""
    if tpl.get("under_configuration"):
        return []
    completed = set(p.get("completed_categories") or [])
    current = p.get("current_category_index", 0)
    responses = p.get("responses") or {}
    out = []
    for c in tpl["categories"]:
        mand = [cr for cr in c["criteria"] if cr["mandatory"]]
        answered = sum(1 for cr in mand if (responses.get(cr["id"]) or {}).get("met"))
        remaining = max(0, len(mand) - answered)
        if c["id"] in completed:
            state = "complete"
        elif c["order"] == current:
            state = "current"
        elif c["order"] < current:
            state = "unlocked"
        else:
            state = "locked"
        out.append({
            "id": c["id"], "slug": c["slug"], "name": c["name"], "order": c["order"],
            "max_points": c["max_points"], "state": state, "required_remaining": remaining,
        })
    return out


@portal.get("/client/projects/{project_id}/assessment")
async def get_assessment_overview(project_id: str, user: dict = Depends(current_client)):
    p = await _get_owned_project(project_id, user)
    tpl = project_view_template(p)
    score = score_project(p)
    return {
        "project": {"id": p["id"], "name": p["name"], "project_type": p["project_type"],
                    "occupancy_type": p.get("occupancy_type", "owner"), "status": p.get("status", "draft"),
                    "rating_system": tpl.get("name"), "version": tpl.get("version")},
        "under_configuration": tpl.get("under_configuration", False),
        "score": score,
        "sections": _section_states(p, tpl),
        "timeline": p.get("timeline", []),
        "reviewer_comment": p.get("reviewer_comment") if p.get("status") == "changes_requested" else None,
        "official_record": p.get("official_record"),
        "review_payment": p.get("review_payment"),
        "editable": p.get("status") in ("draft", "changes_requested") and not p.get("under_configuration"),
    }


@portal.get("/client/projects/{project_id}/assessment/{slug}")
async def get_assessment_section(project_id: str, slug: str, user: dict = Depends(current_client)):
    p = await _get_owned_project(project_id, user)
    tpl = project_view_template(p)
    if tpl.get("under_configuration"):
        raise HTTPException(status_code=409, detail="Checklist under configuration for this project type.")
    cats = tpl["categories"]
    idx = next((i for i, c in enumerate(cats) if c["slug"] == slug), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Section not found")
    # Server-side lock enforcement — cannot open a section beyond the furthest unlocked one.
    if idx > p.get("current_category_index", 0):
        raise HTTPException(status_code=403, detail="This section is locked. Complete the previous sections first.")
    c = cats[idx]
    responses = p.get("responses") or {}
    evidence = p.get("evidence") or {}
    criteria = [{**cr, "response": responses.get(cr["id"], {}), "evidence": evidence.get(cr["id"], [])} for cr in c["criteria"]]
    return {
        "section": {"id": c["id"], "slug": c["slug"], "name": c["name"], "order": c["order"], "max_points": c["max_points"], "criteria": criteria},
        "prev_slug": cats[idx - 1]["slug"] if idx > 0 else None,
        "next_slug": cats[idx + 1]["slug"] if idx < len(cats) - 1 else None,
        "is_last": idx == len(cats) - 1,
        "editable": p.get("status") in ("draft", "changes_requested"),
        "score": score_project(p),
        "sections": _section_states(p, tpl),
        "summary": {"name": p["name"], "project_type": p["project_type"], "status": p.get("status"), "occupancy_type": p.get("occupancy_type", "owner")},
    }


@portal.put("/client/projects/{project_id}/assessment/{slug}")
async def save_assessment_section(project_id: str, slug: str, data: ResponsesInput, user: dict = Depends(current_client_write)):
    p = await _get_owned_project(project_id, user)
    if p.get("status") not in ("draft", "changes_requested"):
        raise HTTPException(status_code=409, detail="Project can no longer be edited.")
    tpl = project_view_template(p)
    if tpl.get("under_configuration"):
        raise HTTPException(status_code=409, detail="Checklist under configuration for this project type.")
    cats = tpl["categories"]
    idx = next((i for i, c in enumerate(cats) if c["slug"] == slug), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Section not found")
    if idx > p.get("current_category_index", 0):
        raise HTTPException(status_code=403, detail="This section is locked.")
    c = cats[idx]
    # merge responses for this section's criteria only
    incoming = data.responses or {}
    valid_ids = {cr["id"] for cr in c["criteria"]}
    merged = {**(p.get("responses") or {})}
    for k, v in incoming.items():
        if k in valid_ids:
            merged[k] = v
    proceed = bool(data.completed_categories)  # frontend sends completed_categories=[...] to signal Save & Continue
    update = {"responses": merged, "updated_at": now_iso()}
    if proceed:
        # require all mandatory in this section met
        mand = [cr for cr in c["criteria"] if cr["mandatory"]]
        if not all((merged.get(cr["id"]) or {}).get("met") for cr in mand):
            raise HTTPException(status_code=400, detail="Complete all mandatory (prerequisite) items in this section before continuing.")
        completed = list(set((p.get("completed_categories") or []) + [c["id"]]))
        new_current = max(p.get("current_category_index", 0), min(len(cats) - 1, idx + 1))
        update["completed_categories"] = completed
        update["current_category_index"] = new_current
    await db.certification_projects.update_one({"id": project_id}, {"$set": update})
    next_slug = cats[idx + 1]["slug"] if (proceed and idx < len(cats) - 1) else None
    merged_p = {**p, **update}
    return {"saved": True, "score": score_project(merged_p), "next_slug": next_slug, "sections": _section_states(merged_p, tpl)}


async def _save_upload(project_id: str, up: UploadFile, content: bytes) -> dict:
    ext = os.path.splitext(up.filename or "")[1].lower()
    if ext not in ALLOWED_UPLOAD_EXT:
        raise HTTPException(status_code=400, detail=f"File type {ext or '?'} not allowed.")
    if len(content) > MAX_UPLOAD:
        raise HTTPException(status_code=400, detail=f"File too large (max {MAX_UPLOAD // (1024*1024)} MB).")
    fid = uuid.uuid4().hex
    fname = f"{fid}{ext}"
    content_type = storage.safe_content_type(fname, up.content_type)
    await storage.save_bytes(f"evidence/{project_id}/{fname}", content,
                             content_type, original_name=up.filename)
    return {
        "id": fid, "filename": fname, "original_name": up.filename,
        "url": f"/api/uploads/evidence/{project_id}/{fname}",
        "size": len(content), "content_type": content_type,
        "uploaded_at": now_iso(), "status": "pending", "review": None,
    }


@portal.post("/client/projects/{project_id}/files")
async def upload_client_file(project_id: str, file: UploadFile = File(...), scope: str = Form("evidence"),
                             criterion_id: str = Form(None), user: dict = Depends(current_client_write)):
    p = await _get_owned_project(project_id, user)
    if p.get("status") not in ("draft", "changes_requested"):
        raise HTTPException(status_code=409, detail="Files can only be uploaded while the project is editable.")
    content = await file.read()
    rec = await _save_upload(project_id, file, content)
    rec["scope"] = scope
    if scope == "evidence" and criterion_id:
        rec["criterion_id"] = criterion_id
        await db.certification_projects.update_one({"id": project_id}, {"$push": {f"evidence.{criterion_id}": rec}, "$set": {"updated_at": now_iso()}})
    else:
        await db.certification_projects.update_one({"id": project_id}, {"$push": {"media": rec}, "$set": {"updated_at": now_iso()}})
    return rec


@portal.delete("/client/projects/{project_id}/files/{file_id}")
async def delete_client_file(project_id: str, file_id: str, criterion_id: str = None, user: dict = Depends(current_client_write)):
    p = await _get_owned_project(project_id, user)
    if p.get("status") not in ("draft", "changes_requested"):
        raise HTTPException(status_code=409, detail="Files can only be removed while the project is editable.")
    if criterion_id:
        arr = (p.get("evidence") or {}).get(criterion_id, [])
        rec = next((f for f in arr if f["id"] == file_id), None)
        await db.certification_projects.update_one({"id": project_id}, {"$pull": {f"evidence.{criterion_id}": {"id": file_id}}})
    else:
        rec = next((f for f in (p.get("media") or []) if f["id"] == file_id), None)
        await db.certification_projects.update_one({"id": project_id}, {"$pull": {"media": {"id": file_id}}})
    if rec:
        await storage.delete_by_key(f"evidence/{project_id}/{rec['filename']}")
    return {"deleted": True}


class EvidenceReviewInput(BaseModel):
    criterion_id: str
    status: str  # approved | rejected
    comment: str | None = None

    @field_validator("status")
    @classmethod
    def valid(cls, v):
        if v not in ("approved", "rejected"):
            raise ValueError("status must be 'approved' or 'rejected'")
        return v


@portal.post("/reviewer/projects/{project_id}/evidence/{file_id}/review")
async def reviewer_review_evidence(project_id: str, file_id: str, data: EvidenceReviewInput, user: dict = Depends(current_reviewer_write)):
    p = await db.certification_projects.find_one({"id": project_id, "reviewer_id": user["id"]}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if p.get("status") not in REVIEWER_EDITABLE:
        raise HTTPException(status_code=409, detail="This project is no longer open for review.")
    arr = (p.get("evidence") or {}).get(data.criterion_id, [])
    if not any(f["id"] == file_id for f in arr):
        raise HTTPException(status_code=404, detail="Evidence file not found")
    review = {"status": data.status, "comment": data.comment, "by": user.get("name"), "at": now_iso()}
    await db.certification_projects.update_one(
        {"id": project_id, f"evidence.{data.criterion_id}.id": file_id},
        {"$set": {f"evidence.{data.criterion_id}.$.status": data.status, f"evidence.{data.criterion_id}.$.review": review}},
    )
    return {"updated": True, "review": review}


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
    if (p.get("review_payment") or {}).get("status") != "paid":
        raise HTTPException(
            status_code=402,
            detail="Complete and verify the review fee payment before submitting this project.",
        )
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
    await _add_timeline(project_id, "Submitted", p.get("status"), new_status, user.get("name") or "Client")
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
    p["template"] = project_view_template(p)
    rec = p.get("reviewer_recommendations") or {}
    p["recommended_score"] = score_project_responses(p, rec, "recommended_points")
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
    return {"saved": True, "recommended_score": score_project_responses(p, rec, "recommended_points")}


@portal.post("/reviewer/projects/{project_id}/request-changes")
async def reviewer_request_changes(project_id: str, data: CommentInput, user: dict = Depends(current_reviewer_write)):
    p = await _get_reviewer_project(project_id, user)
    if p.get("status") not in REVIEWER_EDITABLE:
        raise HTTPException(status_code=409, detail="This project is no longer open for review.")
    await db.certification_projects.update_one({"id": project_id}, {"$set": {
        "status": "changes_requested", "reviewer_comment": data.comment or p.get("reviewer_comment"),
        "updated_at": now_iso(),
    }})
    await _add_timeline(project_id, "Changes Requested", p.get("status"), "changes_requested", user.get("name") or "Reviewer", note=data.comment)
    await _portal_notify(p.get("client_id"), f"changes-{project_id}-{now_iso()}", "Changes requested", f"Reviewer requested changes for {p.get('name') or 'your project'}.", "warning")
    await _portal_email(p.get("client_id"), "Changes requested for your ClimateWallah project", f"The reviewer requested changes for <b>{p.get('name') or 'your project'}</b>. Please sign in to review the comments and update your submission.")
    return {"status": "changes_requested"}


@portal.post("/reviewer/projects/{project_id}/forward")
async def reviewer_forward(project_id: str, data: CommentInput, user: dict = Depends(current_reviewer_write)):
    p = await _get_reviewer_project(project_id, user)
    if p.get("status") not in REVIEWER_EDITABLE:
        raise HTTPException(status_code=409, detail="This project cannot be forwarded from its current state.")
    rec = p.get("reviewer_recommendations") or {}
    rec_score = score_project_responses(p, rec, "recommended_points")
    if not rec_score.get("mandatory_ok", False):
        raise HTTPException(status_code=400, detail="Mark all mandatory criteria as met in your recommendation before forwarding.")
    update = {"status": "forwarded", "recommended_score": rec_score, "forwarded_at": now_iso(), "updated_at": now_iso()}
    if data.comment:
        update["reviewer_comment"] = data.comment
    await db.certification_projects.update_one({"id": project_id}, {"$set": update})
    await _add_timeline(project_id, "Forwarded to Admin", p.get("status"), "forwarded", user.get("name") or "Reviewer")
    await _portal_notify(p.get("client_id"), f"forwarded-{project_id}-{now_iso()}", "Review completed", f"Reviewer completed the assessment of {p.get('name') or 'your project'} and forwarded it for the final decision.", "success")
    await _portal_email(p.get("client_id"), "Your ClimateWallah review is complete", f"The reviewer has completed the assessment of <b>{p.get('name') or 'your project'}</b>. It is now awaiting the final administrative decision.")
    return {"status": "forwarded", "recommended_score": rec_score}


# ---------------- Admin portal ----------------
@portal.get("/admin/portal/dashboard")
async def admin_portal_dashboard(user: dict = Depends(current_admin_portal)):
    cp = db.certification_projects
    async def cnt(q): return await cp.count_documents(q)
    clients = await db.users.count_documents({"role": "client"})
    reviewers = await db.users.count_documents({"role": "reviewer"})
    return {
        "clients": clients,
        "reviewers": reviewers,
        "projects": await cnt({}),
        "unassigned": await cnt({"status": {"$in": ["submitted", "changes_requested"]}, "reviewer_id": None}),
        "submitted": await cnt({"status": "submitted"}),
        "assigned": await cnt({"status": "assigned"}),
        "under_review": await cnt({"status": "under_review"}),
        "changes_requested": await cnt({"status": "changes_requested"}),
        "awaiting_admin": await cnt({"status": "forwarded"}),
        "certified": await cnt({"status": "certified"}),
        "rejected": await cnt({"status": "rejected"}),
        "drafts": await cnt({"status": "draft"}),
        "pending_reviewer_applications": await db.users.count_documents({
            "role": "reviewer", "reviewer_status": {"$in": ["pending_documents", "pending_review", "changes_requested"]}
        }),
        "expired_reviewer_plans": await db.users.count_documents({
            "role": "reviewer", "requires_subscription": True,
            "$or": [{"subscription.ends_at": {"$lt": now_iso()}}, {"subscription": {"$exists": False}}],
        }),
        "approved_earnings_paise": sum(
            row.get("gross_paise", row.get("base_paise", 0))
            for row in await db.reviewer_earnings.find({"status": "approved"}, {"_id": 0}).to_list(5000)
        ),
    }


@portal.get("/admin/portal/analytics")
async def admin_portal_analytics(user: dict = Depends(current_admin_portal)):
    projects = await db.certification_projects.find({}, {"_id": 0, "status": 1, "created_at": 1, "submitted_at": 1, "official_record": 1, "review_payment": 1}).to_list(10000)
    orders = await db.payment_orders.find({"status": "paid"}, {"_id": 0, "amount_paise": 1, "paid_at": 1, "created_at": 1, "kind": 1}).to_list(10000)
    months = {}
    for o in orders:
        stamp = o.get("paid_at") or o.get("created_at") or ""; month = stamp[:7] if len(stamp) >= 7 else "Unknown"
        row = months.setdefault(month, {"month": month, "revenue_paise": 0, "payments": 0})
        row["revenue_paise"] += int(o.get("amount_paise") or 0); row["payments"] += 1
    status_counts = {}
    for p in projects: status_counts[p.get("status") or "unknown"] = status_counts.get(p.get("status") or "unknown", 0) + 1
    completed = [p for p in projects if p.get("official_record", {}).get("finalized_at") and p.get("submitted_at")]
    turnaround = []
    for p in completed:
        try:
            a=datetime.fromisoformat(p["submitted_at"].replace("Z","+00:00")); b=datetime.fromisoformat(p["official_record"]["finalized_at"].replace("Z","+00:00")); turnaround.append((b-a).total_seconds()/86400)
        except Exception: pass
    return {"total_revenue_paise": sum(int(o.get("amount_paise") or 0) for o in orders), "paid_transactions": len(orders), "status_counts": status_counts, "monthly_revenue": sorted(months.values(), key=lambda x:x["month"])[-12:], "average_turnaround_days": round(sum(turnaround)/len(turnaround),1) if turnaround else 0, "completion_rate": round(100*sum(1 for p in projects if p.get("status") in ("certified","rejected"))/len(projects),1) if projects else 0}


@portal.get("/admin/portal/clients")
async def admin_portal_clients(user: dict = Depends(current_admin_portal)):
    docs = await db.users.find({"role": "client"}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    for d in docs:
        d["project_count"] = await db.certification_projects.count_documents({"client_id": d["id"]})
    return docs

@portal.get("/admin/portal/clients/{client_id}")
async def admin_portal_client_detail(
    client_id: str,
    user: dict = Depends(current_admin_portal),
):
    client = await db.users.find_one(
        {"id": client_id, "role": "client"},
        {"_id": 0, "password_hash": 0},
    )

    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    projects = await db.certification_projects.find(
        {"client_id": client_id},
        {"_id": 0},
    ).sort("created_at", -1).to_list(500)

    project_rows = []

    for project in projects:
        row = _project_summary(project)

        if project.get("reviewer_id"):
            reviewer = await db.users.find_one(
                {"id": project["reviewer_id"]},
                {"_id": 0, "name": 1, "email": 1},
            )
            row["reviewer"] = reviewer or None
        else:
            row["reviewer"] = None

        project_rows.append(row)

    client["projects"] = project_rows
    client["project_count"] = len(project_rows)

    client["status_counts"] = {
        status: sum(
            1 for project in project_rows
            if project.get("status") == status
        )
        for status in (
            "draft",
            "submitted",
            "assigned",
            "under_review",
            "changes_requested",
            "forwarded",
            "certified",
            "rejected",
        )
    }

    return client

@portal.get("/admin/portal/reviewers")
async def admin_portal_reviewers(user: dict = Depends(current_admin_portal)):
    rows = await db.users.find(
        {"role": "reviewer", "active": {"$ne": False}},
        {"_id": 0, "password_hash": 0, "payout_profile.encrypted": 0},
    ).sort("created_at", -1).to_list(1000)
    for r in rows:
        r["active_assignments"] = await db.certification_projects.count_documents({"reviewer_id": r["id"], "status": {"$in": ["assigned", "under_review", "changes_requested"]}})
        r["completed_reviews"] = await db.certification_projects.count_documents({"reviewer_id": r["id"], "status": {"$in": ["forwarded", "certified", "rejected"]}})
        r.setdefault("max_workload", 5)
        r.setdefault("project_types", [])
        r.setdefault("rating_systems", [])
        r.setdefault("specialisation", None)
        r["subscription_state"] = _subscription_state(r)
        eligible, reason = await reviewer_is_eligible(r)
        r["eligible"] = eligible
        r["eligibility_reason"] = reason
        r["available"] = eligible and r["active_assignments"] < r.get("max_workload", 5)
    return rows

@portal.get("/admin/portal/reviewers/{reviewer_id}")
async def admin_portal_reviewer_detail(
    reviewer_id: str,
    user: dict = Depends(current_admin_portal),
):
    reviewer = await db.users.find_one(
        {"id": reviewer_id, "role": "reviewer"},
        {"_id": 0, "password_hash": 0, "payout_profile.encrypted": 0},
    )

    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found")

    projects = await db.certification_projects.find(
        {"reviewer_id": reviewer_id},
        {"_id": 0},
    ).sort("updated_at", -1).to_list(500)

    project_rows = []

    for project in projects:
        row = _project_summary(project)

        client = await db.users.find_one(
            {"id": project.get("client_id")},
            {"_id": 0, "name": 1, "email": 1},
        )

        row["client"] = client or None
        project_rows.append(row)

    reviewer["projects"] = project_rows

    reviewer["active_assignments"] = sum(
        1 for project in project_rows
        if project.get("status") in (
            "assigned",
            "under_review",
            "changes_requested",
        )
    )

    reviewer["completed_reviews"] = sum(
        1 for project in project_rows
        if project.get("status") in (
            "forwarded",
            "certified",
            "rejected",
        )
    )
    reviewer["subscription_state"] = _subscription_state(reviewer)
    reviewer["documents"] = await db.reviewer_documents.find(
        {"reviewer_id": reviewer_id}, {"_id": 0, "key": 0}
    ).sort("uploaded_at", -1).to_list(50)
    reviewer["earnings"] = await db.reviewer_earnings.find(
        {"reviewer_id": reviewer_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)

    return reviewer


@portal.patch("/admin/portal/reviewers/{reviewer_id}/password")
async def admin_reset_reviewer_password(
    reviewer_id: str,
    data: ReviewerPasswordInput,
    user: dict = Depends(current_admin_portal_write),
):
    if data.new_password != data.confirm_password:
        raise HTTPException(
            status_code=400,
            detail="Passwords do not match.",
        )

    reviewer = await db.users.find_one({
        "id": reviewer_id,
        "role": "reviewer",
    })

    if not reviewer or not reviewer.get("active", True):
        raise HTTPException(
            status_code=404,
            detail="Active reviewer not found",
        )

    await db.users.update_one(
        {"id": reviewer_id},
        {
            "$set": {
                "password_hash": hash_password(data.new_password),
                "password_updated_at": now_iso(),
                "updated_at": now_iso(),
            }
        },
    )

    return {
        "message": "Reviewer password updated successfully."
    }


@portal.delete("/admin/portal/reviewers/{reviewer_id}")
async def admin_delete_reviewer(
    reviewer_id: str,
    user: dict = Depends(current_admin_portal_write),
):
    reviewer = await db.users.find_one({
        "id": reviewer_id,
        "role": "reviewer",
    })

    if not reviewer or not reviewer.get("active", True):
        raise HTTPException(
            status_code=404,
            detail="Active reviewer not found",
        )

    active_assignments = await db.certification_projects.count_documents({
        "reviewer_id": reviewer_id,
        "status": {
            "$in": [
                "assigned",
                "under_review",
                "changes_requested",
            ]
        },
    })

    if active_assignments:
        raise HTTPException(
            status_code=409,
            detail=(
                f"This reviewer has {active_assignments} active "
                "assignment(s). Reassign or remove them before deleting."
            ),
        )

    await db.users.update_one(
        {"id": reviewer_id},
        {
            "$set": {
                "active": False,
                "deleted_at": now_iso(),
                "deleted_by": user.get("id"),
                "updated_at": now_iso(),
            }
        },
    )

    return {
        "message": "Reviewer deleted successfully."
    }

@portal.post("/admin/portal/reviewers")
async def admin_create_reviewer(data: CreateReviewerInput, user: dict = Depends(current_admin_portal_write)):
    email = data.email.lower()
    if await _email_taken(email):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    reviewer = {
        "id": str(uuid.uuid4()),
        "public_id": await next_public_id("reviewer"),
        "name": data.name.strip(),
        "email": email,
        "password_hash": hash_password(data.password),
        "role": "reviewer",
        "specialisation": (data.specialisation or "").strip() or None,
        "project_types": data.project_types or [],
        "rating_systems": data.rating_systems or [],
        "max_workload": max(1, int(data.max_workload or 5)),
        "active": True,
        "email_verified": True,
        "reviewer_status": "approved",
        "requires_subscription": True,
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
async def admin_assign_reviewer(data: AssignInput,background_tasks: BackgroundTasks, user: dict = Depends(current_admin_portal_write)):
    project = await db.certification_projects.find_one({"id": data.project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    reviewer = await db.users.find_one({"id": data.reviewer_id, "role": "reviewer"})
    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found")
    if not reviewer.get("active", True):
        raise HTTPException(status_code=409, detail="Reviewer account is inactive.")
    eligible, reason = await reviewer_is_eligible(reviewer)
    if not eligible:
        raise HTTPException(status_code=409, detail=reason)
    active_workload = await db.certification_projects.count_documents({
        "reviewer_id": reviewer["id"],
        "status": {"$in": ["assigned", "under_review", "changes_requested"]},
    })
    if active_workload >= int(reviewer.get("max_workload") or 5):
        raise HTTPException(status_code=409, detail="Reviewer has reached the maximum active workload.")
    if project.get("status") not in ("submitted", "changes_requested", "assigned", "under_review"):
        raise HTTPException(status_code=409, detail="Only submitted/under-review projects can be assigned.")
    is_reassign = bool(project.get("reviewer_id")) and project.get("reviewer_id") != data.reviewer_id
    hist = {
        "id": str(uuid.uuid4()),
        "action": "reassigned" if is_reassign else "assigned",
        "reviewer_id": data.reviewer_id, "reviewer_name": reviewer["name"],
        "previous_reviewer_id": project.get("reviewer_id"),
        "due_date": data.due_date, "priority": data.priority, "instructions": data.instructions,
        "by": user.get("name") or "Admin", "at": now_iso(),
    }
    await db.certification_projects.update_one(
        {"id": data.project_id},
        {"$set": {"reviewer_id": data.reviewer_id, "status": "assigned",
                  "assignment": {"due_date": data.due_date, "priority": data.priority, "instructions": data.instructions, "assigned_at": now_iso()},
                  "updated_at": now_iso()},
         "$push": {"assignment_history": hist}},
    )
    await db.review_assignments.insert_one({
        "id": hist["id"], "project_id": data.project_id, "reviewer_id": data.reviewer_id,
        "assigned_by": user["id"], "assigned_at": now_iso(),
    })
    await _add_timeline(
    data.project_id,
    "Reviewer Reassigned" if is_reassign else "Reviewer Assigned",
    project.get("status"),
    "assigned",
    user.get("name") or "Admin",
    note=reviewer.get("name"),
)

    await _portal_notify(
        data.reviewer_id,
        f"assignment-{hist['id']}",
        "New project assignment",
        f"You have been assigned to {project.get('name') or 'a certification project'}. "
        f"Due: {data.due_date or 'not specified'}.",
        "info",
    )

    await _portal_notify(
        project.get("client_id"),
        f"reviewer-assigned-{hist['id']}",
        "Reviewer assigned",
        f"A reviewer has been assigned to {project.get('name') or 'your project'}.",
        "success",
    )

    # Reviewer email - send in background
    background_tasks.add_task(
        _portal_email,
        data.reviewer_id,
        "New ClimateWallah review assignment",
        (
            f"You have been assigned to review "
            f"<b>{project.get('name') or 'a certification project'}</b>. "
            f"Due date: <b>{data.due_date or 'not specified'}</b>. "
            "Please sign in to begin the assessment."
        ),
    )

    # Client email - send in background
    background_tasks.add_task(
        _portal_email,
        project.get("client_id"),
        "Reviewer assigned to your ClimateWallah project",
        (
            f"A reviewer has been assigned to "
            f"<b>{project.get('name') or 'your project'}</b>. "
            "You can track progress from your portal dashboard."
        ),
    )

    await record_audit(
        user,
        "reviewer_reassigned" if is_reassign else "reviewer_assigned",
        "certification_project",
        data.project_id,
        "Reviewer assignment updated",
        {
            "reviewer_id": data.reviewer_id,
            "due_date": data.due_date,
            "priority": data.priority,
        },
    )

    return {
        "assigned": True,
        "reassigned": is_reassign,
    }

@portal.post("/admin/portal/projects/{project_id}/unassign")
async def admin_unassign_reviewer(project_id: str, user: dict = Depends(current_admin_portal_write)):
    project = await db.certification_projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.get("reviewer_id"):
        raise HTTPException(status_code=409, detail="No reviewer assigned.")
    prev = project.get("reviewer_id")
    hist = {"id": str(uuid.uuid4()), "action": "removed", "reviewer_id": prev, "by": user.get("name") or "Admin", "at": now_iso()}
    await db.certification_projects.update_one(
        {"id": project_id},
        {"$set": {"reviewer_id": None, "assignment": None, "status": "submitted", "updated_at": now_iso()},
         "$push": {"assignment_history": hist}},
    )
    await _add_timeline(project_id, "Reviewer Removed", project.get("status"), "submitted", user.get("name") or "Admin")
    await _portal_notify(prev, f"assignment-removed-{project_id}-{hist['id']}", "Assignment removed", f"Your assignment for {project.get('name') or 'a project'} has been removed by Admin.", "warning")
    await _portal_notify(project.get("client_id"), f"reviewer-unassigned-{hist['id']}", "Reviewer assignment updated", f"The reviewer assignment for {project.get('name') or 'your project'} is being updated.", "warning")
    await record_audit(user, "reviewer_unassigned", "certification_project", project_id, "Reviewer removed from project", {"previous_reviewer_id": prev})
    return {"unassigned": True}


@portal.get("/admin/portal/certification-projects/{project_id}")
async def admin_portal_project_detail(project_id: str, user: dict = Depends(current_admin_portal)):
    p = await db.certification_projects.find_one({"id": project_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    p["template"] = project_view_template(p)
    p["claimed_score"] = score_project(p)
    p["recommended_score"] = score_project_responses(p, p.get("reviewer_recommendations") or {}, "recommended_points")
    if p.get("final_responses"):
        p["final_score"] = score_project_responses(p, p.get("final_responses"), "final_points")
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
    final_resp = data.final or {}
    final_score = score_project_responses(p, final_resp, "final_points")
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
    if data.decision == "certified":
        try:
            from app.services import pdf_service, storage
            tpl = project_view_template(p)
            cat_names = {c["id"]: c["name"] for c in (tpl.get("categories") or [])}
            record_for_pdf = {**official, "categories": final_score.get("categories")}
            cert_key = f"certificates/{project_id}-certificate.pdf"
            docket_key = f"certificates/{project_id}-docket.pdf"
            await storage.save_bytes(cert_key, pdf_service.build_certificate(p, record_for_pdf),
                                     "application/pdf", original_name="RES-Certificate.pdf")
            await storage.save_bytes(docket_key, pdf_service.build_docket(p, record_for_pdf, cat_names),
                                     "application/pdf", original_name="RES-Docket.pdf")
            official["certificate_pdf_url"] = f"{BACKEND_URL}/api/uploads/{cert_key}"
            official["docket_pdf_url"] = f"{BACKEND_URL}/api/uploads/{docket_key}"
        except Exception as e:
            logger.error(f"certificate PDF generation failed for {project_id}: {e}")
    try:
        from app.services import pdf_service, storage
        client_for_report = await db.users.find_one({"id": p.get("client_id")}, {"_id": 0, "name": 1, "email": 1, "organization": 1}) or {}
        reviewer_for_report = await db.users.find_one({"id": p.get("reviewer_id")}, {"_id": 0, "name": 1, "email": 1}) or {} if p.get("reviewer_id") else {}
        report_project = {**p, "official_record": official, "final_responses": final_resp, "final_score": final_score}
        report_key = f"certificates/{project_id}-review-report.pdf"
        await storage.save_bytes(report_key, pdf_service.build_review_report(report_project, reviewer_for_report, client_for_report), "application/pdf", original_name="ClimateWallah-Review-Report.pdf")
        official["review_report_pdf_url"] = f"{BACKEND_URL}/api/uploads/{report_key}"
    except Exception as e:
        logger.error(f"review report PDF generation failed for {project_id}: {e}")

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
    if p.get("reviewer_id"):
        settings = await billing_settings()
        reviewer = await db.users.find_one({"id": p["reviewer_id"], "role": "reviewer"}, {"_id": 0}) or {}
        base_paise = int(settings.get("reviewer_project_earning_paise", 29900))
        gst_rate = float(settings.get("gst_rate", 18)) if (reviewer.get("payout_profile") or {}).get("gst_registered") else 0
        gst_paise = int(round(base_paise * gst_rate / 100))
        earning_mode = "live"
        await db.reviewer_earnings.update_one(
            {"reviewer_id": p["reviewer_id"], "project_id": project_id},
            {"$setOnInsert": {
                "id": str(uuid.uuid4()),
                "reviewer_id": p["reviewer_id"],
                "project_id": project_id,
                "project_name": p.get("name"),
                "kind": "project_review",
                "base_paise": base_paise,
                "gst_rate": gst_rate,
                "gst_paise": gst_paise,
                "gross_paise": base_paise + gst_paise,
                "currency": "INR",
                "status": "approved",
                "payment_mode": earning_mode,
                "approved_at": now_iso(),
                "created_at": now_iso(),
            }},
            upsert=True,
        )
    await _add_timeline(project_id, "Certified" if data.decision == "certified" else "Rejected", p.get("status"), official["decision"], user.get("name") or "Admin", note=official.get("certificate_number"))
    await _portal_notify(p.get("client_id"), f"project-finalized-{project_id}-{official['finalized_at']}", "Project certified" if data.decision == "certified" else "Project decision completed", f"{p.get('name') or 'Your project'} has been {data.decision}." + (f" Certificate: {official.get('certificate_number')}." if official.get('certificate_number') else ""), "success" if data.decision == "certified" else "warning")
    if p.get("reviewer_id"):
        await _portal_notify(p.get("reviewer_id"), f"review-completed-{project_id}-{official['finalized_at']}", "Review completed", f"Admin finalized {p.get('name') or 'the project'} as {data.decision}.", "success")
    await _portal_email(p.get("client_id"), "ClimateWallah project decision completed", f"Your project <b>{p.get('name') or 'project'}</b> has been <b>{data.decision}</b>. Sign in to view the final score and download the available reports.")
    if p.get("reviewer_id"):
        await _portal_email(p.get("reviewer_id"), "ClimateWallah review finalized", f"The project <b>{p.get('name') or 'project'}</b> you reviewed has been finalized as <b>{data.decision}</b>.")
    await record_audit(user, "project_finalized", "certification_project", project_id, f"Project {data.decision}", {"decision": data.decision, "certificate_number": official.get("certificate_number"), "final_total": official.get("final_total")})
    return {"status": official["decision"], "official_record": official, "final_score": final_score}
