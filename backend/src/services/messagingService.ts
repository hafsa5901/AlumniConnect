import mongoose, { Types } from 'mongoose';
import Conversation from '../models/Conversation';
import Message, { IMessage } from '../models/Message';
import User from '../models/User';
import { createError } from '../middleware/errorHandler';
import { emitToUser } from '../socket';
import notificationService from './notificationService';

export interface SendMessageResult {
  message: IMessage;
  conversation: any;
}

export interface MarkReadResult {
  modifiedCount: number;
  readAt: Date;
}

export class MessagingService {
  /**
   * Authoritative message sending pipeline:
   * 1. Validates inputs & conversation membership
   * 2. Validates recipient account status
   * 3. Persists Message document
   * 4. Updates Conversation metadata
   * 5. Persists ONE 'new_message' notification & triggers live notification emit
   * 6. Emits 'message:new' and 'conversation:updated' real-time socket events
   */
  async sendMessage(
    senderId: string | Types.ObjectId,
    conversationId: string | Types.ObjectId,
    rawContent: string
  ): Promise<SendMessageResult> {
    const senderObjId = new Types.ObjectId(senderId.toString());

    if (!conversationId || !mongoose.isValidObjectId(conversationId)) {
      throw createError('Conversation not found.', 404, 'NOT_FOUND');
    }
    const convObjId = new Types.ObjectId(conversationId.toString());

    const trimmed = (rawContent || '').trim();
    if (!trimmed) {
      throw createError('Message content cannot be empty.', 400, 'VALIDATION_ERROR');
    }
    if (trimmed.length > 2000) {
      throw createError('Message content cannot exceed 2000 characters.', 400, 'VALIDATION_ERROR');
    }

    const conversation = await Conversation.findById(convObjId);
    if (!conversation) {
      throw createError('Conversation not found.', 404, 'NOT_FOUND');
    }

    const isPartA = conversation.participantA.toString() === senderObjId.toString();
    const isPartB = conversation.participantB.toString() === senderObjId.toString();

    if (!isPartA && !isPartB) {
      throw createError('You are not a participant in this conversation.', 403, 'FORBIDDEN_OWNERSHIP');
    }

    const senderUser = await User.findById(senderObjId);
    if (!senderUser || senderUser.accountStatus !== 'active') {
      throw createError('Your account is suspended or inactive.', 403, 'ACCOUNT_SUSPENDED');
    }

    const recipientId = isPartA ? conversation.participantB : conversation.participantA;
    const recipient = await User.findById(recipientId);

    if (!recipient || recipient.accountStatus !== 'active') {
      throw createError('Recipient account is inactive or suspended.', 403, 'RECIPIENT_INACTIVE');
    }

    // Persist message first
    const messageDoc = await Message.create({
      conversation: conversation._id,
      sender: senderObjId,
      recipient: recipient._id,
      content: trimmed,
    });

    // Update conversation summary
    conversation.lastMessage = trimmed;
    conversation.lastMessageAt = messageDoc.createdAt;
    await conversation.save();

    const populatedMessage = await Message.findById(messageDoc._id)
      .populate('sender', 'name email profilePhotoUrl role')
      .populate('recipient', 'name email profilePhotoUrl role');

    // Authoritative single notification creation for new_message
    await notificationService.createNotification({
      recipient: recipient._id,
      actor: senderObjId,
      type: 'new_message',
      title: 'New Message',
      message: `${senderUser.name}: ${trimmed.length > 80 ? trimmed.substring(0, 77) + '...' : trimmed}`,
      relatedEntityType: 'conversation',
      relatedEntityId: conversation._id,
    });

    // Real-time chat socket emissions
    emitToUser(senderObjId.toString(), 'message:new', { message: populatedMessage });
    emitToUser(recipient._id.toString(), 'message:new', { message: populatedMessage });

    const recipientUnreadCount = await Message.countDocuments({
      conversation: conversation._id,
      recipient: recipient._id,
      readAt: null,
    });

    emitToUser(senderObjId.toString(), 'conversation:updated', {
      conversationId: conversation._id,
      lastMessage: trimmed,
      lastMessageAt: messageDoc.createdAt,
      unreadCount: 0,
    });

    emitToUser(recipient._id.toString(), 'conversation:updated', {
      conversationId: conversation._id,
      lastMessage: trimmed,
      lastMessageAt: messageDoc.createdAt,
      unreadCount: recipientUnreadCount,
    });

    return {
      message: populatedMessage as IMessage,
      conversation,
    };
  }

  /**
   * Authoritative conversation read synchronization:
   * 1. Validates caller is participant
   * 2. Updates unread messages for caller in DB
   * 3. Marks associated 'new_message' notifications as read
   * 4. Emits real-time 'message:read' and 'conversation:updated' events
   */
  async markConversationRead(
    userId: string | Types.ObjectId,
    conversationId: string | Types.ObjectId
  ): Promise<MarkReadResult> {
    const userObjId = new Types.ObjectId(userId.toString());

    if (!conversationId || !mongoose.isValidObjectId(conversationId)) {
      throw createError('Conversation not found.', 404, 'NOT_FOUND');
    }
    const convObjId = new Types.ObjectId(conversationId.toString());

    const conversation = await Conversation.findById(convObjId);
    if (!conversation) {
      throw createError('Conversation not found.', 404, 'NOT_FOUND');
    }

    const isPartA = conversation.participantA.toString() === userObjId.toString();
    const isPartB = conversation.participantB.toString() === userObjId.toString();

    if (!isPartA && !isPartB) {
      throw createError('You are not a participant in this conversation.', 403, 'FORBIDDEN_OWNERSHIP');
    }

    const callerUser = await User.findById(userObjId);
    if (!callerUser || callerUser.accountStatus !== 'active') {
      throw createError('Your account is suspended.', 403, 'ACCOUNT_SUSPENDED');
    }

    const otherUserId = isPartA ? conversation.participantB.toString() : conversation.participantA.toString();

    const now = new Date();
    const updateRes = await Message.updateMany(
      {
        conversation: conversation._id,
        recipient: userObjId,
        readAt: null,
      },
      {
        $set: { readAt: now },
      }
    );

    // Sync: Mark related new_message notifications as read
    await notificationService.markMessageNotificationsRead(conversation._id, userObjId);

    if (updateRes.modifiedCount > 0) {
      emitToUser(userObjId.toString(), 'message:read', {
        conversationId: conversation._id,
        readAt: now,
      });
      emitToUser(otherUserId, 'message:read', {
        conversationId: conversation._id,
        readAt: now,
      });
      emitToUser(userObjId.toString(), 'conversation:updated', {
        conversationId: conversation._id,
        unreadCount: 0,
      });
    }

    return {
      modifiedCount: updateRes.modifiedCount,
      readAt: now,
    };
  }
}

export const messagingService = new MessagingService();
export default messagingService;
