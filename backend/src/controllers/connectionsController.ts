import { Request, Response, NextFunction } from 'express';
import mongoose, { Types } from 'mongoose';
import ConnectionRequest from '../models/ConnectionRequest';
import User from '../models/User';
import notificationService from '../services/notificationService';
import { createError } from '../middleware/errorHandler';
import {
  createConnectionSchema,
  updateConnectionStatusSchema,
} from '../validators/connection';

export class ConnectionsController {
  /**
   * 1. POST /api/v1/connections
   * Sends a connection request with canonical participant ordering and symmetric duplicate protection.
   */
  async createConnectionRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUserId = req.user!._id;
      const validation = createConnectionSchema.safeParse(req.body);
      if (!validation.success) {
        throw createError(
          validation.error.errors.map((e) => e.message).join(', '),
          400,
          'VALIDATION_ERROR'
        );
      }
      const validated = validation.data;

      if (validated.recipientId === currentUserId.toString()) {
        throw createError('You cannot send a connection request to yourself.', 400, 'SELF_CONNECTION_FORBIDDEN');
      }

      // Check recipient account
      const recipient = await User.findById(validated.recipientId);
      if (!recipient || recipient.accountStatus !== 'active' || recipient.verificationStatus !== 'admin_approved') {
        throw createError('Recipient account is unverified, inactive, or suspended.', 403, 'RECIPIENT_INACTIVE');
      }

      // Check caller account
      const caller = await User.findById(currentUserId);
      if (!caller || caller.accountStatus !== 'active' || caller.verificationStatus !== 'admin_approved') {
        throw createError('Your account must be active and verified to send connection requests.', 403, 'RECIPIENT_INACTIVE');
      }

      const { participantA, participantB } = ConnectionRequest.getCanonicalParticipants(
        currentUserId,
        recipient._id
      );

      // Check for existing active connection in either direction
      const existingActive = await ConnectionRequest.findOne({
        participantA,
        participantB,
        status: { $in: ['pending', 'accepted'] },
      });

      if (existingActive) {
        if (existingActive.status === 'accepted') {
          throw createError('You are already connected with this user.', 409, 'DUPLICATE_CONNECTION_REQUEST');
        }

        if (existingActive.status === 'pending') {
          if (existingActive.requester.toString() === currentUserId.toString()) {
            res.status(409).json({
              success: false,
              error: {
                code: 'DUPLICATE_CONNECTION_REQUEST',
                message: 'You already have a pending connection request to this user.',
                existingRequest: {
                  id: existingActive._id,
                  direction: 'outgoing',
                  status: 'pending',
                },
              },
            });
            return;
          } else {
            // Target user already sent a pending request to caller
            res.status(409).json({
              success: false,
              error: {
                code: 'DUPLICATE_CONNECTION_REQUEST',
                message: 'This user has already sent you a connection request.',
                existingRequest: {
                  id: existingActive._id,
                  direction: 'incoming',
                  status: 'pending',
                },
              },
            });
            return;
          }
        }
      }

      let connection;
      try {
        connection = await ConnectionRequest.create({
          requester: currentUserId,
          recipient: recipient._id,
          participantA,
          participantB,
          status: 'pending',
          message: validated.message || undefined,
        });
      } catch (err: any) {
        if (err.code === 11000) {
          throw createError('A connection request between these users already exists.', 409, 'DUPLICATE_CONNECTION_REQUEST');
        }
        throw err;
      }

      // Post-commit notification to recipient
      try {
        await notificationService.createNotification({
          recipient: recipient._id,
          actor: currentUserId,
          type: 'connection_request_received',
          title: 'New Connection Request',
          message: `${caller.name} sent you a connection request.`,
          relatedEntityType: 'connection',
          relatedEntityId: connection._id,
        });
      } catch {
        // Non-blocking notification
      }

      res.status(201).json({
        success: true,
        data: {
          connection,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 2. GET /api/v1/connections
   * Retrieves accepted connections with connectedUser details.
   */
  async getAcceptedConnections(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUserId = req.user!._id;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;

      const query = {
        status: 'accepted',
        $or: [{ requester: currentUserId }, { recipient: currentUserId }],
      };

      const [total, rawConnections] = await Promise.all([
        ConnectionRequest.countDocuments(query),
        ConnectionRequest.find(query)
          .populate('requester', 'name email role company designation profilePhotoUrl department batch verificationStatus accountStatus')
          .populate('recipient', 'name email role company designation profilePhotoUrl department batch verificationStatus accountStatus')
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit),
      ]);

      const items = rawConnections.map((conn) => {
        const isRequester = (conn.requester as any)._id?.toString() === currentUserId.toString();
        const connectedUser = isRequester ? conn.recipient : conn.requester;
        return {
          _id: conn._id,
          status: conn.status,
          connectedUser,
          connectedAt: conn.updatedAt,
          createdAt: conn.createdAt,
        };
      });

      res.json({
        success: true,
        data: {
          items,
          total,
          page,
          totalPages: Math.ceil(total / limit) || 1,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 3. GET /api/v1/connections/pending
   * Retrieves pending received and sent connection invitations in two explicit arrays.
   */
  async getPendingRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUserId = req.user!._id;

      const [received, sent] = await Promise.all([
        ConnectionRequest.find({
          recipient: currentUserId,
          status: 'pending',
        })
          .populate('requester', 'name email role company designation profilePhotoUrl department batch verificationStatus')
          .sort({ createdAt: -1 }),
        ConnectionRequest.find({
          requester: currentUserId,
          status: 'pending',
        })
          .populate('recipient', 'name email role company designation profilePhotoUrl department batch verificationStatus')
          .sort({ createdAt: -1 }),
      ]);

      res.json({
        success: true,
        data: {
          received,
          sent,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 4. GET /api/v1/connections/status/:targetUserId
   * Returns connection status with target user. Uses existence-hiding neutral response for invalid/inactive targets.
   */
  async getConnectionStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUserId = req.user!._id;
      const { targetUserId } = req.params;

      if (!targetUserId || !mongoose.isValidObjectId(targetUserId)) {
        res.json({
          success: true,
          data: { status: 'none', isConnected: false },
        });
        return;
      }

      // Neutral existence-hiding check for target user
      const targetUser = await User.findById(targetUserId);
      if (!targetUser || targetUser.accountStatus !== 'active') {
        res.json({
          success: true,
          data: { status: 'none', isConnected: false },
        });
        return;
      }

      const { participantA, participantB } = ConnectionRequest.getCanonicalParticipants(
        currentUserId,
        targetUserId as string
      );

      const connection = await ConnectionRequest.findOne({
        participantA,
        participantB,
        status: { $in: ['pending', 'accepted'] },
      });

      if (!connection) {
        res.json({
          success: true,
          data: { status: 'none', isConnected: false },
        });
        return;
      }

      const isSender = connection.requester.toString() === currentUserId.toString();

      res.json({
        success: true,
        data: {
          status: connection.status,
          isConnected: connection.status === 'accepted',
          requestId: connection._id,
          isSender,
          direction: isSender ? 'outgoing' : 'incoming',
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 5. PATCH /api/v1/connections/:id/status
   * Recipient accepts or declines a pending connection request.
   */
  async updateConnectionStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUserId = req.user!._id;
      const { id } = req.params;

      if (!id || !mongoose.isValidObjectId(id)) {
        throw createError('Connection request not found.', 404, 'CONNECTION_NOT_FOUND');
      }

      const validation = updateConnectionStatusSchema.safeParse(req.body);
      if (!validation.success) {
        throw createError(
          validation.error.errors.map((e) => e.message).join(', '),
          400,
          'VALIDATION_ERROR'
        );
      }
      const validated = validation.data;

      const updated = await ConnectionRequest.findOneAndUpdate(
        {
          _id: id,
          recipient: currentUserId,
          status: 'pending',
        },
        {
          $set: { status: validated.status },
        },
        { new: true }
      )
        .populate('requester', 'name email')
        .populate('recipient', 'name email');

      if (!updated) {
        const existing = await ConnectionRequest.findById(id);
        if (!existing || existing.recipient.toString() !== currentUserId.toString()) {
          // Existence hiding
          throw createError('Connection request not found.', 404, 'CONNECTION_NOT_FOUND');
        }
        throw createError('Connection request cannot be updated in its current state.', 400, 'INVALID_STATUS_TRANSITION');
      }

      // Post-commit notification for accept/reject
      try {
        const notifType =
          validated.status === 'accepted'
            ? 'connection_request_accepted'
            : 'connection_request_rejected';
        const title =
          validated.status === 'accepted'
            ? 'Connection Request Accepted'
            : 'Connection Request Declined';
        const msg =
          validated.status === 'accepted'
            ? `${req.user!.name} accepted your connection request.`
            : `${req.user!.name} declined your connection request.`;
        const requesterId = (updated.requester as any)._id || updated.requester;

        await notificationService.createNotification({
          recipient: requesterId,
          actor: currentUserId,
          type: notifType,
          title,
          message: msg,
          relatedEntityType: 'connection',
          relatedEntityId: updated._id,
        });
      } catch {
        // Non-blocking notification
      }

      res.json({
        success: true,
        data: {
          connection: updated,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 6. PATCH /api/v1/connections/:id/withdraw
   * Requester withdraws a pending connection request.
   */
  async withdrawConnectionRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUserId = req.user!._id;
      const { id } = req.params;

      if (!id || !mongoose.isValidObjectId(id)) {
        throw createError('Connection request not found.', 404, 'CONNECTION_NOT_FOUND');
      }

      const updated = await ConnectionRequest.findOneAndUpdate(
        {
          _id: id,
          requester: currentUserId,
          status: 'pending',
        },
        {
          $set: { status: 'withdrawn' },
        },
        { new: true }
      );

      if (!updated) {
        const existing = await ConnectionRequest.findById(id);
        if (!existing || existing.requester.toString() !== currentUserId.toString()) {
          // Existence hiding
          throw createError('Connection request not found.', 404, 'CONNECTION_NOT_FOUND');
        }
        throw createError('Only pending connection requests can be withdrawn.', 400, 'INVALID_STATUS_TRANSITION');
      }

      // Deliberately no notification for withdraw (per §11)
      res.json({
        success: true,
        data: {
          connection: updated,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 7. DELETE /api/v1/connections/:id
   * Removes an accepted connection.
   */
  async removeConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUserId = req.user!._id;
      const { id } = req.params;

      if (!id || !mongoose.isValidObjectId(id)) {
        throw createError('Connection not found.', 404, 'CONNECTION_NOT_FOUND');
      }

      const updated = await ConnectionRequest.findOneAndUpdate(
        {
          _id: id,
          $or: [{ requester: currentUserId }, { recipient: currentUserId }],
          status: 'accepted',
        },
        {
          $set: { status: 'removed' },
        },
        { new: true }
      );

      if (!updated) {
        const existing = await ConnectionRequest.findById(id);
        const isParticipant =
          existing &&
          (existing.requester.toString() === currentUserId.toString() ||
            existing.recipient.toString() === currentUserId.toString());

        if (!existing || !isParticipant) {
          // Existence hiding
          throw createError('Connection not found.', 404, 'CONNECTION_NOT_FOUND');
        }
        throw createError('Only accepted connections can be removed.', 400, 'INVALID_STATUS_TRANSITION');
      }

      // Deliberately no notification for remove (per §11)
      res.json({
        success: true,
        data: {
          message: 'Connection removed successfully.',
          connection: updated,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

export const connectionsController = new ConnectionsController();
export default connectionsController;
