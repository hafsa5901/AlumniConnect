import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Lock, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

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
      {/* Left panel - Decorative & Information */}
      <div className="hidden lg:flex lg:w-1/2 bg-navy-900 flex-col justify-between p-16 text-white relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-navy-900 font-extrabold text-lg">AC</span>
            </div>
            <span className="text-white font-bold text-2xl tracking-tight">AlumniConnect</span>
          </div>

          <div className="max-w-md">
            <span className="badge bg-navy-800 text-accent-300 border border-navy-700 px-3 py-1 mb-6 text-xs uppercase tracking-wider">
              Secure Campus Network
            </span>
            <h2 className="text-4xl font-extrabold text-white mb-6 leading-tight">
              Bridging the gap between students, alumni & institutions.
            </h2>
            <p className="text-navy-200 text-base leading-relaxed mb-8">
              Access verified alumni directories, career mentorship pipelines, exclusive campus events, and referral-driven job opportunities.
            </p>

            <div className="space-y-3 text-sm text-navy-200">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Zero fabricated profiles or public admin registrations</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-accent-400" />
                <span>Strict institutional email & manual degree verification</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span>Direct mentorship matching with active alumni</span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-xs text-navy-400 z-10">
          © {new Date().getFullYear()} AlumniConnect. Enterprise Verification System.
        </div>
      </div>

      {/* Right panel - Login form */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-20">
        <div className="max-w-md w-full mx-auto">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-navy-900 rounded-lg flex items-center justify-center text-white font-bold">
              AC
            </div>
            <span className="font-bold text-navy-900 text-xl">AlumniConnect</span>
          </div>

          <h1 className="text-3xl font-extrabold text-navy-900 mb-2">Sign in to your account</h1>
          <p className="text-gray-500 text-sm mb-8">
            New to the network?{' '}
            <Link to="/register" className="text-accent-600 font-semibold hover:underline">
              Register as Student or Alumni
            </Link>
          </p>

          {/* Explicit Error Messages based on server code */}
          {errorDetails && (
            <div
              className={`mb-6 p-4 rounded-xl border text-sm flex items-start gap-3 animate-fade-in ${
                errorDetails.code === 'ACCOUNT_SUSPENDED'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">
                  {errorDetails.code === 'ACCOUNT_SUSPENDED'
                    ? 'Account Suspended'
                    : 'Authentication Failed'}
                </strong>
                <span>{errorDetails.message}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="email" className="label">Email Address</label>
              <div className="relative">
                <Mail className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="input pl-10"
                  placeholder="name@college.edu"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="password" className="label !mb-0">Password</label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-accent-600 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="input pl-10 pr-10"
                  placeholder="••••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              id="login-submit-btn"
              className="btn-primary btn w-full btn-lg font-semibold"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Authenticating...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <span className="text-xs text-gray-500">
              Need admin access? Administrator accounts are provisioned directly by institution leads.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
