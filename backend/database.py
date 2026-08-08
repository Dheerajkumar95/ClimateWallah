import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

UPLOAD_DIR = ROOT_DIR / "uploads"
IMAGE_DIR = UPLOAD_DIR / "images"
DOC_DIR = UPLOAD_DIR / "documents"
for d in (IMAGE_DIR, DOC_DIR):
    d.mkdir(parents=True, exist_ok=True)


async def create_indexes():
    await db.admins.create_index("login_id", unique=True)
    await db.admins.create_index("email", unique=True)
    await db.services.create_index("slug", unique=True)
    await db.projects.create_index("slug", unique=True)
    await db.blog_posts.create_index("slug", unique=True)
    await db.login_attempts.create_index("identifier")
