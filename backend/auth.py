import os
import secrets
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
from fastapi import HTTPException, Request, Response, Depends

from database import db

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "480"))
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "true").lower() == "true"

MAX_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(admin_id: str) -> str:
    payload = {
        "sub": admin_id,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, token: str, csrf: str):
    response.set_cookie(
        key="access_token", value=token, httponly=True, secure=COOKIE_SECURE,
        samesite="lax", max_age=JWT_EXPIRE_MINUTES * 60, path="/",
    )
    response.set_cookie(
        key="csrf_token", value=csrf, httponly=False, secure=COOKIE_SECURE,
        samesite="lax", max_age=JWT_EXPIRE_MINUTES * 60, path="/",
    )


def clear_auth_cookies(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("csrf_token", path="/")


def new_csrf_token() -> str:
    return secrets.token_urlsafe(32)


async def get_current_admin(request: Request) -> dict:
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
        admin = await db.admins.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not admin:
            raise HTTPException(status_code=401, detail="Not authenticated")
        return admin
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Not authenticated")


async def verify_csrf(request: Request):
    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        header = request.headers.get("X-CSRF-Token")
        cookie = request.cookies.get("csrf_token")
        if not header or not cookie or header != cookie:
            raise HTTPException(status_code=403, detail="Invalid CSRF token")


async def admin_write(request: Request, admin: dict = Depends(get_current_admin)):
    await verify_csrf(request)
    return admin


async def check_lockout(identifier: str):
    rec = await db.login_attempts.find_one({"identifier": identifier})
    if rec and rec.get("count", 0) >= MAX_ATTEMPTS:
        locked_until = rec.get("locked_until")
        if locked_until and datetime.fromisoformat(locked_until) > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")


async def register_failed(identifier: str):
    rec = await db.login_attempts.find_one({"identifier": identifier})
    count = (rec.get("count", 0) if rec else 0) + 1
    update = {"count": count}
    if count >= MAX_ATTEMPTS:
        update["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)).isoformat()
    await db.login_attempts.update_one({"identifier": identifier}, {"$set": update}, upsert=True)


async def clear_attempts(identifier: str):
    await db.login_attempts.delete_one({"identifier": identifier})
