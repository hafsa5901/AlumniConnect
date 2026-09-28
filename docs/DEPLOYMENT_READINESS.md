# AlumniConnect — Deployment Readiness & Production Operations

> **IMPORTANT DECLARATION:**  
> **NO DEPLOYMENT HAS BEEN PERFORMED.**  
> **NO FRONTEND FILES WERE MODIFIED.**  
> This document specifies architectural requirements, configuration contracts, external infrastructure needs, and operational runbooks for a future deployment phase.

---

## PART 1 — IMPLEMENTED IN REPOSITORY

### 1. System Architecture Overview
AlumniConnect is a full-stack, institutional alumni and student engagement platform built with a decoupled architecture:
- **Backend Service:** Node.js, Express, TypeScript, Mongoose (MongoDB ODM), Socket.IO (WebSockets), Multer (Private File Uploads).
- **Frontend SPA:** React 18, Vite, TypeScript, Tailwind CSS, Axios, Socket.IO Client.
- **Data Layer:** MongoDB with structured indexing (unique constraints, partial unique indexes for pending verification requests, compound search indexes).
- **Communication Layer:** HTTP/1.1 & HTTP/2 RESTful API with JSON envelopes + WebSockets over Socket.IO for real-time notifications and direct messaging.
- **Storage Layer:** Local storage abstraction (`LocalStorageService`) with strict isolation between public assets (`/uploads/`) and private credentials (`uploads_private/`).

---

### 2. Implemented Security Controls & Middleware

| Control | Implementation Location | Mechanism |
| :--- | :--- | :--- |
| **Authentication & Tokens** | `backend/src/services/authService.ts` | Stateless JWT access tokens (15m expiry) + Hashed refresh token rotation (7d expiry, SHA-256) with single-use replay detection. |
| **Authorization & RBAC** | `backend/src/middleware/auth.ts` | Role gating (`student`, `alumni`, `admin`), verified standing check (`requireVerified`), and live account status validation (`active`, `suspended`, `deactivated`). |
| **Password Hashing** | `backend/src/utils/auth.ts` | `bcryptjs` with salt round cost factor of 12. |
| **HTTP Security Headers** | `backend/src/app.ts` | `helmet` middleware configuring `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and strict referrer policy. |
| **CORS Isolation** | `backend/src/app.ts` | Explicit origin allowlist matching `CLIENT_URL` / `APP_BASE_URL` with `credentials: true`. No wildcard origins. |
| **Reverse Proxy / Trust Proxy** | `backend/src/app.ts` | Configurable `TRUST_PROXY` (hop count or boolean), safe fallback (`false`) preventing IP header spoofing. |
| **Rate Limiting** | `backend/src/middleware/rateLimiter.ts` | IP-based rate limiting on authentication (`/login`, `/register`, `/forgot-password`, `/resend-verification`) and verification submissions. |
| **Private File Storage** | `backend/src/services/storage/` | Isolated private directory (`uploads_private`), magic-byte inspection (PDF, PNG, JPEG), path traversal guards, and authenticated streaming endpoints with 404 existence hiding. |
| **Concurrency Safeguards** | `backend/src/controllers/` | Atomic conditional operations (`findOneAndUpdate({ _id, status: 'pending' })`) across RSVPs, referrals, mentorship, and verification queues. |

---

### 3. Environment Variable Contract Reference

#### Backend Environment Variables

| Variable Name | Required | Secret? | Purpose | Default / Example |
| :--- | :---: | :---: | :--- | :--- |
| `NODE_ENV` | Yes | No | Runtime mode (`production`, `development`, `test`) | `development` |
| `PORT` | No | No | HTTP listening port | `5000` |
| `MONGODB_URI` | Yes | **Yes** | Connection URI for MongoDB cluster | `mongodb+srv://...` |
| `JWT_ACCESS_SECRET` | Yes | **Yes** | HMAC key for access tokens (min 16 chars) | Strong secret string |
| `JWT_REFRESH_SECRET` | Yes | **Yes** | HMAC key for refresh tokens (min 16 chars) | Strong secret string |
| `JWT_ACCESS_EXPIRES_IN` | No | No | Access token lifespan | `15m` |
| `JWT_REFRESH_EXPIRES_IN`| No | No | Refresh token lifespan | `7d` |
| `APP_BASE_URL` | Yes | No | Public frontend URL for verification links | `https://alumniconnect.edu` |
| `CLIENT_URL` | Yes | No | Allowed CORS origin | `https://alumniconnect.edu` |
| `COLLEGE_EMAIL_DOMAINS` | No | No | Comma-separated default institutional domains | `college.edu,university.edu` |
| `STUDENT_REQUIRES_ADMIN_APPROVAL` | No | No | Require manual approval for students | `false` |
| `SMTP_HOST` | In Prod | No | Mail server hostname | `smtp.mailgun.org` |
| `SMTP_PORT` | In Prod | No | Mail server port (587, 465, 25) | `587` |
| `SMTP_SECURE` | No | No | Use TLS/SSL directly | `false` |
| `SMTP_USER` | In Prod | **Yes** | SMTP authentication username | Service username |
| `SMTP_PASSWORD` | In Prod | **Yes** | SMTP authentication password | Service password |
| `EMAIL_FROM` | No | No | Sender header for outgoing emails | `"AlumniConnect" <noreply@domain>` |
| `FILE_STORAGE_DRIVER` | No | No | Storage provider driver (`local`) | `local` |
| `TRUST_PROXY` | No | No | Reverse proxy hop count / configuration | `1` or `false` |
| `ADMIN_EMAIL` | No | No | Seed admin initial email | Initial provision only |
| `ADMIN_PASSWORD` | No | **Yes** | Seed admin initial password | Initial provision only |

#### Frontend Environment Variables (Client-Side)

> All `VITE_*` variables are embedded into public JavaScript bundles during `npm run build`. Never put private keys, passwords, or server credentials into frontend variables.

| Variable Name | Required | Secret? | Purpose | Default / Example |
| :--- | :---: | :---: | :--- | :--- |
| `VITE_API_URL` | Yes | No | Base REST API endpoint URL | `https://api.alumniconnect.edu/api/v1` |
| `VITE_SOCKET_URL` | Yes | No | Backend WebSocket server URL | `https://api.alumniconnect.edu` |

---

## PART 2 — REQUIRED EXTERNAL PRODUCTION INFRASTRUCTURE

The items below are **NOT configured** in this repository and must be provisioned during a formal deployment phase:

### 1. Production MongoDB Cluster
- **Cluster Specs:** MongoDB 6.0+ replica set (e.g. MongoDB Atlas M10+ or self-hosted replica set).
- **Network Security:** IP Access List restricted strictly to backend server/container egress IPs; TLS 1.3 encryption in transit.
- **Authentication:** Dedicated database user with readWrite privileges scoped only to the `alumniconnect` database.
- **Automated Backups:** Daily automated snapshots with 30-day retention and continuous Point-in-Time Recovery (PITR).

### 2. Production SMTP / Transactional Email Service
- **Provider:** Dedicated transactional provider (SendGrid, Mailgun, Amazon SES, Postmark).
- **Domain Verification:** Configure SPF (`v=spf1 ...`), DKIM (`k=rsa; ...`), and DMARC (`v=DMARC1; p=reject; ...`) records on the sending domain to prevent verification emails from landing in spam.

### 3. Production Object Storage
- **Current State:** Repository utilizes `LocalStorageService` with local volume directories (`uploads` and `uploads_private`).
- **Production Requirement:** For multi-instance, auto-scaling, or serverless container deployments, attach persistent network-attached storage volumes (e.g. Kubernetes PVC / AWS EFS) or implement an S3-compatible private storage driver with pre-signed authorization URLs to ensure private resume and proof documents persist across container restarts.

### 4. Application Hosting & Compute
- **Backend:** Node.js 18+ LTS runtime environment (e.g., AWS ECS/Fargate, Google Cloud Run, DigitalOcean App Platform, or Linux VPS with PM2 / Docker).
- **Frontend:** Static Web Hosting with CDN (e.g., Cloudflare Pages, Vercel, AWS S3 + CloudFront, Nginx).
- **SPA Fallback Routing:** Web server / CDN must rewrite all non-file route requests (`/*`) to `/index.html` with HTTP 200 to support React Router HTML5 pushState history.
- **WebSocket Gateway:** Load balancer / reverse proxy (Nginx, Traefik, ALB) must support HTTP `Upgrade: websocket` and sticky sessions (if running multiple backend replicas without a Redis adapter).

### 5. Domain, DNS & SSL/TLS Certificates
- **Custom Domains:** e.g., `alumniconnect.edu` (Frontend) and `api.alumniconnect.edu` (Backend).
- **HTTPS Enforcement:** Valid TLS certificates (Let's Encrypt / Cloudflare SSL / AWS ACM) with HTTP-to-HTTPS redirection and HSTS headers.

### 6. Logging, Monitoring & Alerting
- **Uptime Monitoring:** Synthetic health check pings against `GET /api/health`.
- **Log Aggregation:** Centralized log shipping (Datadog, Grafana Loki, CloudWatch, Papertrail).
- **APM & Error Tracking:** Exception tracking with Sentry or OpenTelemetry.

---

## PART 3 — PRODUCTION SMOKE-TEST RUNBOOK

Once external infrastructure is provisioned, execute this smoke-test checklist:

1. **Health Verification:** `GET https://api.alumniconnect.edu/api/health` returns `200 OK` with `{ status: "ok" }`.
2. **Registration & Domain Verification:**
   - Register a student account with institutional domain (`@college.edu`).
   - Confirm verification email arrives with valid token link.
   - Click token link and confirm transition to `email_verified`.
3. **Institutional Affiliation & Proof Upload:**
   - Submit institutional verification with college selection and PDF attachment.
   - Confirm request appears in Admin Verification Queue (`/admin/verifications`).
4. **Admin Approval Flow:**
   - Log in as admin, review uploaded proof document via secure preview.
   - Approve verification request; confirm user account transitions to `admin_approved`.
5. **Private Document Protection:**
   - Attempt to access document stream as an unauthenticated or non-admin user; verify `404 DOCUMENT_NOT_FOUND` response (existence hidden).
6. **Real-time Messaging & Notifications:**
   - Open two browser sessions (Student & Alumni).
   - Send connection request and direct message; verify instant Socket.IO receipt without page reload.
7. **Rate Limiting Verification:**
   - Submit rapid invalid login attempts; confirm HTTP `429 Too Many Requests` envelope.

---

## APPENDIX: FRONTEND OBSERVATIONS (READ-ONLY AUDIT — NOT MODIFIED)

During the read-only audit of the frozen frontend codebase, the following non-blocking findings were noted for consideration in a future UI enhancement phase:

1. **SPA Catch-All Route Handling:**
   - *File:* `frontend/src/routes/AppRoutes.tsx`
   - *Severity:* Low
   - *Note:* React Router handles unknown routes with `<NotFoundPage />`. Production hosting must ensure server-side rewrite rules route `/*` to `index.html`.
2. **Dynamic Socket URL Protocol Match:**
   - *File:* `frontend/src/services/messaging.ts:134`, `frontend/src/components/layout/NotificationsPopover.tsx:147`
   - *Severity:* Informational / Low
   - *Note:* Frontend defaults `VITE_SOCKET_URL` to `'http://localhost:5000'`. When deploying to HTTPS, operators must provide `VITE_SOCKET_URL=https://api.yourdomain.com` during the frontend build step to avoid mixed-content warnings.
3. **Accessibility (ARIA Labels on Modal Close Buttons):**
   - *File:* `frontend/src/components/ui/Modal.tsx`
   - *Severity:* Low
   - *Note:* Modal close buttons use SVG icons; adding explicit `aria-label="Close dialog"` is recommended for screen readers in future UI updates.
