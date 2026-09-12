import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import MentorshipRequest from '../models/MentorshipRequest';
import User, { IUser, SAFE_USER_FIELDS } from '../models/User';
import AdminAuditLog from '../models/AdminAuditLog';
import { createError } from '../middleware/errorHandler';
import { emitToUser } from '../socket';
import notificationService from '../services/notificationService';
import messagingService from '../services/messagingService';

// ── 1. GET /api/v1/messaging/eligible-contacts ─────────────────────────────
export async function getEligibleContacts(req: Request, res: Response): Promise<void> {
  const currentUserId = req.user!._id;
  const currentUserRole = req.user!.role;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  if (currentUserRole === 'admin') {
    // Admin eligible contacts: search/paginate across active platform users
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const query: any = {
      _id: { $ne: currentUserId },
      accountStatus: 'active',
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } },
      ];
    }

    const [total, users] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .select('name email role profilePhotoUrl department batch company designation verificationStatus accountStatus')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit),
    ]);

    res.json({
      success: true,
      data: {
        isAdmin: true,
        items: users,
        total,
        page,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
    return;
  }

  // Non-admin user: Gated on accepted MentorshipRequests
  const acceptedRequests = await MentorshipRequest.find({
    status: 'accepted',
    $or: [{ student: currentUserId }, { mentor: currentUserId }],
  }).select('student mentor');

  const counterpartIds = new Set<string>();
  for (const reqItem of acceptedRequests) {
    const studentStr = reqItem.student.toString();
    const mentorStr = reqItem.mentor.toString();
    if (studentStr === currentUserId.toString()) {
      counterpartIds.add(mentorStr);
    } else {
      counterpartIds.add(studentStr);
    }
  }

  if (counterpartIds.size === 0) {
    res.json({
      success: true,
      data: {
        isAdmin: false,
        items: [],
        total: 0,
      },
    });
    return;
  }

  const query: any = {
    _id: { $in: Array.from(counterpartIds).map((id) => new Types.ObjectId(id)) },
    accountStatus: 'active',
  };

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { company: { $regex: search, $options: 'i' } },
      { department: { $regex: search, $options: 'i' } },
    ];
  }

  const users = await User.find(query)
    .select('name email role profilePhotoUrl department batch company designation verificationStatus accountStatus')
    .sort({ name: 1 });

  res.json({
    success: true,
    data: {
      isAdmin: false,
      items: users,
      total: users.length,
    },
  });
}

// ── 2. GET /api/v1/messaging/conversations ─────────────────────────────────
export async function getConversations(req: Request, res: Response): Promise<void> {
  const currentUserId = req.user!._id;

  const conversations = await Conversation.find({
    $or: [{ participantA: currentUserId }, { participantB: currentUserId }],
  })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .populate('participantA', 'name email role profilePhotoUrl department batch company designation verificationStatus accountStatus')
    .populate('participantB', 'name email role profilePhotoUrl department batch company designation verificationStatus accountStatus');

  // Compute unread counts for each conversation
  const results = await Promise.all(
    conversations.map(async (conv) => {
      const convObj = conv.toJSON();
      const isPartA = conv.participantA && (conv.participantA as any)._id?.toString() === currentUserId.toString();
      const otherParticipant = isPartA ? conv.participantB : conv.participantA;

      const unreadCount = await Message.countDocuments({
        conversation: conv._id,
        recipient: currentUserId,
        readAt: null,
      });

      return {
        ...convObj,
        otherParticipant,
        unreadCount,
      };
    })
  );

  res.json({
    success: true,
    data: {
      conversations: results,
    },
  });
}

// ── 3. POST /api/v1/messaging/conversations ────────────────────────────────
export async function createConversation(req: Request, res: Response): Promise<void> {
  const currentUserId = req.user!._id;
  const currentUserRole = req.user!.role;
  const { recipientId } = req.body;

  if (!recipientId || !mongoose.isValidObjectId(recipientId)) {
    throw createError('Valid recipientId is required.', 400, 'VALIDATION_ERROR');
  }

  if (currentUserId.toString() === recipientId.toString()) {
    throw createError('You cannot start a conversation with yourself.', 400, 'SELF_MESSAGE_FORBIDDEN');
  }

  const recipient = await User.findById(recipientId);
  if (!recipient) {
    throw createError('Recipient not found.', 404, 'NOT_FOUND');
  }

  if (recipient.accountStatus !== 'active') {
    throw createError('Recipient account is suspended or inactive.', 403, 'RECIPIENT_INACTIVE');
  }

  // Eligibility check: non-admin requires an accepted MentorshipRequest
  if (currentUserRole !== 'admin') {
    const hasAcceptedMentorship = await MentorshipRequest.exists({
      status: 'accepted',
      $or: [
        { student: currentUserId, mentor: recipient._id },
        { student: recipient._id, mentor: currentUserId },
      ],
    });

    if (!hasAcceptedMentorship) {
      throw createError(
        'Messaging is only available between students and alumni with an accepted mentorship.',
        403,
        'NOT_MESSAGING_ELIGIBLE'
      );
    }
  }

  const { participantA, participantB } = Conversation.getCanonicalParticipants(
    currentUserId,
    recipient._id
  );

  let conversation;
  let isNew = false;

  try {
    conversation = await Conversation.create({
      participantA,
      participantB,
    });
    isNew = true;

    // Admin audit logging if admin initiated
    if (currentUserRole === 'admin') {
      await AdminAuditLog.create({
        admin: currentUserId,
        action: 'admin_initiated_conversation',
        targetType: 'user',
        targetId: recipient._id,
        metadata: {
          conversationId: conversation._id,
          recipientEmail: recipient.email,
          recipientName: recipient.name,
        },
      });
    }
  } catch (err: any) {
    if (err.code === 11000) {
      // Race condition catch: conversation already created
      conversation = await Conversation.findOne({ participantA, participantB });
    } else {
      throw err;
    }
  }

  if (!conversation) {
    throw createError('Failed to create conversation.', 500, 'SERVER_ERROR');
  }

  const populated = await Conversation.findById(conversation._id)
    .populate('participantA', 'name email role profilePhotoUrl department batch company designation verificationStatus accountStatus')
    .populate('participantB', 'name email role profilePhotoUrl department batch company designation verificationStatus accountStatus');

  const convObj = populated!.toJSON();
  const isPartA = (populated!.participantA as any)?._id?.toString() === currentUserId.toString();
  const otherParticipant = isPartA ? populated!.participantB : populated!.participantA;

  const unreadCount = await Message.countDocuments({
    conversation: conversation._id,
    recipient: currentUserId,
    readAt: null,
  });

  res.status(isNew ? 201 : 200).json({
    success: true,
    data: {
      conversation: {
        ...convObj,
        otherParticipant,
        unreadCount,
      },
    },
  });
}

// ── 4. GET /api/v1/messaging/conversations/:id ─────────────────────────────
export async function getConversationById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const currentUserId = req.user!._id;

  if (!id || !mongoose.isValidObjectId(id)) {
    throw createError('Conversation not found.', 404, 'NOT_FOUND');
  }

  const conversation = await Conversation.findById(id)
    .populate('participantA', 'name email role profilePhotoUrl department batch company designation verificationStatus accountStatus')
    .populate('participantB', 'name email role profilePhotoUrl department batch company designation verificationStatus accountStatus');

  if (!conversation) {
    throw createError('Conversation not found.', 404, 'NOT_FOUND');
  }

  const isPartA = (conversation.participantA as any)?._id?.toString() === currentUserId.toString();
  const isPartB = (conversation.participantB as any)?._id?.toString() === currentUserId.toString();

  if (!isPartA && !isPartB) {
    throw createError('You are not a participant in this conversation.', 403, 'FORBIDDEN_OWNERSHIP');
  }

  const convObj = conversation.toJSON();
  const otherParticipant = isPartA ? conversation.participantB : conversation.participantA;

  const unreadCount = await Message.countDocuments({
    conversation: conversation._id,
    recipient: currentUserId,
    readAt: null,
  });

  res.json({
    success: true,
    data: {
      conversation: {
        ...convObj,
        otherParticipant,
        unreadCount,
      },
    },
  });
}

// ── 5. GET /api/v1/messaging/conversations/:id/messages ────────────────────
export async function getMessages(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const currentUserId = req.user!._id;
  const { before } = req.query;
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 30));

  if (!id || !mongoose.isValidObjectId(id)) {
    throw createError('Conversation not found.', 404, 'NOT_FOUND');
  }

  const conversation = await Conversation.findById(id);
  if (!conversation) {
    throw createError('Conversation not found.', 404, 'NOT_FOUND');
  }

  const isPartA = conversation.participantA.toString() === currentUserId.toString();
  const isPartB = conversation.participantB.toString() === currentUserId.toString();

  if (!isPartA && !isPartB) {
    throw createError('You are not a participant in this conversation.', 403, 'FORBIDDEN_OWNERSHIP');
  }

  const query: any = { conversation: conversation._id };

  if (before) {
    if (typeof before === 'string' && mongoose.isValidObjectId(before)) {
      query._id = { $lt: new Types.ObjectId(before) };
    }
  }

  // Fetch limit + 1 to determine hasMore
  const rawMessages = await Message.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate('sender', 'name email profilePhotoUrl role')
    .populate('recipient', 'name email profilePhotoUrl role');

  const hasMore = rawMessages.length > limit;
  const slicedMessages = hasMore ? rawMessages.slice(0, limit) : rawMessages;

  // Next cursor is the oldest message ID in the sliced set
  const nextCursor = slicedMessages.length > 0 ? slicedMessages[slicedMessages.length - 1]._id.toString() : null;

  // Reverse to return in chronological order (oldest to newest) for client stream
  const messages = slicedMessages.reverse();

  res.json({
    success: true,
    data: {
      messages,
      hasMore,
      nextCursor,
    },
  });
}

// ── 6. POST /api/v1/messaging/conversations/:id/messages ───────────────────
export async function sendMessage(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const currentUserId = req.user!._id;
  const { content } = req.body;

  const result = await messagingService.sendMessage(currentUserId, id as string, content);

  res.status(201).json({
    success: true,
    data: {
      message: result.message,
    },
  });
}

// ── 7. PATCH /api/v1/messaging/conversations/:id/read ──────────────────────
export async function markConversationRead(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const currentUserId = req.user!._id;

  const result = await messagingService.markConversationRead(currentUserId, id as string);

  res.json({
    success: true,
    data: {
      modifiedCount: result.modifiedCount,
      readAt: result.readAt,
    },
  });
}
