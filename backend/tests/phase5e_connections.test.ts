import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app';
import User from '../src/models/User';
import ConnectionRequest from '../src/models/ConnectionRequest';
import Notification from '../src/models/Notification';
import Conversation from '../src/models/Conversation';
import Message from '../src/models/Message';
import MentorshipRequest from '../src/models/MentorshipRequest';
import { signAccessToken } from '../src/utils/auth';

jest.setTimeout(30000);

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  await ConnectionRequest.syncIndexes();
  await Conversation.syncIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await ConnectionRequest.deleteMany({});
  await Notification.deleteMany({});
  await Conversation.deleteMany({});
  await Message.deleteMany({});
  await MentorshipRequest.deleteMany({});
});

describe('Phase 5E: Professional Networking & Connection System Test Suite', () => {
  async function createTestUser(overrides: any = {}) {
    const user = await User.create({
      name: overrides.name || 'Test User',
      email: overrides.email || `user_${Date.now()}_${Math.random()}@college.edu`,
      passwordHash: 'dummy_pw_hash',
      role: overrides.role || 'alumni',
      accountStatus: overrides.accountStatus || 'active',
      verificationStatus: overrides.verificationStatus || 'admin_approved',
      department: overrides.department || 'Computer Science',
      batch: overrides.batch || 2020,
      company: overrides.company || 'Tech Corp',
      designation: overrides.designation || 'Software Engineer',
      ...overrides,
    });
    const token = signAccessToken({ userId: user._id.toString(), role: user.role });
    return { user, token };
  }

  // ── 1. Connection Request Creation ─────────────────────────────────────────
  describe('1. Connection Request Creation', () => {
    it('successfully sends a connection request with an optional note', async () => {
      const { user: sender, token: senderToken } = await createTestUser({ name: 'Sender' });
      const { user: recipient } = await createTestUser({ name: 'Recipient' });

      const res = await request(app)
        .post('/api/v1/connections')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          recipientId: recipient._id.toString(),
          message: 'Hi, I would love to connect!',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.connection).toBeDefined();
      expect(res.body.data.connection.status).toBe('pending');
      expect(res.body.data.connection.message).toBe('Hi, I would love to connect!');
      expect(res.body.data.connection.requester).toBe(sender._id.toString());
      expect(res.body.data.connection.recipient).toBe(recipient._id.toString());

      // Canonical participant ordering check
      const expectedCanonical = ConnectionRequest.getCanonicalParticipants(sender._id, recipient._id);
      expect(res.body.data.connection.participantA).toBe(expectedCanonical.participantA.toString());
      expect(res.body.data.connection.participantB).toBe(expectedCanonical.participantB.toString());

      // Check notification created
      const notif = await Notification.findOne({ recipient: recipient._id });
      expect(notif).toBeDefined();
      expect(notif!.type).toBe('connection_request_received');
      expect(notif!.actor?.toString()).toBe(sender._id.toString());
      expect(notif!.relatedEntityType).toBe('connection');
    });

    it('rejects self-connection attempts with 400 SELF_CONNECTION_FORBIDDEN', async () => {
      const { user, token } = await createTestUser();

      const res = await request(app)
        .post('/api/v1/connections')
        .set('Authorization', `Bearer ${token}`)
        .send({
          recipientId: user._id.toString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SELF_CONNECTION_FORBIDDEN');
    });

    it('rejects sending request to unverified, inactive, or suspended user with 403', async () => {
      const { token: senderToken } = await createTestUser();
      const { user: suspendedUser } = await createTestUser({ accountStatus: 'suspended' });

      const res = await request(app)
        .post('/api/v1/connections')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          recipientId: suspendedUser._id.toString(),
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('RECIPIENT_INACTIVE');
    });

    it('rejects request if caller is not verified/active with 403', async () => {
      const { token: unverifiedToken } = await createTestUser({ verificationStatus: 'pending' });
      const { user: recipient } = await createTestUser();

      const res = await request(app)
        .post('/api/v1/connections')
        .set('Authorization', `Bearer ${unverifiedToken}`)
        .send({
          recipientId: recipient._id.toString(),
        });

      expect(res.status).toBe(403);
    });

    it('validates message length does not exceed 500 chars', async () => {
      const { token: senderToken } = await createTestUser();
      const { user: recipient } = await createTestUser();

      const res = await request(app)
        .post('/api/v1/connections')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          recipientId: recipient._id.toString(),
          message: 'a'.repeat(501),
        });

      expect(res.status).toBe(400);
    });
  });

  // ── 2. Duplicate Protection & Symmetrical Indexing ──────────────────────────
  describe('2. Duplicate Protection & Canonical Symmetrical Indexing', () => {
    it('returns 409 DUPLICATE_CONNECTION_REQUEST with outgoing direction for duplicate same-direction request', async () => {
      const { user: sender, token: senderToken } = await createTestUser({ name: 'Sender' });
      const { user: recipient } = await createTestUser({ name: 'Recipient' });

      const firstRes = await request(app)
        .post('/api/v1/connections')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({ recipientId: recipient._id.toString() });
      expect(firstRes.status).toBe(201);

      const secondRes = await request(app)
        .post('/api/v1/connections')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({ recipientId: recipient._id.toString() });

      expect(secondRes.status).toBe(409);
      expect(secondRes.body.error.code).toBe('DUPLICATE_CONNECTION_REQUEST');
      expect(secondRes.body.error.existingRequest).toBeDefined();
      expect(secondRes.body.error.existingRequest.direction).toBe('outgoing');
      expect(secondRes.body.error.existingRequest.id).toBe(firstRes.body.data.connection._id);
    });

    it('returns 409 DUPLICATE_CONNECTION_REQUEST with incoming direction when target already sent a pending request', async () => {
      const { user: userA, token: tokenA } = await createTestUser({ name: 'User A' });
      const { user: userB, token: tokenB } = await createTestUser({ name: 'User B' });

      // User A sends request to User B
      const resA = await request(app)
        .post('/api/v1/connections')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ recipientId: userB._id.toString() });
      expect(resA.status).toBe(201);

      // User B tries to send request to User A
      const resB = await request(app)
        .post('/api/v1/connections')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ recipientId: userA._id.toString() });

      expect(resB.status).toBe(409);
      expect(resB.body.error.code).toBe('DUPLICATE_CONNECTION_REQUEST');
      expect(resB.body.error.existingRequest).toBeDefined();
      expect(resB.body.error.existingRequest.direction).toBe('incoming');
      expect(resB.body.error.existingRequest.id).toBe(resA.body.data.connection._id);
    });

    it('returns 409 if users are already accepted connections', async () => {
      const { user: userA, token: tokenA } = await createTestUser();
      const { user: userB, token: tokenB } = await createTestUser();

      const { participantA, participantB } = ConnectionRequest.getCanonicalParticipants(userA._id, userB._id);
      await ConnectionRequest.create({
        requester: userA._id,
        recipient: userB._id,
        participantA,
        participantB,
        status: 'accepted',
      });

      const res = await request(app)
        .post('/api/v1/connections')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ recipientId: userA._id.toString() });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_CONNECTION_REQUEST');
    });

    it('verifies mongo level duplicate index prevents dual active records', async () => {
      const { user: userA } = await createTestUser();
      const { user: userB } = await createTestUser();

      const { participantA, participantB } = ConnectionRequest.getCanonicalParticipants(userA._id, userB._id);

      await ConnectionRequest.create({
        requester: userA._id,
        recipient: userB._id,
        participantA,
        participantB,
        status: 'pending',
      });

      let err: any;
      try {
        await ConnectionRequest.create({
          requester: userB._id,
          recipient: userA._id,
          participantA,
          participantB,
          status: 'pending',
        });
      } catch (e) {
        err = e;
      }
      expect(err).toBeDefined();
      expect(err.code).toBe(11000);
    });
  });

  // ── 3. Status Transitions & Authorization ──────────────────────────────────
  describe('3. Status Transitions (Accept, Decline, Withdraw, Remove)', () => {
    it('allows recipient to accept pending request and creates notification', async () => {
      const { user: sender } = await createTestUser({ name: 'Sender User' });
      const { user: recipient, token: recipientToken } = await createTestUser({ name: 'Recipient User' });

      const { participantA, participantB } = ConnectionRequest.getCanonicalParticipants(sender._id, recipient._id);
      const reqDoc = await ConnectionRequest.create({
        requester: sender._id,
        recipient: recipient._id,
        participantA,
        participantB,
        status: 'pending',
      });

      const res = await request(app)
        .patch(`/api/v1/connections/${reqDoc._id}/status`)
        .set('Authorization', `Bearer ${recipientToken}`)
        .send({ status: 'accepted' });

      expect(res.status).toBe(200);
      expect(res.body.data.connection.status).toBe('accepted');

      const notif = await Notification.findOne({
        recipient: sender._id,
        type: 'connection_request_accepted',
      });
      expect(notif).toBeDefined();
      expect(notif!.actor?.toString()).toBe(recipient._id.toString());
    });

    it('allows recipient to reject pending request and creates notification', async () => {
      const { user: sender } = await createTestUser();
      const { user: recipient, token: recipientToken } = await createTestUser();

      const { participantA, participantB } = ConnectionRequest.getCanonicalParticipants(sender._id, recipient._id);
      const reqDoc = await ConnectionRequest.create({
        requester: sender._id,
        recipient: recipient._id,
        participantA,
        participantB,
        status: 'pending',
      });

      const res = await request(app)
        .patch(`/api/v1/connections/${reqDoc._id}/status`)
        .set('Authorization', `Bearer ${recipientToken}`)
        .send({ status: 'rejected' });

      expect(res.status).toBe(200);
      expect(res.body.data.connection.status).toBe('rejected');

      const notif = await Notification.findOne({
        recipient: sender._id,
        type: 'connection_request_rejected',
      });
      expect(notif).toBeDefined();
    });

    it('hides existence with 404 if sender tries to accept/reject request', async () => {
      const { user: sender, token: senderToken } = await createTestUser();
      const { user: recipient } = await createTestUser();

      const { participantA, participantB } = ConnectionRequest.getCanonicalParticipants(sender._id, recipient._id);
      const reqDoc = await ConnectionRequest.create({
        requester: sender._id,
        recipient: recipient._id,
        participantA,
        participantB,
        status: 'pending',
      });

      const res = await request(app)
        .patch(`/api/v1/connections/${reqDoc._id}/status`)
        .set('Authorization', `Bearer ${senderToken}`)
        .send({ status: 'accepted' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('CONNECTION_NOT_FOUND');
    });

    it('allows requester to withdraw pending request with NO notification created', async () => {
      const { user: sender, token: senderToken } = await createTestUser();
      const { user: recipient } = await createTestUser();

      const { participantA, participantB } = ConnectionRequest.getCanonicalParticipants(sender._id, recipient._id);
      const reqDoc = await ConnectionRequest.create({
        requester: sender._id,
        recipient: recipient._id,
        participantA,
        participantB,
        status: 'pending',
      });

      const res = await request(app)
        .patch(`/api/v1/connections/${reqDoc._id}/withdraw`)
        .set('Authorization', `Bearer ${senderToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.connection.status).toBe('withdrawn');

      // Verify deliberately NO notification was sent to recipient
      const notifs = await Notification.find({ recipient: recipient._id });
      expect(notifs.length).toBe(0);
    });

    it('hides existence with 404 if recipient tries to withdraw sender request', async () => {
      const { user: sender } = await createTestUser();
      const { user: recipient, token: recipientToken } = await createTestUser();

      const { participantA, participantB } = ConnectionRequest.getCanonicalParticipants(sender._id, recipient._id);
      const reqDoc = await ConnectionRequest.create({
        requester: sender._id,
        recipient: recipient._id,
        participantA,
        participantB,
        status: 'pending',
      });

      const res = await request(app)
        .patch(`/api/v1/connections/${reqDoc._id}/withdraw`)
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('CONNECTION_NOT_FOUND');
    });

    it('allows either participant to remove an accepted connection with NO notification', async () => {
      const { user: userA, token: tokenA } = await createTestUser();
      const { user: userB, token: tokenB } = await createTestUser();

      const { participantA, participantB } = ConnectionRequest.getCanonicalParticipants(userA._id, userB._id);
      const connDoc = await ConnectionRequest.create({
        requester: userA._id,
        recipient: userB._id,
        participantA,
        participantB,
        status: 'accepted',
      });

      // User B removes the connection
      const res = await request(app)
        .delete(`/api/v1/connections/${connDoc._id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.data.connection.status).toBe('removed');

      // Verify deliberately NO notification
      const notifsA = await Notification.find({ recipient: userA._id });
      const notifsB = await Notification.find({ recipient: userB._id });
      expect(notifsA.length).toBe(0);
      expect(notifsB.length).toBe(0);
    });

    it('returns 400 INVALID_STATUS_TRANSITION when trying to remove a pending request', async () => {
      const { user: userA, token: tokenA } = await createTestUser();
      const { user: userB } = await createTestUser();

      const { participantA, participantB } = ConnectionRequest.getCanonicalParticipants(userA._id, userB._id);
      const connDoc = await ConnectionRequest.create({
        requester: userA._id,
        recipient: userB._id,
        participantA,
        participantB,
        status: 'pending',
      });

      const res = await request(app)
        .delete(`/api/v1/connections/${connDoc._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('returns 400 INVALID_STATUS_TRANSITION when trying to withdraw an accepted request', async () => {
      const { user: userA, token: tokenA } = await createTestUser();
      const { user: userB } = await createTestUser();

      const { participantA, participantB } = ConnectionRequest.getCanonicalParticipants(userA._id, userB._id);
      const connDoc = await ConnectionRequest.create({
        requester: userA._id,
        recipient: userB._id,
        participantA,
        participantB,
        status: 'accepted',
      });

      const res = await request(app)
        .patch(`/api/v1/connections/${connDoc._id}/withdraw`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });
  });

  // ── 4. Re-Request Behavior ─────────────────────────────────────────────────
  describe('4. Re-Request Behavior After Terminal States', () => {
    it('allows a new connection request after previous was rejected', async () => {
      const { user: userA, token: tokenA } = await createTestUser();
      const { user: userB } = await createTestUser();

      const { participantA, participantB } = ConnectionRequest.getCanonicalParticipants(userA._id, userB._id);
      await ConnectionRequest.create({
        requester: userA._id,
        recipient: userB._id,
        participantA,
        participantB,
        status: 'rejected',
      });

      const res = await request(app)
        .post('/api/v1/connections')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ recipientId: userB._id.toString() });

      expect(res.status).toBe(201);
      expect(res.body.data.connection.status).toBe('pending');
    });

    it('allows a new connection request after previous was withdrawn', async () => {
      const { user: userA, token: tokenA } = await createTestUser();
      const { user: userB, token: tokenB } = await createTestUser();

      const { participantA, participantB } = ConnectionRequest.getCanonicalParticipants(userA._id, userB._id);
      await ConnectionRequest.create({
        requester: userA._id,
        recipient: userB._id,
        participantA,
        participantB,
        status: 'withdrawn',
      });

      // B can now send to A
      const res = await request(app)
        .post('/api/v1/connections')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ recipientId: userA._id.toString() });

      expect(res.status).toBe(201);
      expect(res.body.data.connection.status).toBe('pending');
    });

    it('allows a new connection request after previous connection was removed', async () => {
      const { user: userA, token: tokenA } = await createTestUser();
      const { user: userB } = await createTestUser();

      const { participantA, participantB } = ConnectionRequest.getCanonicalParticipants(userA._id, userB._id);
      await ConnectionRequest.create({
        requester: userA._id,
        recipient: userB._id,
        participantA,
        participantB,
        status: 'removed',
      });

      const res = await request(app)
        .post('/api/v1/connections')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ recipientId: userB._id.toString() });

      expect(res.status).toBe(201);
      expect(res.body.data.connection.status).toBe('pending');
    });
  });

  // ── 5. Existence Hiding & Status Probing Protection ─────────────────────────
  describe('5. Existence Hiding & Status Probing Protection', () => {
    it('returns 404 for non-existent requestId or non-participant access on PATCH/DELETE', async () => {
      const { token } = await createTestUser();
      const fakeId = new mongoose.Types.ObjectId().toString();

      const patchRes = await request(app)
        .patch(`/api/v1/connections/${fakeId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'accepted' });
      expect(patchRes.status).toBe(404);
      expect(patchRes.body.error.code).toBe('CONNECTION_NOT_FOUND');

      const delRes = await request(app)
        .delete(`/api/v1/connections/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(delRes.status).toBe(404);
      expect(delRes.body.error.code).toBe('CONNECTION_NOT_FOUND');
    });

    it('GET /connections/status/:targetUserId returns neutral { status: "none", isConnected: false } for non-existent target', async () => {
      const { token } = await createTestUser();
      const fakeUserId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .get(`/api/v1/connections/status/${fakeUserId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ status: 'none', isConnected: false });
    });

    it('GET /connections/status/:targetUserId returns neutral { status: "none", isConnected: false } for suspended target', async () => {
      const { token } = await createTestUser();
      const { user: suspendedUser } = await createTestUser({ accountStatus: 'suspended' });

      const res = await request(app)
        .get(`/api/v1/connections/status/${suspendedUser._id.toString()}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ status: 'none', isConnected: false });
    });

    it('GET /connections/status/:targetUserId returns connection details for active pending/accepted connection', async () => {
      const { user: userA, token: tokenA } = await createTestUser();
      const { user: userB, token: tokenB } = await createTestUser();

      const { participantA, participantB } = ConnectionRequest.getCanonicalParticipants(userA._id, userB._id);
      const conn = await ConnectionRequest.create({
        requester: userA._id,
        recipient: userB._id,
        participantA,
        participantB,
        status: 'pending',
      });

      // Caller is requester (userA)
      const resA = await request(app)
        .get(`/api/v1/connections/status/${userB._id.toString()}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(resA.status).toBe(200);
      expect(resA.body.data.status).toBe('pending');
      expect(resA.body.data.isConnected).toBe(false);
      expect(resA.body.data.isSender).toBe(true);
      expect(resA.body.data.direction).toBe('outgoing');
      expect(resA.body.data.requestId).toBe(conn._id.toString());

      // Caller is recipient (userB)
      const resB = await request(app)
        .get(`/api/v1/connections/status/${userA._id.toString()}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(resB.status).toBe(200);
      expect(resB.body.data.status).toBe('pending');
      expect(resB.body.data.isConnected).toBe(false);
      expect(resB.body.data.isSender).toBe(false);
      expect(resB.body.data.direction).toBe('incoming');
      expect(resB.body.data.requestId).toBe(conn._id.toString());
    });
  });

  // ── 6. Query Lists (Inbox & Network) ───────────────────────────────────────
  describe('6. Query Lists (GET /connections & GET /connections/pending)', () => {
    it('GET /connections returns only accepted connections with safe snapshot fields', async () => {
      const { user: me, token } = await createTestUser({ name: 'Me' });
      const { user: buddy1 } = await createTestUser({ name: 'Buddy One', company: 'Google' });
      const { user: buddy2 } = await createTestUser({ name: 'Buddy Two', company: 'Amazon' });
      const { user: pendingUser } = await createTestUser({ name: 'Pending User' });

      const p1 = ConnectionRequest.getCanonicalParticipants(me._id, buddy1._id);
      await ConnectionRequest.create({
        requester: me._id,
        recipient: buddy1._id,
        participantA: p1.participantA,
        participantB: p1.participantB,
        status: 'accepted',
      });

      const p2 = ConnectionRequest.getCanonicalParticipants(buddy2._id, me._id);
      await ConnectionRequest.create({
        requester: buddy2._id,
        recipient: me._id,
        participantA: p2.participantA,
        participantB: p2.participantB,
        status: 'accepted',
      });

      const p3 = ConnectionRequest.getCanonicalParticipants(me._id, pendingUser._id);
      await ConnectionRequest.create({
        requester: me._id,
        recipient: pendingUser._id,
        participantA: p3.participantA,
        participantB: p3.participantB,
        status: 'pending',
      });

      const res = await request(app)
        .get('/api/v1/connections')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(2);
      expect(res.body.data.items.length).toBe(2);
      expect(res.body.data.items[0].connectedUser.name).toBeDefined();
      expect(res.body.data.items[0].connectedUser.passwordHash).toBeUndefined();
    });

    it('GET /connections/pending returns two separate arrays: received and sent', async () => {
      const { user: me, token } = await createTestUser({ name: 'Me' });
      const { user: userFrom } = await createTestUser({ name: 'Sender Guy' });
      const { user: userTo } = await createTestUser({ name: 'Target Gal' });

      // Received pending
      const p1 = ConnectionRequest.getCanonicalParticipants(userFrom._id, me._id);
      await ConnectionRequest.create({
        requester: userFrom._id,
        recipient: me._id,
        participantA: p1.participantA,
        participantB: p1.participantB,
        status: 'pending',
        message: 'Let us connect!',
      });

      // Sent pending
      const p2 = ConnectionRequest.getCanonicalParticipants(me._id, userTo._id);
      await ConnectionRequest.create({
        requester: me._id,
        recipient: userTo._id,
        participantA: p2.participantA,
        participantB: p2.participantB,
        status: 'pending',
        message: 'Hello!',
      });

      const res = await request(app)
        .get('/api/v1/connections/pending')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.received).toBeDefined();
      expect(res.body.data.sent).toBeDefined();
      expect(res.body.data.received.length).toBe(1);
      expect(res.body.data.sent.length).toBe(1);
      expect(res.body.data.received[0].requester.name).toBe('Sender Guy');
      expect(res.body.data.sent[0].recipient.name).toBe('Target Gal');
    });
  });

  // ── 7. Messaging Integration & Eligibility ─────────────────────────────────
  describe('7. Messaging Integration & Eligibility', () => {
    it('allows messaging between accepted connection partners', async () => {
      const { user: userA, token: tokenA } = await createTestUser({ name: 'User A', role: 'student' });
      const { user: userB } = await createTestUser({ name: 'User B', role: 'alumni' });

      // Create accepted connection
      const p = ConnectionRequest.getCanonicalParticipants(userA._id, userB._id);
      await ConnectionRequest.create({
        requester: userA._id,
        recipient: userB._id,
        participantA: p.participantA,
        participantB: p.participantB,
        status: 'accepted',
      });

      // Check getEligibleContacts includes userB
      const eligibleRes = await request(app)
        .get('/api/v1/messaging/eligible-contacts')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(eligibleRes.status).toBe(200);
      expect(eligibleRes.body.data.items.length).toBe(1);
      const eligibleId = eligibleRes.body.data.items[0]._id || eligibleRes.body.data.items[0].id;
      expect(eligibleId).toBe(userB._id.toString());

      // Create conversation
      const convRes = await request(app)
        .post('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ recipientId: userB._id.toString() });

      expect(convRes.status).toBe(201);
      expect(convRes.body.data.conversation).toBeDefined();
    });

    it('rejects starting conversation if only pending/rejected/removed connection exists', async () => {
      const { user: userA, token: tokenA } = await createTestUser({ name: 'User A', role: 'student' });
      const { user: userB } = await createTestUser({ name: 'User B', role: 'alumni' });

      // Create pending connection
      const p = ConnectionRequest.getCanonicalParticipants(userA._id, userB._id);
      await ConnectionRequest.create({
        requester: userA._id,
        recipient: userB._id,
        participantA: p.participantA,
        participantB: p.participantB,
        status: 'pending',
      });

      const convRes = await request(app)
        .post('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ recipientId: userB._id.toString() });

      expect(convRes.status).toBe(403);
      expect(convRes.body.error.code).toBe('NOT_MESSAGING_ELIGIBLE');
    });

    it('allows continuing existing conversation after connection removal, but blocks creating new one', async () => {
      const { user: userA, token: tokenA } = await createTestUser({ name: 'User A', role: 'student' });
      const { user: userB, token: tokenB } = await createTestUser({ name: 'User B', role: 'alumni' });

      // 1. Establish accepted connection
      const p = ConnectionRequest.getCanonicalParticipants(userA._id, userB._id);
      const conn = await ConnectionRequest.create({
        requester: userA._id,
        recipient: userB._id,
        participantA: p.participantA,
        participantB: p.participantB,
        status: 'accepted',
      });

      // 2. Create conversation while connected
      const convRes = await request(app)
        .post('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ recipientId: userB._id.toString() });
      expect(convRes.status).toBe(201);
      const convId = convRes.body.data.conversation._id || convRes.body.data.conversation.id;

      // 3. Remove connection
      await request(app)
        .delete(`/api/v1/connections/${conn._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      // 4. Send message in the pre-existing conversation -> still succeeds (per §12)
      const msgRes = await request(app)
        .post(`/api/v1/messaging/conversations/${convId}/messages`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ content: 'Hello after removal!' });

      expect(msgRes.status).toBe(201);
      expect(msgRes.body.data.message.content).toBe('Hello after removal!');

      // 5. Delete conversation document to simulate attempting to create a NEW conversation after removal
      await Conversation.deleteMany({});

      const newConvRes = await request(app)
        .post('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ recipientId: userB._id.toString() });

      expect(newConvRes.status).toBe(403);
      expect(newConvRes.body.error.code).toBe('NOT_MESSAGING_ELIGIBLE');
    });
  });
});
