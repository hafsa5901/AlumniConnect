import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/userService';
import { Navbar, Footer, Sidebar, PageHeader } from '../../components/layout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Lock, Eye, EyeOff, ShieldCheck, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }

    if (newPassword.length < 10) {
      setError('New password must be at least 10 characters long.');
      return;
    }

    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError('New password must include both letters and numbers.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await userService.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      toast.success('Password changed successfully. Existing sessions have been revoked.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(
        err?.response?.data?.error?.message ||
          'Failed to change password. Please verify your current password.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <div className="flex-1 flex container-app px-4 sm:px-6 lg:px-8 py-8 gap-8">
        <Sidebar className="hidden md:flex rounded-card shadow-xs" />

        <main className="flex-1 space-y-6 min-w-0 max-w-2xl">
          <PageHeader
            title="Account & Security Settings"
            subtitle="Manage your credentials, login security, and campus account standing."
          />

          {/* Account Summary Card */}
          <Card className="p-6 border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Institutional Identity</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-500">Registered Email</span>
                <span className="font-mono font-semibold text-navy-900">{user?.email}</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-500">Assigned Role</span>
                <Badge variant={user?.role === 'alumni' ? 'blue' : 'green'} size="sm">
                  {user?.role}
                </Badge>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-500">Verification Standing</span>
                <Badge
                  variant={
                    user?.verificationStatus === 'admin_approved'
                      ? 'green'
                      : user?.verificationStatus === 'email_verified'
                      ? 'blue'
                      : 'yellow'
                  }
                  size="sm"
                >
                  {user?.verificationStatus}
                </Badge>
              </div>

              <div className="flex justify-between items-center py-2">
                <span className="text-slate-500">Last Session Login</span>
                <span className="font-mono text-slate-600 text-[11px]">
                  {user?.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Current Active Session'}
                </span>
              </div>
            </div>
          </Card>

          {/* Change Password Card */}
          <Card className="p-6 border-slate-200 shadow-xs space-y-5">
            <div>
              <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-navy-900" />
                <span>Update Password</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Updating your password will automatically invalidate all existing login sessions across other devices.
              </p>
            </div>

            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              {/* Current Password */}
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPw ? 'text' : 'password'}
                  label="Current Password"
                  placeholder="••••••••••"
                  leftIcon={<Lock className="w-4 h-4" />}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  className="absolute right-3.5 top-9 text-slate-400 hover:text-slate-600 focus:outline-none"
                  aria-label={showCurrentPw ? 'Hide password' : 'Show password'}
                >
                  {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* New Password */}
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPw ? 'text' : 'password'}
                  label="New Password"
                  placeholder="Min 10 characters (letters & numbers)"
                  leftIcon={<Lock className="w-4 h-4" />}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  helperText="Must be at least 10 characters with both letters and numbers."
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3.5 top-9 text-slate-400 hover:text-slate-600 focus:outline-none"
                  aria-label={showNewPw ? 'Hide password' : 'Show password'}
                >
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Confirm Password */}
              <div>
                <Input
                  id="confirmPassword"
                  type={showNewPw ? 'text' : 'password'}
                  label="Confirm New Password"
                  placeholder="Repeat new password"
                  leftIcon={<Lock className="w-4 h-4" />}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="w-full justify-center"
                  isLoading={isSubmitting}
                >
                  Change Password & Invalidate Sessions
                </Button>
              </div>
            </form>
          </Card>
        </main>
      </div>

      <Footer />
    </div>
  );
}
