import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

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
      <div className="max-w-md w-full">
        <div className="flex justify-center items-center gap-2 mb-8">
          <div className="w-10 h-10 bg-navy-900 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md">
            AC
          </div>
          <span className="text-2xl font-black tracking-tight text-navy-900">AlumniConnect</span>
        </div>

        <div className="card p-8 shadow-card border border-gray-200">
          {isSubmitted ? (
            <div className="text-center py-4 space-y-4 animate-fade-in">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h1 className="text-xl font-bold text-navy-900">Check your inbox</h1>
              <p className="text-sm text-gray-600 leading-relaxed">
                If an account exists for <strong className="text-navy-900">{email}</strong>, a secure reset link has been dispatched.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 text-left">
                ⏱️ For security, the reset link expires in <strong>1 hour</strong>.
              </div>
              <div className="pt-4">
                <Link to="/login" className="btn btn-outline w-full">
                  Return to Sign In
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-2xl font-bold text-navy-900 mb-2">Reset Password</h1>
              <p className="text-sm text-gray-600 mb-6">
                Enter your registered email address and we will send you a one-time link to reset your credentials.
              </p>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="label">Registered Email Address</label>
                  <div className="relative">
                    <Mail className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
                    <input
                      id="email"
                      type="email"
                      className="input pl-10"
                      placeholder="name@college.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-full btn-lg"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Sending Link...' : 'Send Reset Link'}
                </button>
              </form>

              <div className="mt-6 pt-4 border-t text-center">
                <Link to="/login" className="text-xs font-semibold text-accent-600 hover:underline inline-flex items-center gap-1">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Sign In
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
