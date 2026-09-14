import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import fs from 'fs';
import path from 'path';
import app from '../src/app';
import User, { SAFE_USER_FIELDS } from '../src/models/User';
import MentorshipRequest from '../src/models/MentorshipRequest';
import { signAccessToken } from '../src/utils/auth';
import { calculateProfileCompletion } from '../src/utils/profileCompletion';
import { storageService } from '../src/services/storage';

jest.setTimeout(30000);

let mongoServer: MongoMemoryServer;

// Helper sample file buffers with accurate magic bytes
const validPdfBuffer = Buffer.concat([
  Buffer.from('%PDF-1.4 sample content for resume test'),
  Buffer.alloc(100, 0),
]);
const validDocBuffer = Buffer.concat([
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  Buffer.from('sample doc binary content'),
]);
const validDocxBuffer = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]),
  Buffer.from('sample docx zip binary content'),
]);
const spoofedExeBuffer = Buffer.concat([
  Buffer.from([0x4d, 0x5a, 0x90, 0x00]), // MZ PE executable header
  Buffer.from('evil executable masquerading as pdf'),
]);

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

describe('Phase 5C: Resume & Profile Enhancements Test Suite', () => {
  // Helper to create test user
  async function createTestUser(overrides: any = {}) {
    const user = await User.create({
      name: overrides.name || 'Test User',
      email: overrides.email || `user_${Date.now()}_${Math.random()}@college.edu`,
      passwordHash: 'dummy_pw_hash',
      role: overrides.role || 'student',
      accountStatus: overrides.accountStatus || 'active',
      verificationStatus: overrides.verificationStatus || 'admin_approved',
      department: overrides.department || 'Computer Science',
      batch: overrides.batch || '2024',
      skills: overrides.skills || ['TypeScript', 'Node.js'],
      education: overrides.education || [
        {
          institution: 'University of Engineering',
          degree: 'B.Tech',
          field: 'Computer Science',
          startYear: 2020,
          endYear: 2024,
        },
      ],
      ...overrides,
    });
    const token = signAccessToken({ userId: user._id.toString(), role: user.role });
    return { user, token };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // A. Resume Upload
  // ─────────────────────────────────────────────────────────────────────────────
  describe('A. Resume Upload (POST /api/v1/users/me/resume)', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await request(app)
        .post('/api/v1/users/me/resume')
        .attach('resume', validPdfBuffer, 'test_resume.pdf');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('NOT_AUTHENTICATED');
    });

    it('rejects upload from suspended user with 403 ACCOUNT_SUSPENDED', async () => {
      const { token } = await createTestUser({ accountStatus: 'suspended' });
      const res = await request(app)
        .post('/api/v1/users/me/resume')
        .set('Authorization', `Bearer ${token}`)
        .attach('resume', validPdfBuffer, 'test_resume.pdf');
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
    });

    it('rejects upload with missing file with 400 VALIDATION_ERROR', async () => {
      const { token } = await createTestUser();
      const res = await request(app)
        .post('/api/v1/users/me/resume')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('accepts valid PDF file and returns resume metadata', async () => {
      const { token, user } = await createTestUser();
      const res = await request(app)
        .post('/api/v1/users/me/resume')
        .set('Authorization', `Bearer ${token}`)
        .attach('resume', validPdfBuffer, 'my_resume.pdf');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.resume.originalName).toBe('my_resume.pdf');
      expect(res.body.data.resume.mimeType).toBe('application/pdf');
      expect(res.body.data.resume.size).toBe(validPdfBuffer.length);
      expect(res.body.data.resume.storagePath).toBeUndefined(); // Never leaked

      const updatedUser = await User.findById(user._id).select('+resume.storagePath');
      expect(updatedUser?.resume?.originalName).toBe('my_resume.pdf');
      expect(updatedUser?.resume?.storagePath).toBeDefined();
    });

    it('accepts valid DOC file', async () => {
      const { token } = await createTestUser();
      const res = await request(app)
        .post('/api/v1/users/me/resume')
        .set('Authorization', `Bearer ${token}`)
        .attach('resume', validDocBuffer, { filename: 'my_resume.doc', contentType: 'application/msword' });

      expect(res.status).toBe(200);
      expect(res.body.data.resume.originalName).toBe('my_resume.doc');
      expect(res.body.data.resume.mimeType).toBe('application/msword');
    });

    it('accepts valid DOCX file', async () => {
      const { token } = await createTestUser();
      const res = await request(app)
        .post('/api/v1/users/me/resume')
        .set('Authorization', `Bearer ${token}`)
        .attach('resume', validDocxBuffer, {
          filename: 'my_resume.docx',
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.resume.originalName).toBe('my_resume.docx');
    });

    it('rejects file larger than 5MB with 413 FILE_TOO_LARGE', async () => {
      const { token } = await createTestUser();
      const largeBuffer = Buffer.alloc(5.5 * 1024 * 1024, 0x25); // 5.5MB
      const res = await request(app)
        .post('/api/v1/users/me/resume')
        .set('Authorization', `Bearer ${token}`)
        .attach('resume', largeBuffer, 'large_resume.pdf');

      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe('FILE_TOO_LARGE');
    });

    it('rejects unsupported MIME type with 400 INVALID_MIME_TYPE', async () => {
      const { token } = await createTestUser();
      const res = await request(app)
        .post('/api/v1/users/me/resume')
        .set('Authorization', `Bearer ${token}`)
        .attach('resume', Buffer.from('console.log("hello")'), { filename: 'script.js', contentType: 'application/javascript' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_MIME_TYPE');
    });

    it('rejects unsupported extension even if MIME is forced', async () => {
      const { token } = await createTestUser();
      const res = await request(app)
        .post('/api/v1/users/me/resume')
        .set('Authorization', `Bearer ${token}`)
        .attach('resume', validPdfBuffer, { filename: 'malicious.exe', contentType: 'application/pdf' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_EXTENSION');
    });

    it('rejects MIME and extension mismatch (e.g. .pdf with DOC MIME)', async () => {
      const { token } = await createTestUser();
      const res = await request(app)
        .post('/api/v1/users/me/resume')
        .set('Authorization', `Bearer ${token}`)
        .attach('resume', validPdfBuffer, { filename: 'test.pdf', contentType: 'application/msword' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MIME_EXTENSION_MISMATCH');
    });

    it('rejects spoofed file with fake extension (magic byte validation)', async () => {
      const { token } = await createTestUser();
      const res = await request(app)
        .post('/api/v1/users/me/resume')
        .set('Authorization', `Bearer ${token}`)
        .attach('resume', spoofedExeBuffer, { filename: 'resume.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('FILE_CORRUPTED_OR_SPOOFED');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // B. Resume Replace & Delete
  // ─────────────────────────────────────────────────────────────────────────────
  describe('B. Resume Replace & Delete', () => {
    it('replacing resume deletes old physical file and stores new file', async () => {
      const { token, user } = await createTestUser();

      // 1. First upload
      await request(app)
        .post('/api/v1/users/me/resume')
        .set('Authorization', `Bearer ${token}`)
        .attach('resume', validPdfBuffer, 'resume_v1.pdf');

      const userV1 = await User.findById(user._id).select('+resume.storagePath');
      const v1Path = storageService.getPrivateFilePath(userV1!.resume!.storagePath!);
      expect(fs.existsSync(v1Path)).toBe(true);

      // 2. Second upload (replace)
      const resReplace = await request(app)
        .post('/api/v1/users/me/resume')
        .set('Authorization', `Bearer ${token}`)
        .attach('resume', validDocxBuffer, {
          filename: 'resume_v2.docx',
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });

      expect(resReplace.status).toBe(200);
      expect(resReplace.body.data.resume.originalName).toBe('resume_v2.docx');

      const userV2 = await User.findById(user._id).select('+resume.storagePath');
      const v2Path = storageService.getPrivateFilePath(userV2!.resume!.storagePath!);
      expect(fs.existsSync(v2Path)).toBe(true);

      // Verify old v1 file was unlinked
      expect(fs.existsSync(v1Path)).toBe(false);
    });

    it('DELETE /api/v1/users/me/resume unsets metadata and deletes physical file', async () => {
      const { token, user } = await createTestUser();

      await request(app)
        .post('/api/v1/users/me/resume')
        .set('Authorization', `Bearer ${token}`)
        .attach('resume', validPdfBuffer, 'to_delete.pdf');

      const userBefore = await User.findById(user._id).select('+resume.storagePath');
      const filePath = storageService.getPrivateFilePath(userBefore!.resume!.storagePath!);
      expect(fs.existsSync(filePath)).toBe(true);

      // Delete
      const resDelete = await request(app)
        .delete('/api/v1/users/me/resume')
        .set('Authorization', `Bearer ${token}`);

      expect(resDelete.status).toBe(200);
      expect(resDelete.body.success).toBe(true);

      const userAfter = await User.findById(user._id).select('+resume.storagePath');
      expect(userAfter?.resume).toBeNull();
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('DELETE /api/v1/users/me/resume returns 404 RESUME_NOT_FOUND when no resume exists', async () => {
      const { token } = await createTestUser();
      const res = await request(app)
        .delete('/api/v1/users/me/resume')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RESUME_NOT_FOUND');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // C. Visibility Matrix & Download Access
  // ─────────────────────────────────────────────────────────────────────────────
  describe('C. Visibility Matrix & Download Access', () => {
    it('owner can download their own resume via GET /api/v1/users/me/resume', async () => {
      const { token } = await createTestUser();
      await request(app)
        .post('/api/v1/users/me/resume')
        .set('Authorization', `Bearer ${token}`)
        .attach('resume', validPdfBuffer, 'my_own.pdf');

      const res = await request(app)
        .get('/api/v1/users/me/resume')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('admin can download any student resume via GET /api/v1/users/:id/resume', async () => {
      const { user: student, token: studentToken } = await createTestUser({ role: 'student' });
      const { token: adminToken } = await createTestUser({ role: 'admin' });

      await request(app)
        .post('/api/v1/users/me/resume')
        .set('Authorization', `Bearer ${studentToken}`)
        .attach('resume', validPdfBuffer, 'student_cv.pdf');

      const res = await request(app)
        .get(`/api/v1/users/${student._id}/resume`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toContain('attachment');
    });

    it('verified active alumni resume can be downloaded by any authenticated user (public profile rule)', async () => {
      const { user: alumni, token: alumniToken } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
        accountStatus: 'active',
      });
      const { token: studentToken } = await createTestUser({ role: 'student' });

      await request(app)
        .post('/api/v1/users/me/resume')
        .set('Authorization', `Bearer ${alumniToken}`)
        .attach('resume', validPdfBuffer, 'alumni_public.pdf');

      const res = await request(app)
        .get(`/api/v1/users/${alumni._id}/resume`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
    });

    it('accepted alumni mentor CAN download their mentee student resume', async () => {
      const { user: student, token: studentToken } = await createTestUser({ role: 'student' });
      const { user: mentor, token: mentorToken } = await createTestUser({ role: 'alumni' });

      // Student uploads resume
      await request(app)
        .post('/api/v1/users/me/resume')
        .set('Authorization', `Bearer ${studentToken}`)
        .attach('resume', validPdfBuffer, 'mentee_resume.pdf');

      // Create accepted MentorshipRequest
      await MentorshipRequest.create({
        student: student._id,
        mentor: mentor._id,
        status: 'accepted',
        topic: 'Resume Review',
        message: 'Please review my resume',
      });

      // Mentor attempts download
      const res = await request(app)
        .get(`/api/v1/users/${student._id}/resume`)
        .set('Authorization', `Bearer ${mentorToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toContain('attachment');
    });

    it('alumni without accepted mentorship is REJECTED with 404 RESUME_NOT_FOUND from downloading student resume', async () => {
      const { user: student, token: studentToken } = await createTestUser({ role: 'student' });
      const { token: randomAlumniToken } = await createTestUser({ role: 'alumni' });

      await request(app)
        .post('/api/v1/users/me/resume')
        .set('Authorization', `Bearer ${studentToken}`)
        .attach('resume', validPdfBuffer, 'private_student.pdf');

      const res = await request(app)
        .get(`/api/v1/users/${student._id}/resume`)
        .set('Authorization', `Bearer ${randomAlumniToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RESUME_NOT_FOUND');
    });

    it('student who is not owner is REJECTED with 404 from downloading another student resume', async () => {
      const { user: studentA, token: tokenA } = await createTestUser({ role: 'student' });
      const { token: tokenB } = await createTestUser({ role: 'student' });

      await request(app)
        .post('/api/v1/users/me/resume')
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('resume', validPdfBuffer, 'studentA_doc.pdf');

      const res = await request(app)
        .get(`/api/v1/users/${studentA._id}/resume`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RESUME_NOT_FOUND');
    });

    it('pending or rejected mentorship does NOT grant student resume access and returns 404 RESUME_NOT_FOUND', async () => {
      const { user: student, token: studentToken } = await createTestUser({ role: 'student' });
      const { user: mentor, token: mentorToken } = await createTestUser({ role: 'alumni' });

      await request(app)
        .post('/api/v1/users/me/resume')
        .set('Authorization', `Bearer ${studentToken}`)
        .attach('resume', validPdfBuffer, 'mentee.pdf');

      // Pending mentorship request
      await MentorshipRequest.create({
        student: student._id,
        mentor: mentor._id,
        status: 'pending',
        topic: 'Resume Review',
        message: 'Please review',
      });

      const res = await request(app)
        .get(`/api/v1/users/${student._id}/resume`)
        .set('Authorization', `Bearer ${mentorToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RESUME_NOT_FOUND');
    });

    it('enforces uniform existence-hiding: nonexistent user, user with no resume, and unauthorized user produce byte-identical 404 responses', async () => {
      const { user: studentWithResume, token: studentToken } = await createTestUser({ role: 'student' });
      const { user: studentNoResume } = await createTestUser({ role: 'student' });
      const { token: unauthorizedAlumniToken } = await createTestUser({ role: 'alumni' });
      const fakeNonexistentId = new mongoose.Types.ObjectId().toString();

      // Upload resume for studentWithResume
      await request(app)
        .post('/api/v1/users/me/resume')
        .set('Authorization', `Bearer ${studentToken}`)
        .attach('resume', validPdfBuffer, 'confidential_resume.pdf');

      // (a) Nonexistent user
      const resNonexistent = await request(app)
        .get(`/api/v1/users/${fakeNonexistentId}/resume`)
        .set('Authorization', `Bearer ${unauthorizedAlumniToken}`);

      // (b) Existing user with no resume
      const resNoResume = await request(app)
        .get(`/api/v1/users/${studentNoResume._id}/resume`)
        .set('Authorization', `Bearer ${unauthorizedAlumniToken}`);

      // (c) Existing user with resume but unauthorized requester
      const resUnauthorized = await request(app)
        .get(`/api/v1/users/${studentWithResume._id}/resume`)
        .set('Authorization', `Bearer ${unauthorizedAlumniToken}`);

      // Verify status codes
      expect(resNonexistent.status).toBe(404);
      expect(resNoResume.status).toBe(404);
      expect(resUnauthorized.status).toBe(404);

      // Verify byte-identical response bodies (status, code, message)
      expect(resNonexistent.text).toBe(resNoResume.text);
      expect(resNoResume.text).toBe(resUnauthorized.text);

      // Verify payload structure
      expect(resUnauthorized.body).toEqual({
        success: false,
        error: {
          code: 'RESUME_NOT_FOUND',
          message: 'Resume not found.',
        },
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // D. Endpoint Security & Schema Invariants
  // ─────────────────────────────────────────────────────────────────────────────
  describe('D. Endpoint Security & Schema Invariants', () => {
    it('malformed ObjectId returns 404 RESUME_NOT_FOUND cleanly without 500 cast error', async () => {
      const { token } = await createTestUser();
      const res = await request(app)
        .get('/api/v1/users/invalid-object-id/resume')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RESUME_NOT_FOUND');
    });

    it('GET /api/v1/users/me returns hasResume and does NOT leak internal storagePath', async () => {
      const { token, user } = await createTestUser();
      await request(app)
        .post('/api/v1/users/me/resume')
        .set('Authorization', `Bearer ${token}`)
        .attach('resume', validPdfBuffer, 'test_leak.pdf');

      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.hasResume).toBe(true);
      expect(res.body.data.user.resume).toBeDefined();
      expect(res.body.data.user.resume.originalName).toBe('test_leak.pdf');
      expect(res.body.data.user.resume.storagePath).toBeUndefined();
    });

    it('safe user query via SAFE_USER_FIELDS projection never includes storagePath', async () => {
      const { user, token } = await createTestUser();
      await request(app)
        .post('/api/v1/users/me/resume')
        .set('Authorization', `Bearer ${token}`)
        .attach('resume', validPdfBuffer, 'projection_test.pdf');

      const queried = await User.findById(user._id).select(SAFE_USER_FIELDS);
      const json = queried!.toJSON();
      expect(json.resume?.storagePath).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // E. Directory Degree Filter ($elemMatch on education.degree)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('E. Alumni Directory Degree Filter', () => {
    it('filters alumni by degree inside education array using $elemMatch', async () => {
      // Create Alumni A with B.Tech
      await createTestUser({
        name: 'BTech Alumni',
        role: 'alumni',
        verificationStatus: 'admin_approved',
        accountStatus: 'active',
        department: 'Computer Science',
        batch: '2022',
        education: [{ institution: 'Institute of Tech', degree: 'B.Tech', field: 'CS', startYear: 2018 }],
      });

      // Create Alumni B with M.Tech
      await createTestUser({
        name: 'MTech Alumni',
        role: 'alumni',
        verificationStatus: 'admin_approved',
        accountStatus: 'active',
        department: 'Computer Science',
        batch: '2024',
        education: [{ institution: 'University Postgrad', degree: 'M.Tech', field: 'AI', startYear: 2022 }],
      });

      // Create Alumni C with MBA
      await createTestUser({
        name: 'MBA Alumni',
        role: 'alumni',
        verificationStatus: 'admin_approved',
        accountStatus: 'active',
        department: 'Business Administration',
        batch: '2023',
        education: [{ institution: 'Business School', degree: 'MBA', field: 'Finance', startYear: 2021 }],
      });

      // Query for B.Tech
      const resBtech = await request(app).get('/api/v1/alumni?degree=B.Tech');
      expect(resBtech.status).toBe(200);
      expect(resBtech.body.data.alumni.length).toBe(1);
      expect(resBtech.body.data.alumni[0].name).toBe('BTech Alumni');

      // Query for M.Tech
      const resMtech = await request(app).get('/api/v1/alumni?degree=M.Tech');
      expect(resMtech.status).toBe(200);
      expect(resMtech.body.data.alumni.length).toBe(1);
      expect(resMtech.body.data.alumni[0].name).toBe('MTech Alumni');

      // Combined query: department=Computer Science & degree=B.Tech & batch=2022
      const resCombined = await request(app).get(
        '/api/v1/alumni?department=Computer%20Science&degree=B.Tech&batch=2022'
      );
      expect(resCombined.status).toBe(200);
      expect(resCombined.body.data.alumni.length).toBe(1);
      expect(resCombined.body.data.alumni[0].name).toBe('BTech Alumni');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // F. Profile Completion Integrity
  // ─────────────────────────────────────────────────────────────────────────────
  describe('F. Profile Completion Integrity', () => {
    it('calculateProfileCompletion remains 100% frozen and unaltered', () => {
      const studentProfile = {
        role: 'student',
        bio: 'Student bio',
        profilePhotoUrl: '/uploads/avatars/test.jpg',
        location: 'City',
        skills: ['Python'],
        education: [{ institution: 'College', degree: 'B.Tech', field: 'CS', startYear: 2020 }],
        links: { github: 'https://github.com' },
      };

      const score = calculateProfileCompletion(studentProfile);
      // Student: 20 + 25 + 15 + 20 + 10 + 10 = 100
      expect(score).toBe(100);

      // Adding resume to profile object does not alter the mathematical score
      const studentWithResume = {
        ...studentProfile,
        resume: { originalName: 'resume.pdf' },
      };
      expect(calculateProfileCompletion(studentWithResume)).toBe(100);
    });
  });
});
