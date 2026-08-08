# RES Website — Product Requirements Document

## Original Problem Statement
Build a complete, production-ready corporate website + single-admin CMS for **Resilient Earth Solutions Pvt. Ltd. (RES)**, a green-building sustainability consulting firm. All company content sourced verbatim from the supplied `RES Capability.pdf` (no fabricated facts). Visual style: premium, sustainable, editorial — deep forest green palette, Cormorant Garamond + Outfit typography, Framer Motion animation.

## Architecture
- **Frontend:** React (CRA/JS) + Tailwind + Framer Motion + shadcn/ui + React Router + Axios + React Hook Form + Zod. Served on port 3000.
- **Backend:** FastAPI + MongoDB (motor). All routes under `/api`. Port 8001.
- **Auth:** JWT in HTTP-only cookie + CSRF double-submit token; bcrypt hashing; login rate-limit (5/15min); login by Admin ID OR Email.
- **Email:** Emergent-managed Resend — admin notification on new enquiry.
- **Uploads:** Disk under `backend/uploads/{images,documents}`, served at `/api/uploads/*`, metadata in Mongo.

## User Personas
- **Public visitor / prospective client** — browses services, projects, team, insights; submits enquiries; downloads capability profile.
- **RES Admin (single account)** — manages all content, enquiries, media, settings.

## Core Requirements (static)
- Public pages: Home, About, Services (+detail), Projects (+detail, filters/search), Team, Blog (+detail), Contact, Capability Profile, Legal.
- Single admin at `/admin` (no signup): Dashboard, Homepage, About, Services, Projects, Team, Blog, Enquiries, Media, Capability PDF, Website Settings, SEO, Legal, Change Password.
- All content DB-driven and editable; admin changes reflect publicly.

## Implemented (2026-06)
- ✅ Full base site (see below) + **Phase‑1 advisory hub expansion (2026-06)**:
  - Unified **Leads** system — every form (Contact, Discovery Call, Certification Finder, Readiness Assessment, Resource download) creates a lead. Admin Leads dashboard with status/source filters, notes, follow-up date, CSV export.
  - **Book a Free Consultation** (`/book`) + floating WhatsApp button + sticky CTA (admin-managed phone). Admin Bookings with statuses.
  - **Green Building Certification Finder** (`/certification-finder`) — configurable rules, preliminary suggestions with reasons/disclaimer, saved results + lead. Admin: Certification Rules + Finder Results.
  - **Sustainability Readiness Assessment** (`/assessment`) — 7-category scoring, band, gaps, recommendations, suggested services; saved results + lead. Admin: Assessment Questions + Results.
  - **Who We Serve / Industries** (`/industries` + detail) — 8 seeded industries, full CRUD.
  - **RES Methodology** — 7-step timeline on About; full CRUD.
  - **Resource Centre** (`/resources`) — downloads with counter, optional lead capture, PDF/DOCX upload; CRUD.
  - **Enhanced Service detail pages** — overview, problem, benefits, deliverables, methodology, industries, standards, FAQs, related projects + 3 CTAs.
  - **Partners** and **Events** collections + admin CRUD.
  - Expanded admin nav + dashboard analytics (leads, bookings, assessments, finder results, industries, downloads).
  - Verified: testing agent 24/24 backend + all Phase‑1 frontend flows (iteration_3), no defects.
- ✅ Base site earlier work:
- ✅ Full backend: auth, generic CRUD (services/projects/team/blog), enquiries (+CSV export, rate-limit, dup-prevent, email notify), singletons (homepage/about/settings/seo), legal, media & PDF uploads, dashboard, public APIs, sitemap/robots.
- ✅ Seeded verbatim from PDF: 4 services, 24 projects, 6 team, credentials, collaborations, contact info, CIN, mission/values.
- ✅ Full public website with premium design, animations, SEO meta, initials-based team avatars.
- ✅ Full admin panel with sidebar/drawer, CRUD tables + modals, editors, media library, PDF replace, change password.
- ✅ Verified: testing agent 28/28 backend + 11/11 frontend flows passed. Server-side password strength enforced. Test data cleaned.

## Admin Credentials
Login ID `admin` / Email `admin@resilientearth.in` / Password `ResAdmin@2026` (see `/app/memory/test_credentials.md`).

## Backlog (P1/P2)
- P1: Drag-and-drop reorder UI (backend reorder endpoint exists).
- P1: Blog live preview pane.
- P2: Logo/favicon rendering from settings across site + dynamic favicon.
- P2: Structured data (JSON-LD) injection for Organization/Blog.
- P2: Split `server.py` into routers for maintainability.
