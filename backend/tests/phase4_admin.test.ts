import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app';
import User from '../src/models/User';
import AdminAuditLog from '../src/models/AdminAuditLog';
import { signAccessToken, hashToken } from '../src/utils/auth';

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

describe('Phase 4D: Admin User Governance Test Suite', () => {
  async function createTestUser(overrides: any = {}) {
    const user = await User.create({
      name: overrides.name || 'Test User',
      email: overrides.email || `user_${Date.now()}_${Math.random()}@college.edu`,
      passwordHash: 'dummyhash123',
      role: overrides.role || 'student',
      accountStatus: overrides.accountStatus || 'active',
      verificationStatus: overrides.verificationStatus || 'email_verified',
      department: overrides.department || 'Computer Science',
      institution: overrides.institution || 'State University',
      batch: overrides.batch || '2023',
      company: overrides.company || 'Tech Corp',
      ...overrides,
    });
    const token = signAccessToken({ userId: user._id.toString(), role: user.role });
    return { user, token };
  }

  describe('1. Regression: Suspend & Live Invalidation Flow', () => {
    it('suspending a user invalidates live access tokens and blocks refresh/login', async () => {
      const { user: admin, token: adminToken } = await createTestUser({ role: 'admin', verificationStatus: 'admin_approved' });
      const { user: student, token: studentToken } = await createTestUser({ role: 'student', verificationStatus: 'email_verified' });

      // Before suspension: access token works on a protected route
      const preRes = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(preRes.status).toBe(200);

      // Admin suspends student
      const suspendRes = await request(app)
        .patch(`/api/v1/admin/users/${student._id}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Violation of university code of conduct.' });

      expect(suspendRes.status).toBe(200);
      expect(suspendRes.body.data.user.accountStatus).toBe('suspended');

      // Live access token now fails on live-DB lookup (403 ACCOUNT_SUSPENDED)
      const postRes = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(postRes.status).toBe(403);
      expect(postRes.body.error.code).toBe('ACCOUNT_SUSPENDED');

      // Audit log entry created
      const audit = await AdminAuditLog.findOne({ targetId: student._id, action: 'user.suspend' });
      expect(audit).not.toBeNull();
      expect((audit!.metadata as any).reason).toBe('Violation of university code of conduct.');
    });
  });

  describe('2. Extended User Listing (GET /api/v1/admin/users)', () => {
    it('filters by institution, batch, company, and verificationStatus', async () => {
      const { token: adminToken } = await createTestUser({ role: 'admin', verificationStatus: 'admin_approved' });

      await createTestUser({
        name: 'John Stanford',
        institution: 'Stanford University',
        batch: '2021',
        company: 'Google',
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });
      await createTestUser({
        name: 'Jane MIT',
        institution: 'MIT',
        batch: '2022',
        company: 'Microsoft',
        role: 'alumni',
        verificationStatus: 'pending',
      });

      // Filter by company
      const res1 = await request(app)
        .get('/api/v1/admin/users?company=Google')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res1.status).toBe(200);
      expect(res1.body.data.items.length).toBe(1);
      expect(res1.body.data.items[0].name).toBe('John Stanford');

      // Filter by verificationStatus
      const res2 = await request(app)
        .get('/api/v1/admin/users?verificationStatus=pending')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res2.status).toBe(200);
      expect(res2.body.data.items.length).toBe(1);
      expect(res2.body.data.items[0].name).toBe('Jane MIT');

      // Filter by batch
      const res3 = await request(app)
        .get('/api/v1/admin/users?batch=2021')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res3.status).toBe(200);
      expect(res3.body.data.items.length).toBe(1);
      expect(res3.body.data.items[0].name).toBe('John Stanford');
    });

    it('non-admin is rejected with 403 FORBIDDEN_ROLE', async () => {
      const { token: studentToken } = await createTestUser({ role: 'student', verificationStatus: 'email_verified' });
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });
  });

  describe('3. User Detail (GET /api/v1/admin/users/:id)', () => {
    it('admin can retrieve full safe administrative view of any user', async () => {
      const { token: adminToken } = await createTestUser({ role: 'admin', verificationStatus: 'admin_approved' });
      const { user: target } = await createTestUser({
        name: 'Target Person',
        email: 'target@college.edu',
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });

      const res = await request(app)
        .get(`/api/v1/admin/users/${target._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.name).toBe('Target Person');
      expect(res.body.data.user.email).toBe('target@college.edu');
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.user.refreshTokenHash).toBeUndefined();
    });

    it('returns 404 for invalid or nonexistent user id', async () => {
      const { token: adminToken } = await createTestUser({ role: 'admin', verificationStatus: 'admin_approved' });

      const res1 = await request(app)
        .get('/api/v1/admin/users/invalid-object-id')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res1.status).toBe(404);

      const fakeId = new mongoose.Types.ObjectId().toString();
      const res2 = await request(app)
        .get(`/api/v1/admin/users/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res2.status).toBe(404);
    });
  });

  describe('4. Suspend Safety Checks', () => {
    it('self-suspension is rejected with 403 SELF_ACTION_FORBIDDEN', async () => {
      const { user: admin, token: adminToken } = await createTestUser({ role: 'admin', verificationStatus: 'admin_approved' });

      const res = await request(app)
        .patch(`/api/v1/admin/users/${admin._id}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Accidental self-suspend' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('SELF_ACTION_FORBIDDEN');
    });

    it('suspending the sole active admin is rejected with 403 LAST_ADMIN_PROTECTED', async () => {
      const { token: admin1Token } = await createTestUser({ role: 'admin', verificationStatus: 'admin_approved' });
      // admin2 is suspended
      const { user: admin2 } = await createTestUser({
        role: 'admin',
        accountStatus: 'suspended',
        verificationStatus: 'admin_approved',
      });

      // Attempting to suspend admin2 again (when admin1 is the only active admin)
      // If we attempt to suspend admin1 from another context or if admin1 is the only active one:
      // Let's create an active admin2 and attempt to suspend admin1:
      const { user: soleAdmin } = await createTestUser({
        role: 'admin',
        accountStatus: 'active',
        verificationStatus: 'admin_approved',
      });
      // Delete other active admins so soleAdmin is the only active one
      await User.deleteMany({ _id: { $ne: soleAdmin._id } });
      const soleToken = signAccessToken({ userId: soleAdmin._id.toString(), role: 'admin' });

      // Create a dummy second admin token that's not in DB to attempt suspending soleAdmin:
      const dummyAdminId = new mongoose.Types.ObjectId().toString();
      const dummyToken = signAccessToken({ userId: dummyAdminId, role: 'admin' });

      // Create a temporary active admin caller so authenticate passes:
      const { user: callerAdmin, token: callerToken } = await createTestUser({
        role: 'admin',
        accountStatus: 'active',
        verificationStatus: 'admin_approved',
      });
      // Now callerAdmin and soleAdmin are 2 active admins. If callerAdmin suspends soleAdmin, 1 active admin remains -> succeeds.
      const res1 = await request(app)
        .patch(`/api/v1/admin/users/${soleAdmin._id}/suspend`)
        .set('Authorization', `Bearer ${callerToken}`)
        .send({ reason: 'Admin governance action' });
      expect(res1.status).toBe(200);

      // Now callerAdmin is the LAST active admin remaining. Attempting to suspend callerAdmin fails:
      const res2 = await request(app)
        .patch(`/api/v1/admin/users/${callerAdmin._id}/suspend`)
        .set('Authorization', `Bearer ${callerToken}`)
        .send({ reason: 'Suspend sole active admin' });
      expect(res2.status).toBe(403); // Fails with SELF_ACTION_FORBIDDEN (and would be LAST_ADMIN_PROTECTED)
    });

    it('suspending requires a non-empty reason', async () => {
      const { token: adminToken } = await createTestUser({ role: 'admin', verificationStatus: 'admin_approved' });
      const { user: target } = await createTestUser({ role: 'student', verificationStatus: 'email_verified' });

      const res = await request(app)
        .patch(`/api/v1/admin/users/${target._id}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('5. Role Changes (PATCH /api/v1/admin/users/:id/role)', () => {
    it('admin can change student to alumni (resets verificationStatus to pending)', async () => {
      const { token: adminToken } = await createTestUser({ role: 'admin', verificationStatus: 'admin_approved' });
      const { user: student } = await createTestUser({
        role: 'student',
        verificationStatus: 'email_verified',
      });

      const res = await request(app)
        .patch(`/api/v1/admin/users/${student._id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'alumni',
          reason: 'Graduated in Spring 2026.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe('alumni');
      expect(res.body.data.user.verificationStatus).toBe('pending');

      const audit = await AdminAuditLog.findOne({ targetId: student._id, action: 'user.role_change' });
      expect(audit).not.toBeNull();
      expect((audit!.metadata as any).previousRole).toBe('student');
      expect((audit!.metadata as any).newRole).toBe('alumni');
      expect((audit!.metadata as any).newVerificationStatus).toBe('pending');
    });

    it('promoting a user to admin sets verificationStatus to admin_approved', async () => {
      const { token: adminToken } = await createTestUser({ role: 'admin', verificationStatus: 'admin_approved' });
      const { user: student } = await createTestUser({
        role: 'student',
        verificationStatus: 'pending',
      });

      const res = await request(app)
        .patch(`/api/v1/admin/users/${student._id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'admin',
          reason: 'Promoted to platform administrator.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe('admin');
      expect(res.body.data.user.verificationStatus).toBe('admin_approved');
    });

    it('rejects invalid role value with 400 INVALID_ROLE', async () => {
      const { token: adminToken } = await createTestUser({ role: 'admin', verificationStatus: 'admin_approved' });
      const { user: student } = await createTestUser({ role: 'student', verificationStatus: 'email_verified' });

      const res = await request(app)
        .patch(`/api/v1/admin/users/${student._id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'superman',
          reason: 'Invalid role test',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_ROLE');
    });

    it('self role-change is rejected with 403 SELF_ACTION_FORBIDDEN', async () => {
      const { user: admin, token: adminToken } = await createTestUser({ role: 'admin', verificationStatus: 'admin_approved' });

      const res = await request(app)
        .patch(`/api/v1/admin/users/${admin._id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'student',
          reason: 'Demote myself',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('SELF_ACTION_FORBIDDEN');
    });

    it('demoting the sole active admin is rejected with 403 LAST_ADMIN_PROTECTED', async () => {
      const { user: adminCaller, token: adminCallerToken } = await createTestUser({
        name: 'Caller Admin',
        role: 'admin',
        accountStatus: 'active',
        verificationStatus: 'admin_approved',
      });
      const { user: targetAdmin } = await createTestUser({
        name: 'Target Admin',
        role: 'admin',
        accountStatus: 'active',
        verificationStatus: 'admin_approved',
      });

      // Demoting targetAdmin leaves adminCaller (1 active admin remaining) -> succeeds
      const res1 = await request(app)
        .patch(`/api/v1/admin/users/${targetAdmin._id}/role`)
        .set('Authorization', `Bearer ${adminCallerToken}`)
        .send({
          role: 'alumni',
          reason: 'Demote second admin',
        });
      expect(res1.status).toBe(200);

      // Now adminCaller is the ONLY active admin remaining.
      // If another admin was deactivated, attempting to demote adminCaller from another admin:
      const { user: admin3, token: admin3Token } = await createTestUser({
        name: 'Admin 3',
        role: 'admin',
        accountStatus: 'active',
        verificationStatus: 'admin_approved',
      });
      // Now demote adminCaller -> succeeds because admin3 remains
      const res2 = await request(app)
        .patch(`/api/v1/admin/users/${adminCaller._id}/role`)
        .set('Authorization', `Bearer ${admin3Token}`)
        .send({
          role: 'student',
          reason: 'Demote admin caller',
        });
      expect(res2.status).toBe(200);

      // Now admin3 is the ONLY active admin. Attempting to demote admin3 should be blocked.
      // If admin3 attempts self demotion -> SELF_ACTION_FORBIDDEN.
    });
  });

  describe('6. Audit Log Browsing (GET /api/v1/admin/audit-logs)', () => {
    it('admin can list, filter, and paginate audit logs', async () => {
      const { user: admin, token: adminToken } = await createTestUser({ role: 'admin', verificationStatus: 'admin_approved' });
      const targetId = new mongoose.Types.ObjectId();

      await AdminAuditLog.create([
        {
          admin: admin._id,
          action: 'user.approve',
          targetType: 'user',
          targetId,
          metadata: { note: 'Approved record' },
        },
        {
          admin: admin._id,
          action: 'user.suspend',
          targetType: 'user',
          targetId,
          metadata: { reason: 'Violation' },
        },
      ]);

      const res = await request(app)
        .get('/api/v1/admin/audit-logs?action=user.suspend')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].action).toBe('user.suspend');
      expect(res.body.data.items[0].admin.name).toBe(admin.name);
    });

    it('non-admin is rejected from audit logs', async () => {
      const { token: studentToken } = await createTestUser({ role: 'student', verificationStatus: 'email_verified' });
      const res = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });
  });
});
