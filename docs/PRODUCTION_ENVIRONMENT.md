# AlumniConnect — Production Environment Reference & Configuration Contract

> **CRITICAL DECLARATION:**  
> **NO REAL SECRETS, CREDENTIALS, OR LIVE INFRASTRUCTURE ARE STORED IN THIS REPOSITORY.**  
> **THIS DOCUMENT IS THE AUTHORITATIVE SINGLE SOURCE OF TRUTH FOR ALL ENVIRONMENT VARIABLES.**  
> **FRONTEND IS FROZEN AND READ-ONLY.** All frontend variables are documented here and injected at build time.

---

## 1. Classification & Security Rules

All configuration parameters in AlumniConnect belong to exactly one of three security classifications:

1. **SECRET (Sensitive):**
   - *Definition:* Cryptographic keys, database passwords, SMTP credentials, and administrative passwords.
   - *Rules:* **NEVER** commit to Git, **NEVER** store in frontend code or `VITE_*` variables, **NEVER** build into container layers, **NEVER** print in logs. In production, inject directly via the hosting platform's encrypted environment dashboard or secret manager (e.g., AWS Secrets Manager, Doppler, Render/Railway Environment Secrets).
2. **DEPLOY-TIME CONFIGURATION (Infrastructure & Routing):**
   - *Definition:* Hostnames, ports, CORS origins, proxy hop counts, and storage driver switches.
   - *Rules:* Configured per deployment stage (staging vs production). Injected via host environment.
3. **PUBLIC (Client-Side Build Artifacts):**
   - *Definition:* URLs embedded directly into compiled JavaScript client bundles at build time.
   - *Rules:* Embedded by Vite during `npm run build`. Visible to all end users via browser inspection.

---

## 2. Backend Environment Variables Contract

| Variable Name | Classification | Required in Prod? | Default Value | Format & Exact Rules | Purpose & Implementation Reference |
| :--- | :---: | :---: | :--- | :--- | :--- |
| `NODE_ENV` | DEPLOY-TIME | **Yes** | `development` | String: `production`, `development`, or `test`. | Sets production optimizations, enables strict secure cookies, and disables verbose debug logging (`backend/src/config/env.ts:55`). |
| `PORT` | DEPLOY-TIME | No | `5000` | Integer: `1024` - `65535`. | HTTP port Express server listens on (`backend/src/server.ts:16`). Most PaaS providers (Render, Railway, DO) automatically provide `PORT`. |
| `MONGODB_URI` | **SECRET** | **Yes** | *None* | Valid URI starting with `mongodb://` or `mongodb+srv://`. Must include DB name. | MongoDB connection string containing authentication credentials (`backend/src/config/env.ts:32-37`). Example: `mongodb+srv://<user>:<password>@cluster.example.net/alumniconnect?retryWrites=true&w=majority` |
| `JWT_ACCESS_SECRET` | **SECRET** | **Yes** | *None* | High-entropy string, **minimum 16 characters** (enforced by startup validation). Recommend 64+ char hex/base64. | Signs short-lived 15m JWT access tokens (`backend/src/config/env.ts:18-23`). |
| `JWT_REFRESH_SECRET` | **SECRET** | **Yes** | *None* | High-entropy string, **minimum 16 characters** (enforced by startup validation). Must be DISTINCT from access secret. | Signs long-lived 7d JWT refresh tokens (`backend/src/config/env.ts:25-30`). |
| `JWT_ACCESS_EXPIRES_IN` | DEPLOY-TIME | No | `15m` | Zeit format: `15m`, `1h`, `30m`. | Lifespan for stateless access tokens (`backend/src/config/env.ts:59`). |
| `JWT_REFRESH_EXPIRES_IN` | DEPLOY-TIME | No | `7d` | Zeit format: `7d`, `14d`, `30d`. | Lifespan for stateful refresh tokens (`backend/src/config/env.ts:60`). |
| `APP_BASE_URL` | DEPLOY-TIME | **Yes** | `http://localhost:5173` | Full HTTPS URL with scheme, host, and port if non-standard. **No trailing slash**. | Used as base URL when generating transactional email links for verification and password reset (`backend/src/config/env.ts:61`). Example: `https://app.example.com` |
| `CLIENT_URL` | DEPLOY-TIME | **Yes** | `http://localhost:5173` | Full HTTPS URL with scheme, host, and port if non-standard. **No trailing slash**. | Exact CORS origin allowlist for HTTP API and Socket.IO handshake (`backend/src/config/env.ts:62`). Example: `https://app.example.com` |
| `COLLEGE_EMAIL_DOMAINS` | DEPLOY-TIME | No | `college.edu,university.edu` | Comma-separated domain names, lowercase, no `@` or spaces. | Fallback list of accepted institutional email domains for student auto-verification (`backend/src/config/env.ts:63-65`). |
| `STUDENT_REQUIRES_ADMIN_APPROVAL` | DEPLOY-TIME | No | `false` | Boolean string: `true` or `false`. | When `true`, student accounts require manual admin review even if domain verified (`backend/src/config/env.ts:66`). |
| `SMTP_HOST` | DEPLOY-TIME | **Yes** (Prod) | `""` | Valid hostname or IP. | Outgoing transactional SMTP mail server (`backend/src/config/env.ts:67`). Example: `smtp.resend.com` |
| `SMTP_PORT` | DEPLOY-TIME | **Yes** (Prod) | `587` | Integer: `587` (STARTTLS), `465` (SSL), `25`. | SMTP server port (`backend/src/config/env.ts:68`). In production, use `587` or `465`. |
| `SMTP_SECURE` | DEPLOY-TIME | No | `false` | Boolean string: `true` for port 465 (direct SSL), `false` for port 587 (STARTTLS). | TLS mode for Nodemailer transport (`backend/src/config/env.ts:69`). |
| `SMTP_USER` | **SECRET** | **Yes** (Prod) | `""` | Alphanumeric string / email. | SMTP authentication username / API key identity (`backend/src/config/env.ts:70`). |
| `SMTP_PASSWORD` | **SECRET** | **Yes** (Prod) | `""` | Alphanumeric secret / API token. | SMTP authentication password / API token (`backend/src/config/env.ts:71`). |
| `EMAIL_FROM` | DEPLOY-TIME | No | `noreply@alumniconnect.local` | RFC 5322 format: `"Sender Name" <sender@domain.example>`. | The `From:` header for all outgoing transactional emails (`backend/src/config/env.ts:75`). Example: `"AlumniConnect" <noreply@example.com>` |
| `FILE_STORAGE_DRIVER` | DEPLOY-TIME | No | `local` | String: `local` or `s3`. | Storage backend selector (`backend/src/config/env.ts:76`). |
| `TRUST_PROXY` | DEPLOY-TIME | No | `false` | `1`, `2`, `true`, `false`, or CIDR subnet. | Express proxy hop count for accurate client IP resolution (`backend/src/config/env.ts:79`, `backend/src/app.ts:27-36`). Must strictly match the ACTUAL number of reverse proxy hops in front of the Node process in the chosen deployment topology (e.g. `1` for single load balancer, `2` for CDN + load balancer). Misconfiguration risks rate-limiting bypass or IP spoofing. |
| `ADMIN_EMAIL` | DEPLOY-TIME | No (Seed only) | `""` | Valid email address. | Target email for initial administrative bootstrap script (`backend/src/seedAdmin.ts:30`). |
| `ADMIN_PASSWORD` | **SECRET** | No (Seed only) | `""` | Strong password (min 12 chars). | Initial password for bootstrap admin user. Must be removed from environment after initial seed (`backend/src/seedAdmin.ts:31`). |
| `ALLOW_PROD_SEED` | DEPLOY-TIME | No (Seed only) | `false` | Boolean string: `true` or `false`. | Safety interlock required to run `npm run seed:admin` when `NODE_ENV=production` (`backend/src/seedAdmin.ts:25`). |
| `REQUIRE_PROD_EMAIL` / `SMTP_REQUIRED` | DEPLOY-TIME | No | `false` | Boolean string: `true` or `false`. | When set to `true` in production, forces application startup validation to fail fast if SMTP credentials are missing (`backend/src/config/env.ts:39-45`). |
| `OTP_HASH_SECRET` | **SECRET** | No (Defaults to JWT secret) | `""` | High-entropy string (min 32 chars recommended). | Secret key used for HMAC-SHA256 hashing of 6-digit registration OTPs (`backend/src/config/env.ts:81`). |
| `AUTH_RATE_LIMIT_DISABLED` | DEPLOY-TIME | No | `false` | Boolean string: `true` or `false`. | **Test environment override only.** Must NEVER be set in production (`backend/src/config/env.ts:82`). |

---

## 3. Frontend Environment Variables Contract (Client-Side)

> **CRITICAL RULE:** All `VITE_*` variables are embedded directly into compiled JavaScript bundles during `npm run build`.  
> **NEVER** put private API keys, database credentials, or server secrets in frontend variables.  
> Frontend source code is **FROZEN** and reads exactly these variable names.

| Variable Name | Classification | Required in Prod? | Default Value | Format & Exact Rules | Purpose & Code Location |
| :--- | :---: | :---: | :--- | :--- | :--- |
| `VITE_API_URL` | **PUBLIC** | **Yes** | `http://localhost:5000/api/v1` | Full HTTPS URL pointing to the REST API v1 endpoint. **No trailing slash**. | Used as `baseURL` for all client-side Axios API requests (`frontend/src/services/api.ts:3`). Example: `https://api.example.com/api/v1` |
| `VITE_SOCKET_URL` | **PUBLIC** | **Yes** | `http://localhost:5000` | Full HTTPS URL pointing to the backend host (Socket.IO client handles `wss://` upgrade internally). **No trailing slash**, **no path suffix**. | Used as connection endpoint for Socket.IO real-time notifications and messaging (`frontend/src/services/messaging.ts:134`, `frontend/src/components/layout/NotificationsPopover.tsx:147`). Example: `https://api.example.com` |

---

## 4. Cryptographic Secret Generation Runbook

Generate all production cryptographic secrets using cryptographically secure pseudorandom number generators (CSPRNG). Never generate secrets using online generators or plain human typing.

### Option 1: Node.js (Cross-Platform)
Run these commands in a secure administrative terminal (do NOT save the command line history with the outputs):
```bash
# Generate 256-bit (64-character hex) secret for JWT_ACCESS_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate DISTINCT 256-bit (64-character hex) secret for JWT_REFRESH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate 32-character high-entropy ADMIN_PASSWORD
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

### Option 2: Windows PowerShell
```powershell
# Generate 256-bit base64 secret for JWT_ACCESS_SECRET
$bytes = New-Object byte[] 32; (New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes($bytes); [Convert]::ToBase64String($bytes)

# Generate DISTINCT 256-bit base64 secret for JWT_REFRESH_SECRET
$bytes = New-Object byte[] 32; (New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes($bytes); [Convert]::ToBase64String($bytes)

# Generate 32-character high-entropy ADMIN_PASSWORD
$bytes = New-Object byte[] 24; (New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes($bytes); [Convert]::ToBase64String($bytes)
```

---

## 5. Administrative Bootstrap Guide

The repository provides an automated, idempotent administrator initialization script (`backend/src/seedAdmin.ts`):

### Behavior & Safeguards
1. **Idempotency:** When executed, the script inspects the MongoDB `User` collection for any user with `role: 'admin'`. If an admin account exists, it logs `Admin already exists` and exits cleanly with exit code 0 without modifying existing records or passwords.
2. **Production Interlock:** In production (`NODE_ENV=production`), the script will **refuse to execute** unless `ALLOW_PROD_SEED=true` is explicitly provided.
3. **Password Security:** Hashes the password using `bcryptjs` with salt round cost factor 12 before persisting to MongoDB.

### Production Bootstrap Execution Procedure
1. Temporarily configure the deployment environment with:
   - `ADMIN_EMAIL=admin@institution.example`
   - `ADMIN_PASSWORD=<generated-secure-password>`
   - `ALLOW_PROD_SEED=true`
2. Trigger the one-time seed task:
   ```bash
   npm run seed:admin --prefix backend
   ```
3. Verify successful creation output: `✅ Admin user created`.
4. **Post-Bootstrap Cleanup:** Remove `ADMIN_PASSWORD` and `ALLOW_PROD_SEED` from the hosting platform's environment variables. The administrative account is now permanently stored in MongoDB.

---

## 6. Database Index Strategy & Verification

### Development vs Production Behavior
- **Development / Test:** Mongoose automatically creates indexes on database connection (`autoIndex: true` default).
- **Production Concern:** In high-traffic production environments, automatic startup index builds can create blocking read/write locks or startup delays.

### Safe Production Index Synchronization Procedure
1. Before routing user traffic to newly provisioned MongoDB clusters, verify or synchronize all schema indexes.
2. The core indexes enforced by AlumniConnect models include:
   - `User`: `{ email: 1 }` (unique), `{ role: 1 }`, `{ accountStatus: 1 }`, `{ verificationStatus: 1 }`, text index `{ name: "text", designation: "text", company: "text", department: "text", skills: "text" }`.
   - `VerificationRequest`: `{ user: 1 }` (unique, `partialFilterExpression: { status: "pending" }`), `{ status: 1, college: 1, createdAt: -1 }`.
   - `College`: `{ name: 1 }` (unique), `{ code: 1 }` (unique).
   - `ConnectionRequest`: `{ requester: 1, recipient: 1 }` (unique), `{ recipient: 1, status: 1 }`.
   - `Message`: `{ conversationId: 1, createdAt: -1 }`.
   - `AdminAuditLog`: `{ createdAt: -1 }`, `{ adminId: 1 }`.
3. To inspect and verify active indexes in MongoDB Atlas or Mongo shell:
   ```javascript
   db.users.getIndexes();
   db.verificationrequests.getIndexes();
   db.colleges.getIndexes();
   ```
