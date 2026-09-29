import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import fs from 'fs';
import path from 'path';
import app from '../src/app';
import User from '../src/models/User';
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
});

describe('Avatar Upload, Persistence & Display Suite', () => {
  async function createTestUser(email = 'student@apex.edu', password = 'Password123') {
    const passwordHash = await hashPassword(password);
    const user = await User.create({
      name: 'Test Student',
      email,
      passwordHash,
      role: 'student',
      accountStatus: 'active',
      verificationStatus: 'admin_approved',
      department: 'Computer Science',
      batch: '2025',
    });

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email,
      password,
    });

    return { user, token: loginRes.body.data.accessToken };
  }

  // 1x1 1-byte JPEG/PNG buffer helpers
  const dummyJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xd9,
  ]);

  const dummyPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ]);

  describe('1. Upload, Persistence & Endpoints', () => {
    it('allows authenticated user to upload avatar and persists to DB and disk', async () => {
      const { user, token } = await createTestUser();

      const uploadRes = await request(app)
        .post('/api/v1/users/me/photo')
        .set('Authorization', `Bearer ${token}`)
        .attach('photo', dummyJpegBuffer, 'avatar.jpg');

      expect(uploadRes.status).toBe(200);
      expect(uploadRes.body.success).toBe(true);
      expect(uploadRes.body.data.profilePhotoUrl).toMatch(/^\/uploads\/avatars\/[a-f0-9-]+\.jpg$/);

      const newUrl = uploadRes.body.data.profilePhotoUrl;

      // Check DB persistence
      const updatedUser = await User.findById(user._id);
      expect(updatedUser?.profilePhotoUrl).toBe(newUrl);

      // Check GET /api/v1/auth/me returns profilePhotoUrl
      const authMeRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(authMeRes.status).toBe(200);
      expect(authMeRes.body.data.user.profilePhotoUrl).toBe(newUrl);

      // Check GET /api/v1/users/me returns profilePhotoUrl
      const userMeRes = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(userMeRes.status).toBe(200);
      expect(userMeRes.body.data.user.profilePhotoUrl).toBe(newUrl);

      // Verify file exists in uploads folder
      const diskPath = path.resolve(process.cwd(), newUrl.replace(/^\//, ''));
      expect(fs.existsSync(diskPath)).toBe(true);
    });

    it('generates unique URLs on successive uploads and cleans up old file', async () => {
      const { token } = await createTestUser();

      // First upload
      const upload1 = await request(app)
        .post('/api/v1/users/me/photo')
        .set('Authorization', `Bearer ${token}`)
        .attach('photo', dummyJpegBuffer, 'photo1.jpg');

      const url1 = upload1.body.data.profilePhotoUrl;
      const file1Path = path.resolve(process.cwd(), url1.replace(/^\//, ''));
      expect(fs.existsSync(file1Path)).toBe(true);

      // Second upload (PNG)
      const upload2 = await request(app)
        .post('/api/v1/users/me/photo')
        .set('Authorization', `Bearer ${token}`)
        .attach('photo', dummyPngBuffer, 'photo2.png');

      const url2 = upload2.body.data.profilePhotoUrl;
      const file2Path = path.resolve(process.cwd(), url2.replace(/^\//, ''));

      // URLs must be distinct (unique UUIDs)
      expect(url1).not.toBe(url2);
      expect(url2).toMatch(/^\/uploads\/avatars\/[a-f0-9-]+\.png$/);
      expect(fs.existsSync(file2Path)).toBe(true);
      // Old file should be cleaned up
      expect(fs.existsSync(file1Path)).toBe(false);
    });
  });

  describe('2. Validation & Error Handling', () => {
    it('rejects unauthenticated upload with 401', async () => {
      const res = await request(app)
        .post('/api/v1/users/me/photo')
        .attach('photo', dummyJpegBuffer, 'avatar.jpg');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unsupported MIME types (e.g. PDF)', async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post('/api/v1/users/me/photo')
        .set('Authorization', `Bearer ${token}`)
        .attach('photo', Buffer.from('dummy pdf content'), 'document.pdf');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects oversized files (> 5MB)', async () => {
      const { token } = await createTestUser();
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB

      const res = await request(app)
        .post('/api/v1/users/me/photo')
        .set('Authorization', `Bearer ${token}`)
        .attach('photo', largeBuffer, 'large.jpg');

      expect([400, 413]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('rejects request with missing photo field', async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post('/api/v1/users/me/photo')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('3. Cross-User Isolation', () => {
    it('ensures updating one user avatar does not alter another user avatar', async () => {
      const { token: token1 } = await createTestUser('user1@apex.edu');
      const { token: token2 } = await createTestUser('user2@apex.edu');

      // Upload for user 1
      const res1 = await request(app)
        .post('/api/v1/users/me/photo')
        .set('Authorization', `Bearer ${token1}`)
        .attach('photo', dummyJpegBuffer, 'user1.jpg');

      // Upload for user 2
      const res2 = await request(app)
        .post('/api/v1/users/me/photo')
        .set('Authorization', `Bearer ${token2}`)
        .attach('photo', dummyPngBuffer, 'user2.png');

      const u1 = await User.findOne({ email: 'user1@apex.edu' });
      const u2 = await User.findOne({ email: 'user2@apex.edu' });

      expect(u1?.profilePhotoUrl).toBe(res1.body.data.profilePhotoUrl);
      expect(u2?.profilePhotoUrl).toBe(res2.body.data.profilePhotoUrl);
      expect(u1?.profilePhotoUrl).not.toBe(u2?.profilePhotoUrl);
    });
  });
});
