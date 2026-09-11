"""Atomic human-readable account ID generation for portal users."""
from pymongo import ReturnDocument
from database import db


async def next_public_id(kind: str) -> str:
    kind = (kind or '').strip().lower()
    if kind not in {'client', 'reviewer'}:
        raise ValueError('Unsupported account ID kind')
    prefix = 'CLI' if kind == 'client' else 'REV'
    row = await db.counters.find_one_and_update(
        {'_id': f'public_id:{kind}'},
        {'$inc': {'seq': 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"{prefix}-{int(row.get('seq', 1)):06d}"

async def ensure_public_ids() -> None:
    """Backfill generated IDs for existing portal users without changing their internal UUIDs."""
    for kind, prefix in (("client", "CLI"), ("reviewer", "REV")):
        existing = await db.users.find(
            {"role": kind, "public_id": {"$regex": f"^{prefix}-[0-9]{{6,}}$"}},
            {"_id": 0, "public_id": 1},
        ).to_list(100000)
        highest = 0
        for row in existing:
            try:
                highest = max(highest, int(str(row.get("public_id", "")).split("-")[-1]))
            except (TypeError, ValueError):
                pass
        await db.counters.update_one(
            {"_id": f"public_id:{kind}"},
            {"$max": {"seq": highest}},
            upsert=True,
        )
        cursor = db.users.find({"role": kind, "$or": [{"public_id": {"$exists": False}}, {"public_id": None}, {"public_id": ""}]}, {"_id": 0, "id": 1})
        async for row in cursor:
            await db.users.update_one({"id": row["id"], "$or": [{"public_id": {"$exists": False}}, {"public_id": None}, {"public_id": ""}]}, {"$set": {"public_id": await next_public_id(kind)}})
    # Final marketplace rule: every reviewer needs an active plan for new assignments.
    # This preserves accounts/documents/history while removing the old grandfather bypass.
    await db.users.update_many(
        {"role": "reviewer", "requires_subscription": {"$ne": True}},
        {"$set": {"requires_subscription": True}},
    )

