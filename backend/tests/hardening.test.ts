import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app';
import User from '../src/models/User';
import AdminAuditLog from '../src/models/AdminAuditLog';
import { hashPassword, generateSecureToken, hashToken, VERIFICATION_TOKEN_TTL, RESET_TOKEN_TTL } from '../src/utils/auth';
import { env } from '../src/config/env';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await AdminAuditLog.deleteMany({});
});

describe('Phase 2 Hardening & Security Checks', () => {
  async function createAdmin() {
    const passwordHash = await hashPassword('AdminPass123');
    return User.create({
      name: 'System Admin',
      email: 'admin@college.edu',
      passwordHash,
      role: 'admin',
      accountStatus: 'active',
      verificationStatus: 'admin_approved',
      department: 'Administration',
      batch: '2020',
    });
  }

  // 1. Refresh rotation: using a refresh cookie twice — the first use issues a new one and invalidates the old; reusing the old one fails.
  it('Hardening: Refresh rotation prevents reuse of old token', async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Rotation Tester',
      email: 'rotate@college.edu',
      password: 'SecurePassword123',
      confirmPassword: 'SecurePassword123',
      role: 'student',
      department: 'CS',
      batch: '2025',
    });

    const cookie1 = regRes.headers['set-cookie'];
    expect(cookie1).toBeDefined();

    // First refresh: succeeds and returns new cookie
    const res1 = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie1);
    expect(res1.status).toBe(200);
    expect(res1.body.success).toBe(true);
    const cookie2 = res1.headers['set-cookie'];
    expect(cookie2).toBeDefined();

    // Reusing old cookie1: must fail with 401
    const resReuse = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie1);
    expect(resReuse.status).toBe(401);
    expect(resReuse.body.success).toBe(false);
    expect(resReuse.body.error.code).toBe('NOT_AUTHENTICATED');

    // Using new cookie2: succeeds
    const res2 = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie2);
    expect(res2.status).toBe(200);
    expect(res2.body.success).toBe(true);
  });

  // 2. Suspension revokes sessions immediately: suspend a user who has an active refresh token, then confirm their next /auth/refresh call fails.
  it('Hardening: Suspension immediately revokes active refresh token sessions', async () => {
    const admin = await createAdmin();
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@college.edu',
      password: 'AdminPass123',
    });
    const adminToken = adminLogin.body.data.accessToken;

    const userRes = await request(app).post('/api/v1/auth/register').send({
      name: 'To Be Suspended',
      email: 'suspendme@college.edu',
      password: 'SecurePassword123',
      confirmPassword: 'SecurePassword123',
      role: 'student',
      department: 'CS',
      batch: '2025',
    });
    const userCookie = userRes.headers['set-cookie'];
    const userId = userRes.body.data.user.id;

    // Admin suspends user
    const suspRes = await request(app)
      .patch(`/api/v1/admin/users/${userId}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Security violation test' });
    expect(suspRes.status).toBe(200);

    // Refresh attempt with existing cookie must fail
    const refreshRes = await request(app).post('/api/v1/auth/refresh').set('Cookie', userCookie);
    expect(refreshRes.status).toBe(401);
    expect(refreshRes.body.success).toBe(false);
  });

  // 3. Password reset invalidates existing sessions: old refresh token stops working.
  it('Hardening: Password reset invalidates existing refresh token sessions', async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Reset Tester',
      email: 'resettest@college.edu',
      password: 'OldPassword123',
      confirmPassword: 'OldPassword123',
      role: 'student',
      department: 'CS',
      batch: '2025',
    });
    const oldCookie = regRes.headers['set-cookie'];

    // Generate a reset token directly in DB for testing
    const { raw, hash, expires } = generateSecureToken(RESET_TOKEN_TTL);
    await User.findOneAndUpdate(
      { email: 'resettest@college.edu' },
      { resetTokenHash: hash, resetTokenExpires: expires }
    );

    // Reset password
    const resetRes = await request(app).post('/api/v1/auth/reset-password').send({
      token: raw,
      password: 'NewStrongPassword123',
      confirmPassword: 'NewStrongPassword123',
    });
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);

    // Old refresh cookie must now fail
    const refreshRes = await request(app).post('/api/v1/auth/refresh').set('Cookie', oldCookie);
    expect(refreshRes.status).toBe(401);
  });

  // 4. No raw tokens at rest: inspect database directly — verification, reset, and refresh tokens stored as hashes only.
  it('Hardening: Tokens and passwords stored as hashes only (never raw) in DB', async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Hash Checker',
      email: 'hashcheck@college.edu',
      password: 'MyPassword123',
      confirmPassword: 'MyPassword123',
      role: 'student',
      department: 'CS',
      batch: '2025',
    });

    const userInDb = await User.findOne({ email: 'hashcheck@college.edu' }).select(
      '+passwordHash +verificationTokenHash +refreshTokenHash +resetTokenHash'
    );

    expect(userInDb).not.toBeNull();
    // Password hash is bcrypt ($2a$ or $2b$)
    expect(userInDb?.passwordHash).toMatch(/^\$2[ab]\$\d+\$/);
    expect(userInDb?.passwordHash).not.toBe('MyPassword123');

    // Verification token is sha256 hex string (64 characters)
    expect(userInDb?.verificationTokenHash).toMatch(/^[a-f0-9]{64}$/);

    // Refresh token is sha256 hex string (64 characters)
    expect(userInDb?.refreshTokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  // 5. Enumeration resistance: wrong password vs nonexistent email returns identical response.
  it('Hardening: Login and forgot-password enumeration resistance', async () => {
    const passwordHash = await hashPassword('CorrectPassword123');
    await User.create({
      name: 'Enum User',
      email: 'enum@college.edu',
      passwordHash,
      role: 'student',
      department: 'CS',
      batch: '2025',
      accountStatus: 'active',
    });

    // Login: Wrong password
    const wrongPassRes = await request(app).post('/api/v1/auth/login').send({
      email: 'enum@college.edu',
      password: 'WrongPassword999',
    });

    // Login: Nonexistent email
    const nonExistRes = await request(app).post('/api/v1/auth/login').send({
      email: 'doesnotexist@college.edu',
      password: 'AnyPassword999',
    });

    expect(wrongPassRes.status).toBe(401);
    expect(nonExistRes.status).toBe(401);
    expect(wrongPassRes.body).toEqual(nonExistRes.body);
    expect(wrongPassRes.body).toEqual({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      },
    });

    // Forgot password: Existing email vs Nonexistent email
    const forgotExist = await request(app).post('/api/v1/auth/forgot-password').send({
      email: 'enum@college.edu',
    });
    const forgotNonExist = await request(app).post('/api/v1/auth/forgot-password').send({
      email: 'unknown_enum@college.edu',
    });

    expect(forgotExist.status).toBe(200);
    expect(forgotNonExist.status).toBe(200);
    expect(forgotExist.body).toEqual(forgotNonExist.body);
    expect(forgotExist.body).toEqual({
      success: true,
      data: {
        message: 'If an account exists for this email, a reset link has been sent.',
      },
    });
  });

  // 6. Response envelope consistency: all responses follow {success: true, data} or {success: false, error: {code, message}}
  it('Hardening: Envelope structure consistency across routes', async () => {
    // 404 Route
    const notFoundRes = await request(app).get('/api/v1/nonexistent-path');
    expect(notFoundRes.status).toBe(404);
    expect(notFoundRes.body).toHaveProperty('success', false);
    expect(notFoundRes.body).toHaveProperty('error.code', 'NOT_FOUND');
    expect(notFoundRes.body).toHaveProperty('error.message');

    // Health Check
    const healthRes = await request(app).get('/api/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body).toHaveProperty('success', true);
    expect(healthRes.body).toHaveProperty('data.status', 'ok');

    // Validation error
    const validationRes = await request(app).post('/api/v1/auth/register').send({});
    expect(validationRes.status).toBe(422);
    expect(validationRes.body).toHaveProperty('success', false);
    expect(validationRes.body).toHaveProperty('error.code', 'VALIDATION_ERROR');
    expect(validationRes.body).toHaveProperty('error.fields');
  });

  // 7. CORS Enforcement: Disallowed origin does not receive Access-Control-Allow-Origin
  it('Hardening: CORS rejects / does not allow origins other than CLIENT_URL', async () => {
    const allowedOrigin = env.CLIENT_URL;
    const maliciousOrigin = 'http://malicious-website.com';

    // Request with valid origin
    const validCorsRes = await request(app)
      .get('/api/health')
      .set('Origin', allowedOrigin);
    expect(validCorsRes.status).toBe(200);
    expect(validCorsRes.headers['access-control-allow-origin']).toBe(allowedOrigin);

    // Request with invalid origin
    const invalidCorsRes = await request(app)
      .get('/api/health')
      .set('Origin', maliciousOrigin);
    expect(invalidCorsRes.status).toBe(403);
    expect(invalidCorsRes.body.error.code).toBe('CORS_NOT_ALLOWED');
    expect(invalidCorsRes.headers['access-control-allow-origin']).toBeUndefined();
  });

  // 8. Audit log completeness: approve, reject, suspend, reactivate each write exactly one AdminAuditLog row
  it('Hardening: Admin actions (approve, reject, suspend, reactivate) produce exact audit logs', async () => {
    const admin = await createAdmin();
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@college.edu',
      password: 'AdminPass123',
    });
    const adminToken = adminLogin.body.data.accessToken;

    const passwordHash = await hashPassword('UserPassword123');
    const targetUser = await User.create({
      name: 'Audit Target',
      email: 'audittarget@college.edu',
      passwordHash,
      role: 'alumni',
      department: 'CS',
      batch: '2021',
      accountStatus: 'active',
      verificationStatus: 'pending',
    });

    // 1. Approve
    await request(app)
      .patch(`/api/v1/admin/users/${targetUser._id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    let logs = await AdminAuditLog.find({ targetId: targetUser._id });
    expect(logs.length).toBe(1);
    expect(logs[0].action).toBe('user.approve');
    expect(logs[0].admin.toString()).toBe(admin._id.toString());

    // 2. Reject
    await request(app)
      .patch(`/api/v1/admin/users/${targetUser._id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Unverified background records' });
    logs = await AdminAuditLog.find({ targetId: targetUser._id });
    expect(logs.length).toBe(2);
    expect(logs[1].action).toBe('user.reject');
    expect(logs[1].metadata).toEqual({ reason: 'Unverified background records' });

    // 3. Suspend
    await request(app)
      .patch(`/api/v1/admin/users/${targetUser._id}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Audit log suspend test' });
    logs = await AdminAuditLog.find({ targetId: targetUser._id });
    expect(logs.length).toBe(3);
    expect(logs[2].action).toBe('user.suspend');

    // 4. Reactivate
    await request(app)
      .patch(`/api/v1/admin/users/${targetUser._id}/reactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    logs = await AdminAuditLog.find({ targetId: targetUser._id });
    expect(logs.length).toBe(4);
    expect(logs[3].action).toBe('user.reactivate');
  });

  // 9. Canonical token issuance check: pending & rejected users get tokens at login, gated on features
  it('Hardening: Pending and rejected users receive tokens upon login when account is active', async () => {
    const passwordHash = await hashPassword('Password12345');
    const pendingUser = await User.create({
      name: 'Pending Alumni',
      email: 'pendingalum@personal.com',
      passwordHash,
      role: 'alumni',
      department: 'EE',
      batch: '2020',
      accountStatus: 'active',
      verificationStatus: 'pending',
    });

    const rejectedUser = await User.create({
      name: 'Rejected Alumni',
      email: 'rejectedalum@personal.com',
      passwordHash,
      role: 'alumni',
      department: 'EE',
      batch: '2020',
      accountStatus: 'active',
      verificationStatus: 'rejected',
    });

    // Pending login
    const pendingLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'pendingalum@personal.com',
      password: 'Password12345',
    });
    expect(pendingLogin.status).toBe(200);
    expect(pendingLogin.body.success).toBe(true);
    expect(pendingLogin.body.data.accessToken).toBeDefined();
    expect(pendingLogin.body.data.user.verificationStatus).toBe('pending');

    // Rejected login
    const rejectedLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'rejectedalum@personal.com',
      password: 'Password12345',
    });
    expect(rejectedLogin.status).toBe(200);
    expect(rejectedLogin.body.success).toBe(true);
    expect(rejectedLogin.body.data.accessToken).toBeDefined();
    expect(rejectedLogin.body.data.user.verificationStatus).toBe('rejected');
  });

  // 10. Rate limiting behavior test
  it('Hardening: Rate limiter triggers 429 and standard error envelope when exceeded', async () => {
    const express = (await import('express')).default;
    const rateLimit = (await import('express-rate-limit')).default;
    const testApp = express();
    testApp.use(express.json());

    const limiter = rateLimit({
      max: 2,
      windowMs: 1000,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, res) => {
        res.status(429).json({
          success: false,
          error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
        });
      },
    });

    testApp.post('/test-limit', limiter, (_req, res) => {
      res.json({ success: true, data: { ok: true } });
    });

    // 1st request -> ok
    const res1 = await request(testApp).post('/test-limit').send({});
    expect(res1.status).toBe(200);

    // 2nd request -> ok
    const res2 = await request(testApp).post('/test-limit').send({});
    expect(res2.status).toBe(200);

    // 3rd request -> 429 rate limited
    const res3 = await request(testApp).post('/test-limit').send({});
    expect(res3.status).toBe(429);
    expect(res3.body).toEqual({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
    });
  });
});
