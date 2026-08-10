"""Role-based auth helpers for the Client Certification Portal.

Roles: admin (db.admins) | client / reviewer (db.users). Reuses the same
HTTP-only cookie + CSRF scheme as the existing admin auth.
"""
import jwt
from fastapi import HTTPException, Request, Depends

from auth import JWT_SECRET, JWT_ALGORITHM, verify_csrf
from database import db


async def get_current_user(request: Request) -> dict:
    """Return the authenticated principal (admin, client or reviewer) with a `role`."""
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token")
        role = payload.get("role", "admin")
        sub = payload["sub"]
        if role == "admin":
            doc = await db.admins.find_one({"id": sub}, {"_id": 0, "password_hash": 0})
            if not doc:
                raise HTTPException(status_code=401, detail="Not authenticated")
            doc["role"] = "admin"
            return doc
        doc = await db.users.find_one({"id": sub}, {"_id": 0, "password_hash": 0})
        if not doc or not doc.get("active", True):
            raise HTTPException(status_code=401, detail="Not authenticated")
        return doc
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Not authenticated")


def require_role(*roles: str):
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return dep


def require_role_write(*roles: str):
    async def dep(request: Request, user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        await verify_csrf(request)
        return user
    return dep


current_client = require_role("client")
current_client_write = require_role_write("client")
current_reviewer = require_role("reviewer")
current_reviewer_write = require_role_write("reviewer")
current_admin_portal = require_role("admin")
current_admin_portal_write = require_role_write("admin")
