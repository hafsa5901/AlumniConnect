import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Lock, Mail, Eye, EyeOff, AlertCircle, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input } from '../../components/ui';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorDetails, setErrorDetails] = useState<{ code?: string; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorDetails(null);
    setIsSubmitting(true);

    try {
      await login(form.email, form.password);
      toast.success('Welcome back!');
      navigate(from, { replace: true });
    } catch (err: any) {
      const errData = err?.response?.data?.error;
      const code = errData?.code || 'ERROR';
      const message = errData?.message || 'Login failed. Please check your credentials.';
      setErrorDetails({ code, message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Panel - Brand & Security Standards (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 bg-navy-900 flex-col justify-between p-16 text-white relative overflow-hidden border-r border-navy-800">
        <div className="relative z-10 space-y-8">
          {/* Logo Mark */}
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
              <svg
                className="w-5 h-5 text-navy-900"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="6" cy="6" r="3" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="12" cy="18" r="3" />
                <line x1="8.5" y1="7.5" x2="15.5" y2="7.5" />
                <line x1="7.5" y1="8.5" x2="10.5" y2="15.5" />
                <line x1="16.5" y1="8.5" x2="13.5" y2="15.5" />
              </svg>
            </div>
            <span className="text-white font-extrabold text-2xl tracking-tight">AlumniConnect</span>
          </Link>

          <div className="max-w-md space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-navy-800 text-blue-300 border border-navy-700">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>Institutional Access Boundary</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              The verified gateway for campus students & alumni.
            </h2>

            <p className="text-slate-300 text-sm leading-relaxed">
              Sign in to manage your mentorship requests, access referral-based career listings, and participate in campus networking initiatives.
            </p>

            <div className="pt-2 space-y-3 text-xs text-slate-300">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                <span>Zero fabricated profiles or public admin registrations</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                <span>Strict institutional email & manual registrar verification</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                <span>Authenticated alumni career & mentorship pipeline</span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-400 z-10 flex items-center justify-between border-t border-navy-800 pt-6">
          <span>© {new Date().getFullYear()} AlumniConnect</span>
          <span>Enterprise Release</span>
        </div>
      </div>

      {/* Right Panel - Sign In Form */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-12 bg-slate-50 lg:bg-white">
        <div className="max-w-md w-full mx-auto space-y-8">
          {/* Mobile Logo */}
          <div className="flex items-center gap-2.5 lg:hidden mb-2">
            <div className="w-8 h-8 bg-navy-900 rounded-lg flex items-center justify-center text-white font-bold">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="6" cy="6" r="3" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="12" cy="18" r="3" />
                <line x1="8.5" y1="7.5" x2="15.5" y2="7.5" />
                <line x1="7.5" y1="8.5" x2="10.5" y2="15.5" />
                <line x1="16.5" y1="8.5" x2="13.5" y2="15.5" />
              </svg>
            </div>
            <span className="font-extrabold text-navy-900 text-xl tracking-tight">AlumniConnect</span>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">
              Sign in to your account
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-1.5">
              New to the campus network?{' '}
              <Link to="/register" className="text-blue-600 font-semibold hover:underline">
                Register as Student or Alumni
              </Link>
            </p>
          </div>

          {/* Distinct Server Error Alert */}
          {errorDetails && (
            <div
              role="alert"
              className={`p-4 rounded-card border text-xs flex items-start gap-3 animate-fade-in ${
                errorDetails.code === 'ACCOUNT_SUSPENDED'
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold text-navy-900 mb-0.5">
                  {errorDetails.code === 'ACCOUNT_SUSPENDED'
                    ? 'Account Suspended'
                    : 'Authentication Failed'}
                </strong>
                <span className="text-slate-600">{errorDetails.message}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <Input
                id="email"
                type="email"
                label="Email Address"
                autoComplete="email"
                placeholder="name@college.edu or name@example.com"
                leftIcon={<Mail className="w-4 h-4" />}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="password" className="label !mb-0">
                  Password <span className="text-red-600">*</span>
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••••"
                  leftIcon={<Lock className="w-4 h-4" />}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full justify-center"
              isLoading={isSubmitting}
            >
              Sign In
            </Button>
          </form>

          <div className="pt-6 border-t border-slate-200 text-center">
            <p className="text-xs text-slate-500">
              Campus administrator accounts are provisioned directly by institution governance leads.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
