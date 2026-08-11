"""Phase A backend tests: sequential locking + admin cert dashboard counts."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")

CLIENT_EMAIL = "testclient@resilientearth.in"
CLIENT_PASS = "ClientPass1"
ADMIN_ID = "admin"
ADMIN_PASS = "ResAdmin@2026"


def _client_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"identifier": CLIENT_EMAIL, "password": CLIENT_PASS})
    assert r.status_code == 200, r.text
    csrf = s.cookies.get("csrf_token")
    if csrf:
        s.headers.update({"X-CSRF-Token": csrf})
    return s


def _admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"identifier": ADMIN_ID, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    csrf = s.cookies.get("csrf_token")
    if csrf:
        s.headers.update({"X-CSRF-Token": csrf})
    return s


@pytest.fixture(scope="module")
def client_session():
    return _client_session()


@pytest.fixture(scope="module")
def residential_project(client_session):
    name = f"TEST_PhaseA_Res_{uuid.uuid4().hex[:6]}"
    r = client_session.post(f"{BASE_URL}/api/client/projects", json={
        "name": name, "project_type": "Residential", "occupancy_type": "owner"
    })
    assert r.status_code == 200, r.text
    p = r.json()
    yield p


def test_assessment_overview_initial_locking(client_session, residential_project):
    pid = residential_project["id"]
    r = client_session.get(f"{BASE_URL}/api/client/projects/{pid}/assessment")
    assert r.status_code == 200
    body = r.json()
    sections = body["sections"]
    assert len(sections) == 6
    assert sections[0]["state"] == "current"
    assert sections[0]["slug"] == "sustainable-design"
    for s in sections[1:]:
        assert s["state"] == "locked", f"Section {s['slug']} should be locked"


def test_locked_section_returns_403(client_session, residential_project):
    pid = residential_project["id"]
    r = client_session.get(f"{BASE_URL}/api/client/projects/{pid}/assessment/energy-efficiency")
    assert r.status_code == 403


def test_current_section_returns_200(client_session, residential_project):
    pid = residential_project["id"]
    r = client_session.get(f"{BASE_URL}/api/client/projects/{pid}/assessment/sustainable-design")
    assert r.status_code == 200
    b = r.json()
    assert b["section"]["slug"] == "sustainable-design"
    assert b["next_slug"] == "water-conservation"
    assert b["prev_slug"] is None


def test_save_continue_blocked_missing_mandatory(client_session, residential_project):
    pid = residential_project["id"]
    r = client_session.put(f"{BASE_URL}/api/client/projects/{pid}/assessment/sustainable-design", json={
        "responses": {"sd-1": {"claimed_points": 3}},
        "completed_categories": ["_"],
    })
    assert r.status_code == 400, r.text


def test_draft_save_does_not_unlock(client_session, residential_project):
    pid = residential_project["id"]
    # Save draft without completed_categories
    r = client_session.put(f"{BASE_URL}/api/client/projects/{pid}/assessment/sustainable-design", json={
        "responses": {"sd-1": {"claimed_points": 2}},
    })
    assert r.status_code == 200
    assert r.json().get("next_slug") is None
    # Water Conservation still locked
    r2 = client_session.get(f"{BASE_URL}/api/client/projects/{pid}/assessment/water-conservation")
    assert r2.status_code == 403


def test_save_continue_unlocks_next(client_session, residential_project):
    pid = residential_project["id"]
    r = client_session.put(f"{BASE_URL}/api/client/projects/{pid}/assessment/sustainable-design", json={
        "responses": {
            "sd-p1": {"met": True},
            "sd-p2": {"met": True},
            "sd-1": {"claimed_points": 4},
        },
        "completed_categories": ["_"],
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["next_slug"] == "water-conservation"
    # Now water-conservation should be accessible
    r2 = client_session.get(f"{BASE_URL}/api/client/projects/{pid}/assessment/water-conservation")
    assert r2.status_code == 200
    # Energy Efficiency still locked
    r3 = client_session.get(f"{BASE_URL}/api/client/projects/{pid}/assessment/energy-efficiency")
    assert r3.status_code == 403


def test_admin_dashboard_richer_counts():
    admin = _admin_session()
    r = admin.get(f"{BASE_URL}/api/admin/portal/dashboard")
    assert r.status_code == 200
    d = r.json()
    for k in ["clients", "reviewers", "projects", "unassigned", "under_review",
              "changes_requested", "awaiting_admin", "certified"]:
        assert k in d, f"missing key {k} in dashboard"
        assert isinstance(d[k], int)


def test_commercial_slugs_still_work(client_session):
    name = f"TEST_PhaseA_Com_{uuid.uuid4().hex[:6]}"
    r = client_session.post(f"{BASE_URL}/api/client/projects", json={
        "name": name, "project_type": "Commercial", "occupancy_type": "owner"
    })
    assert r.status_code == 200
    pid = r.json()["id"]
    r2 = client_session.get(f"{BASE_URL}/api/client/projects/{pid}/assessment")
    assert r2.status_code == 200
    slugs = [s["slug"] for s in r2.json()["sections"]]
    assert slugs[0] == "site-selection"
    assert "innovation-decarbonisation" in slugs
    # Locked section for commercial
    r3 = client_session.get(f"{BASE_URL}/api/client/projects/{pid}/assessment/energy-efficiency")
    assert r3.status_code == 403
