import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import { CheckCircle2, XCircle, ArrowRight, Loader2 } from 'lucide-react';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [verifiedUser, setVerifiedUser] = useState<any>(null);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      setErrorMessage('Missing verification token in URL.');
      return;
    }

    authService
      .verifyEmail(token)
      .then((res) => {
        setIsSuccess(true);
        setVerifiedUser(res.data.data.user);
      })
      .catch((err) => {
        setIsSuccess(false);
        setErrorMessage(
          err?.response?.data?.error?.message ||
            'Verification link is invalid or has expired.'
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="flex justify-center items-center gap-2 mb-8">
          <div className="w-10 h-10 bg-navy-900 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md">
            AC
          </div>
          <span className="text-2xl font-black tracking-tight text-navy-900">AlumniConnect</span>
        </div>

        <div className="card p-8 shadow-card border border-gray-200 text-center">
          {isLoading ? (
            <div className="py-8 space-y-4">
              <Loader2 className="w-10 h-10 text-accent-600 animate-spin mx-auto" />
              <h2 className="text-lg font-bold text-navy-900">Verifying your email...</h2>
              <p className="text-xs text-gray-500">Checking verification signature with security service.</p>
            </div>
          ) : isSuccess ? (
            <div className="py-4 space-y-5 animate-fade-in">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h1 className="text-2xl font-black text-navy-900">Email Verified!</h1>
                <p className="text-sm text-gray-600 mt-2">
                  {verifiedUser?.role === 'alumni'
                    ? 'Your email address is verified. Your alumni profile is now awaiting administrator approval.'
                    : 'Your institutional student email has been verified successfully.'}
                </p>
              </div>

              <div className="pt-4">
                <Link to="/login" className="btn btn-primary w-full btn-lg">
                  Sign In to Continue
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="py-4 space-y-5 animate-fade-in">
              <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600">
                <XCircle className="w-10 h-10" />
              </div>

              <div>
                <h1 className="text-2xl font-black text-navy-900">Verification Failed</h1>
                <p className="text-sm text-rose-600 mt-2 font-medium">{errorMessage}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Verification links expire after 24 hours. You can request a new link or contact support.
                </p>
              </div>

              <div className="pt-4 flex gap-3">
                <Link to="/login" className="btn btn-primary flex-1">
                  Return to Login
                </Link>
                <Link to="/register" className="btn btn-outline flex-1">
                  Register Again
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
