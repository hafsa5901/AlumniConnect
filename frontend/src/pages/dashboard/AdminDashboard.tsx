import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { userService } from '../../services/userService';
import { Navbar, Footer, Sidebar, PageHeader } from '../../components/layout';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { CardSkeleton } from '../../components/feedback/Skeleton';
import {
  Users,
  ShieldCheck,
  GraduationCap,
  Clock,
  AlertOctagon,
  ArrowRight,
  ShieldAlert,
  FileText,
  Building2,
} from 'lucide-react';

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<any>(null);
  const [distributions, setDistributions] = useState<any>(null);
  const [recentAuditLogs, setRecentAuditLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    userService
      .getAdminDashboard()
      .then((res) => {
        setMetrics(res.data.data.metrics || {});
        setDistributions(res.data.data.distributions || {});
        setRecentAuditLogs(res.data.data.recentAuditLogs || []);
      })
      .catch((err) => {
        console.error('Failed to load admin dashboard:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <div className="flex-1 flex container-app px-4 sm:px-6 lg:px-8 py-8 gap-8">
        {/* Sidebar */}
        <Sidebar className="hidden md:flex rounded-card shadow-xs" />

        {/* Main Admin Content */}
        <main className="flex-1 space-y-8 min-w-0">
          <PageHeader
            title="Institutional Governance"
            subtitle="Campus platform metrics, verification queues, and administrative audit logging."
            actions={
              <Link to="/admin/verification">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<ShieldAlert className="w-4 h-4" />}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Review Verification Requests ({metrics?.pendingVerifications || 0})
                </Button>
              </Link>
            }
          />

          {/* Metric Cards Row */}
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <CardSkeleton count={5} />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* Card 1: Total Users */}
              <Card className="p-5 border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold">Total Accounts</span>
                  <Users className="w-4 h-4 text-navy-900" />
                </div>
                <div className="font-mono text-2xl font-extrabold text-navy-900">
                  {metrics?.totalUsers || 0}
                </div>
                <div className="text-[11px] text-slate-400">All registered users</div>
              </Card>

              {/* Card 2: Verified Alumni */}
              <Card className="p-5 border-green-200 bg-green-50/20 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-green-700">
                  <span className="text-xs font-semibold">Verified Alumni</span>
                  <ShieldCheck className="w-4 h-4 text-green-600" />
                </div>
                <div className="font-mono text-2xl font-extrabold text-green-700">
                  {metrics?.verifiedAlumni || 0}
                </div>
                <div className="text-[11px] text-green-600">Active & approved</div>
              </Card>

              {/* Card 3: Verified Students */}
              <Card className="p-5 border-blue-200 bg-blue-50/20 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-blue-700">
                  <span className="text-xs font-semibold">Verified Students</span>
                  <GraduationCap className="w-4 h-4 text-blue-600" />
                </div>
                <div className="font-mono text-2xl font-extrabold text-blue-700">
                  {metrics?.verifiedStudents || 0}
                </div>
                <div className="text-[11px] text-blue-600">Active students</div>
              </Card>

              {/* Card 4: Pending Verification */}
              <Card className="p-5 border-amber-200 bg-amber-50/30 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-amber-700">
                  <span className="text-xs font-semibold">Pending Queue</span>
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <div className="font-mono text-2xl font-extrabold text-amber-700">
                  {metrics?.pendingVerifications || 0}
                </div>
                <div className="text-[11px] text-amber-600">Awaiting admin review</div>
              </Card>

              {/* Card 5: Suspended Accounts */}
              <Card className="p-5 border-red-200 bg-red-50/20 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-red-700">
                  <span className="text-xs font-semibold">Suspended</span>
                  <AlertOctagon className="w-4 h-4 text-red-600" />
                </div>
                <div className="font-mono text-2xl font-extrabold text-red-700">
                  {metrics?.suspendedUsers || 0}
                </div>
                <div className="text-[11px] text-red-600">Access revoked</div>
              </Card>
            </div>
          )}

          {/* Department Breakdown & Audit Logs */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Department Distribution */}
            <Card className="p-6 border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-navy-900">Department Distribution</h3>
              </div>

              <div className="space-y-3">
                {distributions?.byDepartment?.length === 0 ? (
                  <p className="text-xs text-slate-500">No departmental records yet.</p>
                ) : (
                  distributions?.byDepartment?.map((dept: any) => (
                    <div key={dept.department} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium truncate max-w-[180px]">
                        {dept.department}
                      </span>
                      <Badge variant="blue" size="sm">
                        {dept.count} members
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Audit Log Feed */}
            <Card className="lg:col-span-2 p-6 border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-navy-900" />
                  <h3 className="text-sm font-bold text-navy-900">Recent Administrative Audit Logs</h3>
                </div>
                <span className="text-[11px] text-slate-400">Last 10 actions</span>
              </div>

              {recentAuditLogs.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  No administrative actions recorded in audit log yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                        <th className="py-2">Admin</th>
                        <th className="py-2">Action</th>
                        <th className="py-2">Target</th>
                        <th className="py-2 text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentAuditLogs.map((log) => (
                        <tr key={log._id || log.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 font-medium text-navy-900">
                            {log.admin?.name || log.admin?.email || 'System Admin'}
                          </td>
                          <td className="py-2.5">
                            <Badge
                              variant={
                                log.action.includes('approve')
                                  ? 'green'
                                  : log.action.includes('reject') || log.action.includes('suspend')
                                  ? 'red'
                                  : 'navy'
                              }
                              size="sm"
                            >
                              {log.action}
                            </Badge>
                          </td>
                          <td className="py-2.5 text-slate-500 capitalize">{log.targetType}</td>
                          <td className="py-2.5 text-right text-slate-400 font-mono text-[11px]">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
