import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/auth';
import User, { IUser, Role } from '../models/User';
import { createError } from './errorHandler';

// Extend Request to carry the authenticated user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: Pick<IUser, '_id' | 'name' | 'email' | 'role' | 'accountStatus' | 'verificationStatus'>;
    }
  }
}

/**
 * authenticate — validates access token, loads user, checks accountStatus.
 * Applied to every protected route.
 * Order per spec §10:
 *   1. Verify token signature/expiry        → 401 NOT_AUTHENTICATED
 *   2. Load user from DB                    → 401 NOT_AUTHENTICATED (user deleted)
 *   3. Check accountStatus === 'active'     → 403 ACCOUNT_SUSPENDED
 *   4. Attach req.user for downstream use
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next(createError('Authentication required.', 401, 'NOT_AUTHENTICATED'));
    }

    const token = authHeader.slice(7);
    let payload: { userId: string; role: string };
    try {
      payload = verifyAccessToken(token);
    } catch {
      return next(createError('Invalid or expired token.', 401, 'NOT_AUTHENTICATED'));
    }

    // Load user — only safe fields, no hashes
    const user = await User.findById(payload.userId).select(
      '_id name email role accountStatus verificationStatus'
    );
    if (!user) {
      return next(createError('User no longer exists.', 401, 'NOT_AUTHENTICATED'));
    }

    if (user.accountStatus !== 'active') {
      return next(
        createError(
          'Your account has been suspended or deactivated.',
          403,
          'ACCOUNT_SUSPENDED'
        )
      );
    }

    req.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
      verificationStatus: user.verificationStatus,
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * requireRole — checks that req.user.role is in the allowed set.
 * NOTE: This is a UX convenience enforced server-side, not a substitute
 * for per-resource ownership checks in individual controllers.
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(createError('Authentication required.', 401, 'NOT_AUTHENTICATED'));
    }
    if (!roles.includes(req.user.role as Role)) {
      return next(
        createError(
          `Access denied. Requires role: ${roles.join(' or ')}.`,
          403,
          'FORBIDDEN_ROLE'
        )
      );
    }
    next();
  };
}

/**
 * requireVerificationStatus — checks that req.user has at least the
 * required verificationStatus for a specific alumni-only feature.
 * Must be composed AFTER requireRole.
 */
export function requireApproved() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(createError('Authentication required.', 401, 'NOT_AUTHENTICATED'));
    }
    if (req.user.verificationStatus !== 'admin_approved') {
      return next(
        createError(
          'Your account must be approved by an administrator before accessing this feature.',
          403,
          'NOT_APPROVED'
        )
      );
    }
    next();
  };
}
