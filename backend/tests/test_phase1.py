"""Phase 1 backend tests: bookings, certification finder, assessment, industries,
methodology, resources, unified leads, dashboard analytics, and Phase-1 CRUDs."""
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
ADMIN_ID = "admin"
ADMIN_PW = "ResAdmin@2026"


@pytest.fixture(scope="session")
def public():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/admin/auth/login", json={"identifier": ADMIN_ID, "password": ADMIN_PW})
    assert r.status_code == 200, r.text
    csrf = s.cookies.get("csrf_token")
    assert csrf
    s.headers.update({"X-CSRF-Token": csrf, "Content-Type": "application/json"})
    return s


# ---- Public content: industries, methodology, resources ----
class TestPublicPhase1Content:
    def test_industries_list(self, public):
        r = public.get(f"{API}/public/industries")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) >= 8, f"expected 8+ industries, got {len(items)}"
        assert all("slug" in i and ("title" in i or "name" in i) for i in items)

    def test_industry_detail(self, public):
        items = public.get(f"{API}/public/industries").json()
        slug = items[0]["slug"]
        r = public.get(f"{API}/public/industries/{slug}")
        assert r.status_code == 200
        d = r.json()
        assert d["slug"] == slug

    def test_industry_detail_404(self, public):
        r = public.get(f"{API}/public/industries/no-such-slug-xyz")
        assert r.status_code == 404

    def test_methodology(self, public):
        r = public.get(f"{API}/public/methodology")
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 7, f"expected 7 methodology steps, got {len(items)}"

    def test_resources(self, public):
        r = public.get(f"{API}/public/resources")
        assert r.status_code == 200
        payload = r.json()
        items = payload["items"]
        assert any("Capability" in (i.get("title") or "") for i in items), \
            f"expected 'RES Capability Profile' in resources, got titles={[i.get('title') for i in items]}"

    def test_assessment_questions_public(self, public):
        r = public.get(f"{API}/public/assessment-questions")
        assert r.status_code == 200
        qs = r.json()
        assert len(qs) >= 7
        # scores must NOT be exposed publicly
        for q in qs:
            assert "weight" not in q
            for o in q.get("options", []):
                assert "score" not in o


# ---- Public forms ----
class TestPublicForms:
    def test_booking_creates_lead_and_booking(self, public, admin):
        email = f"test_book_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "name": "TEST Booking",
            "email": email,
            "phone": "+911234567890",
            "company": "TEST Co",
            "service": "Audit & Energy",
            "preferred_date": "2026-02-15",
            "preferred_time": "10:00",
            "meeting_mode": "Online",
            "message": "TEST booking message",
        }
        r = public.post(f"{API}/public/bookings", json=payload)
        assert r.status_code == 200, r.text

        # verify booking in admin
        r2 = admin.get(f"{API}/admin/bookings", params={"search": email})
        assert r2.status_code == 200
        items = r2.json()["items"]
        assert any(b["email"] == email for b in items), "booking not persisted"

        # verify lead created with Discovery Call source
        r3 = admin.get(f"{API}/admin/leads", params={"search": email})
        leads = r3.json()["items"]
        assert any(l["email"] == email and l["source"] == "Discovery Call" for l in leads), \
            f"Discovery Call lead not found: {[l.get('source') for l in leads]}"

    def test_certification_finder(self, public, admin):
        email = f"test_finder_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "name": "TEST Finder",
            "email": email,
            "company": "TEST",
            "building_type": "Data Centres",
            "construction_type": "New Construction",
            "priorities": ["Energy Efficiency", "Water Conservation"],
            "desired_outcome": "LEED",
        }
        r = public.post(f"{API}/public/certification-finder", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "suggestions" in d and len(d["suggestions"]) > 0
        assert "disclaimer" in d and "next_steps" in d
        for s in d["suggestions"]:
            assert "framework" in s and "reasons" in s

        # lead created
        r3 = admin.get(f"{API}/admin/leads", params={"search": email})
        leads = r3.json()["items"]
        assert any(l["email"] == email and l["source"] == "Certification Finder" for l in leads)

        # certification result persisted
        r4 = admin.get(f"{API}/admin/certification-results")
        assert r4.status_code == 200
        results = r4.json()["items"]
        assert any(x["email"] == email for x in results)

    def test_assessment(self, public, admin):
        # answer all questions with option index 0
        qs = public.get(f"{API}/public/assessment-questions").json()
        answers = {q["id"]: 0 for q in qs}
        email = f"test_assess_{uuid.uuid4().hex[:8]}@example.com"
        r = public.post(f"{API}/public/assessment", json={
            "name": "TEST Assess",
            "email": email,
            "answers": answers,
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert 0 <= d["overall_score"] <= 100
        assert d["band"] in ["Getting Started", "Developing", "Ready", "Leading"]
        assert isinstance(d["category_scores"], dict)
        assert "recommendations" in d and "suggested_services" in d

        # lead created
        r3 = admin.get(f"{API}/admin/leads", params={"search": email})
        leads = r3.json()["items"]
        assert any(l["email"] == email and l["source"] == "Readiness Assessment" for l in leads)

        # assessment result persisted
        r4 = admin.get(f"{API}/admin/assessment-results")
        results = r4.json()["items"]
        assert any(x["email"] == email for x in results)

    def test_contact_creates_lead(self, public, admin):
        # regression: enquiry endpoint also creates a lead
        email = f"test_enq_lead_{uuid.uuid4().hex[:8]}@example.com"
        r = public.post(f"{API}/public/enquiries", json={
            "name": "TEST Enq Lead",
            "email": email,
            "message": "TEST enquiry that should also create a lead",
            "source_page": "/contact",
            "service_of_interest": "Green Building",
        })
        assert r.status_code == 200
        r3 = admin.get(f"{API}/admin/leads", params={"search": email})
        leads = r3.json()["items"]
        assert any(l["email"] == email and l["source"] == "Contact Form" for l in leads)


# ---- Admin: leads, bookings, results ----
class TestAdminPhase1:
    def test_leads_list_and_sources(self, admin):
        r = admin.get(f"{API}/admin/leads")
        assert r.status_code == 200
        d = r.json()
        sources = set(d["sources"])
        # After earlier tests, we should have multiple sources present
        expected = {"Contact Form", "Discovery Call", "Certification Finder", "Readiness Assessment"}
        assert expected.issubset(sources), f"missing sources; got {sources}"

    def test_leads_filter_by_source(self, admin):
        r = admin.get(f"{API}/admin/leads", params={"source": "Discovery Call"})
        assert r.status_code == 200
        assert all(l["source"] == "Discovery Call" for l in r.json()["items"])

    def test_lead_patch_status_note(self, admin):
        # pick any lead
        items = admin.get(f"{API}/admin/leads").json()["items"]
        assert items
        lid = items[0]["id"]
        r = admin.patch(f"{API}/admin/leads/{lid}", json={
            "status": "Follow-up",
            "next_follow_up": "2026-03-01",
            "admin_note": "TEST follow-up note",
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "Follow-up"
        assert d.get("admin_note") == "TEST follow-up note"

    def test_leads_export_csv(self, admin):
        r = admin.get(f"{API}/admin/leads/export")
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert "email" in r.text.lower() or "@" in r.text

    def test_booking_update_status(self, admin, public):
        # create fresh booking
        email = f"test_bstat_{uuid.uuid4().hex[:6]}@example.com"
        public.post(f"{API}/public/bookings", json={
            "name": "TEST BS", "email": email, "service": "Audit & Energy"
        })
        items = admin.get(f"{API}/admin/bookings", params={"search": email}).json()["items"]
        assert items
        bid = items[0]["id"]
        r = admin.patch(f"{API}/admin/bookings/{bid}", json={"status": "Confirmed"})
        assert r.status_code == 200
        assert r.json()["status"] == "Confirmed"

    def test_dashboard_phase1_metrics(self, admin):
        r = admin.get(f"{API}/admin/dashboard")
        assert r.status_code == 200
        d = r.json()
        for k in ["total_leads", "total_bookings", "assessment_completions",
                  "certification_completions", "total_industries",
                  "total_resources", "resource_downloads"]:
            assert k in d, f"dashboard missing {k}"
        assert d["total_industries"] >= 8
        assert d["total_leads"] >= 1
        assert d["total_bookings"] >= 1


# ---- Phase-1 CRUD via register_crud ----
class TestPhase1CRUDs:
    @pytest.mark.parametrize("coll", [
        "industries", "methodology_steps", "resources", "partners",
        "events", "certification_rules", "assessment_questions",
    ])
    def test_list_endpoint(self, admin, coll):
        r = admin.get(f"{API}/admin/{coll}")
        assert r.status_code == 200, f"{coll}: {r.status_code} {r.text}"
        assert isinstance(r.json(), list)

    def test_industry_create_and_delete(self, admin, public):
        title = f"TEST Industry {uuid.uuid4().hex[:6]}"
        r = admin.post(f"{API}/admin/industries", json={
            "name": title,
            "slug": f"test-industry-{uuid.uuid4().hex[:6]}",
            "summary": "TEST",
            "challenges": ["c1"],
            "solutions": ["s1"],
            "active": True,
            "display_order": 999,
        })
        assert r.status_code == 200, r.text
        doc = r.json()
        iid, slug = doc["id"], doc["slug"]

        # Appears in public list
        pub_items = public.get(f"{API}/public/industries").json()
        assert any(x["slug"] == slug for x in pub_items)

        # cleanup
        r = admin.delete(f"{API}/admin/industries/{iid}")
        assert r.status_code == 200
