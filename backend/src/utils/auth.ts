import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

const BCRYPT_ROUNDS = 12;

// ── Password ──────────────────────────────────────────────────────────────────
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 10) return 'Password must be at least 10 characters.';
  if (!/[a-zA-Z]/.test(password)) return 'Password must contain at least one letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  return null;
}

// ── JWT ───────────────────────────────────────────────────────────────────────
export interface AccessTokenPayload {
  userId: string;
  role: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

// ── Opaque tokens (verification, password-reset, refresh) ────────────────────
/**
 * Generates a secure random token.
 * Returns { raw, hash, expires }.
 * raw  → goes into the email link (never stored in DB)
 * hash → stored in DB (sha256)
 */
export function generateSecureToken(expiresInMs: number): {
  raw: string;
  hash: string;
  expires: Date;
} {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = hashToken(raw);
  const expires = new Date(Date.now() + expiresInMs);
  return { raw, hash, expires };
}

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function isEmailInAllowedDomains(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  return env.COLLEGE_EMAIL_DOMAINS.includes(domain);
}

// Token expiry constants (ms)
export const VERIFICATION_TOKEN_TTL = 24 * 60 * 60 * 1000; // 24 h
export const RESET_TOKEN_TTL        =       60 * 60 * 1000; // 1 h
export const REFRESH_TOKEN_TTL      =    7 * 24 * 60 * 60 * 1000; // 7 d
