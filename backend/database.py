import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

async def create_indexes():
    await db.admins.create_index("login_id", unique=True)
    await db.admins.create_index("email", unique=True)
    await db.services.create_index("slug", unique=True)
    await db.projects.create_index("slug", unique=True)
    await db.blog_posts.create_index("slug", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.users.create_index("email", unique=True)
    await db.users.create_index("public_id", unique=True, sparse=True)
    await db.users.create_index("role")
    await db.pending_registrations.create_index("email", unique=True)
    await db.pending_password_resets.create_index("user_id", unique=True)
    await db.certification_projects.create_index("client_id")
    await db.certification_projects.create_index("reviewer_id")
    await db.pending_reviewer_registrations.create_index("email", unique=True)
    await db.reviewer_applications.create_index("reviewer_id", unique=True)
    await db.reviewer_documents.create_index([("reviewer_id", 1), ("uploaded_at", -1)])
    await db.certification_types.create_index("code", unique=True)
    await db.certification_checklists.create_index(
        [("certification_code", 1), ("project_type", 1)], unique=True
    )
    await db.payment_orders.create_index(
    "razorpay_order_id",
    unique=True,
    partialFilterExpression={
        "razorpay_order_id": {"$type": "string"}
    }
)
    await db.payment_orders.create_index("transaction_id", unique=True, sparse=True)
    await db.payment_orders.create_index("request_key", unique=True, sparse=True)
    await db.payment_orders.create_index([("owner_id", 1), ("created_at", -1)])
    await db.reviewer_earnings.create_index(
        [("project_id", 1), ("reviewer_id", 1), ("kind", 1)], unique=True
    )
    await db.reviewer_earnings.create_index([("reviewer_id", 1), ("status", 1)])
    await db.payouts.create_index("id", unique=True)
    await db.payouts.create_index("razorpay_payout_id", unique=True, sparse=True)
    await db.notifications.create_index([("user_id", 1), ("key", 1)], unique=True)
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.audit_logs.create_index([("created_at", -1)])
    await db.audit_logs.create_index([("actor_id", 1), ("created_at", -1)])
