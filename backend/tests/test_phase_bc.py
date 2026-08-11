"""Phase B+C Certification Portal tests:
- Evidence uploads (client upload → reviewer approve/reject → delete; role isolation)
- Assignment depth (reviewer workload/available/project_types; assign/reassign/unassign + history)
- Full project form persistence (building_info, location.geo, privacy, settings, team)
"""
import io
import os
import uuid
import pytest
import requests

# Load BASE_URL from env or frontend .env
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"

CLIENT_EMAIL = "testclient@resilientearth.in"
CLIENT_PW = "ClientPass1"
REV_EMAIL = "testreviewer@resilientearth.in"
REV_PW = "ReviewerPass1"
ADMIN_ID = "admin"
ADMIN_PW = "ResAdmin@2026"


def _login(identifier, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"identifier": identifier, "password": password})
    assert r.status_code == 200, f"login {identifier} -> {r.status_code} {r.text}"
    csrf = s.cookies.get("csrf_token")
    assert csrf
    s.headers.update({"X-CSRF-Token": csrf})
    return s, r.json()


@pytest.fixture(scope="session")
def client_sess():
    return _login(CLIENT_EMAIL, CLIENT_PW)


@pytest.fixture(scope="session")
def reviewer_sess():
    return _login(REV_EMAIL, REV_PW)


@pytest.fixture(scope="session")
def admin_sess():
    return _login(ADMIN_ID, ADMIN_PW)


def _create_project(cli_s, ptype="Residential", extras=None):
    body = {"name": f"TEST BC {uuid.uuid4().hex[:6]}", "project_type": ptype}
    if extras:
        body.update(extras)
    r = cli_s.post(f"{API}/client/projects", json=body)
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _first_criterion(cli_s, pid, slug):
    r = cli_s.get(f"{API}/client/projects/{pid}/assessment/{slug}")
    assert r.status_code == 200, r.text
    d = r.json()
    return d["section"]["criteria"][0]["id"], d


# =============== EVIDENCE UPLOAD ===============
class TestEvidenceUpload:
    def test_upload_serve_delete_and_reviewer_review(self, client_sess, reviewer_sess, admin_sess):
        cli_s, cli_u = client_sess
        rev_s, rev_u = reviewer_sess
        adm_s, _ = admin_sess

        pid = _create_project(cli_s, "Residential")
        crit_id, sec = _first_criterion(cli_s, pid, "sustainable-design")

        # Upload evidence
        files = {"file": ("test_evidence.pdf", io.BytesIO(b"%PDF-1.4\ntest evidence\n"), "application/pdf")}
        data = {"scope": "evidence", "criterion_id": crit_id}
        r = cli_s.post(f"{API}/client/projects/{pid}/files", files=files, data=data)
        assert r.status_code == 200, r.text
        rec = r.json()
        assert rec["status"] == "pending"
        assert rec["url"].startswith("http") and "/api/uploads/evidence/" in rec["url"]
        file_id = rec["id"]

        # Static file URL returns 200
        r2 = requests.get(rec["url"])
        assert r2.status_code == 200, f"static url {rec['url']} -> {r2.status_code}"
        assert len(r2.content) > 0

        # Assessment section GET includes evidence array on the criterion
        r = cli_s.get(f"{API}/client/projects/{pid}/assessment/sustainable-design")
        assert r.status_code == 200
        crits = r.json()["section"]["criteria"]
        target = next(c for c in crits if c["id"] == crit_id)
        assert isinstance(target.get("evidence"), list)
        assert any(f["id"] == file_id for f in target["evidence"])

        # Reviewer NOT assigned yet -> cannot review this evidence (assignment not found)
        r = rev_s.post(f"{API}/reviewer/projects/{pid}/evidence/{file_id}/review",
                       json={"criterion_id": crit_id, "status": "approved"})
        assert r.status_code in (403, 404), r.text

        # Assign reviewer
        # Need submit first? assign requires status in submitted/changes_requested/assigned/under_review
        # Fill mandatories quickly - use responses endpoint
        # Simpler: fetch template and mark mandatories met
        tpl = cli_s.get(f"{API}/client/projects/{pid}/template").json()
        responses = {}
        for cat in tpl["categories"]:
            for c in cat.get("criteria", []):
                responses[c["id"]] = {"met": True, "claimed_points": 0 if c.get("mandatory") else c.get("max_points", 0)}
        cli_s.put(f"{API}/client/projects/{pid}/responses", json={"responses": responses})
        r = cli_s.post(f"{API}/client/projects/{pid}/submit")
        assert r.status_code == 200, r.text
        r = adm_s.post(f"{API}/admin/portal/assign", json={"project_id": pid, "reviewer_id": rev_u["id"]})
        assert r.status_code == 200, r.text

        # Assigned reviewer approves evidence
        r = rev_s.post(f"{API}/reviewer/projects/{pid}/evidence/{file_id}/review",
                       json={"criterion_id": crit_id, "status": "approved", "comment": "TEST looks good"})
        assert r.status_code == 200, r.text
        assert r.json()["review"]["status"] == "approved"

        # Reviewer's project view now shows updated status
        r = rev_s.get(f"{API}/reviewer/projects/{pid}")
        assert r.status_code == 200
        ev = r.json().get("evidence", {}).get(crit_id, [])
        assert any(f["id"] == file_id and f["status"] == "approved" for f in ev)

        # Reject flow with a fresh file
        files = {"file": ("t2.png", io.BytesIO(b"\x89PNG\r\n\x1a\nrest"), "image/png")}
        r = cli_s.post(f"{API}/client/projects/{pid}/files", files=files, data={"scope": "evidence", "criterion_id": crit_id})
        # After submit + assign, project is no longer in draft; upload_client_file uses current_client_write but does not restrict by status.
        # It should still succeed.
        assert r.status_code == 200, r.text
        fid2 = r.json()["id"]
        r = rev_s.post(f"{API}/reviewer/projects/{pid}/evidence/{fid2}/review",
                       json={"criterion_id": crit_id, "status": "rejected", "comment": "TEST rejected"})
        assert r.status_code == 200
        assert r.json()["review"]["status"] == "rejected"

        # Delete evidence file
        r = cli_s.delete(f"{API}/client/projects/{pid}/files/{fid2}", params={"criterion_id": crit_id})
        assert r.status_code == 200
        assert r.json()["deleted"] is True

    def test_invalid_extension_rejected(self, client_sess):
        cli_s, _ = client_sess
        pid = _create_project(cli_s, "Residential")
        crit_id, _ = _first_criterion(cli_s, pid, "sustainable-design")
        files = {"file": ("bad.exe", io.BytesIO(b"MZ"), "application/octet-stream")}
        r = cli_s.post(f"{API}/client/projects/{pid}/files", files=files, data={"scope": "evidence", "criterion_id": crit_id})
        assert r.status_code == 400


# =============== ASSIGNMENT DEPTH ===============
class TestAssignmentDepth:
    def test_reviewers_list_has_workload_fields(self, admin_sess):
        adm_s, _ = admin_sess
        r = adm_s.get(f"{API}/admin/portal/reviewers")
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list) and len(rows) >= 1
        for r0 in rows:
            assert "active_assignments" in r0
            assert "max_workload" in r0
            assert "available" in r0
            assert "project_types" in r0

    def test_assign_reassign_unassign_history(self, client_sess, reviewer_sess, admin_sess):
        cli_s, _ = client_sess
        rev_s, rev_u = reviewer_sess
        adm_s, _ = admin_sess

        pid = _create_project(cli_s, "Residential")
        # Fill + submit
        tpl = cli_s.get(f"{API}/client/projects/{pid}/template").json()
        responses = {c["id"]: {"met": True, "claimed_points": 0 if c.get("mandatory") else c.get("max_points", 0)}
                     for cat in tpl["categories"] for c in cat.get("criteria", [])}
        cli_s.put(f"{API}/client/projects/{pid}/responses", json={"responses": responses})
        assert cli_s.post(f"{API}/client/projects/{pid}/submit").status_code == 200

        # Create a second reviewer via admin to test reassign
        second_email = f"test_reviewer2_{uuid.uuid4().hex[:6]}@resilientearth.in"
        r = adm_s.post(f"{API}/admin/portal/reviewers", json={
            "name": "TEST Rev2", "email": second_email, "password": "RevPass2A",
            "specialisation": "IGBC Residential", "project_types": ["Residential"],
            "rating_systems": [], "max_workload": 3,
        })
        assert r.status_code == 200, r.text
        rev2_id = r.json()["id"]

        # First assign with due_date + priority + instructions
        r = adm_s.post(f"{API}/admin/portal/assign", json={
            "project_id": pid, "reviewer_id": rev_u["id"],
            "due_date": "2026-02-15", "priority": "high",
            "instructions": "TEST focus on water conservation",
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["assigned"] is True
        assert d.get("reassigned") in (False, None)

        # Fetch detail: assignment + assignment_history present
        r = adm_s.get(f"{API}/admin/portal/certification-projects/{pid}")
        assert r.status_code == 200
        proj = r.json()
        assert proj.get("assignment", {}).get("priority") == "high"
        assert proj.get("assignment", {}).get("due_date") == "2026-02-15"
        assert isinstance(proj.get("assignment_history"), list) and len(proj["assignment_history"]) == 1
        assert proj["assignment_history"][0]["action"] == "assigned"

        # Reassign to rev2 -> reassigned=True
        r = adm_s.post(f"{API}/admin/portal/assign", json={
            "project_id": pid, "reviewer_id": rev2_id,
            "due_date": "2026-03-01", "priority": "normal", "instructions": "TEST reassigned",
        })
        assert r.status_code == 200, r.text
        assert r.json().get("reassigned") is True

        proj = adm_s.get(f"{API}/admin/portal/certification-projects/{pid}").json()
        assert proj["reviewer_id"] == rev2_id
        actions = [h["action"] for h in proj["assignment_history"]]
        assert "assigned" in actions and "reassigned" in actions

        # Unassign -> status back to submitted, history has 'removed'
        r = adm_s.post(f"{API}/admin/portal/projects/{pid}/unassign")
        assert r.status_code == 200
        proj = adm_s.get(f"{API}/admin/portal/certification-projects/{pid}").json()
        assert proj["reviewer_id"] is None
        assert proj["status"] == "submitted"
        actions = [h["action"] for h in proj["assignment_history"]]
        assert "removed" in actions


# =============== FULL PROJECT FORM ===============
class TestFullProjectForm:
    def test_persists_building_info_geo_privacy_team(self, client_sess):
        cli_s, _ = client_sess
        body = {
            "name": f"TEST FullForm {uuid.uuid4().hex[:6]}",
            "project_type": "Commercial",
            "occupancy_type": "owner",
            "building_info": {
                "built_up_area": 5000, "built_up_unit": "sq.m",
                "target_area": 4500, "target_unit": "sq.m",
                "site_area": 8000, "num_floors": 6, "num_buildings": 1,
                "permanent_occupancy": 200, "visitor_occupancy": 50,
                "construction_type": "New",
                "start_date": "2026-01-01", "completion_date": "2027-06-30",
                "parent_development": "TEST Parent Devel",
                "description": "TEST full form description",
            },
            "location": {
                "address1": "123 Green Street", "city": "Bengaluru",
                "state": "Karnataka", "country": "India", "pincode": "560001",
                "geo": {"lat": 12.9716, "lng": 77.5946, "source": "manual"},
            },
            "privacy": {
                "confidential": True, "owner_developer": "TEST Owner Co",
                "organization": "TEST Org", "architect": "TEST Architect",
                "main_contact": "TEST Contact",
            },
            "settings": {"target_rating": "Gold"},
            "team": [
                {"name": "TEST Alice", "role": "Architect", "email": "alice@test.co"},
                {"name": "TEST Bob", "role": "Engineer", "email": "bob@test.co"},
            ],
        }
        r = cli_s.post(f"{API}/client/projects", json=body)
        assert r.status_code == 200, r.text
        pid = r.json()["id"]

        # Fetch and validate persistence
        r = cli_s.get(f"{API}/client/projects/{pid}")
        assert r.status_code == 200
        p = r.json()
        assert p["building_info"]["built_up_area"] == 5000
        assert p["building_info"]["description"] == "TEST full form description"
        assert p["location"]["city"] == "Bengaluru"
        assert p["location"]["geo"]["lat"] == 12.9716
        assert p["location"]["geo"]["source"] == "manual"
        assert p["privacy"]["confidential"] is True
        assert p["privacy"]["organization"] == "TEST Org"
        assert p["settings"]["target_rating"] == "Gold"
        assert isinstance(p["team"], list) and len(p["team"]) == 2
        assert p["team"][0]["name"] == "TEST Alice"

    def test_residential_type_allowed(self, client_sess):
        cli_s, _ = client_sess
        r = cli_s.post(f"{API}/client/projects", json={
            "name": f"TEST Res {uuid.uuid4().hex[:6]}", "project_type": "Residential"
        })
        assert r.status_code == 200
        assert r.json()["project_type"] == "Residential"
