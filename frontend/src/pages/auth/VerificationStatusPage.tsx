import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { VerificationStatusCard } from '../../components/VerificationStatusCard';
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl w-full">
        <div className="flex justify-center items-center gap-2 mb-8">
          <div className="w-10 h-10 bg-navy-900 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md">
            AC
          </div>
          <span className="text-2xl font-black tracking-tight text-navy-900">AlumniConnect</span>
        </div>

        <div className="card p-8 shadow-card border border-gray-200">
          <div className="mb-6 border-b pb-4">
            <h1 className="text-2xl font-black text-navy-900">Account Status</h1>
            <p className="text-sm text-gray-500 mt-1">
              {newlyRegistered ? 'Registration submitted! Review your access privileges below.' : 'Current verification standing for your profile.'}
            </p>
          </div>

          <div className="mb-8">
            <VerificationStatusCard
              verificationStatus={currentStatus}
              role={role}
              accountStatus={accountStatus}
              rejectionReason={rejectionReason}
              email={email}
            />
          </div>

          {/* User profile summary */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-6 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Full Name:</span>
              <span className="font-semibold text-navy-900">{routeUser?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Email:</span>
              <span className="font-mono text-navy-900">{routeUser?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Assigned Role:</span>
              <span className="capitalize font-bold text-navy-900">{routeUser?.role}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center pt-2">
            <Link to="/" className="btn btn-outline w-full sm:w-auto">
              <Home className="w-4 h-4 mr-1" />
              Back to Home
            </Link>

            {currentStatus === 'admin_approved' || (role === 'student' && currentStatus === 'email_verified') ? (
              <Link
                to={`/dashboard/${role}`}
                className="btn btn-primary w-full sm:w-auto"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={logout}
                className="btn btn-ghost text-red-600 hover:bg-red-50 w-full sm:w-auto text-xs"
              >
                <LogOut className="w-4 h-4 mr-1" />
                Sign Out
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
