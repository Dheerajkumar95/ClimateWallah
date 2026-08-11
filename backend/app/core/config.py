"""Centralised runtime configuration for the RES backend.

Values are sourced from environment variables only (no hardcoded fallbacks for
secrets/URLs so missing config fails fast where it matters).
"""
import os

BACKEND_URL = os.environ.get("FRONTEND_URL", "")

UPLOAD_MAX_SIZE_MB = int(os.environ.get("UPLOAD_MAX_SIZE_MB", "15"))
MAX_UPLOAD_BYTES = UPLOAD_MAX_SIZE_MB * 1024 * 1024

# GridFS bucket that backs every file served under /api/uploads/*
GRIDFS_BUCKET = "uploads_fs"

ALLOWED_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
ALLOWED_DOC_TYPES = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/msword": ".doc",
}
ALLOWED_UPLOAD_EXT = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv",
                      ".png", ".jpg", ".jpeg", ".webp", ".dwg", ".zip"}
