import React, { useState, useEffect, useCallback } from 'react';
import { Navbar, Footer, PageHeader } from '../../components/layout';
import { adminAnalyticsService } from '../../services/adminAnalyticsService';
import { adminService, AdminUserItem } from '../../services/admin.service';
import { AnalyticsOverviewData, DailyActivityItem } from '../../types/adminAnalytics';
import { AnalyticsOverviewCards } from '../../components/admin/AnalyticsOverviewCards';
import { ActivityTrendChart } from '../../components/admin/ActivityTrendChart';
import { DepartmentDistributionList } from '../../components/admin/DepartmentDistributionList';
import { BulkUserActionModal } from '../../components/admin/BulkUserActionModal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { EmptyState } from '../../components/feedback/EmptyState';
import { CardSkeleton } from '../../components/feedback/Skeleton';
import {
  BarChart3,
  RefreshCw,
  Search,
  Filter,
  CheckSquare,
  Square,
  ShieldCheck,
  Users,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const AdminAnalyticsPage: React.FC = () => {
  // Analytics state
  const [overview, setOverview] = useState<AnalyticsOverviewData | null>(null);
  const [isOverviewLoading, setIsOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [days, setDays] = useState<number>(30);
  const [timeline, setTimeline] = useState<DailyActivityItem[]>([]);
  const [isActivityLoading, setIsActivityLoading] = useState(true);

  // Bulk governance user selection state
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Fetch overview data
  const fetchOverview = useCallback(async () => {
    setIsOverviewLoading(true);
    setOverviewError(null);
    try {
      const data = await adminAnalyticsService.getOverview();
      setOverview(data);
    } catch (err: any) {
      console.error('Failed to fetch analytics overview:', err);
      setOverviewError(err.response?.data?.message || 'Failed to load analytics overview.');
    } finally {
      setIsOverviewLoading(false);
    }
  }, []);

  // Fetch activity timeline
  const fetchActivity = useCallback(async (selectedDays: number) => {
    setIsActivityLoading(true);
    try {
      const data = await adminAnalyticsService.getActivity(selectedDays);
      setTimeline(data.timeline || []);
    } catch (err: any) {
      console.error('Failed to fetch activity trends:', err);
      toast.error('Failed to load activity trends.');
    } finally {
      setIsActivityLoading(false);
    }
  }, []);

  // Fetch users for governance
  const fetchUsers = useCallback(async () => {
    setIsUsersLoading(true);
    try {
      const res = await adminService.getUsers({
        search: searchTerm || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        verificationStatus: verificationFilter || undefined,
        page,
        limit: 10,
      });

      setUsers(res.data.data.items || []);
      setTotalUsers(res.data.data.total);
      setTotalPages(res.data.data.totalPages);
    } catch (err: any) {
      console.error('Failed to fetch users:', err);
      toast.error('Failed to load users for governance.');
    } finally {
      setIsUsersLoading(false);
    }
  }, [searchTerm, roleFilter, statusFilter, verificationFilter, page]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    fetchActivity(days);
  }, [days, fetchActivity]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRefreshAll = () => {
    fetchOverview();
    fetchActivity(days);
    fetchUsers();
    toast.success('Analytics refreshed.');
  };

  const handleDaysChange = (newDays: number) => {
    setDays(newDays);
  };

  // Checkbox selection helpers
  const handleToggleSelectUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllOnPage = () => {
    const pageUserIds = users.map((u) => u._id || u.id);
    const allSelected = pageUserIds.every((id) => selectedUserIds.includes(id));

    if (allSelected) {
      setSelectedUserIds((prev) => prev.filter((id) => !pageUserIds.includes(id)));
    } else {
      const combined = Array.from(new Set([...selectedUserIds, ...pageUserIds]));
      setSelectedUserIds(combined.slice(0, 50));
      if (combined.length > 50) {
        toast.error('Maximum 50 users can be selected at once.');
      }
    }
  };

  const handleClearSelection = () => {
    setSelectedUserIds([]);
  };

  // Selected user objects for modal
  const selectedUserObjects = users
    .filter((u) => selectedUserIds.includes(u._id || u.id))
    .map((u) => ({
      id: u._id || u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      verificationStatus: u.verificationStatus,
      accountStatus: u.accountStatus,
    }));

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <PageHeader
          title="Operations & Analytics Center"
          subtitle="Real-time platform metrics, operational health, and bulk administrative governance."
          actions={
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className="w-4 h-4" />}
              onClick={handleRefreshAll}
              isLoading={isOverviewLoading || isActivityLoading}
            >
              Refresh Data
            </Button>
          }
        />

        {/* Overview Metric Cards */}
        {isOverviewLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : overviewError ? (
          <Card className="p-8 text-center border-rose-200 bg-rose-50/50">
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
            <p className="text-sm text-rose-700 font-semibold">{overviewError}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={fetchOverview}>
              Try Again
            </Button>
          </Card>
        ) : overview ? (
          <AnalyticsOverviewCards overview={overview} />
        ) : null}

        {/* Activity Trend Chart */}
        <ActivityTrendChart
          timeline={timeline}
          days={days}
          onDaysChange={handleDaysChange}
          isLoading={isActivityLoading}
        />

        {/* Distribution Lists */}
        {overview && (
          <DepartmentDistributionList
            departments={overview.distributions.departments}
            companies={overview.distributions.companies}
          />
        )}

        {/* Bulk User Governance Section */}
        <Card className="border border-slate-200/80 shadow-xs">
          <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-navy-900" />
              <div>
                <CardTitle className="text-base font-bold text-navy-900">
                  Bulk User Governance
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Select and execute batch moderation actions (approvals, rejections, suspensions)
                </p>
              </div>
            </div>

            {/* Selection actions bar */}
            {selectedUserIds.length > 0 && (
              <div className="flex items-center gap-2 bg-navy-50 border border-navy-200 p-1.5 rounded-lg">
                <span className="text-xs font-semibold text-navy-900 px-2">
                  {selectedUserIds.length} Selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={handleClearSelection}
                >
                  Clear
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setIsBulkModalOpen(true)}
                >
                  Apply Bulk Action
                </Button>
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <Input
                  placeholder="Search name, email..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              <Select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9 text-xs"
              >
                <option value="">All Roles</option>
                <option value="student">Students</option>
                <option value="alumni">Alumni</option>
                <option value="admin">Administrators</option>
              </Select>

              <Select
                value={verificationFilter}
                onChange={(e) => {
                  setVerificationFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9 text-xs"
              >
                <option value="">All Verifications</option>
                <option value="pending">Pending</option>
                <option value="admin_approved">Admin Approved</option>
                <option value="email_verified">Email Verified</option>
                <option value="rejected">Rejected</option>
              </Select>

              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9 text-xs"
              >
                <option value="">All Account Statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="deactivated">Deactivated</option>
              </Select>
            </div>

            {/* Users Table */}
            {isUsersLoading ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                Loading community members...
              </div>
            ) : users.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No users match the criteria"
                description="Try changing or clearing your search and filter parameters."
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                      <th className="p-3 w-10 text-center">
                        <button
                          type="button"
                          onClick={handleSelectAllOnPage}
                          className="text-slate-500 hover:text-navy-900"
                          title="Toggle all on this page"
                        >
                          {users.length > 0 &&
                          users.every((u) => selectedUserIds.includes(u._id || u.id)) ? (
                            <CheckSquare className="w-4 h-4 text-navy-900" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="p-3">User</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Verification</th>
                      <th className="p-3">Account Status</th>
                      <th className="p-3">Department</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => {
                      const uid = u._id || u.id;
                      const isSelected = selectedUserIds.includes(uid);
                      return (
                        <tr
                          key={uid}
                          onClick={() => handleToggleSelectUser(uid)}
                          className={`cursor-pointer hover:bg-slate-50/80 transition-colors ${
                            isSelected ? 'bg-blue-50/50' : ''
                          }`}
                        >
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleToggleSelectUser(uid)}
                              className="text-slate-400 hover:text-navy-900"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-blue-600" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                          <td className="p-3 font-semibold text-navy-900">
                            <div>{u.name}</div>
                            <div className="text-[11px] font-normal text-slate-500 font-mono">
                              {u.email}
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="capitalize font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              {u.role}
                            </span>
                          </td>
                          <td className="p-3">
                            <Badge
                              variant={
                                u.verificationStatus === 'admin_approved'
                                  ? 'green'
                                  : u.verificationStatus === 'pending'
                                  ? 'yellow'
                                  : u.verificationStatus === 'rejected'
                                  ? 'red'
                                  : 'gray'
                              }
                            >
                              {u.verificationStatus}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <Badge
                              variant={
                                u.accountStatus === 'active'
                                  ? 'green'
                                  : u.accountStatus === 'suspended'
                                  ? 'yellow'
                                  : 'red'
                              }
                            >
                              {u.accountStatus}
                            </Badge>
                          </td>
                          <td className="p-3 text-slate-600">
                            {u.department || '—'}
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
              <div className="flex items-center justify-between pt-3 text-xs text-slate-500">
                <div>
                  Showing {users.length} of {totalUsers} users
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="px-2">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Bulk Action Execution Modal */}
      <BulkUserActionModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        selectedUsers={selectedUserObjects}
        onSuccess={() => {
          fetchOverview();
          fetchUsers();
          setSelectedUserIds([]);
        }}
      />

      <Footer />
    </div>
  );
};

export default AdminAnalyticsPage;
