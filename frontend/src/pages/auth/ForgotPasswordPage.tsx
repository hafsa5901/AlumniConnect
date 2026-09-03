import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button, Input, Card } from '../../components/ui';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setError('');
    setIsSubmitting(true);

    try {
      await authService.forgotPassword(email);
      setIsSubmitted(true);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to submit password reset request.');
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
          {isSubmitted ? (
            <div className="text-center py-4 space-y-4 animate-fade-in">
              <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto text-green-600">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h1 className="text-xl font-bold text-navy-900">Check your inbox</h1>
              <p className="text-xs text-slate-500 leading-relaxed">
                If an account exists for <strong className="text-navy-900 font-mono">{email}</strong>, a secure password reset link has been dispatched.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 text-left">
                ⏱️ For security, the reset link expires in <strong>1 hour</strong>.
              </div>
              <div className="pt-4">
                <Link to="/login">
                  <Button variant="outline" size="md" className="w-full justify-center">
                    Return to Sign In
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-2xl font-extrabold text-navy-900 mb-1.5">Reset Password</h1>
              <p className="text-xs text-slate-500 mb-6">
                Enter your registered email address and we will dispatch a one-time link to update your credentials.
              </p>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-900 rounded-lg p-3 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  id="email"
                  type="email"
                  label="Registered Email Address"
                  placeholder="name@college.edu"
                  leftIcon={<Mail className="w-4 h-4" />}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full justify-center"
                  isLoading={isSubmitting}
                >
                  Send Reset Link
                </Button>
              </form>

              <div className="mt-6 pt-4 border-t border-slate-200 text-center">
                <Link
                  to="/login"
                  className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Sign In
                </Link>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
