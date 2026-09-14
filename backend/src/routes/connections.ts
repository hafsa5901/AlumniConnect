import { Router } from 'express';
import { connectionsController } from '../controllers/connectionsController';
import { authenticate } from '../middleware/auth';
import { requireVerified } from '../middleware/requireVerified';

const router = Router();

// Send connection request (verified active users)
router.post(
  '/',
  authenticate,
  requireVerified,
  connectionsController.createConnectionRequest
);

// Get accepted mutual connections
router.get(
  '/',
  authenticate,
  connectionsController.getAcceptedConnections
);

// Get pending received & sent requests
router.get(
  '/pending',
  authenticate,
  connectionsController.getPendingRequests
);

// Get connection status with a specific user
router.get(
  '/status/:targetUserId',
  authenticate,
  connectionsController.getConnectionStatus
);

// Accept or decline a received request
router.patch(
  '/:id/status',
  authenticate,
  requireVerified,
  connectionsController.updateConnectionStatus
);

// Withdraw a sent request
router.patch(
  '/:id/withdraw',
  authenticate,
  connectionsController.withdrawConnectionRequest
);

// Remove an accepted connection
router.delete(
  '/:id',
  authenticate,
  connectionsController.removeConnection
);

export default router;
