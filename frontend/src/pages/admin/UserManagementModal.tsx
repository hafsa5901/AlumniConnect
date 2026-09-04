import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { adminService, AdminUserItem } from '../../services/admin.service';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldAlert,
  UserCheck,
  UserCog,
  AlertTriangle,
  Mail,
  Building2,
  GraduationCap,
  Calendar,
  Clock,
  ExternalLink,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  targetUser: AdminUserItem | null;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  targetUser,
}) => {
  const { user: currentAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'details' | 'suspend' | 'role'>('details');

  // Suspend form state
  const [suspendReason, setSuspendReason] = useState('');
  const [isSuspending, setIsSuspending] = useState(false);

  // Role form state
  const [newRole, setNewRole] = useState<'student' | 'alumni' | 'admin'>('student');
  const [roleReason, setRoleReason] = useState('');
  const [isChangingRole, setIsChangingRole] = useState(false);

  // Reactivate state
  const [isReactivating, setIsReactivating] = useState(false);

  useEffect(() => {
    if (targetUser) {
      setNewRole(targetUser.role);
      setSuspendReason('');
      setRoleReason('');
      setActiveTab('details');
    }
  }, [targetUser, isOpen]);

  if (!targetUser) return null;

  const isSelf = currentAdmin?._id?.toString() === (targetUser.id || targetUser._id)?.toString();

  const handleSuspend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suspendReason.trim()) {
      toast.error('Please provide a reason for suspending this account.');
      return;
    }

    setIsSuspending(true);
    try {
      await adminService.suspendUser(targetUser.id || targetUser._id, suspendReason.trim());
      toast.success(`Account for ${targetUser.name} has been suspended.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      const code = err.response?.data?.error?.code;
      let msg = err.response?.data?.error?.message || 'Failed to suspend user.';
      if (code === 'LAST_ADMIN_PROTECTED') {
        msg = 'Cannot suspend the last active administrator account.';
      } else if (code === 'SELF_ACTION_FORBIDDEN') {
        msg = 'You cannot suspend your own account.';
      }
      toast.error(msg);
    } finally {
      setIsSuspending(false);
    }
  };

  const handleReactivate = async () => {
    setIsReactivating(true);
    try {
      await adminService.reactivateUser(targetUser.id || targetUser._id);
      toast.success(`Account for ${targetUser.name} has been reactivated.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to reactivate user.');
    } finally {
      setIsReactivating(false);
    }
  };

  const handleChangeRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleReason.trim()) {
      toast.error('Please specify a reason for changing this user role.');
      return;
    }

    setIsChangingRole(true);
    try {
      await adminService.changeUserRole(
        targetUser.id || targetUser._id,
        newRole,
        roleReason.trim()
      );
      toast.success(`Role for ${targetUser.name} changed to ${newRole}.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      const code = err.response?.data?.error?.code;
      let msg = err.response?.data?.error?.message || 'Failed to change user role.';
      if (code === 'LAST_ADMIN_PROTECTED') {
        msg = 'Cannot demote the last active administrator account.';
      } else if (code === 'SELF_ACTION_FORBIDDEN') {
        msg = 'You cannot change your own role.';
      }
      toast.error(msg);
    } finally {
      setIsChangingRole(false);
    }
  };

  const getVerificationBadge = (vStatus: string) => {
    switch (vStatus) {
      case 'admin_approved':
        return <Badge variant="green">Approved</Badge>;
      case 'email_verified':
        return <Badge variant="blue">Email Verified</Badge>;
      case 'pending':
        return <Badge variant="yellow">Pending</Badge>;
      case 'rejected':
        return <Badge variant="red">Rejected</Badge>;
      default:
        return <Badge variant="gray">{vStatus}</Badge>;
    }
  };

  const getAccountStatusBadge = (accStatus: string) => {
    switch (accStatus) {
      case 'active':
        return <Badge variant="green">Active</Badge>;
      case 'suspended':
        return <Badge variant="red">Suspended</Badge>;
      case 'deactivated':
        return <Badge variant="gray">Deactivated</Badge>;
      default:
        return <Badge variant="gray">{accStatus}</Badge>;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="User Governance & Account Moderation"
      size="lg"
    >
      <div className="space-y-6">
        {/* User Quick Header */}
        <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
          <Avatar src={targetUser.profilePhotoUrl} name={targetUser.name} size="lg" />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-slate-900 text-lg">{targetUser.name}</h3>
              {isSelf && (
                <span className="text-[11px] font-bold bg-navy-100 text-navy-800 px-2 py-0.5 rounded-full">
                  You (Current Admin)
                </span>
              )}
            </div>
            <div className="text-xs text-slate-600 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              {targetUser.email}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant="navy">
                <span className="capitalize">{targetUser.role}</span>
              </Badge>
              {getAccountStatusBadge(targetUser.accountStatus)}
              {getVerificationBadge(targetUser.verificationStatus)}
            </div>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'details'
                ? 'bg-navy-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            User Details
          </button>
          {!isSelf && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('role')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'role'
                    ? 'bg-navy-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Change Role
              </button>
              {targetUser.accountStatus === 'active' ? (
                <button
                  type="button"
                  onClick={() => setActiveTab('suspend')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'suspend'
                      ? 'bg-red-600 text-white'
                      : 'text-red-600 hover:bg-red-50'
                  }`}
                >
                  Suspend Account
                </button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReactivate}
                  isLoading={isReactivating}
                >
                  <UserCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  Reactivate Account
                </Button>
              )}
            </>
          )}
        </div>

        {/* TAB 1: USER DETAILS */}
        {activeTab === 'details' && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
              <div>
                <span className="text-slate-400 block mb-0.5">Department</span>
                <span className="font-semibold text-slate-800">
                  {targetUser.department || 'Not Specified'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Graduation / Batch</span>
                <span className="font-semibold text-slate-800">
                  {targetUser.batch || 'Not Specified'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Institution</span>
                <span className="font-semibold text-slate-800">
                  {targetUser.institution || 'Not Specified'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Company & Designation</span>
                <span className="font-semibold text-slate-800">
                  {targetUser.company
                    ? `${targetUser.designation || 'Staff'} at ${targetUser.company}`
                    : 'Not Specified'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Account Created</span>
                <span className="font-semibold text-slate-800">
                  {new Date(targetUser.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Last Login</span>
                <span className="font-semibold text-slate-800">
                  {targetUser.lastLogin
                    ? new Date(targetUser.lastLogin).toLocaleDateString()
                    : 'Never'}
                </span>
              </div>
            </div>

            {targetUser.bio && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-400 block mb-1 font-medium">Bio</span>
                <p className="text-slate-700 leading-relaxed">{targetUser.bio}</p>
              </div>
            )}

            {targetUser.verificationNote && (
              <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/60 text-amber-900">
                <span className="block font-bold mb-1 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-amber-700" />
                  Alumni Verification Note
                </span>
                <p className="leading-relaxed">{targetUser.verificationNote}</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SUSPEND ACCOUNT */}
        {activeTab === 'suspend' && !isSelf && (
          <form onSubmit={handleSuspend} className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-red-900">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                Warning: Immediate Session Invalidation
              </div>
              <p className="leading-relaxed">
                Suspending this user will immediately revoke their refresh token, block future logins, and reject active token requests across all platform features.
              </p>
            </div>

            <Textarea
              label="Reason for Suspension *"
              placeholder="Provide a detailed administrative reason (required for audit logging)..."
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              rows={3}
              required
            />

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveTab('details')}
                disabled={isSuspending}
              >
                Cancel
              </Button>
              <Button type="submit" variant="danger" isLoading={isSuspending}>
                Confirm Suspension
              </Button>
            </div>
          </form>
        )}

        {/* TAB 3: CHANGE ROLE */}
        {activeTab === 'role' && !isSelf && (
          <form onSubmit={handleChangeRole} className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-navy-900">
                <ShieldAlert className="w-4 h-4 text-blue-600" />
                Verification Status Reset Rule
              </div>
              <p className="leading-relaxed">
                • Changing role to <strong>Student</strong> or <strong>Alumni</strong> will reset their verification status to <strong>Pending</strong> so they go through standard verification.<br />
                • Changing role to <strong>Admin</strong> will set their verification status to <strong>Approved</strong> immediately.
              </p>
            </div>

            <Select
              label="New Platform Role *"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as any)}
              options={[
                { label: 'Student', value: 'student' },
                { label: 'Alumni', value: 'alumni' },
                { label: 'Administrator', value: 'admin' },
              ]}
            />

            <Textarea
              label="Administrative Reason for Role Change *"
              placeholder="Explain why this account role is being modified..."
              value={roleReason}
              onChange={(e) => setRoleReason(e.target.value)}
              rows={3}
              required
            />

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveTab('details')}
                disabled={isChangingRole}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={isChangingRole}>
                Apply Role Change
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
