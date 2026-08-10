# RES API & Database (Source of Truth)

## New collections (Phase‑1 foundation)
users (clients+reviewers, role field), pending_registrations, email_otps (embedded in pending), certification_projects, rating_systems, rating_versions, rating_categories, rating_criteria, review_assignments. (Existing: admins, services, projects, team_members, blog_posts, enquiries, leads, bookings, industries, methodology_steps, resources, partners, events, certification_rules, assessment_*, website_settings, seo_settings, homepage, about, legal_pages, media, documents.)

## Auth API (new)
POST /api/auth/client/register, /client/verify-otp, /client/resend-otp
POST /api/auth/login (admin+client+reviewer, returns role), /logout, GET /api/auth/me

## Client API
GET/POST /api/client/projects, GET /api/client/projects/{id}, PUT /api/client/projects/{id}/responses (auto-save), POST /api/client/projects/{id}/submit

## Reviewer API
GET /api/reviewer/assignments

## Admin API (portal)
GET /api/admin/portal/dashboard, GET /api/admin/portal/clients, POST /api/admin/portal/reviewers, GET /api/admin/portal/certification-projects, POST /api/admin/portal/assign

Existing public + admin CMS APIs preserved unchanged. JWT in HTTP-only cookie `access_token` + CSRF `csrf_token`. Roles enforced server-side.
