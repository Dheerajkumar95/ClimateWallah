"""GridFS-backed file storage.

All uploaded files (images, documents, capability PDFs, project evidence, and
generated certificates) live in a single GridFS bucket. Files are keyed by a
path-like ``key`` (e.g. ``images/<uuid>.png``, ``evidence/<pid>/<uuid>.pdf``)
so existing public URLs (``/api/uploads/<key>``) keep working unchanged.
"""
import logging
from typing import Optional, Tuple

from motor.motor_asyncio import AsyncIOMotorGridFSBucket

from database import db
from app.core.config import GRIDFS_BUCKET

logger = logging.getLogger(__name__)

bucket = AsyncIOMotorGridFSBucket(db, bucket_name=GRIDFS_BUCKET)
_files_coll = db[f"{GRIDFS_BUCKET}.files"]


async def save_bytes(key: str, content: bytes, content_type: str,
                     original_name: Optional[str] = None, metadata: Optional[dict] = None) -> str:
    """Store ``content`` under ``key``, replacing any previous version. Returns the GridFS id."""
    await delete_by_key(key)
    meta = {"contentType": content_type or "application/octet-stream",
            "originalName": original_name or key.rsplit("/", 1)[-1]}
    if metadata:
        meta.update(metadata)
    file_id = await bucket.upload_from_stream(key, content, metadata=meta)
    return str(file_id)


async def open_by_key(key: str) -> Optional[Tuple[bytes, dict]]:
    """Return ``(bytes, file_doc)`` for ``key`` or ``None`` when it does not exist."""
    doc = await _files_coll.find_one({"filename": key})
    if not doc:
        return None
    stream = await bucket.open_download_stream(doc["_id"])
    try:
        data = await stream.read()
    finally:
        try:
            stream.close()
        except Exception:
            pass
    return data, doc


async def delete_by_key(key: str) -> int:
    """Delete every stored version of ``key``. Returns how many were removed."""
    removed = 0
    async for doc in _files_coll.find({"filename": key}):
        try:
            await bucket.delete(doc["_id"])
            removed += 1
        except Exception as e:  # pragma: no cover
            logger.warning(f"gridfs delete failed for {key}: {e}")
    return removed


async def exists(key: str) -> bool:
    return (await _files_coll.find_one({"filename": key}, {"_id": 1})) is not None
