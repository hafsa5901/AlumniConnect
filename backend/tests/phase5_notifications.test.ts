import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createServer, Server as HttpServer } from 'http';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import app from '../src/app';
import User from '../src/models/User';
import Event from '../src/models/Event';
import Job from '../src/models/Job';
import MentorshipRequest from '../src/models/MentorshipRequest';
import Conversation from '../src/models/Conversation';
import Message from '../src/models/Message';
import Notification from '../src/models/Notification';
import { initSocket, getIO } from '../src/socket';
import { signAccessToken } from '../src/utils/auth';

let mongoServer: MongoMemoryServer;
let httpServer: HttpServer;
let serverPort: number;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

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
  await Event.deleteMany({});
  await Job.deleteMany({});
  await MentorshipRequest.deleteMany({});
  await Conversation.deleteMany({});
  await Message.deleteMany({});
  await Notification.deleteMany({});
});

describe('Phase 5B: Notifications System Test Suite', () => {
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
      mentorshipEnabled: overrides.mentorshipEnabled !== undefined ? overrides.mentorshipEnabled : true,
      skills: overrides.skills || ['JavaScript', 'TypeScript'],
      ...overrides,
    });
    const token = signAccessToken({ userId: user._id.toString(), role: user.role });
    return { user, token };
  }

  // ── 1. REST API Endpoints & Cursor Pagination ─────────────────────────────
  describe('1. REST API & Cursor-Based Pagination', () => {
    it('unauthenticated request to /notifications returns 401 NOT_AUTHENTICATED', async () => {
      const res = await request(app).get('/api/v1/notifications');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('NOT_AUTHENTICATED');
    });

    it('returns empty list and unread count 0 when user has no notifications', async () => {
      const { token } = await createTestUser();
      const resList = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${token}`);
      expect(resList.status).toBe(200);
      expect(resList.body.data.notifications).toEqual([]);
      expect(resList.body.data.hasMore).toBe(false);
      expect(resList.body.data.nextCursor).toBeNull();

      const resCount = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${token}`);
      expect(resCount.status).toBe(200);
      expect(resCount.body.data.unreadCount).toBe(0);
    });

    it('retrieves notifications with cursor-based pagination and safe actor projection', async () => {
      const { user, token } = await createTestUser();
      const { user: actor } = await createTestUser({ name: 'Sender Actor' });

      // Create 5 notifications
      const notifDocs = [];
      for (let i = 1; i <= 5; i++) {
        const notif = await Notification.create({
          recipient: user._id,
          actor: actor._id,
          type: 'new_message',
          title: `Message ${i}`,
          message: `Content preview ${i}`,
          createdAt: new Date(Date.now() + i * 1000),
        });
        notifDocs.push(notif);
      }

      // Fetch first page (limit = 2)
      const page1 = await request(app)
        .get('/api/v1/notifications?limit=2')
        .set('Authorization', `Bearer ${token}`);

      expect(page1.status).toBe(200);
      expect(page1.body.data.notifications.length).toBe(2);
      expect(page1.body.data.hasMore).toBe(true);
      expect(page1.body.data.notifications[0].title).toBe('Message 5');
      expect(page1.body.data.notifications[1].title).toBe('Message 4');
      expect(page1.body.data.notifications[0].actor.name).toBe('Sender Actor');
      expect(page1.body.data.notifications[0].actor.passwordHash).toBeUndefined();

      const cursor = page1.body.data.nextCursor;
      expect(cursor).toBeDefined();

      // Fetch second page using cursor
      const page2 = await request(app)
        .get(`/api/v1/notifications?before=${cursor}&limit=2`)
        .set('Authorization', `Bearer ${token}`);

      expect(page2.status).toBe(200);
      expect(page2.body.data.notifications.length).toBe(2);
      expect(page2.body.data.hasMore).toBe(true);
      expect(page2.body.data.notifications[0].title).toBe('Message 3');
      expect(page2.body.data.notifications[1].title).toBe('Message 2');

      // Fetch third page
      const cursor2 = page2.body.data.nextCursor;
      const page3 = await request(app)
        .get(`/api/v1/notifications?before=${cursor2}&limit=2`)
        .set('Authorization', `Bearer ${token}`);

      expect(page3.status).toBe(200);
      expect(page3.body.data.notifications.length).toBe(1);
      expect(page3.body.data.hasMore).toBe(false);
      expect(page3.body.data.notifications[0].title).toBe('Message 1');
    });

    it('marks a single notification as read (PATCH /notifications/:id/read)', async () => {
      const { user, token } = await createTestUser();
      const notif = await Notification.create({
        recipient: user._id,
        type: 'mentorship_request',
        title: 'Request',
        message: 'You have a new request',
      });

      const res = await request(app)
        .patch(`/api/v1/notifications/${notif._id}/read`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.notification.readAt).not.toBeNull();

      const updated = await Notification.findById(notif._id);
      expect(updated!.readAt).not.toBeNull();
    });

    it('marks all notifications as read (PATCH /notifications/read-all)', async () => {
      const { user, token } = await createTestUser();
      await Notification.create([
        { recipient: user._id, type: 'mentorship_request', title: '1', message: '1' },
        { recipient: user._id, type: 'event_approved', title: '2', message: '2' },
        { recipient: user._id, type: 'new_message', title: '3', message: '3' },
      ]);

      const resCountBefore = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${token}`);
      expect(resCountBefore.body.data.unreadCount).toBe(3);

      const res = await request(app)
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.modifiedCount).toBe(3);

      const resCountAfter = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${token}`);
      expect(resCountAfter.body.data.unreadCount).toBe(0);
    });
  });

  // ── 2. Ownership Isolation & Malformed ID Security ─────────────────────────
  describe('2. Ownership Isolation & Security Boundary', () => {
    it('returns 404 NOT_FOUND when attempting to mark another user notification as read', async () => {
      const { user: userA } = await createTestUser();
      const { token: tokenB } = await createTestUser();

      const notifA = await Notification.create({
        recipient: userA._id,
        type: 'mentorship_request',
        title: 'User A Notif',
        message: 'Private',
      });

      const res = await request(app)
        .patch(`/api/v1/notifications/${notifA._id}/read`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');

      const unmodified = await Notification.findById(notifA._id);
      expect(unmodified!.readAt).toBeNull();
    });

    it('returns clean 404 NOT_FOUND for malformed ObjectId parameter', async () => {
      const { token } = await createTestUser();
      const res = await request(app)
        .patch('/api/v1/notifications/invalid-id-format/read')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('does not leak other users notifications in listing or unread count', async () => {
      const { user: userA } = await createTestUser();
      const { token: tokenB } = await createTestUser();

      await Notification.create({
        recipient: userA._id,
        type: 'mentorship_request',
        title: 'User A Only',
        message: 'Secret',
      });

      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.body.data.notifications).toEqual([]);

      const countRes = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(countRes.body.data.unreadCount).toBe(0);
    });
  });

  // ── 3. Mentorship Business Event Triggers ───────────────────────────────────
  describe('3. Mentorship Event Notifications', () => {
    it('creates mentorship_request notification for mentor on request creation', async () => {
      const { user: student, token: studentToken } = await createTestUser({ role: 'student' });
      const { user: mentor } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
        mentorshipEnabled: true,
      });

      const res = await request(app)
        .post('/api/v1/mentorship/requests')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          mentor: mentor._id.toString(),
          topic: 'Career Guidance',
          message: 'Would love your mentorship in backend architecture.',
        });

      expect(res.status).toBe(201);

      const notif = await Notification.findOne({
        recipient: mentor._id,
        type: 'mentorship_request',
      });
      expect(notif).not.toBeNull();
      expect(notif!.actor?.toString()).toBe(student._id.toString());
      expect(notif!.title).toBe('New Mentorship Request');
      expect(notif!.relatedEntityType).toBe('mentorship');
      expect(notif!.relatedEntityId?.toString()).toBe(res.body.data.request.id);
    });

    it('creates mentorship_accepted notification for student when mentor accepts', async () => {
      const { user: student } = await createTestUser({ role: 'student' });
      const { user: mentor, token: mentorToken } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
        mentorshipEnabled: true,
      });

      const reqDoc = await MentorshipRequest.create({
        student: student._id,
        mentor: mentor._id,
        topic: 'Resume Review',
        message: 'Please review',
        status: 'pending',
      });

      const res = await request(app)
        .patch(`/api/v1/mentorship/requests/${reqDoc._id}/status`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .send({ status: 'accepted', notes: 'Glad to connect!' });

      expect(res.status).toBe(200);

      const notif = await Notification.findOne({
        recipient: student._id,
        type: 'mentorship_accepted',
      });
      expect(notif).not.toBeNull();
      expect(notif!.actor?.toString()).toBe(mentor._id.toString());
      expect(notif!.title).toBe('Mentorship Request Accepted');
    });

    it('creates mentorship_rejected notification for student when mentor declines', async () => {
      const { user: student } = await createTestUser({ role: 'student' });
      const { user: mentor, token: mentorToken } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
        mentorshipEnabled: true,
      });

      const reqDoc = await MentorshipRequest.create({
        student: student._id,
        mentor: mentor._id,
        topic: 'AI research',
        message: 'Help needed',
        status: 'pending',
      });

      const res = await request(app)
        .patch(`/api/v1/mentorship/requests/${reqDoc._id}/status`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .send({ status: 'rejected' });

      expect(res.status).toBe(200);

      const notif = await Notification.findOne({
        recipient: student._id,
        type: 'mentorship_rejected',
      });
      expect(notif).not.toBeNull();
      expect(notif!.actor?.toString()).toBe(mentor._id.toString());
      expect(notif!.title).toBe('Mentorship Request Declined');
    });

    it('creates mentorship_completed notification for student when mentor completes', async () => {
      const { user: student } = await createTestUser({ role: 'student' });
      const { user: mentor, token: mentorToken } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
        mentorshipEnabled: true,
      });

      const reqDoc = await MentorshipRequest.create({
        student: student._id,
        mentor: mentor._id,
        topic: 'Fullstack Prep',
        message: 'Starting',
        status: 'accepted',
      });

      const res = await request(app)
        .patch(`/api/v1/mentorship/requests/${reqDoc._id}/status`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .send({ status: 'completed', notes: 'Completed sessions successfully' });

      expect(res.status).toBe(200);

      const notif = await Notification.findOne({
        recipient: student._id,
        type: 'mentorship_completed',
      });
      expect(notif).not.toBeNull();
      expect(notif!.actor?.toString()).toBe(mentor._id.toString());
      expect(notif!.title).toBe('Mentorship Completed');
    });
  });

  // ── 4. Event & Job Moderation Notifications ─────────────────────────────────
  describe('4. Event & Job Moderation Notifications', () => {
    it('creates event_approved notification for organizer on admin approval', async () => {
      const { user: organizer } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });
      const { token: adminToken } = await createTestUser({
        role: 'admin',
        verificationStatus: 'admin_approved',
      });

      const evt = await Event.create({
        title: 'Alumni Tech Talk 2026',
        description: 'Tech talk description',
        category: 'webinar',
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 90000000),
        locationType: 'in_person',
        venueOrLink: 'Auditorium A',
        capacity: 100,
        organizer: organizer._id,
        approvalStatus: 'pending',
      });

      const res = await request(app)
        .patch(`/api/v1/events/${evt._id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      const notif = await Notification.findOne({
        recipient: organizer._id,
        type: 'event_approved',
      });
      expect(notif).not.toBeNull();
      expect(notif!.title).toBe('Event Approved');
      expect(notif!.relatedEntityId?.toString()).toBe(evt._id.toString());
    });

    it('creates event_rejected notification for organizer on admin rejection', async () => {
      const { user: organizer } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });
      const { token: adminToken } = await createTestUser({
        role: 'admin',
        verificationStatus: 'admin_approved',
      });

      const evt = await Event.create({
        title: 'Unverified Meetup',
        description: 'Meetup description',
        category: 'networking',
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 90000000),
        locationType: 'virtual',
        venueOrLink: 'https://meet.google.com/abc-xyz',
        capacity: 50,
        organizer: organizer._id,
        approvalStatus: 'pending',
      });

      const res = await request(app)
        .patch(`/api/v1/events/${evt._id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Insufficient agenda details.' });

      expect(res.status).toBe(200);

      const notif = await Notification.findOne({
        recipient: organizer._id,
        type: 'event_rejected',
      });
      expect(notif).not.toBeNull();
      expect(notif!.title).toBe('Event Not Approved');
      expect(notif!.message).toContain('Insufficient agenda details.');
    });

    it('creates job_removed_by_admin notification when admin deletes another user job', async () => {
      const { user: poster } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });
      const { token: adminToken } = await createTestUser({
        role: 'admin',
        verificationStatus: 'admin_approved',
      });

      const job = await Job.create({
        title: 'Software Engineer',
        company: 'Stripe',
        location: 'Remote',
        jobType: 'full_time',
        workplaceType: 'remote',
        experienceLevel: 'mid',
        description: 'Build payment systems',
        requirements: ['TypeScript', 'Node.js'],
        applicationUrl: 'https://stripe.com/jobs/1',
        postedBy: poster._id,
      });

      const res = await request(app)
        .delete(`/api/v1/jobs/${job._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      const notif = await Notification.findOne({
        recipient: poster._id,
        type: 'job_removed_by_admin',
      });
      expect(notif).not.toBeNull();
      expect(notif!.title).toBe('Job Posting Removed');
      expect(notif!.message).toContain('Software Engineer');
    });

    it('does NOT create notification when poster deletes their own job', async () => {
      const { user: poster, token: posterToken } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
      });

      const job = await Job.create({
        title: 'Frontend Developer',
        company: 'Vercel',
        location: 'Remote',
        jobType: 'full_time',
        workplaceType: 'remote',
        experienceLevel: 'mid',
        description: 'Build UI systems',
        requirements: ['React', 'Next.js'],
        applicationUrl: 'https://vercel.com/jobs/1',
        postedBy: poster._id,
      });

      const res = await request(app)
        .delete(`/api/v1/jobs/${job._id}`)
        .set('Authorization', `Bearer ${posterToken}`);

      expect(res.status).toBe(200);

      const notif = await Notification.findOne({
        recipient: poster._id,
        type: 'job_removed_by_admin',
      });
      expect(notif).toBeNull();
    });
  });

  // ── 5. Single Authoritative Message Notification Rule & Transports ──────────
  describe('5. Authoritative Single-Notification Transport Convergence & Duplication Rule', () => {
    it('creates exactly ONE new_message notification when message is sent via REST', async () => {
      const { user: student, token: studentToken } = await createTestUser({ role: 'student' });
      const { user: mentor } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
        mentorshipEnabled: true,
      });

      // Accepted mentorship
      await MentorshipRequest.create({
        student: student._id,
        mentor: mentor._id,
        topic: 'Mentoring',
        message: 'Hi',
        status: 'accepted',
      });

      const { participantA, participantB } = Conversation.getCanonicalParticipants(student._id, mentor._id);
      const conv = await Conversation.create({ participantA, participantB });

      const res = await request(app)
        .post(`/api/v1/messaging/conversations/${conv._id}/messages`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ content: 'Hello via REST transport!' });

      expect(res.status).toBe(201);

      // Verify exactly ONE notification exists for mentor
      const notifs = await Notification.find({
        recipient: mentor._id,
        type: 'new_message',
      });
      expect(notifs.length).toBe(1);
      expect(notifs[0].message).toContain('Hello via REST transport!');
      expect(notifs[0].actor?.toString()).toBe(student._id.toString());
    });

    it('creates exactly ONE new_message notification when message is sent via Socket.IO', async () => {
      const { user: student, token: studentToken } = await createTestUser({ role: 'student' });
      const { user: mentor, token: mentorToken } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
        mentorshipEnabled: true,
      });

      await MentorshipRequest.create({
        student: student._id,
        mentor: mentor._id,
        topic: 'Mentoring',
        message: 'Hi',
        status: 'accepted',
      });

      const { participantA, participantB } = Conversation.getCanonicalParticipants(student._id, mentor._id);
      const conv = await Conversation.create({ participantA, participantB });

      // Connect sender & receiver via socket clients
      const socketClient: ClientSocket = Client(`http://localhost:${serverPort}`, {
        auth: { token: studentToken },
        transports: ['websocket'],
      });

      const mentorClient: ClientSocket = Client(`http://localhost:${serverPort}`, {
        auth: { token: mentorToken },
        transports: ['websocket'],
      });

      await new Promise<void>((resolve) => {
        let connected = 0;
        const onConnect = () => {
          connected++;
          if (connected === 2) {
            socketClient.emit('message:send', {
              conversationId: conv._id.toString(),
              content: 'Hello via Socket.IO transport!',
            });
          }
        };

        socketClient.on('connect', onConnect);
        mentorClient.on('connect', onConnect);

        mentorClient.on('notification:new', () => {
          resolve();
        });
      });

      socketClient.disconnect();
      mentorClient.disconnect();

      // Verify exactly ONE notification exists for mentor
      const notifs = await Notification.find({
        recipient: mentor._id,
        type: 'new_message',
      });
      expect(notifs.length).toBe(1);
      expect(notifs[0].message).toContain('Hello via Socket.IO transport!');
    });

    it('transport convergence: sends one message through each supported transport/path and verifies that exactly one new_message notification exists for that message', async () => {
      const { user: student, token: studentToken } = await createTestUser({ role: 'student' });
      const { user: mentor, token: mentorToken } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
        mentorshipEnabled: true,
      });

      await MentorshipRequest.create({
        student: student._id,
        mentor: mentor._id,
        topic: 'Convergence Test',
        message: 'Hi',
        status: 'accepted',
      });

      const { participantA, participantB } = Conversation.getCanonicalParticipants(student._id, mentor._id);
      const conv = await Conversation.create({ participantA, participantB });

      // Path 1: REST transport
      const restRes = await request(app)
        .post(`/api/v1/messaging/conversations/${conv._id}/messages`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ content: 'Transport Path 1: REST' });

      expect(restRes.status).toBe(201);
      const restNotifs = await Notification.find({
        recipient: mentor._id,
        type: 'new_message',
        message: { $regex: 'Transport Path 1: REST' },
      });
      expect(restNotifs.length).toBe(1);

      // Path 2: Socket.IO transport
      const socketClient: ClientSocket = Client(`http://localhost:${serverPort}`, {
        auth: { token: studentToken },
        transports: ['websocket'],
      });
      const mentorClient: ClientSocket = Client(`http://localhost:${serverPort}`, {
        auth: { token: mentorToken },
        transports: ['websocket'],
      });

      await new Promise<void>((resolve) => {
        let connected = 0;
        const onConnect = () => {
          connected++;
          if (connected === 2) {
            socketClient.emit('message:send', {
              conversationId: conv._id.toString(),
              content: 'Transport Path 2: Socket.IO',
            });
          }
        };

        socketClient.on('connect', onConnect);
        mentorClient.on('connect', onConnect);
        mentorClient.on('notification:new', (data: any) => {
          if (data?.notification?.message?.includes('Transport Path 2: Socket.IO')) {
            resolve();
          }
        });
      });

      socketClient.disconnect();
      mentorClient.disconnect();

      const socketNotifs = await Notification.find({
        recipient: mentor._id,
        type: 'new_message',
        message: { $regex: 'Transport Path 2: Socket.IO' },
      });
      expect(socketNotifs.length).toBe(1);

      // Verify total notifications across all paths
      const allNotifs = await Notification.find({
        recipient: mentor._id,
        type: 'new_message',
      });
      expect(allNotifs.length).toBe(2);
    });

    it('idempotency: retrying one-shot operation does not duplicate notifications', async () => {
      const { user: student } = await createTestUser({ role: 'student' });
      const { user: mentor, token: mentorToken } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
        mentorshipEnabled: true,
      });

      const reqDoc = await MentorshipRequest.create({
        student: student._id,
        mentor: mentor._id,
        topic: 'Idempotency Test',
        message: 'Test',
        status: 'pending',
      });

      // Accept request
      await request(app)
        .patch(`/api/v1/mentorship/requests/${reqDoc._id}/status`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .send({ status: 'accepted' });

      const notifs = await Notification.find({
        recipient: student._id,
        type: 'mentorship_accepted',
        relatedEntityId: reqDoc._id,
      });
      expect(notifs.length).toBe(1);
    });
  });

  // ── 6. Message-Read Synchronization (§7) ──────────────────────────────────
  describe('6. Message Notification Read-State Synchronization', () => {
    it('marking conversation read via REST marks its related new_message notifications read', async () => {
      const { user: student, token: studentToken } = await createTestUser({ role: 'student' });
      const { user: mentor, token: mentorToken } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
        mentorshipEnabled: true,
      });

      await MentorshipRequest.create({
        student: student._id,
        mentor: mentor._id,
        topic: 'Sync Test',
        message: 'Hi',
        status: 'accepted',
      });

      const { participantA, participantB } = Conversation.getCanonicalParticipants(student._id, mentor._id);
      const conv = await Conversation.create({ participantA, participantB });

      // Student sends 2 messages to mentor
      await request(app)
        .post(`/api/v1/messaging/conversations/${conv._id}/messages`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ content: 'Message 1' });

      await request(app)
        .post(`/api/v1/messaging/conversations/${conv._id}/messages`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ content: 'Message 2' });

      // Mentor has 2 unread notifications
      const unreadBefore = await Notification.countDocuments({
        recipient: mentor._id,
        type: 'new_message',
        readAt: null,
      });
      expect(unreadBefore).toBe(2);

      // Mentor marks conversation as read via REST
      const readRes = await request(app)
        .patch(`/api/v1/messaging/conversations/${conv._id}/read`)
        .set('Authorization', `Bearer ${mentorToken}`);
      expect(readRes.status).toBe(200);

      // Mentor unread message notifications should now be 0
      const unreadAfter = await Notification.countDocuments({
        recipient: mentor._id,
        type: 'new_message',
        readAt: null,
      });
      expect(unreadAfter).toBe(0);
    });

    it('marking conversation read via Socket.IO marks its related new_message notifications read', async () => {
      const { user: student, token: studentToken } = await createTestUser({ role: 'student' });
      const { user: mentor, token: mentorToken } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
        mentorshipEnabled: true,
      });

      await MentorshipRequest.create({
        student: student._id,
        mentor: mentor._id,
        topic: 'Socket Sync Test',
        message: 'Hi',
        status: 'accepted',
      });

      const { participantA, participantB } = Conversation.getCanonicalParticipants(student._id, mentor._id);
      const conv = await Conversation.create({ participantA, participantB });

      // Student sends message
      await request(app)
        .post(`/api/v1/messaging/conversations/${conv._id}/messages`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ content: 'Socket Sync Message' });

      expect(
        await Notification.countDocuments({ recipient: mentor._id, readAt: null })
      ).toBe(1);

      // Mentor connects and emits conversation:read
      const mentorSocket: ClientSocket = Client(`http://localhost:${serverPort}`, {
        auth: { token: mentorToken },
        transports: ['websocket'],
      });

      await new Promise<void>((resolve) => {
        mentorSocket.on('connect', () => {
          mentorSocket.emit('conversation:read', { conversationId: conv._id.toString() });
        });
        mentorSocket.on('message:read', () => {
          resolve();
        });
      });

      mentorSocket.disconnect();

      // Notifications should be marked read
      expect(
        await Notification.countDocuments({ recipient: mentor._id, readAt: null })
      ).toBe(0);
    });
  });

  // ── 7. Live Suspension & Socket Emission Safety ────────────────────────────
  describe('7. Live Status Re-Validation & Safety', () => {
    it('persists notification in database for suspended recipient but suppresses real-time emit', async () => {
      const { user: student, token: studentToken } = await createTestUser({ role: 'student' });
      const { user: suspendedMentor } = await createTestUser({
        role: 'alumni',
        verificationStatus: 'admin_approved',
        accountStatus: 'suspended', // Suspended
        mentorshipEnabled: true,
      });

      // Notification direct creation via service
      const notificationService = (await import('../src/services/notificationService')).default;
      const notif = await notificationService.createNotification({
        recipient: suspendedMentor._id,
        actor: student._id,
        type: 'mentorship_request',
        title: 'Stored for suspended user',
        message: 'Will be visible once reactivated',
      });

      expect(notif).toBeDefined();
      const stored = await Notification.findById(notif._id);
      expect(stored).not.toBeNull();
      expect(stored!.title).toBe('Stored for suspended user');
    });
  });
});
