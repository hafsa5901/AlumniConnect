import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import fs from 'fs';
import path from 'path';
import app from '../src/app';
import User from '../src/models/User';
import Job from '../src/models/Job';
import ReferralRequest from '../src/models/ReferralRequest';
import Notification from '../src/models/Notification';
import MentorshipRequest from '../src/models/MentorshipRequest';
import { signAccessToken } from '../src/utils/auth';
import { storageService } from '../src/services/storage';

jest.setTimeout(30000);

let mongoServer: MongoMemoryServer;

const validPdfBuffer = Buffer.concat([
  Buffer.from('%PDF-1.4 sample content for referral test'),
  Buffer.alloc(100, 0),
]);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  // Ensure schema indexes (including partial unique index) are created
  await ReferralRequest.syncIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Job.deleteMany({});
  await ReferralRequest.deleteMany({});
  await Notification.deleteMany({});
  await MentorshipRequest.deleteMany({});
});

describe('Phase 5D: Job Referral Requests Test Suite', () => {
  async function createTestUser(overrides: any = {}) {
    const user = await User.create({
      name: overrides.name || 'Test User',
      email: overrides.email || `user_${Date.now()}_${Math.random()}@college.edu`,
      passwordHash: 'dummy_pw_hash',
      role: overrides.role || 'student',
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

  async function createTestJob(posterId: mongoose.Types.ObjectId, overrides: any = {}) {
    return await Job.create({
      title: 'Software Engineer',
      company: 'Acme Corp',
      location: 'Remote',
      jobType: 'full_time',
      workplaceType: 'remote',
      experienceLevel: 'entry',
      description: 'Exciting software engineering role.',
      requirements: ['TypeScript', 'React'],
      applicationUrl: 'https://acme.com/jobs/123',
      status: overrides.status || 'open',
      postedBy: posterId,
      referralAvailable: overrides.referralAvailable !== undefined ? overrides.referralAvailable : true,
      ...overrides,
    });
  }

  async function attachResumeToUser(userId: mongoose.Types.ObjectId, filename = 'resume.pdf') {
    const file = {
      buffer: validPdfBuffer,
      originalname: filename,
      mimetype: 'application/pdf',
      size: validPdfBuffer.length,
    } as Express.Multer.File;
    const { storagePath } = await storageService.savePrivate(file, 'resumes');
    const user = await User.findByIdAndUpdate(
      userId,
      {
        resume: {
          originalName: filename,
          storagePath,
          mimeType: 'application/pdf',
          size: validPdfBuffer.length,
          uploadedAt: new Date(),
        },
      },
      { new: true }
    );
    return { user, storagePath };
  }

  describe('1. Referral Creation & Validation', () => {
    it('creates a referral request successfully for open job with referralAvailable: true', async () => {
      const poster = await createTestUser({ role: 'alumni' });
      const applicant = await createTestUser({ role: 'student' });
      const job = await createTestJob(poster.user._id, { referralAvailable: true });

      const res = await request(app)
        .post('/api/v1/referrals')
        .set('Authorization', `Bearer ${applicant.token}`)
        .send({
          jobId: job._id.toString(),
          message: 'I have 2 years experience in TypeScript and React and would love a referral.',
          resumeIncluded: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.referral.status).toBe('pending');
      expect(res.body.data.referral.resumeIncluded).toBe(true);

      // Notification created for poster
      const notif = await Notification.findOne({ recipient: poster.user._id });
      expect(notif).not.toBeNull();
      expect(notif?.type).toBe('referral_request_received');
    });

    it('rejects unauthenticated referral submission', async () => {
      const poster = await createTestUser({ role: 'alumni' });
      const job = await createTestJob(poster.user._id);

      const res = await request(app)
        .post('/api/v1/referrals')
        .send({
          jobId: job._id.toString(),
          message: 'Looking for a referral.',
        });

      expect(res.status).toBe(401);
    });

    it('rejects self-referral on own posted job with 400 SELF_REFERRAL_FORBIDDEN', async () => {
      const poster = await createTestUser({ role: 'alumni' });
      const job = await createTestJob(poster.user._id);

      const res = await request(app)
        .post('/api/v1/referrals')
        .set('Authorization', `Bearer ${poster.token}`)
        .send({
          jobId: job._id.toString(),
          message: 'Trying to refer myself.',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SELF_REFERRAL_FORBIDDEN');
    });

    it('rejects referral request when job is closed with 400 JOB_NOT_OPEN', async () => {
      const poster = await createTestUser({ role: 'alumni' });
      const applicant = await createTestUser({ role: 'student' });
      const job = await createTestJob(poster.user._id, { status: 'closed' });

      const res = await request(app)
        .post('/api/v1/referrals')
        .set('Authorization', `Bearer ${applicant.token}`)
        .send({
          jobId: job._id.toString(),
          message: 'Can I get a referral please?',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('JOB_NOT_OPEN');
    });

    it('rejects referral request when referralAvailable is false with 400 REFERRALS_NOT_AVAILABLE', async () => {
      const poster = await createTestUser({ role: 'alumni' });
      const applicant = await createTestUser({ role: 'student' });
      const job = await createTestJob(poster.user._id, { referralAvailable: false });

      const res = await request(app)
        .post('/api/v1/referrals')
        .set('Authorization', `Bearer ${applicant.token}`)
        .send({
          jobId: job._id.toString(),
          message: 'Can I get a referral please?',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('REFERRALS_NOT_AVAILABLE');
    });
  });

  describe('2. Partial Unique Index & Re-application Rules', () => {
    it('prevents duplicate active (pending) request for same (job, applicant) with 409', async () => {
      const poster = await createTestUser({ role: 'alumni' });
      const applicant = await createTestUser({ role: 'student' });
      const job = await createTestJob(poster.user._id);

      const res1 = await request(app)
        .post('/api/v1/referrals')
        .set('Authorization', `Bearer ${applicant.token}`)
        .send({
          jobId: job._id.toString(),
          message: 'First application request.',
        });
      expect(res1.status).toBe(201);

      const res2 = await request(app)
        .post('/api/v1/referrals')
        .set('Authorization', `Bearer ${applicant.token}`)
        .send({
          jobId: job._id.toString(),
          message: 'Second duplicate request.',
        });
      expect(res2.status).toBe(409);
      expect(res2.body.error.code).toBe('DUPLICATE_REFERRAL_REQUEST');
    });

    it('prevents new active request when prior request is accepted with 409', async () => {
      const poster = await createTestUser({ role: 'alumni' });
      const applicant = await createTestUser({ role: 'student' });
      const job = await createTestJob(poster.user._id);

      await ReferralRequest.create({
        job: job._id,
        jobPoster: poster.user._id,
        applicant: applicant.user._id,
        status: 'accepted',
        message: 'Accepted earlier.',
        resumeIncluded: true,
      });

      const res = await request(app)
        .post('/api/v1/referrals')
        .set('Authorization', `Bearer ${applicant.token}`)
        .send({
          jobId: job._id.toString(),
          message: 'Attempting another request while accepted.',
        });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_REFERRAL_REQUEST');
    });

    it('allows re-application if prior request was rejected or withdrawn', async () => {
      const poster = await createTestUser({ role: 'alumni' });
      const applicant = await createTestUser({ role: 'student' });
      const job = await createTestJob(poster.user._id);

      // Create historical rejected request
      await ReferralRequest.create({
        job: job._id,
        jobPoster: poster.user._id,
        applicant: applicant.user._id,
        status: 'rejected',
        message: 'Prior rejected request.',
        resumeIncluded: false,
      });

      // Create historical withdrawn request
      await ReferralRequest.create({
        job: job._id,
        jobPoster: poster.user._id,
        applicant: applicant.user._id,
        status: 'withdrawn',
        message: 'Prior withdrawn request.',
        resumeIncluded: false,
      });

      // New submission succeeds because partial index only filters pending/accepted
      const res = await request(app)
        .post('/api/v1/referrals')
        .set('Authorization', `Bearer ${applicant.token}`)
        .send({
          jobId: job._id.toString(),
          message: 'Fresh re-application after rejection.',
          resumeIncluded: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.referral.status).toBe('pending');
    });
  });

  describe('3. Status Transitions & Atomic State Machine', () => {
    it('poster accepts referral request with response note and triggers notification', async () => {
      const poster = await createTestUser({ role: 'alumni' });
      const applicant = await createTestUser({ role: 'student' });
      const job = await createTestJob(poster.user._id);

      const referral = await ReferralRequest.create({
        job: job._id,
        jobPoster: poster.user._id,
        applicant: applicant.user._id,
        status: 'pending',
        message: 'Please refer me.',
        resumeIncluded: true,
      });

      const res = await request(app)
        .patch(`/api/v1/referrals/${referral._id}/status`)
        .set('Authorization', `Bearer ${poster.token}`)
        .send({
          status: 'accepted',
          responseNote: 'Submitted your referral! Check your email for candidate portal link.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.referral.status).toBe('accepted');
      expect(res.body.data.referral.responseNote).toContain('Submitted your referral');

      // Notification check
      const notif = await Notification.findOne({ recipient: applicant.user._id, type: 'referral_request_accepted' });
      expect(notif).not.toBeNull();
      expect(notif?.title).toContain('Accepted');
    });

    it('poster declines referral request with feedback note and triggers notification', async () => {
      const poster = await createTestUser({ role: 'alumni' });
      const applicant = await createTestUser({ role: 'student' });
      const job = await createTestJob(poster.user._id);

      const referral = await ReferralRequest.create({
        job: job._id,
        jobPoster: poster.user._id,
        applicant: applicant.user._id,
        status: 'pending',
        message: 'Please refer me.',
        resumeIncluded: true,
      });

      const res = await request(app)
        .patch(`/api/v1/referrals/${referral._id}/status`)
        .set('Authorization', `Bearer ${poster.token}`)
        .send({
          status: 'rejected',
          responseNote: 'Currently looking for senior candidates for this specific team.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.referral.status).toBe('rejected');

      const notif = await Notification.findOne({ recipient: applicant.user._id, type: 'referral_request_rejected' });
      expect(notif).not.toBeNull();
      expect(notif?.title).toContain('Declined');
    });

    it('applicant withdraws pending referral request', async () => {
      const poster = await createTestUser({ role: 'alumni' });
      const applicant = await createTestUser({ role: 'student' });
      const job = await createTestJob(poster.user._id);

      const referral = await ReferralRequest.create({
        job: job._id,
        jobPoster: poster.user._id,
        applicant: applicant.user._id,
        status: 'pending',
        message: 'Please refer me.',
      });

      const res = await request(app)
        .patch(`/api/v1/referrals/${referral._id}/withdraw`)
        .set('Authorization', `Bearer ${applicant.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.referral.status).toBe('withdrawn');
    });

    it('prevents withdrawing an already accepted referral request with 400', async () => {
      const poster = await createTestUser({ role: 'alumni' });
      const applicant = await createTestUser({ role: 'student' });
      const job = await createTestJob(poster.user._id);

      const referral = await ReferralRequest.create({
        job: job._id,
        jobPoster: poster.user._id,
        applicant: applicant.user._id,
        status: 'accepted',
        message: 'Please refer me.',
      });

      const res = await request(app)
        .patch(`/api/v1/referrals/${referral._id}/withdraw`)
        .set('Authorization', `Bearer ${applicant.token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('rejects unauthorized user attempting to accept or reject referral request', async () => {
      const poster = await createTestUser({ role: 'alumni' });
      const applicant = await createTestUser({ role: 'student' });
      const stranger = await createTestUser({ role: 'alumni' });
      const job = await createTestJob(poster.user._id);

      const referral = await ReferralRequest.create({
        job: job._id,
        jobPoster: poster.user._id,
        applicant: applicant.user._id,
        status: 'pending',
        message: 'Please refer me.',
      });

      const res = await request(app)
        .patch(`/api/v1/referrals/${referral._id}/status`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .send({ status: 'accepted' });

      expect(res.status).toBe(404);
    });
  });

  describe('4. Dedicated Resume Authorization & Separation from Phase 5C', () => {
    it('job poster successfully downloads applicant resume via /api/v1/referrals/:id/resume when resumeIncluded is true', async () => {
      const poster = await createTestUser({ role: 'alumni' });
      const applicant = await createTestUser({ role: 'student' });
      await attachResumeToUser(applicant.user._id, 'student_cv.pdf');
      const job = await createTestJob(poster.user._id);

      const referral = await ReferralRequest.create({
        job: job._id,
        jobPoster: poster.user._id,
        applicant: applicant.user._id,
        status: 'pending',
        message: 'Resume attached.',
        resumeIncluded: true,
      });

      const res = await request(app)
        .get(`/api/v1/referrals/${referral._id}/resume`)
        .set('Authorization', `Bearer ${poster.token}`);

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('application/pdf');
      expect(res.header['content-disposition']).toContain('_resume.pdf');
      expect(res.header['x-content-type-options']).toBe('nosniff');
    });

    it('job poster denied download when resumeIncluded is false (canonical 404)', async () => {
      const poster = await createTestUser({ role: 'alumni' });
      const applicant = await createTestUser({ role: 'student' });
      await attachResumeToUser(applicant.user._id);
      const job = await createTestJob(poster.user._id);

      const referral = await ReferralRequest.create({
        job: job._id,
        jobPoster: poster.user._id,
        applicant: applicant.user._id,
        status: 'pending',
        message: 'No resume consent given.',
        resumeIncluded: false,
      });

      const res = await request(app)
        .get(`/api/v1/referrals/${referral._id}/resume`)
        .set('Authorization', `Bearer ${poster.token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RESUME_NOT_FOUND');
    });

    it('poster denied download once request is rejected or withdrawn (canonical 404)', async () => {
      const poster = await createTestUser({ role: 'alumni' });
      const applicant = await createTestUser({ role: 'student' });
      await attachResumeToUser(applicant.user._id);
      const job = await createTestJob(poster.user._id);

      const referral = await ReferralRequest.create({
        job: job._id,
        jobPoster: poster.user._id,
        applicant: applicant.user._id,
        status: 'rejected',
        message: 'Rejected request.',
        resumeIncluded: true,
      });

      const res = await request(app)
        .get(`/api/v1/referrals/${referral._id}/resume`)
        .set('Authorization', `Bearer ${poster.token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RESUME_NOT_FOUND');
    });

    it('CROSS-ENDPOINT SEPARATION: Job poster cannot download student resume via /users/:id/resume', async () => {
      const poster = await createTestUser({ role: 'alumni' });
      const applicant = await createTestUser({ role: 'student' });
      await attachResumeToUser(applicant.user._id);
      const job = await createTestJob(poster.user._id);

      await ReferralRequest.create({
        job: job._id,
        jobPoster: poster.user._id,
        applicant: applicant.user._id,
        status: 'pending',
        message: 'Referral with resume consent.',
        resumeIncluded: true,
      });

      // Calling Phase 5C's standing relationship endpoint fails with 404 because poster is not a mentor/owner/admin
      const res = await request(app)
        .get(`/api/v1/users/${applicant.user._id}/resume`)
        .set('Authorization', `Bearer ${poster.token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RESUME_NOT_FOUND');
    });

    it('CROSS-ENDPOINT SEPARATION: Mentorship mentor cannot download resume via /referrals/:id/resume without referral request', async () => {
      const mentor = await createTestUser({ role: 'alumni' });
      const student = await createTestUser({ role: 'student' });
      await attachResumeToUser(student.user._id);

      // Create accepted mentorship
      await MentorshipRequest.create({
        student: student.user._id,
        mentor: mentor.user._id,
        status: 'accepted',
        topic: 'Career Guidance',
        message: 'Let us connect',
      });

      // Calling referral endpoint with non-existent referral returns 404
      const nonExistentReferralId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/v1/referrals/${nonExistentReferralId}/resume`)
        .set('Authorization', `Bearer ${mentor.token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RESUME_NOT_FOUND');
    });
  });

  describe('5. Inboxes, Queries & Deleted Job Lifecycle', () => {
    it('applicant lists their submitted requests via /my-requests', async () => {
      const poster = await createTestUser({ role: 'alumni' });
      const applicant = await createTestUser({ role: 'student' });
      const job = await createTestJob(poster.user._id);

      await ReferralRequest.create({
        job: job._id,
        jobPoster: poster.user._id,
        applicant: applicant.user._id,
        status: 'pending',
        message: 'My referral pitch.',
        resumeIncluded: true,
      });

      const res = await request(app)
        .get('/api/v1/referrals/my-requests')
        .set('Authorization', `Bearer ${applicant.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].job.title).toBe(job.title);
    });

    it('poster lists received requests via /received', async () => {
      const poster = await createTestUser({ role: 'alumni' });
      const applicant = await createTestUser({ role: 'student' });
      const job = await createTestJob(poster.user._id);

      await ReferralRequest.create({
        job: job._id,
        jobPoster: poster.user._id,
        applicant: applicant.user._id,
        status: 'pending',
        message: 'Pitch to poster.',
        resumeIncluded: true,
      });

      const res = await request(app)
        .get('/api/v1/referrals/received')
        .set('Authorization', `Bearer ${poster.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].applicant.name).toBe(applicant.user.name);
    });

    it('referral detail query succeeds gracefully when associated job document is deleted', async () => {
      const poster = await createTestUser({ role: 'alumni' });
      const applicant = await createTestUser({ role: 'student' });
      const job = await createTestJob(poster.user._id);

      const referral = await ReferralRequest.create({
        job: job._id,
        jobPoster: poster.user._id,
        applicant: applicant.user._id,
        status: 'pending',
        message: 'Job will be deleted.',
      });

      // Delete the job document
      await Job.findByIdAndDelete(job._id);

      const res = await request(app)
        .get(`/api/v1/referrals/${referral._id}`)
        .set('Authorization', `Bearer ${applicant.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.referral.job).toBeNull();
    });

    it('unauthorized user gets canonical 404 for referral detail query (existence hiding)', async () => {
      const poster = await createTestUser({ role: 'alumni' });
      const applicant = await createTestUser({ role: 'student' });
      const stranger = await createTestUser({ role: 'student' });
      const job = await createTestJob(poster.user._id);

      const referral = await ReferralRequest.create({
        job: job._id,
        jobPoster: poster.user._id,
        applicant: applicant.user._id,
        status: 'pending',
        message: 'Private request.',
      });

      const res = await request(app)
        .get(`/api/v1/referrals/${referral._id}`)
        .set('Authorization', `Bearer ${stranger.token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
