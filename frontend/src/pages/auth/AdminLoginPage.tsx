import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Lock, Mail, Eye, EyeOff, AlertCircle, Shield, ArrowLeft, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input, Card } from '../../components/ui';

export default function AdminLoginPage() {
  const { login, logout } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorDetails, setErrorDetails] = useState<{ code?: string; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorDetails(null);

    if (!form.email || !form.password) {
      setErrorDetails({ message: 'Please provide both admin email and password.' });
      return;
    }

    setIsSubmitting(true);

    try {
      await login(form.email, form.password);

      // Re-read authenticated user from localStorage / AuthContext
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('Authentication session token could not be established.');

      // Decode JWT payload or verify role
      const payloadBase64 = token.split('.')[1];
      const payload = JSON.parse(atob(payloadBase64));

      if (payload.role !== 'admin') {
        // Non-admin attempting to access admin portal: log out and display error
        await logout();
        setErrorDetails({
          code: 'FORBIDDEN_ROLE',
          message: 'Access Denied: This administrative gateway is restricted to platform administrators.',
        });
        toast.error('Unauthorized access to administration gateway.');
        return;
      }

      toast.success('Administrator authenticated successfully.');
      navigate('/admin/dashboard', { replace: true });
    } catch (err: any) {
      const errData = err?.response?.data?.error;
      const code = errData?.code || 'ERROR';
      const message =
        errData?.message ||
        'Authentication failed. Please verify your administrative credentials.';
      setErrorDetails({ code, message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Subtle Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-navy-800 via-slate-900 to-slate-950 pointer-events-none opacity-80" />

      <div className="max-w-md w-full space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-navy-800 border border-navy-700 rounded-2xl shadow-lg text-white">
            <Shield className="w-7 h-7 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Platform Administration
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Authorized Institutional Personnel Only
            </p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="p-8 bg-slate-900/90 backdrop-blur-md border border-slate-800 shadow-2xl">
          {/* Error Alert */}
          {errorDetails && (
            <div
              role="alert"
              className="mb-6 p-4 rounded-lg bg-red-950/50 border border-red-800/60 text-xs flex items-start gap-3 text-red-200 animate-fade-in"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold text-red-300 mb-0.5">
                  {errorDetails.code === 'FORBIDDEN_ROLE'
                    ? 'Restricted Portal'
                    : errorDetails.code === 'ACCOUNT_SUSPENDED'
                    ? 'Account Suspended'
                    : 'Authentication Failure'}
                </strong>
                <span>{errorDetails.message}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="admin-email" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Administrator Email <span className="text-red-400">*</span>
              </label>
              <Input
                id="admin-email"
                type="email"
                autoComplete="email"
                placeholder="admin@college.edu"
                leftIcon={<Mail className="w-4 h-4 text-slate-400" />}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="bg-slate-950/60 border-slate-800 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-blue-500/20"
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="admin-password" className="block text-xs font-semibold text-slate-300">
                  Password <span className="text-red-400">*</span>
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-blue-400 hover:text-blue-300 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="bg-slate-950/60 border-slate-800 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-blue-500/20"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300 focus:outline-none"
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
              className="w-full justify-center bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-600/20"
              isLoading={isSubmitting}
              leftIcon={<KeyRound className="w-4 h-4" />}
            >
              Sign In to Admin Portal
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to standard student & alumni login</span>
            </Link>
          </div>
        </Card>

        {/* Security Notice */}
        <p className="text-center text-[11px] text-slate-500 leading-relaxed">
          All administrative logins, queries, and mutations are cryptographically signed and recorded in deterministic tamper-evident audit logs.
        </p>
      </div>
    </div>
  );
}
