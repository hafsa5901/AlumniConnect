import nodemailer from 'nodemailer';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app';
import User from '../src/models/User';
import { env } from '../src/config/env';
import {
  resolveTransportConfig,
  createTransporter,
  sendVerificationEmail,
  resetTransporterForTest,
} from '../src/services/emailService';
import {
  hashPassword,
  generateSecureToken,
  hashToken,
  VERIFICATION_TOKEN_TTL,
} from '../src/utils/auth';

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
  resetTransporterForTest();
  jest.restoreAllMocks();
});

describe('Phase 7A — Production-Ready Email Verification & Transport Tests', () => {
  // ── 1. Transport Selection Unit Tests (Mocked, No Real Connection) ──────────
  describe('Nodemailer Transport Selection & Configuration', () => {
    it('ignores stray GMAIL_* environment variables and selects direct SMTP when SMTP config is provided', async () => {
      process.env.GMAIL_OAUTH_CLIENT_ID = 'stray-client-id';
      process.env.GMAIL_OAUTH_CLIENT_SECRET = 'stray-client-secret';
      process.env.GMAIL_OAUTH_REFRESH_TOKEN = 'stray-refresh-token';

      try {
        const resolved = resolveTransportConfig({
          NODE_ENV: 'production',
          SMTP_HOST: 'smtp.resend.com',
          SMTP_PORT: 2465,
          SMTP_SECURE: true,
          SMTP_USER: 'resend',
          SMTP_PASSWORD: 'test-resend-api-key',
        });

        expect(resolved.type).toBe('smtp');
        expect(resolved.options).toEqual({
          host: 'smtp.resend.com',
          port: 2465,
          secure: true,
          auth: {
            user: 'resend',
            pass: 'test-resend-api-key',
          },
        });
      } finally {
        delete process.env.GMAIL_OAUTH_CLIENT_ID;
        delete process.env.GMAIL_OAUTH_CLIENT_SECRET;
        delete process.env.GMAIL_OAUTH_REFRESH_TOKEN;
      }
    });

    it('accepts EMAIL_FROM in "Name <address>" form and passes it correctly to sendMail', async () => {
      const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'mock-msg-id' });
      jest.spyOn(nodemailer, 'createTransport').mockReturnValue({
        sendMail: mockSendMail,
      } as any);

      const originalFrom = env.EMAIL_FROM;
      const originalEnv = env.NODE_ENV;
      const originalHost = env.SMTP_HOST;
      const originalUser = env.SMTP_USER;
      const originalPass = env.SMTP_PASSWORD;

      (env as any).EMAIL_FROM = 'AlumniConnect <noreply@alumniconnect.store>';
      (env as any).NODE_ENV = 'production';
      (env as any).SMTP_HOST = 'smtp.resend.com';
      (env as any).SMTP_USER = 'resend';
      (env as any).SMTP_PASSWORD = 'test-password';

      try {
        resetTransporterForTest();
        await sendVerificationEmail('test.recipient@college.edu', 'Test Student', 'token-abc');

        expect(mockSendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            from: 'AlumniConnect <noreply@alumniconnect.store>',
            to: 'test.recipient@college.edu',
          })
        );
      } finally {
        (env as any).EMAIL_FROM = originalFrom;
        (env as any).NODE_ENV = originalEnv;
        (env as any).SMTP_HOST = originalHost;
        (env as any).SMTP_USER = originalUser;
        (env as any).SMTP_PASSWORD = originalPass;
        resetTransporterForTest();
      }
    });

    it('propagates delivery errors in production without swallowing them', async () => {
      const mockSendMail = jest.fn().mockRejectedValue(new Error('SMTP connection refused: timeout'));
      jest.spyOn(nodemailer, 'createTransport').mockReturnValue({
        sendMail: mockSendMail,
      } as any);

      const originalEnv = env.NODE_ENV;
      const originalHost = env.SMTP_HOST;
      const originalUser = env.SMTP_USER;
      const originalPass = env.SMTP_PASSWORD;

      (env as any).NODE_ENV = 'production';
      (env as any).SMTP_HOST = 'smtp.resend.com';
      (env as any).SMTP_USER = 'resend';
      (env as any).SMTP_PASSWORD = 'test-password';

      try {
        resetTransporterForTest();
        await expect(
          sendVerificationEmail('failing.recipient@college.edu', 'Fail User', 'token-123')
        ).rejects.toThrow('SMTP connection refused');
      } finally {
        (env as any).NODE_ENV = originalEnv;
        (env as any).SMTP_HOST = originalHost;
        (env as any).SMTP_USER = originalUser;
        (env as any).SMTP_PASSWORD = originalPass;
        resetTransporterForTest();
      }
    });

    it('selects direct custom SMTP configuration when SMTP_HOST and credentials are provided', async () => {
      const mockCreateTransport = jest.spyOn(nodemailer, 'createTransport').mockReturnValue({
        sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-smtp-msg' }),
      } as any);

      const resolved = resolveTransportConfig({
        NODE_ENV: 'production',
        SMTP_HOST: 'smtp.mailgun.org',
        SMTP_PORT: 587,
        SMTP_SECURE: false,
        SMTP_USER: 'postmaster@mg.example.com',
        SMTP_PASSWORD: 'secret-smtp-password',
      });

      expect(resolved.type).toBe('smtp');
      expect(resolved.options).toEqual({
        host: 'smtp.mailgun.org',
        port: 587,
        secure: false,
        auth: {
          user: 'postmaster@mg.example.com',
          pass: 'secret-smtp-password',
        },
      });

      await createTransporter({
        NODE_ENV: 'production',
        SMTP_HOST: 'smtp.mailgun.org',
        SMTP_PORT: 587,
        SMTP_SECURE: false,
        SMTP_USER: 'postmaster@mg.example.com',
        SMTP_PASSWORD: 'secret-smtp-password',
      });

      expect(mockCreateTransport).toHaveBeenCalledWith({
        host: 'smtp.mailgun.org',
        port: 587,
        secure: false,
        auth: {
          user: 'postmaster@mg.example.com',
          pass: 'secret-smtp-password',
        },
      });
    });

    it('selects direct custom SMTP configuration on port 2465 with implicit SSL (Render Free workaround)', async () => {
      const mockCreateTransport = jest.spyOn(nodemailer, 'createTransport').mockReturnValue({
        sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-smtp-2465-msg' }),
      } as any);

      const resolved = resolveTransportConfig({
        NODE_ENV: 'production',
        SMTP_HOST: 'smtp.resend.com',
        SMTP_PORT: 2465,
        SMTP_SECURE: true,
        SMTP_USER: 'resend',
        SMTP_PASSWORD: 'test-resend-api-key',
      });

      expect(resolved.type).toBe('smtp');
      expect(resolved.options).toEqual({
        host: 'smtp.resend.com',
        port: 2465,
        secure: true,
        auth: {
          user: 'resend',
          pass: 'test-resend-api-key',
        },
      });

      await createTransporter({
        NODE_ENV: 'production',
        SMTP_HOST: 'smtp.resend.com',
        SMTP_PORT: 2465,
        SMTP_SECURE: true,
        SMTP_USER: 'resend',
        SMTP_PASSWORD: 'test-resend-api-key',
      });

      expect(mockCreateTransport).toHaveBeenCalledWith({
        host: 'smtp.resend.com',
        port: 2465,
        secure: true,
        auth: {
          user: 'resend',
          pass: 'test-resend-api-key',
        },
      });
    });

    it('selects pre-configured service transport when EMAIL_SERVICE and credentials are provided', async () => {
      const mockCreateTransport = jest.spyOn(nodemailer, 'createTransport').mockReturnValue({
        sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-service-msg' }),
      } as any);

      const resolved = resolveTransportConfig({
        NODE_ENV: 'production',
        SMTP_HOST: '',
        EMAIL_SERVICE: 'sendgrid',
        EMAIL_USER: 'apikey',
        EMAIL_PASSWORD: 'SG.fake-api-key',
      });

      expect(resolved.type).toBe('service');
      expect(resolved.options).toEqual({
        service: 'sendgrid',
        auth: {
          user: 'apikey',
          pass: 'SG.fake-api-key',
        },
      });

      await createTransporter({
        NODE_ENV: 'production',
        SMTP_HOST: '',
        EMAIL_SERVICE: 'sendgrid',
        EMAIL_USER: 'apikey',
        EMAIL_PASSWORD: 'SG.fake-api-key',
      });

      expect(mockCreateTransport).toHaveBeenCalledWith({
        service: 'sendgrid',
        auth: {
          user: 'apikey',
          pass: 'SG.fake-api-key',
        },
      });
    });

    it('throws descriptive error in production if no SMTP or service credentials exist', () => {
      expect(() => {
        resolveTransportConfig({
          NODE_ENV: 'production',
          SMTP_HOST: '',
          SMTP_USER: '',
          SMTP_PASSWORD: '',
          EMAIL_SERVICE: '',
          EMAIL_USER: '',
          EMAIL_PASSWORD: '',
        });
      }).toThrow('Production email transport error');
    });

    it('rejects incomplete SMTP configuration outside production when REQUIRE_PROD_EMAIL=true', () => {
      const origRequire = process.env.REQUIRE_PROD_EMAIL;
      process.env.REQUIRE_PROD_EMAIL = 'true';
      try {
        expect(() => {
          resolveTransportConfig({
            NODE_ENV: 'development',
            SMTP_HOST: '',
            SMTP_USER: '',
            SMTP_PASSWORD: '',
            EMAIL_SERVICE: '',
            EMAIL_USER: '',
            EMAIL_PASSWORD: '',
          });
        }).toThrow('Production email transport error');
      } finally {
        if (origRequire !== undefined) {
          process.env.REQUIRE_PROD_EMAIL = origRequire;
        } else {
          delete process.env.REQUIRE_PROD_EMAIL;
        }
      }
    });

    it('falls back to dev test account in non-production environments when credentials are absent', () => {
      const origRequire = process.env.REQUIRE_PROD_EMAIL;
      process.env.REQUIRE_PROD_EMAIL = 'false';
      try {
        const resolved = resolveTransportConfig({
          NODE_ENV: 'development',
          SMTP_HOST: '',
          SMTP_USER: '',
          SMTP_PASSWORD: '',
          EMAIL_SERVICE: '',
          EMAIL_USER: '',
          EMAIL_PASSWORD: '',
        });

        expect(resolved.type).toBe('ethereal');
      } finally {
        if (origRequire !== undefined) {
          process.env.REQUIRE_PROD_EMAIL = origRequire;
        } else {
          delete process.env.REQUIRE_PROD_EMAIL;
        }
      }
    });
  });

  // ── 2. Token Security, Expiry & Single-Use Invalidation ─────────────────────
  describe('Verification Token Security & Single-Use Invalidation', () => {
    it('verifies pending user with valid token, updates status, and invalidates token for single-use', async () => {
      const { raw, hash, expires } = generateSecureToken(VERIFICATION_TOKEN_TTL);
      const passwordHash = await hashPassword('SecurePassword123');

      const user = await User.create({
        name: 'Grace Student',
        email: 'grace.student@college.edu',
        passwordHash,
        role: 'student',
        department: 'Information Science',
        batch: '2026',
        verificationStatus: 'pending',
        accountStatus: 'active',
        verificationTokenHash: hash,
        verificationTokenExpires: expires,
      });

      // 1st verify attempt -> succeeds (200)
      const res = await request(app).post('/api/v1/auth/verify-email').send({
        token: raw,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('grace.student@college.edu');

      // Check DB: token fields must be cleared
      const inDb = await User.findById(user._id).select('+verificationTokenHash +verificationTokenExpires');
      expect(inDb?.verificationTokenHash).toBeUndefined();
      expect(inDb?.verificationTokenExpires).toBeUndefined();
      expect(['email_verified', 'admin_approved']).toContain(inDb?.verificationStatus);

      // 2nd verify attempt with same raw token -> fails (400)
      const reuseRes = await request(app).post('/api/v1/auth/verify-email').send({
        token: raw,
      });

      expect(reuseRes.status).toBe(400);
      expect(reuseRes.body.success).toBe(false);
      expect(reuseRes.body.error.code).toBe('INVALID_OR_EXPIRED_TOKEN');
    });

    it('rejects expired verification tokens', async () => {
      const { raw, hash } = generateSecureToken(VERIFICATION_TOKEN_TTL);
      const passwordHash = await hashPassword('SecurePassword123');
      const pastDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour in the past

      await User.create({
        name: 'Expired Token User',
        email: 'expired.user@college.edu',
        passwordHash,
        role: 'student',
        department: 'Physics',
        batch: '2025',
        verificationStatus: 'pending',
        accountStatus: 'active',
        verificationTokenHash: hash,
        verificationTokenExpires: pastDate,
      });

      const res = await request(app).post('/api/v1/auth/verify-email').send({
        token: raw,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_OR_EXPIRED_TOKEN');
    });

    it('rejects tampered or malformed tokens', async () => {
      const res = await request(app).post('/api/v1/auth/verify-email').send({
        token: 'invalid-nonexistent-token-12345',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_OR_EXPIRED_TOKEN');
    });
  });

  // ── 3. Resend Verification & Enumeration Resistance ────────────────────────
  describe('Resend Verification Endpoint & Enumeration Resistance', () => {
    it('resends verification email to pending user with fresh token and returns generic response', async () => {
      const { hash: oldHash, expires: oldExpires } = generateSecureToken(VERIFICATION_TOKEN_TTL);
      const passwordHash = await hashPassword('SecurePassword123');

      const user = await User.create({
        name: 'Pending Resend User',
        email: 'pending.resend@college.edu',
        passwordHash,
        role: 'student',
        department: 'Electrical Engineering',
        batch: '2026',
        verificationStatus: 'pending',
        accountStatus: 'active',
        verificationTokenHash: oldHash,
        verificationTokenExpires: oldExpires,
      });

      const res = await request(app).post('/api/v1/auth/resend-verification').send({
        email: 'pending.resend@college.edu',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe(
        'If an unverified account exists with this email, a new verification link has been sent.'
      );

      // Verify DB has a newly updated token hash
      const updated = await User.findById(user._id).select('+verificationTokenHash +verificationTokenExpires');
      expect(updated?.verificationTokenHash).toBeDefined();
      expect(updated?.verificationTokenHash).not.toBe(oldHash);
    });

    it('returns identical generic 200 response when email is not registered (no enumeration)', async () => {
      const res = await request(app).post('/api/v1/auth/resend-verification').send({
        email: 'nonexistent.user@college.edu',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe(
        'If an unverified account exists with this email, a new verification link has been sent.'
      );
    });

    it('returns identical generic 200 response when user is already verified without overwriting state', async () => {
      const passwordHash = await hashPassword('SecurePassword123');
      const verifiedUser = await User.create({
        name: 'Already Verified',
        email: 'already.verified@college.edu',
        passwordHash,
        role: 'student',
        department: 'CS',
        batch: '2024',
        verificationStatus: 'admin_approved',
        accountStatus: 'active',
      });

      const res = await request(app).post('/api/v1/auth/resend-verification').send({
        email: 'already.verified@college.edu',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe(
        'If an unverified account exists with this email, a new verification link has been sent.'
      );

      // Confirm user state remains admin_approved with no verification token
      const checkDb = await User.findById(verifiedUser._id).select('+verificationTokenHash');
      expect(checkDb?.verificationStatus).toBe('admin_approved');
      expect(checkDb?.verificationTokenHash).toBeUndefined();
    });

    it('validates email format on resend endpoint', async () => {
      const res = await request(app).post('/api/v1/auth/resend-verification').send({
        email: 'not-an-email',
      });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ── 4. Bootstrap Admin Login Compatibility Regression Check ────────────────
  describe('Bootstrap Admin Login Compatibility', () => {
    it('confirms bootstrap admin user login and RBAC is unaffected by verification hardening', async () => {
      const passwordHash = await hashPassword('Admin123456');
      await User.create({
        name: 'Platform Admin',
        email: 'admin@alumniconnect.local',
        passwordHash,
        role: 'admin',
        accountStatus: 'active',
        verificationStatus: 'admin_approved',
        department: 'Administration',
        batch: '2024',
      });

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'admin@alumniconnect.local',
        password: 'Admin123456',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('admin');
      expect(res.body.data.user.verificationStatus).toBe('admin_approved');
      expect(res.body.data.accessToken).toBeDefined();

      // Access admin endpoint with issued token
      const adminToken = res.body.data.accessToken;
      const adminRes = await request(app)
        .get('/api/v1/admin/analytics/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminRes.status).toBe(200);
      expect(adminRes.body.success).toBe(true);
    });
  });
});
