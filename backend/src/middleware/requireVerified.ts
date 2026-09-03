import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { createError } from './errorHandler';

/**
 * requireVerified — verifies that the authenticated user has reached full platform access.
 * Runs after `authenticate` middleware.
 *
 * Rules:
 * - admin: always passes
 * - alumni: verificationStatus === 'admin_approved'
 * - student: verificationStatus === 'admin_approved' if STUDENT_REQUIRES_ADMIN_APPROVAL=true,
 *            else verificationStatus === 'email_verified' OR 'admin_approved'
 *
 * Failure → 403 { code: 'NOT_VERIFIED' }
 */
export function requireVerified(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(createError('Authentication required.', 401, 'NOT_AUTHENTICATED'));
  }

  const { role, verificationStatus } = req.user;

  if (role === 'admin') {
    return next();
  }

  if (role === 'alumni') {
    if (verificationStatus === 'admin_approved') {
      return next();
    }
    return next(
      createError(
        'Alumni account must be approved by an administrator to access this feature.',
        403,
        'NOT_VERIFIED'
      )
    );
  }

  if (role === 'student') {
    if (env.STUDENT_REQUIRES_ADMIN_APPROVAL) {
      if (verificationStatus === 'admin_approved') {
        return next();
      }
    } else {
      if (verificationStatus === 'email_verified' || verificationStatus === 'admin_approved') {
        return next();
      }
    }
    return next(
      createError(
        'Student account must be verified to access this feature.',
        403,
        'NOT_VERIFIED'
      )
    );
  }

  return next(createError('Access denied.', 403, 'NOT_VERIFIED'));
}
