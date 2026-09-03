import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app';
import User from '../src/models/User';
import { hashPassword } from '../src/utils/auth';

const CLIENT_ORIGIN = 'http://localhost:5173';

jest.setTimeout(30000);

describe('Phase 3B — Backend Verification Suite', () => {
  let mongoServer: MongoMemoryServer;
  let studentToken: string;
  let studentUser: any;
  let alumniToken: string;
  let alumniUser: any;
  let pendingAlumniUser: any;
  let suspendedAlumniUser: any;
  let adminToken: string;
  let adminUser: any;
  let cpToken: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Clear test database collections
    await User.deleteMany({});

    // 1. Create Student
    const pwHash = await hashPassword('Password1234');
    studentUser = await User.create({
      name: 'Test Student',
      email: 'student_3b@college.edu',
      passwordHash: pwHash,
      role: 'student',
      accountStatus: 'active',
      verificationStatus: 'admin_approved',
      department: 'Computer Science',
      batch: '2025',
    });

    // 2. Create Approved Alumni
    alumniUser = await User.create({
      name: 'Approved Alumni',
      email: 'alumni_3b@college.edu',
      passwordHash: pwHash,
      role: 'alumni',
      accountStatus: 'active',
      verificationStatus: 'admin_approved',
      department: 'Computer Science',
      batch: '2020',
      company: 'TechCorp',
      designation: 'Staff Engineer',
      location: 'San Francisco',
      skills: ['TypeScript', 'Node.js', 'React'],
      bio: 'Alumni software architect.',
      education: [
        {
          institution: 'College of Engineering',
          degree: 'B.Tech',
          field: 'Computer Science',
          startYear: 2016,
          endYear: 2020,
        },
      ],
      experience: [
        {
          company: 'TechCorp',
          title: 'Staff Engineer',
          startDate: '2020-08',
          description: 'Platform architect.',
        },
      ],
      links: { linkedin: 'https://linkedin.com/in/alumni3b' },
      mentorshipEnabled: true,
    });

    // 3. Create Pending Alumni
    pendingAlumniUser = await User.create({
      name: 'Pending Alumni',
      email: 'pending_alumni@college.edu',
      passwordHash: pwHash,
      role: 'alumni',
      accountStatus: 'active',
      verificationStatus: 'pending',
      department: 'Electrical Engineering',
      batch: '2021',
    });

    // 4. Create Suspended Alumni
    suspendedAlumniUser = await User.create({
      name: 'Suspended Alumni',
      email: 'suspended_alumni@college.edu',
      passwordHash: pwHash,
      role: 'alumni',
      accountStatus: 'suspended',
      verificationStatus: 'admin_approved',
      department: 'Mechanical Engineering',
      batch: '2019',
    });

    // 5. Create Admin
    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin_3b@college.edu',
      passwordHash: pwHash,
      role: 'admin',
      accountStatus: 'active',
      verificationStatus: 'admin_approved',
    });

    // 6. Create User for Password Change test
    const cpPwHash = await hashPassword('CurrentPass123');
    await User.create({
      name: 'Change Pass User',
      email: 'cp_user@college.edu',
      passwordHash: cpPwHash,
      role: 'student',
      accountStatus: 'active',
      verificationStatus: 'admin_approved',
    });

    // Login each to get access tokens
    const studentLogin = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', CLIENT_ORIGIN)
      .send({ email: 'student_3b@college.edu', password: 'Password1234' });
    studentToken = studentLogin.body.data.accessToken;

    const alumniLogin = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', CLIENT_ORIGIN)
      .send({ email: 'alumni_3b@college.edu', password: 'Password1234' });
    alumniToken = alumniLogin.body.data.accessToken;

    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', CLIENT_ORIGIN)
      .send({ email: 'admin_3b@college.edu', password: 'Password1234' });
    adminToken = adminLogin.body.data.accessToken;

    const cpLogin = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', CLIENT_ORIGIN)
      .send({ email: 'cp_user@college.edu', password: 'CurrentPass123' });
    cpToken = cpLogin.body.data.accessToken;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('1. Role Guards', () => {
    it('should forbid student from accessing /api/v1/dashboard/admin with 403 FORBIDDEN_ROLE', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/admin')
        .set('Origin', CLIENT_ORIGIN)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('should forbid alumni from accessing /api/v1/dashboard/admin with 403 FORBIDDEN_ROLE', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/admin')
        .set('Origin', CLIENT_ORIGIN)
        .set('Authorization', `Bearer ${alumniToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('should forbid student from accessing /api/v1/dashboard/alumni with 403 FORBIDDEN_ROLE', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/alumni')
        .set('Origin', CLIENT_ORIGIN)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('should allow student to access /api/v1/dashboard/student with profileCompletion and alumniPreview', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/student')
        .set('Origin', CLIENT_ORIGIN)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('profileCompletion');
      expect(Array.isArray(res.body.data.alumniPreview)).toBe(true);
      expect(res.body.data.alumniPreview.length).toBeGreaterThan(0);
    });

    it('should allow alumni to access /api/v1/dashboard/alumni with networkStats', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/alumni')
        .set('Origin', CLIENT_ORIGIN)
        .set('Authorization', `Bearer ${alumniToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.networkStats).toHaveProperty('departmentAlumniCount');
      expect(res.body.data.networkStats).toHaveProperty('batchAlumniCount');
    });

    it('should allow admin to access /api/v1/dashboard/admin with metrics and distributions', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/admin')
        .set('Origin', CLIENT_ORIGIN)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.metrics).toHaveProperty('totalUsers');
      expect(res.body.data.metrics).toHaveProperty('verifiedAlumni');
      expect(res.body.data.distributions).toHaveProperty('byRole');
      expect(res.body.data.distributions).toHaveProperty('byDepartment');
    });
  });

  describe('2. Profile Update (PATCH /api/v1/users/me)', () => {
    it('should strip alumni-only fields when submitted by a student', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Origin', CLIENT_ORIGIN)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          bio: 'Undergraduate student bio.',
          location: 'Boston',
          skills: ['Python', 'SQL'],
          company: 'HackerCorp', // Alumni-only
          designation: 'CEO',     // Alumni-only
          mentorshipEnabled: true, // Alumni-only
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.bio).toBe('Undergraduate student bio.');
      expect(res.body.data.user.location).toBe('Boston');
      expect(res.body.data.user.skills).toEqual(['Python', 'SQL']);
      expect(res.body.data.user.company).toBeUndefined();
      expect(res.body.data.user.designation).toBeUndefined();
      expect(res.body.data.user.mentorshipEnabled).toBe(false);
    });

    it('should strip institutional and security fields for all users', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Origin', CLIENT_ORIGIN)
        .set('Authorization', `Bearer ${alumniToken}`)
        .send({
          department: 'Architecture', // Immutable
          batch: '1990',               // Immutable
          role: 'admin',               // Immutable
          accountStatus: 'suspended',  // Immutable
          verificationStatus: 'rejected', // Immutable
          company: 'Google',
          designation: 'Senior Staff Engineer',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.department).toBe('Computer Science');
      expect(res.body.data.user.batch).toBe('2020');
      expect(res.body.data.user.role).toBe('alumni');
      expect(res.body.data.user.company).toBe('Google');
      expect(res.body.data.user.designation).toBe('Senior Staff Engineer');
    });

    it('should calculate accurate profile completion score', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Origin', CLIENT_ORIGIN)
        .set('Authorization', `Bearer ${alumniToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.profileCompletion).toBe('number');
      expect(res.body.data.profileCompletion).toBeGreaterThanOrEqual(50);
    });
  });

  describe('3. Alumni Directory & Profile (GET /api/v1/alumni)', () => {
    it('should list only verified and active alumni with public safe fields', async () => {
      const res = await request(app)
        .get('/api/v1/alumni')
        .set('Origin', CLIENT_ORIGIN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.alumni)).toBe(true);
      expect(res.body.data.pagination).toHaveProperty('total');

      const foundPending = res.body.data.alumni.find((a: any) => a.name === 'Pending Alumni');
      const foundSuspended = res.body.data.alumni.find((a: any) => a.name === 'Suspended Alumni');
      const foundStudent = res.body.data.alumni.find((a: any) => a.name === 'Test Student');

      expect(foundPending).toBeUndefined();
      expect(foundSuspended).toBeUndefined();
      expect(foundStudent).toBeUndefined();

      const approved = res.body.data.alumni.find((a: any) => a.name === 'Approved Alumni');
      expect(approved).toBeDefined();
      expect(approved.id).toBe(alumniUser._id.toString());
      expect(approved.email).toBeUndefined(); // Never leak private email
    });

    it('should return full detail payload for approved and active alumni (GET /api/v1/alumni/:id)', async () => {
      const res = await request(app)
        .get(`/api/v1/alumni/${alumniUser._id}`)
        .set('Origin', CLIENT_ORIGIN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.alumni.id).toBe(alumniUser._id.toString());
      expect(res.body.data.alumni.name).toBe('Approved Alumni');
      expect(res.body.data.alumni.bio).toBe('Alumni software architect.');
      expect(Array.isArray(res.body.data.alumni.education)).toBe(true);
      expect(Array.isArray(res.body.data.alumni.experience)).toBe(true);
      expect(res.body.data.alumni.links).toHaveProperty('linkedin');
      expect(res.body.data.alumni.email).toBeUndefined();
    });

    it('should return 404 NOT_FOUND for student id query', async () => {
      const res = await request(app)
        .get(`/api/v1/alumni/${studentUser._id}`)
        .set('Origin', CLIENT_ORIGIN);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 404 NOT_FOUND for pending alumni id query', async () => {
      const res = await request(app)
        .get(`/api/v1/alumni/${pendingAlumniUser._id}`)
        .set('Origin', CLIENT_ORIGIN);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 404 NOT_FOUND for suspended alumni id query', async () => {
      const res = await request(app)
        .get(`/api/v1/alumni/${suspendedAlumniUser._id}`)
        .set('Origin', CLIENT_ORIGIN);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 404 NOT_FOUND for malformed ObjectId string without throwing 500', async () => {
      const res = await request(app)
        .get('/api/v1/alumni/invalid-id-not-objectid')
        .set('Origin', CLIENT_ORIGIN);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('4. Avatar Photo Upload (POST /api/v1/users/me/photo)', () => {
    it('should upload a valid JPEG image and return profilePhotoUrl', async () => {
      const fakeImageBuffer = Buffer.from('fake-jpeg-binary-data');

      const res = await request(app)
        .post('/api/v1/users/me/photo')
        .set('Origin', CLIENT_ORIGIN)
        .set('Authorization', `Bearer ${studentToken}`)
        .attach('photo', fakeImageBuffer, { filename: 'avatar.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.profilePhotoUrl).toMatch(/^\/uploads\/avatars\/.*\.jpg$/);
    });

    it('should reject invalid MIME type with 400 VALIDATION_ERROR', async () => {
      const fakeTextBuffer = Buffer.from('not an image');

      const res = await request(app)
        .post('/api/v1/users/me/photo')
        .set('Origin', CLIENT_ORIGIN)
        .set('Authorization', `Bearer ${studentToken}`)
        .attach('photo', fakeTextBuffer, { filename: 'file.txt', contentType: 'text/plain' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject oversized images (>5MB) with 413 FILE_TOO_LARGE', async () => {
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB

      const res = await request(app)
        .post('/api/v1/users/me/photo')
        .set('Origin', CLIENT_ORIGIN)
        .set('Authorization', `Bearer ${studentToken}`)
        .attach('photo', largeBuffer, { filename: 'huge.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(413);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FILE_TOO_LARGE');
    });
  });

  describe('5. Change Password (POST /api/v1/auth/change-password)', () => {
    it('should reject wrong current password with 401 INVALID_CREDENTIALS', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Origin', CLIENT_ORIGIN)
        .set('Authorization', `Bearer ${cpToken}`)
        .send({
          currentPassword: 'WrongPassword999',
          newPassword: 'BrandNewPass123',
          confirmPassword: 'BrandNewPass123',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject weak new password with 422 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Origin', CLIENT_ORIGIN)
        .set('Authorization', `Bearer ${cpToken}`)
        .send({
          currentPassword: 'CurrentPass123',
          newPassword: 'weak',
          confirmPassword: 'weak',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should successfully change password, revoke refresh token, and enforce new password on login', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Origin', CLIENT_ORIGIN)
        .set('Authorization', `Bearer ${cpToken}`)
        .send({
          currentPassword: 'CurrentPass123',
          newPassword: 'BrandNewPass123',
          confirmPassword: 'BrandNewPass123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Old password must fail
      const oldLogin = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', CLIENT_ORIGIN)
        .send({ email: 'cp_user@college.edu', password: 'CurrentPass123' });
      expect(oldLogin.status).toBe(401);

      // New password must succeed
      const newLogin = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', CLIENT_ORIGIN)
        .send({ email: 'cp_user@college.edu', password: 'BrandNewPass123' });
      expect(newLogin.status).toBe(200);
      expect(newLogin.body.success).toBe(true);
    });
  });
});
