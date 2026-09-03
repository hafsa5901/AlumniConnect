import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { Role, VerificationStatus } from '../../types';

export interface VerifiedBadgeProps {
  role?: Role;
  verificationStatus?: VerificationStatus;
  size?: 'sm' | 'md';
  className?: string;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  role,
  verificationStatus,
  size = 'md',
  className = '',
}) => {
  // Only renders for approved alumni
  if (role !== 'alumni' || verificationStatus !== 'admin_approved') {
    return null;
  }

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  }[size];

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
  }[size];

  return (
    <span
      className={`inline-flex items-center font-bold rounded-full bg-green-50 text-green-600 border border-green-200 ${sizeClasses} ${className}`}
      title="Officially verified alumni record"
    >
      <ShieldCheck className={`${iconSizes} text-green-600 shrink-0`} />
      <span>Verified Alumni</span>
    </span>
  );
};
