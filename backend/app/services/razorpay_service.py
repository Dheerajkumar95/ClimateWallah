"""Razorpay/RazorpayX client with runtime credentials and signature verification."""
from __future__ import annotations

import hashlib
import hmac
import os

import httpx

API_BASE = "https://api.razorpay.com/v1"


def _fallback_credentials() -> dict:
    return {
        "key_id": os.getenv("RAZORPAY_KEY_ID", "").strip(),
        "key_secret": os.getenv("RAZORPAY_KEY_SECRET", "").strip(),
        "payment_webhook_secret": os.getenv("RAZORPAY_PAYMENT_WEBHOOK_SECRET", "").strip(),
    }


def _credentials(credentials: dict | None = None) -> dict:
    return {**_fallback_credentials(), **(credentials or {})}


def configured(credentials: dict | None = None) -> bool:
    creds = _credentials(credentials)
    return bool(creds.get("key_id") and creds.get("key_secret"))


def public_key(credentials: dict | None = None) -> str:
    return _credentials(credentials).get("key_id", "")


async def _request(method: str, path: str, *, json: dict, headers: dict | None = None, credentials: dict | None = None) -> dict:
    creds = _credentials(credentials)
    if not configured(creds):
        raise RuntimeError("Razorpay is not configured on the server.")
    async with httpx.AsyncClient(timeout=30, auth=(creds["key_id"], creds["key_secret"])) as client:
        response = await client.request(method, f"{API_BASE}{path}", json=json, headers=headers)
    if response.is_error:
        try:
            detail = response.json().get("error", {}).get("description")
        except Exception:
            detail = None
        raise RuntimeError(detail or f"Razorpay request failed ({response.status_code}).")
    return response.json()


async def test_connection(credentials: dict | None = None) -> bool:
    creds = _credentials(credentials)
    if not configured(creds):
        return False
    async with httpx.AsyncClient(timeout=15, auth=(creds["key_id"], creds["key_secret"])) as client:
        response = await client.get(f"{API_BASE}/orders", params={"count": 1})
    if response.is_error:
        try:
            detail = response.json().get("error", {}).get("description")
        except Exception:
            detail = None
        raise RuntimeError(detail or f"Razorpay connection failed ({response.status_code}).")
    return True


async def create_order(amount_paise: int, receipt: str, notes: dict, credentials: dict | None = None) -> dict:
    return await _request("POST", "/orders", json={
        "amount": int(amount_paise),
        "currency": "INR",
        "receipt": receipt[:40],
        "notes": {str(key): str(value)[:255] for key, value in (notes or {}).items()},
    }, credentials=credentials)


def verify_checkout_signature(order_id: str, payment_id: str, signature: str, credentials: dict | None = None) -> bool:
    secret = _credentials(credentials).get("key_secret", "")
    if not secret or not all([order_id, payment_id, signature]):
        return False
    digest = hmac.new(secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature)


def verify_webhook(body: bytes, signature: str, *, payout: bool = False, credentials: dict | None = None) -> bool:
    if payout:
        secret = os.getenv("RAZORPAYX_WEBHOOK_SECRET", "").strip()
    else:
        secret = _credentials(credentials).get("payment_webhook_secret", "")
    if not secret or not signature:
        return False
    digest = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature)


async def create_contact(name: str, email: str, phone: str | None, reference_id: str, credentials: dict | None = None) -> dict:
    payload = {"name": name, "email": email, "type": "vendor", "reference_id": reference_id[:40]}
    if phone:
        payload["contact"] = phone
    return await _request("POST", "/contacts", json=payload, credentials=credentials)


async def create_fund_account(contact_id: str, bank: dict, credentials: dict | None = None) -> dict:
    if bank.get("upi_id"):
        return await _request("POST", "/fund_accounts", json={"contact_id": contact_id, "account_type": "vpa", "vpa": {"address": bank["upi_id"]}}, credentials=credentials)
    return await _request("POST", "/fund_accounts", json={
        "contact_id": contact_id,
        "account_type": "bank_account",
        "bank_account": {"name": bank["account_holder_name"], "ifsc": bank["ifsc"], "account_number": bank["account_number"]},
    }, credentials=credentials)


async def create_payout(fund_account_id: str, amount_paise: int, reference_id: str, narration: str, credentials: dict | None = None) -> dict:
    account_number = os.getenv("RAZORPAYX_ACCOUNT_NUMBER", "").strip()
    if not account_number:
        raise RuntimeError("RAZORPAYX_ACCOUNT_NUMBER is not configured.")
    return await _request("POST", "/payouts", json={
        "account_number": account_number,
        "fund_account_id": fund_account_id,
        "amount": int(amount_paise),
        "currency": "INR",
        "mode": "IMPS",
        "purpose": "payout",
        "queue_if_low_balance": True,
        "reference_id": reference_id[:40],
        "narration": narration[:30],
    }, headers={"X-Payout-Idempotency": reference_id}, credentials=credentials)
