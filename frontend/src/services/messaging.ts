import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import api from './api';

export interface ParticipantInfo {
  id?: string;
  _id?: string;
  name: string;
  email: string;
  role: 'student' | 'alumni' | 'admin';
  profilePhotoUrl?: string;
  department?: string;
  batch?: string;
  company?: string;
  designation?: string;
  verificationStatus?: string;
  accountStatus?: string;
}

export interface ConversationItem {
  id: string;
  _id?: string;
  participantA: ParticipantInfo;
  participantB: ParticipantInfo;
  otherParticipant: ParticipantInfo;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MessageItem {
  id: string;
  _id?: string;
  conversation: string;
  sender: ParticipantInfo;
  recipient: ParticipantInfo;
  content: string;
  readAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EligibleContactsResponse {
  isAdmin: boolean;
  items: ParticipantInfo[];
  total: number;
  page?: number;
  totalPages?: number;
}

export interface MessagesPageResponse {
  messages: MessageItem[];
  hasMore: boolean;
  nextCursor: string | null;
}

// ── REST Client Methods ──────────────────────────────────────────────────
export const messagingService = {
  getEligibleContacts: (params?: { search?: string; page?: number; limit?: number }) => {
    return api.get<{ success: boolean; data: EligibleContactsResponse }>('/messaging/eligible-contacts', {
      params,
    });
  },

  getConversations: () => {
    return api.get<{ success: boolean; data: { conversations: ConversationItem[] } }>(
      '/messaging/conversations'
    );
  },

  createConversation: (recipientId: string) => {
    return api.post<{ success: boolean; data: { conversation: ConversationItem } }>(
      '/messaging/conversations',
      { recipientId }
    );
  },

  getConversationById: (id: string) => {
    return api.get<{ success: boolean; data: { conversation: ConversationItem } }>(
      `/messaging/conversations/${id}`
    );
  },

  getMessages: (conversationId: string, before?: string | null, limit?: number) => {
    return api.get<{ success: boolean; data: MessagesPageResponse }>(
      `/messaging/conversations/${conversationId}/messages`,
      {
        params: { before: before || undefined, limit: limit || 30 },
      }
    );
  },

  sendMessage: (conversationId: string, content: string) => {
    return api.post<{ success: boolean; data: { message: MessageItem } }>(
      `/messaging/conversations/${conversationId}/messages`,
      { content }
    );
  },

  markAsRead: (conversationId: string) => {
    return api.patch<{ success: boolean; data: { modifiedCount: number; readAt: string } }>(
      `/messaging/conversations/${conversationId}/read`
    );
  },
};

// ── Socket.IO Client Hook ────────────────────────────────────────────────
interface SocketCallbacks {
  onNewMessage?: (data: { message: MessageItem }) => void;
  onConversationUpdated?: (data: {
    conversationId: string;
    lastMessage?: string;
    lastMessageAt?: string;
    unreadCount?: number;
  }) => void;
  onMessageRead?: (data: { conversationId: string; readAt: string }) => void;
  onError?: (err: { code: string; message: string }) => void;
}

export function useMessagingSocket(callbacks: SocketCallbacks) {
  const socketRef = useRef<Socket | null>(null);
  const callbacksRef = useRef<SocketCallbacks>(callbacks);

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on('message:new', (data) => {
      callbacksRef.current.onNewMessage?.(data);
    });

    socket.on('conversation:updated', (data) => {
      callbacksRef.current.onConversationUpdated?.(data);
    });

    socket.on('message:read', (data) => {
      callbacksRef.current.onMessageRead?.(data);
    });

    socket.on('messaging:error', (data) => {
      callbacksRef.current.onError?.(data);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const sendSocketMessage = (conversationId: string, content: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('message:send', { conversationId, content });
    }
  };

  const markSocketRead = (conversationId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('conversation:read', { conversationId });
    }
  };

  return {
    socket: socketRef.current,
    sendSocketMessage,
    markSocketRead,
  };
}
