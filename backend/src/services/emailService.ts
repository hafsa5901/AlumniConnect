import nodemailer from 'nodemailer';
import { env } from '../config/env';

let transporter: nodemailer.Transporter | null = null;

export interface TransportConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  service?: string;
  auth?: {
    user: string;
    pass: string;
  };
}

/**
 * Resolves the transport configuration options from environment settings.
 * Pure function allowing unit test assertions without opening sockets.
 */
export function resolveTransportConfig(configOverrides?: {
  NODE_ENV?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_SECURE?: boolean;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  EMAIL_SERVICE?: string;
  EMAIL_USER?: string;
  EMAIL_PASSWORD?: string;
}): { type: 'smtp' | 'service' | 'ethereal' | 'console'; options?: any } {
  const currentEnv = {
    NODE_ENV: configOverrides?.NODE_ENV ?? env.NODE_ENV,
    SMTP_HOST: configOverrides?.SMTP_HOST ?? env.SMTP_HOST,
    SMTP_PORT: configOverrides?.SMTP_PORT ?? env.SMTP_PORT,
    SMTP_SECURE: configOverrides?.SMTP_SECURE ?? env.SMTP_SECURE,
    SMTP_USER: configOverrides?.SMTP_USER ?? env.SMTP_USER,
    SMTP_PASSWORD: configOverrides?.SMTP_PASSWORD ?? env.SMTP_PASSWORD,
    EMAIL_SERVICE: configOverrides?.EMAIL_SERVICE ?? env.EMAIL_SERVICE,
    EMAIL_USER: configOverrides?.EMAIL_USER ?? env.EMAIL_USER,
    EMAIL_PASSWORD: configOverrides?.EMAIL_PASSWORD ?? env.EMAIL_PASSWORD,
  };

  const user = currentEnv.SMTP_USER || currentEnv.EMAIL_USER;
  const pass = currentEnv.SMTP_PASSWORD || currentEnv.EMAIL_PASSWORD;

  // 1. Direct SMTP server configuration
  if (currentEnv.SMTP_HOST && user && pass) {
    return {
      type: 'smtp',
      options: {
        host: currentEnv.SMTP_HOST,
        port: currentEnv.SMTP_PORT,
        secure: currentEnv.SMTP_SECURE,
        auth: { user, pass },
      },
    };
  }

  // 2. Pre-configured email service provider (e.g. sendgrid, gmail, etc.)
  if (currentEnv.EMAIL_SERVICE && user && pass) {
    return {
      type: 'service',
      options: {
        service: currentEnv.EMAIL_SERVICE,
        auth: { user, pass },
      },
    };
  }

  // 3. Production guard: fail loudly if no valid email provider credentials configured
  if (currentEnv.NODE_ENV === 'production') {
    throw new Error(
      'Production email transport error: SMTP_HOST/USER/PASSWORD or EMAIL_SERVICE/USER/PASSWORD must be configured in production.'
    );
  }

  // 4. Dev / test mode fallback
  return { type: 'ethereal' };
}

/**
 * Creates a Nodemailer transporter based on resolved transport configuration.
 */
export async function createTransporter(configOverrides?: Parameters<typeof resolveTransportConfig>[0]): Promise<nodemailer.Transporter> {
  const resolved = resolveTransportConfig(configOverrides);

  if (resolved.type === 'smtp' || resolved.type === 'service') {
    return nodemailer.createTransport(resolved.options);
  }

  // Dev fallback: Ethereal test account (auto-created)
  try {
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
  } catch {
    // Ultimate fallback: console logger
    return { sendMail: consoleFallback } as unknown as nodemailer.Transporter;
  }
}

/**
 * Returns the singleton transporter instance.
 */
export async function getTransporter(): Promise<nodemailer.Transporter> {
  if (!transporter) {
    transporter = await createTransporter();
  }
  return transporter;
}

/**
 * Resets the transporter singleton (useful in test suites).
 */
export function resetTransporterForTest(): void {
  transporter = null;
}

// Dev console fallback — logs the email content safely in dev
async function consoleFallback(options: nodemailer.SendMailOptions) {
  console.log('\n============================');
  console.log('[DEV EMAIL] Would have sent:');
  console.log(`  To:      ${options.to}`);
  console.log(`  Subject: ${options.subject}`);
  console.log(`  Body:\n${options.text || options.html}`);
  console.log('============================\n');
  return { messageId: 'dev-console-fallback' };
}

async function send(options: nodemailer.SendMailOptions): Promise<void> {
  try {
    const t = await getTransporter();
    const info = await t.sendMail({ from: env.EMAIL_FROM, ...options });
    if (env.NODE_ENV === 'development') {
      const url = nodemailer.getTestMessageUrl(info as nodemailer.SentMessageInfo);
      if (url) console.log('[DEV EMAIL] Preview URL:', url);
    }
  } catch (err) {
    // Log but don't crash — email failure shouldn't break core user actions
    console.error('[EMAIL] Failed to send email:', err);
    if (env.NODE_ENV === 'production') throw err;
  }
}

// ── Email Templates & Dispatchers ─────────────────────────────────────────────

export async function sendVerificationEmail(
  to: string,
  name: string,
  rawToken: string
): Promise<void> {
  const baseUrl = env.APP_BASE_URL || env.CLIENT_URL;
  const link = `${baseUrl}/verify-email?token=${rawToken}`;

  const textContent = `Hi ${name},

Thank you for registering on AlumniConnect. Please verify your email address by clicking the link below:

${link}

Important: This verification link expires in 24 hours.

If you did not create an account on AlumniConnect, please ignore this email. No account will be activated without email verification.

Best regards,
The AlumniConnect Team`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your AlumniConnect email</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:540px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);" cellspacing="0" cellpadding="0">
          <tr>
            <td style="background:#0F1E3D;padding:24px 32px;text-align:left;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">
                    🎓 AlumniConnect
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="color:#0F1E3D;font-size:22px;font-weight:700;margin:0 0 16px 0;">Verify your email address</h1>
              <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px 0;">Hi <strong>${name}</strong>,</p>
              <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 24px 0;">
                Thank you for joining AlumniConnect. Please click the button below to verify your email address and activate your account.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 28px 0;">
                <tr>
                  <td align="center" style="border-radius:8px;background:#0F1E3D;">
                    <a href="${link}" target="_blank" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;background:#0F1E3D;">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>
              <div style="background:#f1f5f9;border-left:4px solid #0F1E3D;padding:12px 16px;border-radius:4px;margin-bottom:24px;">
                <p style="margin:0;font-size:13px;color:#475569;line-height:1.5;">
                  ⏱ <strong>Note:</strong> This verification link is valid for <strong>24 hours</strong>.
                </p>
              </div>
              <p style="color:#64748b;font-size:13px;line-height:1.5;margin:0 0 8px 0;">
                If the button above does not work, copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 24px 0;word-break:break-all;">
                <a href="${link}" style="color:#2563eb;font-size:13px;text-decoration:underline;">${link}</a>
              </p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
              <p style="color:#94a3b8;font-size:12px;line-height:1.5;margin:0;">
                If you did not register for an AlumniConnect account, please ignore this email. No account will be activated without verification.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="color:#94a3b8;font-size:12px;margin:0;">
                © ${new Date().getFullYear()} AlumniConnect. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await send({
    to,
    subject: 'Verify your AlumniConnect email address',
    text: textContent,
    html: htmlContent,
  });

  if (env.NODE_ENV === 'development') {
    console.log(`[DEV EMAIL] Verification link for ${to}: ${link}`);
  }
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  rawToken: string
): Promise<void> {
  const baseUrl = env.APP_BASE_URL || env.CLIENT_URL;
  const link = `${baseUrl}/reset-password?token=${rawToken}`;

  const textContent = `Hi ${name},

You requested a password reset for your AlumniConnect account. Click the link below to set a new password:

${link}

This link expires in 1 hour.

If you did not request this password reset, please safely ignore this email. Your password will remain unchanged.

Best regards,
The AlumniConnect Team`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your AlumniConnect password</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:540px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);" cellspacing="0" cellpadding="0">
          <tr>
            <td style="background:#0F1E3D;padding:24px 32px;text-align:left;">
              <span style="color:#ffffff;font-size:20px;font-weight:700;">🎓 AlumniConnect</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="color:#0F1E3D;font-size:22px;font-weight:700;margin:0 0 16px 0;">Reset your password</h1>
              <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px 0;">Hi <strong>${name}</strong>,</p>
              <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 24px 0;">
                We received a request to reset the password for your AlumniConnect account. Click the button below to choose a new password.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 28px 0;">
                <tr>
                  <td align="center" style="border-radius:8px;background:#dc2626;">
                    <a href="${link}" target="_blank" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;background:#dc2626;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:4px;margin-bottom:24px;">
                <p style="margin:0;font-size:13px;color:#991b1b;line-height:1.5;">
                  ⏱ <strong>Note:</strong> This password reset link is valid for <strong>1 hour</strong>.
                </p>
              </div>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
              <p style="color:#94a3b8;font-size:12px;line-height:1.5;margin:0;">
                If you did not request a password reset, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await send({
    to,
    subject: 'Reset your AlumniConnect password',
    text: textContent,
    html: htmlContent,
  });

  if (env.NODE_ENV === 'development') {
    console.log(`[DEV EMAIL] Reset link for ${to}: ${link}`);
  }
}

export async function sendApprovalEmail(to: string, name: string): Promise<void> {
  const baseUrl = env.APP_BASE_URL || env.CLIENT_URL;
  const loginUrl = `${baseUrl}/login`;

  await send({
    to,
    subject: 'Your AlumniConnect account has been approved!',
    text: `Hi ${name},\n\nGreat news — your AlumniConnect account has been approved by the institution administrator. You now have full access to alumni features.\n\nLog in at: ${loginUrl}`,
    html: `
      <div style="font-family:Inter,-apple-system,sans-serif;max-width:520px;margin:auto;padding:32px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
        <h2 style="color:#0F1E3D;margin-top:0;">Account Approved 🎉</h2>
        <p style="color:#374151;line-height:1.6;">Hi ${name}, your account has been approved. You now have full institutional alumni access to connections, jobs, mentorship, and messaging.</p>
        <div style="margin:24px 0;">
          <a href="${loginUrl}" style="display:inline-block;background:#0F1E3D;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Go to Dashboard</a>
        </div>
        <p style="color:#6b7280;font-size:13px;margin-bottom:0;">Welcome to the alumni network!</p>
      </div>`,
  });
}

export async function sendRejectionEmail(
  to: string,
  name: string,
  reason?: string
): Promise<void> {
  await send({
    to,
    subject: 'Update on your AlumniConnect application',
    text: `Hi ${name},\n\nAfter review, your AlumniConnect account application was not approved.${reason ? `\n\nReason: ${reason}` : ''}\n\nIf you believe this is an error, please contact your institution administrator.`,
    html: `
      <div style="font-family:Inter,-apple-system,sans-serif;max-width:520px;margin:auto;padding:32px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
        <h2 style="color:#0F1E3D;margin-top:0;">Application Update</h2>
        <p style="color:#374151;line-height:1.6;">Hi ${name}, unfortunately your account application was not approved at this time.</p>
        ${reason ? `<div style="background:#fee2e2;padding:12px;border-radius:6px;margin:16px 0;color:#991b1b;font-size:14px;"><strong>Reason:</strong> ${reason}</div>` : ''}
        <p style="color:#6b7280;font-size:13px;margin-bottom:0;">Please contact your institution administrator if you believe this is an error.</p>
      </div>`,
  });
}
