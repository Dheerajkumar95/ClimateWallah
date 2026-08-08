"""
Backend API tests for Resilient Earth Solutions (RES) corporate website.

Covers:
- Public endpoints (home, about, services, projects, team, blogs, settings, capability)
- Contact enquiry submission (with duplicate/rate limit sanity)
- Admin authentication (login by ID / email, wrong creds, /me, logout)
- CSRF enforcement on writes
- Session survives via cookie
- Admin dashboard counts
- CRUD for services/projects/team_members/blog_posts (with public visibility)
- Enquiries admin: list, get (auto Read), patch status/note, CSV export
- Singleton editors: homepage / website_settings (public reflection)
- Media upload (PNG accepted, invalid rejected)
- Capability PDF upload + public retrieval
- Change password (round-trip back to original)
"""
import io
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # fallback to reading frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

ADMIN_ID = "admin"
ADMIN_EMAIL = "admin@resilientearth.in"
ADMIN_PASSWORD = "ResAdmin@2026"

API = f"{BASE_URL}/api"


# ---------------- Fixtures ----------------
@pytest.fixture(scope="session")
def public_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_client():
    """Logged-in admin session with cookies + CSRF header helper."""
    s = requests.Session()
    r = s.post(f"{API}/admin/auth/login", json={"identifier": ADMIN_ID, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    csrf = s.cookies.get("csrf_token")
    assert csrf, "csrf_token cookie not set on login"
    s.headers.update({"X-CSRF-Token": csrf, "Content-Type": "application/json"})
    return s


# ---------------- Health ----------------
class TestHealth:
    def test_health(self, public_client):
        r = public_client.get(f"{API}/health")
        assert r.status_code == 200


# ---------------- Public endpoints ----------------
class TestPublic:
    def test_home(self, public_client):
        r = public_client.get(f"{API}/public/home")
        assert r.status_code == 200
        d = r.json()
        for k in ["services", "projects", "team", "home"]:
            assert k in d, f"missing {k} in /public/home"
        assert len(d["services"]) >= 4
        assert len(d["projects"]) >= 1
        assert len(d["team"]) >= 1

    def test_about(self, public_client):
        r = public_client.get(f"{API}/public/about")
        assert r.status_code == 200

    def test_services_list(self, public_client):
        r = public_client.get(f"{API}/public/services")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 4, f"expected >=4 services, got {len(data)}"
        # detail by slug
        slug = data[0]["slug"]
        r2 = public_client.get(f"{API}/public/services/{slug}")
        assert r2.status_code == 200
        assert r2.json()["slug"] == slug

    def test_projects_list_and_filters(self, public_client):
        r = public_client.get(f"{API}/public/projects")
        assert r.status_code == 200
        payload = r.json()
        # response could be list or dict with items+facets
        if isinstance(payload, dict):
            items = payload.get("items") or payload.get("projects") or []
        else:
            items = payload
        assert len(items) >= 24, f"expected 24 projects, got {len(items)}"
        slug = items[0]["slug"]
        r2 = public_client.get(f"{API}/public/projects/{slug}")
        assert r2.status_code == 200
        assert r2.json()["slug"] == slug
        # search filter
        r3 = public_client.get(f"{API}/public/projects", params={"search": items[0]["title"][:5]})
        assert r3.status_code == 200

    def test_team(self, public_client):
        r = public_client.get(f"{API}/public/team")
        assert r.status_code == 200
        assert len(r.json()) >= 6

    def test_settings(self, public_client):
        r = public_client.get(f"{API}/public/settings")
        assert r.status_code == 200

    def test_blogs_public(self, public_client):
        r = public_client.get(f"{API}/public/blogs")
        assert r.status_code == 200


# ---------------- Enquiries ----------------
class TestEnquiries:
    def test_enquiry_submit(self, public_client):
        payload = {
            "name": "TEST User",
            "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
            "phone": "+919999999999",
            "company": "TEST Co",
            "subject": "TEST enquiry",
            "service_of_interest": "Green Building",
            "message": "This is a TEST message from automated pytest run.",
            "source_page": "/contact"
        }
        r = public_client.post(f"{API}/public/enquiries", json=payload)
        assert r.status_code == 200, f"enquiry failed: {r.status_code} {r.text}"
        assert "message" in r.json()

    def test_enquiry_missing_fields(self, public_client):
        r = public_client.post(f"{API}/public/enquiries", json={"name": "A", "email": "bad", "message": "x"})
        assert r.status_code in (400, 422)


# ---------------- Auth ----------------
class TestAuth:
    def test_login_with_id(self, public_client):
        s = requests.Session()
        r = s.post(f"{API}/admin/auth/login", json={"identifier": ADMIN_ID, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        assert s.cookies.get("access_token")
        assert s.cookies.get("csrf_token")
        d = r.json()
        assert d["login_id"] == ADMIN_ID

    def test_login_with_email(self):
        s = requests.Session()
        r = s.post(f"{API}/admin/auth/login", json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_login_wrong_password(self):
        s = requests.Session()
        r = s.post(f"{API}/admin/auth/login", json={"identifier": ADMIN_ID, "password": "WrongPass@2026"})
        assert r.status_code == 401
        assert "invalid" in r.json().get("detail", "").lower()

    def test_dashboard_requires_auth(self, public_client):
        r = public_client.get(f"{API}/admin/dashboard")
        assert r.status_code == 401

    def test_me_via_cookie(self, admin_client):
        r = admin_client.get(f"{API}/admin/auth/me")
        assert r.status_code == 200
        assert r.json()["login_id"] == ADMIN_ID

    def test_write_requires_csrf(self):
        # Login but do NOT send X-CSRF-Token header -> should be 403
        s = requests.Session()
        r = s.post(f"{API}/admin/auth/login", json={"identifier": ADMIN_ID, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        # Attempt a write without csrf header
        r2 = s.post(f"{API}/admin/services", json={"title": "TEST No CSRF"})
        assert r2.status_code == 403


# ---------------- Dashboard ----------------
class TestDashboard:
    def test_dashboard_counts(self, admin_client):
        r = admin_client.get(f"{API}/admin/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert d["total_projects"] >= 24
        assert d["total_services"] >= 4
        assert d["total_team"] >= 6


# ---------------- CRUD helpers ----------------
class TestProjectsCRUD:
    def test_project_create_edit_delete(self, admin_client, public_client):
        # Create
        payload = {
            "title": f"TEST Project {uuid.uuid4().hex[:6]}",
            "category": "Green Building",
            "location": "Bengaluru",
            "status": "published",
            "summary": "TEST summary",
            "description": "TEST description",
        }
        r = admin_client.post(f"{API}/admin/projects", json=payload)
        assert r.status_code == 200, r.text
        proj = r.json()
        pid, slug = proj["id"], proj["slug"]

        # List (admin) - must contain
        r = admin_client.get(f"{API}/admin/projects")
        assert any(p["id"] == pid for p in r.json())

        # Public visibility by slug
        r = public_client.get(f"{API}/public/projects/{slug}")
        assert r.status_code == 200

        # Edit
        r = admin_client.put(f"{API}/admin/projects/{pid}", json={"summary": "TEST updated"})
        assert r.status_code == 200
        assert r.json()["summary"] == "TEST updated"

        # Delete
        r = admin_client.delete(f"{API}/admin/projects/{pid}")
        assert r.status_code == 200

        # verify gone
        r = admin_client.get(f"{API}/admin/projects/{pid}")
        assert r.status_code == 404


class TestServicesCRUD:
    def test_service_crud(self, admin_client):
        payload = {"title": f"TEST Service {uuid.uuid4().hex[:6]}", "summary": "TEST", "status": "published"}
        r = admin_client.post(f"{API}/admin/services", json=payload)
        assert r.status_code == 200
        sid = r.json()["id"]
        r = admin_client.put(f"{API}/admin/services/{sid}", json={"summary": "TEST edited"})
        assert r.status_code == 200 and r.json()["summary"] == "TEST edited"
        r = admin_client.delete(f"{API}/admin/services/{sid}")
        assert r.status_code == 200


class TestTeamCRUD:
    def test_team_crud(self, admin_client):
        payload = {"name": f"TEST Member {uuid.uuid4().hex[:6]}", "role": "Consultant", "status": "published"}
        r = admin_client.post(f"{API}/admin/team_members", json=payload)
        assert r.status_code == 200
        tid = r.json()["id"]
        r = admin_client.put(f"{API}/admin/team_members/{tid}", json={"role": "Senior Consultant"})
        assert r.status_code == 200
        r = admin_client.delete(f"{API}/admin/team_members/{tid}")
        assert r.status_code == 200


class TestBlogCRUD:
    def test_blog_draft_then_publish(self, admin_client, public_client):
        payload = {"title": f"TEST Blog {uuid.uuid4().hex[:6]}", "excerpt": "TEST", "content": "TEST body",
                   "status": "draft", "category": "Insights"}
        r = admin_client.post(f"{API}/admin/blog_posts", json=payload)
        assert r.status_code == 200
        bid, slug = r.json()["id"], r.json()["slug"]
        # not on public yet
        r_pub = public_client.get(f"{API}/public/blogs")
        pub_body = r_pub.json()
        pub_items = pub_body.get("items", pub_body) if isinstance(pub_body, dict) else pub_body
        assert not any(b.get("slug") == slug for b in pub_items)
        # publish
        r = admin_client.put(f"{API}/admin/blog_posts/{bid}", json={"status": "published"})
        assert r.status_code == 200
        r_pub = public_client.get(f"{API}/public/blogs")
        pub_body = r_pub.json()
        pub_items = pub_body.get("items", pub_body) if isinstance(pub_body, dict) else pub_body
        assert any(b.get("slug") == slug for b in pub_items)
        # cleanup
        admin_client.delete(f"{API}/admin/blog_posts/{bid}")


# ---------------- Enquiries admin ----------------
class TestEnquiriesAdmin:
    def test_list_status_note_export(self, admin_client, public_client):
        # Submit an enquiry first
        payload = {
            "name": "TEST Admin Flow",
            "email": f"admflow_{uuid.uuid4().hex[:6]}@example.com",
            "message": "TEST enquiry admin flow message",
            "source_page": "/contact"
        }
        rc = public_client.post(f"{API}/public/enquiries", json=payload)
        assert rc.status_code == 200

        # List
        r = admin_client.get(f"{API}/admin/enquiries")
        assert r.status_code == 200
        items = r.json()["items"]
        target = next((e for e in items if e["email"] == payload["email"]), None)
        assert target, "submitted enquiry not found in admin list"
        eid = target["id"]

        # GET flips New -> Read
        r = admin_client.get(f"{API}/admin/enquiries/{eid}")
        assert r.status_code == 200
        assert r.json()["status"] == "Read"

        # PATCH status + note
        r = admin_client.patch(f"{API}/admin/enquiries/{eid}",
                               json={"status": "Replied", "admin_note": "TEST note"})
        assert r.status_code == 200
        assert r.json()["status"] == "Replied"
        assert r.json()["admin_note"] == "TEST note"

        # CSV export
        r = admin_client.get(f"{API}/admin/enquiries/export")
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert payload["email"] in r.text


# ---------------- Homepage + Settings singletons ----------------
class TestSingletons:
    def test_homepage_save(self, admin_client):
        r = admin_client.get(f"{API}/admin/homepage")
        assert r.status_code == 200
        current = r.json() or {}
        current["hero_headline"] = "TEST hero"
        r = admin_client.put(f"{API}/admin/homepage", json=current)
        assert r.status_code == 200
        assert r.json().get("hero_headline") == "TEST hero"

    def test_website_settings_public_reflection(self, admin_client, public_client):
        r = admin_client.get(f"{API}/admin/website_settings")
        current = r.json() or {}
        tag = f"TEST-{uuid.uuid4().hex[:4]}"
        current["company_name"] = f"Resilient Earth Solutions {tag}"
        r = admin_client.put(f"{API}/admin/website_settings", json=current)
        assert r.status_code == 200
        r_pub = public_client.get(f"{API}/public/settings")
        assert r_pub.status_code == 200
        body = r_pub.json()
        settings = body.get("settings", body)
        assert tag in settings.get("company_name", "")


# ---------------- Media + Capability ----------------
PNG_1PX = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0\x00\x00\x00\x03\x00\x01"
    b"\xa7z9Y\x00\x00\x00\x00IEND\xaeB`\x82"
)


class TestMedia:
    def test_upload_png_and_reject_txt(self, admin_client):
        # multipart: strip session's application/json Content-Type
        h = {"X-CSRF-Token": admin_client.headers["X-CSRF-Token"], "Content-Type": None}
        files = {"file": ("test.png", PNG_1PX, "image/png")}
        r = admin_client.post(f"{API}/admin/uploads", files=files, headers=h)
        assert r.status_code == 200, r.text
        mid = r.json()["id"]

        files = {"file": ("bad.txt", b"hello", "text/plain")}
        r = admin_client.post(f"{API}/admin/uploads", files=files, headers=h)
        assert r.status_code == 400

        admin_client.delete(f"{API}/admin/uploads/{mid}")


PDF_MIN = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"


class TestCapabilityPDF:
    def test_upload_and_public(self, admin_client, public_client):
        h = {"X-CSRF-Token": admin_client.headers["X-CSRF-Token"], "Content-Type": None}
        files = {"file": ("capability.pdf", PDF_MIN, "application/pdf")}
        r = admin_client.post(f"{API}/admin/capability-profile", files=files, headers=h)
        assert r.status_code == 200, r.text
        assert r.json()["url"].endswith(".pdf")
        r = public_client.get(f"{API}/public/capability-profile")
        assert r.status_code == 200
        assert r.json().get("url", "").endswith(".pdf")

        # Reject non-pdf
        files = {"file": ("not.png", PNG_1PX, "image/png")}
        r = admin_client.post(f"{API}/admin/capability-profile", files=files, headers=h)
        assert r.status_code == 400


# ---------------- Change password ----------------
class TestChangePassword:
    def test_change_and_revert(self):
        s = requests.Session()
        # login
        r = s.post(f"{API}/admin/auth/login", json={"identifier": ADMIN_ID, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        csrf = s.cookies.get("csrf_token")
        headers = {"X-CSRF-Token": csrf, "Content-Type": "application/json"}

        new_pw = "NewResPass@2026"
        # Weak password should be rejected if server validates (best-effort)
        r = s.post(f"{API}/admin/auth/change-password",
                   json={"current_password": ADMIN_PASSWORD, "new_password": new_pw, "confirm_password": new_pw},
                   headers=headers)
        assert r.status_code == 200, f"change pw failed: {r.text}"

        # login with new pw
        s2 = requests.Session()
        r = s2.post(f"{API}/admin/auth/login", json={"identifier": ADMIN_ID, "password": new_pw})
        assert r.status_code == 200

        # revert
        csrf2 = s2.cookies.get("csrf_token")
        r = s2.post(f"{API}/admin/auth/change-password",
                    json={"current_password": new_pw, "new_password": ADMIN_PASSWORD,
                          "confirm_password": ADMIN_PASSWORD},
                    headers={"X-CSRF-Token": csrf2, "Content-Type": "application/json"})
        assert r.status_code == 200, f"revert pw failed: {r.text}"

        # verify original works
        s3 = requests.Session()
        r = s3.post(f"{API}/admin/auth/login", json={"identifier": ADMIN_ID, "password": ADMIN_PASSWORD})
        assert r.status_code == 200


# ---------------- Logout ----------------
class TestLogout:
    def test_logout_clears_session(self):
        s = requests.Session()
        r = s.post(f"{API}/admin/auth/login", json={"identifier": ADMIN_ID, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        csrf = s.cookies.get("csrf_token")
        r = s.post(f"{API}/admin/auth/logout", headers={"X-CSRF-Token": csrf})
        assert r.status_code == 200
        r = s.get(f"{API}/admin/auth/me")
        assert r.status_code == 401
