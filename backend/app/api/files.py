"""Public file serving from GridFS.

Replaces the old ``StaticFiles`` disk mount. URL scheme is preserved so every
image/document/evidence reference already stored in the database keeps working.
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.services import storage

router = APIRouter(prefix="/api/uploads")


async def _serve(key: str) -> Response:
    result = await storage.open_by_key(key)
    if not result:
        raise HTTPException(status_code=404, detail="File not found")
    data, doc = result
    meta = doc.get("metadata") or {}
    ctype = meta.get("contentType", "application/octet-stream")
    original = meta.get("originalName", key.rsplit("/", 1)[-1])
    disposition = "inline" if ctype.startswith(("image/", "application/pdf")) else "attachment"
    return Response(
        content=data,
        media_type=ctype,
        headers={
            "Content-Disposition": f'{disposition}; filename="{original}"',
            "Cache-Control": "public, max-age=86400",
        },
    )


@router.get("/images/{filename}")
async def get_image(filename: str):
    return await _serve(f"images/{filename}")


@router.get("/documents/{filename}")
async def get_document(filename: str):
    return await _serve(f"documents/{filename}")


@router.get("/certificates/{filename}")
async def get_certificate(filename: str):
    return await _serve(f"certificates/{filename}")


@router.get("/evidence/{project_id}/{filename}")
async def get_evidence(project_id: str, filename: str):
    return await _serve(f"evidence/{project_id}/{filename}")
