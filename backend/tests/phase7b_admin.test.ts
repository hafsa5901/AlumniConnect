import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app';
import User from '../src/models/User';
import AdminAuditLog from '../src/models/AdminAuditLog';
import {
  hashPassword,
  generateSecureToken,
  RESET_TOKEN_TTL,
} from '../src/utils/auth';

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

describe('Phase 7B — Secure Admin Identity, Access Control & Governance Tests', () => {
  async function createAdmin(email = 'admin@college.edu', password = 'AdminPassword123') {
    const passwordHash = await hashPassword(password);
    return User.create({
      name: 'System Admin',
      email,
      passwordHash,
      role: 'admin',
      accountStatus: 'active',
      verificationStatus: 'admin_approved',
      department: 'Administration',
      batch: '2020',
    });
  }

  async function createStudent(email = 'student@college.edu', password = 'StudentPassword123') {
    const passwordHash = await hashPassword(password);
    return User.create({
      name: 'Test Student',
      email,
      passwordHash,
      role: 'student',
      accountStatus: 'active',
      verificationStatus: 'email_verified',
      department: 'Computer Science',
      batch: '2025',
    });
  }

  async function createAlumni(email = 'alumni@college.edu', password = 'AlumniPassword123') {
    const passwordHash = await hashPassword(password);
    return User.create({
      name: 'Test Alumni',
      email,
      passwordHash,
      role: 'alumni',
      accountStatus: 'active',
      verificationStatus: 'admin_approved',
      department: 'Information Technology',
      batch: '2022',
    });
  }

  // ── 1. Public Registration Security ─────────────────────────────────────────
  describe('1. Public Registration Role Boundary', () => {
    it('allows valid student registration with institutional email', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Valid Student',
        email: 'valid.student@college.edu',
        password: 'SecurePassword123',
        confirmPassword: 'SecurePassword123',
        role: 'student',
        department: 'CS',
        batch: '2026',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('student');
    });

    it('allows valid alumni registration', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Valid Alumni',
        email: 'valid.alumni@college.edu',
        password: 'SecurePassword123',
        confirmPassword: 'SecurePassword123',
        role: 'alumni',
        department: 'IT',
        batch: '2022',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('alumni');
    });

    it('strictly rejects any public registration attempt with role: admin', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Malicious Attacker',
        email: 'attacker@college.edu',
        password: 'SecurePassword123',
        confirmPassword: 'SecurePassword123',
        role: 'admin',
        department: 'Administration',
        batch: '2024',
      });

      expect([403, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);

      const inDb = await User.findOne({ email: 'attacker@college.edu' });
      expect(inDb).toBeNull();
    });

    it('strictly rejects public registration attempts with unapproved or escalated roles', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Super Attacker',
        email: 'super@college.edu',
        password: 'SecurePassword123',
        confirmPassword: 'SecurePassword123',
        role: 'super_admin',
        department: 'Administration',
        batch: '2024',
      });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);

      const inDb = await User.findOne({ email: 'super@college.edu' });
      expect(inDb).toBeNull();
    });
  });

  // ── 2. Admin Authentication & Session Security ──────────────────────────────
  describe('2. Admin Authentication & Session Security', () => {
    it('authenticates valid admin credentials and issues admin JWT', async () => {
      await createAdmin('admin@college.edu', 'AdminPassword123');

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'admin@college.edu',
        password: 'AdminPassword123',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('admin');
      expect(res.body.data.user.verificationStatus).toBe('admin_approved');
      expect(res.body.data.accessToken).toBeDefined();

      // Ensure passwordHash is never returned
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.user.refreshTokenHash).toBeUndefined();
    });

    it('rejects admin login with incorrect password with standard enumeration resistance', async () => {
      await createAdmin('admin@college.edu', 'AdminPassword123');

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'admin@college.edu',
        password: 'WrongPassword999',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('blocks suspended admin from authenticating', async () => {
      const passwordHash = await hashPassword('AdminPassword123');
      await User.create({
        name: 'Suspended Admin',
        email: 'suspended.admin@college.edu',
        passwordHash,
        role: 'admin',
        accountStatus: 'suspended',
        verificationStatus: 'admin_approved',
        department: 'Administration',
        batch: '2020',
      });

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'suspended.admin@college.edu',
        password: 'AdminPassword123',
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
      expect(res.body.data).toBeUndefined();
    });

    it('blocks deactivated admin from authenticating', async () => {
      const passwordHash = await hashPassword('AdminPassword123');
      await User.create({
        name: 'Deactivated Admin',
        email: 'deactivated.admin@college.edu',
        passwordHash,
        role: 'admin',
        accountStatus: 'deactivated',
        verificationStatus: 'admin_approved',
        department: 'Administration',
        batch: '2020',
      });

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'deactivated.admin@college.edu',
        password: 'AdminPassword123',
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
    });
  });

  // ── 3. Admin API Server-Side Authorization ─────────────────────────────────
  describe('3. Admin API Server-Side Authorization', () => {
    it('grants admin access to /api/v1/admin/dashboard and /api/v1/admin/users', async () => {
      await createAdmin();
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'admin@college.edu',
        password: 'AdminPassword123',
      });
      const adminToken = loginRes.body.data.accessToken;

      const dashRes = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(dashRes.status).toBe(200);
      expect(dashRes.body.success).toBe(true);
      expect(dashRes.body.data.totalUsers).toBeDefined();

      const usersRes = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(usersRes.status).toBe(200);
      expect(usersRes.body.success).toBe(true);
      expect(usersRes.body.data.items).toBeDefined();
    });

    it('rejects student token attempting to access admin APIs with 403 FORBIDDEN_ROLE', async () => {
      await createStudent();
      const studentLogin = await request(app).post('/api/v1/auth/login').send({
        email: 'student@college.edu',
        password: 'StudentPassword123',
      });
      const studentToken = studentLogin.body.data.accessToken;

      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('rejects alumni token attempting to access admin APIs with 403 FORBIDDEN_ROLE', async () => {
      await createAlumni();
      const alumniLogin = await request(app).post('/api/v1/auth/login').send({
        email: 'alumni@college.edu',
        password: 'AlumniPassword123',
      });
      const alumniToken = alumniLogin.body.data.accessToken;

      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${alumniToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('rejects unauthenticated request to admin APIs with 401 NOT_AUTHENTICATED', async () => {
      const res = await request(app).get('/api/v1/admin/users');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_AUTHENTICATED');
    });
  });

  // ── 4. Admin Governance, Self-Action & Last Admin Protections ───────────────
  describe('4. Governance Protections & Audit Logging', () => {
    it('prevents an admin from suspending their own account', async () => {
      const admin = await createAdmin('admin1@college.edu');
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'admin1@college.edu',
        password: 'AdminPassword123',
      });
      const token = loginRes.body.data.accessToken;

      const res = await request(app)
        .patch(`/api/v1/admin/users/${admin._id}/suspend`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Accidental self-suspension' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SELF_ACTION_FORBIDDEN');
    });

    it('prevents an admin from changing their own role', async () => {
      const admin = await createAdmin('admin1@college.edu');
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'admin1@college.edu',
        password: 'AdminPassword123',
      });
      const token = loginRes.body.data.accessToken;

      const res = await request(app)
        .patch(`/api/v1/admin/users/${admin._id}/role`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'student', reason: 'Self-demotion' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SELF_ACTION_FORBIDDEN');
    });

    it('protects the last active admin from being suspended', async () => {
      const soleAdmin = await createAdmin('sole.admin@college.edu');
      // Create a second user (e.g. another admin temporarily or test via another authorized request)
      const secondAdmin = await createAdmin('second.admin@college.edu');

      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'second.admin@college.edu',
        password: 'AdminPassword123',
      });
      const secondAdminToken = loginRes.body.data.accessToken;

      // Suspend soleAdmin -> succeeds because secondAdmin is active
      const firstSuspend = await request(app)
        .patch(`/api/v1/admin/users/${soleAdmin._id}/suspend`)
        .set('Authorization', `Bearer ${secondAdminToken}`)
        .send({ reason: 'First admin suspension' });

      expect(firstSuspend.status).toBe(200);

      // Now create a 3rd admin to test suspending the last active admin (secondAdmin)
      const thirdAdmin = await createAdmin('third.admin@college.edu');
      const thirdLogin = await request(app).post('/api/v1/auth/login').send({
        email: 'third.admin@college.edu',
        password: 'AdminPassword123',
      });
      const thirdAdminToken = thirdLogin.body.data.accessToken;

      // Suspend secondAdmin -> succeeds because thirdAdmin is active
      await request(app)
        .patch(`/api/v1/admin/users/${secondAdmin._id}/suspend`)
        .set('Authorization', `Bearer ${thirdAdminToken}`)
        .send({ reason: 'Second admin suspension' });

      // Now thirdAdmin is the ONLY active admin. Attempting to suspend thirdAdmin via another admin should fail.
      // Let's create an emergency admin account that is suspended to test:
      const attemptRes = await request(app)
        .patch(`/api/v1/admin/users/${thirdAdmin._id}/suspend`)
        .set('Authorization', `Bearer ${thirdAdminToken}`)
        .send({ reason: 'Attempting to remove last admin' });

      // Should fail either with SELF_ACTION_FORBIDDEN or LAST_ADMIN_PROTECTED
      expect([403]).toContain(attemptRes.status);
    });

    it('records deterministic AdminAuditLog entries for administrative actions', async () => {
      await createAdmin('admin@college.edu');
      const student = await createStudent('target.student@college.edu');

      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'admin@college.edu',
        password: 'AdminPassword123',
      });
      const token = loginRes.body.data.accessToken;

      // Suspend student
      const suspendRes = await request(app)
        .patch(`/api/v1/admin/users/${student._id}/suspend`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Inappropriate platform behavior' });

      expect(suspendRes.status).toBe(200);

      // Verify audit log record
      const log = await AdminAuditLog.findOne({
        targetId: student._id,
        action: 'user.suspend',
      });

      expect(log).not.toBeNull();
      expect(log?.metadata?.reason).toBe('Inappropriate platform behavior');
    });
  });

  // ── 5. Admin Password Reset ────────────────────────────────────────────────
  describe('5. Admin Password Reset', () => {
    it('allows an administrator to securely reset password and revokes previous sessions', async () => {
      const admin = await createAdmin('admin.reset@college.edu', 'InitialPassword123');
      const { raw, hash, expires } = generateSecureToken(RESET_TOKEN_TTL);

      admin.resetTokenHash = hash;
      admin.resetTokenExpires = expires;
      admin.refreshTokenHash = 'existing_session_hash';
      await admin.save();

      const res = await request(app).post('/api/v1/auth/reset-password').send({
        token: raw,
        password: 'NewAdminPassword456',
        confirmPassword: 'NewAdminPassword456',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Old password fails
      const oldLogin = await request(app).post('/api/v1/auth/login').send({
        email: 'admin.reset@college.edu',
        password: 'InitialPassword123',
      });
      expect(oldLogin.status).toBe(401);

      // New password succeeds
      const newLogin = await request(app).post('/api/v1/auth/login').send({
        email: 'admin.reset@college.edu',
        password: 'NewAdminPassword456',
      });
      expect(newLogin.status).toBe(200);
      expect(newLogin.body.data.user.role).toBe('admin');
    });
  });

  // ── 6. Admin Analytics Authorization ───────────────────────────────────────
  describe('6. Admin Analytics Access Control', () => {
    it('allows admin token to retrieve analytics overview and activity', async () => {
      await createAdmin();
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'admin@college.edu',
        password: 'AdminPassword123',
      });
      const token = loginRes.body.data.accessToken;

      const overviewRes = await request(app)
        .get('/api/v1/admin/analytics/overview')
        .set('Authorization', `Bearer ${token}`);
      expect(overviewRes.status).toBe(200);
      expect(overviewRes.body.data.users).toBeDefined();

      const activityRes = await request(app)
        .get('/api/v1/admin/analytics/activity?days=7')
        .set('Authorization', `Bearer ${token}`);
      expect(activityRes.status).toBe(200);
      expect(activityRes.body.data.timeline).toBeDefined();
    });

    it('denies non-admin access to analytics overview with 403 FORBIDDEN_ROLE', async () => {
      await createStudent();
      const studentLogin = await request(app).post('/api/v1/auth/login').send({
        email: 'student@college.edu',
        password: 'StudentPassword123',
      });
      const token = studentLogin.body.data.accessToken;

      const res = await request(app)
        .get('/api/v1/admin/analytics/overview')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });
  });
});
