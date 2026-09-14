import api from './api';
import { ApiResponse } from '../types';
import {
  ConnectionItem,
  ConnectionRequestItem,
  PendingConnectionsData,
  ConnectionStatusData,
} from '../types/connection';

export interface CreateConnectionPayload {
  recipientId: string;
  message?: string;
}

export interface UpdateConnectionStatusPayload {
  status: 'accepted' | 'rejected';
}

export const connectionsService = {
  // Send a connection request
  sendConnectionRequest: (data: CreateConnectionPayload) =>
    api.post<ApiResponse<{ connection: ConnectionRequestItem }>>('/connections', data),

  // Get accepted connections
  getAcceptedConnections: (params?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<{ items: ConnectionItem[]; total: number; page: number; totalPages: number }>>(
      '/connections',
      { params }
    ),

  // Get pending invitations (separated into received and sent)
  getPendingRequests: () =>
    api.get<ApiResponse<PendingConnectionsData>>('/connections/pending'),

  // Get connection status with a specific user
  getConnectionStatus: (targetUserId: string) =>
    api.get<ApiResponse<ConnectionStatusData>>(`/connections/status/${targetUserId}`),

  // Accept or decline a received request
  updateStatus: (id: string, data: UpdateConnectionStatusPayload) =>
    api.patch<ApiResponse<{ connection: ConnectionRequestItem }>>(`/connections/${id}/status`, data),

  // Withdraw a sent pending request
  withdrawRequest: (id: string) =>
    api.patch<ApiResponse<{ connection: ConnectionRequestItem }>>(`/connections/${id}/withdraw`),

  // Remove an accepted connection
  removeConnection: (id: string) =>
    api.delete<ApiResponse<{ message: string; connection: ConnectionRequestItem }>>(`/connections/${id}`),
};

export default connectionsService;
