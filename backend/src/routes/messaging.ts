import { Router } from 'express';
import {
  getEligibleContacts,
  getConversations,
  createConversation,
  getConversationById,
  getMessages,
  sendMessage,
  markConversationRead,
} from '../controllers/messagingController';
import { authenticate } from '../middleware/auth';
import { requireVerified } from '../middleware/requireVerified';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// 1. Eligible contacts
router.get('/eligible-contacts', authenticate, asyncHandler(getEligibleContacts));

// 2. Conversations list
router.get('/conversations', authenticate, asyncHandler(getConversations));

// 3. Create or fetch conversation
router.post('/conversations', authenticate, requireVerified, asyncHandler(createConversation));

// 4. Conversation detail
router.get('/conversations/:id', authenticate, asyncHandler(getConversationById));

// 5. Message history (cursor-based pagination)
router.get('/conversations/:id/messages', authenticate, asyncHandler(getMessages));

// 6. Send message
router.post('/conversations/:id/messages', authenticate, requireVerified, asyncHandler(sendMessage));

// 7. Mark conversation read
router.patch('/conversations/:id/read', authenticate, asyncHandler(markConversationRead));

export default router;
