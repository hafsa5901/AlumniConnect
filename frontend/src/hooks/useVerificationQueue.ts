import { useState, useEffect, useCallback } from 'react';
import { adminService } from '../services/admin.service';
import { User } from '../types';
import toast from 'react-hot-toast';

export function useVerificationQueue() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminService.getUsers({
        status: 'pending',
        role: selectedRole === 'all' ? undefined : selectedRole,
        page,
        limit: 10,
      });
      const data = res.data.data;
      setUsers(data.users || []);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.pages || 1);
    } catch (err: any) {
      toast.error('Failed to load verification queue.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedRole, page]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const approveUser = async (userId: string) => {
    try {
      await adminService.approveUser(userId);
      toast.success('User verified and approved successfully.');
      setUsers((prev) => prev.filter((u) => (u._id || u.id) !== userId));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to approve user.');
    }
  };

  const rejectUser = async (userId: string, reason: string) => {
    try {
      await adminService.rejectUser(userId, reason);
      toast.success('Application rejected.');
      setUsers((prev) => prev.filter((u) => (u._id || u.id) !== userId));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to reject user.');
    }
  };

  return {
    users,
    isLoading,
    selectedRole,
    setSelectedRole,
    page,
    setPage,
    totalPages,
    total,
    refresh: fetchQueue,
    approveUser,
    rejectUser,
  };
}
