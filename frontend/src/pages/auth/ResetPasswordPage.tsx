import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input, Card } from '../../components/ui';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Missing or invalid reset token from URL link.');
      return;
    }

    if (password.length < 10) {
      setError('Password must be at least 10 characters.');
      return;
    }

    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must contain both letters and numbers.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await authService.resetPassword(token, password);
      setIsSuccess(true);
      toast.success('Password updated successfully!');
      setTimeout(() => navigate('/login'), 2500);
    } catch (err: any) {
      setError(
        err?.response?.data?.error?.message ||
          'Reset link is invalid or has expired. Please request a new link.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

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

        <Card className="p-8 shadow-card border border-slate-200">
          {isSuccess ? (
            <div className="text-center py-4 space-y-4 animate-fade-in">
              <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto text-green-600">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h1 className="text-xl font-bold text-navy-900">Password Reset Complete</h1>
              <p className="text-xs text-slate-500">
                Your password has been changed and all previous sessions were revoked. Redirecting to sign in...
              </p>
              <div className="pt-2">
                <Link to="/login">
                  <Button variant="primary" size="md" className="w-full justify-center">
                    Sign In Now
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-2xl font-extrabold text-navy-900 mb-1">Set New Password</h1>
              <p className="text-xs text-slate-500 mb-6">
                Choose a strong password (minimum 10 characters with letters & numbers).
              </p>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-900 rounded-lg p-3 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    label="New Password"
                    placeholder="Min 10 chars"
                    leftIcon={<Lock className="w-4 h-4" />}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-9 text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    label="Confirm New Password"
                    placeholder="Repeat new password"
                    leftIcon={<Lock className="w-4 h-4" />}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full justify-center"
                  isLoading={isSubmitting}
                >
                  Save New Password
                </Button>
              </form>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
