import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app';
import User from '../src/models/User';
import Job from '../src/models/Job';
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
  await Job.deleteMany({});
});

describe('Phase 4B: Jobs & Referrals Test Suite', () => {
  // Helper to create test users
  async function createTestUser(overrides: any = {}) {
    const user = await User.create({
      name: overrides.name || 'Test User',
      email: overrides.email || `user_${Date.now()}_${Math.random()}@college.edu`,
      passwordHash: 'dummyhash123',
      role: overrides.role || 'alumni',
      accountStatus: overrides.accountStatus || 'active',
      verificationStatus: overrides.verificationStatus || 'admin_approved',
      department: 'Computer Science',
      company: 'Tech Corp',
      designation: 'Software Engineer',
      ...overrides,
    });
    const token = signAccessToken({ userId: user._id.toString(), role: user.role });
    return { user, token };
  }

  const validJobPayload = {
    title: 'Senior Full Stack Engineer',
    company: 'Acme Technologies',
    location: 'Bangalore, India',
    jobType: 'full_time',
    workplaceType: 'hybrid',
    experienceLevel: 'senior',
    description: 'We are looking for an experienced full stack engineer to build world-class cloud platforms.',
    requirements: [
      '5+ years experience with Node.js and TypeScript',
      'Solid experience with React and Tailwind CSS',
      'Strong knowledge of MongoDB and distributed systems',
    ],
    applicationUrl: 'https://acme.com/careers/senior-eng',
    applicationDeadline: new Date(Date.now() + 30 * 86400000).toISOString(),
    referralAvailable: true,
  };

  describe('1. Job Creation & Role/Verification Guards', () => {
    it('unauthenticated request is rejected with 401', async () => {
      const res = await request(app).post('/api/v1/jobs').send(validJobPayload);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('NOT_AUTHENTICATED');
    });

    it('unverified alumni (pending or email_verified) is rejected with 403 NOT_VERIFIED', async () => {
      const { token: pendingToken } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'pending',
      });
      const res1 = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${pendingToken}`)
        .send(validJobPayload);
      expect(res1.status).toBe(403);
      expect(res1.body.error.code).toBe('NOT_VERIFIED');

      const { token: emailVerifiedToken } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'email_verified',
      });
      const res2 = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${emailVerifiedToken}`)
        .send(validJobPayload);
      expect(res2.status).toBe(403);
      expect(res2.body.error.code).toBe('NOT_VERIFIED');
    });

    it('student (even verified) is rejected with 403 FORBIDDEN_ROLE', async () => {
      const { token: studentToken } = await createTestUser({
        role: 'student',
        verificationStatus: 'email_verified',
      });
      const res = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(validJobPayload);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('verified alumni can successfully create a job with status: open', async () => {
      const { user, token } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });
      const res = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send(validJobPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.job.title).toBe(validJobPayload.title);
      expect(res.body.data.job.company).toBe(validJobPayload.company);
      expect(res.body.data.job.status).toBe('open');
      expect(res.body.data.job.referralAvailable).toBe(true);
      expect(res.body.data.job.postedBy._id.toString()).toBe(user._id.toString());
      expect(res.body.data.job.postedBy.email).toBeUndefined(); // Safe poster info check
    });

    it('admin can create a job with status: open', async () => {
      const { user, token } = await createTestUser({
        role: 'admin',
        verificationStatus: 'admin_approved',
      });
      const res = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send(validJobPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.job.status).toBe('open');
      expect(res.body.data.job.postedBy._id.toString()).toBe(user._id.toString());
    });

    it('postedBy cannot be spoofed from client payload', async () => {
      const { user, token } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });
      const fakeObjectId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validJobPayload,
          postedBy: fakeObjectId,
          status: 'closed',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.job.postedBy._id.toString()).toBe(user._id.toString());
      expect(res.body.data.job.status).toBe('open'); // Server-set
    });
  });

  describe('2. Payload Validation', () => {
    it('rejects missing required fields', async () => {
      const { token } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });

      const res = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Dev',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects empty requirements array or blank requirements', async () => {
      const { token } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });

      const res1 = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validJobPayload,
          requirements: [],
        });
      expect(res1.status).toBe(400);
      expect(res1.body.error.code).toBe('VALIDATION_ERROR');

      const res2 = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validJobPayload,
          requirements: ['   '],
        });
      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects non-http(s) applicationUrl (e.g. javascript: or ftp:)', async () => {
      const { token } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });

      const res1 = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validJobPayload,
          applicationUrl: 'javascript:alert("XSS")',
        });
      expect(res1.status).toBe(400);
      expect(res1.body.error.code).toBe('VALIDATION_ERROR');

      const res2 = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validJobPayload,
          applicationUrl: 'ftp://files.example.com/apply',
        });
      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('3. Job Modification (PATCH /api/v1/jobs/:id)', () => {
    it('owner can edit their own job posting', async () => {
      const { token } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });

      const createRes = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send(validJobPayload);
      const jobId = createRes.body.data.job.id;

      const updateRes = await request(app)
        .patch(`/api/v1/jobs/${jobId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Lead Software Architect',
          location: 'Remote, Global',
          experienceLevel: 'lead',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.job.title).toBe('Lead Software Architect');
      expect(updateRes.body.data.job.location).toBe('Remote, Global');
      expect(updateRes.body.data.job.experienceLevel).toBe('lead');
    });

    it('admin can edit any job posting', async () => {
      const { token: alumniToken } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });
      const { token: adminToken } = await createTestUser({
        role: 'admin',
        verificationStatus: 'admin_approved',
      });

      const createRes = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${alumniToken}`)
        .send(validJobPayload);
      const jobId = createRes.body.data.job.id;

      const updateRes = await request(app)
        .patch(`/api/v1/jobs/${jobId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Admin Edited Title',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.job.title).toBe('Admin Edited Title');
    });

    it('different alumni receives 403 FORBIDDEN_OWNERSHIP', async () => {
      const { token: ownerToken } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });
      const { token: otherAlumniToken } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });

      const createRes = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(validJobPayload);
      const jobId = createRes.body.data.job.id;

      const updateRes = await request(app)
        .patch(`/api/v1/jobs/${jobId}`)
        .set('Authorization', `Bearer ${otherAlumniToken}`)
        .send({
          title: 'Hacked Title',
        });

      expect(updateRes.status).toBe(403);
      expect(updateRes.body.error.code).toBe('FORBIDDEN_OWNERSHIP');
    });

    it('cannot reassign postedBy through update payload', async () => {
      const { user, token } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });

      const createRes = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send(validJobPayload);
      const jobId = createRes.body.data.job.id;

      const fakeUser = new mongoose.Types.ObjectId().toString();
      const updateRes = await request(app)
        .patch(`/api/v1/jobs/${jobId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          postedBy: fakeUser,
          title: 'Updated Title',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.job.postedBy._id.toString()).toBe(user._id.toString());
    });

    it('setting status: closed removes job from default list but keeps it visible to owner/admin', async () => {
      const { token: ownerToken } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });
      const { token: studentToken } = await createTestUser({
        role: 'student',
        verificationStatus: 'email_verified',
      });
      const { token: adminToken } = await createTestUser({
        role: 'admin',
        verificationStatus: 'admin_approved',
      });

      const createRes = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(validJobPayload);
      const jobId = createRes.body.data.job.id;

      // Close the job
      const closeRes = await request(app)
        .patch(`/api/v1/jobs/${jobId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'closed' });
      expect(closeRes.status).toBe(200);
      expect(closeRes.body.data.job.status).toBe('closed');

      // Default public list excludes it
      const listRes = await request(app).get('/api/v1/jobs');
      expect(listRes.body.data.jobs.length).toBe(0);

      // Owner can see it via mine=true
      const ownerMineRes = await request(app)
        .get('/api/v1/jobs?mine=true')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(ownerMineRes.body.data.jobs.length).toBe(1);
      expect(ownerMineRes.body.data.jobs[0].id).toBe(jobId);

      // Detail view by owner -> 200
      const ownerDetailRes = await request(app)
        .get(`/api/v1/jobs/${jobId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(ownerDetailRes.status).toBe(200);

      // Detail view by admin -> 200
      const adminDetailRes = await request(app)
        .get(`/api/v1/jobs/${jobId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminDetailRes.status).toBe(200);

      // Detail view by student -> 404 NOT_FOUND (hidden per §2 & §3.2)
      const studentDetailRes = await request(app)
        .get(`/api/v1/jobs/${jobId}`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(studentDetailRes.status).toBe(404);
      expect(studentDetailRes.body.error.code).toBe('NOT_FOUND');

      // Detail view by unauthenticated user -> 404 NOT_FOUND
      const unauthDetailRes = await request(app).get(`/api/v1/jobs/${jobId}`);
      expect(unauthDetailRes.status).toBe(404);
    });
  });

  describe('4. Job Deletion (DELETE /api/v1/jobs/:id)', () => {
    it('owner can delete their own job', async () => {
      const { token } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });

      const createRes = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send(validJobPayload);
      const jobId = createRes.body.data.job.id;

      const deleteRes = await request(app)
        .delete(`/api/v1/jobs/${jobId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.data.message).toMatch(/deleted successfully/i);

      // Verify DB removal
      const check = await Job.findById(jobId);
      expect(check).toBeNull();
    });

    it('admin can delete any job', async () => {
      const { token: alumniToken } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });
      const { token: adminToken } = await createTestUser({
        role: 'admin',
        verificationStatus: 'admin_approved',
      });

      const createRes = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${alumniToken}`)
        .send(validJobPayload);
      const jobId = createRes.body.data.job.id;

      const deleteRes = await request(app)
        .delete(`/api/v1/jobs/${jobId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deleteRes.status).toBe(200);
    });

    it('non-owner alumni receives 403 FORBIDDEN_OWNERSHIP on delete', async () => {
      const { token: ownerToken } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });
      const { token: otherAlumniToken } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });

      const createRes = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(validJobPayload);
      const jobId = createRes.body.data.job.id;

      const deleteRes = await request(app)
        .delete(`/api/v1/jobs/${jobId}`)
        .set('Authorization', `Bearer ${otherAlumniToken}`);

      expect(deleteRes.status).toBe(403);
      expect(deleteRes.body.error.code).toBe('FORBIDDEN_OWNERSHIP');
    });

    it('student receives 403 FORBIDDEN_ROLE on delete', async () => {
      const { token: ownerToken } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });
      const { token: studentToken } = await createTestUser({
        role: 'student',
        verificationStatus: 'email_verified',
      });

      const createRes = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(validJobPayload);
      const jobId = createRes.body.data.job.id;

      const deleteRes = await request(app)
        .delete(`/api/v1/jobs/${jobId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(deleteRes.status).toBe(403);
      expect(deleteRes.body.error.code).toBe('FORBIDDEN_ROLE');
    });
  });

  describe('5. Search, Filters & Pagination', () => {
    beforeEach(async () => {
      const { user } = await createTestUser({
        name: 'Jane Doe',
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });

      await Job.create([
        {
          title: 'Frontend React Developer',
          company: 'Google',
          location: 'Mountain View, CA',
          jobType: 'full_time',
          workplaceType: 'remote',
          experienceLevel: 'mid',
          description: 'Frontend React UI work and web design systems.',
          requirements: ['3+ years React', 'Tailwind CSS'],
          applicationUrl: 'https://google.com/jobs/react',
          status: 'open',
          postedBy: user._id,
          referralAvailable: true,
        },
        {
          title: 'Backend Python Engineer',
          company: 'Meta',
          location: 'Menlo Park, CA',
          jobType: 'contract',
          workplaceType: 'onsite',
          experienceLevel: 'senior',
          description: 'Distributed ML platforms and backend Python APIs.',
          requirements: ['Python', 'PyTorch'],
          applicationUrl: 'https://meta.com/jobs/python',
          status: 'open',
          postedBy: user._id,
          referralAvailable: false,
        },
        {
          title: 'Software Engineering Intern',
          company: 'Microsoft',
          location: 'Redmond, WA',
          jobType: 'internship',
          workplaceType: 'hybrid',
          experienceLevel: 'entry',
          description: 'Summer internship for undergrad students.',
          requirements: ['Algorithms', 'Data Structures'],
          applicationUrl: 'https://microsoft.com/jobs/intern',
          status: 'open',
          postedBy: user._id,
          referralAvailable: true,
        },
      ]);
    });

    it('filters by jobType', async () => {
      const res = await request(app).get('/api/v1/jobs?jobType=internship');
      expect(res.status).toBe(200);
      expect(res.body.data.jobs.length).toBe(1);
      expect(res.body.data.jobs[0].title).toBe('Software Engineering Intern');
    });

    it('filters by workplaceType', async () => {
      const res = await request(app).get('/api/v1/jobs?workplaceType=remote');
      expect(res.status).toBe(200);
      expect(res.body.data.jobs.length).toBe(1);
      expect(res.body.data.jobs[0].title).toBe('Frontend React Developer');
    });

    it('filters by experienceLevel', async () => {
      const res = await request(app).get('/api/v1/jobs?experienceLevel=senior');
      expect(res.status).toBe(200);
      expect(res.body.data.jobs.length).toBe(1);
      expect(res.body.data.jobs[0].title).toBe('Backend Python Engineer');
    });

    it('filters by referralAvailable=true', async () => {
      const res = await request(app).get('/api/v1/jobs?referralAvailable=true');
      expect(res.status).toBe(200);
      expect(res.body.data.jobs.length).toBe(2);
    });

    it('searches across title, company, description', async () => {
      const res = await request(app).get('/api/v1/jobs?search=Google');
      expect(res.status).toBe(200);
      expect(res.body.data.jobs.length).toBe(1);
      expect(res.body.data.jobs[0].company).toBe('Google');
    });

    it('returns standard pagination metadata', async () => {
      const res = await request(app).get('/api/v1/jobs?page=1&limit=2');
      expect(res.status).toBe(200);
      expect(res.body.data.jobs.length).toBe(2);
      expect(res.body.data.pagination).toEqual({
        total: 3,
        page: 1,
        limit: 2,
        totalPages: 2,
      });
    });
  });
});
