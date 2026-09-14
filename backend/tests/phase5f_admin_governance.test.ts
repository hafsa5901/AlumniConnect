import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app';
import User from '../src/models/User';
import AdminAuditLog from '../src/models/AdminAuditLog';
import MentorshipRequest from '../src/models/MentorshipRequest';
import ReferralRequest from '../src/models/ReferralRequest';
import ConnectionRequest from '../src/models/ConnectionRequest';
import Job from '../src/models/Job';
import Event from '../src/models/Event';
import Conversation from '../src/models/Conversation';
import Message from '../src/models/Message';
import { signAccessToken } from '../src/utils/auth';

jest.setTimeout(30000);

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  await User.syncIndexes();
  await AdminAuditLog.syncIndexes();
  await ConnectionRequest.syncIndexes();
  await Conversation.syncIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await AdminAuditLog.deleteMany({});
  await MentorshipRequest.deleteMany({});
  await ReferralRequest.deleteMany({});
  await ConnectionRequest.deleteMany({});
  await Job.deleteMany({});
  await Event.deleteMany({});
  await Conversation.deleteMany({});
  await Message.deleteMany({});
});

describe('Phase 5F: Advanced Admin Operations & Analytics Test Suite', () => {
  async function createTestUser(overrides: any = {}) {
    const user = await User.create({
      name: overrides.name || 'Test User',
      email: overrides.email || `user_${Date.now()}_${Math.random()}@college.edu`,
      passwordHash: 'dummy_pw_hash',
      role: overrides.role || 'student',
      accountStatus: overrides.accountStatus || 'active',
      verificationStatus: overrides.verificationStatus || 'admin_approved',
      department: overrides.department || 'Computer Science',
      company: overrides.company || 'Tech Corp',
      designation: overrides.designation || 'Software Engineer',
      batch: overrides.batch || 2022,
      ...overrides,
    });
    const token = signAccessToken({ userId: user._id.toString(), role: user.role });
    return { user, token };
  }

  // ── 1. Admin Authorization & Security ──────────────────────────────────────
  describe('1. Admin Authorization & Security Gating', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/v1/admin/analytics/overview');
      expect(res.status).toBe(401);
    });

    it('rejects student callers with 403', async () => {
      const { token } = await createTestUser({ role: 'student' });
      const res = await request(app)
        .get('/api/v1/admin/analytics/overview')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('rejects alumni callers with 403', async () => {
      const { token } = await createTestUser({ role: 'alumni' });
      const res = await request(app)
        .get('/api/v1/admin/analytics/overview')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('rejects suspended admin callers with 403', async () => {
      const { token } = await createTestUser({ role: 'admin', accountStatus: 'suspended' });
      const res = await request(app)
        .get('/api/v1/admin/analytics/overview')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('allows active admin callers to access analytics endpoints', async () => {
      const { token } = await createTestUser({ role: 'admin' });
      const res = await request(app)
        .get('/api/v1/admin/analytics/overview')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.users).toBeDefined();
      expect(res.body.data.modules).toBeDefined();
    });
  });

  // ── 2. Platform Analytics Overview ─────────────────────────────────────────
  describe('2. Platform Analytics Overview (Cross-Module Aggregations)', () => {
    it('returns accurate cross-module aggregates without leaking individual PII', async () => {
      const { user: admin, token: adminToken } = await createTestUser({ role: 'admin', name: 'Admin 1' });
      const { user: student1 } = await createTestUser({ role: 'student', department: 'Computer Science', verificationStatus: 'admin_approved' });
      const { user: student2 } = await createTestUser({ role: 'student', department: 'Electrical', verificationStatus: 'pending' });
      const { user: alumni1 } = await createTestUser({ role: 'alumni', company: 'Google', department: 'Computer Science', verificationStatus: 'admin_approved' });
      const { user: alumni2 } = await createTestUser({ role: 'alumni', company: 'Google', department: 'Mechanical', accountStatus: 'suspended' });

      // Create mentorship
      await MentorshipRequest.create({
        student: student1._id,
        mentor: alumni1._id,
        status: 'accepted',
        topic: 'Career guidance',
        message: 'Career advice and guidance',
      });

      // Create referral
      const job = await Job.create({
        title: 'Software Engineer',
        company: 'Google',
        description: 'Full-stack role',
        postedBy: alumni1._id,
        status: 'open',
        location: 'Remote',
        jobType: 'full_time',
        workplaceType: 'remote',
        experienceLevel: 'mid',
        applicationUrl: 'https://careers.google.com/jobs/123',
        requirements: ['TypeScript', 'Node.js', 'React'],
      });
      await ReferralRequest.create({
        job: job._id,
        jobPoster: alumni1._id,
        applicant: student1._id,
        status: 'pending',
        message: 'Referral please',
        resumeIncluded: false,
      });

      // Create connection
      const { participantA, participantB } = ConnectionRequest.getCanonicalParticipants(student1._id, alumni1._id);
      await ConnectionRequest.create({
        requester: student1._id,
        recipient: alumni1._id,
        participantA,
        participantB,
        status: 'accepted',
      });

      // Create event with RSVPs
      await Event.create({
        title: 'Alumni Tech Talk',
        description: 'Annual gathering',
        category: 'networking',
        startDate: new Date(),
        endDate: new Date(Date.now() + 3600000),
        locationType: 'virtual',
        venueOrLink: 'https://meet.google.com',
        organizer: alumni1._id,
        approvalStatus: 'approved',
        rsvps: [
          { user: student1._id, status: 'attending', registeredAt: new Date() },
          { user: student2._id, status: 'cancelled', registeredAt: new Date() },
        ],
      });

      // Create conversation and message
      const conv = await Conversation.create({
        participantA,
        participantB,
      });
      await Message.create({
        conversation: conv._id,
        sender: student1._id,
        recipient: alumni1._id,
        content: 'Hello mentor!',
      });

      const res = await request(app)
        .get('/api/v1/admin/analytics/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;

      // User metrics
      expect(data.users.total).toBe(5); // admin + 2 students + 2 alumni
      expect(data.users.verifiedAlumni).toBe(1);
      expect(data.users.verifiedStudents).toBe(1);
      expect(data.users.pendingVerification).toBe(1);
      expect(data.users.suspended).toBe(1);
      expect(data.users.byRole.student).toBe(2);
      expect(data.users.byRole.alumni).toBe(2);
      expect(data.users.byRole.admin).toBe(1);

      // Module metrics
      expect(data.modules.mentorship.total).toBe(1);
      expect(data.modules.mentorship.accepted).toBe(1);
      expect(data.modules.referrals.total).toBe(1);
      expect(data.modules.referrals.pending).toBe(1);
      expect(data.modules.connections.totalAccepted).toBe(1);
      expect(data.modules.jobs.total).toBe(1);
      expect(data.modules.jobs.open).toBe(1);
      expect(data.modules.events.total).toBe(1);
      expect(data.modules.events.totalRsvps).toBe(1); // Only 'attending' RSVP
      expect(data.modules.messaging.totalConversations).toBe(1);
      expect(data.modules.messaging.totalMessages).toBe(1);

      // Distributions
      expect(data.distributions.topDepartments.length).toBeGreaterThan(0);
      expect(data.distributions.topCompanies.length).toBeGreaterThan(0);
      expect(data.distributions.topCompanies[0].name).toBe('Google');
    });

    it('returns cleanly formatted default zeros for empty database', async () => {
      const { token } = await createTestUser({ role: 'admin' });
      await User.deleteMany({ role: { $ne: 'admin' } });

      const res = await request(app)
        .get('/api/v1/admin/analytics/overview')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.modules.mentorship.total).toBe(0);
      expect(res.body.data.modules.referrals.total).toBe(0);
      expect(res.body.data.modules.events.totalRsvps).toBe(0);
    });
  });

  // ── 3. Activity Timeline Analytics ─────────────────────────────────────────
  describe('3. Activity Timeline Analytics', () => {
    it('returns daily timeline array for default 30 days', async () => {
      const { token } = await createTestUser({ role: 'admin' });

      const res = await request(app)
        .get('/api/v1/admin/analytics/activity')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.days).toBe(30);
      expect(Array.isArray(res.body.data.timeline)).toBe(true);
      expect(res.body.data.timeline.length).toBe(30);
      expect(res.body.data.timeline[0]).toHaveProperty('date');
      expect(res.body.data.timeline[0]).toHaveProperty('newUsers');
      expect(res.body.data.timeline[0]).toHaveProperty('newConnections');
      expect(res.body.data.timeline[0]).toHaveProperty('messagesSent');
    });

    it('accepts valid custom days parameter (e.g., 7 and 90)', async () => {
      const { token } = await createTestUser({ role: 'admin' });

      const res7 = await request(app)
        .get('/api/v1/admin/analytics/activity?days=7')
        .set('Authorization', `Bearer ${token}`);
      expect(res7.status).toBe(200);
      expect(res7.body.data.timeline.length).toBe(7);

      const res90 = await request(app)
        .get('/api/v1/admin/analytics/activity?days=90')
        .set('Authorization', `Bearer ${token}`);
      expect(res90.status).toBe(200);
      expect(res90.body.data.timeline.length).toBe(90);
    });

    it('rejects invalid days parameter (>90 or <=0 or string)', async () => {
      const { token } = await createTestUser({ role: 'admin' });

      const resOver = await request(app)
        .get('/api/v1/admin/analytics/activity?days=91')
        .set('Authorization', `Bearer ${token}`);
      expect(resOver.status).toBe(400);

      const resZero = await request(app)
        .get('/api/v1/admin/analytics/activity?days=0')
        .set('Authorization', `Bearer ${token}`);
      expect(resZero.status).toBe(400);

      const resAlpha = await request(app)
        .get('/api/v1/admin/analytics/activity?days=invalid')
        .set('Authorization', `Bearer ${token}`);
      expect(resAlpha.status).toBe(400);
    });
  });

  // ── 4. Safe Bulk User Governance ───────────────────────────────────────────
  describe('4. Safe Bulk User Governance (Approve, Reject, Suspend, Reactivate)', () => {
    it('bulk approves pending users and writes individual audit logs', async () => {
      const { user: admin, token } = await createTestUser({ role: 'admin' });
      const { user: u1 } = await createTestUser({ verificationStatus: 'pending' });
      const { user: u2 } = await createTestUser({ verificationStatus: 'pending' });

      const res = await request(app)
        .post('/api/v1/admin/users/bulk-action')
        .set('Authorization', `Bearer ${token}`)
        .send({
          action: 'approve',
          userIds: [u1._id.toString(), u2._id.toString()],
          reason: 'Batch graduation review',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.action).toBe('approve');
      expect(res.body.data.processed).toBe(2);
      expect(res.body.data.succeeded).toContain(u1._id.toString());
      expect(res.body.data.succeeded).toContain(u2._id.toString());
      expect(res.body.data.failed.length).toBe(0);

      // Verify DB state
      const updatedU1 = await User.findById(u1._id);
      expect(updatedU1!.verificationStatus).toBe('admin_approved');

      // Verify audit logs
      const auditLogs = await AdminAuditLog.find({ action: 'user.bulk_approve' });
      expect(auditLogs.length).toBe(2);
      expect(auditLogs[0].admin.toString()).toBe(admin._id.toString());
    });

    it('bulk rejects users with mandatory reason and writes audit logs', async () => {
      const { token } = await createTestUser({ role: 'admin' });
      const { user: u1 } = await createTestUser({ verificationStatus: 'pending' });

      const res = await request(app)
        .post('/api/v1/admin/users/bulk-action')
        .set('Authorization', `Bearer ${token}`)
        .send({
          action: 'reject',
          userIds: [u1._id.toString()],
          reason: 'Incomplete student credential documentation',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.succeeded).toContain(u1._id.toString());

      const updated = await User.findById(u1._id);
      expect(updated!.verificationStatus).toBe('rejected');
    });

    it('rejects bulk reject/suspend when reason is omitted or empty', async () => {
      const { token } = await createTestUser({ role: 'admin' });
      const { user: u1 } = await createTestUser();

      const res = await request(app)
        .post('/api/v1/admin/users/bulk-action')
        .set('Authorization', `Bearer ${token}`)
        .send({
          action: 'suspend',
          userIds: [u1._id.toString()],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('enforces maximum 50 users batch limit', async () => {
      const { token } = await createTestUser({ role: 'admin' });
      const fakeIds = Array.from({ length: 51 }, () => new mongoose.Types.ObjectId().toString());

      const res = await request(app)
        .post('/api/v1/admin/users/bulk-action')
        .set('Authorization', `Bearer ${token}`)
        .send({
          action: 'approve',
          userIds: fakeIds,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/50/);
    });

    it('handles mixed valid and invalid targets with partial-success reporting', async () => {
      const { token } = await createTestUser({ role: 'admin' });
      const { user: realUser } = await createTestUser({ verificationStatus: 'pending' });
      const fakeId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .post('/api/v1/admin/users/bulk-action')
        .set('Authorization', `Bearer ${token}`)
        .send({
          action: 'approve',
          userIds: [realUser._id.toString(), fakeId],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.succeeded).toEqual([realUser._id.toString()]);
      expect(res.body.data.failed.length).toBe(1);
      expect(res.body.data.failed[0].id).toBe(fakeId);
      expect(res.body.data.failed[0].reason).toBe('User not found.');
    });

    it('deduplicates duplicate IDs in request', async () => {
      const { token } = await createTestUser({ role: 'admin' });
      const { user: u1 } = await createTestUser({ verificationStatus: 'pending' });

      const res = await request(app)
        .post('/api/v1/admin/users/bulk-action')
        .set('Authorization', `Bearer ${token}`)
        .send({
          action: 'approve',
          userIds: [u1._id.toString(), u1._id.toString()],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.processed).toBe(1);
      expect(res.body.data.succeeded.length).toBe(1);
    });
  });

  // ── 5. Invariants: Self-Action & Last Admin Protection ───────────────────────
  describe('5. Self-Action & Last Admin Protection Invariants', () => {
    it('prevents administrator from self-suspending via bulk action', async () => {
      const { user: admin, token } = await createTestUser({ role: 'admin', name: 'My Admin' });
      const { user: otherUser } = await createTestUser({ role: 'student' });

      const res = await request(app)
        .post('/api/v1/admin/users/bulk-action')
        .set('Authorization', `Bearer ${token}`)
        .send({
          action: 'suspend',
          userIds: [admin._id.toString(), otherUser._id.toString()],
          reason: 'Terms violation',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.succeeded).toContain(otherUser._id.toString());
      expect(res.body.data.failed.length).toBe(1);
      expect(res.body.data.failed[0].id).toBe(admin._id.toString());
      expect(res.body.data.failed[0].reason).toMatch(/own account/i);

      // Admin account status must still be active
      const refreshedAdmin = await User.findById(admin._id);
      expect(refreshedAdmin!.accountStatus).toBe('active');
    });

    it('prevents suspending the last active administrator', async () => {
      const { user: callerAdmin, token: callerToken } = await createTestUser({ role: 'admin', name: 'Admin Caller' });
      const { user: onlyOtherAdmin } = await createTestUser({ role: 'admin', name: 'Other Admin' });

      // First suspend callerAdmin directly to leave onlyOtherAdmin as the sole active admin
      await User.findByIdAndUpdate(callerAdmin._id, { accountStatus: 'suspended' });
      // Restore caller admin token so we can make request on behalf of a second admin
      await User.findByIdAndUpdate(callerAdmin._id, { accountStatus: 'active' });
      await User.findByIdAndUpdate(callerAdmin._id, { role: 'student' }); // Caller is now student? No, caller must be admin.

      // Reset: we have 1 active admin (callerAdmin) and we try to suspend a second admin target which is the only other active admin
      await User.deleteMany({});
      const { user: admin1, token: token1 } = await createTestUser({ role: 'admin', name: 'Admin 1' });
      const { user: admin2 } = await createTestUser({ role: 'admin', name: 'Admin 2' });

      // There are 2 active admins (admin1, admin2). admin1 tries to suspend admin2 -> succeeds (1 admin remains)
      const res1 = await request(app)
        .post('/api/v1/admin/users/bulk-action')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          action: 'suspend',
          userIds: [admin2._id.toString()],
          reason: 'Policy violation',
        });
      expect(res1.status).toBe(200);
      expect(res1.body.data.succeeded).toContain(admin2._id.toString());

      // Now only admin1 is active. If admin1 tries to suspend another admin or if another request attempts to suspend admin1:
      const { user: admin3 } = await createTestUser({ role: 'admin', accountStatus: 'suspended' }); // inactive admin
      const res2 = await request(app)
        .post('/api/v1/admin/users/bulk-action')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          action: 'suspend',
          userIds: [admin1._id.toString()],
          reason: 'Self suspend test',
        });
      expect(res2.body.data.failed.length).toBe(1);
    });

    it('protects last active admin from being suspended when it is the sole active admin', async () => {
      const { user: admin1, token: token1 } = await createTestUser({ role: 'admin' });
      const { user: admin2, token: token2 } = await createTestUser({ role: 'admin' });

      // Suspend admin1 so admin2 is the sole active admin
      await User.findByIdAndUpdate(admin1._id, { accountStatus: 'suspended' });

      // admin2 attempts to suspend admin2 (self) -> blocked by self-action
      // If someone attempts to suspend admin2 -> blocked because total active admins is 1
      const res = await request(app)
        .post('/api/v1/admin/users/bulk-action')
        .set('Authorization', `Bearer ${token2}`)
        .send({
          action: 'suspend',
          userIds: [admin2._id.toString()],
          reason: 'Suspension',
        });

      expect(res.body.data.failed.length).toBe(1);
      const targetAdmin = await User.findById(admin2._id);
      expect(targetAdmin!.accountStatus).toBe('active');
    });

    it('bulk reactivates suspended users cleanly', async () => {
      const { token } = await createTestUser({ role: 'admin' });
      const { user: u1 } = await createTestUser({ accountStatus: 'suspended' });
      const { user: u2 } = await createTestUser({ accountStatus: 'suspended' });

      const res = await request(app)
        .post('/api/v1/admin/users/bulk-action')
        .set('Authorization', `Bearer ${token}`)
        .send({
          action: 'reactivate',
          userIds: [u1._id.toString(), u2._id.toString()],
          reason: 'Appeals approved',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.succeeded).toContain(u1._id.toString());
      expect(res.body.data.succeeded).toContain(u2._id.toString());

      const refreshedU1 = await User.findById(u1._id);
      expect(refreshedU1!.accountStatus).toBe('active');
    });

    it('handles concurrent bulk operations safely without leaving zero active admins', async () => {
      const { user: admin1, token: token1 } = await createTestUser({ role: 'admin', name: 'Admin 1' });
      const { user: admin2, token: token2 } = await createTestUser({ role: 'admin', name: 'Admin 2' });

      // Both admin1 and admin2 simultaneously attempt to suspend the other admin
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/v1/admin/users/bulk-action')
          .set('Authorization', `Bearer ${token1}`)
          .send({ action: 'suspend', userIds: [admin2._id.toString()], reason: 'Race test' }),
        request(app)
          .post('/api/v1/admin/users/bulk-action')
          .set('Authorization', `Bearer ${token2}`)
          .send({ action: 'suspend', userIds: [admin1._id.toString()], reason: 'Race test' }),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const activeAdminsCount = await User.countDocuments({ role: 'admin', accountStatus: 'active' });
      // At least 1 admin MUST remain active
      expect(activeAdminsCount).toBeGreaterThanOrEqual(1);
    });
  });
});
