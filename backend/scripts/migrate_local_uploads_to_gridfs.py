"""Migrate any legacy local-disk uploads into MongoDB GridFS.

Walks ``backend/uploads/{images,documents,certificates,evidence}`` and stores
every file in GridFS under its path-like key so existing ``/api/uploads/*`` URLs
resolve from the database. Idempotent: files already present are skipped.

Self-contained (own Motor client) so it can be run standalone via asyncio.run.

Usage:
    python -m scripts.migrate_local_uploads_to_gridfs           # migrate only
    python -m scripts.migrate_local_uploads_to_gridfs --purge   # migrate + delete disk copies
"""
import asyncio
import mimetypes
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket

ROOT_DIR = Path(__file__).resolve().parent.parent  # backend/
load_dotenv(ROOT_DIR / ".env")

UPLOAD_DIR = ROOT_DIR / "uploads"
SCOPES = ["images", "documents", "certificates", "evidence"]
BUCKET = "uploads_fs"


async def migrate(purge: bool = False) -> None:
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    bucket = AsyncIOMotorGridFSBucket(db, bucket_name=BUCKET)
    files_coll = db[f"{BUCKET}.files"]

    migrated = skipped = 0
    if not UPLOAD_DIR.exists():
        print("No uploads directory found — nothing to migrate.")
        client.close()
        return
    for scope in SCOPES:
        base = UPLOAD_DIR / scope
        if not base.exists():
            continue
        for path in sorted(base.rglob("*")):
            if not path.is_file():
                continue
            key = path.relative_to(UPLOAD_DIR).as_posix()
            if await files_coll.find_one({"filename": key}, {"_id": 1}):
                skipped += 1
                continue
            ctype = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
            await bucket.upload_from_stream(
                key, path.read_bytes(),
                metadata={"contentType": ctype, "originalName": path.name},
            )
            migrated += 1
            print(f"  migrated {key}")
            if purge:
                path.unlink(missing_ok=True)
    print(f"\nDone. migrated={migrated} skipped(existing)={skipped} purge={purge}")
    client.close()


if __name__ == "__main__":
    asyncio.run(migrate(purge="--purge" in sys.argv))
