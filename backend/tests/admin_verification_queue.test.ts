import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app';
import User from '../src/models/User';
import College from '../src/models/College';
import VerificationRequest from '../src/models/VerificationRequest';
import AdminAuditLog from '../src/models/AdminAuditLog';
import { hashPassword } from '../src/utils/auth';

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
  await College.deleteMany({});
  await VerificationRequest.deleteMany({});
  await AdminAuditLog.deleteMany({});
});

describe('Admin Verification Queue & Pending Count Regression Suite', () => {
  async function createAdmin(email = 'admin@platform.edu', password = 'AdminPassword123') {
    const passwordHash = await hashPassword(password);
    const admin = await User.create({
      name: 'System Admin',
      email,
      passwordHash,
      role: 'admin',
      accountStatus: 'active',
      verificationStatus: 'admin_approved',
      department: 'Administration',
      batch: '2020',
    });

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email,
      password,
    });

    return { admin, token: loginRes.body.data.accessToken };
  }

  async function createCollege(name = 'Apex Engineering College', code = 'APEX', domains = ['apex.edu']) {
    return College.create({
      name,
      code,
      domains,
      isActive: true,
    });
  }

  describe('1. Bug Reproduction & Queue Alignment', () => {
    it('accurately reports 6 pending users on dashboard and returns them in the users queue with compatible response shape', async () => {
      const { token: adminToken } = await createAdmin();

      // Create 6 pending direct users (reproducing the reported issue)
      const passwordHash = await hashPassword('UserPassword123');
      for (let i = 1; i <= 6; i++) {
        await User.create({
          name: `Pending Applicant ${i}`,
          email: `applicant${i}@example.com`,
          passwordHash,
          role: i % 2 === 0 ? 'alumni' : 'student',
          department: 'Computer Science',
          batch: `202${i}`,
          accountStatus: 'active',
          verificationStatus: 'pending',
        });
      }

      // 1. Dashboard metrics pending count should be 6
      const dashRes = await request(app)
        .get('/api/v1/dashboard/admin')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(dashRes.status).toBe(200);
      expect(dashRes.body.data.metrics.pendingVerifications).toBe(6);

      // 2. Admin dashboard endpoint should also report 6 pending users
      const adminDashRes = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminDashRes.status).toBe(200);
      expect(adminDashRes.body.data.pendingUsers).toBe(6);

      // 3. Tab 2 (Direct Pending Users) query: GET /api/v1/admin/users?status=pending
      const usersRes = await request(app)
        .get('/api/v1/admin/users?status=pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(usersRes.status).toBe(200);
      expect(usersRes.body.data.total).toBe(6);
      expect(usersRes.body.data.items).toHaveLength(6);
      // Verify aliases for backwards/frontend compatibility
      expect(usersRes.body.data.users).toHaveLength(6);
      expect(usersRes.body.data.pagination.total).toBe(6);
      expect(usersRes.body.data.pagination.pages).toBe(1);

      // 4. Tab 1 (Institutional Requests) query: GET /api/v1/admin/verification-requests?status=pending
      const requestsRes = await request(app)
        .get('/api/v1/admin/verification-requests?status=pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(requestsRes.status).toBe(200);
      expect(requestsRes.body.data.total).toBe(0);
      expect(requestsRes.body.data.items).toHaveLength(0);
    });

    it('returns both direct pending users and institutional verification requests appropriately when both exist', async () => {
      const { token: adminToken } = await createAdmin();
      const college = await createCollege();
      const passwordHash = await hashPassword('UserPassword123');

      // Create 3 direct pending users
      for (let i = 1; i <= 3; i++) {
        await User.create({
          name: `Direct Applicant ${i}`,
          email: `direct${i}@example.com`,
          passwordHash,
          role: 'student',
          department: 'CS',
          batch: '2025',
          accountStatus: 'active',
          verificationStatus: 'pending',
        });
      }

      // Create 2 institutional verification requests
      for (let i = 1; i <= 2; i++) {
        const instUser = await User.create({
          name: `Inst Applicant ${i}`,
          email: `inst${i}@apex.edu`,
          passwordHash,
          role: 'student',
          department: 'CS',
          batch: '2025',
          accountStatus: 'active',
          verificationStatus: 'email_verified',
        });

        await VerificationRequest.create({
          user: instUser._id,
          college: college._id,
          role: 'student',
          status: 'pending',
          collegeDomainVerified: true,
        });
      }

      // Direct users query
      const usersRes = await request(app)
        .get('/api/v1/admin/users?status=pending')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(usersRes.body.data.total).toBe(3);
      expect(usersRes.body.data.items).toHaveLength(3);

      // Institutional requests query
      const reqsRes = await request(app)
        .get('/api/v1/admin/verification-requests?status=pending')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(reqsRes.body.data.total).toBe(2);
      expect(reqsRes.body.data.items).toHaveLength(2);
    });
  });

  describe('2. Direct User Verification & Review Actions', () => {
    it('approves direct pending user and records audit log', async () => {
      const { admin, token: adminToken } = await createAdmin();
      const passwordHash = await hashPassword('UserPassword123');
      const user = await User.create({
        name: 'Direct Pending Student',
        email: 'direct.student@example.com',
        passwordHash,
        role: 'student',
        department: 'ECE',
        batch: '2025',
        accountStatus: 'active',
        verificationStatus: 'pending',
      });

      const approveRes = await request(app)
        .patch(`/api/v1/admin/users/${user._id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.user.verificationStatus).toBe('admin_approved');

      const updatedUser = await User.findById(user._id);
      expect(updatedUser?.verificationStatus).toBe('admin_approved');

      const auditLog = await AdminAuditLog.findOne({ targetId: user._id, action: 'user.approve' });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.admin.toString()).toBe(admin._id.toString());
    });

    it('rejects direct pending user with reason and records audit log', async () => {
      const { admin, token: adminToken } = await createAdmin();
      const passwordHash = await hashPassword('UserPassword123');
      const user = await User.create({
        name: 'Direct Pending Alumni',
        email: 'direct.alumni@example.com',
        passwordHash,
        role: 'alumni',
        department: 'Mechanical',
        batch: '2020',
        accountStatus: 'active',
        verificationStatus: 'pending',
      });

      const rejectRes = await request(app)
        .patch(`/api/v1/admin/users/${user._id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Invalid graduation records submitted' });

      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.data.user.verificationStatus).toBe('rejected');
      expect(rejectRes.body.data.user.rejectionReason).toBe('Invalid graduation records submitted');

      const updatedUser = await User.findById(user._id);
      expect(updatedUser?.verificationStatus).toBe('rejected');
      expect(updatedUser?.rejectionReason).toBe('Invalid graduation records submitted');

      const auditLog = await AdminAuditLog.findOne({ targetId: user._id, action: 'user.reject' });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.metadata?.reason).toBe('Invalid graduation records submitted');
    });

    it('requires a non-empty reason when rejecting a direct user', async () => {
      const { token: adminToken } = await createAdmin();
      const passwordHash = await hashPassword('UserPassword123');
      const user = await User.create({
        name: 'Applicant To Reject',
        email: 'reject.me@example.com',
        passwordHash,
        role: 'student',
        department: 'CS',
        batch: '2026',
        accountStatus: 'active',
        verificationStatus: 'pending',
      });

      const emptyReasonRes = await request(app)
        .patch(`/api/v1/admin/users/${user._id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: '   ' });

      expect(emptyReasonRes.status).toBe(422);
      expect(emptyReasonRes.body.success).toBe(false);
    });
  });

  describe('3. Institutional Request Atomicity & Security', () => {
    it('prevents double approval on institutional verification request', async () => {
      const { token: adminToken } = await createAdmin();
      const college = await createCollege();
      const passwordHash = await hashPassword('UserPassword123');

      const user = await User.create({
        name: 'Institutional Student',
        email: 'student@apex.edu',
        passwordHash,
        role: 'student',
        department: 'IT',
        batch: '2026',
        accountStatus: 'active',
        verificationStatus: 'email_verified',
      });

      const vReq = await VerificationRequest.create({
        user: user._id,
        college: college._id,
        role: 'student',
        status: 'pending',
        collegeDomainVerified: true,
      });

      // 1. First approval succeeds
      const firstApprove = await request(app)
        .patch(`/api/v1/admin/verification-requests/${vReq._id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(firstApprove.status).toBe(200);
      expect(firstApprove.body.data.verificationRequest.status).toBe('approved');
      expect(firstApprove.body.data.user.verificationStatus).toBe('admin_approved');

      // 2. Second approval fails atomically (state-gated)
      const secondApprove = await request(app)
        .patch(`/api/v1/admin/verification-requests/${vReq._id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(secondApprove.status).toBe(404);
      expect(secondApprove.body.error.code).toBe('REQUEST_NOT_PENDING');
    });

    it('prevents rejecting an already processed institutional verification request', async () => {
      const { token: adminToken } = await createAdmin();
      const college = await createCollege();
      const passwordHash = await hashPassword('UserPassword123');

      const user = await User.create({
        name: 'Institutional Alumni',
        email: 'alumni@apex.edu',
        passwordHash,
        role: 'alumni',
        department: 'ECE',
        batch: '2019',
        accountStatus: 'active',
        verificationStatus: 'email_verified',
      });

      const vReq = await VerificationRequest.create({
        user: user._id,
        college: college._id,
        role: 'alumni',
        status: 'pending',
        collegeDomainVerified: true,
      });

      // 1. Reject request
      const firstReject = await request(app)
        .patch(`/api/v1/admin/verification-requests/${vReq._id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Degree certificate could not be verified' });

      expect(firstReject.status).toBe(200);
      expect(firstReject.body.data.verificationRequest.status).toBe('rejected');

      // 2. Attempt to approve rejected request -> blocked
      const reApprove = await request(app)
        .patch(`/api/v1/admin/verification-requests/${vReq._id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(reApprove.status).toBe(404);
      expect(reApprove.body.error.code).toBe('REQUEST_NOT_PENDING');
    });
  });

  describe('4. Security & Privacy Guarantees', () => {
    it('never exposes password hashes or token hashes in admin user listing', async () => {
      const { token: adminToken } = await createAdmin();
      const passwordHash = await hashPassword('SecretPassword123');

      await User.create({
        name: 'Protected User',
        email: 'protected@example.com',
        passwordHash,
        role: 'student',
        department: 'CS',
        batch: '2026',
        accountStatus: 'active',
        verificationStatus: 'pending',
      });

      const res = await request(app)
        .get('/api/v1/admin/users?status=pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const userItem = res.body.data.items[0];
      expect(userItem.passwordHash).toBeUndefined();
      expect(userItem.refreshTokenHash).toBeUndefined();
      expect(userItem.verificationTokenHash).toBeUndefined();
      expect(userItem.resetTokenHash).toBeUndefined();
    });

    it('blocks non-admin users from accessing verification queue endpoints', async () => {
      const passwordHash = await hashPassword('UserPassword123');
      const student = await User.create({
        name: 'Regular Student',
        email: 'regular.student@example.com',
        passwordHash,
        role: 'student',
        accountStatus: 'active',
        verificationStatus: 'admin_approved',
      });

      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'regular.student@example.com',
        password: 'UserPassword123',
      });
      const studentToken = loginRes.body.data.accessToken;

      const queueRes = await request(app)
        .get('/api/v1/admin/users?status=pending')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(queueRes.status).toBe(403);
      expect(queueRes.body.error.code).toBe('FORBIDDEN_ROLE');

      const requestsRes = await request(app)
        .get('/api/v1/admin/verification-requests?status=pending')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(requestsRes.status).toBe(403);
      expect(requestsRes.body.error.code).toBe('FORBIDDEN_ROLE');
    });
  });
});
