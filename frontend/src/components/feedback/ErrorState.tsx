import React from 'react';
import { AlertCircle, RefreshCw, ShieldAlert, WifiOff, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';

export type ErrorType =
  | 'generic'
  | 'load'
  | 'session_expired'
  | 'unauthorized'
  | 'network';

export interface ErrorStateProps {
  type?: ErrorType;
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  type = 'generic',
  title,
  message,
  onRetry,
  className = '',
}) => {
  const navigate = useNavigate();

  const defaults = {
    generic: {
      icon: AlertCircle,
      title: 'Something went wrong',
      message: 'An unexpected system error occurred. Please try again or refresh the page.',
      action: onRetry ? (
        <Button variant="primary" size="sm" onClick={onRetry} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
          Try Again
        </Button>
      ) : null,
    },
    load: {
      icon: AlertCircle,
      title: 'Unable to load data',
      message: 'Failed to retrieve records from the security service. Please check your network connection.',
      action: onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
          Retry Request
        </Button>
      ) : null,
    },
    session_expired: {
      icon: LogIn,
      title: 'Session expired',
      message: 'Your authentication credentials have expired. Please sign in again to continue.',
      action: (
        <Button variant="primary" size="sm" onClick={() => navigate('/login')}>
          Sign In Again
        </Button>
      ),
    },
    unauthorized: {
      icon: ShieldAlert,
      title: 'Access restricted',
      message: 'You do not have administrative or required role permissions to view this resource.',
      action: (
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      ),
    },
    network: {
      icon: WifiOff,
      title: 'Network connection error',
      message: 'Unable to connect to the AlumniConnect server. Verify your internet connection and try again.',
      action: onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
          Reconnect
        </Button>
      ) : null,
    },
  }[type];

  const IconComponent = defaults.icon;
  const displayTitle = title || defaults.title;
  const displayMessage = message || defaults.message;

  return (
    <div
      role="alert"
      className={`card p-10 text-center flex flex-col items-center justify-center max-w-md mx-auto border-red-200 bg-red-50/30 ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
        <IconComponent className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-navy-900 mb-1">{displayTitle}</h3>
      <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
        {displayMessage}
      </p>
      {defaults.action}
    </div>
  );
};
