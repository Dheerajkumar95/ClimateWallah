"""Small, append-only audit trail helper for production admin actions."""
from __future__ import annotations
import copy
import uuid
from database import db
from seed import now_iso

SENSITIVE_KEYS = {"key_secret", "payment_webhook_secret", "password", "password_hash", "encrypted", "account_number"}

def _safe(value):
    if isinstance(value, dict):
        return {k: ("***" if k in SENSITIVE_KEYS else _safe(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [_safe(v) for v in value]
    return value

async def record_audit(actor: dict | None, action: str, entity_type: str, entity_id: str | None = None,
                       summary: str | None = None, metadata: dict | None = None) -> None:
    actor = actor or {}
    row = {
        "id": str(uuid.uuid4()),
        "actor_id": actor.get("id"),
        "actor_email": actor.get("email"),
        "actor_role": actor.get("role") or "admin",
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "summary": summary or action.replace("_", " ").title(),
        "metadata": _safe(copy.deepcopy(metadata or {})),
        "created_at": now_iso(),
    }
    await db.audit_logs.insert_one(row)
