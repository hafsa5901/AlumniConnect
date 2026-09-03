import nodemailer from 'nodemailer';
import { env } from '../config/env';

let transporter: nodemailer.Transporter | null = null;

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;

  if (env.NODE_ENV === 'production') {
    // Production: require real credentials — fail loudly if missing
    if (!env.EMAIL_USER || !env.EMAIL_PASSWORD) {
      throw new Error('EMAIL_USER and EMAIL_PASSWORD must be set in production.');
    }
    transporter = nodemailer.createTransport({
      service: env.EMAIL_SERVICE,
      auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASSWORD },
    });
  } else if (env.EMAIL_USER && env.EMAIL_PASSWORD) {
    // Dev with real credentials configured
    transporter = nodemailer.createTransport({
      service: env.EMAIL_SERVICE,
      auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASSWORD },
    });
  } else {
    // Dev fallback: Ethereal test account (auto-created)
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      console.log('[EMAIL] Using Ethereal test account:', testAccount.user);
    } catch {
      // Ultimate fallback: console logger
      transporter = { sendMail: consoleFallback } as unknown as nodemailer.Transporter;
    }
  }

  return transporter;
}

// Dev console fallback — logs the full email content so nothing is lost
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
  const t = await getTransporter();
  try {
    const info = await t.sendMail({ from: env.EMAIL_FROM, ...options });
    if (env.NODE_ENV !== 'production') {
      const url = nodemailer.getTestMessageUrl(info as nodemailer.SentMessageInfo);
      if (url) console.log('[DEV EMAIL] Preview URL:', url);
    }
  } catch (err) {
    // Log but don't crash — email failure shouldn't break registration
    console.error('[EMAIL] Failed to send email:', err);
    if (env.NODE_ENV === 'production') throw err;
  }
}

// ── Email types ───────────────────────────────────────────────────────────────

export async function sendVerificationEmail(
  to: string,
  name: string,
  rawToken: string
): Promise<void> {
  const link = `${env.CLIENT_URL}/verify-email?token=${rawToken}`;
  await send({
    to,
    subject: 'Verify your AlumniConnect email address',
    text: `Hi ${name},\n\nPlease verify your email address by clicking the link below:\n\n${link}\n\nThis link expires in 24 hours.\n\nIf you did not register for AlumniConnect, please ignore this email.`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:auto;padding:32px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
        <h2 style="color:#0F1E3D;margin-bottom:8px;">Verify your email</h2>
        <p style="color:#374151;">Hi ${name},</p>
        <p style="color:#374151;">Click the button below to verify your email address and activate your AlumniConnect account.</p>
        <a href="${link}" style="display:inline-block;background:#0F1E3D;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">Verify Email</a>
        <p style="color:#6b7280;font-size:13px;">This link expires in 24 hours. If you didn't register, ignore this email.</p>
      </div>`,
  });
  if (env.NODE_ENV !== 'production') {
    console.log(`[DEV EMAIL] Verification link for ${to}: ${link}`);
  }
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  rawToken: string
): Promise<void> {
  const link = `${env.CLIENT_URL}/reset-password?token=${rawToken}`;
  await send({
    to,
    subject: 'Reset your AlumniConnect password',
    text: `Hi ${name},\n\nYou requested a password reset. Click the link below:\n\n${link}\n\nThis link expires in 1 hour. If you did not request this, please ignore this email.`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:auto;padding:32px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
        <h2 style="color:#0F1E3D;margin-bottom:8px;">Reset your password</h2>
        <p style="color:#374151;">Hi ${name},</p>
        <p style="color:#374151;">Click the button below to reset your password. This link expires in 1 hour.</p>
        <a href="${link}" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">Reset Password</a>
        <p style="color:#6b7280;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
      </div>`,
  });
  if (env.NODE_ENV !== 'production') {
    console.log(`[DEV EMAIL] Reset link for ${to}: ${link}`);
  }
}

export async function sendApprovalEmail(to: string, name: string): Promise<void> {
  await send({
    to,
    subject: 'Your AlumniConnect account has been approved!',
    text: `Hi ${name},\n\nGreat news — your AlumniConnect account has been approved by the institution administrator. You now have full access to alumni features.\n\nLog in at: ${env.CLIENT_URL}/login`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:auto;padding:32px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
        <h2 style="color:#0F1E3D;">Account Approved 🎉</h2>
        <p style="color:#374151;">Hi ${name}, your account has been approved. You now have full alumni access.</p>
        <a href="${env.CLIENT_URL}/login" style="display:inline-block;background:#0F1E3D;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Go to Dashboard</a>
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
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:auto;padding:32px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
        <h2 style="color:#0F1E3D;">Application Update</h2>
        <p style="color:#374151;">Hi ${name}, unfortunately your account application was not approved.</p>
        ${reason ? `<p style="color:#374151;"><strong>Reason:</strong> ${reason}</p>` : ''}
        <p style="color:#6b7280;font-size:13px;">Contact your institution administrator if you believe this is an error.</p>
      </div>`,
  });
}
