import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from './config/env';
import User, { IUser, SAFE_USER_FIELDS } from './models/User';
import Conversation from './models/Conversation';
import Message from './models/Message';

let io: Server | null = null;

interface AuthenticatedSocket extends Socket {
  data: {
    user: IUser;
    userId: string;
  };
}

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: (requestOrigin, callback) => {
        if (!requestOrigin || requestOrigin === env.CLIENT_URL) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS policy.'));
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  // Handshake authentication middleware
  io.use(async (socket, next) => {
    try {
      let token: string | undefined = socket.handshake.auth?.token;

      if (!token && socket.handshake.headers?.authorization) {
        const parts = socket.handshake.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
          token = parts[1];
        }
      }

      if (!token && socket.handshake.headers?.cookie) {
        const cookies = socket.handshake.headers.cookie.split(';');
        for (const cookie of cookies) {
          const [name, val] = cookie.trim().split('=');
          if (name === 'accessToken') {
            token = decodeURIComponent(val);
            break;
          }
        }
      }

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as {
        id?: string;
        userId?: string;
        sub?: string;
      };

      const userId = decoded.id || decoded.userId || decoded.sub;
      if (!userId) {
        return next(new Error('Invalid token payload'));
      }

      const user = await User.findById(userId);
      if (!user) {
        return next(new Error('User not found'));
      }

      if (user.accountStatus !== 'active') {
        return next(new Error('ACCOUNT_SUSPENDED'));
      }

      (socket as AuthenticatedSocket).data = {
        user,
        userId: user._id.toString(),
      };

      return next();
    } catch (err) {
      return next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket;
    const userId = authSocket.data.userId;

    // Join user's private room
    authSocket.join(`user:${userId}`);

    // Handler: message:send
    authSocket.on('message:send', async (data: { conversationId: string; content: string }) => {
      try {
        // 1. Live status re-validation on every event
        const freshUser = await User.findById(userId);
        if (!freshUser || freshUser.accountStatus !== 'active') {
          authSocket.emit('messaging:error', {
            code: 'ACCOUNT_SUSPENDED',
            message: 'Your account is suspended.',
          });
          authSocket.disconnect(true);
          return;
        }

        const { conversationId, content } = data || {};
        const trimmed = (content || '').trim();

        if (!trimmed || trimmed.length > 2000) {
          authSocket.emit('messaging:error', {
            code: 'VALIDATION_ERROR',
            message: 'Message content must be between 1 and 2000 characters.',
          });
          return;
        }

        if (!conversationId) {
          authSocket.emit('messaging:error', {
            code: 'VALIDATION_ERROR',
            message: 'Conversation ID is required.',
          });
          return;
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          authSocket.emit('messaging:error', {
            code: 'NOT_FOUND',
            message: 'Conversation does not exist.',
          });
          return;
        }

        const isPartA = conversation.participantA.toString() === userId;
        const isPartB = conversation.participantB.toString() === userId;

        if (!isPartA && !isPartB) {
          authSocket.emit('messaging:error', {
            code: 'FORBIDDEN_OWNERSHIP',
            message: 'You are not a participant in this conversation.',
          });
          return;
        }

        const recipientId = isPartA ? conversation.participantB : conversation.participantA;
        const recipient = await User.findById(recipientId);
        if (!recipient || recipient.accountStatus !== 'active') {
          authSocket.emit('messaging:error', {
            code: 'RECIPIENT_INACTIVE',
            message: 'Recipient is no longer active.',
          });
          return;
        }

        // Persist message first before emitting
        const message = await Message.create({
          conversation: conversation._id,
          sender: freshUser._id,
          recipient: recipient._id,
          content: trimmed,
        });

        // Update conversation summary
        conversation.lastMessage = trimmed;
        conversation.lastMessageAt = message.createdAt;
        await conversation.save();

        const populatedMessage = await Message.findById(message._id)
          .populate('sender', 'name email profilePhotoUrl role')
          .populate('recipient', 'name email profilePhotoUrl role');

        // Emit message:new to both participants' rooms
        io?.to(`user:${userId}`).emit('message:new', { message: populatedMessage });
        io?.to(`user:${recipientId.toString()}`).emit('message:new', { message: populatedMessage });

        // Calculate unread count for recipient
        const recipientUnreadCount = await Message.countDocuments({
          conversation: conversation._id,
          recipient: recipient._id,
          readAt: null,
        });

        // Emit conversation:updated
        io?.to(`user:${userId}`).emit('conversation:updated', {
          conversationId: conversation._id,
          lastMessage: trimmed,
          lastMessageAt: message.createdAt,
          unreadCount: 0,
        });

        io?.to(`user:${recipientId.toString()}`).emit('conversation:updated', {
          conversationId: conversation._id,
          lastMessage: trimmed,
          lastMessageAt: message.createdAt,
          unreadCount: recipientUnreadCount,
        });
      } catch (err: any) {
        authSocket.emit('messaging:error', {
          code: 'SERVER_ERROR',
          message: err.message || 'Failed to send message.',
        });
      }
    });

    // Handler: conversation:read
    authSocket.on('conversation:read', async (data: { conversationId: string }) => {
      try {
        const freshUser = await User.findById(userId);
        if (!freshUser || freshUser.accountStatus !== 'active') {
          authSocket.emit('messaging:error', {
            code: 'ACCOUNT_SUSPENDED',
            message: 'Your account is suspended.',
          });
          authSocket.disconnect(true);
          return;
        }

        const { conversationId } = data || {};
        if (!conversationId) return;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return;

        const isPartA = conversation.participantA.toString() === userId;
        const isPartB = conversation.participantB.toString() === userId;
        if (!isPartA && !isPartB) return;

        const otherUserId = isPartA ? conversation.participantB.toString() : conversation.participantA.toString();

        const now = new Date();
        const updateRes = await Message.updateMany(
          {
            conversation: conversation._id,
            recipient: freshUser._id,
            readAt: null,
          },
          {
            $set: { readAt: now },
          }
        );

        if (updateRes.modifiedCount > 0) {
          io?.to(`user:${userId}`).emit('message:read', {
            conversationId: conversation._id,
            readAt: now,
          });
          io?.to(`user:${otherUserId}`).emit('message:read', {
            conversationId: conversation._id,
            readAt: now,
          });

          io?.to(`user:${userId}`).emit('conversation:updated', {
            conversationId: conversation._id,
            unreadCount: 0,
          });
        }
      } catch (err) {
        // Silently catch read receipt error
      }
    });
  });

  return io;
}

export function getIO(): Server | null {
  return io;
}

export function emitToUser(userId: string, event: string, payload: any): void {
  if (io) {
    io.to(`user:${userId}`).emit(event, payload);
  }
}
