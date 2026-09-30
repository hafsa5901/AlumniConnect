import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app';
import User from '../src/models/User';
import * as emailService from '../src/services/emailService';
import * as authService from '../src/services/authService';

let mongoServer: MongoMemoryServer;
let sentOtps: { to: string; otp: string }[] = [];

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
  sentOtps = [];
  jest.spyOn(emailService, 'sendOtpVerificationEmail').mockImplementation(async (to, _name, otp) => {
    sentOtps.push({ to, otp });
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Student Registration Institutional Email Domain Restriction (@gndecb.ac.in)', () => {
  // ── Valid Student Domain Tests ──────────────────────────────────────────────
  it('allows valid student registration with exact institutional email (student@gndecb.ac.in)', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Valid Student',
      email: 'student@gndecb.ac.in',
      password: 'SecurePassword123',
      confirmPassword: 'SecurePassword123',
      role: 'student',
      department: 'Computer Science',
      batch: '2026',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.verificationRequired).toBe(true);
    expect(sentOtps.length).toBe(1);
    expect(sentOtps[0].to).toBe('student@gndecb.ac.in');
  });

  it('allows valid student registration with uppercase domain variation (Student@GNDECB.AC.IN)', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Upper Student',
      email: 'Student@GNDECB.AC.IN',
      password: 'SecurePassword123',
      confirmPassword: 'SecurePassword123',
      role: 'student',
      department: 'Computer Science',
      batch: '2026',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.verificationRequired).toBe(true);
    expect(sentOtps.length).toBe(1);
    expect(sentOtps[0].to).toBe('student@gndecb.ac.in');

    const inDb = await User.findOne({ email: 'student@gndecb.ac.in' });
    expect(inDb).not.toBeNull();
  });

  it('normalizes leading/trailing whitespace correctly', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Padded Student',
      email: '   spaced.student@gndecb.ac.in   ',
      password: 'SecurePassword123',
      confirmPassword: 'SecurePassword123',
      role: 'student',
      department: 'Computer Science',
      batch: '2026',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(sentOtps.length).toBe(1);
    expect(sentOtps[0].to).toBe('spaced.student@gndecb.ac.in');
  });

  // ── Invalid Student Domain Rejection Tests ──────────────────────────────────
  it('rejects student registration with student@gmail.com and does NOT send OTP', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Gmail Student',
      email: 'student@gmail.com',
      password: 'SecurePassword123',
      confirmPassword: 'SecurePassword123',
      role: 'student',
      department: 'Computer Science',
      batch: '2026',
    });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(sentOtps.length).toBe(0);

    const inDb = await User.findOne({ email: 'student@gmail.com' });
    expect(inDb).toBeNull();
  });

  it('rejects student registration with student@yahoo.com and does NOT send OTP', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Yahoo Student',
      email: 'student@yahoo.com',
      password: 'SecurePassword123',
      confirmPassword: 'SecurePassword123',
      role: 'student',
      department: 'Computer Science',
      batch: '2026',
    });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(sentOtps.length).toBe(0);
  });

  it('rejects student registration with truncated domain student@gndecb.ac', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Truncated Student',
      email: 'student@gndecb.ac',
      password: 'SecurePassword123',
      confirmPassword: 'SecurePassword123',
      role: 'student',
      department: 'Computer Science',
      batch: '2026',
    });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(sentOtps.length).toBe(0);
  });

  it('rejects student registration with appended domain student@gndecb.ac.in.example.com', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Appended Domain Student',
      email: 'student@gndecb.ac.in.example.com',
      password: 'SecurePassword123',
      confirmPassword: 'SecurePassword123',
      role: 'student',
      department: 'Computer Science',
      batch: '2026',
    });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(sentOtps.length).toBe(0);
  });

  it('rejects student registration with subdomain student@subdomain.gndecb.ac.in', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Subdomain Student',
      email: 'student@subdomain.gndecb.ac.in',
      password: 'SecurePassword123',
      confirmPassword: 'SecurePassword123',
      role: 'student',
      department: 'Computer Science',
      batch: '2026',
    });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(sentOtps.length).toBe(0);
  });

  it('rejects student registration with prefix attack student@examplegndecb.ac.in', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Prefix Attack Student',
      email: 'student@examplegndecb.ac.in',
      password: 'SecurePassword123',
      confirmPassword: 'SecurePassword123',
      role: 'student',
      department: 'Computer Science',
      batch: '2026',
    });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(sentOtps.length).toBe(0);
  });

  // ── Backend Authoritative Security Boundary (Service Layer) ─────────────────
  it('authService.registerUser directly throws INSTITUTIONAL_EMAIL_REQUIRED for invalid student domain', async () => {
    await expect(
      authService.registerUser({
        name: 'Direct Call Student',
        email: 'attacker@evil.com',
        password: 'SecurePassword123',
        confirmPassword: 'SecurePassword123',
        role: 'student',
        department: 'CS',
        batch: '2026',
      })
    ).rejects.toMatchObject({
      statusCode: 422,
      code: 'INSTITUTIONAL_EMAIL_REQUIRED',
    });

    expect(sentOtps.length).toBe(0);
  });

  // ── Alumni Registration Unaffected ──────────────────────────────────────────
  it('allows alumni registration with personal Gmail address (alumni@gmail.com)', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Alumni Gmail',
      email: 'alumni@gmail.com',
      password: 'SecurePassword123',
      confirmPassword: 'SecurePassword123',
      role: 'alumni',
      department: 'Mechanical Engineering',
      batch: '2020',
      graduationYear: '2020',
      degree: 'B.Tech',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('alumni');
    expect(sentOtps.length).toBe(1);
    expect(sentOtps[0].to).toBe('alumni@gmail.com');
  });

  it('allows alumni registration with institutional email address (alumni@gndecb.ac.in)', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Alumni Institutional',
      email: 'alumni@gndecb.ac.in',
      password: 'SecurePassword123',
      confirmPassword: 'SecurePassword123',
      role: 'alumni',
      department: 'Electrical Engineering',
      batch: '2019',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('alumni');
    expect(sentOtps.length).toBe(1);
  });
});
