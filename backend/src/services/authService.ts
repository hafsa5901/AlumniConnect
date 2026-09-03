import User, { IUser, SAFE_USER_FIELDS } from '../models/User';
import {
  hashPassword,
  comparePassword,
  signAccessToken,
  generateSecureToken,
  hashToken,
  isEmailInAllowedDomains,
  VERIFICATION_TOKEN_TTL,
  RESET_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
} from '../utils/auth';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendApprovalEmail,
  sendRejectionEmail,
} from './emailService';
import { createError } from '../middleware/errorHandler';
import { RegisterInput, LoginInput } from '../validators/auth';
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
  accessToken: string;
  rawRefresh: string;
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

  // Verification token
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
    verificationTokenHash,
    verificationTokenExpires,
  });

  // Send verification email (async, don't block registration on email failure)
  sendVerificationEmail(email, name, rawVerificationToken).catch((err) =>
    console.error('[REGISTER] Failed to send verification email:', err)
  );

  const { accessToken, rawRefresh, refreshHash, refreshExpires } = issueTokens(user);

  await User.findByIdAndUpdate(user._id, {
    refreshTokenHash: refreshHash,
    refreshTokenExpires: refreshExpires,
  });

  return { user: safeUser(user), accessToken, rawRefresh };
}

// ── Verify email ──────────────────────────────────────────────────────────────
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
  await user.save();

  return safeUser(user);
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

// ── Admin: approve user ───────────────────────────────────────────────────────
export async function approveUser(userId: string): Promise<IUser> {
  const user = await User.findByIdAndUpdate(
    userId,
    { verificationStatus: 'admin_approved' },
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
