# RES — Complete Requirements (Source of Truth)

> Living document. Update whenever functionality changes. Derived from the RES Capability PDF (company content) and the IGBC Green New Buildings v4 PDF (rating rules). Do NOT reproduce the full copyrighted IGBC guide publicly — only authorised checklist data is stored for the private assessment workflow.

## Product
Two surfaces on ONE app (React JS + FastAPI + MongoDB), NOT separate apps:
1. **Public marketing website** (existing — preserve): Home, About, Services (+detail, mega menu), Projects, Team, Tools (GHG etc.), Events, Blog, Resources, Book Consultation, Contact, Legal, Admin CMS.
2. **Client Certification Portal** (new): role-based (Client / Reviewer / Admin) IGBC-style certification workflow.

## Roles
- **Admin** — exactly one seeded account (existing). Manages website + certification portal. Creates Reviewers.
- **Reviewer** — created by Admin only (no public signup). Reviews assigned projects.
- **Client** — self-registers publicly with email OTP. Owns certification projects.
Role is enforced server-side (FastAPI); never chosen by the user.

## Phase 1 (this milestone → foundation delivered)
Multi-role auth + client OTP registration + role redirect; certification project creation & list; sequential Commercial (IGBC v4) wizard with claimed scoring, auto-save, submit; admin certification list + reviewer creation + assignment; reviewer assignment list.

## Phase 1 (remaining — next steps)
Full reviewer review UI (recommend points, request changes, forward), admin final review/decision, versioned resubmission, notifications, project status timeline, audit logs surfacing, documents versioning UI.

## Phase 2
Residential/Hotel/Hospital authorised checklists, score simulator, action plan, cost/feasibility, submission docket, branded PDF report, official certificate records, appeals, analytics, expiry reminders.

## Non-negotiables
- Preserve all existing public + admin functionality, APIs, DB content.
- Public projects and private certification projects are SEPARATE collections.
- Missing rating template → allow project, show "checklist under configuration", never fake a score.
- Preliminary disclaimer everywhere: "RES Internal/Preliminary Assessment — not an official IGBC certification." Official certification only when Admin uploads official certificate record.
- No copied external branding (SD+, Ploxi, IGBC logos) without authorisation.
