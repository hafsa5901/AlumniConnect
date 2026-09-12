import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createServer, Server as HttpServer } from 'http';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import app from '../src/app';
import User from '../src/models/User';
import Conversation from '../src/models/Conversation';
import Message from '../src/models/Message';
import MentorshipRequest from '../src/models/MentorshipRequest';
import AdminAuditLog from '../src/models/AdminAuditLog';
import { initSocket, getIO } from '../src/socket';
import { signAccessToken } from '../src/utils/auth';

let mongoServer: MongoMemoryServer;
let httpServer: HttpServer;
let serverPort: number;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // Setup HTTP server with Socket.IO for socket integration tests
  httpServer = createServer(app);
  initSocket(httpServer);

  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      const addr = httpServer.address();
      if (addr && typeof addr !== 'string') {
        serverPort = addr.port;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  const io = getIO();
  if (io) {
    io.close();
  }
  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Conversation.deleteMany({});
  await Message.deleteMany({});
  await MentorshipRequest.deleteMany({});
  await AdminAuditLog.deleteMany({});
});

describe('Phase 5A: Real-Time Messaging & Chat Test Suite', () => {
  async function createTestUser(overrides: any = {}) {
    const user = await User.create({
      name: overrides.name || 'Test User',
      email: overrides.email || `user_${Date.now()}_${Math.random()}@college.edu`,
      passwordHash: 'dummyhash123',
      role: overrides.role || 'student',
      accountStatus: overrides.accountStatus || 'active',
      verificationStatus: overrides.verificationStatus || 'email_verified',
      department: overrides.department || 'Computer Science',
      company: overrides.company || 'Tech Corp',
      designation: overrides.designation || 'Engineer',
      batch: overrides.batch || '2024',
      ...overrides,
    });
    const token = signAccessToken({ userId: user._id.toString(), role: user.role });
    return { user, token };
  }

  // ── 1. Eligibility & Conversation Creation ──────────────────────────────
  describe('1. Relationship-Gated Eligibility (POST /api/v1/messaging/conversations)', () => {
    it('unauthenticated request returns 401 NOT_AUTHENTICATED', async () => {
      const res = await request(app).post('/api/v1/messaging/conversations').send({});
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('NOT_AUTHENTICATED');
    });

    it('self-message attempt is rejected with 400 SELF_MESSAGE_FORBIDDEN', async () => {
      const { user, token } = await createTestUser();
      const res = await request(app)
        .post('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({ recipientId: user._id.toString() });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SELF_MESSAGE_FORBIDDEN');
    });

    it('messaging between student & alumni with NO mentorship request returns 403 NOT_MESSAGING_ELIGIBLE', async () => {
      const { token: studentToken } = await createTestUser({ role: 'student' });
      const { user: alumni } = await createTestUser({ role: 'alumni', verificationStatus: 'admin_approved' });

      const res = await request(app)
        .post('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ recipientId: alumni._id.toString() });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('NOT_MESSAGING_ELIGIBLE');
    });

    it('messaging with pending or rejected mentorship request returns 403 NOT_MESSAGING_ELIGIBLE', async () => {
      const { user: student, token: studentToken } = await createTestUser({ role: 'student' });
      const { user: alumni } = await createTestUser({ role: 'alumni', verificationStatus: 'admin_approved' });

      // Create pending request
      const pendingReq = await MentorshipRequest.create({
        student: student._id,
        mentor: alumni._id,
        status: 'pending',
        topic: 'Resume Review',
        message: 'Can you review my resume?',
      });

      let res = await request(app)
        .post('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ recipientId: alumni._id.toString() });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('NOT_MESSAGING_ELIGIBLE');

      // Update to rejected
      pendingReq.status = 'rejected';
      await pendingReq.save();

      res = await request(app)
        .post('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ recipientId: alumni._id.toString() });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('NOT_MESSAGING_ELIGIBLE');
    });

    it('messaging between student & alumni with ACCEPTED mentorship request succeeds in either direction', async () => {
      const { user: student, token: studentToken } = await createTestUser({ role: 'student' });
      const { user: alumni, token: alumniToken } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });

      await MentorshipRequest.create({
        student: student._id,
        mentor: alumni._id,
        status: 'accepted',
        topic: 'Career Transition',
        message: 'Excited to connect!',
      });

      // Student starts conversation
      const res1 = await request(app)
        .post('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ recipientId: alumni._id.toString() });

      expect(res1.status).toBe(201);
      expect(res1.body.data.conversation).toBeDefined();
      expect(res1.body.data.conversation.otherParticipant.id).toBe(alumni._id.toString());

      // Alumni initiates lookup for the same conversation
      const res2 = await request(app)
        .post('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${alumniToken}`)
        .send({ recipientId: student._id.toString() });

      expect(res2.status).toBe(200); // 200 on existing
      expect(res2.body.data.conversation.id).toBe(res1.body.data.conversation.id);
      expect(res2.body.data.conversation.otherParticipant.id).toBe(student._id.toString());
    });

    it('admin can start conversation with ANY active user and logs AdminAuditLog', async () => {
      const { user: admin, token: adminToken } = await createTestUser({ role: 'admin', verificationStatus: 'admin_approved' });
      const { user: student } = await createTestUser({ role: 'student' });

      // No mentorship request exists
      const res = await request(app)
        .post('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ recipientId: student._id.toString() });

      expect(res.status).toBe(201);
      expect(res.body.data.conversation).toBeDefined();

      // Verify AdminAuditLog was written
      const log = await AdminAuditLog.findOne({
        admin: admin._id,
        action: 'admin_initiated_conversation',
        targetId: student._id,
      });
      expect(log).not.toBeNull();
      expect(log!.action).toBe('admin_initiated_conversation');
    });

    it('recipient account inactive or suspended is rejected with 403', async () => {
      const { user: admin, token: adminToken } = await createTestUser({ role: 'admin', verificationStatus: 'admin_approved' });
      const { user: suspendedUser } = await createTestUser({ accountStatus: 'suspended' });

      const res = await request(app)
        .post('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ recipientId: suspendedUser._id.toString() });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('RECIPIENT_INACTIVE');
    });
  });

  // ── 2. Duplicate Prevention & Canonical Ordering ────────────────────────
  describe('2. Canonical Ordering & Duplicate Prevention', () => {
    it('concurrent conversation creation resolves to exactly 1 database document', async () => {
      const { user: userA, token: tokenA } = await createTestUser({ role: 'student' });
      const { user: userB, token: tokenB } = await createTestUser({ role: 'alumni', verificationStatus: 'admin_approved' });

      await MentorshipRequest.create({
        student: userA._id,
        mentor: userB._id,
        status: 'accepted',
        topic: 'Mentorship',
        message: 'Hello',
      });

      // Send 2 concurrent requests
      const [resA, resB] = await Promise.all([
        request(app)
          .post('/api/v1/messaging/conversations')
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ recipientId: userB._id.toString() }),
        request(app)
          .post('/api/v1/messaging/conversations')
          .set('Authorization', `Bearer ${tokenB}`)
          .send({ recipientId: userA._id.toString() }),
      ]);

      expect([200, 201]).toContain(resA.status);
      expect([200, 201]).toContain(resB.status);
      expect(resA.body.data.conversation.id).toBe(resB.body.data.conversation.id);

      const count = await Conversation.countDocuments({});
      expect(count).toBe(1);
    });
  });

  // ── 3. Eligible Contacts Endpoint ───────────────────────────────────────
  describe('3. Eligible Contacts (GET /api/v1/messaging/eligible-contacts)', () => {
    it('returns accepted mentorship counterparts for regular users', async () => {
      const { user: student, token: studentToken } = await createTestUser({ role: 'student' });
      const { user: mentor1 } = await createTestUser({ name: 'Mentor One', role: 'alumni', verificationStatus: 'admin_approved' });
      const { user: mentor2 } = await createTestUser({ name: 'Mentor Two', role: 'alumni', verificationStatus: 'admin_approved' });
      const { user: mentor3 } = await createTestUser({ name: 'Mentor Three (Pending)', role: 'alumni', verificationStatus: 'admin_approved' });

      await MentorshipRequest.create({
        student: student._id,
        mentor: mentor1._id,
        status: 'accepted',
        topic: 'Topic 1',
        message: 'Msg 1',
      });

      await MentorshipRequest.create({
        student: student._id,
        mentor: mentor2._id,
        status: 'accepted',
        topic: 'Topic 2',
        message: 'Msg 2',
      });

      await MentorshipRequest.create({
        student: student._id,
        mentor: mentor3._id,
        status: 'pending',
        topic: 'Topic 3',
        message: 'Msg 3',
      });

      const res = await request(app)
        .get('/api/v1/messaging/eligible-contacts')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isAdmin).toBe(false);
      expect(res.body.data.items.length).toBe(2);
      const names = res.body.data.items.map((i: any) => i.name);
      expect(names).toContain('Mentor One');
      expect(names).toContain('Mentor Two');
      expect(names).not.toContain('Mentor Three (Pending)');
    });

    it('admin eligible-contacts supports server-side search and pagination', async () => {
      const { token: adminToken } = await createTestUser({ role: 'admin', verificationStatus: 'admin_approved' });

      for (let i = 1; i <= 5; i++) {
        await createTestUser({ name: `Searchable Student ${i}`, role: 'student' });
      }

      const res = await request(app)
        .get('/api/v1/messaging/eligible-contacts?search=Searchable&page=1&limit=3')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isAdmin).toBe(true);
      expect(res.body.data.items.length).toBe(3);
      expect(res.body.data.total).toBe(5);
      expect(res.body.data.totalPages).toBe(2);
    });
  });

  // ── 4. Access Control & History Pagination ──────────────────────────────
  describe('4. Access Control & Cursor Pagination (GET /api/v1/messaging/conversations/:id/messages)', () => {
    it('non-participant accessing conversation returns 403 FORBIDDEN_OWNERSHIP', async () => {
      const { user: userA } = await createTestUser({ role: 'student' });
      const { user: userB } = await createTestUser({ role: 'alumni', verificationStatus: 'admin_approved' });
      const { token: outsiderToken } = await createTestUser({ role: 'student' });

      const conv = await Conversation.create({
        participantA: userA._id,
        participantB: userB._id,
      });

      const res = await request(app)
        .get(`/api/v1/messaging/conversations/${conv._id}`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_OWNERSHIP');

      const resMsgs = await request(app)
        .get(`/api/v1/messaging/conversations/${conv._id}/messages`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(resMsgs.status).toBe(403);
      expect(resMsgs.body.error.code).toBe('FORBIDDEN_OWNERSHIP');
    });

    it('malformed conversation id returns 404 NOT_FOUND', async () => {
      const { token } = await createTestUser();
      const res = await request(app)
        .get('/api/v1/messaging/conversations/invalid123')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('cursor pagination (?before=<messageId>&limit=...) returns previous page correctly without skips/duplicates', async () => {
      const { user: userA, token: tokenA } = await createTestUser({ role: 'student' });
      const { user: userB } = await createTestUser({ role: 'alumni', verificationStatus: 'admin_approved' });

      const conv = await Conversation.create({
        participantA: userA._id,
        participantB: userB._id,
      });

      // Create 10 messages
      const createdMessages = [];
      for (let i = 1; i <= 10; i++) {
        const msg = await Message.create({
          conversation: conv._id,
          sender: i % 2 === 0 ? userB._id : userA._id,
          recipient: i % 2 === 0 ? userA._id : userB._id,
          content: `Message ${i}`,
        });
        createdMessages.push(msg);
      }

      // Initial page: limit 4 (most recent messages 7, 8, 9, 10 in chronological order)
      const res1 = await request(app)
        .get(`/api/v1/messaging/conversations/${conv._id}/messages?limit=4`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res1.status).toBe(200);
      expect(res1.body.data.messages.length).toBe(4);
      expect(res1.body.data.hasMore).toBe(true);
      expect(res1.body.data.messages[0].content).toBe('Message 7');
      expect(res1.body.data.messages[3].content).toBe('Message 10');

      const beforeCursor = res1.body.data.nextCursor; // ID of Message 7

      // Next page using before cursor: messages 3, 4, 5, 6
      const res2 = await request(app)
        .get(`/api/v1/messaging/conversations/${conv._id}/messages?before=${beforeCursor}&limit=4`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res2.status).toBe(200);
      expect(res2.body.data.messages.length).toBe(4);
      expect(res2.body.data.hasMore).toBe(true);
      expect(res2.body.data.messages[0].content).toBe('Message 3');
      expect(res2.body.data.messages[3].content).toBe('Message 6');

      const beforeCursor2 = res2.body.data.nextCursor; // ID of Message 3

      // Oldest page using before cursor 2: messages 1, 2
      const res3 = await request(app)
        .get(`/api/v1/messaging/conversations/${conv._id}/messages?before=${beforeCursor2}&limit=4`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res3.status).toBe(200);
      expect(res3.body.data.messages.length).toBe(2);
      expect(res3.body.data.hasMore).toBe(false);
      expect(res3.body.data.messages[0].content).toBe('Message 1');
      expect(res3.body.data.messages[1].content).toBe('Message 2');
    });
  });

  // ── 5. Sending Messages & Read Receipts ──────────────────────────────────
  describe('5. Sending Messages & Read Receipts', () => {
    it('sends message via REST, updates conversation lastMessage, and returns 201', async () => {
      const { user: userA, token: tokenA } = await createTestUser({ role: 'student' });
      const { user: userB } = await createTestUser({ role: 'alumni', verificationStatus: 'admin_approved' });

      const conv = await Conversation.create({
        participantA: userA._id,
        participantB: userB._id,
      });

      const res = await request(app)
        .post(`/api/v1/messaging/conversations/${conv._id}/messages`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ content: 'Hello mentor, are you available tomorrow?' });

      expect(res.status).toBe(201);
      expect(res.body.data.message.content).toBe('Hello mentor, are you available tomorrow?');
      expect(res.body.data.message.sender.id).toBe(userA._id.toString());
      expect(res.body.data.message.recipient.id).toBe(userB._id.toString());

      const updatedConv = await Conversation.findById(conv._id);
      expect(updatedConv!.lastMessage).toBe('Hello mentor, are you available tomorrow?');
      expect(updatedConv!.lastMessageAt).toBeDefined();
    });

    it('rejects empty content and content exceeding 2000 characters with 400 VALIDATION_ERROR', async () => {
      const { user: userA, token: tokenA } = await createTestUser({ role: 'student' });
      const { user: userB } = await createTestUser({ role: 'alumni', verificationStatus: 'admin_approved' });

      const conv = await Conversation.create({
        participantA: userA._id,
        participantB: userB._id,
      });

      const resEmpty = await request(app)
        .post(`/api/v1/messaging/conversations/${conv._id}/messages`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ content: '   ' });

      expect(resEmpty.status).toBe(400);
      expect(resEmpty.body.error.code).toBe('VALIDATION_ERROR');

      const resLong = await request(app)
        .post(`/api/v1/messaging/conversations/${conv._id}/messages`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ content: 'a'.repeat(2001) });

      expect(resLong.status).toBe(400);
      expect(resLong.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('marking conversation read only updates received messages and decrements unread count', async () => {
      const { user: userA, token: tokenA } = await createTestUser({ role: 'student' });
      const { user: userB, token: tokenB } = await createTestUser({ role: 'alumni', verificationStatus: 'admin_approved' });

      const conv = await Conversation.create({
        participantA: userA._id,
        participantB: userB._id,
      });

      // User A sends 2 messages to User B
      await Message.create({
        conversation: conv._id,
        sender: userA._id,
        recipient: userB._id,
        content: 'From A 1',
      });
      await Message.create({
        conversation: conv._id,
        sender: userA._id,
        recipient: userB._id,
        content: 'From A 2',
      });

      // User B sends 1 message to User A
      await Message.create({
        conversation: conv._id,
        sender: userB._id,
        recipient: userA._id,
        content: 'From B 1',
      });

      // Check User B's unread count
      let convListB = await request(app)
        .get('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(convListB.body.data.conversations[0].unreadCount).toBe(2);

      // Check User A's unread count
      let convListA = await request(app)
        .get('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(convListA.body.data.conversations[0].unreadCount).toBe(1);

      // User B marks conversation read
      const readRes = await request(app)
        .patch(`/api/v1/messaging/conversations/${conv._id}/read`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(readRes.status).toBe(200);
      expect(readRes.body.data.modifiedCount).toBe(2);

      // User B unread count is now 0
      convListB = await request(app)
        .get('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(convListB.body.data.conversations[0].unreadCount).toBe(0);

      // User A unread count is STILL 1 (User A hasn't read User B's message)
      convListA = await request(app)
        .get('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(convListA.body.data.conversations[0].unreadCount).toBe(1);
    });
  });

  // ── 6. Socket.IO Real-Time Transport & Live Suspension ──────────────────
  describe('6. Socket.IO Real-Time Handshake & Live Suspension Re-Validation', () => {
    it('socket handshake rejects unauthenticated / invalid token connections', (done) => {
      const client = Client(`http://localhost:${serverPort}`, {
        auth: { token: 'invalid.token.here' },
        transports: ['websocket'],
      });

      client.on('connect_error', (err: any) => {
        expect(err.message).toBe('Authentication failed');
        client.disconnect();
        done();
      });
    });

    it('socket connects with valid JWT and delivers real-time message:send to recipient', async () => {
      const { user: userA, token: tokenA } = await createTestUser({ role: 'student' });
      const { user: userB, token: tokenB } = await createTestUser({ role: 'alumni', verificationStatus: 'admin_approved' });

      const conv = await Conversation.create({
        participantA: userA._id,
        participantB: userB._id,
      });

      const clientA: ClientSocket = Client(`http://localhost:${serverPort}`, {
        auth: { token: tokenA },
        transports: ['websocket'],
      });

      const clientB: ClientSocket = Client(`http://localhost:${serverPort}`, {
        auth: { token: tokenB },
        transports: ['websocket'],
      });

      await new Promise<void>((resolve) => {
        let connected = 0;
        const check = () => {
          connected++;
          if (connected === 2) resolve();
        };
        clientA.on('connect', check);
        clientB.on('connect', check);
      });

      const messagePromise = new Promise<any>((resolve) => {
        clientB.on('message:new', (data: any) => {
          resolve(data);
        });
      });

      clientA.emit('message:send', {
        conversationId: conv._id.toString(),
        content: 'Real-time greetings!',
      });

      const received = await messagePromise;
      expect(received.message.content).toBe('Real-time greetings!');
      const senderId = (received.message.sender?.id || received.message.sender?._id || received.message.sender).toString();
      expect(senderId).toBe(userA._id.toString());

      clientA.disconnect();
      clientB.disconnect();
    });

    it('suspending an active user mid-session immediately rejects their next socket message:send event', async () => {
      const { user: userA, token: tokenA } = await createTestUser({ role: 'student' });
      const { user: userB } = await createTestUser({ role: 'alumni', verificationStatus: 'admin_approved' });

      const conv = await Conversation.create({
        participantA: userA._id,
        participantB: userB._id,
      });

      const clientA: ClientSocket = Client(`http://localhost:${serverPort}`, {
        auth: { token: tokenA },
        transports: ['websocket'],
      });

      await new Promise<void>((resolve) => {
        clientA.on('connect', resolve);
      });

      // User is now suspended in the DB while socket connection remains open
      await User.findByIdAndUpdate(userA._id, { accountStatus: 'suspended' });

      const errorPromise = new Promise<any>((resolve) => {
        clientA.on('messaging:error', (err: any) => {
          resolve(err);
        });
      });

      clientA.emit('message:send', {
        conversationId: conv._id.toString(),
        content: 'This should be blocked',
      });

      const error = await errorPromise;
      expect(error.code).toBe('ACCOUNT_SUSPENDED');

      clientA.disconnect();
    });

    it('offline recipient retrieves messages later via REST history with zero loss', async () => {
      const { user: sender, token: senderToken } = await createTestUser({ role: 'student' });
      const { user: offlineRecipient, token: recipientToken } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });

      const conv = await Conversation.create({
        participantA: sender._id,
        participantB: offlineRecipient._id,
      });

      // Sender sends message while recipient is offline
      await request(app)
        .post(`/api/v1/messaging/conversations/${conv._id}/messages`)
        .set('Authorization', `Bearer ${senderToken}`)
        .send({ content: 'Message sent while you were offline' });

      // Recipient comes online and fetches message history via REST
      const res = await request(app)
        .get(`/api/v1/messaging/conversations/${conv._id}/messages`)
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.messages.length).toBe(1);
      expect(res.body.data.messages[0].content).toBe('Message sent while you were offline');
    });
  });
});
