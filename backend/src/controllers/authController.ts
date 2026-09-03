import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { setRefreshCookie, clearRefreshCookie, REFRESH_COOKIE_NAME } from '../utils/cookies';
import * as authService from '../services/authService';

// ── POST /api/v1/auth/register ────────────────────────────────────────────────
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { user, accessToken, rawRefresh } = await authService.registerUser(req.body);
  setRefreshCookie(res, rawRefresh);
  res.status(201).json({ success: true, data: { user, accessToken } });
});

// ── POST /api/v1/auth/login ───────────────────────────────────────────────────
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { user, accessToken, rawRefresh } = await authService.loginUser(req.body);
  setRefreshCookie(res, rawRefresh);
  res.json({ success: true, data: { user, accessToken } });
});

// ── POST /api/v1/auth/logout ──────────────────────────────────────────────────
export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.user) {
    await authService.logoutUser(req.user._id.toString());
  }
  clearRefreshCookie(res);
  res.json({ success: true, data: { message: 'Logged out successfully.' } });
});

// ── POST /api/v1/auth/refresh ─────────────────────────────────────────────────
export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const rawRefreshToken = req.cookies[REFRESH_COOKIE_NAME];
  if (!rawRefreshToken) {
    return res.status(401).json({
      success: false,
      error: { code: 'NOT_AUTHENTICATED', message: 'No refresh token provided.' },
    });
  }

  const { user, accessToken, rawRefresh } = await authService.refreshTokens(rawRefreshToken);
  setRefreshCookie(res, rawRefresh);
  res.json({ success: true, data: { user, accessToken } });
});

// ── POST /api/v1/auth/verify-email ───────────────────────────────────────────
export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) {
    return res.status(422).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Verification token is required.' },
    });
  }
  const user = await authService.verifyEmail(token);
  res.json({ success: true, data: { user, message: 'Email verified successfully.' } });
});

// ── POST /api/v1/auth/forgot-password ────────────────────────────────────────
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.forgotPassword(req.body.email);
  // Always identical response — no email enumeration
  res.json({
    success: true,
    data: { message: 'If an account exists for this email, a reset link has been sent.' },
  });
});

// ── POST /api/v1/auth/reset-password ─────────────────────────────────────────
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body;
  await authService.resetPassword(token, password);
  clearRefreshCookie(res); // Invalidate browser's refresh cookie too
  res.json({ success: true, data: { message: 'Password reset successfully. Please log in again.' } });
});

// ── GET /api/v1/auth/me ───────────────────────────────────────────────────────
export const getMe = asyncHandler(async (req: Request, res: Response) => {
  // req.user is already the safe subset attached by authenticate()
  res.json({ success: true, data: { user: req.user } });
});
