import React, { useState, useEffect, useCallback } from 'react';
import { adminService, AuditLogItem } from '../../services/admin.service';
import { Navbar, Footer, PageHeader } from '../../components/layout';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState } from '../../components/feedback/EmptyState';
import { CardSkeleton } from '../../components/feedback/Skeleton';
import {
  FileText,
  Search,
  Filter,
  ShieldCheck,
  Calendar,
  Clock,
  UserCheck,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [actionFilter, setActionFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminService.getAuditLogs({
        action: actionFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        limit: 20,
      });

      setLogs(res.data.data.items || []);
      setTotalLogs(res.data.data.total);
      setTotalPages(res.data.data.totalPages);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      toast.error('Failed to load audit logs.');
    } finally {
      setIsLoading(false);
    }
  }, [actionFilter, startDate, endDate, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleResetFilters = () => {
    setActionFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const formatActionBadge = (action: string) => {
    switch (action) {
      case 'user.approve':
        return <Badge variant="green">User Approved</Badge>;
      case 'user.reject':
        return <Badge variant="red">User Rejected</Badge>;
      case 'user.suspend':
        return <Badge variant="red">User Suspended</Badge>;
      case 'user.reactivate':
        return <Badge variant="blue">User Reactivated</Badge>;
      case 'user.role_change':
        return <Badge variant="yellow">Role Changed</Badge>;
      case 'event.approve':
        return <Badge variant="green">Event Approved</Badge>;
      case 'event.reject':
        return <Badge variant="red">Event Rejected</Badge>;
      default:
        return <Badge variant="gray">{action}</Badge>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <Navbar />

      <PageHeader
        title="Administrative Audit Logs"
        subtitle="Immutable chronological history of all administrative moderation actions, approvals, role modifications, and account security changes."
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Filters Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Action Type"
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { label: 'All Administrative Actions', value: '' },
                { label: 'User Approved (user.approve)', value: 'user.approve' },
                { label: 'User Rejected (user.reject)', value: 'user.reject' },
                { label: 'User Suspended (user.suspend)', value: 'user.suspend' },
                { label: 'User Reactivated (user.reactivate)', value: 'user.reactivate' },
                { label: 'Role Changed (user.role_change)', value: 'user.role_change' },
                { label: 'Event Approved (event.approve)', value: 'event.approve' },
                { label: 'Event Rejected (event.reject)', value: 'event.reject' },
              ]}
            />

            <Input
              label="From Date"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
            />

            <Input
              label="To Date"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {(actionFilter || startDate || endDate) && (
            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
              <span>Showing filtered logs ({totalLogs} recorded events)</span>
              <button
                onClick={handleResetFilters}
                className="font-medium text-navy-800 hover:text-navy-950 underline"
              >
                Reset All Filters
              </button>
            </div>
          )}
        </div>

        {/* Audit Logs Table */}
        {isLoading ? (
          <div className="space-y-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm">
            <EmptyState
              icon={FileText}
              title="No Audit Logs Found"
              description="There are no administrative audit logs recorded matching your filter parameters."
              actionLabel="Clear Filters"
              onAction={handleResetFilters}
            />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Timestamp</th>
                    <th className="px-6 py-3.5">Admin Actor</th>
                    <th className="px-6 py-3.5">Action</th>
                    <th className="px-6 py-3.5">Target</th>
                    <th className="px-6 py-3.5">Details & Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">
                          {new Date(log.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(log.createdAt).toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            src={log.admin?.profilePhotoUrl}
                            name={log.admin?.name || 'Admin'}
                            size="sm"
                          />
                          <div>
                            <div className="font-bold text-slate-900">
                              {log.admin?.name || 'System Admin'}
                            </div>
                            <div className="text-[11px] text-slate-400">{log.admin?.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {formatActionBadge(log.action)}
                      </td>

                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                        <span className="font-semibold uppercase text-[10px] text-slate-400 block">
                          {log.targetType}
                        </span>
                        <span className="font-mono text-[11px] text-slate-700">
                          {log.targetId}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-slate-700">
                        {log.metadata && Object.keys(log.metadata).length > 0 ? (
                          <div className="space-y-1">
                            {log.metadata.reason && (
                              <div>
                                <span className="font-semibold text-slate-900">Reason:</span>{' '}
                                {String(log.metadata.reason)}
                              </div>
                            )}
                            {log.metadata.newRole && (
                              <div className="text-[11px] text-slate-600">
                                Changed role from <strong>{String(log.metadata.previousRole)}</strong> to{' '}
                                <strong>{String(log.metadata.newRole)}</strong>
                              </div>
                            )}
                            {log.metadata.newVerificationStatus && (
                              <div className="text-[11px] text-slate-500">
                                Verification status: <em>{String(log.metadata.newVerificationStatus)}</em>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-slate-100">
                <div className="text-xs text-slate-500">
                  Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalLogs} total logs)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
