"""Phase-2 Certification Portal backend tests: reviewer workflow (recommendations,
request-changes, forward), admin certification (finalize), client visibility,
and role isolation guards."""
import os
import uuid
import pytest
import requests

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
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"identifier": identifier, "password": password})
    assert r.status_code == 200, f"login {identifier}: {r.status_code} {r.text}"
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


def _fresh_submitted_project(cli_s, all_mandatory_met=True):
    """Create a Commercial project, fill responses, submit."""
    r = cli_s.post(f"{API}/client/projects", json={
        "name": f"TEST Phase2 {uuid.uuid4().hex[:6]}",
        "project_type": "Commercial",
    })
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    tpl = cli_s.get(f"{API}/client/projects/{pid}/template").json()
    responses = {}
    for cat in tpl["categories"]:
        for crit in cat.get("criteria", []):
            met = True if all_mandatory_met else not crit.get("mandatory")
            pts = 0 if crit.get("mandatory") else crit.get("max_points", 0)
            responses[crit["id"]] = {"met": met, "claimed_points": pts}
    r = cli_s.put(f"{API}/client/projects/{pid}/responses", json={"responses": responses})
    assert r.status_code == 200, r.text
    r = cli_s.post(f"{API}/client/projects/{pid}/submit")
    assert r.status_code == 200, r.text
    return pid, tpl


def _assign(adm_s, pid, reviewer_id):
    r = adm_s.post(f"{API}/admin/portal/assign", json={"project_id": pid, "reviewer_id": reviewer_id})
    assert r.status_code == 200, r.text


# ---------------- Reviewer workflow ----------------
class TestReviewerWorkflow:
    def test_recommendations_and_request_changes_and_resubmit(self, client_sess, reviewer_sess, admin_sess):
        cli_s, _ = client_sess
        rev_s, rev_u = reviewer_sess
        adm_s, _ = admin_sess

        pid, tpl = _fresh_submitted_project(cli_s)
        _assign(adm_s, pid, rev_u["id"])

        # Reviewer sees full project + template
        r = rev_s.get(f"{API}/reviewer/projects/{pid}")
        assert r.status_code == 200
        proj = r.json()
        assert "template" in proj and "recommended_score" in proj
        assert proj["client"]["email"] == CLIENT_EMAIL

        # Save partial recommendations -> status becomes under_review, recommended_score returned
        crit_ids = [c["id"] for cat in tpl["categories"] for c in cat.get("criteria", [])]
        first_cid = crit_ids[0]
        rec = {first_cid: {"met": True, "recommended_points": 1}}
        r = rev_s.put(f"{API}/reviewer/projects/{pid}/recommendations", json={"recommendations": rec})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["saved"] is True and "recommended_score" in data

        p = adm_s.get(f"{API}/admin/portal/certification-projects/{pid}").json()
        assert p["status"] == "under_review"

        # Request changes -> status changes_requested (comment optional but we send one)
        r = rev_s.post(f"{API}/reviewer/projects/{pid}/request-changes", json={"comment": "TEST please clarify criterion X"})
        assert r.status_code == 200
        assert r.json()["status"] == "changes_requested"

        # Client should now see reviewer_comment
        r = cli_s.get(f"{API}/client/projects/{pid}")
        assert r.status_code == 200
        got = r.json()
        assert got["status"] == "changes_requested"
        assert got.get("reviewer_comment") == "TEST please clarify criterion X"

        # Client edits + resubmits -> status becomes under_review (reviewer already assigned)
        # Ensure all mandatory are still met (they are)
        r = cli_s.post(f"{API}/client/projects/{pid}/submit")
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "under_review"

        # Client submit blocked when already under_review (409)
        r = cli_s.post(f"{API}/client/projects/{pid}/submit")
        assert r.status_code == 409

    def test_forward_blocks_until_mandatory_met_then_succeeds(self, client_sess, reviewer_sess, admin_sess):
        cli_s, _ = client_sess
        rev_s, rev_u = reviewer_sess
        adm_s, _ = admin_sess

        pid, tpl = _fresh_submitted_project(cli_s)
        _assign(adm_s, pid, rev_u["id"])

        # Try to forward with empty recommendations -> mandatory not met -> 400
        r = rev_s.post(f"{API}/reviewer/projects/{pid}/forward", json={"comment": "TEST fwd"})
        assert r.status_code == 400, r.text

        # Fill ALL mandatories + some points
        rec = {}
        for cat in tpl["categories"]:
            for crit in cat.get("criteria", []):
                if crit.get("mandatory"):
                    rec[crit["id"]] = {"met": True, "recommended_points": 0}
                else:
                    rec[crit["id"]] = {"met": True, "recommended_points": crit.get("max_points", 0)}
        r = rev_s.put(f"{API}/reviewer/projects/{pid}/recommendations", json={"recommendations": rec})
        assert r.status_code == 200

        r = rev_s.post(f"{API}/reviewer/projects/{pid}/forward", json={"comment": "TEST all good"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "forwarded"
        assert d["recommended_score"]["mandatory_ok"] is True
        assert d["recommended_score"]["claimed_total"] > 0

    def test_role_isolation_reviewer_endpoints(self, client_sess, admin_sess):
        cli_s, _ = client_sess
        adm_s, _ = admin_sess
        # client & admin cannot hit reviewer routes
        for s in (cli_s, adm_s):
            r = s.get(f"{API}/reviewer/assignments")
            assert r.status_code == 403
            r = s.put(f"{API}/reviewer/projects/xxx/recommendations", json={"recommendations": {}})
            assert r.status_code == 403


# ---------------- Admin certification (finalize) ----------------
class TestAdminCertification:
    def test_assign_draft_blocked_409(self, client_sess, reviewer_sess, admin_sess):
        cli_s, _ = client_sess
        _, rev_u = reviewer_sess
        adm_s, _ = admin_sess
        # create a draft (do not submit)
        r = cli_s.post(f"{API}/client/projects", json={
            "name": f"TEST DraftAssign {uuid.uuid4().hex[:6]}",
            "project_type": "Commercial",
        })
        pid = r.json()["id"]
        r = adm_s.post(f"{API}/admin/portal/assign", json={"project_id": pid, "reviewer_id": rev_u["id"]})
        assert r.status_code == 409, r.text

    def test_finalize_full_flow(self, client_sess, reviewer_sess, admin_sess):
        cli_s, _ = client_sess
        rev_s, rev_u = reviewer_sess
        adm_s, _ = admin_sess

        pid, tpl = _fresh_submitted_project(cli_s)
        _assign(adm_s, pid, rev_u["id"])

        # Admin detail endpoint returns template + scores + client + reviewer
        r = adm_s.get(f"{API}/admin/portal/certification-projects/{pid}")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "template" in d and "claimed_score" in d and "recommended_score" in d
        assert d["client"]["email"] == CLIENT_EMAIL
        assert d["reviewer"]["email"] == REV_EMAIL

        # Attempt finalize as 'certified' but with empty final -> 400
        r = adm_s.post(f"{API}/admin/portal/projects/{pid}/finalize", json={
            "final": {}, "decision": "certified", "certificate": {}
        })
        assert r.status_code == 400

        # Build final responses with all mandatory met
        final = {}
        for cat in tpl["categories"]:
            for crit in cat.get("criteria", []):
                if crit.get("mandatory"):
                    final[crit["id"]] = {"met": True, "final_points": 0}
                else:
                    final[crit["id"]] = {"met": True, "final_points": crit.get("max_points", 0)}
        r = adm_s.post(f"{API}/admin/portal/projects/{pid}/finalize", json={
            "final": final,
            "decision": "certified",
            "certificate": {
                "number": f"TEST-RES-{uuid.uuid4().hex[:6]}",
                "issued_date": "2026-01-15",
                "valid_until": "2029-01-14",
                "notes": "TEST cert",
            },
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "certified"
        assert d["official_record"]["certificate_number"].startswith("TEST-RES-")
        assert d["final_score"]["claimed_total"] > 0

        # Client sees official_record + final_score
        r = cli_s.get(f"{API}/client/projects/{pid}")
        assert r.status_code == 200
        got = r.json()
        assert got["status"] == "certified"
        assert got.get("official_record", {}).get("certificate_number", "").startswith("TEST-RES-")
        assert got.get("final_score", {}).get("claimed_total", 0) > 0

    def test_finalize_rejected_flow(self, client_sess, reviewer_sess, admin_sess):
        cli_s, _ = client_sess
        _, rev_u = reviewer_sess
        adm_s, _ = admin_sess
        pid, tpl = _fresh_submitted_project(cli_s)
        _assign(adm_s, pid, rev_u["id"])
        # rejected doesn't require mandatory
        r = adm_s.post(f"{API}/admin/portal/projects/{pid}/finalize", json={
            "final": {}, "decision": "rejected",
            "certificate": {"notes": "TEST rejected"},
        })
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "rejected"
        # client sees rejected
        r = cli_s.get(f"{API}/client/projects/{pid}")
        assert r.status_code == 200
        assert r.json()["status"] == "rejected"
