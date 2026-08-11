"""Phase-1 Certification Portal backend tests: OTP register/verify, unified login,
role enforcement, client project + wizard, admin portal, reviewer assignments."""
import asyncio
import os
import uuid
import bcrypt
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api"
DB_NAME = "res_website"
MONGO_URL = "mongodb://localhost:27017"

CLIENT_EMAIL = "testclient@resilientearth.in"
CLIENT_PW = "ClientPass1"
REV_EMAIL = "testreviewer@resilientearth.in"
REV_PW = "ReviewerPass1"
ADMIN_ID = "admin"
ADMIN_PW = "ResAdmin@2026"


def _sess():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(identifier, password, endpoint="/auth/login"):
    s = _sess()
    r = s.post(f"{API}{endpoint}", json={"identifier": identifier, "password": password})
    assert r.status_code == 200, f"login failed for {identifier}: {r.status_code} {r.text}"
    csrf = s.cookies.get("csrf_token")
    assert csrf
    s.headers.update({"X-CSRF-Token": csrf})
    return s, r.json()


@pytest.fixture(scope="session")
def client_sess():
    s, u = _login(CLIENT_EMAIL, CLIENT_PW)
    return s, u


@pytest.fixture(scope="session")
def reviewer_sess():
    s, u = _login(REV_EMAIL, REV_PW)
    return s, u


@pytest.fixture(scope="session")
def admin_sess():
    s, u = _login(ADMIN_ID, ADMIN_PW)
    return s, u


# ---------------- OTP registration flow ----------------
class TestClientOtpFlow:
    def test_register_verify_creates_client(self):
        email = f"test_otp_{uuid.uuid4().hex[:8]}@example.com"
        s = _sess()
        r = s.post(f"{API}/auth/client/register", json={
            "name": "TEST OTP User",
            "email": email,
            "password": "TestPass1",
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["email"] == email
        assert "expires_in_minutes" in d

        # wrong OTP → 400 and attempts incremented
        r = s.post(f"{API}/auth/client/verify-otp", json={"email": email, "otp": "000000"})
        assert r.status_code == 400
        assert "left" in r.json().get("detail", "").lower()

        # patch known hash into pending_registrations
        async def _patch():
            c = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
            h = bcrypt.hashpw(b"123456", bcrypt.gensalt()).decode()
            await c.pending_registrations.update_one(
                {"email": email},
                {"$set": {"otp_hash": h, "attempts": 0}},
            )
        asyncio.run(_patch())

        s2 = _sess()
        r = s2.post(f"{API}/auth/client/verify-otp", json={"email": email, "otp": "123456"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["email"] == email
        assert d["role"] == "client"
        assert s2.cookies.get("access_token")
        assert s2.cookies.get("csrf_token")

        # /me confirms
        r = s2.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "client"

        # cleanup
        async def _clean():
            c = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
            await c.users.delete_one({"email": email})
            await c.pending_registrations.delete_one({"email": email})
        asyncio.run(_clean())

    def test_duplicate_email_returns_409(self):
        s = _sess()
        r = s.post(f"{API}/auth/client/register", json={
            "name": "Dup", "email": CLIENT_EMAIL, "password": "TestPass1",
        })
        assert r.status_code == 409


# ---------------- Unified login ----------------
class TestUnifiedLogin:
    def test_admin_login(self):
        s, u = _login(ADMIN_ID, ADMIN_PW)
        assert u["role"] == "admin"

    def test_client_login(self):
        s, u = _login(CLIENT_EMAIL, CLIENT_PW)
        assert u["role"] == "client"
        assert u["email"] == CLIENT_EMAIL

    def test_reviewer_login(self):
        s, u = _login(REV_EMAIL, REV_PW)
        assert u["role"] == "reviewer"

    def test_wrong_password_401(self):
        s = _sess()
        r = s.post(f"{API}/auth/login", json={"identifier": CLIENT_EMAIL, "password": "WrongPw123"})
        assert r.status_code == 401

    def test_me_returns_role(self, client_sess, reviewer_sess, admin_sess):
        for s, expected_role in [(client_sess[0], "client"), (reviewer_sess[0], "reviewer"), (admin_sess[0], "admin")]:
            r = s.get(f"{API}/auth/me")
            assert r.status_code == 200
            assert r.json()["role"] == expected_role


# ---------------- Role enforcement ----------------
class TestRoleEnforcement:
    def test_no_auth_401(self):
        r = requests.get(f"{API}/client/projects")
        assert r.status_code == 401
        r = requests.get(f"{API}/reviewer/assignments")
        assert r.status_code == 401
        r = requests.get(f"{API}/admin/portal/dashboard")
        assert r.status_code == 401

    def test_client_cannot_access_reviewer_or_admin(self, client_sess):
        s, _ = client_sess
        r = s.get(f"{API}/reviewer/assignments")
        assert r.status_code == 403
        r = s.get(f"{API}/admin/portal/dashboard")
        assert r.status_code == 403

    def test_reviewer_cannot_access_client_or_admin(self, reviewer_sess):
        s, _ = reviewer_sess
        r = s.get(f"{API}/client/projects")
        assert r.status_code == 403
        r = s.get(f"{API}/admin/portal/dashboard")
        assert r.status_code == 403


# ---------------- Client projects + wizard ----------------
class TestClientProjects:
    def test_commercial_project_full_flow(self, client_sess):
        s, _ = client_sess
        # Create commercial project
        r = s.post(f"{API}/client/projects", json={
            "name": f"TEST Commercial {uuid.uuid4().hex[:6]}",
            "project_type": "Commercial",
            "occupancy_type": "owner",
        })
        assert r.status_code == 200, r.text
        proj = r.json()
        pid = proj["id"]
        assert proj["under_configuration"] is False

        # List includes it
        r = s.get(f"{API}/client/projects")
        assert r.status_code == 200
        assert any(p["id"] == pid for p in r.json())

        # Template — 6 categories totalling 100
        r = s.get(f"{API}/client/projects/{pid}/template")
        assert r.status_code == 200
        tpl = r.json()
        cats = tpl.get("categories") or []
        assert len(cats) == 6, f"expected 6 categories got {len(cats)}: {[c.get('name') for c in cats]}"
        total = sum(c.get("max_points", 0) for c in cats)
        assert total == 100, f"expected 100 total points, got {total}"

        # Submit before responses -> 400 (mandatory not met)
        r = s.post(f"{API}/client/projects/{pid}/submit")
        assert r.status_code == 400, r.text

        # Auto-save: mark all mandatory items met
        # Walk template and collect all mandatory criterion ids
        responses = {}
        for cat in cats:
            for crit in cat.get("criteria", []):
                if crit.get("mandatory"):
                    responses[crit["id"]] = {"met": True, "claimed_points": 0}
                else:
                    responses[crit["id"]] = {"met": True, "claimed_points": crit.get("max_points", 0)}

        r = s.put(f"{API}/client/projects/{pid}/responses", json={"responses": responses})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["saved"] is True
        assert "score" in d
        assert d["score"]["claimed_total"] > 0

        # Now submit succeeds
        r = s.post(f"{API}/client/projects/{pid}/submit")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["submitted"] is True
        assert d["version"] >= 1
        assert "score" in d

    def test_hotel_under_configuration(self, client_sess):
        s, _ = client_sess
        r = s.post(f"{API}/client/projects", json={
            "name": f"TEST Hotel {uuid.uuid4().hex[:6]}",
            "project_type": "Hotel",
        })
        assert r.status_code == 200
        proj = r.json()
        assert proj["under_configuration"] is True
        pid = proj["id"]

        r = s.get(f"{API}/client/projects/{pid}/template")
        assert r.status_code == 200
        tpl = r.json()
        assert tpl.get("under_configuration") is True or "checklist" in str(tpl).lower()

        r = s.post(f"{API}/client/projects/{pid}/submit")
        assert r.status_code == 409


# ---------------- Admin portal ----------------
class TestAdminPortal:
    def test_dashboard(self, admin_sess):
        s, _ = admin_sess
        r = s.get(f"{API}/admin/portal/dashboard")
        assert r.status_code == 200
        d = r.json()
        for k in ["clients", "reviewers", "projects", "submitted", "assigned"]:
            assert k in d

    def test_clients_list_has_project_count(self, admin_sess):
        s, _ = admin_sess
        r = s.get(f"{API}/admin/portal/clients")
        assert r.status_code == 200
        clients = r.json()
        assert any(c["email"] == CLIENT_EMAIL for c in clients)
        assert all("project_count" in c for c in clients)

    def test_create_reviewer_and_duplicate(self, admin_sess):
        s, _ = admin_sess
        email = f"test_rev_{uuid.uuid4().hex[:8]}@example.com"
        r = s.post(f"{API}/admin/portal/reviewers", json={
            "name": "TEST Reviewer", "email": email, "password": "RevPass1A"
        })
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "reviewer"

        # duplicate
        r = s.post(f"{API}/admin/portal/reviewers", json={
            "name": "Dup", "email": email, "password": "RevPass1A"
        })
        assert r.status_code == 409

        # cleanup
        async def _clean():
            c = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
            await c.users.delete_one({"email": email})
        asyncio.run(_clean())

    def test_projects_list_and_assign(self, admin_sess, client_sess, reviewer_sess):
        adm_s, _ = admin_sess
        cli_s, _ = client_sess
        rev_s, rev_u = reviewer_sess

        # Ensure a submitted project exists — create fresh one, fill mandatory, submit
        r = cli_s.post(f"{API}/client/projects", json={
            "name": f"TEST AssignFlow {uuid.uuid4().hex[:6]}",
            "project_type": "Commercial",
        })
        assert r.status_code == 200
        pid = r.json()["id"]
        tpl = cli_s.get(f"{API}/client/projects/{pid}/template").json()
        responses = {}
        for cat in tpl["categories"]:
            for crit in cat.get("criteria", []):
                responses[crit["id"]] = {"met": True, "claimed_points": crit.get("max_points", 0) if not crit.get("mandatory") else 0}
        cli_s.put(f"{API}/client/projects/{pid}/responses", json={"responses": responses})
        r = cli_s.post(f"{API}/client/projects/{pid}/submit")
        assert r.status_code == 200, r.text

        # Admin list contains project with client info
        r = adm_s.get(f"{API}/admin/portal/certification-projects")
        assert r.status_code == 200
        projs = r.json()
        target = next((p for p in projs if p["id"] == pid), None)
        assert target
        assert target.get("client", {}).get("email") == CLIENT_EMAIL

        # Assign the pre-seeded reviewer
        r = adm_s.post(f"{API}/admin/portal/assign", json={
            "project_id": pid, "reviewer_id": rev_u["id"]
        })
        assert r.status_code == 200, r.text
        assert r.json()["assigned"] is True

        # Reviewer sees the assignment
        r = rev_s.get(f"{API}/api" if False else f"{API}/reviewer/assignments")
        assert r.status_code == 200
        assignments = r.json()
        assert any(a["id"] == pid for a in assignments)
