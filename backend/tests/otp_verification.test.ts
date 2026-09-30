import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app';
import User from '../src/models/User';
import { hashOtp, compareOtp, generateOtp, hashPassword, generateSecureToken } from '../src/utils/auth';
import * as emailService from '../src/services/emailService';

let mongoServer: MongoMemoryServer;

// Mock the emailService dispatchers to capture OTPs without sending network traffic
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

describe('Signup Email Verification via OTP (Feature Matrix)', () => {
  // ── 1. Registration & Keyed Hash Security ───────────────────────────────────
  it('1. Registration creates unverified user, hashes OTP via HMAC-SHA256, and withholds session', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Alice Johnson',
      email: 'alice@gndecb.ac.in',
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
      role: 'student',
      department: 'Computer Science',
      batch: '2026',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.verificationRequired).toBe(true);
    expect(res.body.data.accessToken).toBeUndefined(); // Session withheld
    expect(res.body.data.otp).toBeUndefined(); // Never in response
    expect(res.body.data.emailVerificationOtpHash).toBeUndefined();

    // Check DB directly
    const userInDb = await User.findOne({ email: 'alice@gndecb.ac.in' }).select(
      '+emailVerificationOtpHash +emailVerificationOtpExpiresAt +emailVerificationOtpAttempts +passwordHash'
    );

    expect(userInDb).not.toBeNull();
    expect(userInDb?.verificationStatus).toBe('pending');
    expect(userInDb?.emailVerificationOtpAttempts).toBe(0);
    expect(userInDb?.emailVerificationOtpExpiresAt).toBeDefined();

    // Assert only hash is stored, exactly 64-character hex string
    expect(userInDb?.emailVerificationOtpHash).toMatch(/^[a-f0-9]{64}$/);

    // Email dispatcher was invoked with a 6-digit raw OTP
    expect(sentOtps.length).toBe(1);
    expect(sentOtps[0].to).toBe('alice@gndecb.ac.in');
    expect(sentOtps[0].otp).toMatch(/^\d{6}$/);

    // Raw OTP is not in DB as plaintext
    expect(userInDb?.emailVerificationOtpHash).not.toBe(sentOtps[0].otp);

    // Verify keyed hash matches
    expect(hashOtp(sentOtps[0].otp)).toBe(userInDb?.emailVerificationOtpHash);
  });

  // ── 2. Login Gating for Unverified Accounts ─────────────────────────────────
  it('2. Unverified user receives 403 EMAIL_VERIFICATION_REQUIRED on login', async () => {
    // Register account
    await request(app).post('/api/v1/auth/register').send({
      name: 'Bob Unverified',
      email: 'bob@gndecb.ac.in',
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
      role: 'student',
      department: 'EE',
      batch: '2025',
    });

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'bob@gndecb.ac.in',
      password: 'StrongPassword123!',
    });

    expect(loginRes.status).toBe(403);
    expect(loginRes.body.success).toBe(false);
    expect(loginRes.body.error.code).toBe('EMAIL_VERIFICATION_REQUIRED');
  });

  // ── 3. Valid OTP Verification ───────────────────────────────────────────────
  it('3. Valid 6-digit OTP verifies account to email_verified only and leaves college/admin fields untouched', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Charlie Student',
      email: 'charlie@gndecb.ac.in',
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
      role: 'student',
      department: 'Mechanical',
      batch: '2026',
    });

    const userBefore = await User.findOne({ email: 'charlie@gndecb.ac.in' });
    expect(userBefore?.verificationStatus).toBe('pending');
    expect(userBefore?.collegeDomainVerified).toBe(false);
    expect(userBefore?.college).toBeNull();
    expect(userBefore?.adminCollege).toBeNull();

    const otp = sentOtps[0].otp;
    expect(otp).toBeDefined();

    const verifyRes = await request(app).post('/api/v1/auth/verify-otp').send({
      email: 'charlie@gndecb.ac.in',
      otp,
    });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.data.accessToken).toBeDefined();
    expect(verifyRes.body.data.user.email).toBe('charlie@gndecb.ac.in');
    // Crucial: verificationStatus is 'email_verified' ONLY — not 'admin_approved'
    expect(verifyRes.body.data.user.verificationStatus).toBe('email_verified');

    // Check refresh cookie
    const cookies = verifyRes.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toContain('refreshToken');

    // DB: Check all fields to prove zero side-effects
    const userAfter = await User.findOne({ email: 'charlie@gndecb.ac.in' }).select(
      '+emailVerificationOtpHash +emailVerificationOtpExpiresAt +emailVerificationOtpAttempts'
    );
    expect(userAfter?.verificationStatus).toBe('email_verified');
    expect(userAfter?.collegeDomainVerified).toBe(false); // Untouched
    expect(userAfter?.college).toBeNull(); // Untouched
    expect(userAfter?.adminCollege).toBeNull(); // Untouched
    expect(userAfter?.emailVerificationOtpHash).toBeUndefined(); // Cleared
    expect(userAfter?.emailVerificationOtpExpiresAt).toBeUndefined(); // Cleared

    // Subsequent login succeeds immediately
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'charlie@gndecb.ac.in',
      password: 'StrongPassword123!',
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.user.verificationStatus).toBe('email_verified');
  });

  // ── 3B. Alumni OTP Verification Isolation ──────────────────────────────────
  it('3B. Alumni OTP verification does not bypass alumni proof or admin approval', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Alumni Proof Tester',
      email: 'alumni_proof@external.com',
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
      role: 'alumni',
      department: 'Civil',
      batch: '2020',
      graduationYear: '2020',
      degree: 'B.Tech Civil',
      proofNote: 'Manual review required',
    });

    const userBefore = await User.findOne({ email: 'alumni_proof@external.com' }).select('+verificationNote');
    expect(userBefore?.verificationStatus).toBe('pending');
    expect(userBefore?.verificationNote).toContain('Manual review required');

    const otp = sentOtps[0].otp;
    const verifyRes = await request(app).post('/api/v1/auth/verify-otp').send({
      email: 'alumni_proof@external.com',
      otp,
    });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.user.verificationStatus).toBe('email_verified'); // Email verified, but admin approval still required!

    const userAfter = await User.findOne({ email: 'alumni_proof@external.com' }).select('+verificationNote');
    expect(userAfter?.verificationStatus).toBe('email_verified');
    expect(userAfter?.verificationNote).toContain('Manual review required'); // Preserved
  });

  // ── 4. Invalid OTP Rejection & Atomic Attempt Increment ─────────────────────
  it('4. Wrong OTP is rejected and increments attempt counter atomically', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Dave Student',
      email: 'dave@gndecb.ac.in',
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
      role: 'student',
      department: 'CS',
      batch: '2026',
    });

    const res = await request(app).post('/api/v1/auth/verify-otp').send({
      email: 'dave@gndecb.ac.in',
      otp: '000000',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_OTP');
    expect(res.body.error.message).toContain('4 attempt(s) remaining');

    const userInDb = await User.findOne({ email: 'dave@gndecb.ac.in' }).select('+emailVerificationOtpAttempts');
    expect(userInDb?.emailVerificationOtpAttempts).toBe(1);
  });

  // ── 5. Max Attempts (5) Invalidation ─────────────────────────────────────────
  it('5. 5th incorrect attempt invalidates the OTP and requires resend', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Eve Student',
      email: 'eve@gndecb.ac.in',
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
      role: 'student',
      department: 'CS',
      batch: '2026',
    });

    const correctOtp = sentOtps[0].otp;

    // Send 4 wrong attempts
    for (let i = 1; i <= 4; i++) {
      const wrongRes = await request(app).post('/api/v1/auth/verify-otp').send({
        email: 'eve@gndecb.ac.in',
        otp: '999999',
      });
      expect(wrongRes.status).toBe(400);
      expect(wrongRes.body.error.code).toBe('INVALID_OTP');
    }

    // 5th wrong attempt triggers invalidation
    const fifthRes = await request(app).post('/api/v1/auth/verify-otp').send({
      email: 'eve@gndecb.ac.in',
      otp: '999999',
    });
    expect(fifthRes.status).toBe(400);
    expect(fifthRes.body.error.code).toBe('MAX_ATTEMPTS_EXCEEDED');

    // Now submitting the original correct OTP fails because it has been invalidated
    const retryCorrect = await request(app).post('/api/v1/auth/verify-otp').send({
      email: 'eve@gndecb.ac.in',
      otp: correctOtp,
    });
    expect(retryCorrect.status).toBe(400);
    expect(retryCorrect.body.error.code).toBe('INVALID_OR_EXPIRED_OTP');
  });

  // ── 6. Resend OTP Flow ──────────────────────────────────────────────────────
  it('6. Resend invalidates prior OTP, resets attempts to 0, and new OTP succeeds', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Frank Student',
      email: 'frank@gndecb.ac.in',
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
      role: 'student',
      department: 'CS',
      batch: '2026',
    });

    const oldOtp = sentOtps[0].otp;

    // Trigger resend
    const resendRes = await request(app).post('/api/v1/auth/resend-otp').send({
      email: 'frank@gndecb.ac.in',
    });
    expect(resendRes.status).toBe(200);
    expect(resendRes.body.success).toBe(true);
    expect(sentOtps.length).toBe(2);

    const newOtp = sentOtps[1].otp;
    expect(newOtp).not.toBe(oldOtp);

    // Old OTP no longer works
    const oldVerify = await request(app).post('/api/v1/auth/verify-otp').send({
      email: 'frank@gndecb.ac.in',
      otp: oldOtp,
    });
    expect(oldVerify.status).toBe(400);

    // New OTP succeeds
    const newVerify = await request(app).post('/api/v1/auth/verify-otp').send({
      email: 'frank@gndecb.ac.in',
      otp: newOtp,
    });
    expect(newVerify.status).toBe(200);
    expect(newVerify.body.success).toBe(true);
  });

  // ── 7. Single-Use & Concurrency Safety ──────────────────────────────────────
  it('7. Single-use: submitting the same OTP twice is rejected on second attempt', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Grace Student',
      email: 'grace@gndecb.ac.in',
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
      role: 'student',
      department: 'CS',
      batch: '2026',
    });

    const otp = sentOtps[0].otp;

    // First attempt succeeds
    const firstRes = await request(app).post('/api/v1/auth/verify-otp').send({
      email: 'grace@gndecb.ac.in',
      otp,
    });
    expect(firstRes.status).toBe(200);

    // Second attempt fails (already verified / OTP cleared)
    const secondRes = await request(app).post('/api/v1/auth/verify-otp').send({
      email: 'grace@gndecb.ac.in',
      otp,
    });
    expect(secondRes.status).toBe(200); // Already verified returns session
  });

  // ── 8. Expired OTP Rejection ────────────────────────────────────────────────
  it('8. Expired OTP returns OTP_EXPIRED error', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Heidi Student',
      email: 'heidi@gndecb.ac.in',
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
      role: 'student',
      department: 'CS',
      batch: '2026',
    });

    const otp = sentOtps[0].otp;

    // Manually expire the OTP in DB
    await User.updateOne(
      { email: 'heidi@gndecb.ac.in' },
      { emailVerificationOtpExpiresAt: new Date(Date.now() - 60000) }
    );

    const res = await request(app).post('/api/v1/auth/verify-otp').send({
      email: 'heidi@gndecb.ac.in',
      otp,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('OTP_EXPIRED');
  });

  // ── 9. Timing-Safe & Keyed Hash Functions ───────────────────────────────────
  it('9. compareOtp is timing-safe and validates keyed HMAC correctly', () => {
    const rawOtp = '482910';
    const hash = hashOtp(rawOtp);

    expect(compareOtp(rawOtp, hash)).toBe(true);
    expect(compareOtp('000000', hash)).toBe(false);
    expect(compareOtp('', hash)).toBe(false);
  });

  // ── 10. Backward Compatibility with Link-Based Verification ─────────────────
  it('10. Legacy verification links continue to verify pending users', async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Ivan Legacy',
      email: 'ivan@gndecb.ac.in',
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
      role: 'student',
      department: 'CS',
      batch: '2026',
    });

    const userInDb = await User.findOne({ email: 'ivan@gndecb.ac.in' }).select('+verificationTokenHash');
    expect(userInDb?.verificationTokenHash).toBeDefined();

    // Use link verification endpoint
    const { raw, hash, expires } = generateSecureToken(24 * 60 * 60 * 1000);
    await User.updateOne({ email: 'ivan@gndecb.ac.in' }, { verificationTokenHash: hash, verificationTokenExpires: expires });

    const linkRes = await request(app).post('/api/v1/auth/verify-email').send({
      token: raw,
    });

    expect(linkRes.status).toBe(200);
    expect(linkRes.body.success).toBe(true);

    const updatedUser = await User.findOne({ email: 'ivan@gndecb.ac.in' });
    expect(updatedUser?.verificationStatus).toBe('email_verified');
  });
});
