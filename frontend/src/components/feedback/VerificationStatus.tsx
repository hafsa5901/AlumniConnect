import React from 'react';
import { ShieldCheck, Clock, AlertTriangle, XCircle, Mail, CheckCircle2 } from 'lucide-react';
import type { VerificationStatus as TVerificationStatus, Role, AccountStatus } from '../../types';
import { Badge } from '../ui/Badge';

export interface VerificationStatusProps {
  verificationStatus: TVerificationStatus;
  role?: Role;
  accountStatus?: AccountStatus;
  rejectionReason?: string;
  email?: string;
  className?: string;
}

export const VerificationStatus: React.FC<VerificationStatusProps> = ({
  verificationStatus,
  role = 'student',
  accountStatus = 'active',
  rejectionReason,
  email,
  className = '',
}) => {
  if (accountStatus === 'suspended') {
    return (
      <div
        role="alert"
        className={`card p-6 border-red-200 bg-red-50/40 text-slate-900 animate-fade-in ${className}`}
      >
        <div className="flex items-start gap-4">
          <div className="p-2.5 bg-red-100 text-red-600 rounded-lg shrink-0">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-bold text-navy-900">Account Suspended</h3>
              <Badge variant="red" size="sm">Suspended</Badge>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-3">
              Your AlumniConnect account has been placed on administrative suspension. All active sessions and authenticated feature routes have been revoked.
            </p>
            <p className="text-xs text-slate-500">
              For inquiry or reactivation assistance, contact the institution moderation team.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (verificationStatus === 'rejected') {
    return (
      <div
        role="alert"
        className={`card p-6 border-red-200 bg-red-50/30 text-slate-900 animate-fade-in ${className}`}
      >
        <div className="flex items-start gap-4">
          <div className="p-2.5 bg-red-100 text-red-600 rounded-lg shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-bold text-navy-900">Application Not Approved</h3>
              <Badge variant="red" size="sm">Rejected</Badge>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-3">
              Your profile verification request was reviewed by institution administrators and could not be validated against campus registrar records.
            </p>
            {rejectionReason && (
              <div className="bg-white border border-red-200 rounded-lg p-3 text-xs text-red-600 font-medium mb-3">
                <span className="font-bold text-navy-900 block mb-0.5">Administrator Feedback:</span>
                {rejectionReason}
              </div>
            )}
            <p className="text-xs text-slate-500">
              You may submit updated graduation documents or contact your department administrator for re-evaluation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (verificationStatus === 'pending') {
    return (
      <div
        role="status"
        className={`card p-6 border-amber-200 bg-amber-50/30 text-slate-900 animate-fade-in ${className}`}
      >
        <div className="flex items-start gap-4">
          <div className="p-2.5 bg-amber-100 text-amber-600 rounded-lg shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-bold text-navy-900">Verification Pending</h3>
              <Badge variant="yellow" size="sm">Awaiting Review</Badge>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-3">
              {role === 'alumni'
                ? 'Your alumni application is awaiting administrative verification. Our team verifies alumni graduation records to ensure zero fabricated profiles.'
                : 'Your student account is pending email confirmation or administrative verification.'}
            </p>
            <div className="bg-white border border-amber-200 rounded-lg p-3 text-xs text-slate-900 space-y-1">
              <p className="flex items-center gap-2 font-medium">
                <Mail className="w-4 h-4 text-amber-600" />
                <span>Verification email sent to: <strong className="font-mono text-navy-900">{email || 'your registered address'}</strong></span>
              </p>
              <p className="text-slate-500 text-[11px] pt-1">
                Alumni features (Directory search, Job postings, Mentorship) unlock automatically once approved.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (verificationStatus === 'email_verified') {
    return (
      <div
        role="status"
        className={`card p-6 border-blue-200 bg-blue-50/30 text-slate-900 animate-fade-in ${className}`}
      >
        <div className="flex items-start gap-4">
          <div className="p-2.5 bg-blue-100 text-blue-600 rounded-lg shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-bold text-navy-900">Institutional Email Confirmed</h3>
              <Badge variant="blue" size="sm">Email Verified</Badge>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your institutional mailbox ownership has been verified.
              {role === 'alumni'
                ? ' Your profile is in the administrator approval queue to activate full alumni directory, mentoring, and hiring capabilities.'
                : ' Your student network access is active.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // admin_approved
  return (
    <div
      role="status"
      className={`card p-6 border-green-200 bg-green-50/30 text-slate-900 animate-fade-in ${className}`}
    >
      <div className="flex items-start gap-4">
        <div className="p-2.5 bg-green-100 text-green-600 rounded-lg shrink-0">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-bold text-navy-900">Fully Verified & Approved</h3>
            <Badge variant="green" size="sm">Active Member</Badge>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Your institutional credentials have been authenticated. You have complete access to directory search, mentorship pipelines, and alumni opportunities.
          </p>
        </div>
      </div>
    </div>
  );
};
