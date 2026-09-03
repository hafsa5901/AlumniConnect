import React, { useState } from 'react';
import { useVerificationQueue } from '../../hooks/useVerificationQueue';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { Modal } from '../ui/Modal';
import { Textarea } from '../ui/Textarea';
import { EmptyState } from '../feedback/EmptyState';
import { TableRowSkeleton } from '../feedback/Skeleton';
import { ShieldCheck, Check, X, Clock, AlertTriangle, FileText } from 'lucide-react';
import { User } from '../../types';

export const VerificationQueueView: React.FC = () => {
  const {
    users,
    isLoading,
    selectedRole,
    setSelectedRole,
    page,
    setPage,
    totalPages,
    total,
    approveUser,
    rejectUser,
  } = useVerificationQueue();

  const [rejectingUser, setRejectingUser] = useState<User | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRejectSubmit = async () => {
    if (!rejectingUser || !rejectReason.trim()) return;
    const userId = rejectingUser._id || rejectingUser.id;
    if (!userId) return;
    setIsProcessing(true);
    await rejectUser(userId, rejectReason.trim());
    setIsProcessing(false);
    setRejectingUser(null);
    setRejectReason('');
  };

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {['all', 'alumni', 'student'].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setSelectedRole(r);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-btn text-xs font-semibold capitalize transition-colors ${
                selectedRole === r
                  ? 'bg-navy-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              {r === 'all' ? 'All Applicants' : `${r}s`}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-500 font-medium">
          <strong className="text-navy-900">{total}</strong> pending review
        </div>
      </div>

      {/* Main Content Card */}
      <Card className="border-slate-200 overflow-hidden shadow-card">
        {isLoading ? (
          <div className="p-6">
            <table className="w-full">
              <tbody>
                <TableRowSkeleton columns={5} rows={4} />
              </tbody>
            </table>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12">
            <EmptyState
              type="generic"
              title="Verification Queue Clear"
              description="There are currently no applicant profiles awaiting administrative verification."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Applicant</th>
                  <th className="py-3.5 px-4">Role & Track</th>
                  <th className="py-3.5 px-4">Department / Batch</th>
                  <th className="py-3.5 px-4">Registered Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {users.map((u) => {
                  const uid = u._id || u.id || '';
                  return (
                    <tr key={uid} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} size="sm" />
                          <div>
                            <div className="font-bold text-navy-900">{u.name}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <Badge variant={u.role === 'alumni' ? 'blue' : 'green'} size="sm">
                            {u.role}
                          </Badge>
                          {u.verificationNote && (
                            <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-medium">
                              Non-Institutional Proof Attached
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-900">
                        <div>{u.department || '—'}</div>
                        <div className="text-[11px] text-slate-500">Class of {u.batch || '—'}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => approveUser(uid)}
                            leftIcon={<Check className="w-3.5 h-3.5" />}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:bg-red-50 hover:border-red-300"
                            onClick={() => setRejectingUser(u)}
                            leftIcon={<X className="w-3.5 h-3.5" />}
                          >
                            Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 text-xs">
            <span className="text-slate-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Reject Reason Modal */}
      <Modal
        isOpen={Boolean(rejectingUser)}
        onClose={() => {
          setRejectingUser(null);
          setRejectReason('');
        }}
        title={`Reject Verification: ${rejectingUser?.name}`}
        description="Provide a reason explaining why this application cannot be validated against university registrar records."
      >
        <div className="space-y-4">
          <Textarea
            id="rejectReason"
            label="Rejection Reason"
            placeholder="e.g. Graduation year and department do not match university registrar records..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
            required
          />

          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRejectingUser(null);
                setRejectReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={!rejectReason.trim()}
              isLoading={isProcessing}
              onClick={handleRejectSubmit}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
