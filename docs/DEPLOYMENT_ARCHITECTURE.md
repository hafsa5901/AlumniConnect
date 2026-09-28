# AlumniConnect — Production Deployment Architecture & Infrastructure Plan

> **CRITICAL DECLARATION:**  
> **INFRASTRUCTURE PLANNING COMPLETE — NO DEPLOYMENT PERFORMED.**  
> **NO CLOUD ACCOUNTS, DATABASES, BUCKETS, HOSTS, OR DNS RECORDS WERE PROVISIONED.**  
> **NO FRONTEND FILES WERE MODIFIED.**

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
| - Collections: Users, VerificationRequests,        |   | - Resumes (PDF/DOCX)                 |   | - Tokenized Verification Links     |
|   Colleges, Connections, Jobs, Events, Messages... |   | - Institutional Proof Documents      |   | - Password Reset Flow Delivery     |
| - Partial & Compound Unique Indexes                |   | - Strictly Non-Public Direct Access  |   | - SPF, DKIM & DMARC Enforced       |
+----------------------------------------------------+   +--------------------------------------+   +------------------------------------+
```

---

## 2. Components Breakdown

### Implemented in Repository
- **Web Application Core:** Node.js 18+ runtime with Express TypeScript framework (`backend/src/`).
- **Real-Time Messaging & Notifications:** Socket.IO server engine with JWT handshake authentication (`backend/src/socket.ts`).
- **Persistence ODM:** Mongoose schemas with indexed models for Users, VerificationRequests, Colleges, Connections, Mentorship, Jobs, Events, Messages, and Audit Logs.
- **Private File Handling:** Dedicated file streaming controller with magic-byte validation, secure `Content-Disposition`, and existence-hiding 404 response gating.

### Required External Infrastructure (Not Provisioned)
- Static CDN / Edge Storage for pre-rendered frontend assets.
- Long-running Node.js container or server compute instances.
- Managed MongoDB 6.0+ Replica Set cluster.
- Private durable object storage (S3-compatible bucket or dedicated persistent volume).
- High-reputation SMTP provider.

---

## 3. Domain & Routing Architecture

### Placeholder Domain Mapping

| Subdomain / URL (Example) | Target Service | Transport Protocol | Routing / Endpoint Purpose |
| :--- | :--- | :--- | :--- |
| `https://app.example.com` | Frontend SPA | HTTPS (443) | User UI, Auth, Dashboards, Directory |
| `https://api.example.com` | Backend REST API | HTTPS (443) | API Endpoints (`/api/v1/*`), Health Check (`/api/health`) |
| `wss://api.example.com` | Backend WebSockets | WSS (443) | Socket.IO Real-time Events (`/socket.io/*`) |

### Environment Variable Domain Alignment

- **`APP_BASE_URL`** (Backend): `https://app.example.com` (Used in outgoing transactional email verification and password reset links).
- **`CLIENT_URL`** (Backend): `https://app.example.com` (Used as the exact origin allowlist for CORS headers).
- **`VITE_API_URL`** (Frontend): `https://api.example.com/api/v1` (Base URL for all Axios API requests).
- **`VITE_SOCKET_URL`** (Frontend): `https://api.example.com` (Base URL for Socket.IO client connections).

---

## 4. Environment Variables Reference

### Backend Variables

| Variable Name | Required | Secret? | Purpose | Implementation Location |
| :--- | :---: | :---: | :--- | :--- |
| `NODE_ENV` | Yes | No | Runtime mode (`production`, `development`, `test`) | `backend/src/config/env.ts:55` |
| `PORT` | No | No | Port to listen on (Default: `5000`) | `backend/src/config/env.ts:54` |
| `MONGODB_URI` | Yes | **Yes** | MongoDB cluster connection string with credentials | `backend/src/config/env.ts:56` |
| `JWT_ACCESS_SECRET` | Yes | **Yes** | 256-bit secret for signing access JWTs (min 16 chars) | `backend/src/config/env.ts:57` |
| `JWT_REFRESH_SECRET` | Yes | **Yes** | 256-bit secret for signing refresh JWTs (min 16 chars)| `backend/src/config/env.ts:58` |
| `JWT_ACCESS_EXPIRES_IN` | No | No | Access token TTL (Default: `15m`) | `backend/src/config/env.ts:59` |
| `JWT_REFRESH_EXPIRES_IN`| No | No | Refresh token TTL (Default: `7d`) | `backend/src/config/env.ts:60` |
| `APP_BASE_URL` | Yes | No | Public frontend URL for email links | `backend/src/config/env.ts:61` |
| `CLIENT_URL` | Yes | No | Origin allowlist for CORS policy | `backend/src/config/env.ts:62` |
| `COLLEGE_EMAIL_DOMAINS` | No | No | Default comma-separated domain fallbacks | `backend/src/config/env.ts:63` |
| `STUDENT_REQUIRES_ADMIN_APPROVAL` | No | No | Flag requiring student verification approval | `backend/src/config/env.ts:66` |
| `SMTP_HOST` | Prod | No | Outgoing SMTP mail server | `backend/src/config/env.ts:67` |
| `SMTP_PORT` | Prod | No | Outgoing SMTP port (`587`, `465`, `25`) | `backend/src/config/env.ts:68` |
| `SMTP_SECURE` | No | No | Direct TLS boolean (`true` for 465, `false` for 587) | `backend/src/config/env.ts:69` |
| `SMTP_USER` | Prod | **Yes** | SMTP authentication username | `backend/src/config/env.ts:70` |
| `SMTP_PASSWORD` | Prod | **Yes** | SMTP authentication password | `backend/src/config/env.ts:71` |
| `EMAIL_FROM` | No | No | Sender address header | `backend/src/config/env.ts:75` |
| `TRUST_PROXY` | No | No | Proxy hop count or boolean (`1`, `false`) | `backend/src/config/env.ts:77` |
| `FILE_STORAGE_DRIVER` | No | No | File driver (`local`) | `backend/src/config/env.ts:76` |

### Frontend Variables (Public Client-Side)

> Injected at build time by Vite. **Never store server secrets in frontend variables.**

| Variable Name | Required | Secret? | Purpose | Code Location |
| :--- | :---: | :---: | :--- | :--- |
| `VITE_API_URL` | Yes | No | Backend API endpoint URL (`https://api.example.com/api/v1`) | `frontend/src/services/api.ts:3` |
| `VITE_SOCKET_URL` | Yes | No | Backend WebSocket URL (`https://api.example.com`) | `frontend/src/services/messaging.ts:134` |

---

## 5. Database Architecture & Indexing Strategy

### Implemented in Repository
1. **Defined Mongoose Schemas & Indexes:**
   - **User:** Unique `email`, single indexes on `role`, `accountStatus`, `verificationStatus`, `college`, `collegeDomainVerified`, and compound text search index on `{ name, designation, company, department, skills }`.
   - **VerificationRequest:** Partial unique index `{ user: 1 }` with `{ status: 'pending' }` ensuring only 1 pending request per user, and compound query index `{ status: 1, college: 1, createdAt: -1 }`.
   - **College:** Unique `name`, unique `code`, text search index on `{ name, code }`.
   - **ConnectionRequest:** Compound unique index on `{ requester: 1, recipient: 1 }`, status queries on `{ recipient: 1, status: 1, createdAt: -1 }`.
   - **Job / Event / Message / Notification:** Compound pagination and status query indexes.

2. **Auto-Index Strategy:**
   - In development/test, Mongoose automatically synchronizes indexes on boot.
   - **Production Recommendation:** Explicit index synchronization step (`npm run build && node dist/syncIndexes.js` or via administrative script) prior to directing live user traffic, avoiding runtime startup index locks on large datasets.

### Required External Infrastructure (Not Provisioned)
- MongoDB 6.0+ cluster with primary-secondary-arbiter or 3-node replica set.
- Continuous automated point-in-time recovery (PITR) with daily snapshot retention (minimum 30 days).
- VPC peering / IP allowlisting restricted strictly to application backend worker IPs.

---

## 6. Private Object Storage Strategy

### Implemented in Repository
- `LocalStorageService` manages file paths with strict separation between public media (`/uploads/`) and private credentials (`uploads_private/`).
- Magic-byte validation (`validateProofDocumentBuffer`, `validateResumeBuffer`) prevents MIME-spoofing attacks before files are written to disk.
- Stream controller enforces existence-hiding 404s for unauthorized requests and transmits `X-Content-Type-Options: nosniff`, `Content-Disposition: attachment`, and `Cache-Control: private, no-store`.

### Required External Infrastructure (Not Provisioned)
- Dedicated S3-compatible private bucket (AWS S3, Cloudflare R2, Google Cloud Storage).
- Bucket policy configured with **Block All Public Access**; access granted solely via IAM service role or pre-signed short-lived authorization URLs (5-minute expiry).

---

## 7. Transactional Email & Deliverability (SMTP)

### Implemented in Repository
- Templated email dispatch for Email Verification, Password Reset, and Verification Status Updates (`backend/src/services/emailService.ts`).
- Verification URLs built dynamically using `APP_BASE_URL` without hardcoded localhost dependencies in production.

### Required External Infrastructure (Not Provisioned)
- Dedicated SMTP provider (SendGrid, Mailgun, Amazon SES, Postmark).
- **DNS Deliverability Records:**
  - **SPF:** `v=spf1 include:mailgun.org ~all`
  - **DKIM:** 2048-bit domain key record (`k=rsa; p=...`)
  - **DMARC:** `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@example.com`

---

## 8. Frontend Hosting & CDN

### Implemented in Repository
- Pre-configured Vite build pipeline outputting static hashed JavaScript, CSS, and asset bundles to `frontend/dist/`.
- Client-side routing handled by `react-router-dom` v6 with custom Error Boundaries and 404 pages.

### Required External Infrastructure (Not Provisioned)
- Static CDN / Object storage host (Cloudflare Pages, Vercel, Netlify, AWS S3 + CloudFront).
- **SPA Fallback Rule:** Mandatory server-side rewrite rule routing all non-asset requests (`/*`) to `/index.html` with HTTP status `200`.
- **Caching Policy:**
  - `/assets/*` (hashed files): `Cache-Control: public, max-age=31536000, immutable`
  - `/index.html`: `Cache-Control: no-cache, no-store, must-revalidate`

---

## 9. Backend Hosting & Compute

### Implemented in Repository
- Standalone Node.js HTTP server binding to `0.0.0.0:${PORT}`.
- Graceful shutdown listener on `SIGTERM` and `SIGINT` draining active connections, closing Socket.IO instances, and disconnecting Mongoose before exiting.
- Health check route at `GET /api/health` returning live JSON status envelope.

### Required External Infrastructure (Not Provisioned)
- Containerized or PaaS runtime (Docker on AWS ECS/Fargate, Google Cloud Run, DigitalOcean App Platform, or Linux VPS with PM2).
- Reverse proxy (Nginx / ALB / Traefik) terminating TLS and passing client IP headers with `TRUST_PROXY=1`.

---

## 10. Real-Time Socket.IO Infrastructure

### Implemented in Repository
- Socket.IO server engine attached to HTTP server instance (`backend/src/socket.ts`).
- Handshake middleware validating JWT access token and live account status (`active`).
- Real-time event rooms for direct messaging (`message:send`, `message:new`) and user notifications (`notification:new`).

### Required External Infrastructure (Not Provisioned)
- Reverse proxy configured with WebSocket upgrade support (`proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`).
- **Horizontal Scaling Requirement:** If scaling beyond a single backend instance, attach a Redis adapter (`@socket.io/redis-adapter`) to synchronize real-time room events across instances.

---

## 11. Security Architecture & Secret Management

### Implemented in Repository
- **Authentication:** Stateless JWT access tokens (15m expiry) + Hashed refresh token rotation (7d expiry, SHA-256) with single-use replay detection.
- **RBAC & Verification Gating:** Route and controller level gating enforcing role and verification status (`requireVerified`).
- **Password Security:** `bcryptjs` with salt round cost factor 12.
- **HTTP Security:** `helmet` security headers, strict CORS origin check, rate limiting on sensitive endpoints.

### Secret Rotation Procedures

| Secret Name | Impact of Rotation | Recommended Cadence | Procedure |
| :--- | :--- | :--- | :--- |
| `JWT_ACCESS_SECRET` | Invalidates all active 15m access tokens; users refresh on next request. | Every 90–180 days | Update variable in host environment and restart backend instances. |
| `JWT_REFRESH_SECRET`| Invalidates all active refresh tokens; all users must log in again. | Every 180 days or on breach | Update variable, clear `refreshTokenHash` on User collection, restart instances. |
| `MONGODB_URI` | Reconnects database client; temporary connection drop if credentials change. | Annually or on credential leak | Provision new DB user in Atlas, update connection URI, trigger zero-downtime rolling restart. |
| `SMTP_PASSWORD` | Halts outbound transactional email until updated. | Annually | Generate new SMTP API key in mail provider, update variable, restart backend. |

---

## 12. Monitoring, Observability & Health Checks

### Signals Implemented in Repository
- **Liveness & Readiness:** `GET /api/health` returns `200 OK` with JSON envelope containing environment, timestamp, and status.
- **Audit Trails:** Administrative actions recorded permanently in `AdminAuditLog` collection.
- **Structured Error Responses:** Centralized error handler captures unhandled exceptions and outputs sanitized client error codes without stack-trace leakage in production.

### Required External Monitoring (Not Provisioned)
- Synthetic uptime monitoring pings on `GET /api/health` every 60 seconds with alerting on HTTP status != 200.
- Application Performance Monitoring (APM) and centralized log aggregation (Datadog, Sentry, CloudWatch).

---

## 13. Backup & Disaster Recovery Plan

### Required External Infrastructure (Not Provisioned)
- **Database Backup:** Automated daily snapshot backups with 30-day retention and continuous Point-in-Time Recovery (PITR).
- **Private Document Backup:** Versioning enabled on private object storage bucket with cross-region replication for disaster resilience.
- **Recovery Targets (Owner Decision):**
  - **RPO (Recovery Point Objective):** Target <= 1 hour via continuous oplog replication.
  - **RTO (Recovery Time Objective):** Target <= 4 hours to provision replacement compute and restore database.

---

## 14. Deployment Sequence (Step-by-Step)

```
[1. DNS & Domain Setup]
       │ Provide: app.example.com, api.example.com
       ▼
[2. Database Provisioning]
       │ Action: Provision MongoDB Atlas Cluster
       │ Supply: MONGODB_URI to backend environment
       ▼
[3. Email & SMTP Setup]
       │ Action: Configure transactional SMTP provider & DNS (SPF/DKIM/DMARC)
       │ Supply: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD
       ▼
[4. Private Storage Setup]
       │ Action: Provision S3-compatible private bucket with zero public access
       │ Supply: Storage credentials or IAM container roles
       ▼
[5. Backend Build & Launch]
       │ Action: Deploy container/Node.js app, configure TRUST_PROXY, run index sync
       │ Supply: JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, APP_BASE_URL, CLIENT_URL
       │ Verification Gate: GET https://api.example.com/api/health returns 200 OK
       ▼
[6. Admin Account Bootstrap]
       │ Action: Run seed script (npm run seed:admin) or create first admin account
       ▼
[7. Frontend Build & Deploy]
       │ Action: Build frontend SPA with VITE_API_URL and VITE_SOCKET_URL
       │ Verification Gate: Access https://app.example.com and verify login/registration
```

---

## 15. Rollback Strategy

- **Frontend Rollback:** Re-point CDN / web host deployment to previous static release commit (instant, zero downtime).
- **Backend Rollback:** Re-deploy previous container image / git commit tag.
- **Database Rollback:** If schema backwards-incompatible migrations occurred, restore point-in-time snapshot prior to deploy timestamp.
- **Git Hygiene:** Always use `git revert <commit-hash>` rather than destructive history rewrites (`git reset --hard` / force push).

---

## 16. Production Smoke Test Runbook

| Test Category | Action | Endpoint / Surface | Expected Result |
| :--- | :--- | :--- | :--- |
| **System Health** | Send GET request | `GET /api/health` | HTTP `200 OK` with `{ status: "ok" }` |
| **Registration** | Register student account | `POST /api/v1/auth/register` | User created; email verification token generated |
| **Email Verification** | Click token link | `POST /api/v1/auth/verify-email` | Account standing updates to `email_verified` |
| **Affiliation Verification** | Submit college & proof | `POST /api/v1/verification-requests` | Verification request created in `pending` status |
| **Admin Review** | Review & approve request | `PATCH /api/v1/admin/verification-requests/:id/approve` | Request status becomes `approved`; user becomes `admin_approved` |
| **Private File Security** | Request document as stranger | `GET /api/v1/verification-requests/:id/document` | HTTP `404 DOCUMENT_NOT_FOUND` (existence hidden) |
| **Real-Time Messaging** | Exchange chat message | WebSocket `message:send` | Message persisted in MongoDB and emitted instantly via `message:new` |
| **Rate Limiting** | Spam invalid logins | `POST /api/v1/auth/login` | HTTP `429 Too Many Requests` envelope returned |

---

## 17. External Infrastructure Not Yet Provisioned

1. **MongoDB Atlas Database Cluster**
2. **Transactional SMTP Service (SendGrid/Mailgun/SES)**
3. **Private Object Storage Bucket (AWS S3/Cloudflare R2)**
4. **Backend Application Compute Host (ECS/Cloud Run/VPS)**
5. **Frontend Static CDN Host (Cloudflare Pages/Vercel/S3)**
6. **Production Domain Names & DNS Nameservers**
7. **APM & Centralized Logging Service**

---

## 18. Infrastructure Options Comparison

| Dimension | Option A: Fully Managed (PaaS / Serverless) | Option B: Container / VPS (Self-Managed) | Option C: Hybrid Architecture (Recommended) |
| :--- | :--- | :--- | :--- |
| **Compute & Host** | Vercel (Frontend) + Render / Heroku (Backend) | Single Ubuntu VPS (Nginx + PM2 + Docker) | Cloudflare Pages (Frontend) + AWS ECS / DigitalOcean App (Backend) |
| **Database** | MongoDB Atlas Serverless / Shared | Self-hosted MongoDB on VPS | MongoDB Atlas Dedicated Cluster (M10+) |
| **Operational Overhead**| **Low** (Automated builds, managed SSL) | **High** (Manual OS patching, SSL renewal, firewall config) | **Medium** (Standardized containers, managed database) |
| **WebSocket Support** | Partial (Requires long-running compute tier) | Native (Configured via Nginx proxy) | Native (Full persistent WebSocket support) |
| **Scaling Capability** | High (Instant auto-scaling) | Limited (Vertical scaling / manual multi-node) | High (Independent frontend edge & container autoscaling) |
| **Cost Profile** | Pay-per-usage / Higher per-unit cost | Fixed low baseline / Higher ops labor | Balanced cost-to-performance ratio |

---

## 19. Open Decisions for Project Owner

1. **Hosting Architecture Selection:** Choose Option A (PaaS), Option B (VPS), or Option C (Hybrid Cloud).
2. **Production Domain Selection:** Select canonical apex domain (e.g. `alumniconnect.edu`).
3. **Cloud Region & Data Residency:** Select geographic cloud region (e.g. `us-east-1`, `eu-west-1`, or `ap-south-1`).
4. **Transactional Email Provider:** Select provider account (SendGrid, Mailgun, AWS SES, or Postmark).
5. **RPO / RTO Target SLA:** Formally establish data recovery objectives for institutional compliance.

---

## 20. Appendix: Frontend Observations (Read-Only — Not Modified)

1. **SPA Catch-All Route Rewrites:**  
   *File:* `frontend/src/routes/AppRoutes.tsx`  
   *Observation:* React Router requires web server rewrite configuration (`/* -> /index.html`) on static hosts.
2. **WebSocket URL Configuration:**  
   *File:* `frontend/src/services/messaging.ts:134`  
   *Observation:* Production builds must provide `VITE_SOCKET_URL=https://api.yourdomain.com` to prevent mixed-content protocol warnings under HTTPS.
3. **Modal Close Button Accessibility:**  
   *File:* `frontend/src/components/ui/Modal.tsx`  
   *Observation:* Adding explicit `aria-label="Close dialog"` is recommended for screen readers in future UI enhancements.
