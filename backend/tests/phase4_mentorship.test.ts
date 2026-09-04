import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app';
import User from '../src/models/User';
import MentorshipRequest from '../src/models/MentorshipRequest';
import { signAccessToken } from '../src/utils/auth';

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
  await MentorshipRequest.deleteMany({});
});

describe('Phase 4C: Mentorship Network Test Suite', () => {
  // Helper to create test users
  async function createTestUser(overrides: any = {}) {
    const user = await User.create({
      name: overrides.name || 'Test User',
      email: overrides.email || `user_${Date.now()}_${Math.random()}@college.edu`,
      passwordHash: 'dummyhash123',
      role: overrides.role || 'alumni',
      accountStatus: overrides.accountStatus || 'active',
      verificationStatus: overrides.verificationStatus || 'admin_approved',
      department: overrides.department || 'Computer Science',
      company: overrides.company || 'Tech Corp',
      designation: overrides.designation || 'Staff Engineer',
      skills: overrides.skills || ['Node.js', 'System Design'],
      mentorshipEnabled: overrides.mentorshipEnabled !== undefined ? overrides.mentorshipEnabled : true,
      batch: overrides.batch || '2020',
      ...overrides,
    });
    const token = signAccessToken({ userId: user._id.toString(), role: user.role });
    return { user, token };
  }

  describe('1. Mentor Discovery (GET /api/v1/mentorship/mentors)', () => {
    it('unauthenticated request is rejected with 401', async () => {
      const res = await request(app).get('/api/v1/mentorship/mentors');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('NOT_AUTHENTICATED');
    });

    it('only eligible alumni with all four §1 conditions appear in the mentor directory', async () => {
      // 1. Fully eligible mentor
      const { user: eligibleMentor } = await createTestUser({
        name: 'Eligible Mentor',
        role: 'alumni',
        verificationStatus: 'admin_approved',
        accountStatus: 'active',
        mentorshipEnabled: true,
      });

      // 2. Alumni with mentorshipEnabled: false
      await createTestUser({
        name: 'Opted-Out Alumni',
        role: 'alumni',
        verificationStatus: 'admin_approved',
        accountStatus: 'active',
        mentorshipEnabled: false,
      });

      // 3. Alumni with pending verification
      await createTestUser({
        name: 'Pending Alumni',
        role: 'alumni',
        verificationStatus: 'pending',
        accountStatus: 'active',
        mentorshipEnabled: true,
      });

      // 4. Alumni with suspended account
      await createTestUser({
        name: 'Suspended Alumni',
        role: 'alumni',
        verificationStatus: 'admin_approved',
        accountStatus: 'suspended',
        mentorshipEnabled: true,
      });

      // 5. Student with mentorshipEnabled: true (should never appear as mentor)
      await createTestUser({
        name: 'Student User',
        role: 'student',
        verificationStatus: 'email_verified',
        accountStatus: 'active',
        mentorshipEnabled: true,
      });

      const { token: studentToken } = await createTestUser({
        role: 'student',
        verificationStatus: 'email_verified',
      });

      const res = await request(app)
        .get('/api/v1/mentorship/mentors')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mentors.length).toBe(1);
      expect(res.body.data.mentors[0].id).toBe(eligibleMentor._id.toString());
      expect(res.body.data.mentors[0].name).toBe('Eligible Mentor');
      expect(res.body.data.mentors[0].passwordHash).toBeUndefined();
      expect(res.body.data.mentors[0].email).toBeUndefined();
    });

    it('surfaces student requestStatus accurately per mentor', async () => {
      const { user: mentor1 } = await createTestUser({ name: 'Mentor One' });
      const { user: mentor2 } = await createTestUser({ name: 'Mentor Two' });
      const { user: student, token: studentToken } = await createTestUser({
        role: 'student',
        verificationStatus: 'email_verified',
      });

      // Student has pending request with mentor1
      await MentorshipRequest.create({
        student: student._id,
        mentor: mentor1._id,
        topic: 'Career Guidance',
        message: 'Looking for advice on transitioning to cloud architecture.',
        status: 'pending',
      });

      const res = await request(app)
        .get('/api/v1/mentorship/mentors')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      const m1 = res.body.data.mentors.find((m: any) => m.id === mentor1._id.toString());
      const m2 = res.body.data.mentors.find((m: any) => m.id === mentor2._id.toString());

      expect(m1.requestStatus).toBe('pending');
      expect(m2.requestStatus).toBeNull();
    });

    it('filters by department, skills, and search query', async () => {
      await createTestUser({
        name: 'Alice AI',
        department: 'Computer Science',
        skills: ['Python', 'TensorFlow'],
        company: 'DeepMind',
      });
      await createTestUser({
        name: 'Bob Backend',
        department: 'Electrical Engineering',
        skills: ['Java', 'Spring'],
        company: 'Oracle',
      });

      const { token } = await createTestUser({ role: 'student', verificationStatus: 'email_verified' });

      // Search
      const searchRes = await request(app)
        .get('/api/v1/mentorship/mentors?search=DeepMind')
        .set('Authorization', `Bearer ${token}`);
      expect(searchRes.body.data.mentors.length).toBe(1);
      expect(searchRes.body.data.mentors[0].name).toBe('Alice AI');

      // Department filter
      const deptRes = await request(app)
        .get('/api/v1/mentorship/mentors?department=Electrical+Engineering')
        .set('Authorization', `Bearer ${token}`);
      expect(deptRes.body.data.mentors.length).toBe(1);
      expect(deptRes.body.data.mentors[0].name).toBe('Bob Backend');

      // Skills filter
      const skillRes = await request(app)
        .get('/api/v1/mentorship/mentors?skills=TensorFlow')
        .set('Authorization', `Bearer ${token}`);
      expect(skillRes.body.data.mentors.length).toBe(1);
      expect(skillRes.body.data.mentors[0].name).toBe('Alice AI');
    });
  });

  describe('2. Mentorship Request Creation (POST /api/v1/mentorship/requests)', () => {
    it('unauthenticated caller gets 401', async () => {
      const res = await request(app).post('/api/v1/mentorship/requests').send({
        mentor: new mongoose.Types.ObjectId().toString(),
        topic: 'Help with interview',
        message: 'Can we meet to discuss system design interviews?',
      });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('NOT_AUTHENTICATED');
    });

    it('unverified student gets 403 NOT_VERIFIED', async () => {
      const { user: mentor } = await createTestUser({ name: 'Valid Mentor' });
      const { token: unverifiedStudentToken } = await createTestUser({
        role: 'student',
        verificationStatus: 'pending',
      });

      const res = await request(app)
        .post('/api/v1/mentorship/requests')
        .set('Authorization', `Bearer ${unverifiedStudentToken}`)
        .send({
          mentor: mentor._id.toString(),
          topic: 'Mock Interview',
          message: 'Would love a 30-minute mock interview.',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('NOT_VERIFIED');
    });

    it('alumni cannot create a mentorship request (403 FORBIDDEN_ROLE)', async () => {
      const { user: mentor } = await createTestUser({ name: 'Valid Mentor' });
      const { token: alumniToken } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });

      const res = await request(app)
        .post('/api/v1/mentorship/requests')
        .set('Authorization', `Bearer ${alumniToken}`)
        .send({
          mentor: mentor._id.toString(),
          topic: 'Alumni Request',
          message: 'Can I request mentorship as alumni?',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('nonexistent mentor returns 404 NOT_FOUND', async () => {
      const { token: studentToken } = await createTestUser({
        role: 'student',
        verificationStatus: 'email_verified',
      });
      const fakeId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .post('/api/v1/mentorship/requests')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          mentor: fakeId,
          topic: 'Career Advice',
          message: 'Looking for advice on frontend careers.',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('ineligible mentor (e.g. mentorshipEnabled: false) returns 403 NOT_MENTOR_ELIGIBLE', async () => {
      const { user: optedOutMentor } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
        mentorshipEnabled: false,
      });
      const { token: studentToken } = await createTestUser({
        role: 'student',
        verificationStatus: 'email_verified',
      });

      const res = await request(app)
        .post('/api/v1/mentorship/requests')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          mentor: optedOutMentor._id.toString(),
          topic: 'Career Advice',
          message: 'Looking for advice on frontend careers.',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('NOT_MENTOR_ELIGIBLE');
    });

    it('self-mentorship returns 400 SELF_MENTORSHIP', async () => {
      const { user: student, token: studentToken } = await createTestUser({
        role: 'student',
        verificationStatus: 'email_verified',
      });

      const res = await request(app)
        .post('/api/v1/mentorship/requests')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          mentor: student._id.toString(),
          topic: 'Self mentorship',
          message: 'Mentoring myself.',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SELF_MENTORSHIP');
    });

    it('valid mentorship request succeeds with status: pending and server-assigned student', async () => {
      const { user: mentor } = await createTestUser({ name: 'Senior Mentor' });
      const { user: student, token: studentToken } = await createTestUser({
        role: 'student',
        verificationStatus: 'email_verified',
      });

      const res = await request(app)
        .post('/api/v1/mentorship/requests')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          mentor: mentor._id.toString(),
          topic: 'Resume Review',
          message: 'Could you please review my software engineering resume?',
          scheduledDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.request.status).toBe('pending');
      expect(res.body.data.request.student.id).toBe(student._id.toString());
      expect(res.body.data.request.mentor.id).toBe(mentor._id.toString());
      expect(res.body.data.request.topic).toBe('Resume Review');
    });

    it('duplicate active request to the same mentor returns 409 DUPLICATE_MENTORSHIP_REQUEST', async () => {
      const { user: mentor } = await createTestUser({ name: 'Senior Mentor' });
      const { token: studentToken } = await createTestUser({
        role: 'student',
        verificationStatus: 'email_verified',
      });

      // First request succeeds
      const res1 = await request(app)
        .post('/api/v1/mentorship/requests')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          mentor: mentor._id.toString(),
          topic: 'Resume Review',
          message: 'First mentorship request.',
        });
      expect(res1.status).toBe(201);

      // Duplicate request to same mentor fails
      const res2 = await request(app)
        .post('/api/v1/mentorship/requests')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          mentor: mentor._id.toString(),
          topic: 'Another Topic',
          message: 'Duplicate request message.',
        });
      expect(res2.status).toBe(409);
      expect(res2.body.error.code).toBe('DUPLICATE_MENTORSHIP_REQUEST');
    });

    it('can request a different mentor while one is pending', async () => {
      const { user: mentor1 } = await createTestUser({ name: 'Mentor One' });
      const { user: mentor2 } = await createTestUser({ name: 'Mentor Two' });
      const { token: studentToken } = await createTestUser({
        role: 'student',
        verificationStatus: 'email_verified',
      });

      await request(app)
        .post('/api/v1/mentorship/requests')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          mentor: mentor1._id.toString(),
          topic: 'Topic 1',
          message: 'First mentor message.',
        });

      const res = await request(app)
        .post('/api/v1/mentorship/requests')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          mentor: mentor2._id.toString(),
          topic: 'Topic 2',
          message: 'Second mentor message.',
        });

      expect(res.status).toBe(201);
    });
  });

  describe('3. Visibility & My Requests (GET /api/v1/mentorship/my-requests)', () => {
    it('students see only their sent requests, with notes omitted', async () => {
      const { user: mentor } = await createTestUser({ name: 'Mentor A' });
      const { user: student1, token: student1Token } = await createTestUser({
        role: 'student',
        verificationStatus: 'email_verified',
      });
      const { user: student2 } = await createTestUser({
        role: 'student',
        verificationStatus: 'email_verified',
      });

      // Request 1 by student1
      await MentorshipRequest.create({
        student: student1._id,
        mentor: mentor._id,
        topic: 'Topic for Student 1',
        message: 'Message 1',
        status: 'accepted',
        notes: 'Confidential mentor feedback',
      });

      // Request 2 by student2
      await MentorshipRequest.create({
        student: student2._id,
        mentor: mentor._id,
        topic: 'Topic for Student 2',
        message: 'Message 2',
        status: 'pending',
      });

      const res = await request(app)
        .get('/api/v1/mentorship/my-requests')
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.requests.length).toBe(1);
      expect(res.body.data.requests[0].topic).toBe('Topic for Student 1');
      expect(res.body.data.requests[0].notes).toBeUndefined(); // Notes are mentor-private
    });

    it('mentors see only requests directed to them, with notes included', async () => {
      const { user: mentor1, token: mentor1Token } = await createTestUser({ name: 'Mentor A' });
      const { user: mentor2 } = await createTestUser({ name: 'Mentor B' });
      const { user: student } = await createTestUser({
        role: 'student',
        verificationStatus: 'email_verified',
      });

      await MentorshipRequest.create({
        student: student._id,
        mentor: mentor1._id,
        topic: 'Topic for Mentor 1',
        message: 'Message for Mentor 1',
        status: 'accepted',
        notes: 'Mentor private notes',
      });

      await MentorshipRequest.create({
        student: student._id,
        mentor: mentor2._id,
        topic: 'Topic for Mentor 2',
        message: 'Message for Mentor 2',
        status: 'pending',
      });

      const res = await request(app)
        .get('/api/v1/mentorship/my-requests')
        .set('Authorization', `Bearer ${mentor1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.requests.length).toBe(1);
      expect(res.body.data.requests[0].topic).toBe('Topic for Mentor 1');
      expect(res.body.data.requests[0].notes).toBe('Mentor private notes');
    });
  });

  describe('4. Status Transitions (PATCH /api/v1/mentorship/requests/:id/status)', () => {
    it('mentor can accept a pending request with optional notes and scheduledDate', async () => {
      const { user: mentor, token: mentorToken } = await createTestUser();
      const { user: student } = await createTestUser({
        role: 'student',
        verificationStatus: 'email_verified',
      });

      const reqDoc = await MentorshipRequest.create({
        student: student._id,
        mentor: mentor._id,
        topic: 'Career Discussion',
        message: 'Requesting mentorship',
        status: 'pending',
      });

      const schedule = new Date(Date.now() + 3 * 86400000).toISOString();
      const res = await request(app)
        .patch(`/api/v1/mentorship/requests/${reqDoc._id}/status`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .send({
          status: 'accepted',
          notes: 'Accepted. Looking forward to our call.',
          scheduledDate: schedule,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.request.status).toBe('accepted');
      expect(res.body.data.request.notes).toBe('Accepted. Looking forward to our call.');
    });

    it('mentor can reject a pending request', async () => {
      const { user: mentor, token: mentorToken } = await createTestUser();
      const { user: student } = await createTestUser({
        role: 'student',
        verificationStatus: 'email_verified',
      });

      const reqDoc = await MentorshipRequest.create({
        student: student._id,
        mentor: mentor._id,
        topic: 'Career Discussion',
        message: 'Requesting mentorship',
        status: 'pending',
      });

      const res = await request(app)
        .patch(`/api/v1/mentorship/requests/${reqDoc._id}/status`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .send({
          status: 'rejected',
          notes: 'Unable to take on new mentees this month.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.request.status).toBe('rejected');
    });

    it('mentor can mark an accepted request as completed', async () => {
      const { user: mentor, token: mentorToken } = await createTestUser();
      const { user: student } = await createTestUser({
        role: 'student',
        verificationStatus: 'email_verified',
      });

      const reqDoc = await MentorshipRequest.create({
        student: student._id,
        mentor: mentor._id,
        topic: 'Career Discussion',
        message: 'Requesting mentorship',
        status: 'accepted',
      });

      const res = await request(app)
        .patch(`/api/v1/mentorship/requests/${reqDoc._id}/status`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .send({
          status: 'completed',
          notes: 'Completed 1-on-1 mentorship session.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.request.status).toBe('completed');
    });

    it('invalid status transitions are rejected with 400 INVALID_STATUS_TRANSITION', async () => {
      const { user: mentor, token: mentorToken } = await createTestUser();
      const { user: student } = await createTestUser({
        role: 'student',
        verificationStatus: 'email_verified',
      });

      // 1. pending -> completed (invalid)
      const pendingDoc = await MentorshipRequest.create({
        student: student._id,
        mentor: mentor._id,
        topic: 'T1',
        message: 'M1',
        status: 'pending',
      });

      const res1 = await request(app)
        .patch(`/api/v1/mentorship/requests/${pendingDoc._id}/status`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .send({ status: 'completed' });
      expect(res1.status).toBe(400);
      expect(res1.body.error.code).toBe('INVALID_STATUS_TRANSITION');

      // 2. rejected -> accepted (invalid)
      const rejectedDoc = await MentorshipRequest.create({
        student: student._id,
        mentor: mentor._id,
        topic: 'T2',
        message: 'M2',
        status: 'rejected',
      });

      const res2 = await request(app)
        .patch(`/api/v1/mentorship/requests/${rejectedDoc._id}/status`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .send({ status: 'accepted' });
      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('student attempting any status transition receives 403 FORBIDDEN_ROLE', async () => {
      const { user: mentor } = await createTestUser();
      const { user: student, token: studentToken } = await createTestUser({
        role: 'student',
        verificationStatus: 'email_verified',
      });

      const reqDoc = await MentorshipRequest.create({
        student: student._id,
        mentor: mentor._id,
        topic: 'Career Advice',
        message: 'Request',
        status: 'pending',
      });

      const res = await request(app)
        .patch(`/api/v1/mentorship/requests/${reqDoc._id}/status`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ status: 'accepted' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('different alumni attempting transition receives 403 FORBIDDEN_OWNERSHIP', async () => {
      const { user: mentor } = await createTestUser({ name: 'Assigned Mentor' });
      const { token: otherAlumniToken } = await createTestUser({ name: 'Unrelated Alumni' });
      const { user: student } = await createTestUser({
        role: 'student',
        verificationStatus: 'email_verified',
      });

      const reqDoc = await MentorshipRequest.create({
        student: student._id,
        mentor: mentor._id,
        topic: 'Career Advice',
        message: 'Request',
        status: 'pending',
      });

      const res = await request(app)
        .patch(`/api/v1/mentorship/requests/${reqDoc._id}/status`)
        .set('Authorization', `Bearer ${otherAlumniToken}`)
        .send({ status: 'accepted' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_OWNERSHIP');
    });
  });
});
