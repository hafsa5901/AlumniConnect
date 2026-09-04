import React, { useState, useEffect, useCallback } from 'react';
import { adminService, AdminUserItem } from '../../services/admin.service';
import { Navbar, Footer, PageHeader } from '../../components/layout';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState } from '../../components/feedback/EmptyState';
import { CardSkeleton } from '../../components/feedback/Skeleton';
import { UserManagementModal } from './UserManagementModal';
import {
  Users,
  Search,
  Filter,
  UserCog,
  ShieldCheck,
  Building2,
  Mail,
  GraduationCap,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedUser, setSelectedUser] = useState<AdminUserItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminService.getUsers({
        search: searchTerm || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        verificationStatus: verificationFilter || undefined,
        page,
        limit: 15,
      });

      setUsers(res.data.data.items || []);
      setTotalUsers(res.data.data.total);
      setTotalPages(res.data.data.totalPages);
    } catch (err) {
      console.error('Failed to load users:', err);
      toast.error('Failed to load user directory.');
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, roleFilter, statusFilter, verificationFilter, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setRoleFilter('');
    setStatusFilter('');
    setVerificationFilter('');
    setPage(1);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge variant="navy">Admin</Badge>;
      case 'alumni':
        return <Badge variant="blue">Alumni</Badge>;
      case 'student':
        return <Badge variant="gray">Student</Badge>;
      default:
        return <Badge variant="gray">{role}</Badge>;
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
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <Navbar />

      <PageHeader
        title="User Governance & Directory"
        subtitle="Search, govern, suspend/reactivate, and modify roles for all registered accounts across the platform."
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Search & Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input
              placeholder="Search name, email, company, batch..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />

            <Select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { label: 'All Roles', value: '' },
                { label: 'Student', value: 'student' },
                { label: 'Alumni', value: 'alumni' },
                { label: 'Administrator', value: 'admin' },
              ]}
            />

            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { label: 'All Account Statuses', value: '' },
                { label: 'Active', value: 'active' },
                { label: 'Suspended', value: 'suspended' },
                { label: 'Deactivated', value: 'deactivated' },
              ]}
            />

            <Select
              value={verificationFilter}
              onChange={(e) => {
                setVerificationFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { label: 'All Verification Statuses', value: '' },
                { label: 'Admin Approved', value: 'admin_approved' },
                { label: 'Email Verified', value: 'email_verified' },
                { label: 'Pending Review', value: 'pending' },
                { label: 'Rejected', value: 'rejected' },
              ]}
            />
          </div>

          {(searchTerm || roleFilter || statusFilter || verificationFilter) && (
            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
              <span>Showing filtered results ({totalUsers} accounts found)</span>
              <button
                onClick={handleResetFilters}
                className="font-medium text-navy-800 hover:text-navy-950 underline"
              >
                Reset All Filters
              </button>
            </div>
          )}
        </div>

        {/* Users Table */}
        {isLoading ? (
          <div className="space-y-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm">
            <EmptyState
              icon={Users}
              title="No Users Found"
              description="There are no user accounts matching your selected search or filter criteria."
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
                    <th className="px-6 py-3.5">User Identity</th>
                    <th className="px-6 py-3.5">Role</th>
                    <th className="px-6 py-3.5">Account Status</th>
                    <th className="px-6 py-3.5">Verification</th>
                    <th className="px-6 py-3.5">Department / Batch</th>
                    <th className="px-6 py-3.5 text-right">Governance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id || u._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar src={u.profilePhotoUrl} name={u.name} size="sm" />
                          <div>
                            <div className="font-bold text-slate-900 text-sm">{u.name}</div>
                            <div className="text-slate-500">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">{getRoleBadge(u.role)}</td>
                      <td className="px-6 py-4">{getAccountStatusBadge(u.accountStatus)}</td>
                      <td className="px-6 py-4">{getVerificationBadge(u.verificationStatus)}</td>
                      <td className="px-6 py-4 text-slate-600">
                        <div>{u.department || '—'}</div>
                        <div className="text-slate-400">{u.batch ? `Batch ${u.batch}` : ''}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(u);
                            setIsModalOpen(true);
                          }}
                        >
                          <UserCog className="w-3.5 h-3.5 mr-1" />
                          Manage
                        </Button>
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
                  Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalUsers} total users)
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

      {/* User Governance Modal */}
      <UserManagementModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchUsers}
        targetUser={selectedUser}
      />

      <Footer />
    </div>
  );
}
