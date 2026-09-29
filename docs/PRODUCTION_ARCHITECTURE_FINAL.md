# AlumniConnect — Production Architecture & Operational Plan

> **CRITICAL DECLARATION:**  
> **NO DEPLOYMENT HAS BEEN PERFORMED. NO EXTERNAL INFRASTRUCTURE WAS PROVISIONED.**  
> **NO FRONTEND FILES WERE MODIFIED (FRONTEND REMAINS FROZEN AND READ-ONLY).**  
> **THIS DOCUMENT FREEZES THE ARCHITECTURE BOUNDARY, CONFIGURATION CONTRACTS, AND SMOKE-TEST RUNBOOKS.**

---

## 1. System Architecture Diagram

```
+-------------------------------------------------------------------------------------------------+
|                                        USER BROWSER / CLIENT                                    |
+-------------------------------------------------------------------------------------------------+
           |                                                                 |
           | HTTPS (HTML / JS / Assets)                                      | HTTPS (REST API) & WSS (Socket.IO)
           v                                                                 v
+------------------------------------+               +--------------------------------------------+
|         FRONTEND HOSTING           |               |             BACKEND API GATEWAY            |
|       (Static CDN / Edge)          |               |         (Reverse Proxy / Node.js)          |
|                                    |               |                                            |
| - Pre-built React 18 SPA Assets    |               | - Express REST API (/api/v1/*)             |
| - Client-side React Router (v6)    |               | - Socket.IO WebSocket Engine               |
| - SPA Rewrite Rule (/* -> /index)  |               | - Multer Private File Ingestion            |
| - Security: HTTPS, Content Headers |               | - Helmet, Rate Limiters, CORS Control      |
+------------------------------------+               +--------------------------------------------+
                                                                    |         |          |
                                  +---------------------------------+         |          +---------------------------------+
                                  | TLS / TCP                                 | TLS                                        | TLS
                                  v                                           v                                            v
+----------------------------------------------------+   +--------------------------------------+   +------------------------------------+
|                MONGODB CLUSTER                     |   |        PRIVATE OBJECT STORAGE        |   |       SMTP TRANSACTIONAL MAIL      |
|                                                    |   |                                      |   |                                    |
| - Replica Set (Primary + Secondaries)              |   | - Isolated Private Bucket / Volume   |   | - Transactional Email Relays       |
| - Collections: Users, VerificationRequests,        |   | - Resumes (PDF/DOC/DOCX)             |   | - Tokenized Verification Links     |
|   Colleges, Connections, Jobs, Events, Messages... |   | - Institutional Proof Documents      |   | - Password Reset Flow Delivery     |
| - Partial & Compound Unique Indexes                |   | - Strictly Non-Public Direct Access  |   | - SPF, DKIM & DMARC Enforced       |
+----------------------------------------------------+   +--------------------------------------+   +------------------------------------+
```

---

## 2. Component Boundary Breakdown (10 Architecture Components)

For every component in the AlumniConnect ecosystem, the boundary between what is implemented in code today versus what external infrastructure must be provisioned is strictly separated:

| Component | Implemented in Repository (`VERIFIED-REPO`) | Required External Infrastructure (`NOT YET PROVISIONED`) |
| :--- | :--- | :--- |
| **1. Browser Client** | React 18 SPA, Axios API service with auto token refresh, Socket.IO client connection, AuthContext state management (`frontend/src/`). | End-user modern web browser supporting ES2020+, WebSockets, and secure cookies. |
| **2. Frontend Static Host** | Pre-configured Vite build pipeline outputting static hashed HTML/JS/CSS assets to `frontend/dist/` (`frontend/package.json`). | Static CDN / Edge Storage (Cloudflare Pages, Vercel, or Netlify) with SPA fallback rewrite rule routing `/*` to `/index.html`. |
| **3. Backend API Gateway** | Express 4.21 TypeScript HTTP API, route controllers, centralized error handling, and `GET /api/health` liveness probe (`backend/src/app.ts`). | Node.js 18+ LTS compute container/instance (Render, Railway, DO App Platform, or VPS) binding to `0.0.0.0:${PORT}`. |
| **4. Socket.IO / WebSockets** | Socket.IO server engine with JWT handshake auth and account status verification (`backend/src/socket.ts`). Single-instance in-memory adapter. | Reverse proxy supporting HTTP `Upgrade: websocket` headers. Multi-instance scaling requires Redis broker (not configured). |
| **5. Database Persistence** | Mongoose schemas, compound query indexes, and partial unique index on `VerificationRequest` (`backend/src/models/`). | Managed MongoDB 6.0+ replica set (MongoDB Atlas Flex or Dedicated M10 cluster) with automated snapshots and access controls. |
| **6. Object Storage** | `IStorageService` interface with `LocalStorageService` isolating public assets (`/uploads/`) from private credentials (`uploads_private/`). | S3-compatible private bucket (Cloudflare R2 or Amazon S3 Standard) with Block All Public Access enabled. S3 adapter to be added at provisioning. |
| **7. Transactional Email** | Templated email dispatchers for verification, password reset, and approvals via Nodemailer (`backend/src/services/emailService.ts`). | Transactional SMTP service (Resend, Brevo, or AWS SES) with SPF, DKIM, and DMARC DNS authentication. |
| **8. DNS & Domain Routing** | CORS allowlist matching `CLIENT_URL` / `APP_BASE_URL` (`backend/src/app.ts:41-55`). Placeholders used across documentation. | Registered apex domain (e.g. `alumniconnect.edu`) and DNS nameservers routing `app.<domain>` to frontend and `api.<domain>` to backend. |
| **9. TLS / HTTPS Security** | Helmet security headers, cookie `secure: NODE_ENV === 'production'`, `SameSite: 'strict'` (`backend/src/utils/cookies.ts`). | Managed SSL/TLS edge certificates (Cloudflare Universal SSL, Let's Encrypt, or AWS ACM) terminating HTTPS on port 443. |
| **10. Observability & Logging** | Structured JSON error envelopes, `morgan` HTTP access logging, and `AdminAuditLog` MongoDB collection (`backend/src/`). | Centralized log drain, synthetic uptime monitor checking `GET /api/health`, and application error monitoring (Sentry / Datadog). |

---

## 3. Real-Time Socket.IO Production Requirements

- **Protocol & Encryption (`VERIFIED-REPO`):** In production, client connections use `wss://` over port 443. The frontend passes `VITE_SOCKET_URL` (`frontend/src/services/messaging.ts:134`).
- **Connection Authentication (`VERIFIED-REPO`):** Handshake middleware validates the JWT access token from `socket.handshake.auth?.token`, `Authorization: Bearer <token>`, or `accessToken` cookie (`backend/src/socket.ts:32-87`). It actively re-checks that `user.accountStatus === 'active'`.
- **CORS & Origin Gating (`VERIFIED-REPO`):** Socket.IO origin checks enforce `requestOrigin === env.CLIENT_URL` with `credentials: true` (`backend/src/socket.ts:19-28`).
- **Single-Instance Deployment (`VERIFIED-REPO`):** The repository currently runs with the default in-memory Socket.IO adapter (`backend/src/socket.ts:18`). It requires no external message broker, Redis instance, or sticky load balancer sessions when running a single backend instance.
- **Horizontal Multi-Instance Scaling (`NOT YET IMPLEMENTED`):** If scaling beyond a single container instance, attaching `@socket.io/redis-adapter` and provisioning a Redis cluster becomes strictly necessary to broadcast room events across nodes, alongside sticky load balancer cookies if HTTP polling fallback is active.

---

## 4. Cookie, CORS & Domain Architecture (Frontend Read-Only)

- **Refresh Cookie Specifications (`VERIFIED-REPO`):**
  - Name: `refreshToken` (`backend/src/utils/cookies.ts:4`)
  - `httpOnly: true` (Inaccessible to client JavaScript/XSS)
  - `secure: env.NODE_ENV === 'production'` (Transmitted only over HTTPS)
  - `sameSite: 'strict'` (`backend/src/utils/cookies.ts:11`)
  - `path: '/api/v1/auth'` (Scoped strictly to authentication endpoints)
  - `maxAge: 7 * 24 * 60 * 60 * 1000` (7-day TTL)
- **Architectural Constraint (`VERIFIED-REPO`):** Because `SameSite: 'strict'` is enforced, browsers will block cookie transmission on cross-origin requests originating from different registrable domains.
  - *Required Production Domain Structure:* Frontend and API MUST reside on subdomains of the same registered apex domain (e.g. `https://app.example.com` and `https://api.example.com`), or be unified behind a single edge proxy (e.g. `https://example.com` and `https://example.com/api/v1`).
  - *Frontend Observation:* The frontend is frozen (read-only) and uses `credentials: 'include'` on Axios requests (`frontend/src/services/api.ts`). Deploying across different third-party domains (e.g. `app.vercel.app` and `api.onrender.com`) is incompatible with the current cookie policy.

---

## 5. Storage Architecture & Verification Gating

- **Current Implementation (`VERIFIED-REPO`):** Local storage service (`backend/src/services/storage/LocalStorageService.ts`) isolating public media (`uploads/`) from sensitive credentials (`uploads_private/`).
- **Production Target (`REQUIRED EXTERNAL INFRASTRUCTURE`):** S3-compatible private bucket (Cloudflare R2 or Amazon S3) with Block All Public Access.
- **Verification Proof Documents (`VERIFIED-REPO`):**
  - Max Size: **5 MB** (`backend/src/utils/verificationUpload.ts:22`).
  - Allowed Formats: PDF (`.pdf`), PNG (`.png`), JPEG (`.jpg`, `.jpeg`).
  - Validation: Magic-byte inspection (%PDF, PNG header, JPEG SOI).
  - Storage: Saved to private directory (`uploads_private/verifications`).
  - Access: Authenticated stream via `GET /api/v1/verification-requests/:id/document` with existence-hiding 404s for unauthorized users.
- **Resumes (`VERIFIED-REPO`):**
  - Max Size: **5 MB** (`backend/src/routes/users.ts:86`).
  - Allowed Formats: PDF (`.pdf`), DOC (`.doc`), DOCX (`.docx`).
  - Validation: Magic-byte inspection (`backend/src/controllers/usersController.ts:38-60`).
  - Storage: Private storage (`uploads_private/resumes`).
  - Access: Strictly gated via `/api/v1/users/me/resume`, `/api/v1/users/:id/resume`, and `/api/v1/referrals/:id/resume`. Resumes are NEVER served publicly.

---

## 6. Transactional Email & Deliverability

- **Transport Engine (`VERIFIED-REPO`):** Nodemailer configured via `backend/src/services/emailService.ts`.
- **Required Production Variables (`VERIFIED-REPO`):**
  - `SMTP_HOST`: Hostname of SMTP relay (e.g. `smtp.resend.com`, `smtp-relay.brevo.com`).
  - `SMTP_PORT`: `587` (STARTTLS) or `465` (SSL).
  - `SMTP_SECURE`: `false` for port 587, `true` for port 465.
  - `SMTP_USER`: SMTP username or API key.
  - `SMTP_PASSWORD`: SMTP secret key or password.
  - `EMAIL_FROM`: Sender RFC 5322 header (e.g. `"AlumniConnect" <noreply@example.com>`).
- **Link Dynamic Generation (`VERIFIED-REPO`):** Verification and password-reset links are dynamically constructed from `APP_BASE_URL` (`backend/src/services/emailService.ts:157, 261`).
- **Logging Protection (`VERIFIED-REPO`):** Production logging omits raw verification tokens, reset tokens, and SMTP credentials (`backend/src/services/emailService.ts:251-253`).
- **Provider Status:** `OWNER DECISION REQUIRED` (Resend vs Brevo vs AWS SES).

---

## 7. Environment Configuration Audit Contract

| Variable Name | Classification | Required in Prod? | Default / Example | Purpose & Code Location |
| :--- | :---: | :---: | :--- | :--- |
| `NODE_ENV` | DEPLOY-TIME | **Yes** | `production` | Enables production security optimizations (`backend/src/config/env.ts:55`). |
| `PORT` | DEPLOY-TIME | No | `5000` | HTTP port server listens on (`backend/src/server.ts:16`). |
| `MONGODB_URI` | **SECRET** | **Yes** | *None* | Connection URI for MongoDB cluster (`backend/src/config/env.ts:32-37`). |
| `JWT_ACCESS_SECRET` | **SECRET** | **Yes** | *None* | 256-bit signing key for access JWTs (min 16 chars) (`backend/src/config/env.ts:18-23`). |
| `JWT_REFRESH_SECRET` | **SECRET** | **Yes** | *None* | 256-bit signing key for refresh JWTs (min 16 chars) (`backend/src/config/env.ts:25-30`). |
| `JWT_ACCESS_EXPIRES_IN` | DEPLOY-TIME | No | `15m` | Access token lifespan (`backend/src/config/env.ts:59`). |
| `JWT_REFRESH_EXPIRES_IN`| DEPLOY-TIME | No | `7d` | Refresh token lifespan (`backend/src/config/env.ts:60`). |
| `APP_BASE_URL` | DEPLOY-TIME | **Yes** | `https://app.example.com` | Base frontend URL for email verification links (`backend/src/config/env.ts:61`). |
| `CLIENT_URL` | DEPLOY-TIME | **Yes** | `https://app.example.com` | Exact CORS origin allowlist for API and WebSockets (`backend/src/config/env.ts:62`). |
| `COLLEGE_EMAIL_DOMAINS` | DEPLOY-TIME | No | `college.edu,university.edu` | Fallback accepted institutional domains (`backend/src/config/env.ts:63-65`). |
| `STUDENT_REQUIRES_ADMIN_APPROVAL` | DEPLOY-TIME | No | `false` | Student manual verification requirement flag (`backend/src/config/env.ts:66`). |
| `SMTP_HOST` | DEPLOY-TIME | **Yes** (Prod) | `smtp.example.com` | Outgoing SMTP server hostname (`backend/src/config/env.ts:67`). |
| `SMTP_PORT` | DEPLOY-TIME | **Yes** (Prod) | `587` | Outgoing SMTP server port (`backend/src/config/env.ts:68`). |
| `SMTP_SECURE` | DEPLOY-TIME | No | `false` | TLS mode (`true` for 465, `false` for 587) (`backend/src/config/env.ts:69`). |
| `SMTP_USER` | **SECRET** | **Yes** (Prod) | `smtp-user` | Outgoing SMTP username (`backend/src/config/env.ts:70`). |
| `SMTP_PASSWORD` | **SECRET** | **Yes** (Prod) | `smtp-password` | Outgoing SMTP password (`backend/src/config/env.ts:71`). |
| `EMAIL_FROM` | DEPLOY-TIME | No | `"AlumniConnect" <noreply@example.com>` | Outgoing sender header (`backend/src/config/env.ts:75`). |
| `FILE_STORAGE_DRIVER` | DEPLOY-TIME | No | `local` | Storage driver selector (`backend/src/config/env.ts:76`). |
| `TRUST_PROXY` | DEPLOY-TIME | No | `false` | Reverse proxy hop count (`backend/src/config/env.ts:79`, `backend/src/app.ts:27-36`). |
| `ADMIN_EMAIL` | DEPLOY-TIME | No (Seed only) | `admin@example.com` | Target email for admin bootstrap (`backend/src/seedAdmin.ts:30`). |
| `ADMIN_PASSWORD` | **SECRET** | No (Seed only) | *None* | Seed admin password (removed post-bootstrap) (`backend/src/seedAdmin.ts:31`). |
| `ALLOW_PROD_SEED` | DEPLOY-TIME | No (Seed only) | `false` | Interlock required to run seed in production (`backend/src/seedAdmin.ts:25`). |
| `VITE_API_URL` | **PUBLIC** | **Yes** | `https://api.example.com/api/v1` | Frontend REST API base URL (`frontend/src/services/api.ts:3`). |
| `VITE_SOCKET_URL` | **PUBLIC** | **Yes** | `https://api.example.com` | Frontend WebSocket server base URL (`frontend/src/services/messaging.ts:134`). |

---

## 8. Deployment Sequence (Document Only — Execute Nothing)

```
[1. Domain & DNS Registration]
       │ Register apex domain (e.g., alumniconnect.edu) via chosen registrar.
       │ Configure DNS records: app.<domain> (Frontend) and api.<domain> (Backend).
       ▼
[2. Final Provider Decision Lock]
       │ Owner resolves all pending choices in Section 11 Decision Matrix.
       ▼
[3. MongoDB Database Provisioning]
       │ Provision MongoDB Atlas cluster in chosen primary cloud region.
       │ Create dedicated DB user with readWrite privileges on 'alumniconnect'.
       │ Configure network access (static egress IPs or private networking).
       ▼
[4. Object Storage Provisioning]
       │ Create private S3/R2 bucket with Block All Public Access enabled.
       │ Generate scoped API access credentials or IAM service role.
       ▼
[5. Transactional Email Provisioning]
       │ Configure email provider account; verify domain with SPF, DKIM, and DMARC TXT records.
       │ Generate dedicated SMTP credentials.
       ▼
[6. Backend Deployment & Environment Configuration]
       │ Provision container runtime / compute host.
       │ Set production environment variables (MONGODB_URI, JWT secrets, SMTP credentials, CLIENT_URL, APP_BASE_URL).
       │ Verify actual proxy topology and configure TRUST_PROXY accordingly.
       │ Build and launch backend container (`node dist/server.js`).
       ▼
[7. Backend Connectivity Verification]
       │ Probe GET https://api.<domain>/api/health (expect 200 OK).
       │ Verify MongoDB connection in container logs (`MongoDB connected`).
       │ Perform one-time index synchronization check.
       ▼
[8. Administrative Bootstrap]
       │ Execute one-time seed task with ALLOW_PROD_SEED=true: npm run seed:admin.
       │ Cleanly remove ADMIN_PASSWORD and ALLOW_PROD_SEED from environment variables.
       ▼
[9. Frontend Build & CDN Deployment]
       │ Configure build environment with VITE_API_URL and VITE_SOCKET_URL.
       │ Execute build: npm run build (outputs to frontend/dist/).
       │ Deploy static assets to CDN host; configure SPA fallback rewrite rule (/* -> /index.html).
       ▼
[10. End-to-End Smoke Verification & Monitoring]
       │ Execute Production Smoke Test Checklist (Section 10).
       │ Verify synthetic health monitors, centralized logging, and automated backups.
       │ Complete restore rehearsal validation before opening to live traffic.
```

---

## 9. Rollback Runbooks

### 9.1 Code Rollback
- **Frontend Rollback:** Instantaneous. Re-point CDN / edge deployment to the previous immutable release artifact/commit.
- **Backend Rollback:** Re-deploy previous container image tag or commit SHA. Never use destructive `git reset --hard` on production branches; use `git revert` for tracked history.

### 9.2 Configuration Rollback
- **Environment Variables:** Revert changed environment variables in the host dashboard.
- **Process Restart:** Ensure all container instances are restarted so new environment values take effect.
- **JWT Secret Rotation Impact:** Rotating `JWT_ACCESS_SECRET` forces all users to refresh tokens within 15 minutes; rotating `JWT_REFRESH_SECRET` invalidates all active browser sessions requiring re-login.

### 9.3 Database Rollback
- **Risk Statement:** Database changes are **NOT automatically safe or reversible** via code rollback alone.
- **Procedure:** If a backwards-incompatible data migration or corrupted state occurs, execute a Point-in-Time Recovery (PITR) restore to a timestamp preceding the deployment event. Validate restored data integrity before directing user traffic back to the cluster.

### 9.4 Storage & Email Rollback
- **Storage:** If storage credentials or bucket configuration changes fail, revert environment variables to previous working IAM/token credentials.
- **Email:** If SMTP deliverability fails, revert to previous verified SMTP host/credentials.

---

## 10. Production Smoke Test Checklist

| Category | Verification Action | Target Endpoint / Screen | Expected Result |
| :--- | :--- | :--- | :--- |
| **AUTH** | Register new account | `POST /api/v1/auth/register` | Account created; verification token generated |
| **AUTH** | Verify email via token | `POST /api/v1/auth/verify-email` | Status updates to `email_verified` |
| **AUTH** | User login | `POST /api/v1/auth/login` | Returns access token; sets httpOnly `refreshToken` cookie |
| **AUTH** | Token refresh | `POST /api/v1/auth/refresh` | Rotates refresh token; returns new access token |
| **AUTH** | Password reset flow | `POST /api/v1/auth/forgot-password` | Delivers reset email with 1-hour expiration link |
| **AUTH** | User logout | `POST /api/v1/auth/logout` | Clears refresh cookie and invalidates token hash |
| **VERIFICATION** | Submit college proof | `POST /api/v1/verification-requests` | Request queued in `pending` status |
| **VERIFICATION** | Admin review & approve | `PATCH /api/v1/admin/verification-requests/:id/approve` | Request `approved`; user becomes `admin_approved` |
| **VERIFICATION** | Admin rejection | `PATCH /api/v1/admin/verification-requests/:id/reject` | Request `rejected` with rejection reason logged |
| **CORE** | Update user profile | `PATCH /api/v1/users/me` | Profile updated; sanitizes sensitive fields |
| **CORE** | Browse & post jobs | `POST /api/v1/jobs` & `GET /api/v1/jobs` | Job posted and paginated correctly |
| **CORE** | Mentorship request | `POST /api/v1/mentorship/requests` | Request created in pending state |
| **CORE** | Referral request | `POST /api/v1/referrals` | Referral request created with resume attached |
| **CORE** | Networking connection | `POST /api/v1/connections` | Mutual connection request state machine enforced |
| **CORE** | Event RSVP | `POST /api/v1/events/:id/rsvp` | Atomic capacity check; RSVP confirmed |
| **ADMIN** | Admin audit log query | `GET /api/v1/admin/audit-logs` | Immutable audit trail retrieved |
| **ADMIN** | Bulk governance action | `POST /api/v1/admin/users/bulk-status` | Atomic batch update of account statuses |
| **SECURITY** | Suspended account gate | `POST /api/v1/auth/login` | HTTP `403 ACCOUNT_SUSPENDED` |
| **SECURITY** | Private document access | `GET /api/v1/verification-requests/:id/document` | HTTP `404` (existence hidden) for unauthorized users |
| **SECURITY** | Rate limit enforcement | Rapid invalid login requests | HTTP `429 Too Many Requests` |
| **SECURITY** | Strict CORS policy | Request from disallowed origin | HTTP `403 CORS_NOT_ALLOWED` |
| **REAL-TIME** | Socket connection | `wss://api.<domain>` | Authenticated handshake; joins private user room |
| **REAL-TIME** | Direct chat message | WebSocket `message:send` | Message persisted; delivered via `message:new` |
| **REAL-TIME** | Live notification | System event trigger | Real-time `notification:new` emitted to recipient |
| **INFRASTRUCTURE** | System liveness probe | `GET /api/health` | HTTP `200 OK` with `{ status: "ok" }` |
| **INFRASTRUCTURE** | Database connectivity | Backend boot logs | Confirms `MongoDB connected` |
| **INFRASTRUCTURE** | Transactional SMTP | Trigger verification email | Email delivered to inbox with SPF/DKIM pass |

---

## 11. Final Provider Decision Matrix

The table below tracks the status of all operational and infrastructure provider choices. All choices remain open for the project owner to resolve:

| Component / Parameter | Status | Options Under Consideration |
| :--- | :---: | :--- |
| **Frontend Provider** | `OWNER DECISION REQUIRED` | Cloudflare Pages (Recommended for zero-config SPA & free unlimited bandwidth) / Vercel Pro / Netlify |
| **Backend Provider** | `OWNER DECISION REQUIRED` | Render Starter ($7/mo) / Railway Pro ($20/mo) / DigitalOcean App Platform ($5-$12/mo) / Self-Managed VPS ($4-$12/mo) |
| **Database Tier** | `OWNER DECISION REQUIRED` | MongoDB Atlas Flex (Serverless) / MongoDB Atlas Dedicated M10 (~$57/mo, continuous PITR) / VPS MongoDB |
| **Object Storage Provider** | `OWNER DECISION REQUIRED` | Cloudflare R2 (Zero egress, S3 API) / Amazon S3 Standard |
| **Transactional Email Provider** | `OWNER DECISION REQUIRED` | Resend / Brevo / Amazon SES |
| **DNS & Apex Domain** | `OWNER DECISION REQUIRED` | Institutional apex domain registration (e.g. `alumniconnect.edu`) & DNS management |
| **Primary Cloud Region** | `OWNER DECISION REQUIRED` | Geographic colocation region (`us-east-1`, `eu-west-1`, `ap-south-1`, etc.) |
| **Recovery Point Objective (RPO)**| `OWNER DECISION REQUIRED` | Maximum acceptable data loss window (e.g. RPO <= 1 hr via continuous PITR vs RPO <= 24 hrs) |
| **Recovery Time Objective (RTO)** | `OWNER DECISION REQUIRED` | Maximum acceptable recovery time (e.g. RTO <= 4 hrs) |
| **Backup Retention & Testing** | `OWNER DECISION REQUIRED` | Snapshot retention period (30 vs 90 days) and restore test frequency |
