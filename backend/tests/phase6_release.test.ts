import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app';
import User from '../src/models/User';
import Job from '../src/models/Job';
import Event from '../src/models/Event';
import MentorshipRequest from '../src/models/MentorshipRequest';
import ReferralRequest from '../src/models/ReferralRequest';
import ConnectionRequest from '../src/models/ConnectionRequest';
import Conversation from '../src/models/Conversation';
import Message from '../src/models/Message';
import AdminAuditLog from '../src/models/AdminAuditLog';
import { signAccessToken } from '../src/utils/auth';
import { validateStartupConfig } from '../src/config/env';

jest.setTimeout(35000);

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  await User.syncIndexes();
  await ConnectionRequest.syncIndexes();
  await ReferralRequest.syncIndexes();
  await MentorshipRequest.syncIndexes();
  await Conversation.syncIndexes();
  await Message.syncIndexes();
  await AdminAuditLog.syncIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Job.deleteMany({});
  await Event.deleteMany({});
  await MentorshipRequest.deleteMany({});
  await ReferralRequest.deleteMany({});
  await ConnectionRequest.deleteMany({});
  await Conversation.deleteMany({});
  await Message.deleteMany({});
  await AdminAuditLog.deleteMany({});
});

describe('Phase 6: Release Readiness, Resilience & Cross-Module QA Suite', () => {
  async function createTestUser(overrides: any = {}) {
    return await User.create({
      name: overrides.name || 'Test User',
      email: overrides.email || `user_${Date.now()}_${Math.random()}@college.edu`,
      passwordHash: 'dummy_hashed_password',
      role: overrides.role || 'student',
      accountStatus: overrides.accountStatus || 'active',
      verificationStatus: overrides.verificationStatus || 'admin_approved',
      department: overrides.department || 'Computer Science',
      company: overrides.company || 'Tech Innovators',
      designation: overrides.designation || 'Software Engineer',
      batch: overrides.batch || 2023,
      mentorshipEnabled: overrides.mentorshipEnabled ?? true,
      ...overrides,
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Environment Startup & Configuration Hardening
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Environment Startup & Configuration Hardening', () => {
    it('validates required production environment settings successfully', () => {
      const result = validateStartupConfig();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('health endpoint returns 200 OK without requiring authentication', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ok');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Cross-Module Student Journey
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Cross-Module Student Journey (Register -> Verify -> Network -> Message -> Job -> Referral)', () => {
    it('executes full student lifecycle across interdependent modules', async () => {
      // Step A: Register student
      const student = await createTestUser({
        name: 'Alice Student',
        email: 'alice.student@college.edu',
        role: 'student',
        verificationStatus: 'admin_approved',
      });
      const studentToken = signAccessToken({
        userId: student._id.toString(),
        role: 'student',
      });

      // Step B: View own profile
      const meRes = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(meRes.status).toBe(200);
      expect(meRes.body.data.user.name).toBe('Alice Student');
      expect(meRes.body.data.user.passwordHash).toBeUndefined();

      // Step C: Discover alumni mentor
      const alumni = await createTestUser({
        name: 'Bob Alumni',
        email: 'bob.alumni@college.edu',
        role: 'alumni',
        verificationStatus: 'admin_approved',
        mentorshipEnabled: true,
      });
      const alumniToken = signAccessToken({
        userId: alumni._id.toString(),
        role: 'alumni',
      });

      // Step D: Send professional connection request
      const connRes = await request(app)
        .post('/api/v1/connections')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          recipientId: alumni._id.toString(),
          note: 'Hello Bob, I would love to connect with an alum working at Tech Innovators.',
        });
      expect(connRes.status).toBe(201);
      const connId = connRes.body.data.connection._id || connRes.body.data.connection.id;

      // Step E: Alumni accepts connection request
      const acceptRes = await request(app)
        .patch(`/api/v1/connections/${connId}/status`)
        .set('Authorization', `Bearer ${alumniToken}`)
        .send({ status: 'accepted' });
      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.data.connection.status).toBe('accepted');

      // Step F: Start conversation & send message between connected users
      const convRes = await request(app)
        .post('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          recipientId: alumni._id.toString(),
          initialMessage: 'Thanks for connecting Bob! Looking forward to chatting.',
        });
      expect(convRes.status).toBe(201);
      const convId = convRes.body.data.conversation.id;

      // Alumni replies in the conversation
      const msgRes = await request(app)
        .post(`/api/v1/messaging/conversations/${convId}/messages`)
        .set('Authorization', `Bearer ${alumniToken}`)
        .send({ content: 'Glad to connect Alice, how can I help?' });
      expect(msgRes.status).toBe(201);
      expect(msgRes.body.data.message.content).toBe('Glad to connect Alice, how can I help?');

      // Step G: Alumni posts open job with referralAvailable = true
      const job = await Job.create({
        title: 'Junior Software Engineer',
        company: 'Tech Innovators',
        location: 'Remote',
        description: 'Great entry level role for new graduates.',
        jobType: 'full_time',
        workplaceType: 'remote',
        experienceLevel: 'entry',
        applicationUrl: 'https://example.com/careers/jr-eng',
        requirements: ['TypeScript', 'Node.js', 'React'],
        referralAvailable: true,
        status: 'open',
        postedBy: alumni._id,
      });

      // Step H: Student requests referral for the job
      const refRes = await request(app)
        .post('/api/v1/referrals')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          jobId: job._id.toString(),
          message: 'Hi Bob, I am very interested in this Junior Software Engineer opening.',
          resumeIncluded: false,
        });
      expect(refRes.status).toBe(201);
      expect(refRes.body.data.referral.status).toBe('pending');
      expect(refRes.body.data.referral.job).toBe(job._id.toString());
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Cross-Module Alumni Journey
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Cross-Module Alumni Journey (Mentorship Pairing -> Request Management -> Job Moderation)', () => {
    it('executes alumni mentorship and opportunity workflow', async () => {
      const alumni = await createTestUser({
        name: 'Carol Alumni',
        email: 'carol.alumni@college.edu',
        role: 'alumni',
        verificationStatus: 'admin_approved',
        mentorshipEnabled: true,
      });
      const alumniToken = signAccessToken({
        userId: alumni._id.toString(),
        role: 'alumni',
      });

      const student = await createTestUser({
        name: 'David Student',
        email: 'david.student@college.edu',
        role: 'student',
        verificationStatus: 'admin_approved',
      });
      const studentToken = signAccessToken({
        userId: student._id.toString(),
        role: 'student',
      });

      // Student submits mentorship request
      const mentorReqRes = await request(app)
        .post('/api/v1/mentorship/requests')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          mentor: alumni._id.toString(),
          topic: 'Career Guidance in Cloud Architecture',
          message: 'I would love some mentorship regarding distributed systems careers.',
        });
      expect(mentorReqRes.status).toBe(201);
      const reqId = mentorReqRes.body.data.request.id;

      // Alumni accepts mentorship request
      const acceptRes = await request(app)
        .patch(`/api/v1/mentorship/requests/${reqId}/status`)
        .set('Authorization', `Bearer ${alumniToken}`)
        .send({
          status: 'accepted',
          notes: 'Happy to mentor you David! Let us connect.',
        });
      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.data.request.status).toBe('accepted');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Cross-Module Admin Governance Journey
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Cross-Module Admin Governance Journey', () => {
    it('admin performs bulk governance and reviews operations analytics', async () => {
      const admin = await createTestUser({
        name: 'Admin Chief',
        email: 'admin.chief@college.edu',
        role: 'admin',
        verificationStatus: 'admin_approved',
      });
      const adminToken = signAccessToken({
        userId: admin._id.toString(),
        role: 'admin',
      });

      // Create users for bulk governance
      const target1 = await createTestUser({ name: 'Pending User 1', verificationStatus: 'pending' });
      const target2 = await createTestUser({ name: 'Pending User 2', verificationStatus: 'pending' });

      // Admin executes bulk approval
      const bulkRes = await request(app)
        .post('/api/v1/admin/users/bulk-action')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'approve',
          userIds: [target1._id.toString(), target2._id.toString()],
        });
      expect(bulkRes.status).toBe(200);
      expect(bulkRes.body.data.succeeded).toHaveLength(2);

      // Verify audit logs were created deterministically
      const auditCount = await AdminAuditLog.countDocuments({
        action: 'user.bulk_approve',
      });
      expect(auditCount).toBe(2);

      // Verify operations analytics overview
      const analyticsRes = await request(app)
        .get('/api/v1/admin/analytics/overview')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(analyticsRes.status).toBe(200);
      expect(analyticsRes.body.data.users.total).toBe(3); // 1 admin + 2 approved users

      // Verify activity timeline analytics
      const activityRes = await request(app)
        .get('/api/v1/admin/analytics/activity?days=30')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(activityRes.status).toBe(200);
      expect(activityRes.body.data.timeline).toHaveLength(30);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Security & Negative Boundary Tests
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Security & Negative Boundary Enforcement', () => {
    it('blocks suspended accounts from accessing protected API endpoints with 403', async () => {
      const suspendedUser = await createTestUser({
        name: 'Suspended Member',
        accountStatus: 'suspended',
      });
      const suspendedToken = signAccessToken({
        userId: suspendedUser._id.toString(),
        role: 'student',
      });

      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${suspendedToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
    });

    it('rejects self-connection attempts with 400', async () => {
      const user = await createTestUser();
      const token = signAccessToken({
        userId: user._id.toString(),
        role: 'student',
      });

      const res = await request(app)
        .post('/api/v1/connections')
        .set('Authorization', `Bearer ${token}`)
        .send({
          recipientId: user._id.toString(),
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SELF_CONNECTION_FORBIDDEN');
    });

    it('rejects duplicate active connection requests with 409', async () => {
      const userA = await createTestUser({ email: 'ua@college.edu' });
      const userB = await createTestUser({ email: 'ub@college.edu' });
      const tokenA = signAccessToken({ userId: userA._id.toString(), role: 'student' });

      // First connection request
      const first = await request(app)
        .post('/api/v1/connections')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ recipientId: userB._id.toString() });
      expect(first.status).toBe(201);

      // Second connection request (same direction)
      const duplicate = await request(app)
        .post('/api/v1/connections')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ recipientId: userB._id.toString() });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.error.code).toBe('DUPLICATE_CONNECTION_REQUEST');
    });

    it('hides resume existence on unauthorized download attempts by returning uniform 404', async () => {
      const userWithResume = await createTestUser({
        email: 'resumeman@college.edu',
        resume: {
          originalName: 'secret_resume.pdf',
          storagePath: 'uploads_private/secret_resume.pdf',
          mimeType: 'application/pdf',
          size: 1024,
          uploadedAt: new Date(),
        },
      });

      const stranger = await createTestUser({ email: 'stranger@college.edu' });
      const strangerToken = signAccessToken({ userId: stranger._id.toString(), role: 'student' });

      const res = await request(app)
        .get(`/api/v1/users/${userWithResume._id}/resume`)
        .set('Authorization', `Bearer ${strangerToken}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RESUME_NOT_FOUND');
    });

    it('handles invalid MongoDB ObjectIds cleanly without generating 500 errors', async () => {
      const res = await request(app)
        .get('/api/v1/alumni/not-a-valid-object-id');
      expect([400, 404]).toContain(res.status);
      expect(res.status).not.toBe(500);
    });

    it('never leaks passwordHash or sensitive tokens in user payloads', async () => {
      const user = await createTestUser({
        passwordHash: 'secret_argon_hash_123',
        verificationTokenHash: 'verification_secret_hash',
      });
      const token = signAccessToken({ userId: user._id.toString(), role: 'student' });

      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.user.verificationTokenHash).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('secret_argon_hash_123');
    });
  });
});
