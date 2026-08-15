RES Sustainability & Certification Platform
A full-stack sustainability website and green-building certification workflow for Resilient Earth Solutions (RES). The application combines a public marketing website, an admin-managed CMS, sustainability tools, and separate workspaces for Clients, Reviewers, and Administrators.

Assessment notice: Results produced inside the portal are RES internal/preliminary assessments. They are not an official IGBC certification unless an authorised final certificate is issued and recorded by the Administrator.

Contents
Key features

Roles and workflow

Technology stack

Project structure

Local setup

Environment variables

Email and OTP setup

File storage

Testing

Production deployment

Troubleshooting

Security checklist

Project documentation

Key features
Public website
Home, About, Services, Projects, Team, Events, Blog/Resources, Contact, and Legal pages

Tools and calculators, including the GHG emissions calculator

Book-a-demo/consultation and enquiry forms

Downloadable capability profile

Responsive navigation with Services, Tools, and Events menus

SEO settings, sitemap, and robots endpoints

Website CMS
Administrators can manage:

Services and service details

Public projects and case studies

Team members

Blog posts, resources, and events

Enquiries, leads, and consultation bookings

Contact details, website settings, SEO, homepage content, and legal pages

Images, documents, and the capability PDF

Certification portal
Client registration with a six-digit email OTP

OTP expiry, resend cooldown, attempt limits, and verified accounts

Role-based login for Client, Reviewer, and Admin

Project types: Residential, Hotel, Commercial, and Hospital

Project details, team details, privacy settings, media, and geolocation

Sequential assessment sections with auto-save

Evidence uploads for individual criteria

Claimed, reviewer-recommended, and admin-final scores

Project timeline and status tracking

Reviewer assignment, comments, approval/rejection, and change requests

Admin-managed checklists, criteria, maximum points, and certification rules

PDF submission dockets and certificate records

MongoDB GridFS-backed image and document storage

Roles and workflow
Role Main responsibilities
Client Registers through OTP, creates projects, completes assessment sections, uploads evidence, submits projects, and responds to requested changes.
Reviewer Reviews assigned projects and evidence, records recommendations/comments, requests changes, and forwards completed reviews to Admin.
Admin Manages the website and portal, creates Reviewers, assigns projects, manages checklists, makes the final decision, and issues certification records.
The typical project flow is:

flowchart TD
A[Client draft] --> B[Client submission]
B --> C[Admin triage and reviewer assignment]
C --> D[Reviewer assessment]
D -->|Changes required| E[Client revision and resubmission]
E --> D
D -->|Recommended| F[Admin final review]
F --> G[Certified or rejected]
The client completes assessment categories one page at a time:

Sustainable Design

Water Conservation

Energy Efficiency

Materials and Resources

Resident Health and Wellbeing

Innovation and Design

The next section unlocks only after the current section's mandatory requirements are completed and saved. Category names, criteria, point limits, and certification thresholds are controlled by the active rating template.

Technology stack
Layer Technology
Frontend React, React Router, CRACO, Tailwind CSS, Axios, Radix UI, Lucide Icons
Maps Leaflet
Backend Python, FastAPI, Uvicorn, Pydantic
Database MongoDB with Motor
File storage MongoDB GridFS
Authentication JWT, HTTP-only cookies, CSRF protection, bcrypt
Email SMTP (GoDaddy Professional Email powered by Titan)
Reports ReportLab PDF generation
Testing Pytest and React Testing Library
Project structure
Path Purpose
frontend/src/ React website, CMS, and Client/Reviewer/Admin portal UI
frontend/src/lib/api.js API clients, CSRF handling, backend URL, and uploaded-file URL normalisation
backend/server.py FastAPI application and public/CMS routes
backend/portal.py Client, Reviewer, Admin, assessment, and certification APIs
backend/auth.py Admin authentication, cookies, JWT, CSRF, and lockout logic
backend/portal_auth.py Portal role-based access control
backend/rating_template.py Checklist templates, scoring, and certification logic
backend/email_service.py OTP and notification email delivery
backend/app/api/ Modular API routers, including files and GHG tools
backend/app/services/ GridFS, PDF, and calculation services
backend/scripts/ Maintenance and migration scripts
backend/tests/ Backend and portal regression tests
docs/ Product, workflow, API, design, and rating documentation
Local setup
Prerequisites
Install the following:

Python 3.11 (recommended; do not use Python 3.14 for the current pinned dependencies)

Node.js 20 LTS and npm

MongoDB 7+ locally, or a MongoDB Atlas connection string

Git

1. Clone the repository
   git clone <YOUR_REPOSITORY_URL>
   cd <YOUR_PROJECT_FOLDER>
2. Start the backend on Windows
   cd backend
   py -3.11 -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   Create backend/.env using the example in Environment variables, then run:

python -m uvicorn server:app --reload --host 127.0.0.1 --port 8000
Backend URLs:

API health: http://127.0.0.1:8000/api/health

Swagger API docs: http://127.0.0.1:8000/docs

ReDoc: http://127.0.0.1:8000/redoc

3. Start the frontend on Windows
   Open a second terminal:

cd frontend
npm install --legacy-peer-deps
Create frontend/.env:

REACT_APP_BACKEND_URL=http://127.0.0.1:8000
Then run:

npm start
Open http://localhost:3000.

--legacy-peer-deps is currently required because the installed react-day-picker release declares an older date-fns peer range than the version used by this project.

macOS/Linux commands
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python -m uvicorn server:app --reload --host 127.0.0.1 --port 8000
In another terminal:

cd frontend
npm install --legacy-peer-deps
npm start
Environment variables
Create backend/.env. Never commit this file.

# Application

FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000
UPLOAD_MAX_SIZE_MB=15

# MongoDB

MONGO_URL=mongodb://127.0.0.1:27017
DB_NAME=earth_db

# Authentication

JWT_SECRET=REPLACE_WITH_A_LONG_RANDOM_SECRET
JWT_EXPIRE_MINUTES=480
COOKIE_SECURE=false

# Initial admin (used only when the admin collection is first seeded)

ADMIN_LOGIN_ID=admin
ADMIN_EMAIL=admin@example.com
ADMIN_INITIAL_PASSWORD=REPLACE_WITH_A_STRONG_INITIAL_PASSWORD

# Email / OTP — GoDaddy Professional Email powered by Titan

EMAIL_ENABLED=true
SMTP_HOST=smtpout.secureserver.net
SMTP_PORT=465
SMTP_USERNAME=noreply@climatewallah.com
SMTP_PASSWORD=REPLACE_WITH_THE_MAILBOX_PASSWORD
SMTP_FROM_EMAIL=noreply@climatewallah.com
SMTP_FROM_NAME=Climate Wallah
SMTP_REPLY_TO=noreply@climatewallah.com
SMTP_USE_TLS=false
SMTP_USE_SSL=true
SMTP_TIMEOUT_SECONDS=20

# Optional enquiry recipient

ENQUIRY_NOTIFY_EMAIL=noreply@climatewallah.com
Generate a strong JWT secret with:

python -c "import secrets; print(secrets.token_urlsafe(64))"
For production, update at minimum:

FRONTEND_URL=https://climatewallah.com
CORS_ORIGINS=https://climatewallah.com,https://www.climatewallah.com
COOKIE_SECURE=true
Create frontend/.env:

REACT_APP_BACKEND_URL=http://127.0.0.1:8000
For a separate production API subdomain:

REACT_APP_BACKEND_URL=https://api.climatewallah.com
Environment changes require a backend restart. A changed REACT_APP_BACKEND_URL also requires rebuilding the frontend.

Email and OTP setup
The configured mailbox is:

noreply@climatewallah.com
Use the password created for this GoDaddy/Titan mailbox as SMTP_PASSWORD. Do not use the GoDaddy account password unless it is also the mailbox password.

Port 465 uses implicit SSL: SMTP_USE_SSL=true and SMTP_USE_TLS=false.

Do not add spaces inside the password. If the real password contains spaces or special characters, wrap the complete value in quotes.

SMTP_FROM_EMAIL should normally match SMTP_USERNAME.

SMTP_REPLY_TO can be changed to support@climatewallah.com after that mailbox or alias exists.

Keep the OTP validity at five minutes and never log the OTP in production.

After configuration, restart the backend and register with a test email. A successful request should return 200 OK, and the recipient should receive the verification email. If the backend logs Email not configured, verify that backend/.env exists and that the running email service reads the SMTP variables above.

File storage
All uploaded images, PDFs, project evidence, and generated certificates are stored in MongoDB GridFS. The public URL format remains:

/api/uploads/images/<filename>
/api/uploads/documents/<filename>
/api/uploads/evidence/<project_id>/<filename>
/api/uploads/certificates/<filename>
The frontend must build uploaded-file links through fileUrl() from frontend/src/lib/api.js. This ensures old database records that contain localhost:3000/api/uploads/... are redirected to the configured backend origin instead of React's 404 page.

To migrate legacy files from local upload folders to GridFS:

cd backend
python scripts/migrate_local_uploads_to_gridfs.py
Take a MongoDB backup and verify all file URLs before using any migration cleanup option.

Testing
Backend
Start MongoDB and the backend, then run:

cd backend
pytest -q
Frontend
cd frontend
npm test -- --watchAll=false
Production frontend build
cd frontend
npm run build
Before release, test at least:

Client registration, OTP verification, resend, login, and logout

Admin and Reviewer login/permissions

Project creation and geolocation

Sequential section locking/unlocking and auto-save

Claimed, recommended, and final score calculations

Evidence upload, preview, download, review, and deletion

Reviewer assignment, change requests, and forwarding

Admin final decision and generated PDFs

CMS CRUD, contact form, enquiry notification, and responsive layout

Production deployment
A practical single-server deployment uses:

Ubuntu LTS VPS

Nginx for HTTPS, static frontend delivery, and reverse proxying

Uvicorn workers managed by systemd

MongoDB with authentication and backups, or MongoDB Atlas

Let's Encrypt SSL certificates

DNS managed at GoDaddy

Recommended routing:

URL Destination
https://climatewallah.com/ React production build
https://climatewallah.com/api/ FastAPI on 127.0.0.1:8000
https://climatewallah.com/docs Disable publicly or protect in production
Deployment order:

Point the domain's A records to the VPS IP.

Install Python 3.11, Node.js 20, Nginx, and MongoDB or configure Atlas.

Copy the project and create the production backend/.env.

Install backend dependencies in a virtual environment.

Build the frontend with the production API URL.

Run FastAPI through systemd and proxy /api/ through Nginx.

Enable HTTPS with Certbot.

Configure automated MongoDB backups and service monitoring.

Run the complete release checklist before handing the site to the client.

Do not expose MongoDB port 27017 publicly. Allow only SSH, HTTP, and HTTPS in the VPS firewall unless another port is explicitly required.

Troubleshooting
Leaflet module not found
cd frontend
npm install leaflet@1.9.4 --legacy-peer-deps
Restart the frontend after installation.

Uploaded evidence opens the React 404 page
Confirm:

REACT_APP_BACKEND_URL=http://127.0.0.1:8000
Use fileUrl(file.url) for evidence links, and verify the same URL directly on backend port 8000.

401 Unauthorized from /api/auth/me
A 401 before login is normal. If it continues after login, check cookies, withCredentials: true, CORS_ORIGINS, COOKIE_SECURE, and the CSRF header.

For local HTTP development, use:

COOKIE_SECURE=false
CORS_ORIGINS=http://localhost:3000
SMTP says email is not configured
Ensure the file is exactly backend/.env.

Ensure every variable is on its own line.

Remove accidental duplicated text such as 20SMTP_TIMEOUT_SECONDS=20.

Restart Uvicorn after editing .env.

Confirm the Titan mailbox password by signing in to webmail.

Python dependency resolution is too deep
Delete the old virtual environment and recreate it with Python 3.11:

cd backend
deactivate
Remove-Item -Recurse -Force .venv
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Frontend dependency conflict (ERESOLVE)
cd frontend
npm install --legacy-peer-deps
Security checklist
Never commit .env, SMTP passwords, JWT secrets, database credentials, or test accounts.

Replace the seeded admin password immediately after first login.

Use HTTPS and COOKIE_SECURE=true in production.

Restrict CORS to the real frontend domains.

Keep role checks on the backend; never trust a role sent by the browser.

Keep CSRF validation enabled for state-changing cookie-authenticated requests.

Validate uploaded file type and size, and scan uploads if required by the organisation.

Rate-limit authentication, OTP, resend, contact, and upload endpoints.

Store only hashed passwords and OTPs.

Back up MongoDB, including GridFS collections, and test restoration.

Keep official certification records and audit logs immutable or tightly controlled.

Visual system
The portal uses the following professional SaaS palette:

Token Colour
Primary accent #27F580
Primary hover #20DB72
Deep navy #172033
Heading #111827
Secondary text #667085
Page background #F6F8FA
Card background #FFFFFF
Light accent background #E9FFF2
Border #E4E7EC
Information #3B82F6
Warning #F59E0B
Error #EF4444
Dark green is not used in the portal UI. Bright green is reserved for buttons, progress, active states, icons, and success indicators; normal text on light backgrounds remains navy or charcoal for accessible contrast.

Project documentation
docs/RES_COMPLETE_REQUIREMENTS.md — product requirements and scope

docs/RES_CERTIFICATION_WORKFLOW.md — roles and status workflow

docs/RES_API_AND_DATABASE.md — API and database reference

docs/RES_RATING_RULES.md — scoring and certification rules

docs/RES_DESIGN_SYSTEM.md — design tokens and UI guidance

Ownership and licence
This is a private, client-owned project. All rights are reserved. Do not distribute source code, company material, uploaded evidence, rating content, or credentials without written permission
