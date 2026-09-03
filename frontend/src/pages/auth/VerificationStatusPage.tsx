import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { VerificationStatus } from '../../components/feedback/VerificationStatus';
import { Button, Card } from '../../components/ui';
import { LogOut, ArrowRight, Home } from 'lucide-react';

export default function VerificationStatusPage() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const routeUser = (location.state as any)?.user || user;
  const newlyRegistered = (location.state as any)?.newlyRegistered;

  const currentStatus = routeUser?.verificationStatus || 'pending';
  const role = routeUser?.role || 'student';
  const email = routeUser?.email;
  const accountStatus = routeUser?.accountStatus || 'active';
  const rejectionReason = routeUser?.rejectionReason;

  const dashboardPath = `/dashboard/${role}`;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="w-10 h-10 bg-navy-900 rounded-xl flex items-center justify-center text-white font-bold shadow-sm">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="6" cy="6" r="3" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="12" cy="18" r="3" />
                <line x1="8.5" y1="7.5" x2="15.5" y2="7.5" />
                <line x1="7.5" y1="8.5" x2="10.5" y2="15.5" />
                <line x1="16.5" y1="8.5" x2="13.5" y2="15.5" />
              </svg>
            </div>
            <span className="text-2xl font-extrabold tracking-tight text-navy-900">AlumniConnect</span>
          </Link>
        </div>

        <Card className="p-8 shadow-card border border-slate-200">
          <div className="mb-6 border-b border-slate-200 pb-4">
            <h1 className="text-2xl font-extrabold text-navy-900">Account Standing</h1>
            <p className="text-xs text-slate-500 mt-1">
              {newlyRegistered
                ? 'Your registration has been submitted. Review your institutional status below.'
                : 'Current verified standing for your campus account.'}
            </p>
          </div>

          <div className="mb-6">
            <VerificationStatus
              verificationStatus={currentStatus}
              role={role}
              accountStatus={accountStatus}
              rejectionReason={rejectionReason}
              email={email}
            />
          </div>

          {/* Profile Details Summary */}
          <div className="bg-slate-50 rounded-card p-4 border border-slate-200 mb-6 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Full Name:</span>
              <span className="font-semibold text-navy-900">{routeUser?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Registered Email:</span>
              <span className="font-mono text-navy-900">{routeUser?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Assigned Role:</span>
              <span className="capitalize font-bold text-navy-900">{routeUser?.role}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center pt-2">
            <Link to="/" className="w-full sm:w-auto">
              <Button variant="outline" size="sm" leftIcon={<Home className="w-4 h-4" />}>
                Home
              </Button>
            </Link>

            {currentStatus === 'admin_approved' || (role === 'student' && currentStatus === 'email_verified') ? (
              <Link to={dashboardPath} className="w-full sm:w-auto">
                <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Go to Dashboard
                </Button>
              </Link>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-red-600 hover:bg-red-50 w-full sm:w-auto text-xs"
                leftIcon={<LogOut className="w-4 h-4" />}
              >
                Sign Out
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
