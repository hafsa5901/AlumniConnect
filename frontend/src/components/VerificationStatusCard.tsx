import React from 'react';
import { ShieldCheck, Clock, AlertTriangle, XCircle, Mail, CheckCircle } from 'lucide-react';
import type { VerificationStatus, Role, AccountStatus } from '../types';

interface Props {
  verificationStatus: VerificationStatus;
  role?: Role;
  accountStatus?: AccountStatus;
  rejectionReason?: string;
  email?: string;
}

export const VerificationStatusCard: React.FC<Props> = ({
  verificationStatus,
  role = 'student',
  accountStatus = 'active',
  rejectionReason,
  email,
}) => {
  if (accountStatus === 'suspended') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-900 shadow-sm animate-fade-in">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-red-100 rounded-lg text-red-600">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-red-900 mb-1">Account Suspended</h3>
            <p className="text-sm text-red-700 leading-relaxed mb-3">
              Your AlumniConnect account has been suspended by an administrator.
              All active sessions and feature privileges have been revoked.
            </p>
            <p className="text-xs text-red-600">
              Please contact the campus administrator at <span className="font-semibold underline">support@institution.edu</span> for resolution.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (verificationStatus === 'rejected') {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-900 shadow-sm animate-fade-in">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-rose-100 rounded-lg text-rose-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-rose-900 mb-1">Application Not Approved</h3>
            <p className="text-sm text-rose-700 leading-relaxed mb-3">
              Your profile verification request was reviewed and could not be approved at this time.
            </p>
            {rejectionReason && (
              <div className="bg-white/80 border border-rose-200 rounded-lg p-3 text-xs text-rose-800 font-medium mb-3">
                <span className="font-bold text-rose-900 block mb-0.5">Admin Note:</span>
                {rejectionReason}
              </div>
            )}
            <p className="text-xs text-rose-600">
              You may contact your department administration to provide updated documentation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (verificationStatus === 'pending') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-900 shadow-sm animate-fade-in">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-100 rounded-lg text-amber-700">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-amber-900">Verification Pending</h3>
              <span className="badge-yellow">Awaiting Review</span>
            </div>
            <p className="text-sm text-amber-800 leading-relaxed mb-3">
              {role === 'alumni'
                ? 'Your alumni application is awaiting administrative verification. Our team verifies alumni graduation records to maintain network authenticity.'
                : 'Your student account is pending email confirmation or administrative verification.'}
            </p>
            <div className="bg-white/70 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-600" />
                <span>Verification email sent to: <strong>{email || 'your registered address'}</strong></span>
              </p>
              <p className="text-amber-700">
                Alumni features (Directory search, Job postings, Mentorship) unlock automatically once an administrator approves your verification.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (verificationStatus === 'email_verified') {
    return (
      <div className="bg-sky-50 border border-sky-200 rounded-xl p-6 text-sky-900 shadow-sm animate-fade-in">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-sky-100 rounded-lg text-sky-700">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-sky-900">Email Verified</h3>
              <span className="badge-blue">Pending Admin Approval</span>
            </div>
            <p className="text-sm text-sky-800 leading-relaxed">
              Your institutional email has been verified.
              {role === 'alumni'
                ? ' Your alumni application is in the admin review queue. Directory visibility, job postings, and mentorship features will be enabled upon administrator approval.'
                : ' You are ready to explore the AlumniConnect network.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // admin_approved
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-emerald-900 shadow-sm animate-fade-in">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-emerald-100 rounded-lg text-emerald-600">
          <CheckCircle className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-bold text-emerald-900">Fully Verified & Approved</h3>
            <span className="badge-green">Active Member</span>
          </div>
          <p className="text-sm text-emerald-800 leading-relaxed">
            Your account is verified and approved. You have complete access to all AlumniConnect features.
          </p>
        </div>
      </div>
    </div>
  );
};
