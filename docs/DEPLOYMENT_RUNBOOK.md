# AlumniConnect — Complete Production Deployment Runbook

> **CRITICAL PRE-DEPLOYMENT NOTICE:**  
> This runbook is a comprehensive, step-by-step deployment guide.  
> **NO AUTOMATED DEPLOYMENTS HAVE OCCURRED.** All credentials and secret values in this document use unambiguous placeholders.  
> Never commit actual passwords, API keys, or database credentials.

---

## Table of Contents
1. [A. Accounts Required](#a-accounts-required)
2. [B. MongoDB Atlas Database Setup & Network Security](#b-mongodb-atlas-database-setup--network-security)
3. [C. Backend Hosting Setup (Render / Railway / DigitalOcean)](#c-backend-hosting-setup)
4. [D. Frontend Hosting Setup (Vercel / Netlify / Cloudflare Pages)](#d-frontend-hosting-setup)
5. [E. Resend SMTP Email Configuration](#e-resend-smtp-email-configuration)
6. [F. Production Environment Variables Reference](#f-production-environment-variables-reference)
7. [G. CORS & Origin Configuration](#g-cors--origin-configuration)
8. [H. Socket.IO Real-Time Configuration](#h-socketio-real-time-configuration)
9. [I. Private File Storage Requirements (Persistent Disk vs S3/R2)](#i-private-file-storage-requirements)
10. [J. Recommended Deployment Sequence](#j-recommended-deployment-sequence)
11. [K. First-Time Deployment Walkthrough](#k-first-time-deployment-walkthrough)
12. [L. Post-Deployment Smoke Test Checklist](#l-post-deployment-smoke-test-checklist)
13. [M. Rollback & Disaster Recovery Procedure](#m-rollback--disaster-recovery-procedure)
14. [N. Production Security & Hardening Checklist](#n-production-security--hardening-checklist)

---

## A. Accounts Required

Before initiating deployment, ensure access to the following service accounts:

| Service Category | Primary Recommendation | Alternatives | Purpose |
| :--- | :--- | :--- | :--- |
| **Source Control** | GitHub (`hafsa5901/AlumniConnect`) | GitLab | Repository hosting & continuous deployment triggers |
| **Database** | MongoDB Atlas (M10+ Dedicated or M0 Sandbox) | Self-hosted MongoDB | Managed MongoDB Replica Set persistence |
| **Backend Compute** | Render (Web Service) | Railway / DigitalOcean App Platform | Long-running Node.js + Socket.IO server |
| **Frontend CDN** | Vercel | Netlify / Cloudflare Pages | Global Edge CDN hosting React SPA |
| **Transactional Email**| Resend (SMTP API) | — | Registration OTP & password reset delivery |
| **Persistent Storage** | Render Persistent Disk | AWS S3 / Cloudflare R2 | Resumes & institutional verification documents |

---

## B. MongoDB Atlas Database Setup & Network Security

1. **Create Cluster:**
   - Log into [MongoDB Atlas](https://cloud.mongodb.com/).
   - Create a project (e.g., `AlumniConnect-Prod`).
   - Provision a cluster (Free M0 Sandbox for initial staging/testing or M10+ for production multi-region high availability).
   - Region: Select the cloud region closest to your backend hosting compute instance.

2. **Configure Database User:**
   - Navigate to **Security → Database Access**.
   - Click **Add New Database User**.
   - Authentication Method: **Password** (SCRAM-SHA-256).
   - Username: e.g., `alumniconnect_app_user`.
   - Password: Generate a secure, high-entropy password (min 32 characters).
   - User Privileges: `readWrite` on database `alumniconnect` (or `Built-in: readWriteAnyDatabase`).

3. **Network Access Control & IP Allowlisting:**
   - Navigate to **Security → Network Access**.
   - **Preferred Configuration (Static / Dedicated Egress IP Allowlisting):**
     - Restrict Atlas network access to the specific static outbound IPv4 addresses assigned to your backend service.
     - *Backend Provider Verification (Render):*
       - **Render Dedicated IPs (Pro plans or higher):** Render provides native Dedicated IPs (sets of 3 reserved IPv4 addresses per region) that route outbound traffic through fixed IPs. *Source:* [Render Dedicated IPs Documentation](https://render.com/docs/dedicated-ips) (Accessed: September 30, 2026). Add these 3 specific `/32` IP addresses to Atlas Network Access.
       - **Render Shared Regional CIDRs (Starter / Standard plans):** Starter/Standard plans use shared regional dynamic outbound ranges. *Source:* [Render Outbound IP Addresses Documentation](https://render.com/docs/outbound-ip-addresses) (Accessed: September 30, 2026). Retrieve the regional CIDR list from Render Dashboard (Service Details → Connect → Outbound tab) and allowlist those regional CIDRs, or attach a static egress proxy add-on (e.g., QuotaGuard or Fixie).
   - **Last-Resort Fallback (`0.0.0.0/0` — Explicit Security Trade-Off):**
     - If operating on a free/dynamic-egress starter tier without dedicated IPs, proxy add-ons, or private networking, opening Atlas Network Access to `0.0.0.0/0` is a last-resort fallback.
     - **Security Trade-Off:** Allowing `0.0.0.0/0` exposes the database endpoint to public network port scanning. Any host on the internet can attempt to authenticate. When using this fallback, security depends entirely on strong database password entropy (min 32 characters generated via CSPRNG), mandatory TLS 1.3 encryption, and strictly scoped database user privileges.

4. **Construct Connection String (Placeholder Format):**
   ```text
   mongodb+srv://<DB_USERNAME>:<DB_PASSWORD>@<CLUSTER_HOST>/alumniconnect?retryWrites=true&w=majority&appName=AlumniConnect
   ```
   *Replace `<DB_USERNAME>`, `<DB_PASSWORD>`, and `<CLUSTER_HOST>` with actual values in hosting dashboard environment settings.*

---

## C. Backend Hosting Setup

### Recommended Provider: **Render** (or Railway / DigitalOcean App Platform)

#### Service Parameters:
- **Environment:** Node.js (Node 18 LTS or Node 20 LTS)
- **Root Directory:** `backend`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start` (runs `node dist/server.js`)
- **Health Check Path:** `/api/health`
- **Auto-Deploy:** Yes (on push to `main` branch)

#### Health Check Verification:
The application exposes `GET /api/health` before global rate limiters:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-09-30T12:00:00.000Z",
    "environment": "production"
  }
}
```

#### Process Architecture:
- Single long-running Node.js process.
- Binds to `0.0.0.0:${PORT}` (Render automatically assigns `PORT`).
- Handles `SIGTERM` and `SIGINT` signals for graceful drain of HTTP and Socket.IO connections.

---

## D. Frontend Hosting Setup

### Recommended Provider: **Vercel** (or Netlify / Cloudflare Pages)

#### Service Parameters:
- **Framework Preset:** Vite
- **Root Directory:** `frontend`
- **Build Command:** `npm run build` (executes `tsc && vite build`)
- **Output Directory:** `dist`
- **Node.js Version:** 18.x or 20.x

#### SPA Routing Fallback:
Client-side routing with React Router requires all non-file paths to rewrite to `index.html`.
Configure SPA routing in your hosting provider dashboard or host configuration file (e.g. `vercel.json` rewrites or `_redirects` rules).

---

## E. Resend SMTP Email Configuration

The application uses standard SMTP parameters connected to Resend:

- **SMTP Host:** `smtp.resend.com`
- **SMTP Port:** `465` (SSL/TLS) or `587` (STARTTLS)
- **SMTP Secure:** `true` (for port 465)
- **SMTP User:** `resend`
- **SMTP Password:** `<YOUR_RESEND_API_KEY>` (e.g., `re_...`)
- **From Address:** `onboarding@resend.dev`
- **Requirement Guard:** `REQUIRE_PROD_EMAIL=true` (forces startup validation in production mode)

> [!IMPORTANT]
> The current verified sender is `EMAIL_FROM=onboarding@resend.dev`. Do NOT change this or attempt domain DNS verification unless a custom domain is formally acquired and verified in Resend.

---

## F. Production Environment Variables Reference

### 1. Backend Environment Variables (Render / Host Dashboard)

| Variable Name | Required | Example / Recommended Value | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | **Yes** | `production` | Enables production security guards |
| `PORT` | **Yes** | `5000` (or host-assigned) | HTTP listener port |
| `TRUST_PROXY` | **Yes** | `1` | Trust single reverse proxy hop (Render/Cloudflare) |
| `MONGODB_URI` | **Yes** | `mongodb+srv://<DB_USER>:<DB_PASS>@<HOST>/alumniconnect` | MongoDB Atlas replica set URI |
| `JWT_ACCESS_SECRET` | **Yes** | `<YOUR_JWT_ACCESS_SECRET_MIN_32_CHARS>` | Secret for signing 15-minute access tokens |
| `JWT_REFRESH_SECRET`| **Yes** | `<YOUR_JWT_REFRESH_SECRET_MIN_32_CHARS>` | Secret for signing 7-day refresh tokens |
| `JWT_ACCESS_EXPIRES_IN` | No | `15m` | Access token lifespan |
| `JWT_REFRESH_EXPIRES_IN`| No | `7d` | Refresh token lifespan |
| `OTP_HASH_SECRET` | **Yes** | `<YOUR_OTP_HMAC_SECRET_MIN_32_CHARS>` | Keyed HMAC-SHA256 secret for 6-digit OTPs |
| `APP_BASE_URL` | **Yes** | `https://alumniconnect.vercel.app` | Public frontend URL for email links |
| `CLIENT_URL` | **Yes** | `https://alumniconnect.vercel.app` | Exact frontend origin allowlist for CORS |
| `STUDENT_EMAIL_DOMAIN` | **Yes** | `gndecb.ac.in` | Enforces `@gndecb.ac.in` for student signups |
| `COLLEGE_EMAIL_DOMAINS`| **Yes** | `gndecb.ac.in` | Institutional domain allowlist |
| `STUDENT_REQUIRES_ADMIN_APPROVAL` | No | `false` | Student auto-approval after OTP |
| `SMTP_HOST` | **Yes** | `smtp.resend.com` | Resend SMTP server |
| `SMTP_PORT` | **Yes** | `465` | SSL SMTP port |
| `SMTP_SECURE` | **Yes** | `true` | Enable TLS/SSL |
| `SMTP_USER` | **Yes** | `resend` | Resend username |
| `SMTP_PASSWORD` | **Yes** | `<YOUR_RESEND_API_KEY>` | Resend API key |
| `EMAIL_FROM` | **Yes** | `onboarding@resend.dev` | Verified email sender |
| `REQUIRE_PROD_EMAIL` | **Yes** | `true` | Hard failure if SMTP is unconfigured |
| `FILE_STORAGE_DRIVER` | No | `local` | Storage driver (`local` or `s3`) |
| `ADMIN_EMAIL` | No | `<YOUR_INITIAL_ADMIN_EMAIL>` | Initial admin bootstrap email (seed) |
| `ADMIN_PASSWORD` | No | `<YOUR_INITIAL_ADMIN_PASSWORD>` | Initial admin bootstrap password (seed) |
| `ALLOW_PROD_SEED` | No | `false` | Must be `true` only when running seed in prod |

### 2. Frontend Environment Variables (Vercel / Host Dashboard)

| Variable Name | Required | Example / Recommended Value | Description |
| :--- | :--- | :--- | :--- |
| `VITE_API_URL` | **Yes** | `https://alumniconnect-api.onrender.com/api/v1` | Backend REST API endpoint |
| `VITE_SOCKET_URL`| **Yes** | `https://alumniconnect-api.onrender.com` | Backend Socket.IO endpoint |

---

## G. CORS & Origin Configuration

1. **Exact Origin Allowlist:**
   - The backend explicitly checks `req.headers.origin === env.CLIENT_URL`.
   - Wildcards (`*`) are disallowed to protect credentials (`cookies: true`).
2. **Matching Alignment:**
   - Backend `CLIENT_URL` **must exactly match** the protocol and domain of the deployed frontend (e.g., `https://alumniconnect.vercel.app` without trailing slash).
   - Frontend `VITE_API_URL` **must include** `/api/v1` (e.g., `https://alumniconnect-api.onrender.com/api/v1`).
   - Frontend `VITE_SOCKET_URL` **must be** the backend origin (e.g., `https://alumniconnect-api.onrender.com`).

---

## H. Socket.IO Real-Time Configuration

- **Transport Protocols:** Supports WebSocket with HTTP Long-Polling fallback (`transports: ['websocket', 'polling']`).
- **Authentication:** Handshake validated via JWT in `auth.token` or `Authorization: Bearer` header.
- **Topology:** Single-instance backend deployment utilizes the built-in memory adapter.
- **Scaling Note:** If backend compute is scaled beyond 1 instance in the future, enable sticky sessions on the load balancer or attach `@socket.io/redis-adapter`. For initial launch, a single instance is standard.

---

## I. Private File Storage Requirements

### Current Implementation & Code Verification
As implemented in `backend/src/services/storage/LocalStorageService.ts:11-13`:
- **Public Uploads:** `uploads/` (e.g., `uploads/avatars/`).
- **Private Uploads:** `uploads_private/` (e.g., `uploads_private/resumes/` and `uploads_private/verification_docs/`).
- **Private Access Control:** Streamed exclusively via authenticated endpoints with strict ownership and administrator verification checks.

### Production Ephemeral Disk Warning
> [!WARNING]
> On standard container/PaaS platforms (Render, Railway, etc.), the root container filesystem is **ephemeral**. Every redeploy, restart, or maintenance cycle completely wipes local disk storage. Deploying without persistent storage will silently destroy uploaded user resumes and institutional proof documents.

### Initial Deployment Requirement (Persistent Disk):
- If using local disk storage on Render, attach a **Persistent Disk** to the backend Web Service:
  - Mount paths must encompass both `uploads/` and `uploads_private/`.
  - Recommended minimum disk size: 1 GB (scalable up to 1 TB+).
- **Future Cloud-Native Alternative:** S3/Cloudflare R2-compatible object storage driver as documented in the storage gap analysis in `docs/PRODUCTION_PROVIDER_MATRIX.md`.

---

## J. Recommended Deployment Sequence

```
1. Setup MongoDB Atlas Cluster & Database User
   ↓
2. Setup Resend API Key (onboarding@resend.dev)
   ↓
3. Deploy Backend API to Render (Obtain https://*.onrender.com URL)
   ↓
4. Deploy Frontend to Vercel (Inject VITE_API_URL and VITE_SOCKET_URL)
   ↓
5. Update Backend CLIENT_URL and APP_BASE_URL with Vercel Frontend URL
   ↓
6. (Optional) Run Initial Admin Seed Script
   ↓
7. Run Post-Deployment Smoke Tests
```

---

## K. First-Time Deployment Walkthrough

### Step 1: Deploy Backend Web Service
1. In Render Dashboard, click **New + → Web Service**.
2. Connect your GitHub repository `hafsa5901/AlumniConnect`.
3. Configure settings:
   - Name: `alumniconnect-api`
   - Root Directory: `backend`
   - Runtime: `Node`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
4. Add Environment Variables (from Section F.1).
5. Click **Create Web Service**.
6. Wait for build and deployment to succeed. Test `https://<backend-url>/api/health`.

### Step 2: Deploy Frontend
1. In Vercel Dashboard, click **Add New… → Project**.
2. Import `hafsa5901/AlumniConnect`.
3. Configure Project:
   - Framework Preset: `Vite`
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Add Environment Variables:
   - `VITE_API_URL`: `https://<backend-url>/api/v1`
   - `VITE_SOCKET_URL`: `https://<backend-url>`
5. Click **Deploy**.
6. Note the assigned frontend domain (e.g., `https://alumniconnect.vercel.app`).

### Step 3: Synchronize CORS on Backend
1. Return to Render Dashboard → `alumniconnect-api` → **Environment**.
2. Set:
   - `CLIENT_URL`: `https://alumniconnect.vercel.app`
   - `APP_BASE_URL`: `https://alumniconnect.vercel.app`
3. Save changes (Render will trigger a zero-downtime redeploy).

### Step 4: Bootstrap Platform Admin (One-Time Only)
In Render backend shell or one-off job:
```bash
ALLOW_PROD_SEED=true ADMIN_EMAIL="<YOUR_ADMIN_EMAIL>" ADMIN_PASSWORD="<YOUR_ADMIN_PASSWORD>" npm run seed:admin
```
*Note: In production, `seed:admin` strictly requires `ALLOW_PROD_SEED=true` and explicit non-empty credentials, refusing execution otherwise.*

---

## L. Post-Deployment Smoke Test Checklist

- [ ] **Health Endpoint:** `GET https://<backend>/api/health` returns `200 OK` with `{ status: "ok" }`.
- [ ] **Frontend Loading:** Home page loads with responsive styling, navigation, and zero console errors.
- [ ] **SPA Navigation:** Direct browser navigation to `/login`, `/register`, and `/directory` loads correctly without 404.
- [ ] **Student Registration Security:**
  - Register with non-institutional email as Student → **Must be rejected with 422**.
  - Register with `@gndecb.ac.in` as Student → **Must succeed and prompt for 6-digit OTP**.
- [ ] **Real OTP Delivery:** Check inbox of registered email for the 6-digit verification code.
- [ ] **OTP Verification:** Enter 6-digit OTP → Account transitions to `email_verified` and grants dashboard access.
- [ ] **Alumni Registration:** Register with personal email → Must succeed and place account in `pending` admin review.
- [ ] **Admin Login:** Log in with seeded admin credentials → Access `/admin` dashboard and verification queue.
- [ ] **Real-Time Messaging:** Send a message between two accounts → Real-time socket message delivery verified.

---

## M. Rollback & Disaster Recovery Procedure

1. **Frontend Instant Rollback:**
   - In Vercel Dashboard → Deployments.
   - Click the three dots `...` on the previous working deployment and click **Instant Rollback**.
2. **Backend Instant Rollback:**
   - In Render Dashboard → Deploys.
   - Select the previous successful deployment and click **Rollback to this deploy**.
3. **Database Point-in-Time Restore:**
   - In MongoDB Atlas → Backup.
   - Select point-in-time snapshot to restore if data corruption occurs.

---

## N. Production Security & Hardening Checklist

- [x] Backend validation authoritative (frontend validation is non-security UX only).
- [x] Institutional email domain `@gndecb.ac.in` strictly enforced on server.
- [x] OTP hashing uses keyed HMAC-SHA256 with 10-minute expiry and 5-attempt limit.
- [x] Passwords hashed with bcrypt (cost factor 12).
- [x] Stateless JWT access tokens (15m) + single-use rotating refresh tokens (7d).
- [x] Helmet security headers active (`Cross-Origin-Resource-Policy: cross-origin`).
- [x] Strict CORS allowlist matching frontend origin.
- [x] Global rate limiter active on all `/api/*` routes.
- [x] Admin routes protected with role-based authorization (`role: 'admin'`).
- [x] Private file access protected by ownership and admin verification checks.
- [x] Sensitive fields (`passwordHash`, `verificationTokenHash`, `otpHash`) excluded from query projections.
- [x] Zero secrets committed to git.
