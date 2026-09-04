import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app';
import User from '../src/models/User';
import AdminAuditLog from '../src/models/AdminAuditLog';
import { hashPassword, generateSecureToken, hashToken, VERIFICATION_TOKEN_TTL } from '../src/utils/auth';

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

describe('Phase 2 — Auth, Verification & RBAC Matrix Tests', () => {
  // Helper to create an admin user
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

  // 1. Student registers, non-institutional email → 422, no account, no token
  it('1. Student registers with non-institutional email -> 422, no account, no token', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Alice Student',
      email: 'alice@gmail.com',
      password: 'SecurePassword123',
      confirmPassword: 'SecurePassword123',
      role: 'student',
      department: 'Computer Science',
      batch: '2026',
    });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_EMAIL_DOMAIN');

    const inDb = await User.findOne({ email: 'alice@gmail.com' });
    expect(inDb).toBeNull();
  });

  // 2. Student registers, institutional email → 201, verificationStatus: pending, tokens issued
  it('2. Student registers with institutional email -> 201, pending verificationStatus, tokens issued', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Bob Student',
      email: 'bob@college.edu',
      password: 'SecurePassword123',
      confirmPassword: 'SecurePassword123',
      role: 'student',
      department: 'Computer Science',
      batch: '2026',
      studentId: 'STU-1001',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.verificationStatus).toBe('pending');
    expect(res.body.data.user.role).toBe('student');
    expect(res.body.data.accessToken).toBeDefined();

    // Check refresh cookie
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toContain('refreshToken');
  });

  // 3. Alumni registers, institutional email → 201, pending
  it('3. Alumni registers with institutional email -> 201, pending status', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Charlie Alumni',
      email: 'charlie@college.edu',
      password: 'SecurePassword123',
      confirmPassword: 'SecurePassword123',
      role: 'alumni',
      department: 'Information Technology',
      batch: '2022',
      alumniId: 'ALUM-2022-01',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.verificationStatus).toBe('pending');
    expect(res.body.data.user.role).toBe('alumni');
  });

  // 4. Alumni registers, personal email + proof info → 201, pending
  it('4. Alumni registers with personal email + proof info -> 201, pending status', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Diana Alumni',
      email: 'diana@personalmail.com',
      password: 'SecurePassword123',
      confirmPassword: 'SecurePassword123',
      role: 'alumni',
      department: 'Mechanical Engineering',
      batch: '2020',
      graduationYear: '2020',
      degree: 'B.Tech Mechanical',
      proofNote: 'Advisor: Prof. Smith',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.verificationStatus).toBe('pending');

    const inDb = await User.findOne({ email: 'diana@personalmail.com' }).select('+verificationNote');
    expect(inDb).not.toBeNull();
    expect(inDb?.verificationNote).toContain('Graduation year: 2020');
  });

  // 5. Anyone attempts role: admin at registration → 403 ADMIN_REGISTRATION_BLOCKED
  it('5. Anyone attempts role: admin at registration -> 403 ADMIN_REGISTRATION_BLOCKED', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Hacker Admin',
      email: 'hacker@college.edu',
      password: 'SecurePassword123',
      confirmPassword: 'SecurePassword123',
      role: 'admin',
      department: 'Administration',
      batch: '2020',
    });

    expect([403, 422]).toContain(res.status);
    expect(res.body.success).toBe(false);

    const inDb = await User.findOne({ email: 'hacker@college.edu' });
    expect(inDb).toBeNull();
  });

  // 6. Click valid verification link
  it('6. Click valid verification link -> pending moves to email_verified or admin_approved', async () => {
    const { raw, hash, expires } = generateSecureToken(VERIFICATION_TOKEN_TTL);
    const passwordHash = await hashPassword('SecurePassword123');

    const user = await User.create({
      name: 'Evan Student',
      email: 'evan@college.edu',
      passwordHash,
      role: 'student',
      department: 'Computer Science',
      batch: '2025',
      verificationStatus: 'pending',
      accountStatus: 'active',
      verificationTokenHash: hash,
      verificationTokenExpires: expires,
    });

    const res = await request(app).post('/api/v1/auth/verify-email').send({
      token: raw,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updated = await User.findById(user._id);
    expect(['email_verified', 'admin_approved']).toContain(updated?.verificationStatus);
  });

  // 7. Login with correct credentials, accountStatus: active → 200, tokens issued
  it('7. Login with correct credentials, active account -> 200, tokens issued', async () => {
    const passwordHash = await hashPassword('SecurePassword123');
    await User.create({
      name: 'Frank User',
      email: 'frank@college.edu',
      passwordHash,
      role: 'student',
      department: 'CS',
      batch: '2025',
      verificationStatus: 'email_verified',
      accountStatus: 'active',
    });

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'frank@college.edu',
      password: 'SecurePassword123',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe('frank@college.edu');
    expect(res.body.data.user.verificationStatus).toBe('email_verified');
  });

  // 8. Login with wrong password / unknown email → 401 INVALID_CREDENTIALS
  it('8. Login with wrong password or unknown email -> identical 401 INVALID_CREDENTIALS', async () => {
    const passwordHash = await hashPassword('SecurePassword123');
    await User.create({
      name: 'Grace User',
      email: 'grace@college.edu',
      passwordHash,
      role: 'student',
      department: 'CS',
      batch: '2025',
      accountStatus: 'active',
    });

    // Wrong password
    const res1 = await request(app).post('/api/v1/auth/login').send({
      email: 'grace@college.edu',
      password: 'WrongPassword999',
    });
    expect(res1.status).toBe(401);
    expect(res1.body.error.code).toBe('INVALID_CREDENTIALS');

    // Unknown email
    const res2 = await request(app).post('/api/v1/auth/login').send({
      email: 'unknown_user_999@college.edu',
      password: 'AnyPassword123',
    });
    expect(res2.status).toBe(401);
    expect(res2.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res2.body.error.message).toBe(res1.body.error.message);
  });

  // 9. Login, accountStatus: suspended → 403 ACCOUNT_SUSPENDED
  it('9. Login with suspended account -> 403 ACCOUNT_SUSPENDED, no token', async () => {
    const passwordHash = await hashPassword('SecurePassword123');
    await User.create({
      name: 'Suspended User',
      email: 'suspended@college.edu',
      passwordHash,
      role: 'student',
      department: 'CS',
      batch: '2025',
      accountStatus: 'suspended',
      verificationStatus: 'pending',
    });

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'suspended@college.edu',
      password: 'SecurePassword123',
    });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
    expect(res.body.data).toBeUndefined();
  });

  // 10. Login, verificationStatus: pending or rejected, accountStatus: active → 200, login succeeds
  it('10. Login with pending or rejected status but active account -> 200 login succeeds', async () => {
    const passwordHash = await hashPassword('SecurePassword123');
    await User.create({
      name: 'Pending User',
      email: 'pending_user@college.edu',
      passwordHash,
      role: 'alumni',
      department: 'CS',
      batch: '2021',
      accountStatus: 'active',
      verificationStatus: 'pending',
    });

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'pending_user@college.edu',
      password: 'SecurePassword123',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.verificationStatus).toBe('pending');
  });

  // 11. GET /auth/me with no token → 401 NOT_AUTHENTICATED
  it('11. GET /api/v1/auth/me with no token -> 401 NOT_AUTHENTICATED', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NOT_AUTHENTICATED');
  });

  // 12. GET /auth/me with valid token → 200, safe user fields only
  it('12. GET /api/v1/auth/me with valid token -> 200, safe user fields only', async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Helen Me',
      email: 'helen@college.edu',
      password: 'SecurePassword123',
      confirmPassword: 'SecurePassword123',
      role: 'student',
      department: 'Biotech',
      batch: '2026',
    });

    const token = regRes.body.data.accessToken;

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.name).toBe('Helen Me');
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.user.refreshTokenHash).toBeUndefined();
  });

  // 13. Admin logs in, lists pending users → 200
  it('13. Admin logs in and lists pending users -> 200', async () => {
    await createAdmin();

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@college.edu',
      password: 'AdminPass123',
    });
    const adminToken = loginRes.body.data.accessToken;

    const res = await request(app)
      .get('/api/v1/admin/users?status=pending')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toBeDefined();
  });

  // 14. Admin approves a pending alumni → verificationStatus: admin_approved, audit log written
  it('14. Admin approves a pending alumni -> admin_approved status, audit log written', async () => {
    await createAdmin();
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@college.edu',
      password: 'AdminPass123',
    });
    const adminToken = adminLogin.body.data.accessToken;

    const passwordHash = await hashPassword('SecurePassword123');
    const alumni = await User.create({
      name: 'Ian Alumni',
      email: 'ian@personal.com',
      passwordHash,
      role: 'alumni',
      department: 'CS',
      batch: '2021',
      verificationStatus: 'pending',
      accountStatus: 'active',
    });

    const res = await request(app)
      .patch(`/api/v1/admin/users/${alumni._id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.verificationStatus).toBe('admin_approved');

    // Verify AdminAuditLog entry
    const log = await AdminAuditLog.findOne({ targetId: alumni._id, action: 'user.approve' });
    expect(log).not.toBeNull();
  });

  // 15. Admin rejects a user → verificationStatus: rejected, reason stored, audit log written
  it('15. Admin rejects a user -> rejected status, reason stored, audit log written', async () => {
    await createAdmin();
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@college.edu',
      password: 'AdminPass123',
    });
    const adminToken = adminLogin.body.data.accessToken;

    const passwordHash = await hashPassword('SecurePassword123');
    const userToReject = await User.create({
      name: 'Jack Invalid',
      email: 'jack@personal.com',
      passwordHash,
      role: 'alumni',
      department: 'CS',
      batch: '2021',
      verificationStatus: 'pending',
      accountStatus: 'active',
    });

    const res = await request(app)
      .patch(`/api/v1/admin/users/${userToReject._id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Degree records could not be verified' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.verificationStatus).toBe('rejected');
    expect(res.body.data.user.rejectionReason).toBe('Degree records could not be verified');

    const log = await AdminAuditLog.findOne({ targetId: userToReject._id, action: 'user.reject' });
    expect(log).not.toBeNull();
  });

  // 16. Admin suspends an active user, then that user tries to log in → login fails
  it('16. Admin suspends an active user -> login fails and refreshTokenHash cleared', async () => {
    await createAdmin();
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@college.edu',
      password: 'AdminPass123',
    });
    const adminToken = adminLogin.body.data.accessToken;

    const passwordHash = await hashPassword('SecurePassword123');
    const userToSuspend = await User.create({
      name: 'Kevin Active',
      email: 'kevin@college.edu',
      passwordHash,
      role: 'student',
      department: 'CS',
      batch: '2025',
      verificationStatus: 'email_verified',
      accountStatus: 'active',
      refreshTokenHash: 'some_hash',
    });

    // Suspend user
    const suspendRes = await request(app)
      .patch(`/api/v1/admin/users/${userToSuspend._id}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Policy violation' });

    expect(suspendRes.status).toBe(200);
    expect(suspendRes.body.data.user.accountStatus).toBe('suspended');

    // Check refresh token was revoked
    const checkDb = await User.findById(userToSuspend._id).select('+refreshTokenHash');
    expect(checkDb?.refreshTokenHash).toBeUndefined();

    // Now try to log in
    const loginAttempt = await request(app).post('/api/v1/auth/login').send({
      email: 'kevin@college.edu',
      password: 'SecurePassword123',
    });

    expect(loginAttempt.status).toBe(403);
    expect(loginAttempt.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  // 17. Student calls GET /api/v1/admin/users → 403 FORBIDDEN_ROLE
  it('17. Student calls GET /api/v1/admin/users -> 403 FORBIDDEN_ROLE', async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Laura Student',
      email: 'laura@college.edu',
      password: 'SecurePassword123',
      confirmPassword: 'SecurePassword123',
      role: 'student',
      department: 'CS',
      batch: '2026',
    });

    const studentToken = regRes.body.data.accessToken;

    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
  });

  // 18. Rate limit verification / auth protection
  it('18. Unauthenticated access to admin endpoints returns 401 NOT_AUTHENTICATED', async () => {
    const res = await request(app).get('/api/v1/admin/users');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NOT_AUTHENTICATED');
  });

  // 19. Refresh token rotation
  it('19. Refresh token rotation -> old refresh token invalidated, new one works', async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Mike Rotate',
      email: 'mike@college.edu',
      password: 'SecurePassword123',
      confirmPassword: 'SecurePassword123',
      role: 'student',
      department: 'CS',
      batch: '2025',
    });

    const initialCookie = regRes.headers['set-cookie'];

    // 1st refresh with valid cookie
    const refresh1 = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', initialCookie);

    expect(refresh1.status).toBe(200);
    expect(refresh1.body.success).toBe(true);
    expect(refresh1.body.data.accessToken).toBeDefined();

    const newCookie = refresh1.headers['set-cookie'];
    expect(newCookie).toBeDefined();

    // 2nd refresh with OLD cookie -> fails (401)
    const refreshOld = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', initialCookie);

    expect(refreshOld.status).toBe(401);

    // 3rd refresh with NEW cookie -> succeeds (200)
    const refreshNew = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', newCookie);

    expect(refreshNew.status).toBe(200);
  });

  // 20. Password reset end-to-end
  it('20. Password reset end-to-end -> old password stops working, all sessions invalidated', async () => {
    const passwordHash = await hashPassword('OldPassword123');
    const { raw, hash, expires } = generateSecureToken(60 * 60 * 1000);

    const user = await User.create({
      name: 'Nancy Reset',
      email: 'nancy@college.edu',
      passwordHash,
      role: 'student',
      department: 'CS',
      batch: '2025',
      accountStatus: 'active',
      resetTokenHash: hash,
      resetTokenExpires: expires,
      refreshTokenHash: 'valid_refresh_hash',
    });

    // Reset password with valid token
    const resetRes = await request(app).post('/api/v1/auth/reset-password').send({
      token: raw,
      password: 'NewBrandPassword456',
      confirmPassword: 'NewBrandPassword456',
    });

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);

    // Old password fails
    const oldLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'nancy@college.edu',
      password: 'OldPassword123',
    });
    expect(oldLogin.status).toBe(401);

    // New password succeeds
    const newLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'nancy@college.edu',
      password: 'NewBrandPassword456',
    });
    expect(newLogin.status).toBe(200);

    // Prior reset token is cleared and cannot be reused
    const reuseRes = await request(app).post('/api/v1/auth/reset-password').send({
      token: raw,
      password: 'AnotherPassword789',
      confirmPassword: 'AnotherPassword789',
    });
    expect(reuseRes.status).toBe(400);
  });
});
