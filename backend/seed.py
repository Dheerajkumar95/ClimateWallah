import os
import uuid
from datetime import datetime, timezone

from database import db
from auth import hash_password


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def _slug(text):
    import re
    s = text.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return re.sub(r"-+", "-", s).strip("-")


async def seed_admin():
    login_id = os.environ.get("ADMIN_LOGIN_ID", "admin")
    email = os.environ.get("ADMIN_EMAIL", "admin@resilientearth.in").lower()
    password = os.environ.get("ADMIN_INITIAL_PASSWORD", "ResAdmin@2026")
    existing = await db.admins.find_one({"$or": [{"login_id": login_id}, {"email": email}]})
    if existing is None:
        await db.admins.insert_one({
            "id": str(uuid.uuid4()),
            "login_id": login_id,
            "email": email,
            "name": "RES Administrator",
            "password_hash": hash_password(password),
            "must_change_password": False,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        })


SERVICES = [
    {
        "title": "Audit & Energy",
        "icon": "gauge",
        "short_description": "Comprehensive building audits and energy performance optimisation across the full asset lifecycle.",
        "full_description": "Our Audit & Energy practice helps building owners and operators measure, verify and improve performance. We combine third-party commissioning, detailed energy modelling and on-site testing to identify efficiency opportunities, reduce operating costs and ensure systems perform as designed.",
        "features": ["Building Commissioning", "Energy Modelling & Lighting Simulation", "Air Quality Testing", "Energy Audit", "Waste & Water Audit", "Fire Audit"],
        "image": "https://images.pexels.com/photos/371917/pexels-photo-371917.jpeg",
    },
    {
        "title": "Building Certification",
        "icon": "award",
        "short_description": "End-to-end green building certification across all major national and international frameworks.",
        "full_description": "We guide projects through every stage of green building certification. Our accredited consultants work across energy, environment, waste, health and wellness rating systems to deliver certified outcomes tailored to your regional requirements, organisational goals and budget.",
        "features": ["Energy & Environment – LEED, IGBC, GRIHA, EDGE", "Waste Management – TRUE", "Health & Wellness – WELL"],
        "image": "https://images.unsplash.com/photo-1556983852-43bf21186b2a",
    },
    {
        "title": "Climate Action Plan",
        "icon": "leaf",
        "short_description": "Strategic decarbonisation pathways from science-based targets to net zero carbon.",
        "full_description": "We help organisations define and deliver credible climate strategies. From setting science-based targets to building a net zero carbon roadmap and assessing sustainability performance, we turn ambition into measurable, actionable plans.",
        "features": ["Science-based Targets Setting", "Net Zero Carbon Strategy", "Sustainability Assessment"],
        "image": "https://images.pexels.com/photos/2104499/pexels-photo-2104499.jpeg",
    },
    {
        "title": "Data Management & Reporting",
        "icon": "bar-chart-3",
        "short_description": "Robust ESG data management, accounting and disclosure aligned to global standards.",
        "full_description": "Our Data Management & Reporting services help organisations capture, manage and disclose sustainability performance with confidence. We support greenhouse gas accounting, ESG regulatory review, CDP submissions and ongoing sustainability data management.",
        "features": ["GHG Accounting", "ESG Regulatory Review", "CDP Submissions", "Sustainability Data Management"],
        "image": "https://images.unsplash.com/photo-1606836591695-4d58a73eba1e",
    },
]

TEAM = [
    {"name": "Ankita Verma", "designation": "Founder & Director", "credentials": "IGBC AP, GRIHA CP, LEED AP"},
    {"name": "Pratishu Kumar", "designation": "Associate Director", "credentials": "IGBC AP"},
    {"name": "Priyadarshi Das", "designation": "Vice President, Operations", "credentials": "IGBC AP"},
    {"name": "Ayush Anand", "designation": "Honorary Advisor", "credentials": "IGBC AP, SCR"},
    {"name": "Pratik Kumar", "designation": "Advisory Consultant", "credentials": "USGBC Faculty"},
    {"name": "Pratisar Singh", "designation": "Marketing Consultant", "credentials": "IGBC AP"},
]

# (title, location, category, certification)
PROJECTS = [
    ("Raheja Mindspace – Building 12B, 12C", "Hyderabad", "LEED C&S", "Certified Gold"),
    ("Adore Building", "Pune", "Building Certification", "IGBC LEED India – Gold Certified"),
    ("Ascendas – Phase 2", "Pune", "LEED Core & Shell", "Certified Gold"),
    ("Bharatiya City", "Bangalore", "Building Certification", "LEED India Gold Certified"),
    ("TCS TRIL", "Chennai", "Building Commissioning", "Gold Certified (Third-party Building Commissioning)"),
    ("Hexaware", "Pune", "Building Certification", "LEED Platinum Certified"),
    ("Umiya Business Bay – 02", "Bangalore", "Building Certification", "LEED Gold Certified"),
    ("Prestige Ferns", "Bangalore", "LEED C&S", "Platinum Certified"),
    ("Ecocenter Park", "Kolkata", "LEED C&S", "Gold Certified"),
    ("ETA Mall", "Bangalore", "LEED C&S", "Gold Certified"),
    ("IT-6 Nacharam (Raheja)", "Hyderabad", "Building Certification", "Gold Certified"),
    ("Raffles Udaipur", "Udaipur", "Energy Audit", "Energy Audit"),
    ("Google I4 – RMZ Infinity", "Bangalore", "LEED CI", "Platinum Certified"),
    ("Google Signature Tower B", "Gurgaon", "Building Certification", "Platinum Certified"),
    ("Juniper Networks – Elnath Building", "Bangalore", "Building Certification", "LEED Platinum Certified"),
    ("Schneider Electric – One Campus", "Hoskote, Bangalore", "Building Certification", "Platinum Certified"),
    ("Barclays – BTCI", "Pune", "LEED CI", "Platinum Certified"),
    ("ICICI Data Centre", "Hyderabad", "Data Centre Rating", "IGBC Platinum Certified"),
    ("Netmagic Data Centre", "Bangalore", "Data Centre Rating", "IGBC Platinum Certified"),
    ("Samhi Hotel", "Bangalore", "LEED CI & IGBC C&S", "Platinum Certified"),
    ("Schindler R&D", "Pune", "LEED NC & IGBC Factory", "Platinum & Gold Certified"),
    ("Infosys – SDB-07", "Mysore", "LEED NC & LEED CI", "Platinum Certified"),
    ("EMC", "Bangalore", "LEED CI", "Platinum Certified"),
    ("DHL India – Bangalore Office", "Bangalore", "LEED CI", "Platinum Certified"),
]

PROJECT_IMAGES = [
    "https://images.unsplash.com/photo-1556983852-43bf21186b2a",
    "https://images.unsplash.com/photo-1451976426598-a7593bd6d0b2",
    "https://images.unsplash.com/photo-1443527394413-4b820fd08dde",
    "https://images.unsplash.com/photo-1521708266372-b3547456cc2d",
    "https://images.unsplash.com/photo-1535689077097-a8726b5ff822",
    "https://images.unsplash.com/photo-1617761141732-d481912af1a9",
]

CREDENTIALS = ["USGBC LEED", "IGBC", "GRIHA", "EDGE", "WiredScore", "WELL", "TRUE"]
CREDENTIAL_LOGOS = [
    {"name": "LEED", "image": "https://static.prod-images.emergentagent.com/jobs/4802f517-df95-41f2-81d6-255f9deb6754/images/2127f01632ecfda19cfe4a7988dd406596f6ad7685cfa0f295ac0193217a7a3e.jpeg"},
    {"name": "IGBC", "image": "https://static.prod-images.emergentagent.com/jobs/4802f517-df95-41f2-81d6-255f9deb6754/images/40e0708acf62c526e20720350b1db3391bfb422d6bb3094dcd491e08b819231a.jpeg"},
    {"name": "GRIHA", "image": "https://static.prod-images.emergentagent.com/jobs/4802f517-df95-41f2-81d6-255f9deb6754/images/5923de001f19e807501ac0b15313cb0bdc32fab652657978bf93f6b41af9e806.jpeg"},
    {"name": "EDGE", "image": "https://static.prod-images.emergentagent.com/jobs/4802f517-df95-41f2-81d6-255f9deb6754/images/4f070f4a06cd1c5d8b9b825c145c0581f9ef5d5e59e5fee65461f19761496eec.jpeg"},
    {"name": "WELL", "image": "https://static.prod-images.emergentagent.com/jobs/4802f517-df95-41f2-81d6-255f9deb6754/images/554e70ca11287a70e661876cc68cfc5b71173b8ef1c5b6f5dce40de050238480.jpeg"},
]
COLLABORATIONS = ["IGBC", "USGBC", "GRIHA", "International WELL Building Institute", "ASHRAE",
                  "EDGE", "WiredScore", "ISHRAE", "Global Network for Zero",
                  "Energy Conservation Building Code (ECBC)", "GreenPro", "Bureau of Energy Efficiency (BEE)"]


async def seed_content():
    if await db.services.count_documents({}) == 0:
        for i, s in enumerate(SERVICES):
            await db.services.insert_one({
                "id": str(uuid.uuid4()), "slug": _slug(s["title"]), "title": s["title"],
                "icon": s["icon"], "image": s["image"], "short_description": s["short_description"],
                "full_description": s["full_description"], "features": s["features"],
                "display_order": i, "active": True,
                "seo_title": f"{s['title']} | Resilient Earth Solutions",
                "seo_description": s["short_description"],
                "created_at": now_iso(), "updated_at": now_iso(),
            })

    if await db.projects.count_documents({}) == 0:
        for i, (title, loc, cat, cert) in enumerate(PROJECTS):
            await db.projects.insert_one({
                "id": str(uuid.uuid4()), "slug": _slug(f"{title}-{loc}"), "title": title,
                "location": loc, "category": cat, "certification": cert, "capacity": "",
                "completion_date": "", "short_description": f"{cat} project in {loc} — {cert}.",
                "full_description": f"{title} is a {cat} engagement located in {loc}. Resilient Earth Solutions supported the project to achieve {cert}.",
                "cover_image": PROJECT_IMAGES[i % len(PROJECT_IMAGES)], "gallery": [],
                "featured": i < 6, "status": "published", "display_order": i,
                "seo_title": f"{title} | RES Projects", "seo_description": f"{cat} — {cert} in {loc}.",
                "created_at": now_iso(), "updated_at": now_iso(),
            })

    if await db.team_members.count_documents({}) == 0:
        for i, m in enumerate(TEAM):
            await db.team_members.insert_one({
                "id": str(uuid.uuid4()), "name": m["name"], "designation": m["designation"],
                "credentials": m["credentials"], "biography": "", "profile_image": "",
                "linkedin_url": "", "display_order": i, "active": True,
                "created_at": now_iso(), "updated_at": now_iso(),
            })

    if await db.website_settings.count_documents({}) == 0:
        await db.website_settings.insert_one({
            "id": "settings",
            "company_name": "Resilient Earth Solutions Pvt. Ltd.",
            "short_name": "RES",
            "cin": "U70200BR2025PTC074681",
            "logo": "", "favicon": "",
            "primary_phone": "+91 997 115 8548",
            "secondary_phone": "+91 890 428 7542",
            "primary_email": "verma.ankita91@gmail.com",
            "secondary_email": "rudraenergya22@gmail.com",
            "corporate_address": "MG 01 B, 2nd Floor, Eldeco Mystic Greens, Omicron I, Greater Noida, Uttar Pradesh 201310",
            "registered_address": "Mathiya Mohalla, Raj Ghath, Buxar, Bihar 802101",
            "business_hours": "Mon – Sat, 9:30 AM – 6:30 PM IST",
            "google_maps_url": "https://www.google.com/maps/search/?api=1&query=Eldeco+Mystic+Greens+Greater+Noida",
            "linkedin_url": "", "facebook_url": "", "instagram_url": "", "youtube_url": "",
            "footer_text": "Sustainability consulting for a greener, cleaner future.",
            "copyright_text": "© 2026 Resilient Earth Solutions Pvt. Ltd. All rights reserved.",
            "credentials": CREDENTIALS, "collaborations": COLLABORATIONS,
            "credential_logos": CREDENTIAL_LOGOS,
            "updated_at": now_iso(),
        })

    if await db.seo_settings.count_documents({}) == 0:
        await db.seo_settings.insert_one({
            "id": "seo",
            "default_title": "Resilient Earth Solutions — Sustainability Consulting",
            "default_description": "RES provides end-to-end sustainability and green building consulting across LEED, IGBC, GRIHA, EDGE and WELL frameworks.",
            "default_keywords": "sustainability consulting, green building, LEED, IGBC, GRIHA, net zero, energy audit, India",
            "og_image": "https://images.unsplash.com/photo-1556983852-43bf21186b2a",
            "updated_at": now_iso(),
        })

    if await db.homepage.count_documents({}) == 0:
        await db.homepage.insert_one({
            "id": "homepage",
            "hero_title": "Building a resilient future for our planet",
            "hero_subtitle": "End-to-end sustainability consulting across every major green building framework — transforming challenges into long-term value.",
            "hero_image": "https://images.unsplash.com/photo-1556983852-43bf21186b2a",
            "hero_overlay_opacity": 70,
            "cta_primary_text": "Explore Our Projects", "cta_primary_link": "/projects",
            "cta_secondary_text": "Download Capability Profile", "cta_secondary_link": "/capability-profile",
            "intro_heading": "Caring for the Globe",
            "intro_text": "We provide end-to-end guidance throughout the building lifecycle—from initial concept and design development through construction, occupancy, and ongoing operations. Our consultants are accredited across all major green building certification frameworks including USGBC LEED, IGBC, GRIHA, EDGE and WiredScore.",
            "mission": "To provide sustainability services to every household.",
            "stats": [
                {"label": "Projects Completed", "value": "24+"},
                {"label": "Certification Frameworks", "value": "7"},
                {"label": "Cities Served", "value": "10+"},
                {"label": "Accredited Experts", "value": "6"},
            ],
            "values": [
                "To be a responsible business",
                "To advocate for a greener & cleaner future",
                "To be a valued partner in your sustainability story",
                "To drive long-term value for clients & communities",
                "To invest in the power of people",
                "To deliver excellence in service",
            ],
            "why_choose": [
                {"title": "Accredited Across Frameworks", "text": "Our consultants are accredited across USGBC LEED, IGBC, GRIHA, EDGE and WiredScore."},
                {"title": "Full Lifecycle Support", "text": "Guidance from concept and design through construction, occupancy and operations."},
                {"title": "Tailored Approach", "text": "Solutions matched to your regional requirements, organisational goals and budget."},
                {"title": "Long-term Value", "text": "We transform sustainability challenges into opportunities for innovation and value creation."},
            ],
            "contact_cta_heading": "Ready to start your sustainability journey?",
            "contact_cta_text": "Partner with RES to turn sustainability ambition into measurable outcomes.",
            "sections": {"services": True, "mission": True, "values": True, "featured_projects": True,
                         "credentials": True, "why_choose": True, "team": True, "blog": True, "contact_cta": True},
            "updated_at": now_iso(),
        })

    if await db.about.count_documents({}) == 0:
        await db.about.insert_one({
            "id": "about",
            "heading": "About Resilient Earth Solutions",
            "intro": "We provide end-to-end guidance throughout the building lifecycle—from initial concept and design development through construction, occupancy, and ongoing operations. Our consultants are accredited across all major green building certification frameworks including USGBC LEED, IGBC, GRIHA, EDGE and WiredScore allowing us to tailor our approach to your specific regional requirements, organizational goals, and budget parameters. We transform sustainability challenges into opportunities for innovation, differentiation, and long-term value creation.",
            "mission": "To provide sustainability services to every household.",
            "motto": "Caring for the Globe",
            "approach": "Together, our values form the blueprint for how we operate as partners in your sustainability journey, always keeping our shared responsibility to the planet at the forefront.",
            "values": [
                "To be a responsible business",
                "To advocate for a greener & cleaner future",
                "To be a valued partner in your sustainability story",
                "To drive long-term value for clients & communities",
                "To invest in the power of people",
                "To deliver excellence in service",
            ],
            "commitment": "As a responsible business, we advocate for a greener and cleaner future and remain committed to driving long-term value for our clients and communities.",
            "credentials": CREDENTIALS,
            "collaborations": COLLABORATIONS,
            "cin": "U70200BR2025PTC074681",
            "image": "https://images.unsplash.com/photo-1706074797611-a02f9ed06439",
            "updated_at": now_iso(),
        })

    if await db.blog_posts.count_documents({}) == 0:
        await db.blog_posts.insert_one({
            "id": str(uuid.uuid4()),
            "slug": "why-green-building-certification-is-a-strategic-advantage",
            "title": "Why Green Building Certification Is a Strategic Advantage",
            "category": "Sustainability",
            "author": "RES Team",
            "excerpt": "Green building certification is no longer a nice-to-have. From LEED and IGBC to GRIHA, EDGE and WELL, certification frameworks turn sustainability ambition into measurable, verifiable performance—and lasting value.",
            "cover_image": "https://images.unsplash.com/photo-1556983852-43bf21186b2a",
            "content": (
                "<p>Across India and the world, the built environment is under pressure to do more with less: less energy, less water, less waste and a smaller carbon footprint. Green building certification frameworks give owners, developers and occupiers a credible, third-party way to prove that a building actually delivers on those goals.</p>"
                "<h2>A common language for performance</h2>"
                "<p>Frameworks such as <strong>USGBC LEED</strong>, <strong>IGBC</strong>, <strong>GRIHA</strong>, <strong>EDGE</strong> and <strong>WELL</strong> translate broad sustainability intentions into specific, auditable requirements—covering energy efficiency, water conservation, indoor environmental quality, materials and human wellbeing. Certification provides a shared language that investors, tenants and regulators all understand.</p>"
                "<h2>Value beyond compliance</h2>"
                "<p>Certified buildings typically see lower operating costs, stronger occupant satisfaction and higher asset value. Just as importantly, certification de-risks sustainability claims at a time when greenwashing is under growing scrutiny. A recognised rating is independent evidence that the performance is real.</p>"
                "<h2>Choosing the right pathway</h2>"
                "<p>There is no single &lsquo;best&rsquo; certification. The right choice depends on building type, location, budget and organisational goals. An energy-intensive data centre, a corporate campus and a hospitality asset each call for a different strategy. The role of a sustainability consultant is to map those goals to the most appropriate framework—and to guide the project from concept and design through construction, occupancy and operations.</p>"
                "<h2>Getting started</h2>"
                "<p>The earlier certification is considered in a project, the greater the impact and the lower the cost. Engaging accredited professionals during design—rather than retrofitting requirements later—unlocks the full value of certification.</p>"
                "<p>If you are planning a new development or looking to improve an existing asset, our team can help you identify the right pathway and deliver a certified outcome.</p>"
            ),
            "status": "published",
            "featured": True,
            "display_order": 0,
            "seo_title": "Why Green Building Certification Is a Strategic Advantage | RES",
            "seo_description": "How LEED, IGBC, GRIHA, EDGE and WELL certification turns sustainability ambition into measurable performance and lasting asset value.",
            "created_at": now_iso(),
            "updated_at": now_iso(),
        })


    for slug, title in [("privacy-policy", "Privacy Policy"), ("terms-and-conditions", "Terms and Conditions"), ("cookie-policy", "Cookie Policy")]:
        if await db.legal_pages.find_one({"slug": slug}) is None:
            await db.legal_pages.insert_one({
                "id": str(uuid.uuid4()), "slug": slug, "title": title,
                "content": f"<p>This {title} page content can be edited from the admin panel. Please add your official {title.lower()} here.</p>",
                "updated_at": now_iso(),
            })


async def run_seed():
    await seed_admin()
    await seed_content()
