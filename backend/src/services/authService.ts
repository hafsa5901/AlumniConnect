import User, { IUser, SAFE_USER_FIELDS } from '../models/User';
import {
  hashPassword,
  comparePassword,
  signAccessToken,
  generateSecureToken,
  hashToken,
  generateOtp,
  hashOtp,
  compareOtp,
  isEmailInAllowedDomains,
  OTP_TTL,
  MAX_OTP_ATTEMPTS,
  VERIFICATION_TOKEN_TTL,
  RESET_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
} from '../utils/auth';
import {
  sendVerificationEmail,
  sendOtpVerificationEmail,
  sendPasswordResetEmail,
  sendApprovalEmail,
  sendRejectionEmail,
} from './emailService';
import { createError } from '../middleware/errorHandler';
import { RegisterInput, LoginInput, VerifyOtpInput } from '../validators/auth';
import { env } from '../config/env';

/** Fields safe to return in every auth response */
function safeUser(user: IUser) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    accountStatus: user.accountStatus,
    verificationStatus: user.verificationStatus,
    college: user.college,
    collegeDomainVerified: user.collegeDomainVerified ?? false,
    department: user.department,
    batch: user.batch,
    profilePhotoUrl: user.profilePhotoUrl,
  };
}

/** Issue an access token + raw refresh token for a user */
function issueTokens(user: IUser) {
  const accessToken = signAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });
  const { raw: rawRefresh, hash: refreshHash, expires: refreshExpires } =
    generateSecureToken(REFRESH_TOKEN_TTL);
  return { accessToken, rawRefresh, refreshHash, refreshExpires };
}

// ── Register ──────────────────────────────────────────────────────────────────
export async function registerUser(input: RegisterInput): Promise<{
  user: ReturnType<typeof safeUser>;
  email: string;
  verificationRequired: boolean;
  message: string;
}> {
  const { name, email, password, role, department, batch, institution,
          studentId, alumniId, graduationYear, degree, proofNote } = input;

  // Block admin registration at public endpoint
  if ((role as string) === 'admin') {
    throw createError(
      'Public administrator registration is not allowed.',
      403,
      'ADMIN_REGISTRATION_BLOCKED'
    );
  }

  const isInstitutional = isEmailInAllowedDomains(email);

  // Students must have an institutional email
  if (role === 'student' && !isInstitutional) {
    throw createError(
      'Students must register with an institutional email address (' +
        env.COLLEGE_EMAIL_DOMAINS.join(', ') + ').',
      422,
      'INVALID_EMAIL_DOMAIN'
    );
  }

  // Check uniqueness (clean 409 instead of Mongo duplicate-key error)
  const existing = await User.findOne({ email });
  if (existing) {
    throw createError('An account with this email already exists.', 409, 'EMAIL_ALREADY_EXISTS');
  }

  const passwordHash = await hashPassword(password);

  // 6-digit OTP generation and keyed HMAC hash
  const rawOtp = generateOtp();
  const emailVerificationOtpHash = hashOtp(rawOtp);
  const emailVerificationOtpExpiresAt = new Date(Date.now() + OTP_TTL);

  // Legacy verification token for backward-compatible links
  const { raw: rawVerificationToken, hash: verificationTokenHash, expires: verificationTokenExpires } =
    generateSecureToken(VERIFICATION_TOKEN_TTL);

  const user = await User.create({
    name,
    email,
    passwordHash,
    role,
    department,
    batch,
    institution,
    studentId: role === 'student' ? studentId : undefined,
    alumniId: role === 'alumni' ? alumniId : undefined,
    accountStatus: 'active',
    verificationStatus: 'pending',
    // Non-institutional alumni proof fields
    verificationNote: !isInstitutional
      ? [graduationYear && `Graduation year: ${graduationYear}`,
         degree && `Degree: ${degree}`,
         proofNote].filter(Boolean).join('\n')
      : undefined,
    emailVerificationOtpHash,
    emailVerificationOtpExpiresAt,
    emailVerificationOtpAttempts: 0,
    verificationTokenHash,
    verificationTokenExpires,
  });

  // Send OTP email (async, don't block registration on email failure)
  sendOtpVerificationEmail(email, name, rawOtp).catch((err) =>
    console.error('[REGISTER] Failed to send OTP email:', err?.message || err)
  );

  // Also send legacy link email if required
  sendVerificationEmail(email, name, rawVerificationToken).catch(() => {});

  return {
    user: safeUser(user),
    email: user.email,
    verificationRequired: true,
    message: 'Registration successful. A 6-digit verification code has been sent to your email.',
  };
}

// ── Verify OTP ────────────────────────────────────────────────────────────────
export async function verifyOtp(input: VerifyOtpInput): Promise<{
  user: ReturnType<typeof safeUser>;
  accessToken: string;
  rawRefresh: string;
}> {
  const { email, otp } = input;
  const normalizedEmail = email.toLowerCase().trim();

  const user = await User.findOne({ email: normalizedEmail }).select(
    '+emailVerificationOtpHash +emailVerificationOtpExpiresAt +emailVerificationOtpAttempts'
  );

  if (!user) {
    throw createError('Invalid or expired verification code.', 400, 'INVALID_OR_EXPIRED_OTP');
  }

  if (user.accountStatus === 'suspended' || user.accountStatus === 'deactivated') {
    throw createError(
      'Your account has been suspended. Please contact the institution administrator.',
      403,
      'ACCOUNT_SUSPENDED'
    );
  }

  // If already verified, issue session
  if (user.verificationStatus === 'email_verified' || user.verificationStatus === 'admin_approved') {
    const { accessToken, rawRefresh, refreshHash, refreshExpires } = issueTokens(user);
    await User.findByIdAndUpdate(user._id, {
      refreshTokenHash: refreshHash,
      refreshTokenExpires: refreshExpires,
      lastLogin: new Date(),
    });
    return { user: safeUser(user), accessToken, rawRefresh };
  }

  if (!user.emailVerificationOtpHash || !user.emailVerificationOtpExpiresAt) {
    throw createError('No pending verification code found. Please request a new code.', 400, 'INVALID_OR_EXPIRED_OTP');
  }

  if (user.emailVerificationOtpExpiresAt < new Date()) {
    throw createError('Verification code has expired. Please request a new code.', 400, 'OTP_EXPIRED');
  }

  if ((user.emailVerificationOtpAttempts ?? 0) >= MAX_OTP_ATTEMPTS) {
    await User.updateOne(
      { _id: user._id },
      { $unset: { emailVerificationOtpHash: 1, emailVerificationOtpExpiresAt: 1 } }
    );
    throw createError('Too many incorrect attempts. Please request a new verification code.', 400, 'MAX_ATTEMPTS_EXCEEDED');
  }

  const isMatch = compareOtp(otp, user.emailVerificationOtpHash);
  if (!isMatch) {
    const updatedUser = await User.findOneAndUpdate(
      { _id: user._id },
      { $inc: { emailVerificationOtpAttempts: 1 } },
      { new: true }
    );
    const attemptsUsed = updatedUser?.emailVerificationOtpAttempts ?? ((user.emailVerificationOtpAttempts ?? 0) + 1);
    const remaining = Math.max(0, MAX_OTP_ATTEMPTS - attemptsUsed);

    if (remaining === 0) {
      await User.updateOne(
        { _id: user._id },
        { $unset: { emailVerificationOtpHash: 1, emailVerificationOtpExpiresAt: 1 } }
      );
      throw createError('Too many incorrect attempts. Please request a new verification code.', 400, 'MAX_ATTEMPTS_EXCEEDED');
    }

    throw createError(`Invalid verification code. ${remaining} attempt(s) remaining.`, 400, 'INVALID_OTP');
  }

  // Determine next verification status
  const isInstitutional = isEmailInAllowedDomains(user.email);
  let nextStatus: 'email_verified' | 'admin_approved' = 'email_verified';
  if (user.role === 'student') {
    nextStatus = env.STUDENT_REQUIRES_ADMIN_APPROVAL ? 'email_verified' : 'admin_approved';
  } else if (user.role === 'alumni' && isInstitutional) {
    nextStatus = 'email_verified';
  } else {
    nextStatus = 'email_verified';
  }

  // Atomic conditional update to prevent double-use / race conditions
  const updated = await User.findOneAndUpdate(
    {
      _id: user._id,
      emailVerificationOtpHash: user.emailVerificationOtpHash,
    },
    {
      $set: {
        verificationStatus: nextStatus,
      },
      $unset: {
        emailVerificationOtpHash: 1,
        emailVerificationOtpExpiresAt: 1,
        emailVerificationOtpAttempts: 1,
        verificationTokenHash: 1,
        verificationTokenExpires: 1,
      },
    },
    { new: true }
  );

  if (!updated) {
    throw createError('Verification code was already used or is no longer valid.', 400, 'INVALID_OR_EXPIRED_OTP');
  }

  // Issue tokens upon successful OTP verification
  const { accessToken, rawRefresh, refreshHash, refreshExpires } = issueTokens(updated);
  await User.findByIdAndUpdate(updated._id, {
    refreshTokenHash: refreshHash,
    refreshTokenExpires: refreshExpires,
    lastLogin: new Date(),
  });

  return { user: safeUser(updated), accessToken, rawRefresh };
}

// ── Resend OTP ─────────────────────────────────────────────────────────────────
export async function resendOtp(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail }).select(
    '+emailVerificationOtpHash +emailVerificationOtpExpiresAt'
  );

  // Generic silent return if user does not exist or is already verified
  if (!user || user.verificationStatus !== 'pending') {
    return;
  }

  const rawOtp = generateOtp();
  const hash = hashOtp(rawOtp);
  const expires = new Date(Date.now() + OTP_TTL);

  await User.findOneAndUpdate(
    { _id: user._id },
    {
      $set: {
        emailVerificationOtpHash: hash,
        emailVerificationOtpExpiresAt: expires,
        emailVerificationOtpAttempts: 0,
      },
    }
  );

  sendOtpVerificationEmail(user.email, user.name, rawOtp).catch((err) =>
    console.error('[RESEND_OTP] Failed to send email:', err?.message || err)
  );
}

// ── Verify email (Legacy link-based) ──────────────────────────────────────────
export async function verifyEmail(rawToken: string): Promise<ReturnType<typeof safeUser>> {
  const hash = hashToken(rawToken);

  // Must explicitly select the token fields (select:false on schema)
  const user = await User.findOne({
    verificationTokenHash: hash,
    verificationTokenExpires: { $gt: new Date() },
  }).select('+verificationTokenHash +verificationTokenExpires');

  if (!user) {
    throw createError('Verification link is invalid or has expired.', 400, 'INVALID_OR_EXPIRED_TOKEN');
  }

  // Domain-matched alumni go to email_verified; non-institutional alumni stay pending
  // (they still need manual admin review)
  const isInstitutional = isEmailInAllowedDomains(user.email);
  let newStatus = user.verificationStatus;

  if (user.verificationStatus === 'pending') {
    if (user.role === 'student') {
      newStatus = env.STUDENT_REQUIRES_ADMIN_APPROVAL ? 'email_verified' : 'admin_approved';
    } else if (user.role === 'alumni' && isInstitutional) {
      newStatus = 'email_verified'; // Still needs admin_approved for full alumni features
    }
    // Non-institutional alumni: stays pending after email click — admin must review
  }

  user.verificationStatus = newStatus;
  user.verificationTokenHash = undefined;
  user.verificationTokenExpires = undefined;
  user.emailVerificationOtpHash = undefined;
  user.emailVerificationOtpExpiresAt = undefined;
  user.emailVerificationOtpAttempts = undefined;
  await user.save();

  return safeUser(user);
}

// ── Resend verification email (Legacy link-based) ─────────────────────────────
export async function resendVerificationEmail(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail }).select('+verificationTokenHash +verificationTokenExpires');

  // Generic silent return if user does not exist or is already verified
  if (!user || user.verificationStatus !== 'pending') {
    return;
  }

  const { raw, hash, expires } = generateSecureToken(VERIFICATION_TOKEN_TTL);
  user.verificationTokenHash = hash;
  user.verificationTokenExpires = expires;
  await user.save();

  sendVerificationEmail(user.email, user.name, raw).catch((err) =>
    console.error('[RESEND_VERIFICATION] Failed to send email:', err?.message || err)
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────
export async function loginUser(input: LoginInput): Promise<{
  user: ReturnType<typeof safeUser>;
  accessToken: string;
  rawRefresh: string;
}> {
  const { email, password } = input;

  // Fetch user with passwordHash (select:false by default)
  const user = await User.findOne({ email }).select('+passwordHash');

  // Step 1: validate credentials — same error for wrong email or wrong password
  if (!user) {
    throw createError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  }
  const passwordOk = await comparePassword(password, user.passwordHash);
  if (!passwordOk) {
    throw createError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  }

  // Step 2: check accountStatus AFTER validating credentials
  if (user.accountStatus === 'suspended' || user.accountStatus === 'deactivated') {
    throw createError(
      'Your account has been suspended. Please contact the institution administrator.',
      403,
      'ACCOUNT_SUSPENDED'
    );
  }

  // Step 3: check if email is verified for non-admin accounts
  if (user.role !== 'admin' && user.verificationStatus === 'pending') {
    throw createError(
      'Please verify your email address to continue.',
      403,
      'EMAIL_VERIFICATION_REQUIRED'
    );
  }

  // Issue tokens + update lastLogin
  const { accessToken, rawRefresh, refreshHash } = issueTokens(user);

  user.refreshTokenHash = refreshHash;
  user.lastLogin = new Date();
  await user.save();

  return { user: safeUser(user), accessToken, rawRefresh };
}

// ── Refresh ───────────────────────────────────────────────────────────────────
export async function refreshTokens(rawRefreshToken: string): Promise<{
  user: ReturnType<typeof safeUser>;
  accessToken: string;
  rawRefresh: string;
}> {
  const hash = hashToken(rawRefreshToken);

  const user = await User.findOne({ refreshTokenHash: hash }).select(
    '+refreshTokenHash ' + SAFE_USER_FIELDS
  );

  if (!user) {
    throw createError('Refresh token is invalid or has been revoked.', 401, 'NOT_AUTHENTICATED');
  }

  if (user.accountStatus !== 'active') {
    throw createError('Account is suspended.', 403, 'ACCOUNT_SUSPENDED');
  }

  // Rotate: invalidate old hash, issue new one
  const { accessToken, rawRefresh, refreshHash } = issueTokens(user);
  user.refreshTokenHash = refreshHash;
  await user.save();

  return { user: safeUser(user), accessToken, rawRefresh };
}

// ── Logout ────────────────────────────────────────────────────────────────────
export async function logoutUser(userId: string): Promise<void> {
  await User.findByIdAndUpdate(userId, { $unset: { refreshTokenHash: 1 } });
}

// ── Forgot password ───────────────────────────────────────────────────────────
export async function forgotPassword(email: string): Promise<void> {
  // Always return the same response — don't reveal whether email exists
  const user = await User.findOne({ email });
  if (!user) return; // Silent — no email sent, but caller gets same response

  const { raw, hash, expires } = generateSecureToken(RESET_TOKEN_TTL);

  user.resetTokenHash = hash;
  user.resetTokenExpires = expires;
  await user.save();

  sendPasswordResetEmail(email, user.name, raw).catch((err) =>
    console.error('[FORGOT_PASSWORD] Email error:', err)
  );
}

// ── Reset password ────────────────────────────────────────────────────────────
export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const hash = hashToken(rawToken);

  const user = await User.findOne({
    resetTokenHash: hash,
    resetTokenExpires: { $gt: new Date() },
  }).select('+resetTokenHash +resetTokenExpires');

  if (!user) {
    throw createError('Password reset link is invalid or has expired.', 400, 'INVALID_OR_EXPIRED_TOKEN');
  }

  user.passwordHash = await hashPassword(newPassword);
  user.resetTokenHash = undefined;
  user.resetTokenExpires = undefined;
  // Invalidate all existing sessions on password change
  user.refreshTokenHash = undefined;
  await user.save();
}

// ── Change password ──────────────────────────────────────────────────────────
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) {
    throw createError('User not found.', 404, 'NOT_FOUND');
  }

  const isCurrentValid = await comparePassword(currentPassword, user.passwordHash);
  if (!isCurrentValid) {
    throw createError('Incorrect current password.', 401, 'INVALID_CREDENTIALS');
  }

  user.passwordHash = await hashPassword(newPassword);
  // Revoke existing sessions
  user.refreshTokenHash = undefined;
  await user.save();
}

// ── Admin: approve user ───────────────────────────────────────────────────────
export async function approveUser(userId: string): Promise<IUser> {
  const user = await User.findByIdAndUpdate(
    userId,
    { verificationStatus: 'admin_approved', rejectionReason: undefined },
    { new: true }
  ).select(SAFE_USER_FIELDS);

  if (!user) throw createError('User not found.', 404, 'NOT_FOUND');

  sendApprovalEmail(user.email, user.name).catch(() => {});
  return user;
}

// ── Admin: reject user ────────────────────────────────────────────────────────
export async function rejectUser(userId: string, reason: string): Promise<IUser> {
  const user = await User.findByIdAndUpdate(
    userId,
    { verificationStatus: 'rejected', rejectionReason: reason },
    { new: true }
  ).select(SAFE_USER_FIELDS);

  if (!user) throw createError('User not found.', 404, 'NOT_FOUND');

  sendRejectionEmail(user.email, user.name, reason).catch(() => {});
  return user;
}

// ── Admin: suspend user ───────────────────────────────────────────────────────
export async function suspendUser(userId: string): Promise<IUser> {
  // Clear refresh token immediately so active sessions are kicked
  const user = await User.findByIdAndUpdate(
    userId,
    { accountStatus: 'suspended', $unset: { refreshTokenHash: 1 } },
    { new: true }
  ).select(SAFE_USER_FIELDS);

  if (!user) throw createError('User not found.', 404, 'NOT_FOUND');
  return user;
}

// ── Admin: reactivate user ────────────────────────────────────────────────────
export async function reactivateUser(userId: string): Promise<IUser> {
  const user = await User.findByIdAndUpdate(
    userId,
    { accountStatus: 'active' },
    { new: true }
  ).select(SAFE_USER_FIELDS);

  if (!user) throw createError('User not found.', 404, 'NOT_FOUND');
  return user;
}
