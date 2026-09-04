import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app';
import User from '../src/models/User';
import Event from '../src/models/Event';
import Job from '../src/models/Job';
import MentorshipRequest from '../src/models/MentorshipRequest';
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
  await Event.deleteMany({});
  await Job.deleteMany({});
  await MentorshipRequest.deleteMany({});
  await AdminAuditLog.deleteMany({});
});

describe('Phase 4E: Final Integration & Hardening Verification Suite', () => {
  async function createTestUser(overrides: any = {}) {
    const user = await User.create({
      name: overrides.name || 'Integration User',
      email: overrides.email || `user_${Date.now()}_${Math.random().toString(36).substring(7)}@college.edu`,
      passwordHash: 'hashed_pw',
      role: overrides.role || 'student',
      accountStatus: overrides.accountStatus || 'active',
      verificationStatus: overrides.verificationStatus || 'email_verified',
      department: overrides.department || 'Computer Science',
      batch: overrides.batch || '2024',
      company: overrides.company,
      designation: overrides.designation,
      institution: overrides.institution || 'Tech Institute',
      mentorshipEnabled: overrides.mentorshipEnabled !== undefined ? overrides.mentorshipEnabled : false,
      skills: overrides.skills || ['JavaScript', 'TypeScript'],
      links: overrides.links || {},
    });
    const token = signAccessToken({ userId: user._id.toString(), role: user.role });
    return { user, token };
  }

  // ── 1. Suspension Propagation Across All Modules ─────────────────────────────
  describe('1. Centralized Suspension Propagation Across All Modules', () => {
    it('blocks suspended users across auth, profile, events, jobs, mentorship, and admin', async () => {
      // Create admin to suspend target user
      const { user: admin, token: adminToken } = await createTestUser({
        role: 'admin',
        verificationStatus: 'admin_approved',
      });

      // Create an active, verified alumni
      const { user: alumni, token: alumniToken } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
        mentorshipEnabled: true,
      });

      // Create an active event for RSVP test
      const event = await Event.create({
        title: 'Tech Summit',
        description: 'Annual gathering.',
        category: 'networking',
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 172800000),
        locationType: 'virtual',
        venueOrLink: 'https://meet.com/summit',
        organizer: admin._id,
        approvalStatus: 'approved',
      });

      // Create an active job for edit test
      const job = await Job.create({
        title: 'Backend Engineer',
        company: 'Stripe',
        location: 'Remote',
        jobType: 'full_time',
        workplaceType: 'remote',
        experienceLevel: 'mid',
        description: 'Build backend APIs with high reliability.',
        requirements: ['Node.js', 'TypeScript'],
        applicationUrl: 'https://stripe.com/jobs/1',
        postedBy: alumni._id,
        status: 'open',
      });

      // Suspend alumni via Admin endpoint
      const suspendRes = await request(app)
        .patch(`/api/v1/admin/users/${alumni._id}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Violated terms of service' });
      expect(suspendRes.status).toBe(200);

      // Verify DB shows suspended
      const freshAlumni = await User.findById(alumni._id);
      expect(freshAlumni?.accountStatus).toBe('suspended');

      // 1. Profile / Me
      const meRes = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${alumniToken}`);
      expect(meRes.status).toBe(403);
      expect(meRes.body.error.code).toBe('ACCOUNT_SUSPENDED');

      // 2. Profile Update
      const updateMeRes = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${alumniToken}`)
        .send({ bio: 'Hacker' });
      expect(updateMeRes.status).toBe(403);
      expect(updateMeRes.body.error.code).toBe('ACCOUNT_SUSPENDED');

      // 3. Event Creation
      const createEvtRes = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${alumniToken}`)
        .send({
          title: 'Suspended Event',
          description: 'Should not create.',
          category: 'workshop',
          startDate: new Date(Date.now() + 86400000).toISOString(),
          endDate: new Date(Date.now() + 172800000).toISOString(),
          locationType: 'virtual',
          venueOrLink: 'https://meet.com/bad',
        });
      expect(createEvtRes.status).toBe(403);
      expect(createEvtRes.body.error.code).toBe('ACCOUNT_SUSPENDED');

      // 4. Event RSVP
      const rsvpRes = await request(app)
        .post(`/api/v1/events/${event._id}/rsvp`)
        .set('Authorization', `Bearer ${alumniToken}`);
      expect(rsvpRes.status).toBe(403);
      expect(rsvpRes.body.error.code).toBe('ACCOUNT_SUSPENDED');

      // 5. Job Creation
      const createJobRes = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${alumniToken}`)
        .send({
          title: 'Staff Engineer',
          company: 'Meta',
          location: 'Menlo Park',
          jobType: 'full_time',
          workplaceType: 'onsite',
          experienceLevel: 'senior',
          description: 'Lead engineering teams.',
          requirements: ['System Design'],
          applicationUrl: 'https://meta.com/careers',
        });
      expect(createJobRes.status).toBe(403);
      expect(createJobRes.body.error.code).toBe('ACCOUNT_SUSPENDED');

      // 6. Job Modification
      const editJobRes = await request(app)
        .patch(`/api/v1/jobs/${job._id}`)
        .set('Authorization', `Bearer ${alumniToken}`)
        .send({ title: 'Updated Engineer Title' });
      expect(editJobRes.status).toBe(403);
      expect(editJobRes.body.error.code).toBe('ACCOUNT_SUSPENDED');

      // 7. Mentorship Requests
      const mentorReqRes = await request(app)
        .get('/api/v1/mentorship/my-requests')
        .set('Authorization', `Bearer ${alumniToken}`);
      expect(mentorReqRes.status).toBe(403);
      expect(mentorReqRes.body.error.code).toBe('ACCOUNT_SUSPENDED');
    });

    it('allows reactivated user to authenticate and access protected endpoints', async () => {
      const { user: admin, token: adminToken } = await createTestUser({
        role: 'admin',
        verificationStatus: 'admin_approved',
      });
      const { user: alumni } = await createTestUser({
        role: 'alumni',
        accountStatus: 'suspended',
        verificationStatus: 'admin_approved',
      });

      // Reactivate user
      const reactivateRes = await request(app)
        .patch(`/api/v1/admin/users/${alumni._id}/reactivate`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(reactivateRes.status).toBe(200);

      // Sign new access token for the reactivated user
      const freshToken = signAccessToken({ userId: alumni._id.toString(), role: 'alumni' });
      const meRes = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${freshToken}`);
      expect(meRes.status).toBe(200);
      expect(meRes.body.data.user.accountStatus).toBe('active');
    });
  });

  // ── 2. Data Privacy Audit ───────────────────────────────────────────────────
  describe('2. Data Privacy & Safe Projections Audit', () => {
    it('hides mentor private notes from student request view while returning them to mentor', async () => {
      const { user: mentor, token: mentorToken } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
        mentorshipEnabled: true,
      });
      const { user: student, token: studentToken } = await createTestUser({
        role: 'student',
        verificationStatus: 'email_verified',
      });

      // Student creates request
      const createRes = await request(app)
        .post('/api/v1/mentorship/requests')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          mentor: mentor._id.toString(),
          topic: 'Career Transition',
          message: 'Would love advice on breaking into AI.',
        });
      expect(createRes.status).toBe(201);
      const requestId = createRes.body.data.request.id;

      // Mentor accepts with private internal notes
      const acceptRes = await request(app)
        .patch(`/api/v1/mentorship/requests/${requestId}/status`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .send({
          status: 'accepted',
          notes: 'Candidate shows strong potential; prepare mock interview questions.',
        });
      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.data.request.notes).toBe(
        'Candidate shows strong potential; prepare mock interview questions.'
      );

      // Student views requests — private notes MUST be undefined / hidden
      const studentViewRes = await request(app)
        .get('/api/v1/mentorship/my-requests')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(studentViewRes.status).toBe(200);
      expect(studentViewRes.body.data.requests[0].notes).toBeUndefined();

      // Mentor views requests — private notes MUST be visible
      const mentorViewRes = await request(app)
        .get('/api/v1/mentorship/my-requests')
        .set('Authorization', `Bearer ${mentorToken}`);
      expect(mentorViewRes.status).toBe(200);
      expect(mentorViewRes.body.data.requests[0].notes).toBe(
        'Candidate shows strong potential; prepare mock interview questions.'
      );
    });

    it('ensures no passwordHash or token hashes leak across events, jobs, and directory endpoints', async () => {
      const { user: alumni, token: alumniToken } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });

      // Create an event
      const evt = await Event.create({
        title: 'Networking Night',
        description: 'Alumni meet.',
        category: 'networking',
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 172800000),
        locationType: 'in_person',
        venueOrLink: 'Auditorium A',
        organizer: alumni._id,
        approvalStatus: 'approved',
      });

      // Create a job
      const job = await Job.create({
        title: 'Frontend Developer',
        company: 'Vercel',
        location: 'Remote',
        jobType: 'full_time',
        workplaceType: 'remote',
        experienceLevel: 'mid',
        description: 'Build Next.js web applications.',
        requirements: ['React', 'Next.js'],
        applicationUrl: 'https://vercel.com/careers',
        postedBy: alumni._id,
      });

      // Check event detail
      const evtRes = await request(app)
        .get(`/api/v1/events/${evt._id}`)
        .set('Authorization', `Bearer ${alumniToken}`);
      expect(evtRes.status).toBe(200);
      const org = evtRes.body.data.event.organizer;
      expect(org.passwordHash).toBeUndefined();
      expect(org.refreshTokenHash).toBeUndefined();
      expect(org.verificationTokenHash).toBeUndefined();

      // Check job detail
      const jobRes = await request(app)
        .get(`/api/v1/jobs/${job._id}`)
        .set('Authorization', `Bearer ${alumniToken}`);
      expect(jobRes.status).toBe(200);
      const poster = jobRes.body.data.job.postedBy;
      expect(poster.passwordHash).toBeUndefined();
      expect(poster.refreshTokenHash).toBeUndefined();
      expect(poster.verificationTokenHash).toBeUndefined();

      // Check alumni directory
      const dirRes = await request(app).get('/api/v1/alumni');
      expect(dirRes.status).toBe(200);
      expect(dirRes.body.data.alumni[0].passwordHash).toBeUndefined();
      expect(dirRes.body.data.alumni[0].refreshTokenHash).toBeUndefined();
    });
  });

  // ── 3. Input Validation & API Hardening ──────────────────────────────────────
  describe('3. Input Validation & Security Hardening', () => {
    it('rejects malicious or non-http/https applicationUrl schemes in Job creation', async () => {
      const { token: alumniToken } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });

      const badUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'ftp://files.example.com/job',
        'file:///etc/passwd',
      ];

      for (const badUrl of badUrls) {
        const res = await request(app)
          .post('/api/v1/jobs')
          .set('Authorization', `Bearer ${alumniToken}`)
          .send({
            title: 'Security Analyst',
            company: 'CyberCorp',
            location: 'Remote',
            jobType: 'full_time',
            workplaceType: 'remote',
            experienceLevel: 'senior',
            description: 'Evaluate system security defenses.',
            requirements: ['SIEM', 'Pen Testing'],
            applicationUrl: badUrl,
          });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('returns clean 404 NOT_FOUND for malformed ObjectId parameters across all routes', async () => {
      const { token: adminToken } = await createTestUser({
        role: 'admin',
        verificationStatus: 'admin_approved',
      });

      const malformedId = 'not-a-valid-mongo-id-123';

      const endpoints = [
        `/api/v1/events/${malformedId}`,
        `/api/v1/events/${malformedId}/attendees`,
        `/api/v1/jobs/${malformedId}`,
        `/api/v1/alumni/${malformedId}`,
        `/api/v1/admin/users/${malformedId}`,
      ];

      for (const endpoint of endpoints) {
        const res = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('NOT_FOUND');
      }
    });
  });

  // ── 4. RBAC & Cross-Role Authorization Matrix ────────────────────────────────
  describe('4. Comprehensive RBAC Enforcement', () => {
    it('enforces RBAC matrix for student role', async () => {
      const { token: studentToken } = await createTestUser({
        role: 'student',
        verificationStatus: 'email_verified',
      });

      // 1. Student cannot create events -> 403 FORBIDDEN_ROLE
      const evtRes = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Student Hackathon',
          description: 'Fun coding hackathon.',
          category: 'workshop',
          startDate: new Date(Date.now() + 86400000).toISOString(),
          endDate: new Date(Date.now() + 172800000).toISOString(),
          locationType: 'virtual',
          venueOrLink: 'https://meet.com/hack',
        });
      expect(evtRes.status).toBe(403);
      expect(evtRes.body.error.code).toBe('FORBIDDEN_ROLE');

      // 2. Student cannot create jobs -> 403 FORBIDDEN_ROLE
      const jobRes = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Student Project Lead',
          company: 'Acme',
          location: 'Onsite',
          jobType: 'internship',
          workplaceType: 'onsite',
          experienceLevel: 'entry',
          description: 'Project lead role.',
          requirements: ['Teamwork'],
          applicationUrl: 'https://acme.com/apply',
        });
      expect(jobRes.status).toBe(403);
      expect(jobRes.body.error.code).toBe('FORBIDDEN_ROLE');

      // 3. Student cannot access admin endpoints -> 403 FORBIDDEN_ROLE
      const adminRes = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(adminRes.status).toBe(403);
      expect(adminRes.body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('enforces ownership restrictions: non-organizer cannot view attendees; non-poster cannot edit job', async () => {
      const { user: alumni1 } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });
      const { token: alumni2Token } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });

      const event = await Event.create({
        title: 'Private Alumni Meet',
        description: 'Private meetup.',
        category: 'reunion',
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 172800000),
        locationType: 'in_person',
        venueOrLink: 'Club Lounge',
        organizer: alumni1._id,
        approvalStatus: 'approved',
      });

      const job = await Job.create({
        title: 'DevOps Specialist',
        company: 'CloudFlare',
        location: 'Remote',
        jobType: 'full_time',
        workplaceType: 'remote',
        experienceLevel: 'senior',
        description: 'Maintain cloud infrastructure.',
        requirements: ['Kubernetes', 'Terraform'],
        applicationUrl: 'https://cloudflare.com/jobs',
        postedBy: alumni1._id,
        status: 'open',
      });

      // Alumni2 attempts to view attendee list of Alumni1's event -> 403 FORBIDDEN_OWNERSHIP
      const attRes = await request(app)
        .get(`/api/v1/events/${event._id}/attendees`)
        .set('Authorization', `Bearer ${alumni2Token}`);
      expect(attRes.status).toBe(403);
      expect(attRes.body.error.code).toBe('FORBIDDEN_OWNERSHIP');

      // Alumni2 attempts to modify Alumni1's job -> 403 FORBIDDEN_OWNERSHIP
      const editJobRes = await request(app)
        .patch(`/api/v1/jobs/${job._id}`)
        .set('Authorization', `Bearer ${alumni2Token}`)
        .send({ title: 'Hijacked Job Title' });
      expect(editJobRes.status).toBe(403);
      expect(editJobRes.body.error.code).toBe('FORBIDDEN_OWNERSHIP');
    });

    it('closed jobs return 404 to other users but are visible to poster and admin', async () => {
      const { user: poster, token: posterToken } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });
      const { token: otherToken } = await createTestUser({
        role: 'student',
        verificationStatus: 'email_verified',
      });
      const { token: adminToken } = await createTestUser({
        role: 'admin',
        verificationStatus: 'admin_approved',
      });

      const closedJob = await Job.create({
        title: 'Closed Position',
        company: 'Acme Corp',
        location: 'Remote',
        jobType: 'full_time',
        workplaceType: 'remote',
        experienceLevel: 'mid',
        description: 'Closed role description.',
        requirements: ['Python'],
        applicationUrl: 'https://acme.com/apply',
        postedBy: poster._id,
        status: 'closed',
      });

      // Other user gets 404 NOT_FOUND
      const otherRes = await request(app)
        .get(`/api/v1/jobs/${closedJob._id}`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(otherRes.status).toBe(404);
      expect(otherRes.body.error.code).toBe('NOT_FOUND');

      // Poster gets 200 OK
      const posterRes = await request(app)
        .get(`/api/v1/jobs/${closedJob._id}`)
        .set('Authorization', `Bearer ${posterToken}`);
      expect(posterRes.status).toBe(200);
      expect(posterRes.body.data.job.status).toBe('closed');

      // Admin gets 200 OK
      const adminRes = await request(app)
        .get(`/api/v1/jobs/${closedJob._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminRes.status).toBe(200);
      expect(adminRes.body.data.job.status).toBe('closed');
    });
  });
});
