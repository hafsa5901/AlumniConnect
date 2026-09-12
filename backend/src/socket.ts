import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from './config/env';
import User, { IUser, SAFE_USER_FIELDS } from './models/User';
import messagingService from './services/messagingService';

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

    // Handler: message:send (authoritative convergence with REST)
    authSocket.on('message:send', async (data: { conversationId: string; content: string }) => {
      try {
        const { conversationId, content } = data || {};
        await messagingService.sendMessage(userId, conversationId, content);
      } catch (err: any) {
        authSocket.emit('messaging:error', {
          code: err.code || 'SERVER_ERROR',
          message: err.message || 'Failed to send message.',
        });
        if (err.code === 'ACCOUNT_SUSPENDED') {
          authSocket.disconnect(true);
        }
      }
    });

    // Handler: conversation:read (authoritative convergence with REST)
    authSocket.on('conversation:read', async (data: { conversationId: string }) => {
      try {
        const { conversationId } = data || {};
        if (!conversationId) return;
        await messagingService.markConversationRead(userId, conversationId);
      } catch (err: any) {
        if (err.code === 'ACCOUNT_SUSPENDED') {
          authSocket.emit('messaging:error', {
            code: 'ACCOUNT_SUSPENDED',
            message: 'Your account is suspended.',
          });
          authSocket.disconnect(true);
        }
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
