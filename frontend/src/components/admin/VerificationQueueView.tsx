import React, { useState } from 'react';
import { useVerificationQueue } from '../../hooks/useVerificationQueue';
import { verificationService, VerificationRequestItem } from '../../services/verification.service';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { Modal } from '../ui/Modal';
import { Textarea } from '../ui/Textarea';
import { EmptyState } from '../feedback/EmptyState';
import { TableRowSkeleton } from '../feedback/Skeleton';
import { Check, X, Building2, ShieldCheck, Download, FileText, ExternalLink } from 'lucide-react';
import { User } from '../../types';
import api from '../../services/api';

export const VerificationQueueView: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    requests,
    users,
    isLoading,
    selectedRole,
    setSelectedRole,
    page,
    setPage,
    totalPages,
    total,
    approveRequest,
    rejectRequest,
    approveUser,
    rejectUser,
  } = useVerificationQueue();

  const [rejectingRequest, setRejectingRequest] = useState<VerificationRequestItem | null>(null);
  const [rejectingUser, setRejectingUser] = useState<User | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) return;
    setIsProcessing(true);

    if (rejectingRequest) {
      const reqId = rejectingRequest._id || rejectingRequest.id;
      await rejectRequest(reqId, rejectReason.trim());
      setRejectingRequest(null);
    } else if (rejectingUser) {
      const userId = rejectingUser._id || rejectingUser.id;
      if (userId) {
        await rejectUser(userId, rejectReason.trim());
      }
      setRejectingUser(null);
    }

    setIsProcessing(false);
    setRejectReason('');
  };

  const handleDownloadDoc = async (requestId: string, filename: string) => {
    try {
      const response = await api.get(`/verification-requests/${requestId}/document`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename || 'verification_document.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Unable to download verification document.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Source Tabs */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => {
              setActiveTab('requests');
              setPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'requests'
                ? 'bg-white text-navy-900 shadow-xs'
                : 'text-slate-600 hover:text-navy-900'
            }`}
          >
            Institutional Requests
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('users');
              setPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'users'
                ? 'bg-white text-navy-900 shadow-xs'
                : 'text-slate-600 hover:text-navy-900'
            }`}
          >
            Direct Pending Users
          </button>
        </div>

        {/* Role Filters & Total */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {['all', 'alumni', 'student'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setSelectedRole(r);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-btn text-xs font-semibold capitalize transition-colors ${
                  selectedRole === r
                    ? 'bg-navy-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {r === 'all' ? 'All' : `${r}s`}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-500 font-medium">
            <strong className="text-navy-900">{total}</strong> pending
          </div>
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
        ) : activeTab === 'requests' ? (
          /* Institutional Requests Table */
          requests.length === 0 ? (
            <div className="p-12">
              <EmptyState
                type="generic"
                title="Institutional Queue Clear"
                description="There are currently no institutional verification requests awaiting administrative review."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4">Applicant</th>
                    <th className="py-3.5 px-4">College & Domain Match</th>
                    <th className="py-3.5 px-4">Role / Department</th>
                    <th className="py-3.5 px-4">Proof Document</th>
                    <th className="py-3.5 px-4">Submitted</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {requests.map((r) => {
                    const reqId = r._id || r.id;
                    return (
                      <tr key={reqId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={r.user?.name || 'Applicant'} size="sm" />
                            <div>
                              <div className="font-bold text-navy-900">{r.user?.name}</div>
                              <div className="text-[11px] text-slate-500 font-mono">{r.user?.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div>
                            <div className="font-semibold text-navy-900 flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-navy-700" />
                              {r.college?.name} ({r.college?.code})
                            </div>
                            <div className="mt-1">
                              {r.collegeDomainVerified ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  <ShieldCheck className="w-3 h-3" />
                                  Domain Matched
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                  Non-Domain / Manual Review
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-0.5">
                            <Badge variant={r.role === 'alumni' ? 'blue' : 'green'} size="sm">
                              {r.role}
                            </Badge>
                            <span className="text-[11px] text-slate-500">
                              {r.user?.department || '—'} {r.user?.batch ? `('${r.user.batch})` : ''}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {r.document ? (
                            <button
                              type="button"
                              onClick={() => handleDownloadDoc(reqId, r.document!.originalName)}
                              className="inline-flex items-center gap-1.5 text-xs text-navy-900 font-semibold hover:underline bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg border border-slate-200"
                            >
                              <FileText className="w-3.5 h-3.5 text-navy-700" />
                              {r.document.originalName.length > 18
                                ? `${r.document.originalName.slice(0, 15)}...`
                                : r.document.originalName}
                              <Download className="w-3 h-3 text-slate-500 ml-0.5" />
                            </button>
                          ) : (
                            <span className="text-slate-400 italic">No document</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => approveRequest(reqId)}
                              leftIcon={<Check className="w-3.5 h-3.5" />}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:bg-red-50 hover:border-red-300"
                              onClick={() => setRejectingRequest(r)}
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
          )
        ) : (
          /* Direct Pending Users Table */
          users.length === 0 ? (
            <div className="p-12">
              <EmptyState
                type="generic"
                title="Direct Queue Clear"
                description="There are currently no direct applicant profiles awaiting administrative verification."
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
                                Legacy Proof Attached
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
          )
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
        isOpen={Boolean(rejectingRequest || rejectingUser)}
        onClose={() => {
          setRejectingRequest(null);
          setRejectingUser(null);
          setRejectReason('');
        }}
        title={`Reject Verification: ${rejectingRequest?.user?.name || rejectingUser?.name || 'Applicant'}`}
        description="Provide a reason explaining why this application cannot be validated against university registrar records."
      >
        <div className="space-y-4">
          <Textarea
            id="rejectReason"
            label="Rejection Reason"
            placeholder="e.g. Graduation year, department, or proof document does not match registrar records..."
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
                setRejectingRequest(null);
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
