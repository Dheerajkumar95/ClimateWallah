"""Admin-managed production payment gateway settings."""
from __future__ import annotations

import os
from database import db
from app.services.secure_data import decrypt_json, encrypt_json


DEFAULTS = {
    "id": "payment_gateways",
    "razorpay_enabled": False,
    "qr_enabled": False,
    "upi_id": "",
    "payee_name": "",
    "qr_image_url": "",
}


def _env_credentials() -> dict:
    return {
        "key_id": os.getenv("RAZORPAY_KEY_ID", "").strip(),
        "key_secret": os.getenv("RAZORPAY_KEY_SECRET", "").strip(),
        "payment_webhook_secret": os.getenv("RAZORPAY_PAYMENT_WEBHOOK_SECRET", "").strip(),
    }


async def payment_settings(include_secrets: bool = False) -> dict:
    row = await db.marketplace_settings.find_one({"id": "payment_gateways"}, {"_id": 0}) or {}
    result = {**DEFAULTS, **row}
    secret = decrypt_json(result.get("credentials_encrypted", "")) if result.get("credentials_encrypted") else {}
    # Existing .env credentials remain a deployment fallback until Admin saves credentials.
    env = _env_credentials()
    credentials = {
        "key_id": secret.get("key_id") or env.get("key_id") or "",
        "key_secret": secret.get("key_secret") or env.get("key_secret") or "",
        "payment_webhook_secret": secret.get("payment_webhook_secret") or env.get("payment_webhook_secret") or "",
    }
    result["razorpay_configured"] = bool(credentials["key_id"] and credentials["key_secret"])
    result["key_id_masked"] = mask_secret(credentials["key_id"], keep_start=6, keep_end=4)
    result["key_secret_masked"] = mask_secret(credentials["key_secret"])
    result["webhook_secret_masked"] = mask_secret(credentials["payment_webhook_secret"])
    result.pop("credentials_encrypted", None)
    if include_secrets:
        result["credentials"] = credentials
    return result


def mask_secret(value: str, keep_start: int = 0, keep_end: int = 4) -> str:
    value = (value or "").strip()
    if not value:
        return ""
    if len(value) <= keep_start + keep_end:
        return "•" * len(value)
    return f"{value[:keep_start]}{'•' * max(8, len(value) - keep_start - keep_end)}{value[-keep_end:]}"


async def save_payment_settings(payload: dict) -> dict:
    current = await db.marketplace_settings.find_one({"id": "payment_gateways"}, {"_id": 0}) or {}
    existing_secret = decrypt_json(current.get("credentials_encrypted", "")) if current.get("credentials_encrypted") else {}
    env = _env_credentials()
    existing_secret = {
        "key_id": existing_secret.get("key_id") or env.get("key_id") or "",
        "key_secret": existing_secret.get("key_secret") or env.get("key_secret") or "",
        "payment_webhook_secret": existing_secret.get("payment_webhook_secret") or env.get("payment_webhook_secret") or "",
    }
    for field in ("key_id", "key_secret", "payment_webhook_secret"):
        value = payload.get(field)
        if value is not None and str(value).strip():
            existing_secret[field] = str(value).strip()

    clean = {
        "razorpay_enabled": bool(payload.get("razorpay_enabled", False)),
        "qr_enabled": bool(payload.get("qr_enabled", False)),
        "upi_id": str(payload.get("upi_id") or "").strip(),
        "payee_name": str(payload.get("payee_name") or "").strip(),
        "qr_image_url": str(payload.get("qr_image_url") or "").strip(),
        "credentials_encrypted": encrypt_json(existing_secret),
        "updated_at": payload.get("updated_at"),
    }
    await db.marketplace_settings.update_one({"id": "payment_gateways"}, {"$set": clean}, upsert=True)
    return await payment_settings()
