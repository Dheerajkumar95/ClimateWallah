"""Reviewer marketplace, dynamic certification and secure billing APIs."""
from __future__ import annotations

import copy
import json
import os
import random
import re
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.responses import Response as FileResponse
from pydantic import BaseModel, EmailStr, Field, field_validator
from pymongo import ReturnDocument

from app.services import storage
from app.services.certification_service import (
    DEFAULT_THRESHOLDS,
    normalise_code,
    published_template,
    raw_template,
)
from app.services.pricing_service import billing_settings, project_review_quote, reviewer_plan_quote
from app.services.razorpay_service import (
    configured as razorpay_configured,
    create_contact,
    create_fund_account,
    create_order,
    create_payout,
    public_key,
    test_connection as razorpay_test_connection,
    verify_checkout_signature,
    verify_webhook,
)
from app.services.payment_settings import payment_settings, save_payment_settings
from app.services.secure_data import decrypt_json, encrypt_json
from app.services.account_ids import next_public_id
from app.services.audit_service import record_audit
from auth import create_access_token, hash_password, new_csrf_token, set_auth_cookies, verify_password
from database import db
from email_service import send_email, send_otp_email
from portal_auth import current_admin_portal, current_admin_portal_write, current_client, current_client_write, current_reviewer, current_reviewer_write
from seed import now_iso


marketplace = APIRouter(prefix="/api")
OTP_TTL_MIN = 5
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_COOLDOWN_SECONDS = 60
PROJECT_TYPES = ["Commercial", "Residential", "Hotel", "Hospital"]
REVIEWER_DOCUMENT_TYPES = {"identity", "qualification"}
ALLOWED_REVIEWER_DOCS = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}
MAX_DOC_BYTES = int(os.getenv("UPLOAD_MAX_SIZE_MB", "15")) * 1024 * 1024


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _strong(value: str) -> str:
    if len(value) < 8 or not re.search(r"[A-Z]", value) or not re.search(r"[a-z]", value) or not re.search(r"\d", value):
        raise ValueError("Password must be at least 8 characters with upper, lower and numeric characters.")
    return value


def _otp() -> str:
    return f"{random.randint(0, 999999):06d}"


def _session(response: Response, user_id: str, role: str) -> None:
    set_auth_cookies(response, create_access_token(user_id, role), new_csrf_token())


async def _email_taken(email: str) -> bool:
    return bool(
        await db.users.find_one({"email": email})
        or await db.admins.find_one({"email": email})
    )


def _public_reviewer(user: dict) -> dict:
    return {
        "id": user["id"],
        "public_id": user.get("public_id"),
        "name": user.get("name"),
        "email": user.get("email"),
        "role": "reviewer",
        "phone": user.get("phone"),
        "organization": user.get("organization"),
        "reviewer_status": user.get("reviewer_status", "approved"),
        "requires_subscription": user.get("requires_subscription", False),
    }


async def _notify(user_id: str, key: str, title: str, message: str, level: str = "info") -> bool:
    result = await db.notifications.update_one(
        {"user_id": user_id, "key": key},
        {"$setOnInsert": {
            "id": str(uuid.uuid4()), "user_id": user_id, "key": key,
            "title": title, "message": message, "level": level,
            "read": False, "created_at": now_iso(),
        }},
        upsert=True,
    )
    return bool(result.upserted_id)


async def _notify_admins(key: str, title: str, message: str, level: str = "info") -> None:
    admins = await db.admins.find({}, {"_id": 0, "id": 1}).to_list(100)
    for admin in admins:
        if admin.get("id"):
            await _notify(admin["id"], key, title, message, level)


def _subscription_state(user: dict) -> dict:
    if not user.get("requires_subscription", False):
        return {"status": "active", "active": True, "grandfathered": True, "ends_at": None, "days_remaining": None}
    sub = user.get("subscription") or {}
    ends_at = sub.get("ends_at")
    if not ends_at:
        return {"status": "not_started", "active": False, "ends_at": None, "days_remaining": None}
    try:
        end = datetime.fromisoformat(ends_at)
        delta = end - _now()
        days = max(0, delta.days + (1 if delta.seconds else 0))
        active = delta.total_seconds() > 0 and sub.get("status") == "active"
        return {**sub, "status": "active" if active else "expired", "active": active, "days_remaining": days}
    except (TypeError, ValueError):
        return {"status": "expired", "active": False, "ends_at": ends_at, "days_remaining": 0}


async def reviewer_is_eligible(user: dict) -> tuple[bool, str | None]:
    if user.get("reviewer_status", "approved") != "approved":
        return False, "Reviewer KYC is not approved."
    subscription = _subscription_state(user)
    if not subscription["active"]:
        return False, "Reviewer monthly plan is inactive or expired."
    return True, None


async def process_subscription_notifications() -> None:
    """Create idempotent plan-expiry alerts for reviewers and administrators."""
    reviewers = db.users.find({
        "role": "reviewer",
        "reviewer_status": "approved",
        "requires_subscription": True,
        "subscription.ends_at": {"$exists": True},
    })
    async for reviewer in reviewers:
        state = _subscription_state(reviewer)
        ends_at = state.get("ends_at")
        if not ends_at:
            continue

        days = state.get("days_remaining")
        if state.get("active") and days not in {7, 3, 1}:
            continue

        if state.get("active"):
            key = f"plan-expiry-{ends_at}-{days}"
            title = "Reviewer plan expiring soon"
            message = f"Your reviewer plan expires in {days} day(s). Renew it to keep receiving assignments."
            level = "warning"
        else:
            key = f"plan-expired-{ends_at}"
            title = "Reviewer plan expired"
            message = "Renew your monthly reviewer plan to receive new assignments. Your existing earnings remain available."
            level = "error"

        inserted = await _notify(reviewer["id"], key, title, message, level)
        await _notify_admins(
            f"admin-{key}-{reviewer['id']}",
            title,
            f"{reviewer.get('name') or reviewer.get('email')} — {message}",
            level,
        )
        if inserted and reviewer.get("email"):
            await send_email(
                reviewer["email"],
                f"ClimateWallah: {title}",
                message,
                f"<p>Hello {reviewer.get('name') or 'Reviewer'},</p><p>{message}</p>",
            )


class ReviewerRegisterInput(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str
    city: str
    organization: str | None = None
    specialisation: str | None = None
    experience_years: int = 0
    project_types: list[str] = Field(default_factory=list)
    rating_systems: list[str] = Field(default_factory=list)

    @field_validator("password")
    @classmethod
    def strong(cls, value):
        return _strong(value)

    @field_validator("name", "phone", "city")
    @classmethod
    def required_text(cls, value):
        value = (value or "").strip()
        if len(value) < 2:
            raise ValueError("This field must contain at least 2 characters.")
        return value

    @field_validator("experience_years")
    @classmethod
    def valid_experience(cls, value):
        if value < 0 or value > 80:
            raise ValueError("Experience must be between 0 and 80 years.")
        return value

    @field_validator("project_types")
    @classmethod
    def valid_project_types(cls, value):
        cleaned = list(dict.fromkeys(value or []))
        if not cleaned or any(item not in PROJECT_TYPES for item in cleaned):
            raise ValueError(f"Select one or more valid project types: {', '.join(PROJECT_TYPES)}.")
        return cleaned

    @field_validator("rating_systems")
    @classmethod
    def rating_system_required(cls, value):
        cleaned = [normalise_code(item) for item in dict.fromkeys(value or []) if normalise_code(item)]
        if not cleaned:
            raise ValueError("Select at least one certification system.")
        return cleaned


class OtpInput(BaseModel):
    email: EmailStr
    otp: str


class EmailInput(BaseModel):
    email: EmailStr


class GuidelinesInput(BaseModel):
    guidelines_accepted: bool
    declaration_accepted: bool


class CertificationTypeInput(BaseModel):
    code: str
    name: str
    full_name: str | None = None
    description: str | None = None
    accent: str = "#27F580"
    active: bool = True
    price_multiplier: float = 1.0
    display_order: int = 0

    @field_validator("price_multiplier")
    @classmethod
    def valid_multiplier(cls, value):
        if value <= 0 or value > 100:
            raise ValueError("Price multiplier must be greater than 0 and no more than 100.")
        return value


class CheckoutVerifyInput(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class PaymentOrderInput(BaseModel):
    method: str = "razorpay"

    @field_validator("method")
    @classmethod
    def valid_method(cls, value):
        value = (value or "").strip().lower()
        if value not in {"razorpay", "qr"}:
            raise ValueError("Choose Razorpay or QR/UPI.")
        return value


class QrPaymentSubmitInput(BaseModel):
    internal_id: str
    utr: str

    @field_validator("utr")
    @classmethod
    def valid_qr_utr(cls, value):
        value = (value or "").strip()
        if len(value) < 4 or len(value) > 100:
            raise ValueError("Enter a valid UTR / transaction reference.")
        return value


class PaymentGatewaySettingsInput(BaseModel):
    razorpay_enabled: bool = False
    qr_enabled: bool = False
    key_id: str | None = None
    key_secret: str | None = None
    payment_webhook_secret: str | None = None
    upi_id: str | None = None
    payee_name: str | None = None
    qr_image_url: str | None = None


class PaymentDecisionInput(BaseModel):
    notes: str | None = None


class ReviewerDecisionInput(BaseModel):
    decision: str
    comment: str | None = None
    welcome_message: str | None = None
    welcome_pdf_id: str | None = None

    @field_validator("decision")
    @classmethod
    def decision_value(cls, value):
        if value not in {"approved", "changes_requested", "rejected", "suspended"}:
            raise ValueError("Invalid reviewer decision.")
        return value


class BankDetailsInput(BaseModel):
    account_holder_name: str
    account_number: str | None = None
    confirm_account_number: str | None = None
    ifsc: str | None = None
    upi_id: str | None = None
    pan: str | None = None
    gstin: str | None = None
    gst_registered: bool = False


class PayoutInput(BaseModel):
    reviewer_id: str
    earning_ids: list[str] = Field(default_factory=list)
    notes: str | None = None


class ManualPaidInput(BaseModel):
    utr: str
    notes: str | None = None

    @field_validator("utr")
    @classmethod
    def valid_utr(cls, value):
        value = (value or "").strip()
        if len(value) < 4 or len(value) > 100:
            raise ValueError("Enter a valid UTR or bank transaction reference.")
        return value


# ---------- Certification catalogue + checklist configuration ----------
@marketplace.get("/public/certification-types")
async def public_certification_types():
    rows = await db.certification_types.find({"active": True}, {"_id": 0}).sort("display_order", 1).to_list(100)
    for row in rows:
        configured = await db.certification_checklists.distinct(
            "project_type", {"certification_code": row["code"], "status": "published"}
        )
        row["configured_project_types"] = configured
    return rows


@marketplace.get("/public/certification-types/{code}")
async def public_certification_type(code: str):
    row = await db.certification_types.find_one({"code": normalise_code(code), "active": True}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Certification type not found")
    row["configured_project_types"] = await db.certification_checklists.distinct(
        "project_type", {"certification_code": row["code"], "status": "published"}
    )
    return row


@marketplace.get("/admin/portal/certification-types")
async def admin_certification_types(user: dict = Depends(current_admin_portal)):
    return await db.certification_types.find({}, {"_id": 0}).sort("display_order", 1).to_list(100)


@marketplace.post("/admin/portal/certification-types")
async def create_certification_type(data: CertificationTypeInput, user: dict = Depends(current_admin_portal_write)):
    code = normalise_code(data.code)
    if not code:
        raise HTTPException(400, "A certification code is required.")
    if await db.certification_types.find_one({"code": code}):
        raise HTTPException(409, "Certification type already exists.")
    row = {"id": str(uuid.uuid4()), **data.model_dump(), "code": code, "created_at": now_iso(), "updated_at": now_iso()}
    await db.certification_types.insert_one(copy.deepcopy(row))
    return row


@marketplace.put("/admin/portal/certification-types/{code}")
async def update_certification_type(code: str, data: CertificationTypeInput, user: dict = Depends(current_admin_portal_write)):
    current_code = normalise_code(code)
    payload = data.model_dump()
    payload["code"] = current_code
    payload["updated_at"] = now_iso()
    result = await db.certification_types.update_one({"code": current_code}, {"$set": payload})
    if not result.matched_count:
        raise HTTPException(404, "Certification type not found")
    return await db.certification_types.find_one({"code": current_code}, {"_id": 0})


@marketplace.delete("/admin/portal/certification-types/{code}")
async def delete_certification_type(code: str, user: dict = Depends(current_admin_portal_write)):
    current_code = normalise_code(code)
    if await db.certification_projects.count_documents({"certification_type": current_code}):
        await db.certification_types.update_one({"code": current_code}, {"$set": {"active": False, "updated_at": now_iso()}})
        return {"message": "Certification type archived because projects already use it."}
    await db.certification_types.delete_one({"code": current_code})
    await db.certification_checklists.delete_many({"certification_code": current_code})
    return {"message": "Certification type deleted."}


async def _checklist_doc(code: str, project_type: str) -> dict:
    code = normalise_code(code)
    doc = await db.certification_checklists.find_one(
        {"certification_code": code, "project_type": project_type}, {"_id": 0}
    )
    if doc:
        return doc
    template = raw_template(project_type, code)
    template["certification_code"] = code
    return {"certification_code": code, "project_type": project_type, "template": template, "status": "not_configured", "version": 0}


async def _assert_checklist_target(code: str, project_type: str) -> str:
    code = normalise_code(code)
    if project_type not in PROJECT_TYPES:
        raise HTTPException(400, f"Project type must be one of: {', '.join(PROJECT_TYPES)}.")
    if not await db.certification_types.find_one({"code": code}):
        raise HTTPException(404, "Certification type not found.")
    return code


@marketplace.get("/admin/portal/checklists/{certification_code}/{project_type}")
async def get_checklist(certification_code: str, project_type: str, user: dict = Depends(current_admin_portal)):
    code = await _assert_checklist_target(certification_code, project_type)
    doc = await _checklist_doc(code, project_type)
    return {"template": doc["template"], "status": doc.get("status", "not_configured"), "version": doc.get("version", 0)}


@marketplace.get("/admin/portal/checklists/{project_type}")
async def get_legacy_checklist(project_type: str, user: dict = Depends(current_admin_portal)):
    return await get_checklist("IGBC", project_type, user)


def _nonnegative_number(value, label: str) -> float:
    try:
        number = float(value or 0)
    except (TypeError, ValueError):
        raise HTTPException(400, f"{label} must be a valid number.")
    if number < 0:
        raise HTTPException(400, f"{label} cannot be negative.")
    return number


def _validate_template(template: dict) -> None:
    if not (template.get("name") or "").strip():
        raise HTTPException(400, "Template name is required.")
    categories = template.get("categories") or []
    if not categories:
        raise HTTPException(400, "Add at least one certification section.")
    ids = set()
    category_ids = set()
    category_slugs = set()
    for category in categories:
        if not category.get("name"):
            raise HTTPException(400, "Every section requires a name.")
        category_id = category.get("id")
        if not category_id or category_id in category_ids:
            raise HTTPException(400, "Every section requires a unique ID.")
        category_ids.add(category_id)
        category_slug = str(category.get("slug") or category_id).strip().lower()
        if category_slug in category_slugs:
            raise HTTPException(400, "Every section requires a unique slug.")
        category_slugs.add(category_slug)
        for value in (category.get("max_points") or {}).values():
            _nonnegative_number(value, "Section points")
        criteria = category.get("criteria") or []
        if not criteria:
            raise HTTPException(400, "Every section requires at least one checklist item.")
        for criterion in criteria:
            cid = criterion.get("id")
            if not cid or cid in ids:
                raise HTTPException(400, "Every checklist item requires a unique ID.")
            ids.add(cid)
            if not criterion.get("name"):
                raise HTTPException(400, "Every checklist item requires a name.")
            for field in ("max_owner", "max_tenant"):
                _nonnegative_number(criterion.get(field, 0), "Checklist points")


@marketplace.put("/admin/portal/checklists/{certification_code}/{project_type}")
async def save_checklist(certification_code: str, project_type: str, payload: dict, user: dict = Depends(current_admin_portal_write)):
    code = await _assert_checklist_target(certification_code, project_type)
    template = payload.get("template") or {}
    template["certification_code"] = code
    template["project_type"] = project_type
    _validate_template(template)
    key = {"certification_code": code, "project_type": project_type}
    await db.certification_checklists.update_one(
        key,
        {"$set": {"template": template, "status": "draft", "updated_at": now_iso(), "updated_by": user.get("id")},
         "$setOnInsert": {"id": str(uuid.uuid4()), "version": 0, "created_at": now_iso()}},
        upsert=True,
    )
    return {"template": template, "status": "draft"}


@marketplace.put("/admin/portal/checklists/{project_type}")
async def save_legacy_checklist(project_type: str, payload: dict, user: dict = Depends(current_admin_portal_write)):
    return await save_checklist("IGBC", project_type, payload, user)


@marketplace.post("/admin/portal/checklists/{certification_code}/{project_type}/publish")
async def publish_checklist(certification_code: str, project_type: str, user: dict = Depends(current_admin_portal_write)):
    code = await _assert_checklist_target(certification_code, project_type)
    doc = await db.certification_checklists.find_one({"certification_code": code, "project_type": project_type})
    if not doc or not doc.get("template"):
        raise HTTPException(404, "Save the checklist draft before publishing.")
    _validate_template(doc["template"])
    version = int(doc.get("version", 0)) + 1
    published = copy.deepcopy(doc["template"])
    published["version"] = str(version)
    await db.certification_checklists.update_one(
        {"_id": doc["_id"]},
        {"$set": {"published_template": published, "template": published, "status": "published", "version": version,
                  "published_at": now_iso(), "updated_at": now_iso(), "published_by": user.get("id")}},
    )
    return {"template": published, "status": "published", "message": f"Checklist version {version} published."}


@marketplace.post("/admin/portal/checklists/{project_type}/publish")
async def publish_legacy_checklist(project_type: str, user: dict = Depends(current_admin_portal_write)):
    return await publish_checklist("IGBC", project_type, user)


# ---------- Reviewer self-registration + KYC ----------
@marketplace.post("/auth/reviewer/register", status_code=202)
async def reviewer_register(data: ReviewerRegisterInput):
    email = data.email.lower().strip()
    if await _email_taken(email):
        raise HTTPException(409, "An account with this email already exists.")
    available_systems = set(await db.certification_types.distinct("code", {"active": True}))
    if not available_systems or any(code not in available_systems for code in data.rating_systems):
        raise HTTPException(400, "Select only active certification systems.")
    code = _otp()
    await db.pending_reviewer_registrations.update_one(
        {"email": email},
        {"$set": {**data.model_dump(exclude={"password"}), "email": email,
                  "password_hash": hash_password(data.password), "otp_hash": hash_password(code),
                  "attempts": 0, "resend_count": 0, "last_sent": now_iso(),
                  "expires_at": (_now() + timedelta(minutes=OTP_TTL_MIN)).isoformat(), "created_at": now_iso()}},
        upsert=True,
    )
    if not await send_otp_email(email, data.name, code):
        await db.pending_reviewer_registrations.delete_one({"email": email})
        raise HTTPException(503, "Unable to send verification email. Please try again.")
    return {"message": "Verification code sent.", "email": email, "expires_in_minutes": OTP_TTL_MIN}


@marketplace.post("/auth/reviewer/verify-otp")
async def reviewer_verify(data: OtpInput, response: Response):
    email = data.email.lower()
    pending = await db.pending_reviewer_registrations.find_one({"email": email})
    if not pending:
        raise HTTPException(404, "No pending reviewer registration.")
    if datetime.fromisoformat(pending["expires_at"]) < _now():
        await db.pending_reviewer_registrations.delete_one({"email": email})
        raise HTTPException(410, "Code expired. Please register again.")
    if pending.get("attempts", 0) >= OTP_MAX_ATTEMPTS:
        raise HTTPException(429, "Too many verification attempts. Please try again later.")
    if not verify_password(data.otp.strip(), pending["otp_hash"]):
        next_attempts = pending.get("attempts", 0) + 1
        await db.pending_reviewer_registrations.update_one({"email": email}, {"$inc": {"attempts": 1}})
        if next_attempts >= OTP_MAX_ATTEMPTS:
            raise HTTPException(429, "Too many verification attempts. Please try again later.")
        raise HTTPException(400, f"Invalid verification code. {OTP_MAX_ATTEMPTS-next_attempts} attempt(s) left.")
    if await _email_taken(email):
        raise HTTPException(409, "An account with this email already exists.")
    reviewer = {
        "id": str(uuid.uuid4()), "public_id": await next_public_id("reviewer"), "name": pending["name"], "email": email,
        "password_hash": pending["password_hash"], "role": "reviewer", "phone": pending.get("phone"),
        "city": pending.get("city"), "organization": pending.get("organization"),
        "specialisation": pending.get("specialisation"), "experience_years": pending.get("experience_years", 0),
        "project_types": pending.get("project_types") or [], "rating_systems": pending.get("rating_systems") or [],
        "reviewer_status": "pending_documents", "requires_subscription": True,
        "active": True, "email_verified": True, "max_workload": 5,
        "created_at": now_iso(), "updated_at": now_iso(),
    }
    await db.users.insert_one(copy.deepcopy(reviewer))
    await db.pending_reviewer_registrations.delete_one({"email": email})
    _session(response, reviewer["id"], "reviewer")
    return _public_reviewer(reviewer)


@marketplace.post("/auth/reviewer/resend-otp")
async def reviewer_resend(data: EmailInput):
    email = data.email.lower()
    pending = await db.pending_reviewer_registrations.find_one({"email": email})
    if not pending:
        raise HTTPException(404, "No pending reviewer registration.")
    if pending.get("resend_count", 0) >= 5:
        raise HTTPException(429, "Too many verification attempts. Please try again later.")
    try:
        last_sent = datetime.fromisoformat(pending.get("last_sent"))
        remaining = OTP_RESEND_COOLDOWN_SECONDS - int((_now() - last_sent).total_seconds())
        if remaining > 0:
            raise HTTPException(429, f"Please wait {remaining} seconds before requesting another code.")
    except (TypeError, ValueError):
        pass
    code = _otp()
    await db.pending_reviewer_registrations.update_one(
        {"email": email}, {"$set": {"otp_hash": hash_password(code), "attempts": 0, "last_sent": now_iso(),
                                               "expires_at": (_now() + timedelta(minutes=OTP_TTL_MIN)).isoformat()},
                            "$inc": {"resend_count": 1}}
    )
    if not await send_otp_email(email, pending.get("name", ""), code):
        raise HTTPException(503, "Unable to send verification email.")
    return {"message": "A new code has been sent."}


@marketplace.post("/reviewer/onboarding/documents")
async def upload_reviewer_document(
    document_type: str = Form(...), file: UploadFile = File(...),
    user: dict = Depends(current_reviewer_write),
):
    document_type = document_type.strip().lower()
    if document_type not in REVIEWER_DOCUMENT_TYPES:
        raise HTTPException(400, "Document type must be identity or qualification.")
    extension = os.path.splitext(file.filename or "")[1].lower()
    if extension not in ALLOWED_REVIEWER_DOCS:
        raise HTTPException(400, "Only PDF, PNG, JPG and WEBP documents are allowed.")
    content = await file.read()
    if len(content) > MAX_DOC_BYTES:
        raise HTTPException(400, "Document is too large.")
    file_id = uuid.uuid4().hex
    key = f"reviewer-documents/{user['id']}/{file_id}{extension}"
    content_type = storage.safe_content_type(file.filename or key, file.content_type)
    old_rows = await db.reviewer_documents.find(
        {"reviewer_id": user["id"], "document_type": document_type},
        {"_id": 0, "key": 1},
    ).to_list(50)
    await storage.save_bytes(key, content, content_type, file.filename,
                             {"reviewer_id": user["id"], "document_type": document_type})
    row = {"id": file_id, "reviewer_id": user["id"], "document_type": document_type,
           "key": key, "original_name": file.filename, "content_type": content_type,
           "size": len(content), "status": "pending", "uploaded_at": now_iso()}
    try:
        await db.reviewer_documents.insert_one(copy.deepcopy(row))
    except Exception:
        await storage.delete_by_key(key)
        raise
    # A reviewer keeps one current identity document and one current
    # qualification document. Remove superseded database rows and GridFS data.
    await db.reviewer_documents.delete_many({
        "reviewer_id": user["id"], "document_type": document_type,
        "id": {"$ne": file_id},
    })
    for old in old_rows:
        if old.get("key") and old["key"] != key:
            await storage.delete_by_key(old["key"])
    return {key: value for key, value in row.items() if key != "key"}


@marketplace.get("/reviewer/documents/{document_id}")
async def reviewer_document(document_id: str, user: dict = Depends(current_reviewer)):
    row = await db.reviewer_documents.find_one({"id": document_id, "reviewer_id": user["id"]}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Document not found")
    result = await storage.open_by_key(row["key"])
    if not result:
        raise HTTPException(404, "Stored document not found")
    content, _ = result
    content_type = storage.safe_content_type(row.get("key", ""), row.get("content_type"))
    return FileResponse(
        content=content,
        media_type=content_type,
        headers={
            "Content-Disposition": storage.content_disposition("inline", row.get("original_name", "document")),
            "Content-Security-Policy": "sandbox",
            "X-Content-Type-Options": "nosniff",
        },
    )


@marketplace.get("/admin/portal/reviewer-documents/{document_id}")
async def admin_reviewer_document(document_id: str, user: dict = Depends(current_admin_portal)):
    row = await db.reviewer_documents.find_one({"id": document_id}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Document not found")
    result = await storage.open_by_key(row["key"])
    if not result:
        raise HTTPException(404, "Stored document not found")
    content, _ = result
    content_type = storage.safe_content_type(row.get("key", ""), row.get("content_type"))
    return FileResponse(
        content=content,
        media_type=content_type,
        headers={
            "Content-Disposition": storage.content_disposition("inline", row.get("original_name", "document")),
            "Content-Security-Policy": "sandbox",
            "X-Content-Type-Options": "nosniff",
        },
    )


@marketplace.post("/reviewer/onboarding/submit")
async def submit_reviewer_onboarding(data: GuidelinesInput, user: dict = Depends(current_reviewer_write)):
    if not data.guidelines_accepted or not data.declaration_accepted:
        raise HTTPException(400, "Accept the reviewer guidelines and declaration to continue.")
    uploaded_types = set(await db.reviewer_documents.distinct("document_type", {"reviewer_id": user["id"]}))
    missing_types = REVIEWER_DOCUMENT_TYPES - uploaded_types
    if missing_types:
        raise HTTPException(400, f"Upload the required documents: {', '.join(sorted(missing_types))}.")
    await db.users.update_one({"id": user["id"]}, {"$set": {
        "reviewer_status": "pending_review", "guidelines_accepted_at": now_iso(), "updated_at": now_iso()
    }})
    await db.reviewer_applications.update_one(
        {"reviewer_id": user["id"]},
        {"$set": {"reviewer_id": user["id"], "status": "pending_review", "submitted_at": now_iso(), "updated_at": now_iso()},
         "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": now_iso()}}, upsert=True,
    )
    return {"status": "pending_review", "message": "Your profile is pending admin verification."}


async def _reviewer_account(user: dict) -> dict:
    full = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0}) or user
    subscription = _subscription_state(full)
    if full.get("requires_subscription") and subscription.get("ends_at"):
        days = subscription.get("days_remaining")
        if days in {7, 3, 1}:
            await _notify(full["id"], f"plan-expiry-{subscription['ends_at']}-{days}", "Plan expiring soon",
                          f"Your reviewer plan expires in {days} day(s).", "warning")
            await _notify_admins(
                f"reviewer-plan-expiry-{full['id']}-{subscription['ends_at']}-{days}",
                "Reviewer plan expiring",
                f"{full.get('name') or full.get('email')} plan expires in {days} day(s).",
                "warning",
            )
        if not subscription["active"]:
            await _notify(full["id"], f"plan-expired-{subscription['ends_at']}", "Plan expired",
                          "Renew your monthly reviewer plan to receive new assignments.", "error")
            await _notify_admins(
                f"reviewer-plan-expired-{full['id']}-{subscription['ends_at']}",
                "Reviewer plan expired",
                f"{full.get('name') or full.get('email')} cannot receive new assignments until renewal.",
                "error",
            )
    docs = await db.reviewer_documents.find({"reviewer_id": full["id"]}, {"_id": 0, "key": 0}).to_list(50)
    earnings = await db.reviewer_earnings.find({"reviewer_id": full["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    totals = {
        "available_paise": sum(item.get("gross_paise", item.get("base_paise", 0)) for item in earnings if item.get("status") == "approved"),
        "paid_paise": sum(item.get("gross_paise", item.get("base_paise", 0)) for item in earnings if item.get("status") == "paid"),
        "projects_completed": len(earnings),
    }
    payout_profile = full.get("payout_profile") or {}
    safe_payout_profile = {
        key: value for key, value in payout_profile.items() if key != "encrypted"
    }
    # Never expose the encrypted bank/UPI payload to a browser.  It is only
    # decrypted inside the server immediately before a payout is created.
    full["payout_profile"] = safe_payout_profile
    return {
        "profile": full,
        "documents": docs,
        "subscription": subscription,
        "earnings": earnings,
        "earning_totals": totals,
        "payout_profile": safe_payout_profile,
    }


@marketplace.get("/reviewer/account")
async def reviewer_account(user: dict = Depends(current_reviewer)):
    return await _reviewer_account(user)


@marketplace.get("/reviewer/notifications")
async def reviewer_notifications(user: dict = Depends(current_reviewer)):
    return await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)


@marketplace.post("/reviewer/notifications/{notification_id}/read")
async def reviewer_notification_read(notification_id: str, user: dict = Depends(current_reviewer_write)):
    await db.notifications.update_one({"id": notification_id, "user_id": user["id"]}, {"$set": {"read": True, "read_at": now_iso()}})
    return {"read": True}


@marketplace.get("/client/notifications")
async def client_notifications(user: dict = Depends(current_client)):
    return await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)


@marketplace.post("/client/notifications/{notification_id}/read")
async def client_notification_read(notification_id: str, user: dict = Depends(current_client_write)):
    await db.notifications.update_one({"id": notification_id, "user_id": user["id"]}, {"$set": {"read": True, "read_at": now_iso()}})
    return {"read": True}


@marketplace.put("/reviewer/payout-profile")
async def update_payout_profile(data: BankDetailsInput, user: dict = Depends(current_reviewer_write)):
    holder = data.account_holder_name.strip()
    account = re.sub(r"\s+", "", data.account_number or "")
    confirm_account = re.sub(r"\s+", "", data.confirm_account_number or "")
    ifsc = (data.ifsc or "").strip().upper()
    upi_id = (data.upi_id or "").strip().lower()
    pan = (data.pan or "").strip().upper()
    gstin = (data.gstin or "").strip().upper()

    if len(holder) < 2:
        raise HTTPException(400, "Enter the account holder's full name.")
    if upi_id:
        if not re.fullmatch(r"[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}", upi_id):
            raise HTTPException(400, "Enter a valid UPI ID.")
    else:
        if not all([account, confirm_account, ifsc]):
            raise HTTPException(400, "Provide bank account details or a UPI ID.")
        if account != confirm_account:
            raise HTTPException(400, "Bank account numbers do not match.")
        if not re.fullmatch(r"\d{8,20}", account):
            raise HTTPException(400, "Bank account number must contain 8 to 20 digits.")
        if not re.fullmatch(r"[A-Z]{4}0[A-Z0-9]{6}", ifsc):
            raise HTTPException(400, "Enter a valid IFSC code.")
    if pan and not re.fullmatch(r"[A-Z]{5}[0-9]{4}[A-Z]", pan):
        raise HTTPException(400, "Enter a valid PAN.")
    if data.gst_registered and not gstin:
        raise HTTPException(400, "GSTIN is required when GST registration is enabled.")
    if gstin and not re.fullmatch(r"[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]", gstin):
        raise HTTPException(400, "Enter a valid GSTIN.")

    sensitive = {
        "account_holder_name": holder,
        "account_number": account or None,
        "ifsc": ifsc or None,
        "upi_id": upi_id or None,
        "pan": pan or None,
        "gstin": gstin or None,
        "gst_registered": data.gst_registered,
    }
    public = {
        "account_holder_name": holder,
        "bank_last4": account[-4:] if account else None,
        "ifsc": ifsc or None,
        "upi_masked": (upi_id[:2] + "***" + upi_id[upi_id.find("@"):] if upi_id else None),
        "pan_last4": pan[-4:] if pan else None,
        "gstin": gstin or None,
        "gst_registered": data.gst_registered,
        "verified": False,
        "updated_at": now_iso(),
        "encrypted": encrypt_json(sensitive),
    }
    await db.users.update_one({"id": user["id"]}, {"$set": {"payout_profile": public, "updated_at": now_iso()}})
    return {key: value for key, value in public.items() if key != "encrypted"}


# ---------- Production payments: Razorpay + admin-verified QR/UPI ----------
@marketplace.get("/payments/methods")
async def public_payment_methods():
    settings = await payment_settings()
    return {
        "razorpay_enabled": bool(settings.get("razorpay_enabled") and settings.get("razorpay_configured")),
        "qr_enabled": bool(settings.get("qr_enabled") and settings.get("upi_id")),
        "upi_id": settings.get("upi_id") if settings.get("qr_enabled") else "",
        "payee_name": settings.get("payee_name") if settings.get("qr_enabled") else "",
        "qr_image_url": settings.get("qr_image_url") if settings.get("qr_enabled") else "",
    }


def _payment_order_response(row: dict) -> dict:
    response = {
        "provider": row.get("provider", "razorpay"),
        "key_id": row.get("key_id"),
        "order_id": row.get("provider_order_id") or row.get("razorpay_order_id"),
        "transaction_id": row.get("transaction_id"),
        "amount": row.get("amount_paise"),
        "currency": row.get("currency", "INR"),
        "internal_id": row.get("id"),
        "quote": row.get("quote") or {},
    }
    if row.get("provider") == "qr_upi":
        response["upi_id"] = row.get("upi_id")
        response["payee_name"] = row.get("payee_name")
        response["qr_image_url"] = row.get("qr_image_url")
    return response


async def _make_payment_order(kind: str, owner_id: str, quote: dict, project_id: str | None = None, method: str = "razorpay") -> dict:
    if quote.get("custom_quote"):
        raise HTTPException(409, quote.get("message"))
    settings = await payment_settings(include_secrets=True)
    method = (method or "razorpay").strip().lower()
    if method == "razorpay":
        if not settings.get("razorpay_enabled"):
            raise HTTPException(503, "Razorpay is currently disabled by Admin.")
        credentials = settings.get("credentials") or {}
        if not razorpay_configured(credentials):
            raise HTTPException(503, "Razorpay credentials are not configured. Please contact Admin.")
    elif method == "qr":
        if not settings.get("qr_enabled") or not settings.get("upi_id"):
            raise HTTPException(503, "QR / UPI payment is currently unavailable.")
    else:
        raise HTTPException(400, "Unsupported payment method.")

    request_key = f"{kind}:{owner_id}:{project_id or 'plan'}:{method}"
    existing = await db.payment_orders.find_one({
        "request_key": request_key, "status": {"$in": ["created", "awaiting_payment", "verification_pending", "applying"]}
    }, {"_id": 0})
    if existing:
        if existing.get("provider") == "razorpay":
            existing["key_id"] = public_key(settings.get("credentials") or {})
        return _payment_order_response(existing)

    internal_id = str(uuid.uuid4())
    base = {
        "id": internal_id, "kind": kind, "owner_id": owner_id, "project_id": project_id, "request_key": request_key,
        "amount_paise": quote["total_paise"], "quote": quote, "currency": "INR",
        "created_at": now_iso(), "updated_at": now_iso(),
    }
    if method == "qr":
        reference = f"QR-{uuid.uuid4().hex[:10].upper()}"
        row = {**base, "provider": "qr_upi", "status": "awaiting_payment", "provider_order_id": reference,
               "transaction_id": None, "upi_id": settings.get("upi_id"), "payee_name": settings.get("payee_name"),
               "qr_image_url": settings.get("qr_image_url")}
        await db.payment_orders.insert_one(copy.deepcopy(row))
        return _payment_order_response(row)

    credentials = settings.get("credentials") or {}
    provider = await create_order(quote["total_paise"], internal_id, {"kind": kind, "owner_id": owner_id, "project_id": project_id or ""}, credentials)
    row = {**base, "provider_order_id": provider["id"], "razorpay_order_id": provider["id"],
           "provider": "razorpay", "status": "created"}
    await db.payment_orders.insert_one(copy.deepcopy(row))
    row["key_id"] = public_key(credentials)
    return _payment_order_response(row)


@marketplace.get("/client/projects/{project_id}/review-quote")
async def client_project_review_quote(project_id: str, user: dict = Depends(current_client_write)):
    project = await db.certification_projects.find_one({"id": project_id, "client_id": user["id"]}, {"_id": 0})
    if not project:
        raise HTTPException(404, "Project not found")
    if project.get("status") not in {"draft", "changes_requested"}:
        raise HTTPException(409, "This project is not ready for review submission.")
    return await project_review_quote(project)


@marketplace.post("/client/projects/{project_id}/payment-order")
async def client_payment_order(project_id: str, data: PaymentOrderInput, user: dict = Depends(current_client_write)):
    project = await db.certification_projects.find_one({"id": project_id, "client_id": user["id"]}, {"_id": 0})
    if not project:
        raise HTTPException(404, "Project not found")
    if project.get("status") not in {"draft", "changes_requested"}:
        raise HTTPException(409, "This project is not ready for a new payment.")
    return await _make_payment_order("client_review_fee", user["id"], await project_review_quote(project), project_id, data.method)


@marketplace.get("/reviewer/plan-quote")
async def plan_quote(user: dict = Depends(current_reviewer)):
    return await reviewer_plan_quote()


@marketplace.post("/reviewer/plan-order")
async def reviewer_plan_order(data: PaymentOrderInput, user: dict = Depends(current_reviewer_write)):
    full = await db.users.find_one({"id": user["id"]}) or user
    if full.get("reviewer_status", "approved") != "approved":
        raise HTTPException(409, "Admin approval is required before purchasing a reviewer plan.")
    return await _make_payment_order("reviewer_monthly_plan", user["id"], await reviewer_plan_quote(), method=data.method)


async def _apply_paid_order(order: dict, payment_id: str) -> None:
    provider = order.get("provider", "razorpay")
    claimed = await db.payment_orders.find_one_and_update(
        {"id": order["id"], "status": {"$in": ["created", "verification_pending", "failed", "apply_failed"]}},
        {"$set": {"status": "applying", "payment_id": payment_id, "razorpay_payment_id": payment_id if provider == "razorpay" else None, "updated_at": now_iso()}},
        return_document=ReturnDocument.AFTER,
    )
    if not claimed:
        current = await db.payment_orders.find_one({"id": order["id"]}, {"_id": 0}) or {}
        if current.get("status") == "paid":
            return
        raise HTTPException(409, "Payment is already being processed.")
    paid_at = now_iso()
    transaction_id = payment_id
    invoice_number = claimed.get("invoice_number") or f"CW-{datetime.now(timezone.utc).strftime('%Y%m')}-{str(order['id'])[:8].upper()}"
    try:
        if order["kind"] == "client_review_fee":
            await db.certification_projects.update_one({"id": order["project_id"]}, {"$set": {
                "review_payment": {
                    "status": "paid", "display_status": "Paid", "provider": provider,
                    "order_id": order.get("provider_order_id") or order.get("razorpay_order_id"),
                    "payment_id": payment_id, "transaction_id": transaction_id,
                    "quote": order["quote"], "paid_at": paid_at, "mode": "live",
                }, "updated_at": paid_at,
            }})
        elif order["kind"] == "reviewer_monthly_plan":
            user = await db.users.find_one({"id": order["owner_id"]}) or {}
            current = _subscription_state(user)
            start = _now()
            if current.get("active") and current.get("ends_at"):
                start = datetime.fromisoformat(current["ends_at"])
            days = int(order.get("quote", {}).get("plan_days", 30))
            existing_subscription = user.get("subscription") or {}
            subscription = {
                "status": "active", "starts_at": existing_subscription.get("starts_at") or _now().isoformat(),
                "ends_at": (start + timedelta(days=days)).isoformat(), "extended_at": paid_at if current.get("active") else None,
                "order_id": order.get("provider_order_id") or order.get("razorpay_order_id"), "payment_id": payment_id,
                "transaction_id": transaction_id, "provider": provider, "mode": "live", "updated_at": paid_at,
            }
            await db.users.update_one({"id": order["owner_id"]}, {"$set": {"subscription": subscription, "updated_at": paid_at}})
            await _notify(order["owner_id"], f"plan-active-{order['id']}", "Reviewer plan activated",
                          f"Your plan is active until {subscription['ends_at'][:10]}.", "success")
        else:
            raise RuntimeError("Unsupported payment order type.")
    except Exception as exc:
        await db.payment_orders.update_one({"id": order["id"], "status": "applying"}, {"$set": {"status": "apply_failed", "apply_error": str(exc)[:500], "updated_at": now_iso()}})
        raise
    await db.payment_orders.update_one({"id": order["id"], "status": "applying"}, {"$set": {
        "status": "paid", "provider": provider, "transaction_id": transaction_id, "paid_at": paid_at, "invoice_number": invoice_number, "updated_at": now_iso()
    }, "$unset": {"apply_error": "", "request_key": ""}})
    await _notify(order["owner_id"], f"payment-receipt-{order['id']}", "Payment receipt ready", f"Payment successful. Receipt {invoice_number} is now available in your account.", "success")


@marketplace.post("/payments/verify")
async def verify_payment(data: CheckoutVerifyInput, user: dict = Depends(current_client_write)):
    order = await db.payment_orders.find_one({"razorpay_order_id": data.razorpay_order_id, "owner_id": user["id"], "provider": "razorpay"}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Payment order not found.")
    settings = await payment_settings(include_secrets=True)
    if not verify_checkout_signature(data.razorpay_order_id, data.razorpay_payment_id, data.razorpay_signature, settings.get("credentials") or {}):
        raise HTTPException(400, "Payment signature verification failed.")
    await _apply_paid_order(order, data.razorpay_payment_id)
    return {"verified": True, "kind": order["kind"], "project_id": order.get("project_id")}


@marketplace.post("/reviewer/payments/verify")
async def verify_reviewer_payment(data: CheckoutVerifyInput, user: dict = Depends(current_reviewer_write)):
    order = await db.payment_orders.find_one({"razorpay_order_id": data.razorpay_order_id, "owner_id": user["id"], "kind": "reviewer_monthly_plan", "provider": "razorpay"}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Payment order not found.")
    settings = await payment_settings(include_secrets=True)
    if not verify_checkout_signature(data.razorpay_order_id, data.razorpay_payment_id, data.razorpay_signature, settings.get("credentials") or {}):
        raise HTTPException(400, "Payment signature verification failed.")
    await _apply_paid_order(order, data.razorpay_payment_id)
    return {"verified": True, "subscription": _subscription_state(await db.users.find_one({"id": user["id"]}) or user)}


async def _submit_qr_payment(internal_id: str, utr: str, owner_id: str, kind: str) -> dict:
    duplicate = await db.payment_orders.find_one({"transaction_id": utr, "provider": "qr_upi", "id": {"$ne": internal_id}}, {"_id": 0, "id": 1})
    if duplicate:
        raise HTTPException(409, "This UTR / transaction reference has already been submitted.")
    order = await db.payment_orders.find_one({"id": internal_id, "owner_id": owner_id, "kind": kind, "provider": "qr_upi"}, {"_id": 0})
    if not order:
        raise HTTPException(404, "QR payment order not found.")
    if order.get("status") == "paid":
        return order
    if order.get("status") not in {"awaiting_payment", "rejected"}:
        raise HTTPException(409, "This payment is already awaiting verification.")
    await db.payment_orders.update_one({"id": internal_id}, {"$set": {
        "transaction_id": utr.strip(), "status": "verification_pending", "submitted_at": now_iso(), "updated_at": now_iso()
    }})
    await _notify_admins(f"qr-payment-{internal_id}", "QR / UPI payment awaiting verification",
                         f"A {kind.replace('_', ' ')} payment of ₹{order['amount_paise']/100:,.2f} was submitted with UTR {utr.strip()}.", "info")
    return {"verified": False, "status": "verification_pending", "transaction_id": utr.strip()}


@marketplace.post("/payments/qr-submit")
async def submit_client_qr_payment(data: QrPaymentSubmitInput, user: dict = Depends(current_client_write)):
    return await _submit_qr_payment(data.internal_id, data.utr, user["id"], "client_review_fee")


@marketplace.post("/reviewer/payments/qr-submit")
async def submit_reviewer_qr_payment(data: QrPaymentSubmitInput, user: dict = Depends(current_reviewer_write)):
    return await _submit_qr_payment(data.internal_id, data.utr, user["id"], "reviewer_monthly_plan")


@marketplace.get("/payments/orders/{internal_id}/status")
async def client_payment_status(internal_id: str, user: dict = Depends(current_client)):
    row = await db.payment_orders.find_one({"id": internal_id, "owner_id": user["id"], "kind": "client_review_fee"}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Payment order not found.")
    return _payment_order_response(row) | {"status": row.get("status"), "paid_at": row.get("paid_at")}


@marketplace.get("/reviewer/payments/orders/{internal_id}/status")
async def reviewer_payment_status(internal_id: str, user: dict = Depends(current_reviewer)):
    row = await db.payment_orders.find_one({"id": internal_id, "owner_id": user["id"], "kind": "reviewer_monthly_plan"}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Payment order not found.")
    return _payment_order_response(row) | {"status": row.get("status"), "paid_at": row.get("paid_at")}


async def _invoice_rows(owner_id: str, role: str) -> list[dict]:
    rows = await db.payment_orders.find({"owner_id": owner_id, "status": "paid"}, {"_id": 0}).sort("paid_at", -1).to_list(500)
    return [{"id": r.get("id"), "invoice_number": r.get("invoice_number") or f"CW-{str(r.get('id') or '')[:8].upper()}", "kind": r.get("kind"), "amount_paise": r.get("amount_paise"), "currency": r.get("currency", "INR"), "provider": r.get("provider"), "transaction_id": r.get("transaction_id"), "paid_at": r.get("paid_at")} for r in rows]


@marketplace.get("/client/invoices")
async def client_invoices(user: dict = Depends(current_client)):
    return await _invoice_rows(user["id"], "client")


@marketplace.get("/reviewer/invoices")
async def reviewer_invoices(user: dict = Depends(current_reviewer)):
    return await _invoice_rows(user["id"], "reviewer")


async def _invoice_pdf(order_id: str, owner: dict):
    order = await db.payment_orders.find_one({"id": order_id, "owner_id": owner["id"], "status": "paid"}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Paid invoice not found.")
    from app.services.pdf_service import build_payment_invoice
    pdf = build_payment_invoice(order, owner)
    filename = f"{order.get('invoice_number') or 'ClimateWallah-Receipt'}.pdf"
    return FileResponse(content=pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@marketplace.get("/client/invoices/{order_id}/pdf")
async def client_invoice_pdf(order_id: str, user: dict = Depends(current_client)):
    return await _invoice_pdf(order_id, user)


@marketplace.get("/reviewer/invoices/{order_id}/pdf")
async def reviewer_invoice_pdf(order_id: str, user: dict = Depends(current_reviewer)):
    return await _invoice_pdf(order_id, user)


@marketplace.post("/webhooks/razorpay")
async def razorpay_webhook(request: Request):
    body = await request.body()
    settings = await payment_settings(include_secrets=True)
    if not verify_webhook(body, request.headers.get("X-Razorpay-Signature", ""), credentials=settings.get("credentials") or {}):
        raise HTTPException(400, "Invalid webhook signature")
    payload = json.loads(body)
    event = payload.get("event", "")
    payment = (((payload.get("payload") or {}).get("payment") or {}).get("entity") or {})
    order = await db.payment_orders.find_one({"razorpay_order_id": payment.get("order_id"), "provider": "razorpay"}, {"_id": 0})
    if order and event in {"payment.captured", "order.paid"}:
        await _apply_paid_order(order, payment.get("id") or "webhook")
    elif order and event == "payment.failed":
        await db.payment_orders.update_one({"id": order["id"], "status": {"$in": ["created", "failed"]}}, {"$set": {"status": "failed", "updated_at": now_iso()}})
    return {"received": True}


@marketplace.post("/admin/portal/reviewer-welcome-pdf")
async def upload_reviewer_welcome_pdf(file: UploadFile = File(...), user: dict = Depends(current_admin_portal_write)):
    extension = os.path.splitext(file.filename or "")[1].lower()
    if extension != ".pdf" or file.content_type not in {"application/pdf", "application/octet-stream"}:
        raise HTTPException(400, "Only PDF attachments are allowed.")
    content = await file.read()
    if not content or len(content) > MAX_DOC_BYTES:
        raise HTTPException(400, "PDF is empty or too large.")
    attachment_id = uuid.uuid4().hex
    key = f"reviewer-welcome/{attachment_id}.pdf"
    await storage.save_bytes(key, content, "application/pdf", file.filename, {"uploaded_by": user["id"]})
    row = {"id": attachment_id, "key": key, "filename": file.filename or "Reviewer-Welcome.pdf", "content_type": "application/pdf", "created_at": now_iso(), "created_by": user["id"]}
    await db.reviewer_welcome_attachments.insert_one(copy.deepcopy(row))
    return {k: v for k, v in row.items() if k != "key"}


# ---------- Admin reviewer approval, billing and payouts ----------
@marketplace.get("/admin/portal/reviewer-applications")
async def reviewer_applications(user: dict = Depends(current_admin_portal)):
    reviewers = await db.users.find({"role": "reviewer"}, {"_id": 0, "password_hash": 0,
                                                                                             "payout_profile.encrypted": 0}).sort("created_at", -1).to_list(1000)
    for reviewer in reviewers:
        reviewer["documents"] = await db.reviewer_documents.find({"reviewer_id": reviewer["id"]}, {"_id": 0, "key": 0}).to_list(50)
        reviewer["subscription_state"] = _subscription_state(reviewer)
    return reviewers


@marketplace.get("/admin/portal/notifications")
async def admin_notifications(user: dict = Depends(current_admin_portal)):
    return await db.notifications.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)


@marketplace.post("/admin/portal/reviewer-applications/{reviewer_id}/decision")
async def reviewer_application_decision(reviewer_id: str, data: ReviewerDecisionInput,
                                        user: dict = Depends(current_admin_portal_write)):
    reviewer = await db.users.find_one({"id": reviewer_id, "role": "reviewer"})
    if not reviewer:
        raise HTTPException(404, "Reviewer not found")

    if data.decision == "approved" and reviewer.get("requires_subscription", False):
        uploaded_types = set(await db.reviewer_documents.distinct(
            "document_type", {"reviewer_id": reviewer_id}
        ))
        missing_types = REVIEWER_DOCUMENT_TYPES - uploaded_types
        if missing_types:
            raise HTTPException(409, f"Cannot approve until these documents are uploaded: {', '.join(sorted(missing_types))}.")
        if not reviewer.get("guidelines_accepted_at"):
            raise HTTPException(409, "Reviewer guidelines and declaration have not been accepted.")

    await db.users.update_one({"id": reviewer_id}, {"$set": {
        "reviewer_status": data.decision,
        "reviewer_admin_comment": data.comment,
        "reviewed_by": user["id"], "reviewed_at": now_iso(), "updated_at": now_iso(),
    }})
    await db.reviewer_applications.update_one({"reviewer_id": reviewer_id}, {"$set": {
        "status": data.decision, "comment": data.comment, "reviewed_by": user["id"],
        "reviewed_at": now_iso(), "updated_at": now_iso(),
    }})
    document_status = {
        "approved": "approved",
        "changes_requested": "changes_requested",
        "rejected": "rejected",
        "suspended": "suspended",
    }[data.decision]
    await db.reviewer_documents.update_many(
        {"reviewer_id": reviewer_id},
        {"$set": {"status": document_status, "reviewed_at": now_iso(), "reviewed_by": user["id"]}},
    )

    title = "Reviewer profile update"
    message = data.comment or f"Your reviewer profile is {data.decision.replace('_', ' ')}."
    level = "success" if data.decision == "approved" else "error" if data.decision in {"rejected", "suspended"} else "warning"
    await _notify(reviewer_id, f"reviewer-decision-{data.decision}-{now_iso()[:19]}", title, message, level)

    if reviewer.get("email"):
        if data.decision == "approved":
            login_url = f"{os.getenv('FRONTEND_URL', '').rstrip('/')}/portal/login"
            welcome = (data.welcome_message or data.comment or "Welcome to the ClimateWallah reviewer network.").strip()
            public_id = reviewer.get("public_id") or "Your reviewer ID"
            plain = (
                f"Hello {reviewer.get('name') or 'Reviewer'},\n\n"
                "Your ClimateWallah reviewer account has been approved.\n\n"
                f"Reviewer ID: {public_id}\nRegistered email: {reviewer['email']}\nLogin: {login_url}\n\n"
                f"{welcome}\n\nUse your registration password to sign in. For security, passwords are never sent by email."
            )
            html = (
                f"<div style='font-family:Arial,sans-serif;color:#172033'>"
                f"<h2>Reviewer account approved</h2><p>Hello {reviewer.get('name') or 'Reviewer'},</p>"
                f"<p>{welcome}</p><p><strong>Reviewer ID:</strong> {public_id}<br>"
                f"<strong>Registered email:</strong> {reviewer['email']}<br>"
                f"<strong>Login URL:</strong> <a href='{login_url}'>{login_url}</a></p>"
                f"<p>Use your registration password to sign in. For security, your password is not included in this email.</p></div>"
            )
            attachments = []
            if data.welcome_pdf_id:
                att = await db.reviewer_welcome_attachments.find_one({"id": data.welcome_pdf_id}, {"_id": 0})
                if att:
                    stored = await storage.open_by_key(att["key"])
                    if stored:
                        attachments.append({"filename": att.get("filename") or "Reviewer-Welcome.pdf", "content_type": "application/pdf", "content": stored[0]})
            await send_email(reviewer["email"], "ClimateWallah reviewer account approved", plain, html, attachments)
        else:
            await send_email(
                reviewer["email"], "ClimateWallah reviewer profile update",
                message,
                f"<p>Your reviewer profile is <strong>{data.decision.replace('_', ' ')}</strong>.</p><p>{data.comment or ''}</p>",
            )
    return {"status": data.decision}


@marketplace.get("/admin/portal/audit-logs")
async def admin_audit_logs(limit: int = 300, user: dict = Depends(current_admin_portal)):
    limit = max(1, min(int(limit or 300), 1000))
    return await db.audit_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)


@marketplace.get("/admin/portal/billing-settings")
async def get_billing_settings(user: dict = Depends(current_admin_portal)):
    return await billing_settings()


@marketplace.put("/admin/portal/billing-settings")
async def put_billing_settings(payload: dict, user: dict = Depends(current_admin_portal_write)):
    allowed = {"gst_rate", "reviewer_monthly_plan_paise", "reviewer_project_earning_paise", "reviewer_plan_days", "area_tiers"}
    clean = {key: value for key, value in payload.items() if key in allowed}
    if not clean:
        raise HTTPException(400, "No supported billing settings supplied.")

    try:
        if "gst_rate" in clean:
            clean["gst_rate"] = float(clean["gst_rate"])
            if not 0 <= clean["gst_rate"] <= 100:
                raise ValueError
        for field in ("reviewer_monthly_plan_paise", "reviewer_project_earning_paise"):
            if field in clean:
                clean[field] = int(clean[field])
                if clean[field] < 0:
                    raise ValueError
        if "reviewer_plan_days" in clean:
            clean["reviewer_plan_days"] = int(clean["reviewer_plan_days"])
            if clean["reviewer_plan_days"] < 1 or clean["reviewer_plan_days"] > 366:
                raise ValueError
        if "area_tiers" in clean:
            tiers = clean["area_tiers"]
            if not isinstance(tiers, list) or not tiers:
                raise ValueError
            seen_ids = set()
            previous_max = 0
            normalised = []
            for tier in tiers:
                tier_id = str(tier.get("id") or "").strip()
                label = str(tier.get("label") or "").strip()
                maximum = int(tier.get("max_sqft"))
                base_paise = int(tier.get("base_paise"))
                if not tier_id or tier_id in seen_ids or not label or maximum <= previous_max or base_paise < 0:
                    raise ValueError
                seen_ids.add(tier_id)
                previous_max = maximum
                normalised.append({"id": tier_id, "label": label, "max_sqft": maximum, "base_paise": base_paise})
            clean["area_tiers"] = normalised
    except (TypeError, ValueError, AttributeError):
        raise HTTPException(400, "Billing settings are invalid. Check GST, amounts, plan days and ascending area tiers.")

    clean["updated_at"] = now_iso()
    await db.marketplace_settings.update_one({"id": "billing"}, {"$set": clean}, upsert=True)
    await record_audit(user, "billing_settings_updated", "billing_settings", "billing", "Billing and pricing settings updated", clean)
    return await billing_settings()


@marketplace.get("/admin/portal/earnings")
async def admin_earnings(user: dict = Depends(current_admin_portal)):
    rows = await db.reviewer_earnings.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    for row in rows:
        row["reviewer"] = await db.users.find_one({"id": row["reviewer_id"]}, {"_id": 0, "name": 1, "email": 1}) or {}
    return rows


@marketplace.get("/admin/portal/payouts")
async def admin_payouts(user: dict = Depends(current_admin_portal)):
    rows = await db.payouts.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    for row in rows:
        row["reviewer"] = await db.users.find_one(
            {"id": row["reviewer_id"]}, {"_id": 0, "name": 1, "email": 1}
        ) or {}
    return rows


@marketplace.get("/admin/portal/transactions")
async def admin_transactions(user: dict = Depends(current_admin_portal)):
    rows = await db.payment_orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(3000)
    for row in rows:
        owner = await db.users.find_one({"id": row.get("owner_id")}, {"_id": 0, "name": 1, "email": 1, "public_id": 1, "role": 1}) or {}
        row["owner"] = owner
    return rows


@marketplace.get("/admin/portal/payment-settings")
async def admin_payment_settings(user: dict = Depends(current_admin_portal)):
    return await payment_settings()


@marketplace.put("/admin/portal/payment-settings")
async def admin_save_payment_settings(data: PaymentGatewaySettingsInput, user: dict = Depends(current_admin_portal_write)):
    payload = data.model_dump()
    upi = (payload.get("upi_id") or "").strip()
    if payload.get("qr_enabled") and not re.fullmatch(r"[a-zA-Z0-9._-]{2,}@[a-zA-Z0-9._-]{2,}", upi):
        raise HTTPException(400, "Enter a valid UPI ID before enabling QR / UPI payments.")
    current = await payment_settings(include_secrets=True)
    has_key_id = bool((payload.get("key_id") or "").strip() or (current.get("credentials") or {}).get("key_id"))
    has_key_secret = bool((payload.get("key_secret") or "").strip() or (current.get("credentials") or {}).get("key_secret"))
    if payload.get("razorpay_enabled") and not (has_key_id and has_key_secret):
        raise HTTPException(400, "Razorpay Key ID and Key Secret are required before enabling Razorpay.")
    payload["updated_at"] = now_iso()
    saved = await save_payment_settings(payload)
    await record_audit(user, "payment_settings_updated", "payment_settings", "payment_gateways", "Payment gateway settings updated", {"razorpay_enabled": payload.get("razorpay_enabled"), "qr_enabled": payload.get("qr_enabled"), "upi_id": payload.get("upi_id"), "payee_name": payload.get("payee_name")})
    return saved


@marketplace.post("/admin/portal/payment-settings/test-razorpay")
async def admin_test_razorpay(user: dict = Depends(current_admin_portal_write)):
    settings = await payment_settings(include_secrets=True)
    credentials = settings.get("credentials") or {}
    if not razorpay_configured(credentials):
        raise HTTPException(400, "Razorpay credentials are not configured.")
    try:
        await razorpay_test_connection(credentials)
    except Exception as exc:
        raise HTTPException(502, f"Razorpay connection failed: {str(exc)[:250]}")
    return {"connected": True}


@marketplace.post("/admin/portal/payment-settings/qr-image")
async def admin_upload_payment_qr(file: UploadFile = File(...), user: dict = Depends(current_admin_portal_write)):
    extension = os.path.splitext(file.filename or "")[1].lower()
    if extension not in {".png", ".jpg", ".jpeg", ".webp"}:
        raise HTTPException(400, "Upload a PNG, JPG, JPEG or WEBP QR image.")
    content = await file.read()
    if not content or len(content) > 5 * 1024 * 1024:
        raise HTTPException(400, "QR image is empty or larger than 5 MB.")
    key = f"payment/qr{extension}"
    await storage.save_bytes(key, content, file.content_type or "image/png", file.filename, {"uploaded_by": user["id"]})
    url = f"/api/uploads/{key}"
    await db.marketplace_settings.update_one({"id": "payment_gateways"}, {"$set": {"qr_image_url": url, "updated_at": now_iso()}}, upsert=True)
    return {"qr_image_url": url}


@marketplace.post("/admin/portal/transactions/{transaction_id}/approve")
async def admin_approve_qr_payment(transaction_id: str, data: PaymentDecisionInput, user: dict = Depends(current_admin_portal_write)):
    order = await db.payment_orders.find_one({"id": transaction_id, "provider": "qr_upi"}, {"_id": 0})
    if not order:
        raise HTTPException(404, "QR / UPI transaction not found.")
    if order.get("status") == "paid":
        return {"status": "paid"}
    if order.get("status") != "verification_pending":
        raise HTTPException(409, "Only a payment awaiting verification can be approved.")
    utr = order.get("transaction_id")
    if not utr:
        raise HTTPException(409, "Transaction reference is missing.")
    await _apply_paid_order(order, utr)
    await db.payment_orders.update_one({"id": transaction_id}, {"$set": {"verified_by": user["id"], "verification_notes": data.notes, "verified_at": now_iso()}})
    await _notify(order["owner_id"], f"payment-approved-{transaction_id}", "Payment verified", "Your QR / UPI payment has been verified successfully.", "success")
    await record_audit(user, "qr_payment_approved", "payment_order", transaction_id, "QR / UPI payment approved", {"owner_id": order.get("owner_id"), "amount_paise": order.get("amount_paise"), "utr": utr})
    return {"status": "paid"}


@marketplace.post("/admin/portal/transactions/{transaction_id}/reject")
async def admin_reject_qr_payment(transaction_id: str, data: PaymentDecisionInput, user: dict = Depends(current_admin_portal_write)):
    order = await db.payment_orders.find_one({"id": transaction_id, "provider": "qr_upi"}, {"_id": 0})
    if not order:
        raise HTTPException(404, "QR / UPI transaction not found.")
    if order.get("status") != "verification_pending":
        raise HTTPException(409, "Only a payment awaiting verification can be rejected.")
    await db.payment_orders.update_one({"id": transaction_id}, {"$set": {
        "status": "rejected", "rejected_by": user["id"], "verification_notes": data.notes, "rejected_at": now_iso(), "updated_at": now_iso()
    }})
    await _notify(order["owner_id"], f"payment-rejected-{transaction_id}", "Payment verification required",
                  data.notes or "Your QR / UPI payment could not be verified. Please check the transaction and submit again.", "warning")
    await record_audit(user, "qr_payment_rejected", "payment_order", transaction_id, "QR / UPI payment rejected", {"owner_id": order.get("owner_id"), "notes": data.notes})
    return {"status": "rejected"}


@marketplace.post("/admin/portal/payouts")
async def admin_create_payout(data: PayoutInput, user: dict = Depends(current_admin_portal_write)):
    reviewer = await db.users.find_one({"id": data.reviewer_id, "role": "reviewer"})
    if not reviewer:
        raise HTTPException(404, "Reviewer not found")
    query = {"reviewer_id": data.reviewer_id, "status": "approved"}
    if data.earning_ids:
        query["id"] = {"$in": data.earning_ids}
    earnings = await db.reviewer_earnings.find(query, {"_id": 0}).to_list(1000)
    if not earnings:
        raise HTTPException(409, "No approved unpaid earnings selected for this payout.")
    profile = reviewer.get("payout_profile") or {}
    if not profile.get("encrypted"):
        raise HTTPException(409, "Reviewer payout details are missing.")

    payout_id = str(uuid.uuid4())
    selected_ids = [item["id"] for item in earnings]
    await db.reviewer_earnings.update_many({"id": {"$in": selected_ids}, "reviewer_id": reviewer["id"], "status": "approved"},
                                          {"$set": {"status": "processing", "payout_id": payout_id, "payout_reserved_at": now_iso()}})
    claimed = await db.reviewer_earnings.find({"payout_id": payout_id, "status": "processing"}, {"_id": 0}).to_list(1000)
    if not claimed:
        raise HTTPException(409, "Selected earnings are already included in another payout.")
    amount = sum(item.get("gross_paise", item.get("base_paise", 0)) for item in claimed)
    gateway = await payment_settings(include_secrets=True)
    credentials = gateway.get("credentials") or {}
    provider_ready = razorpay_configured(credentials) and bool(os.getenv("RAZORPAYX_ACCOUNT_NUMBER"))
    payout = {
        "id": payout_id, "reviewer_id": reviewer["id"], "earning_ids": [item["id"] for item in claimed],
        "amount_paise": amount, "status": "creating" if provider_ready else "awaiting_manual_transfer",
        "provider": "razorpayx" if provider_ready else "manual", "razorpay_payout_id": None,
        "notes": data.notes, "created_by": user["id"], "created_at": now_iso(), "updated_at": now_iso(),
    }
    try:
        await db.payouts.insert_one(copy.deepcopy(payout))
    except Exception:
        await db.reviewer_earnings.update_many({"payout_id": payout_id, "status": "processing"},
            {"$set": {"status": "approved", "updated_at": now_iso()}, "$unset": {"payout_id": "", "payout_reserved_at": ""}})
        raise HTTPException(500, "Could not create the payout batch. Earnings were safely released.")

    if provider_ready:
        try:
            sensitive = decrypt_json(profile["encrypted"])
            contact_id = profile.get("razorpay_contact_id")
            fund_id = profile.get("razorpay_fund_account_id")
            if not contact_id:
                contact = await create_contact(reviewer["name"], reviewer["email"], reviewer.get("phone"), reviewer["id"], credentials)
                contact_id = contact["id"]
            if not fund_id:
                fund = await create_fund_account(contact_id, sensitive, credentials)
                fund_id = fund["id"]
            provider_result = await create_payout(fund_id, amount, payout_id, "ClimateWallah review", credentials)
            payout["razorpay_payout_id"] = provider_result.get("id")
            payout["status"] = provider_result.get("status", "processing")
            await db.users.update_one({"id": reviewer["id"]}, {"$set": {"payout_profile.razorpay_contact_id": contact_id, "payout_profile.razorpay_fund_account_id": fund_id}})
            await db.payouts.update_one({"id": payout_id}, {"$set": {"status": payout["status"], "razorpay_payout_id": payout["razorpay_payout_id"], "updated_at": now_iso()}})
        except Exception as exc:
            await db.payouts.update_one({"id": payout_id}, {"$set": {"status": "failed", "failure_reason": str(exc)[:500], "updated_at": now_iso()}})
            await db.reviewer_earnings.update_many({"payout_id": payout_id, "status": "processing"},
                {"$set": {"status": "approved", "updated_at": now_iso()}, "$unset": {"payout_id": "", "payout_reserved_at": ""}})
            raise HTTPException(502, "Payout provider failed. Earnings were released for a safe retry.")
    await _notify(reviewer["id"], f"payout-created-{payout_id}", "Payout initiated", f"A payout of ₹{amount/100:,.2f} has been initiated.", "info")
    return payout


@marketplace.post("/admin/portal/payouts/{payout_id}/mark-paid")
async def mark_payout_paid(payout_id: str, data: ManualPaidInput, user: dict = Depends(current_admin_portal_write)):
    payout = await db.payouts.find_one({"id": payout_id}, {"_id": 0})
    if not payout:
        raise HTTPException(404, "Payout not found")
    if payout.get("status") == "processed":
        return {"status": "processed"}
    if payout.get("status") != "awaiting_manual_transfer":
        raise HTTPException(409, "Only a manual-transfer payout can be marked as paid here.")
    await db.payouts.update_one({"id": payout_id}, {"$set": {"status": "processed", "utr": data.utr,
                                                                 "notes": data.notes or payout.get("notes"),
                                                                 "paid_at": now_iso(), "updated_at": now_iso()}})
    await db.reviewer_earnings.update_many(
        {"id": {"$in": payout["earning_ids"]}, "payout_id": payout_id, "status": "processing"},
        {"$set": {"status": "paid", "paid_at": now_iso()}},
    )
    await _notify(payout["reviewer_id"], f"payout-{payout_id}", "Payout completed",
                  f"Your payout of ₹{payout['amount_paise'] / 100:,.2f} has been processed. UTR: {data.utr}", "success")
    return {"status": "processed"}


@marketplace.post("/webhooks/razorpayx")
async def razorpayx_webhook(request: Request):
    body = await request.body()
    if not verify_webhook(body, request.headers.get("X-Razorpay-Signature", ""), payout=True):
        raise HTTPException(400, "Invalid webhook signature")
    payload = json.loads(body)
    entity = (((payload.get("payload") or {}).get("payout") or {}).get("entity") or {})
    provider_id = entity.get("id")
    payout = await db.payouts.find_one({"razorpay_payout_id": provider_id}, {"_id": 0})
    if payout:
        status = entity.get("status", "processing")
        await db.payouts.update_one({"id": payout["id"]}, {"$set": {"status": status, "utr": entity.get("utr"), "updated_at": now_iso()}})
        if status == "processed":
            await db.reviewer_earnings.update_many(
                {"id": {"$in": payout["earning_ids"]}, "payout_id": payout["id"], "status": "processing"},
                {"$set": {"status": "paid", "paid_at": now_iso()}},
            )
            await _notify(
                payout["reviewer_id"], f"payout-{payout['id']}", "Payout completed",
                f"Your payout of ₹{payout['amount_paise'] / 100:,.2f} has been processed.", "success",
            )
        elif status in {"failed", "rejected", "cancelled", "reversed"}:
            await db.reviewer_earnings.update_many(
                {"payout_id": payout["id"], "status": "processing"},
                {"$set": {"status": "approved", "updated_at": now_iso()},
                 "$unset": {"payout_id": "", "payout_reserved_at": ""}},
            )
            await _notify(
                payout["reviewer_id"], f"payout-failed-{payout['id']}", "Payout needs attention",
                "The bank payout did not complete. Your earnings remain available for a safe retry.", "warning",
            )
    return {"received": True}
