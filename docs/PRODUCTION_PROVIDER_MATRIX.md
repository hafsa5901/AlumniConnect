# AlumniConnect — Production Provider Matrix & Infrastructure Planning

> **CRITICAL DECLARATION:**  
> **PROVIDER RESEARCH AND PRODUCTION CONFIGURATION PLANNING COMPLETE — NO DEPLOYMENT PERFORMED.**  
> **NO CLOUD ACCOUNTS, DATABASES, BUCKETS, HOSTS, OR DNS RECORDS WERE CREATED OR PROVISIONED.**  
> **NO FRONTEND FILES WERE MODIFIED (FRONTEND REMAINS FROZEN AND READ-ONLY).**  
> **Research Date:** September 29, 2026. All external facts sourced directly from official documentation.

---

## 1. Repository Requirement Profile

Before evaluating cloud providers, the repository's concrete runtime profile and architectural boundaries were derived directly from active source code and configurations:

### 1.1 Backend Runtime & Process Profile
- **Runtime Environment:** Node.js 18+ LTS (`backend/package.json`).
- **Framework & Language:** Express 4.21.2 with TypeScript 5.7.3 (`tsconfig.json`).
- **Build & Artifacts:** TypeScript compiler (`tsc`) outputs compiled CommonJS JavaScript to `backend/dist/` (`backend/package.json:8`).
- **Process Model:** Single long-running Node.js process (`backend/src/server.ts:7-43`). Not serverless or ephemeral per-request execution.
- **Network Binding:** Binds HTTP listener to `0.0.0.0:${PORT}` where `PORT` defaults to `5000` (`backend/src/config/env.ts:54`, `backend/src/server.ts:16`).
- **Signal Handling & Graceful Shutdown:** Captures `SIGTERM` and `SIGINT` to gracefully drain incoming HTTP connections, close Socket.IO server instances, and safely disconnect Mongoose before exiting (`backend/src/server.ts:22-32`).
- **Health Endpoints:**
  - `GET /api/health`: Returns JSON `{ success: true, data: { status: "ok", timestamp, environment } }` with HTTP `200 OK` (`backend/src/app.ts:73-82`).
  - Positioned **before** the global API rate limiter (`backend/src/app.ts:85`) to ensure synthetic uptime monitors and orchestrator liveness probes are never throttled.
- **Logging & Observability:** Output streams to `stdout`/`stderr` formatted via `morgan('dev')` in non-test modes (`backend/src/app.ts:66`) with centralized JSON error envelopes (`backend/src/middleware/errorHandler.ts`).
- **Reverse Proxy Handling (`TRUST_PROXY`):** Parsed dynamically in `backend/src/app.ts:27-36`. Supports integer hop count (e.g., `1` for single load balancer/CDN), boolean (`true` sets 1, `false` disables), or specific CIDR/subnet strings. Safe default is `false`.

### 1.2 Persistence & Database (MongoDB)
- **ODM & Drivers:** Mongoose `^8.9.5` (`backend/package.json:24`), utilizing the MongoDB Node.js driver 6.x supporting MongoDB Server versions 6.0, 7.0, and 8.0+.
- **Connection Mechanics:** Accepts standard connection strings (`mongodb://` and `mongodb+srv://`) validated at boot (`backend/src/config/env.ts:35-37`, `backend/src/config/db.ts:6-8`).
- **Schema & Indexing Features:**
  - **Partial Unique Indexes:** `VerificationRequest` enforces `{ user: 1 }` with `{ unique: true, partialFilterExpression: { status: 'pending' } }` (`backend/src/models/VerificationRequest.ts`).
  - **Compound & Text Search Indexes:** Compound unique indexes on `ConnectionRequest` (`{ requester: 1, recipient: 1 }`), compound query indexes on `Message`, `Job`, `Event`, and text search indexes on `User` and `College`.
  - **Auto-Index Behavior:** Mongoose auto-indexes on startup during development. For production environments, explicit index pre-synchronization is recommended to prevent startup lock contention.

### 1.3 Real-Time Communications (Socket.IO)
- **Library Version:** Socket.IO `^4.8.1` (`backend/package.json:28`).
- **Configured Transports:** Supports `['websocket', 'polling']` with CORS origin verification against `CLIENT_URL` (`backend/src/socket.ts:18-29`).
- **Handshake Authentication:** Authenticates connections via JWT access token passed in `auth.token`, `Authorization: Bearer <token>` header, or `accessToken` cookie (`backend/src/socket.ts:32-87`). Re-verifies live user account status (`accountStatus === 'active'`).
- **Scaling & Adapter State:** Currently operates with default in-memory adapter (single-instance). Multi-instance clustering requires sticky load-balancer sessions or the `@socket.io/redis-adapter`.

### 1.4 Storage Abstraction & Gap Analysis
- **Current Implementation:** `LocalStorageService` implementing `IStorageService` (`backend/src/services/storage/`):
  - `save(file, folder)`: Persists public assets to `uploads/<folder>/` returning `/uploads/<folder>/<uuid>.<ext>`.
  - `savePrivate(file, folder)`: Persists sensitive verification credentials to `uploads_private/<folder>/`.
  - `delete(fileUrl)` / `deletePrivate(storagePath)`: Unlinks files from local disk.
  - `getPrivateFilePath(storagePath)`: Path traversal guarded path resolver.
- **S3 / R2 Adapter Gap List (For Future Provisioning):**
  1. *Dependency:* Requires `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` (to be added during production provisioning, not in Phase 9A).
  2. *Driver Implementation:* Implement `S3StorageService implements IStorageService` using `PutObjectCommand`, `DeleteObjectCommand`, and `GetObjectCommand` or presigned URLs.
  3. *Controller Compatibility:* `verificationRequestsController.ts` currently streams files from disk via `res.sendFile`. For S3/R2, private documents can be streamed via `s3Client.send(new GetObjectCommand(...))` into `res` or redirected to a short-lived (60s) pre-signed download URL.

### 1.5 Transactional Email & Deliverability
- **Engine:** `nodemailer` `^6.9.16` (`backend/package.json:27`).
- **Configuration:** Configured in `backend/src/services/emailService.ts` via standard SMTP parameters: `SMTP_HOST`, `SMTP_PORT` (default `587`), `SMTP_SECURE` (`true` for 465, `false` for 587/STARTTLS), `SMTP_USER`, `SMTP_PASSWORD`, and `EMAIL_FROM`.
- **Validation:** Enforces production SMTP validation when `REQUIRE_PROD_EMAIL=true` or `SMTP_REQUIRED=true` (`backend/src/config/env.ts:39-45`).

### 1.6 Authentication & Cross-Origin Architecture
- **Tokens:** Stateless short-lived JWT access tokens (15m default) + stateful long-lived refresh tokens (7d default, SHA-256 hashed in database with single-use replay detection).
- **Refresh Token Transport:** HTTP-only cookie `refreshToken` set on path `/api/v1/auth`, `httpOnly: true`, `secure: NODE_ENV === 'production'`, `sameSite: 'strict'` (`backend/src/utils/cookies.ts:8-14`).
- **Cross-Origin Implication:** Because `sameSite: 'strict'` is enforced, cross-origin requests from different apex domains will not send the cookie. Frontend and Backend MUST share the same registrable domain (e.g., `app.example.com` and `api.example.com`) or be served behind a unified reverse proxy.

### 1.7 Frontend Profile (Frozen — Read-Only)
- **Tooling:** React 18, Vite 6, TypeScript 5.6, Tailwind CSS 3.4 (`frontend/package.json`).
- **Build Command & Output:** `npm run build` (`tsc -b && vite build`) producing static assets in `frontend/dist/`.
- **Routing:** Client-side HTML5 history routing via `react-router-dom` v6 (`BrowserRouter` in `frontend/src/App.tsx`). Requires server-side SPA fallback rewriting non-file requests (`/*`) to `/index.html`.
- **Build-Time Variables:** Embedded at build time via Vite:
  - `VITE_API_URL`: Backend REST API base URL (`frontend/src/services/api.ts:3`).
  - `VITE_SOCKET_URL`: Backend WebSocket server base URL (`frontend/src/services/messaging.ts:134`).

---

## 2. Provider Comparison Matrices

### 2.1 Frontend Hosting Candidates

| Feature / Criteria | Vercel (Hobby / Pro) | Cloudflare Pages | Netlify (Free / Pro) |
| :--- | :--- | :--- | :--- |
| **Product Evaluated** | Vercel Static Deployments | Cloudflare Pages | Netlify Web Deployments |
| **Vite / SPA Support** | Full native support | Full native support | Full native support |
| **Monorepo Root Directory** | Supported (`Root Directory: frontend`) | Supported (`Root directory: frontend`) | Supported (`Base directory: frontend`) |
| **SPA Fallback Routing** | Requires `vercel.json` rewrites | **Zero config** (Auto-detected if no `404.html`) | Requires `_redirects` or `netlify.toml` |
| **File in `frontend/` Required?** | Yes (`vercel.json` rewrite rule) | **No** (Handled natively by platform) | Yes (`public/_redirects`) |
| **Custom Domains & SSL** | Unlimited custom domains, auto SSL | Unlimited custom domains, auto SSL | Custom domains, auto SSL |
| **Free Tier Allowance** | 100 GB bandwidth, 100 build hrs/mo | **Unlimited bandwidth**, 500 builds/mo | 300 credits/mo pooled (~100 GB / 300 mins) |
| **Commercial Terms on Free** | Non-commercial only (Pro is $20/user/mo) | Commercial allowed on free | Commercial allowed on free |
| **Asset Caching Policy** | Automatic immutable caching for hashed | Automatic edge caching for hashed assets | Automatic edge caching for hashed assets |
| **Instant Rollback** | Yes (Instant deploy re-point) | Yes (Instant deploy re-point) | Yes (Instant deploy re-point) |
| **Official Sources** | [Vercel Docs](https://vercel.com/docs) (2026-09-29) | [Cloudflare Pages Docs](https://developers.cloudflare.com/pages) (2026-09-29) | [Netlify Docs](https://docs.netlify.com) (2026-09-29) |
| **Verification Status** | `VERIFIED-OFFICIAL` | `VERIFIED-OFFICIAL` | `VERIFIED-OFFICIAL` |

### 2.2 Backend & Real-Time Compute Candidates

| Requirement / Dimension | Render (Starter Web Service) | Railway (Hobby / Pro) | DigitalOcean (App Platform Basic) | Self-Managed VPS (Ubuntu + Docker) |
| :--- | :--- | :--- | :--- | :--- |
| **Product Evaluated** | Render Managed Web Service | Railway Containers | DO App Platform Web Service | DO Droplet / Hetzner Cloud VPS |
| **Compute Pricing** | Free ($0) or Starter ($7/mo) | Hobby ($5/mo) / Pro ($20/mo + usage) | Basic ($5/mo - $12/mo) | Standard Droplet ($4 - $6/mo) |
| **Long-Running Process** | **PASS** (Node.js daemon) | **PASS** (Node.js daemon) | **PASS** (Node.js daemon) | **PASS** (Docker / PM2 daemon) |
| **WebSocket / Socket.IO** | **PASS** (Persistent over port 10000) | **PASS** (Persistent HTTP/1.1 upgrade) | **PASS** (Persistent Autobahn-tested) | **PASS** (Configured via Nginx proxy) |
| **Inactivity Sleep / Spindown** | Free spins down (15m); **Starter ($7) does NOT sleep** | Does NOT sleep while active/connected | Does NOT sleep on paid tiers ($5+) | **Never sleeps** (Dedicated instance) |
| **Outbound SMTP Ports** | Free: **BLOCKED**; Paid: **465 & 587 OPEN** (25 blocked) | Free/Hobby: **BLOCKED**; Pro: **OPEN** (465, 587, 2525) | Standard SMTP ports restricted/monitored | **Full control** (Ports 465 & 587 open; 25 by request) |
| **Static Egress IPs** | Dynamic by default (Region pool) | Pro Plan: Static Outbound IP add-on | Add-on ($25/mo) or dynamic pool | **Native Static IPv4 / IPv6** included |
| **Graceful Shutdown (SIGTERM)** | **PASS** (Delivers SIGTERM, configurable grace) | **PASS** (Delivers SIGTERM, 10s default) | **PASS** (Delivers SIGTERM, 30s grace) | **PASS** (Docker sends SIGTERM, 10-30s grace) |
| **Health Check Support** | **PASS** (Configurable path `/api/health`) | **PASS** (Configurable path `/api/health`) | **PASS** (Configurable path `/api/health`) | **PASS** (Docker / Nginx health probes) |
| **Persistent Disk** | Ephemeral (Persistent disk add-on available) | Ephemeral (Volume add-on available) | Ephemeral container filesystem | **Full persistent local SSD** |
| **Deploy from Repo / Docker** | Supports native Node build & Dockerfile | Supports native buildpack & Dockerfile | Supports native buildpack & Dockerfile | Docker Compose / Git Webhook |
| **Official Sources** | [Render Docs](https://render.com/docs) (2026-09-29) | [Railway Docs](https://docs.railway.com) (2026-09-29) | [DigitalOcean Docs](https://docs.digitalocean.com) (2026-09-29) | [DigitalOcean Pricing](https://www.digitalocean.com/pricing) (2026-09-29) |
| **Verification Status** | `VERIFIED-OFFICIAL` | `VERIFIED-OFFICIAL` | `VERIFIED-OFFICIAL` | `VERIFIED-OFFICIAL` |

### 2.3 Database Candidates (MongoDB Persistence)

| Criteria / Feature | MongoDB Atlas Flex (Serverless) | MongoDB Atlas Dedicated (M10) | Self-Hosted MongoDB (Option C VPS) |
| :--- | :--- | :--- | :--- |
| **Product Evaluated** | MongoDB Atlas Flex Cluster | MongoDB Atlas M10 Cluster | MongoDB Community Server 7.0+ on Linux |
| **Base Cost** | ~$0.10 / million ops + $0.25/GB-mo storage | ~$0.08 / hr (~$57 / month) | Included in VPS baseline cost ($0 extra) |
| **RAM & Storage** | Shared RAM; 5 GB storage maximum | 2 GB RAM; 10 GB - 128 GB dedicated SSD | Allocated from VPS host RAM & SSD |
| **Connection Limit** | Auto-scaling up to ~500 connections | Up to 1,500 persistent connections | Unlimited (configured in `mongod.conf`) |
| **Automated Backups & PITR** | Daily snapshots (No continuous PITR) | **Continuous PITR + automated daily snapshots** | Manual cron (`mongodump` to R2/S3) |
| **Network Access Control** | IP Access List allowlist | IP Access List, VPC Peering, AWS PrivateLink | Linux UFW firewall + TLS bind |
| **Replica Set & Transactions** | Multi-region replica set included | 3-node replica set included | Single node or manual replica set |
| **Mongoose Compatibility** | Fully compatible (Mongoose 8.x) | Fully compatible (Mongoose 8.x) | Fully compatible (Mongoose 8.x) |
| **Production Suitability** | Suitable for low-medium traffic | **Production Standard** (Enterprise SLA) | High maintenance / manual patching |
| **Official Sources** | [MongoDB Atlas Pricing](https://www.mongodb.com/pricing) (2026-09-29) | [MongoDB Atlas Pricing](https://www.mongodb.com/pricing) (2026-09-29) | [MongoDB Manual](https://www.mongodb.com/docs/manual/) (2026-09-29) |
| **Verification Status** | `VERIFIED-OFFICIAL` | `VERIFIED-OFFICIAL` | `VERIFIED-OFFICIAL` |

### 2.4 Object Storage Candidates (Private Proof Documents & Resumes)

| Dimension / Metric | Cloudflare R2 | Amazon S3 (Standard) |
| :--- | :--- | :--- |
| **API Compatibility** | S3-Compatible API (SigV4, standard SDKs) | Native S3 API |
| **Storage Pricing** | **$0.015 / GB-month** (First 10 GB free) | **$0.023 / GB-month** |
| **Class A / Write Ops** | **$4.50 / million** (First 1M/mo free) | **$5.00 / million** ($0.005 / 1,000 ops) |
| **Class B / Read Ops** | **$0.36 / million** (First 10M/mo free) | **$0.40 / million** ($0.0004 / 1,000 ops) |
| **Egress / Data Transfer** | **$0.00 / GB (ZERO egress fees)** | $0.09 / GB (First 100 GB/mo free internet egress) |
| **Public Access Guard** | Private by default; public access disabled | Block Public Access (BPA) enabled by default |
| **Presigned URL Support** | Supported (via standard S3 SigV4 presigners) | Supported (via `@aws-sdk/s3-request-presigner`) |
| **Encryption at Rest** | AES-256 enabled automatically | SSE-S3 / SSE-KMS enabled automatically |
| **Credential Scoping** | Bucket-scoped API Tokens (Read/Write) | Granular IAM Policies per bucket / prefix |
| **Official Sources** | [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/) (2026-09-29) | [AWS S3 Pricing](https://aws.amazon.com/s3/pricing/) (2026-09-29) |
| **Verification Status** | `VERIFIED-OFFICIAL` | `VERIFIED-OFFICIAL` |

### 2.5 Transactional Email Candidates (SMTP Transport)

| Feature / Criteria | Resend | Brevo (formerly Sendinblue) | Amazon SES |
| :--- | :--- | :--- | :--- |
| **SMTP Relay Host** | `smtp.resend.com` | `smtp-relay.brevo.com` | `email-smtp.<region>.amazonaws.com` |
| **Supported Ports** | Port `465` (SSL) & `587` (TLS) | Port `587` (STARTTLS) | Ports `465`, `587`, `25`, `2465` |
| **Free Tier Allowance** | 3,000 emails/mo (100 emails/day cap) | 300 emails/day ($0/mo) | 200 emails/day (Sandbox mode only) |
| **Paid Pricing Baseline** | Pro: $20/mo (50,000 emails) | Starter: $9/mo (5,000 emails) | Pay-as-you-go: **$0.10 per 1,000 emails** |
| **Sandbox Restrictions** | Instant live sending upon domain verification | Instant live sending upon domain verification | **Manual production request required** (1-2 day lead time) |
| **Domain Authentication** | SPF, DKIM, DMARC, MX records | SPF, DKIM, DMARC records | SPF, DKIM, DMARC records |
| **Nodemailer Fit** | **Direct drop-in** via existing SMTP config | **Direct drop-in** via existing SMTP config | **Direct drop-in** via existing SMTP config |
| **Log Retention** | 3 days on Free / 30 days on Pro | 30 days included | CloudWatch Logs integration |
| **Official Sources** | [Resend Docs](https://resend.com/docs) (2026-09-29) | [Brevo Pricing](https://www.brevo.com/pricing) (2026-09-29) | [AWS SES Pricing](https://aws.amazon.com/ses/pricing/) (2026-09-29) |
| **Verification Status** | `VERIFIED-OFFICIAL` | `VERIFIED-OFFICIAL` | `VERIFIED-OFFICIAL` |

### 2.6 Domain & DNS Candidates

| Feature / Metric | Cloudflare DNS + Registrar | Conventional Registrar (e.g. Porkbun / Namecheap) |
| :--- | :--- | :--- |
| **DNS Query Pricing** | **Free** (Unlimited Anycast queries) | Free basic DNS included with registration |
| **Domain Registration (.com)**| ~$9.77/year + $0.18 ICANN = **$9.95/year** (At-cost) | ~$10.50 - $14.00/year |
| **Automatic TLS / SSL** | Free universal SSL & edge certificates | Free Let's Encrypt or paid Comodo SSL |
| **Proxying & WAF** | Optional Layer 7 proxying & DDoS protection | DNS-only (No reverse proxy included) |
| **DNSSEC Support** | One-click free DNSSEC | Supported |
| **Email Records Support** | Full support for MX, TXT (SPF/DKIM/DMARC) | Full support for MX, TXT (SPF/DKIM/DMARC) |
| **Official Sources** | [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) (2026-09-29) | [Porkbun Pricing](https://porkbun.com) (2026-09-29) |
| **Verification Status** | `VERIFIED-OFFICIAL` | `VERIFIED-OFFICIAL` |

---

## 3. Backend Requirement-Fit Matrix

| Requirement | Render (Starter $7) | Railway (Pro $20) | DigitalOcean App ($5-$12) | VPS (Ubuntu $4-$6) |
| :--- | :---: | :---: | :---: | :---: |
| 1. Long-Running Node.js Process | **PASS** | **PASS** | **PASS** | **PASS** |
| 2. WebSocket Support & Timeouts | **PASS** (Port 10000) | **PASS** (No idle timeout) | **PASS** (Autobahn tested) | **PASS** (Nginx proxy) |
| 3. No Sleep / Cold Starts | **PASS** (Starter paid) | **PASS** (Active container) | **PASS** (Paid container) | **PASS** (Always active) |
| 4. Secrets & Env Var Management | **PASS** (Dashboard/CLI) | **PASS** (Dashboard/CLI) | **PASS** (Encrypted app env) | **PASS** (Systemd/.env) |
| 5. HTTPS Termination & Custom Domain | **PASS** (Managed certs) | **PASS** (Managed certs) | **PASS** (Managed certs) | **PASS** (Certbot / Let's Encrypt) |
| 6. Health Check Semantics (`/api/health`)| **PASS** (Liveness path) | **PASS** (Healthcheck path) | **PASS** (HTTP probe path) | **PASS** (Docker / Script) |
| 7. SIGTERM Delivery & Graceful Exit | **PASS** (Node binary) | **PASS** (Node binary) | **PASS** (Node binary) | **PASS** (Node binary) |
| 8. Structured & Persistent Logs | **PASS** (7-day stream) | **PASS** (7-day logs) | **PASS** (App platform logs) | **PASS** (Journald / Vector) |
| 9. Ephemeral Disk Awareness | **PASS** (Requires S3/R2) | **PASS** (Requires S3/R2) | **PASS** (Requires S3/R2) | **PASS** (Local or S3/R2) |
| 10. Outbound SMTP Connectivity | **PASS** (465/587 on paid) | **PASS** (465/587 on Pro) | **PASS** (465/587 relay) | **PASS** (465/587 open) |
| 11. Static Egress / Atlas Whitelist | Dynamic pool / Wide CIDR | Static IP add-on (Pro) | Dedicated Egress ($25/mo) | **PASS** (Fixed static IP) |
| 12. Multi-Instance Ready (Redis Socket) | Supported (w/ Redis) | Supported (w/ Redis) | Supported (w/ Redis) | Supported (w/ Redis) |
| 13. Monorepo Build Context / Docker | **PASS** (Root directory) | **PASS** (Root directory) | **PASS** (Root directory) | **PASS** (Docker compose) |

---

## 4. WebSocket Compatibility & Connection Limits

1. **Render:**
   - Native WebSocket support on all Web Services routing through port `10000`.
   - On the paid **Starter ($7/mo)** plan, the service does not spin down. WebSocket connections remain open indefinitely until service re-deployment or client disconnect.
   - Bandwidth: Outbound WebSocket traffic consumes plan egress ($0.15/GB beyond included allowance).
2. **Railway:**
   - WebSockets operate over standard HTTP/1.1 Upgrade headers.
   - Railway exempts WebSocket connections from regular HTTP request duration timeouts, allowing persistent idle connections.
   - Egress cost: $0.05 per GB.
3. **DigitalOcean App Platform:**
   - Edge load balancers terminate SSL and pass WebSocket upgrades to the Node container.
   - Keepalive and ping/pong intervals (repo default: Socket.IO ping interval 25s, ping timeout 20s) maintain connections through intermediary proxies.
4. **Horizontal Scaling Note (All Providers):**
   - Single-instance deployments require no external broker.
   - When scaling to multiple backend containers/instances, Socket.IO real-time event broadcasting requires attaching `@socket.io/redis-adapter` backed by a Redis instance, and configuring load balancer session affinity (sticky cookies) if polling fallback is active.

---

## 5. Storage Architecture & S3/R2 Adapter Gap List

The repository abstracts all storage operations via `IStorageService` (`backend/src/services/storage/IStorageService.ts`):
```typescript
export interface IStorageService {
  save(file: Express.Multer.File, folder: string): Promise<string>;
  delete(fileUrl: string): Promise<void>;
  savePrivate(file: Express.Multer.File, folder: string): Promise<{ storagePath: string; filename: string }>;
  deletePrivate(storagePath: string): Promise<void>;
  getPrivateFilePath(storagePath: string): string;
}
```

### Gap List for Production S3/R2 Adapter
1. **SDK Dependency:** Add `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` during the provisioning phase (not in Phase 9A to keep lockfile frozen).
2. **Adapter Implementation:** Create `S3StorageService implements IStorageService`:
   - `save`: Uploads public assets (profile pictures, event covers) to bucket with prefix `public/<folder>/<uuid>.<ext>`. Returns CDN/Public URL.
   - `savePrivate`: Uploads sensitive verification documents (transcripts, IDs, resumes) to private prefix `private/<folder>/<uuid>.<ext>`.
   - `delete` / `deletePrivate`: Issues `DeleteObjectCommand`.
3. **Private File Delivery Pattern Comparison:**
   - *Pattern A (Server-Proxied Streaming):* Backend authenticates the request, fetches the S3 object stream (`GetObjectCommand`), and pipes it directly into the HTTP response `res`.
     - *Pros:* Fully keeps existence-hiding 404 security model; no direct client interaction with object storage; zero client-side changes.
     - *Cons:* Consumes backend server memory and egress bandwidth.
   - *Pattern B (Short-Lived Presigned URLs):* Backend authenticates request and issues a 302 redirect to a short-lived (60s) HMAC-signed S3 URL.
     - *Pros:* Offloads bandwidth and file transfer from backend containers.
     - *Cons:* Client follows redirect; requires CORS configuration on the bucket.
   - *Recommendation:* **Pattern A** preserves the existing code contract and security guarantees with zero risk of credential exposure.

---

## 6. Email Delivery Strategy (SMTP vs API)

### Decision: Retain Standard SMTP Interface via Nodemailer
- **Reasoning:**
  1. The backend implementation (`backend/src/services/emailService.ts`) uses `nodemailer` with standard SMTP authentication.
  2. All three evaluated providers (Resend, Brevo, Amazon SES) provide high-performance, TLS-authenticated SMTP endpoints (`smtp.resend.com`, `smtp-relay.brevo.com`, `email-smtp.<region>.amazonaws.com`).
  3. Staying on SMTP requires **zero code changes, zero new SDK dependencies**, and prevents vendor lock-in.
  4. Port selection: In production, configure `SMTP_PORT=587` with `SMTP_SECURE=false` (STARTTLS) or `SMTP_PORT=465` with `SMTP_SECURE=true` (Direct SSL) to comply with cloud provider port 25 blocking policies.

---

## 7. Cross-Provider Compatibility Checks

1. **Backend Egress IPs vs MongoDB Atlas Network Access:**
   - *Challenge:* Managed PaaS backends (Render, Railway, DO App Platform) utilize dynamic egress IP pools.
   - *Resolution Options:*
     - *Option 1 (Static Egress IP):* Enable Static Outbound IP add-on (Railway Pro or DO App Platform $25/mo) and whitelist exact `/32` IPs in MongoDB Atlas.
     - *Option 2 (Strict Atlas Authentication with Wide Allowlist):* If using dynamic egress on starter tiers, configure `0.0.0.0/0` in Atlas Network Access while enforcing strict SCRAM-SHA-256 database authentication with a strong 64-character generated password, TLS 1.3 encryption, and least-privilege user scoping.
     - *Option 3 (Dedicated Droplet/VPS):* Single static IPv4 address whitelisted directly in Atlas.
2. **Outbound SMTP Port Policies:**
   - Render Starter ($7/mo), Railway Pro, and DigitalOcean allow outbound connections on ports `465` and `587`. Port `25` is blocked across all cloud providers to prevent spam. Our SMTP configuration must use port `587` or `465`.
3. **Region Colocation:**
   - Backend compute, MongoDB Atlas cluster, and Object Storage bucket should all reside in the same geographic region (e.g., `us-east-1` N. Virginia or `eu-west-1` Ireland) to minimize inter-service latency (< 5ms) and eliminate cross-region egress data transfer charges.
4. **Frontend & Backend Domain Alignment (Cookies & CORS):**
   - Refresh tokens are transported via HTTP-only cookie with `sameSite: 'strict'` (`backend/src/utils/cookies.ts`).
   - Browser security policies only send `sameSite: 'strict'` cookies when both frontend and API share the exact same registrable domain (e.g. `app.example.com` and `api.example.com`).
   - *Requirement:* Production MUST configure custom subdomains under a shared apex domain rather than using disparate default provider subdomains (e.g., `alumni-ui.vercel.app` vs `alumni-api.onrender.com`).
5. **Reverse Proxy & `TRUST_PROXY` Hop Count:**
   - If placing Cloudflare CDN in front of the API Gateway, incoming traffic flows: `Client -> Cloudflare CDN -> Render/DO Load Balancer -> Node.js`.
   - In this two-tier proxy topology, configure `TRUST_PROXY=2` (or Cloudflare IP range filtering) so Express correctly resolves `req.ip` for rate limiters from `X-Forwarded-For` without permitting client header spoofing.

---

## 8. Three Concrete Infrastructure Configurations

### Assumptions (Owner Decision Modeling Inputs)
- **Small Tier (Initial Pilot):** ~500 Monthly Active Users (MAU), 200 verification uploads/mo (~100 MB), 1,500 transactional emails/mo, 20 concurrent WebSocket connections.
- **Medium Tier (Active Campus):** ~5,000 MAU, 2,000 verification uploads/mo (~1 GB), 15,000 transactional emails/mo, 200 concurrent WebSocket connections.
- **Large Tier (Multi-Campus Scale):** ~50,000 MAU, 25,000 verification uploads/mo (~15 GB), 150,000 transactional emails/mo, 2,000 concurrent WebSocket connections.

---

### CONFIGURATION OPTION A — Low Complexity / Cost-Optimized Managed Stack
*Target: Rapid, zero-maintenance launch with managed services and automated edge delivery.*

- **Frontend:** Cloudflare Pages (Free tier — Unlimited bandwidth & requests, auto SSL, built-in SPA routing).
- **Backend:** Render Web Service — Starter Compute Tier ($7.00/month — 512 MB RAM, 0.5 CPU, no sleep/spindown, persistent WebSockets, outbound ports 465/587 open).
- **Database:** MongoDB Atlas Flex Tier (~$0.10/million ops + $0.25/GB-mo storage; estimated ~$5.00/month at small-medium scale).
- **Storage:** Cloudflare R2 (Free tier covers first 10 GB storage, 1M Class A ops, $0.00 egress).
- **Email:** Brevo Starter ($9.00/month for up to 5,000 emails/mo) or Resend Free (3,000 emails/mo, 100/day).
- **Domain & DNS:** Cloudflare DNS (Free) + Custom Domain Registration (~$9.95/year = ~$0.83/month).

**Cost Estimate (Small Pilot Tier):**
- Frontend: $0.00
- Backend: $7.00
- Database: ~$5.00
- Storage: $0.00
- Email: $0.00 (Resend Free) or $9.00 (Brevo Starter)
- Domain/DNS: ~$0.83
- **Total Monthly Estimate:** **~$12.83 – $21.83 / month**

**Trade-offs & Risks:**
- *Pros:* Zero server maintenance, automated SSL renewal, instant Git deploys, zero cold starts on Starter tier.
- *Cons:* Shared RAM on backend requires monitoring; Atlas Flex does not include continuous Point-in-Time Recovery (daily snapshots only).

---

### CONFIGURATION OPTION B — Balanced High-Reliability Production Stack
*Target: High-availability institutional deployment with dedicated resources, enterprise SLAs, and continuous PITR.*

- **Frontend:** Cloudflare Pages / Vercel Pro ($20/seat/mo).
- **Backend:** DigitalOcean App Platform (Basic 1 vCPU / 1 GB RAM — $10.00 - $12.00/month) or Render Standard ($25.00/month).
- **Database:** MongoDB Atlas Dedicated M10 Cluster (~$0.08/hr = ~$57.00/month — 2 GB RAM, 10 GB SSD, 1,500 connections, continuous PITR + automated backups).
- **Storage:** Cloudflare R2 ($0.015/GB-mo beyond 10 GB, zero egress) or Amazon S3 Standard ($0.023/GB-mo + requests).
- **Email:** Resend Pro ($20.00/month for 50,000 emails) or Amazon SES ($0.10/1,000 emails = ~$1.50/month).
- **Domain & DNS:** Cloudflare DNS (Free) + Registrar (~$0.83/month).

**Cost Estimate (Medium Campus Tier):**
- Frontend: $0.00 (Cloudflare Pages)
- Backend: $12.00 (DigitalOcean App Platform)
- Database: $57.00 (MongoDB Atlas M10)
- Storage: ~$0.50 (Cloudflare R2)
- Email: $20.00 (Resend Pro) or $1.50 (AWS SES)
- Domain/DNS: ~$0.83
- **Total Monthly Estimate:** **~$71.83 – $90.33 / month**

**Trade-offs & Risks:**
- *Pros:* Full institutional reliability, dedicated database memory, 30-day continuous Point-in-Time Recovery, high WebSocket connection limits.
- *Cons:* Higher fixed monthly commitment regardless of active traffic.

---

### CONFIGURATION OPTION C — Self-Managed VPS / Containerized Stack
*Target: Maximum control and predictability with unified containerized hosting on a Linux VPS.*

- **Compute Host:** DigitalOcean Droplet (2 vCPU / 2 GB RAM / 50 GB NVMe — $12.00/month) or Hetzner Cloud CX22 (2 vCPU / 4 GB RAM — ~€4.50/month ≈ $5.00/month).
- **Stack Components:**
  - Nginx Reverse Proxy (TLS termination, Brotli compression, static file caching, WebSocket proxying).
  - Backend Container: AlumniConnect Node.js API (running via Docker / PM2).
  - Frontend: Pre-compiled static assets served directly via Nginx.
- **Database:** MongoDB Atlas Flex ($5.00/mo) or Local MongoDB 7.0 Community replica set on VPS ($0.00 extra).
- **Storage:** Cloudflare R2 ($0.00 - $0.50/mo).
- **Email:** Amazon SES (~$0.10/1,000 emails) or Brevo Starter ($9.00/mo).
- **Domain & DNS:** Cloudflare DNS (Free) + Custom Domain (~$0.83/mo).

**Cost Estimate (Small-Medium Tier):**
- VPS Host: $12.00
- Database: $0.00 (Self-hosted on VPS) or $5.00 (Atlas Flex)
- Storage: $0.00 (R2 Free Tier)
- Email: ~$1.00 (AWS SES)
- Domain/DNS: ~$0.83
- **Total Monthly Estimate:** **~$13.83 – $18.83 / month**

**Trade-offs & Risks:**
- *Pros:* Single fixed invoice, full control over system limits, fixed static IP address for Atlas allowlisting, high performance.
- *Cons:* High operational overhead (manual OS security patching, manual Nginx SSL renewal, manual backup scripts).

---

## 9. Sourced Fact Citations & Research Log

All provider facts and pricing limits were retrieved and verified from official vendor documentation on **September 29, 2026**:

1. **Render Pricing & WebSockets:**  
   - Source: [https://render.com/docs/web-services](https://render.com/docs/web-services) & [https://render.com/pricing](https://render.com/pricing)  
   - Verified: Starter compute at $7/mo, WebSocket persistent support on port 10000, outbound ports 465/587 open on paid plans, port 25 blocked.
2. **Railway Pricing & SMTP Policies:**  
   - Source: [https://docs.railway.com/reference/pricing](https://docs.railway.com/reference/pricing) & [https://docs.railway.com/networking/outbound-networking](https://docs.railway.com/networking/outbound-networking)  
   - Verified: Hobby $5/mo, Pro $20/mo, SMTP traffic permitted on Pro tier (ports 465/587/2525), WebSocket connections exempt from request duration timeouts.
3. **Cloudflare Pages & R2 Pricing:**  
   - Source: [https://developers.cloudflare.com/pages/](https://developers.cloudflare.com/pages/) & [https://developers.cloudflare.com/r2/pricing/](https://developers.cloudflare.com/r2/pricing/)  
   - Verified: Pages static bandwidth is unlimited and free; auto SPA fallback; R2 standard storage is $0.015/GB-mo with first 10 GB/mo free, $0.00 egress fees.
4. **Vercel Monorepo & SPA Documentation:**  
   - Source: [https://vercel.com/docs/monorepos](https://vercel.com/docs/monorepos) & [https://vercel.com/docs/edge-network/rewrites](https://vercel.com/docs/edge-network/rewrites)  
   - Verified: Root directory configuration for subfolders, requires `vercel.json` rewrite `{ "source": "/(.*)", "destination": "/index.html" }` for SPA client routing.
5. **Netlify Redirects & Pricing:**  
   - Source: [https://docs.netlify.com/routing/redirects/](https://docs.netlify.com/routing/redirects/) & [https://www.netlify.com/pricing/](https://www.netlify.com/pricing/)  
   - Verified: Requires `_redirects` file with `/* /index.html 200` for SPA routing, 300 pooled monthly credits on free tier.
6. **MongoDB Atlas Pricing & Tiers:**  
   - Source: [https://www.mongodb.com/pricing](https://www.mongodb.com/pricing)  
   - Verified: M0 Free tier (512MB, auto-pauses after 60 days inactivity, 500 max conns), Flex Tier (pay per operation), M10 Dedicated (~$0.08/hr, continuous PITR, 1,500 connections, VPC peering).
7. **Amazon S3 Pricing:**  
   - Source: [https://aws.amazon.com/s3/pricing/](https://aws.amazon.com/s3/pricing/)  
   - Verified: Standard storage $0.023/GB-mo (us-east-1), PUT $0.005/1k, GET $0.0004/1k, first 100 GB/mo egress to internet free.
8. **Resend Pricing & Rate Limits:**  
   - Source: [https://resend.com/pricing](https://resend.com/pricing) & [https://resend.com/docs/dashboard/emails/send-email-smtp](https://resend.com/docs/dashboard/emails/send-email-smtp)  
   - Verified: Free tier 3,000 emails/mo (100/day limit), Pro tier $20/mo (50,000 emails, no daily cap), SMTP relay host `smtp.resend.com` on ports 465/587.
9. **Brevo Pricing & SMTP:**  
   - Source: [https://www.brevo.com/pricing/](https://www.brevo.com/pricing/)  
   - Verified: Free plan 300 emails/day with SMTP relay access, Starter plan $9/mo for 5,000 emails/mo with no daily cap.
10. **Amazon SES Pricing & Sandbox:**  
    - Source: [https://aws.amazon.com/ses/pricing/](https://aws.amazon.com/ses/pricing/)  
    - Verified: $0.10 per 1,000 emails; sandbox mode limits sending to 200 emails/24hr until production request approved.
11. **DigitalOcean App Platform & Droplet Pricing:**  
    - Source: [https://www.digitalocean.com/pricing/app-platform](https://www.digitalocean.com/pricing/app-platform) & [https://www.digitalocean.com/pricing/droplets](https://www.digitalocean.com/pricing/droplets)  
    - Verified: Basic container starting at $5.00/mo (512MB RAM) and $10.00/mo (1GB RAM); Droplets start at $4.00 - $6.00/mo; dedicated egress IP add-on is $25.00/mo on App Platform.

---

## 10. Open Decisions for Project Owner

The following architectural and operational decisions remain for the project owner to resolve before provisioning cloud infrastructure:

1. **Architecture Option Selection:** Choose between **Option A** (Fully Managed PaaS, ~$13-22/mo), **Option B** (Balanced High-Reliability Dedicated, ~$72-90/mo), or **Option C** (Self-Managed VPS, ~$14-19/mo).
2. **Canonical Production Domain:** Select and register the production apex domain (e.g. `alumniconnect.edu` or `alumniconnect.org`).
3. **Geographic Cloud Region:** Select primary cloud region (e.g. `us-east-1` US East, `eu-west-1` Europe West, or `ap-south-1` Mumbai) for colocation of compute, database, and storage.
4. **Email Provider Selection:** Select transactional email vendor (Resend for clean developer DX, Brevo for predictable starter tiers, or AWS SES for high-volume rock-bottom unit pricing).
5. **Private Storage Backend:** Select Cloudflare R2 (zero egress fees, S3 compatible) or AWS S3 Standard.
6. **Data Protection & SLA Targets:** Confirm Recovery Point Objective (RPO <= 1 hr) and Recovery Time Objective (RTO <= 4 hrs) for institutional compliance.
