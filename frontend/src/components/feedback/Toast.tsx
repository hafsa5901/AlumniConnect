import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  id?: string;
  variant: ToastVariant;
  title: string;
  message?: string;
  onDismiss?: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  variant,
  title,
  message,
  onDismiss,
}) => {
  const config = {
    success: {
      bg: 'bg-white',
      border: 'border-green-600',
      icon: <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />,
    },
    error: {
      bg: 'bg-white',
      border: 'border-red-600',
      icon: <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />,
    },
    warning: {
      bg: 'bg-white',
      border: 'border-amber-600',
      icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
    },
    info: {
      bg: 'bg-white',
      border: 'border-blue-600',
      icon: <Info className="w-5 h-5 text-blue-600 shrink-0" />,
    },
  }[variant];

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-4 rounded-card shadow-modal border ${config.border} ${config.bg} max-w-sm w-full animate-slide-up`}
    >
      {config.icon}
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-bold text-navy-900">{title}</h4>
        {message && <p className="text-xs text-slate-500 mt-0.5">{message}</p>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-slate-500 hover:text-navy-900 p-0.5 rounded transition-colors"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
