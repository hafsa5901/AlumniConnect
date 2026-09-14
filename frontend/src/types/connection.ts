import { User } from './index';

export type ConnectionStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'removed';

export interface ConnectedUserInfo {
  _id: string;
  id?: string;
  name: string;
  email?: string;
  role: string;
  company?: string;
  designation?: string;
  profilePhotoUrl?: string;
  department?: string;
  batch?: string | number;
  verificationStatus?: string;
  accountStatus?: string;
}

export interface ConnectionItem {
  _id: string;
  id?: string;
  status: ConnectionStatus;
  connectedUser: ConnectedUserInfo;
  connectedAt: string;
  createdAt: string;
}

export interface ConnectionRequestItem {
  _id: string;
  id?: string;
  requester: ConnectedUserInfo;
  recipient: ConnectedUserInfo;
  participantA: string;
  participantB: string;
  status: ConnectionStatus;
  message?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PendingConnectionsData {
  received: ConnectionRequestItem[];
  sent: ConnectionRequestItem[];
}

export interface ConnectionStatusData {
  status: 'none' | ConnectionStatus;
  isConnected: boolean;
  requestId?: string;
  isSender?: boolean;
  direction?: 'incoming' | 'outgoing';
}
