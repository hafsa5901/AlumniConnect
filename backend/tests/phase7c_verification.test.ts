import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import path from 'path';
import fs from 'fs';
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

describe('Phase 7C — College Identity & Student/Alumni Verification', () => {
  // Helper to create admin
  async function createAdmin(email = 'admin@platform.edu', password = 'AdminPassword123') {
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

  // Helper to create student
  async function createStudent(email = 'student@apex.edu', password = 'StudentPassword123', status: 'pending' | 'email_verified' | 'admin_approved' | 'rejected' = 'email_verified') {
    const passwordHash = await hashPassword(password);
    return User.create({
      name: 'Test Student',
      email,
      passwordHash,
      role: 'student',
      accountStatus: 'active',
      verificationStatus: status,
      department: 'Computer Science',
      batch: '2026',
    });
  }

  // Helper to create alumni
  async function createAlumni(email = 'alumni@apex.edu', password = 'AlumniPassword123', status: 'pending' | 'email_verified' | 'admin_approved' | 'rejected' = 'email_verified') {
    const passwordHash = await hashPassword(password);
    return User.create({
      name: 'Test Alumni',
      email,
      passwordHash,
      role: 'alumni',
      accountStatus: 'active',
      verificationStatus: status,
      department: 'Mechanical Engineering',
      batch: '2021',
    });
  }

  // Helper to login and get token
  async function loginUser(email: string, password = 'StudentPassword123'): Promise<string> {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password });
    return res.body.data.accessToken;
  }

  // Helper to create test college
  async function createTestCollege(name = 'Apex Institute of Technology', code = 'AIT', domains = ['apex.edu', 'ait.edu.in']) {
    return College.create({
      name,
      code,
      domains,
      location: { city: 'New Delhi', country: 'India' },
      website: 'https://apex.edu',
      isActive: true,
    });
  }

  // PDF buffer with %PDF-1.4 header
  const samplePdfBuffer = Buffer.concat([
    Buffer.from('%PDF-1.4\n%âãÏÓ\n'),
    Buffer.from('Sample verification proof document contents...'),
  ]);

  // PNG buffer with PNG magic bytes
  const samplePngBuffer = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from('Fake PNG body data'),
  ]);

  // ── 1. College Master Data Management (Parts 2, 3, 16) ─────────────────────
  describe('1. College Master Data & Domain Normalization', () => {
    it('allows admins to create a canonical college with uppercase code and trimmed lowercase domains', async () => {
      const admin = await createAdmin();
      const token = await loginUser(admin.email, 'AdminPassword123');

      const res = await request(app)
        .post('/api/v1/colleges')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'National University of Engineering',
          code: 'nue',
          domains: ['NUE.EDU ', 'eng.nue.edu'],
          location: { city: 'Bengaluru' },
          website: 'https://nue.edu',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.college.code).toBe('NUE');
      expect(res.body.data.college.domains).toEqual(['nue.edu', 'eng.nue.edu']);

      // Check audit log recorded
      const log = await AdminAuditLog.findOne({ action: 'college.create' });
      expect(log).not.toBeNull();
      expect(log?.targetType).toBe('college');
    });

    it('rejects regular users or alumni from creating colleges', async () => {
      const student = await createStudent();
      const token = await loginUser(student.email, 'StudentPassword123');

      const res = await request(app)
        .post('/api/v1/colleges')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Hacker College',
          code: 'HC',
          domains: ['hacker.edu'],
        });

      expect(res.status).toBe(403);
    });

    it('rejects duplicate college code or duplicate case-insensitive name', async () => {
      await createTestCollege('Apex Institute of Technology', 'AIT', ['apex.edu']);
      const admin = await createAdmin();
      const token = await loginUser(admin.email, 'AdminPassword123');

      const resCode = await request(app)
        .post('/api/v1/colleges')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Another College',
          code: 'AIT',
          domains: ['another.edu'],
        });
      expect(resCode.status).toBe(409);

      const resName = await request(app)
        .post('/api/v1/colleges')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'apex institute of technology',
          code: 'AIT2',
          domains: ['apex2.edu'],
        });
      expect(resName.status).toBe(409);
    });

    it('allows public / authenticated search and pagination of active colleges', async () => {
      await createTestCollege('Apex Institute', 'AIT', ['apex.edu']);
      await createTestCollege('Global Tech University', 'GTU', ['gtu.ac.in']);

      const res = await request(app).get('/api/v1/colleges?search=Apex');
      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].code).toBe('AIT');
    });
  });

  // ── 2. Verification Submission & Domain Matching (Parts 4, 6, 7, 8) ────────
  describe('2. Verification Submission & Domain Matching Logic', () => {
    it('sets collegeDomainVerified: true for student with matching official domain', async () => {
      const college = await createTestCollege('Apex Institute', 'AIT', ['apex.edu']);
      const student = await createStudent('john@apex.edu');
      const token = await loginUser(student.email, 'StudentPassword123');

      const res = await request(app)
        .post('/api/v1/verification-requests')
        .set('Authorization', `Bearer ${token}`)
        .send({
          collegeId: college._id.toString(),
          note: 'First-year B.Tech student',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.verificationRequest.collegeDomainVerified).toBe(true);

      const updatedUser = await User.findById(student._id);
      expect(updatedUser?.college?.toString()).toBe(college._id.toString());
      expect(updatedUser?.collegeDomainVerified).toBe(true);
    });

    it('requires proof document for student with non-institutional email domain', async () => {
      const college = await createTestCollege('Apex Institute', 'AIT', ['apex.edu']);
      const student = await createStudent('john.doe@gmail.com');
      const token = await loginUser(student.email, 'StudentPassword123');

      // Attempt without document
      const resNoDoc = await request(app)
        .post('/api/v1/verification-requests')
        .set('Authorization', `Bearer ${token}`)
        .send({
          collegeId: college._id.toString(),
        });

      expect(resNoDoc.status).toBe(400);
      expect(resNoDoc.body.error.code).toBe('DOCUMENT_REQUIRED');

      // Submit with valid PDF document
      const resWithDoc = await request(app)
        .post('/api/v1/verification-requests')
        .set('Authorization', `Bearer ${token}`)
        .field('collegeId', college._id.toString())
        .attach('document', samplePdfBuffer, 'student_id_card.pdf');

      expect(resWithDoc.status).toBe(201);
      expect(resWithDoc.body.data.verificationRequest.status).toBe('pending');
      expect(resWithDoc.body.data.verificationRequest.collegeDomainVerified).toBe(false);
      expect(resWithDoc.body.data.verificationRequest.document.originalName).toBe('student_id_card.pdf');
    });

    it('requires proof document for alumni unconditionally and sets pending status', async () => {
      const college = await createTestCollege('Apex Institute', 'AIT', ['apex.edu']);
      const alumni = await createAlumni('sarah@apex.edu', 'AlumniPassword123', 'email_verified');
      const token = await loginUser(alumni.email, 'AlumniPassword123');

      // Attempt without document
      const resNoDoc = await request(app)
        .post('/api/v1/verification-requests')
        .set('Authorization', `Bearer ${token}`)
        .send({
          collegeId: college._id.toString(),
        });

      expect(resNoDoc.status).toBe(400);
      expect(resNoDoc.body.error.code).toBe('DOCUMENT_REQUIRED');

      // Submit with valid PNG document
      const resWithDoc = await request(app)
        .post('/api/v1/verification-requests')
        .set('Authorization', `Bearer ${token}`)
        .field('collegeId', college._id.toString())
        .attach('document', samplePngBuffer, 'degree_certificate.png');

      expect(resWithDoc.status).toBe(201);
      expect(resWithDoc.body.data.verificationRequest.status).toBe('pending');
      expect(resWithDoc.body.data.verificationRequest.collegeDomainVerified).toBe(true);
    });

    it('rejects spoofed file with fake extension and invalid magic bytes', async () => {
      const college = await createTestCollege('Apex Institute', 'AIT', ['apex.edu']);
      const alumni = await createAlumni('sarah.alumni@gmail.com', 'AlumniPassword123', 'email_verified');
      const token = await loginUser(alumni.email, 'AlumniPassword123');

      const fakeBuffer = Buffer.from('Plain executable text masquerading as pdf');

      const res = await request(app)
        .post('/api/v1/verification-requests')
        .set('Authorization', `Bearer ${token}`)
        .field('collegeId', college._id.toString())
        .attach('document', fakeBuffer, 'degree.pdf');

      expect(res.status).toBe(400);
      expect(['FILE_SIGNATURE_MISMATCH', 'FILE_CORRUPTED_OR_SPOOFED']).toContain(res.body.error.code);
    });

    it('prevents submitting multiple concurrent pending requests', async () => {
      const college = await createTestCollege('Apex Institute', 'AIT', ['apex.edu']);
      const student = await createStudent('alice@gmail.com');
      const token = await loginUser(student.email, 'StudentPassword123');

      // First submission
      await request(app)
        .post('/api/v1/verification-requests')
        .set('Authorization', `Bearer ${token}`)
        .field('collegeId', college._id.toString())
        .attach('document', samplePdfBuffer, 'alice_id.pdf');

      // Second submission while first is still pending
      const resDup = await request(app)
        .post('/api/v1/verification-requests')
        .set('Authorization', `Bearer ${token}`)
        .field('collegeId', college._id.toString())
        .attach('document', samplePdfBuffer, 'alice_id_2.pdf');

      expect(resDup.status).toBe(409);
      expect(resDup.body.error.code).toBe('REQUEST_ALREADY_PENDING');
    });
  });

  // ── 3. Admin Verification Queue & Atomic Transitions (Parts 9, 10, 11) ──────
  describe('3. Admin Queue & Atomic Approvals/Rejections', () => {
    it('allows admin to list pending verification requests with populated user and college', async () => {
      const college = await createTestCollege('Apex Institute', 'AIT', ['apex.edu']);
      const alumni = await createAlumni('alumni1@gmail.com');
      const alumniToken = await loginUser(alumni.email, 'AlumniPassword123');

      await request(app)
        .post('/api/v1/verification-requests')
        .set('Authorization', `AlumniToken ${alumniToken}`.replace('AlumniToken', 'Bearer'))
        .field('collegeId', college._id.toString())
        .attach('document', samplePdfBuffer, 'alumni_degree.pdf');

      const admin = await createAdmin();
      const adminToken = await loginUser(admin.email, 'AdminPassword123');

      const res = await request(app)
        .get('/api/v1/admin/verification-requests?status=pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].college.code).toBe('AIT');
      expect(res.body.data.items[0].user.email).toBe('alumni1@gmail.com');
    });

    it('approves verification request atomically and updates user verificationStatus to admin_approved', async () => {
      const college = await createTestCollege('Apex Institute', 'AIT', ['apex.edu']);
      const alumni = await createAlumni('alumni2@gmail.com');
      const alumniToken = await loginUser(alumni.email, 'AlumniPassword123');

      const subRes = await request(app)
        .post('/api/v1/verification-requests')
        .set('Authorization', `Bearer ${alumniToken}`)
        .field('collegeId', college._id.toString())
        .attach('document', samplePdfBuffer, 'alumni_degree.pdf');

      const requestId = subRes.body.data.verificationRequest.id || subRes.body.data.verificationRequest._id;

      const admin = await createAdmin();
      const adminToken = await loginUser(admin.email, 'AdminPassword123');

      const approveRes = await request(app)
        .patch(`/api/v1/admin/verification-requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.verificationRequest.status).toBe('approved');
      expect(approveRes.body.data.user.verificationStatus).toBe('admin_approved');

      // Invariant check: target User document reflects admin_approved
      const user = await User.findById(alumni._id);
      expect(user?.verificationStatus).toBe('admin_approved');
      expect(user?.college?.toString()).toBe(college._id.toString());

      // Audit log created
      const audit = await AdminAuditLog.findOne({ action: 'verification.approve' });
      expect(audit).not.toBeNull();
    });

    it('rejects verification request and updates user status to rejected', async () => {
      const college = await createTestCollege('Apex Institute', 'AIT', ['apex.edu']);
      const student = await createStudent('student_fake@gmail.com');
      const studentToken = await loginUser(student.email, 'StudentPassword123');

      const subRes = await request(app)
        .post('/api/v1/verification-requests')
        .set('Authorization', `Bearer ${studentToken}`)
        .field('collegeId', college._id.toString())
        .attach('document', samplePdfBuffer, 'student_id.pdf');

      const requestId = subRes.body.data.verificationRequest.id || subRes.body.data.verificationRequest._id;

      const admin = await createAdmin();
      const adminToken = await loginUser(admin.email, 'AdminPassword123');

      const rejectRes = await request(app)
        .patch(`/api/v1/admin/verification-requests/${requestId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Student ID card is expired and unreadable.' });

      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.data.verificationRequest.status).toBe('rejected');
      expect(rejectRes.body.data.verificationRequest.rejectionReason).toBe('Student ID card is expired and unreadable.');

      const user = await User.findById(student._id);
      expect(user?.verificationStatus).toBe('rejected');
      expect(user?.rejectionReason).toBe('Student ID card is expired and unreadable.');
    });

    it('enforces concurrency guard: second admin approval on already handled request fails with 404', async () => {
      const college = await createTestCollege('Apex Institute', 'AIT', ['apex.edu']);
      const student = await createStudent('concurrency_test@gmail.com');
      const studentToken = await loginUser(student.email, 'StudentPassword123');

      const subRes = await request(app)
        .post('/api/v1/verification-requests')
        .set('Authorization', `Bearer ${studentToken}`)
        .field('collegeId', college._id.toString())
        .attach('document', samplePdfBuffer, 'student_id.pdf');

      const requestId = subRes.body.data.verificationRequest.id || subRes.body.data.verificationRequest._id;

      const admin = await createAdmin();
      const adminToken = await loginUser(admin.email, 'AdminPassword123');

      // First admin approves
      const res1 = await request(app)
        .patch(`/api/v1/admin/verification-requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res1.status).toBe(200);

      // Competing second admin tries to approve or reject
      const res2 = await request(app)
        .patch(`/api/v1/admin/verification-requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res2.status).toBe(404);
      expect(res2.body.error.code).toBe('REQUEST_NOT_PENDING');
    });
  });

  // ── 4. Resubmission & State Machine Transitions (Parts 0.1, 12, 22) ────────
  describe('4. Rejection and Resubmission Transitions', () => {
    it('allows a rejected user to resubmit with rejected -> email_verified transition', async () => {
      const college = await createTestCollege('Apex Institute', 'AIT', ['apex.edu']);
      const student = await createStudent('resubmit_student@gmail.com', 'StudentPassword123', 'rejected');
      const token = await loginUser(student.email, 'StudentPassword123');

      // Create previous rejected request record
      const oldReq = await VerificationRequest.create({
        user: student._id,
        college: college._id,
        role: 'student',
        status: 'rejected',
        collegeDomainVerified: false,
        rejectionReason: 'Blurry document image',
      });

      // User calls resubmit
      const res = await request(app)
        .post('/api/v1/verification-requests/resubmit')
        .set('Authorization', `Bearer ${token}`)
        .field('collegeId', college._id.toString())
        .attach('document', samplePdfBuffer, 'new_clear_id.pdf')
        .field('note', 'Resubmitting with clear high-resolution scan');

      expect(res.status).toBe(201);
      expect(res.body.data.verificationRequest.status).toBe('pending');

      // Old request should be superseded
      const prev = await VerificationRequest.findById(oldReq._id);
      expect(prev?.status).toBe('superseded');

      // User enum transitioned to email_verified
      const updatedUser = await User.findById(student._id);
      expect(updatedUser?.verificationStatus).toBe('email_verified');
      expect(updatedUser?.rejectionReason).toBeUndefined();
    });

    it('rejects resubmission if user does not have a rejected request or status', async () => {
      const college = await createTestCollege('Apex Institute', 'AIT', ['apex.edu']);
      const student = await createStudent('approved_student@gmail.com', 'StudentPassword123', 'admin_approved');
      const token = await loginUser(student.email, 'StudentPassword123');

      const res = await request(app)
        .post('/api/v1/verification-requests/resubmit')
        .set('Authorization', `Bearer ${token}`)
        .field('collegeId', college._id.toString())
        .attach('document', samplePdfBuffer, 'unneeded.pdf');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('NO_REJECTED_REQUEST');
    });
  });

  // ── 5. Existence-Hiding Document Access Security (Parts 8, 20, 22) ───────────
  describe('5. Existence-Hiding Document Access Security', () => {
    it('returns 200 with security headers for submitter and admin', async () => {
      const college = await createTestCollege('Apex Institute', 'AIT', ['apex.edu']);
      const student = await createStudent('doc_owner@gmail.com');
      const ownerToken = await loginUser(student.email, 'StudentPassword123');

      const subRes = await request(app)
        .post('/api/v1/verification-requests')
        .set('Authorization', `Bearer ${ownerToken}`)
        .field('collegeId', college._id.toString())
        .attach('document', samplePdfBuffer, 'my_secret_id.pdf');

      const requestId = subRes.body.data.verificationRequest.id || subRes.body.data.verificationRequest._id;

      // Submitter accesses document
      const ownerDocRes = await request(app)
        .get(`/api/v1/verification-requests/${requestId}/document`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(ownerDocRes.status).toBe(200);
      expect(ownerDocRes.headers['content-type']).toBe('application/pdf');
      expect(ownerDocRes.headers['x-content-type-options']).toBe('nosniff');
      expect(ownerDocRes.headers['content-disposition']).toContain('attachment');

      // Admin accesses document
      const admin = await createAdmin();
      const adminToken = await loginUser(admin.email, 'AdminPassword123');

      const adminDocRes = await request(app)
        .get(`/api/v1/verification-requests/${requestId}/document`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminDocRes.status).toBe(200);
    });

    it('returns exact 404 NOT_FOUND for unauthorized user to hide document existence', async () => {
      const college = await createTestCollege('Apex Institute', 'AIT', ['apex.edu']);
      const student = await createStudent('doc_owner2@gmail.com');
      const ownerToken = await loginUser(student.email, 'StudentPassword123');

      const subRes = await request(app)
        .post('/api/v1/verification-requests')
        .set('Authorization', `Bearer ${ownerToken}`)
        .field('collegeId', college._id.toString())
        .attach('document', samplePdfBuffer, 'private_transcript.pdf');

      const requestId = subRes.body.data.verificationRequest.id || subRes.body.data.verificationRequest._id;

      // Another student tries to access
      const attacker = await createStudent('snooper@gmail.com', 'StudentPassword123');
      const attackerToken = await loginUser(attacker.email, 'StudentPassword123');

      const unauthorizedRes = await request(app)
        .get(`/api/v1/verification-requests/${requestId}/document`)
        .set('Authorization', `Bearer ${attackerToken}`);

      // Must be 404 (existence-hiding), not 403
      expect(unauthorizedRes.status).toBe(404);
      expect(unauthorizedRes.body.error.code).toBe('DOCUMENT_NOT_FOUND');

      // Random non-existent ID also returns identical 404
      const fakeId = new mongoose.Types.ObjectId().toString();
      const notFoundRes = await request(app)
        .get(`/api/v1/verification-requests/${fakeId}/document`)
        .set('Authorization', `Bearer ${attackerToken}`);

      expect(notFoundRes.status).toBe(404);
      expect(notFoundRes.body.error.code).toBe('DOCUMENT_NOT_FOUND');
    });
  });

  // ── 6. Downstream Feature Gate & Role Change Interaction (Parts 0.1, 19, 22) ─
  describe('6. Role Change Interaction & Verification Gating Invariant', () => {
    it('resets verificationStatus to pending when role changes between student and alumni', async () => {
      const college = await createTestCollege('Apex Institute', 'AIT', ['apex.edu']);
      const student = await createStudent('graduating_student@apex.edu', 'StudentPassword123', 'email_verified');
      student.college = college._id;
      student.collegeDomainVerified = true;
      await student.save();

      const admin = await createAdmin();
      const adminToken = await loginUser(admin.email, 'AdminPassword123');

      // Admin promotes student to alumni
      const res = await request(app)
        .patch(`/api/v1/admin/users/${student._id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'alumni',
          reason: 'Graduated from university, transitioning to alumni status',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe('alumni');
      expect(res.body.data.user.verificationStatus).toBe('pending');

      // The new alumni cannot bypass admin review for alumni-gated features
      const userAfter = await User.findById(student._id);
      expect(userAfter?.verificationStatus).toBe('pending');
    });
  });
});
