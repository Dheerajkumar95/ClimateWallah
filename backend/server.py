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
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field, field_validator

from database import db, create_indexes, IMAGE_DIR, DOC_DIR
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
    if coll not in ("services", "projects", "team_members", "blog_posts"):
        raise HTTPException(400, "Invalid collection")
    for i, _id in enumerate(data.ids):
        await db[coll].update_one({"id": _id}, {"$set": {"display_order": i}})
    return {"message": "Reordered"}


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
    (IMAGE_DIR / fname).write_bytes(content)
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
        try:
            (IMAGE_DIR / doc["filename"]).unlink(missing_ok=True)
        except Exception:
            pass
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
    (DOC_DIR / fname).write_bytes(content)
    url = f"{BACKEND_URL}/api/uploads/documents/{fname}"
    doc = {"id": "capability", "filename": fname, "url": url, "size": len(content),
           "original_name": file.filename, "updated_at": now_iso()}
    old = await db.documents.find_one({"id": "capability"})
    if old and old.get("filename"):
        try:
            (DOC_DIR / old["filename"]).unlink(missing_ok=True)
        except Exception:
            pass
    await db.documents.update_one({"id": "capability"}, {"$set": doc}, upsert=True)
    return clean(doc)


@api.get("/admin/capability-profile")
async def admin_capability(admin: dict = Depends(get_current_admin)):
    return await db.documents.find_one({"id": "capability"}, {"_id": 0}) or {}


# ---------------- Dashboard ----------------
@api.get("/admin/dashboard")
async def dashboard(admin: dict = Depends(get_current_admin)):
    recent = await db.enquiries.find({}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    return {
        "total_projects": await db.projects.count_documents({}),
        "published_projects": await db.projects.count_documents({"status": "published"}),
        "total_services": await db.services.count_documents({}),
        "total_team": await db.team_members.count_documents({}),
        "total_blogs": await db.blog_posts.count_documents({}),
        "draft_blogs": await db.blog_posts.count_documents({"status": "draft"}),
        "total_enquiries": await db.enquiries.count_documents({}),
        "new_enquiries": await db.enquiries.count_documents({"status": "New"}),
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
app.mount("/api/uploads", StaticFiles(directory=str(ROOT_DIR / "uploads")), name="uploads")

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
