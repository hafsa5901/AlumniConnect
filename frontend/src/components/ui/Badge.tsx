import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'blue' | 'green' | 'yellow' | 'red' | 'gray' | 'navy';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'blue',
  size = 'md',
  icon,
  className = '',
}) => {
  const variantClasses = {
    blue: 'badge-blue',
    green: 'badge-green',
    yellow: 'badge-yellow',
    red: 'badge-red',
    gray: 'badge-gray',
    navy: 'badge-navy',
  }[variant];

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  }[size];

  return (
    <span className={`badge ${variantClasses} ${sizeClasses} ${className}`}>
      {icon && <span className="inline-flex shrink-0 mr-1">{icon}</span>}
      {children}
    </span>
  );
};
