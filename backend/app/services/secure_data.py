"""Encryption helper for reviewer payout details stored in MongoDB."""
import base64
import hashlib
import json
import os

from cryptography.fernet import Fernet, InvalidToken
from auth import JWT_SECRET


def _key() -> bytes:
    configured = os.getenv("DATA_ENCRYPTION_KEY", "").strip()
    if configured:
        return configured.encode()
    # Development-compatible fallback. Production documentation requires a
    # dedicated Fernet key so JWT rotation does not make payout data unreadable.
    return base64.urlsafe_b64encode(hashlib.sha256(JWT_SECRET.encode()).digest())


def encrypt_json(value: dict) -> str:
    return Fernet(_key()).encrypt(json.dumps(value).encode()).decode()


def decrypt_json(token: str) -> dict:
    try:
        return json.loads(Fernet(_key()).decrypt(token.encode()).decode())
    except (InvalidToken, ValueError, TypeError):
        return {}
