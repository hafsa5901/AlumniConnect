import React, { useState, useEffect, useCallback } from 'react';
import { adminService, AdminUserFilters } from '../../services/admin.service';
import { CheckCircle, XCircle, ShieldAlert, Clock, RefreshCw, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminVerificationPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AdminUserFilters>({ status: 'pending', role: '' });
  const [isLoading, setIsLoading] = useState(true);

  // Rejection modal state
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminService.getUsers({ ...filters, page, limit: 10 });
      setUsers(res.data.data.items);
      setTotal(res.data.data.total);
    } catch (err: any) {
      toast.error('Failed to load user queue.');
    } finally {
      setIsLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleApprove = async (user: any) => {
    setIsActionLoading(user.id);
    try {
      await adminService.approveUser(user.id);
      toast.success(`${user.name} approved successfully!`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Approval failed.');
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !rejectReason.trim()) return;

    setIsRejecting(true);
    try {
      await adminService.rejectUser(selectedUser.id, rejectReason.trim());
      toast.success(`${selectedUser.name} rejected.`);
      setSelectedUser(null);
      setRejectReason('');
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Rejection failed.');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleSuspend = async (user: any) => {
    if (!window.confirm(`Are you sure you want to suspend ${user.name}? All active sessions will be revoked.`)) return;
    setIsActionLoading(user.id);
    try {
      await adminService.suspendUser(user.id);
      toast.success(`${user.name} has been suspended.`);
      fetchUsers();
    } catch (err: any) {
      toast.error('Suspension failed.');
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleReactivate = async (user: any) => {
    setIsActionLoading(user.id);
    try {
      await adminService.reactivateUser(user.id);
      toast.success(`${user.name} reactivated.`);
      fetchUsers();
    } catch (err: any) {
      toast.error('Reactivation failed.');
    } finally {
      setIsActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-navy-900 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-accent-600" />
            Verification & Moderation Queue
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Review and authenticate student & alumni applications with institutional audit logging.
          </p>
        </div>

        <button
          onClick={fetchUsers}
          className="btn btn-outline btn-sm flex items-center gap-2"
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Queue
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        {[
          { label: 'Pending Verification', val: 'pending', badge: 'badge-yellow' },
          { label: 'Email Verified', val: 'email_verified', badge: 'badge-blue' },
          { label: 'Approved Alumni & Students', val: 'admin_approved', badge: 'badge-green' },
          { label: 'Rejected', val: 'rejected', badge: 'badge-red' },
          { label: 'All Users', val: '', badge: 'badge-gray' },
        ].map((tab) => (
          <button
            key={tab.val}
            onClick={() => {
              setFilters((prev) => ({ ...prev, status: tab.val }));
              setPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              filters.status === tab.val
                ? 'bg-navy-900 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* User Table */}
      <div className="card overflow-hidden border border-gray-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">User Details</th>
                <th className="px-6 py-4">Role & Dept</th>
                <th className="px-6 py-4">Verification Info / Proof</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-navy-900 mb-2" />
                    Loading user verification queue...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <Clock className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                    No users found matching current filter criteria.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-navy-900">{u.name}</div>
                      <div className="font-mono text-xs text-gray-500">{u.email}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        Registered: {new Date(u.createdAt).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="capitalize font-semibold text-navy-900 flex items-center gap-1.5">
                        <span className={u.role === 'alumni' ? 'badge-purple' : u.role === 'admin' ? 'badge-red' : 'badge-blue'}>
                          {u.role}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 mt-1 font-medium">{u.department || 'General'}</div>
                      <div className="text-xs text-gray-400">Batch: {u.batch || 'N/A'} {u.studentId ? `• ID: ${u.studentId}` : u.alumniId ? `• ID: ${u.alumniId}` : ''}</div>
                    </td>

                    <td className="px-6 py-4 max-w-xs">
                      {u.verificationNote ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-900 space-y-1">
                          <span className="font-bold block text-[11px] uppercase tracking-wider text-amber-800">Alumni Proof Note</span>
                          <p className="whitespace-pre-wrap line-clamp-3 text-xs">{u.verificationNote}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Standard institutional registration</span>
                      )}
                      {u.rejectionReason && (
                        <div className="mt-1 bg-red-50 border border-red-200 rounded p-1.5 text-xs text-red-700">
                          <strong>Rejection reason:</strong> {u.rejectionReason}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div>
                          {u.verificationStatus === 'admin_approved' && <span className="badge-green">Approved</span>}
                          {u.verificationStatus === 'email_verified' && <span className="badge-blue">Email Verified</span>}
                          {u.verificationStatus === 'pending' && <span className="badge-yellow">Pending Review</span>}
                          {u.verificationStatus === 'rejected' && <span className="badge-red">Rejected</span>}
                        </div>
                        <div>
                          {u.accountStatus === 'suspended' ? (
                            <span className="badge-red text-[10px]">Suspended</span>
                          ) : (
                            <span className="badge-gray text-[10px]">Active Account</span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {u.verificationStatus !== 'admin_approved' && (
                          <button
                            onClick={() => handleApprove(u)}
                            disabled={isActionLoading === u.id}
                            className="btn btn-sm btn-primary bg-emerald-700 hover:bg-emerald-800 border-none text-white text-xs px-2.5 py-1"
                            title="Approve User"
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />
                            Approve
                          </button>
                        )}

                        {u.verificationStatus !== 'rejected' && (
                          <button
                            onClick={() => setSelectedUser(u)}
                            disabled={isActionLoading === u.id}
                            className="btn btn-sm btn-outline border-rose-300 text-rose-700 hover:bg-rose-50 text-xs px-2.5 py-1"
                            title="Reject User"
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            Reject
                          </button>
                        )}

                        {u.accountStatus === 'active' ? (
                          <button
                            onClick={() => handleSuspend(u)}
                            disabled={isActionLoading === u.id}
                            className="btn btn-ghost text-red-600 hover:bg-red-50 text-xs px-2 py-1"
                            title="Suspend Account"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(u)}
                            disabled={isActionLoading === u.id}
                            className="btn btn-ghost text-emerald-600 hover:bg-emerald-50 text-xs px-2 py-1"
                            title="Reactivate Account"
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 10 && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center bg-slate-50 text-xs text-gray-500">
            <span>Showing {users.length} of {total} registered users</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-outline btn-sm"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * 10 >= total}
                className="btn btn-outline btn-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 shadow-2xl animate-fade-in">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h2 className="text-lg font-bold text-navy-900">Reject Profile Application</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Please specify the reason for rejecting <strong className="text-navy-900">{selectedUser.name}</strong> ({selectedUser.email}).
              This explanation will be logged and emailed to the applicant.
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="label" htmlFor="rejectReason">Rejection Reason</label>
                <textarea
                  id="rejectReason"
                  rows={3}
                  className="input"
                  placeholder="e.g. Graduation year could not be verified in registrar records..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setSelectedUser(null); setRejectReason(''); }}
                  className="btn btn-outline"
                  disabled={isRejecting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={isRejecting || !rejectReason.trim()}
                >
                  {isRejecting ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
