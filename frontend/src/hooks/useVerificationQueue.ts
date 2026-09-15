import { useState, useEffect, useCallback } from 'react';
import { adminService } from '../services/admin.service';
import { verificationService, VerificationRequestItem } from '../services/verification.service';
import { User } from '../types';
import toast from 'react-hot-toast';

export function useVerificationQueue() {
  const [activeTab, setActiveTab] = useState<'requests' | 'users'>('requests');
  const [requests, setRequests] = useState<VerificationRequestItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'requests') {
        const res = await verificationService.getAdminVerificationRequests({
          status: 'pending',
          role: selectedRole === 'all' ? undefined : selectedRole,
          page,
          limit: 10,
        });
        const data = res.data.data;
        setRequests(data.items || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } else {
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
      }
    } catch (err: any) {
      toast.error('Failed to load verification queue.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, selectedRole, page]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Request actions
  const approveRequest = async (requestId: string) => {
    try {
      await verificationService.approveRequest(requestId);
      toast.success('Institutional verification request approved.');
      setRequests((prev) => prev.filter((r) => (r._id || r.id) !== requestId));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to approve request.');
    }
  };

  const rejectRequest = async (requestId: string, reason: string) => {
    try {
      await verificationService.rejectRequest(requestId, reason);
      toast.success('Institutional verification request rejected.');
      setRequests((prev) => prev.filter((r) => (r._id || r.id) !== requestId));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to reject request.');
    }
  };

  // Direct user actions
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
    refresh: fetchQueue,
    approveRequest,
    rejectRequest,
    approveUser,
    rejectUser,
  };
}
