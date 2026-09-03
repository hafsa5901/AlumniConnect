import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import { CheckCircle2, XCircle, ArrowRight, Loader2 } from 'lucide-react';
import { Button, Card } from '../../components/ui';

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
      setErrorMessage('Missing verification token from confirmation link.');
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
      <div className="max-w-md w-full space-y-6">
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

        <Card className="p-8 shadow-card border border-slate-200 text-center">
          {isLoading ? (
            <div className="py-8 space-y-4">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
              <h2 className="text-lg font-bold text-navy-900">Verifying your email...</h2>
              <p className="text-xs text-slate-500">Checking cryptographic token signature.</p>
            </div>
          ) : isSuccess ? (
            <div className="py-4 space-y-5 animate-fade-in">
              <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto text-green-600">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h1 className="text-2xl font-extrabold text-navy-900">Email Verified</h1>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  {verifiedUser?.role === 'alumni'
                    ? 'Your institutional email is verified. Your alumni profile is now in the administrator verification queue.'
                    : 'Your institutional student mailbox ownership has been verified.'}
                </p>
              </div>

              <div className="pt-4">
                <Link to="/login">
                  <Button variant="primary" size="lg" className="w-full justify-center" rightIcon={<ArrowRight className="w-4 h-4" />}>
                    Sign In to Continue
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="py-4 space-y-5 animate-fade-in">
              <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-600">
                <XCircle className="w-8 h-8" />
              </div>

              <div>
                <h1 className="text-2xl font-extrabold text-navy-900">Verification Failed</h1>
                <p className="text-xs text-red-600 mt-2 font-medium">{errorMessage}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Verification links expire after 24 hours.
                </p>
              </div>

              <div className="pt-4 flex gap-3">
                <Link to="/login" className="flex-1">
                  <Button variant="primary" size="md" className="w-full justify-center">
                    Sign In
                  </Button>
                </Link>
                <Link to="/register" className="flex-1">
                  <Button variant="outline" size="md" className="w-full justify-center">
                    Register
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
