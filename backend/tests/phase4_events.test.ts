import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app';
import User from '../src/models/User';
import Event from '../src/models/Event';
import { signAccessToken } from '../src/utils/auth';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Event.deleteMany({});
});

describe('Phase 4A: Events & RSVPs Test Suite', () => {
  // Helper to create test users
  async function createTestUser(overrides: any = {}) {
    const user = await User.create({
      name: overrides.name || 'Test User',
      email: overrides.email || `user_${Date.now()}_${Math.random()}@college.edu`,
      passwordHash: 'dummyhash123',
      role: overrides.role || 'alumni',
      accountStatus: overrides.accountStatus || 'active',
      verificationStatus: overrides.verificationStatus || 'admin_approved',
      department: 'Computer Science',
      batch: '2022',
      ...overrides,
    });
    const token = signAccessToken({ userId: user._id.toString(), role: user.role });
    return { user, token };
  }

  describe('1. Event Creation & Role/Verification Guards', () => {
    it('approved alumni can create an event (defaults to pending)', async () => {
      const { user, token } = await createTestUser({ role: 'alumni', verificationStatus: 'admin_approved' });

      const start = new Date(Date.now() + 86400000).toISOString();
      const end = new Date(Date.now() + 90000000).toISOString();

      const res = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Alumni Tech Talk',
          description: 'A deep dive into distributed cloud architectures and scalable design.',
          category: 'webinar',
          startDate: start,
          endDate: end,
          locationType: 'virtual',
          venueOrLink: 'https://zoom.us/j/123456789',
          capacity: 50,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.event.approvalStatus).toBe('pending');
      expect(res.body.data.event.organizer.toString()).toBe(user._id.toString());
      expect(res.body.data.event.capacity).toBe(50);
    });

    it('admin can create an event (defaults to approved immediately)', async () => {
      const { user, token } = await createTestUser({ role: 'admin' });

      const start = new Date(Date.now() + 86400000).toISOString();
      const end = new Date(Date.now() + 90000000).toISOString();

      const res = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Annual Campus Homecoming',
          description: 'Reunion for all department graduates and current students.',
          category: 'reunion',
          startDate: start,
          endDate: end,
          locationType: 'in_person',
          venueOrLink: 'Campus Auditorium',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.event.approvalStatus).toBe('approved');
    });

    it('unverified alumni gets 403 NOT_VERIFIED on event creation', async () => {
      const { token } = await createTestUser({ role: 'alumni', verificationStatus: 'pending' });

      const res = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Unverified Event',
          description: 'This event should not be created.',
          category: 'networking',
          startDate: new Date(Date.now() + 86400000).toISOString(),
          endDate: new Date(Date.now() + 90000000).toISOString(),
          locationType: 'virtual',
          venueOrLink: 'https://zoom.us/j/111',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('NOT_VERIFIED');
    });

    it('student gets 403 FORBIDDEN_ROLE on event creation', async () => {
      const { token } = await createTestUser({ role: 'student', verificationStatus: 'email_verified' });

      const res = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Student Hosted Event',
          description: 'Students cannot create events.',
          category: 'workshop',
          startDate: new Date(Date.now() + 86400000).toISOString(),
          endDate: new Date(Date.now() + 90000000).toISOString(),
          locationType: 'virtual',
          venueOrLink: 'https://zoom.us/j/222',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('organizer cannot be spoofed via request body', async () => {
      const { user, token } = await createTestUser({ role: 'alumni', verificationStatus: 'admin_approved' });
      const fakeOrganizerId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Spoof Test',
          description: 'Testing organizer spoofing prevention.',
          category: 'career',
          startDate: new Date(Date.now() + 86400000).toISOString(),
          endDate: new Date(Date.now() + 90000000).toISOString(),
          locationType: 'virtual',
          venueOrLink: 'https://zoom.us/j/333',
          organizer: fakeOrganizerId,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.event.organizer.toString()).toBe(user._id.toString());
    });
  });

  describe('2. Validation Constraints', () => {
    it('fails when endDate is before startDate', async () => {
      const { token } = await createTestUser({ role: 'admin' });

      const start = new Date(Date.now() + 90000000).toISOString();
      const end = new Date(Date.now() + 86400000).toISOString(); // earlier than start

      const res = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Invalid Date Event',
          description: 'Start date after end date.',
          category: 'workshop',
          startDate: start,
          endDate: end,
          locationType: 'virtual',
          venueOrLink: 'https://zoom.us',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('fails when capacity is non-positive or negative', async () => {
      const { token } = await createTestUser({ role: 'admin' });

      const res = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Invalid Capacity',
          description: 'Capacity is 0.',
          category: 'workshop',
          startDate: new Date(Date.now() + 86400000).toISOString(),
          endDate: new Date(Date.now() + 90000000).toISOString(),
          locationType: 'virtual',
          venueOrLink: 'https://zoom.us',
          capacity: 0,
        });

      expect(res.status).toBe(422);
    });
  });

  describe('3. Visibility & Listing Rules (§3 & §4.1, §4.2)', () => {
    it('approved events are visible to all; pending events excluded for non-owner and returns 404', async () => {
      const { user: organizer, token: orgToken } = await createTestUser({ role: 'alumni' });
      const { user: bystander, token: bystanderToken } = await createTestUser({ role: 'student', verificationStatus: 'email_verified' });
      const { token: adminToken } = await createTestUser({ role: 'admin' });

      // Create 1 approved event and 1 pending event
      const approvedEvt = await Event.create({
        title: 'Public Approved Event',
        description: 'Everyone can see this approved event.',
        category: 'webinar',
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 90000000),
        locationType: 'virtual',
        venueOrLink: 'https://meet.google.com/abc',
        organizer: organizer._id,
        approvalStatus: 'approved',
      });

      const pendingEvt = await Event.create({
        title: 'Secret Pending Event',
        description: 'Only organizer and admin can see this.',
        category: 'workshop',
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 90000000),
        locationType: 'virtual',
        venueOrLink: 'https://meet.google.com/xyz',
        organizer: organizer._id,
        approvalStatus: 'pending',
      });

      // 1. Bystander lists events -> sees only approvedEvt
      const listRes = await request(app)
        .get('/api/v1/events')
        .set('Authorization', `Bearer ${bystanderToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.events.length).toBe(1);
      expect(listRes.body.data.events[0].id).toBe(approvedEvt._id.toString());

      // 2. Bystander tries to view pendingEvt by ID -> 404 (not 403)
      const detailRes = await request(app)
        .get(`/api/v1/events/${pendingEvt._id}`)
        .set('Authorization', `Bearer ${bystanderToken}`);

      expect(detailRes.status).toBe(404);

      // 3. Organizer views pendingEvt by ID -> 200
      const orgDetailRes = await request(app)
        .get(`/api/v1/events/${pendingEvt._id}`)
        .set('Authorization', `Bearer ${orgToken}`);

      expect(orgDetailRes.status).toBe(200);
      expect(orgDetailRes.body.data.event.title).toBe('Secret Pending Event');

      // 4. Admin views pendingEvt by ID -> 200
      const adminDetailRes = await request(app)
        .get(`/api/v1/events/${pendingEvt._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminDetailRes.status).toBe(200);

      // 5. Organizer lists with mine=true -> sees both approved and pending
      const orgListRes = await request(app)
        .get('/api/v1/events?mine=true')
        .set('Authorization', `Bearer ${orgToken}`);

      expect(orgListRes.status).toBe(200);
      expect(orgListRes.body.data.events.length).toBe(2);
    });

    it('filters by category and timeframe (upcoming vs past)', async () => {
      const { token } = await createTestUser({ role: 'student', verificationStatus: 'email_verified' });
      const { user: organizer } = await createTestUser({ role: 'admin' });

      // Past event
      await Event.create({
        title: 'Past Workshop',
        description: 'This happened yesterday.',
        category: 'workshop',
        startDate: new Date(Date.now() - 172800000),
        endDate: new Date(Date.now() - 86400000),
        locationType: 'virtual',
        venueOrLink: 'https://meet.com/past',
        organizer: organizer._id,
        approvalStatus: 'approved',
      });

      // Upcoming career event
      await Event.create({
        title: 'Future Career Fair',
        description: 'Happening next week.',
        category: 'career',
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 172800000),
        locationType: 'in_person',
        venueOrLink: 'Main Hall',
        organizer: organizer._id,
        approvalStatus: 'approved',
      });

      // Query upcoming
      const upRes = await request(app)
        .get('/api/v1/events?timeframe=upcoming')
        .set('Authorization', `Bearer ${token}`);
      expect(upRes.body.data.events.length).toBe(1);
      expect(upRes.body.data.events[0].title).toBe('Future Career Fair');

      // Query past
      const pastRes = await request(app)
        .get('/api/v1/events?timeframe=past')
        .set('Authorization', `Bearer ${token}`);
      expect(pastRes.body.data.events.length).toBe(1);
      expect(pastRes.body.data.events[0].title).toBe('Past Workshop');

      // Query category
      const catRes = await request(app)
        .get('/api/v1/events?category=career')
        .set('Authorization', `Bearer ${token}`);
      expect(catRes.body.data.events.length).toBe(1);
      expect(catRes.body.data.events[0].title).toBe('Future Career Fair');
    });
  });

  describe('4. Attendees Endpoint (§4.3)', () => {
    it('organizer and admin can view attendee list; other users get 403', async () => {
      const { user: organizer, token: orgToken } = await createTestUser({ role: 'alumni' });
      const { user: attendee, token: attToken } = await createTestUser({ role: 'student', verificationStatus: 'email_verified' });
      const { token: otherAlumniToken } = await createTestUser({ role: 'alumni' });
      const { token: adminToken } = await createTestUser({ role: 'admin' });

      const event = await Event.create({
        title: 'Exclusive Panel',
        description: 'Panel discussion.',
        category: 'career',
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 90000000),
        locationType: 'virtual',
        venueOrLink: 'https://zoom.us',
        organizer: organizer._id,
        approvalStatus: 'approved',
        rsvps: [{ user: attendee._id, status: 'attending', registeredAt: new Date() }],
      });

      // 1. Organizer access -> 200
      const orgRes = await request(app)
        .get(`/api/v1/events/${event._id}/attendees`)
        .set('Authorization', `Bearer ${orgToken}`);
      expect(orgRes.status).toBe(200);
      expect(orgRes.body.data.attendees.length).toBe(1);
      expect(orgRes.body.data.attendees[0].user._id.toString()).toBe(attendee._id.toString());

      // 2. Admin access -> 200
      const adminRes = await request(app)
        .get(`/api/v1/events/${event._id}/attendees`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminRes.status).toBe(200);

      // 3. Other alumni access -> 403
      const otherRes = await request(app)
        .get(`/api/v1/events/${event._id}/attendees`)
        .set('Authorization', `Bearer ${otherAlumniToken}`);
      expect(otherRes.status).toBe(403);
    });
  });

  describe('5. RSVP & Capacity Lifecycle (§4.6 & §4.7)', () => {
    it('allows verified user to RSVP and prevents duplicate active RSVP (409)', async () => {
      const { user: organizer } = await createTestUser({ role: 'admin' });
      const { user, token } = await createTestUser({ role: 'student', verificationStatus: 'email_verified' });

      const event = await Event.create({
        title: 'Cloud Seminar',
        description: 'Seminar description.',
        category: 'webinar',
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 90000000),
        locationType: 'virtual',
        venueOrLink: 'https://zoom.us',
        organizer: organizer._id,
        approvalStatus: 'approved',
        capacity: 10,
        rsvps: [],
      });

      // 1. First RSVP -> 200
      const rsvp1 = await request(app)
        .post(`/api/v1/events/${event._id}/rsvp`)
        .set('Authorization', `Bearer ${token}`);

      expect(rsvp1.status).toBe(200);
      expect(rsvp1.body.data.attendingCount).toBe(1);
      expect(rsvp1.body.data.spotsRemaining).toBe(9);

      // 2. Duplicate RSVP -> 409 DUPLICATE_RSVP
      const rsvp2 = await request(app)
        .post(`/api/v1/events/${event._id}/rsvp`)
        .set('Authorization', `Bearer ${token}`);

      expect(rsvp2.status).toBe(409);
      expect(rsvp2.body.error.code).toBe('DUPLICATE_RSVP');
    });

    it('enforces capacity and returns 409 EVENT_FULL when capacity is reached', async () => {
      const { user: organizer } = await createTestUser({ role: 'admin' });
      const { user: user1, token: token1 } = await createTestUser({ role: 'student', verificationStatus: 'email_verified' });
      const { user: user2, token: token2 } = await createTestUser({ role: 'student', verificationStatus: 'email_verified' });

      const event = await Event.create({
        title: 'Intimate Masterclass',
        description: 'Only 1 spot available.',
        category: 'workshop',
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 90000000),
        locationType: 'virtual',
        venueOrLink: 'https://zoom.us',
        organizer: organizer._id,
        approvalStatus: 'approved',
        capacity: 1, // Only 1 spot
        rsvps: [],
      });

      // User 1 RSVPs -> succeeds
      const res1 = await request(app)
        .post(`/api/v1/events/${event._id}/rsvp`)
        .set('Authorization', `Bearer ${token1}`);
      expect(res1.status).toBe(200);

      // User 2 RSVPs -> 409 EVENT_FULL
      const res2 = await request(app)
        .post(`/api/v1/events/${event._id}/rsvp`)
        .set('Authorization', `Bearer ${token2}`);
      expect(res2.status).toBe(409);
      expect(res2.body.error.code).toBe('EVENT_FULL');
    });

    it('cancelling then re-RSVPing reuses the existing array entry and succeeds', async () => {
      const { user: organizer } = await createTestUser({ role: 'admin' });
      const { user, token } = await createTestUser({ role: 'student', verificationStatus: 'email_verified' });

      const event = await Event.create({
        title: 'Reusable Entry Test',
        description: 'Test cancelling and re-RSVP.',
        category: 'webinar',
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 90000000),
        locationType: 'virtual',
        venueOrLink: 'https://zoom.us',
        organizer: organizer._id,
        approvalStatus: 'approved',
        capacity: 5,
      });

      // 1. RSVP
      await request(app)
        .post(`/api/v1/events/${event._id}/rsvp`)
        .set('Authorization', `Bearer ${token}`);

      // 2. Cancel RSVP
      const cancelRes = await request(app)
        .delete(`/api/v1/events/${event._id}/rsvp`)
        .set('Authorization', `Bearer ${token}`);
      expect(cancelRes.status).toBe(200);

      // 3. Re-RSVP
      const reRsvpRes = await request(app)
        .post(`/api/v1/events/${event._id}/rsvp`)
        .set('Authorization', `Bearer ${token}`);
      expect(reRsvpRes.status).toBe(200);

      // Verify in DB that only 1 array element exists for this user
      const updatedEvent = await Event.findById(event._id);
      expect(updatedEvent!.rsvps.length).toBe(1);
      expect(updatedEvent!.rsvps[0].status).toBe('attending');
    });

    it('cancel with no prior RSVP returns 404 NOT_FOUND', async () => {
      const { user: organizer } = await createTestUser({ role: 'admin' });
      const { token } = await createTestUser({ role: 'student', verificationStatus: 'email_verified' });

      const event = await Event.create({
        title: 'Empty Event',
        description: 'No RSVPs yet.',
        category: 'webinar',
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 90000000),
        locationType: 'virtual',
        venueOrLink: 'https://zoom.us',
        organizer: organizer._id,
        approvalStatus: 'approved',
      });

      const res = await request(app)
        .delete(`/api/v1/events/${event._id}/rsvp`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('rejects RSVP on unapproved event with 403 EVENT_NOT_APPROVED', async () => {
      const { user: organizer } = await createTestUser({ role: 'alumni' });
      const { token } = await createTestUser({ role: 'student', verificationStatus: 'email_verified' });

      const event = await Event.create({
        title: 'Pending Event',
        description: 'Not yet approved.',
        category: 'webinar',
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 90000000),
        locationType: 'virtual',
        venueOrLink: 'https://zoom.us',
        organizer: organizer._id,
        approvalStatus: 'pending',
      });

      const res = await request(app)
        .post(`/api/v1/events/${event._id}/rsvp`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('EVENT_NOT_APPROVED');
    });

    it('rejects RSVP on ended event with 400 EVENT_ENDED', async () => {
      const { user: organizer } = await createTestUser({ role: 'admin' });
      const { token } = await createTestUser({ role: 'student', verificationStatus: 'email_verified' });

      const event = await Event.create({
        title: 'Ended Event',
        description: 'This event ended yesterday.',
        category: 'webinar',
        startDate: new Date(Date.now() - 172800000),
        endDate: new Date(Date.now() - 86400000),
        locationType: 'virtual',
        venueOrLink: 'https://zoom.us',
        organizer: organizer._id,
        approvalStatus: 'approved',
      });

      const res = await request(app)
        .post(`/api/v1/events/${event._id}/rsvp`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('EVENT_ENDED');
    });

    it('unverified user gets 403 NOT_VERIFIED on RSVP', async () => {
      const { user: organizer } = await createTestUser({ role: 'admin' });
      const { token } = await createTestUser({ role: 'alumni', verificationStatus: 'pending' });

      const event = await Event.create({
        title: 'Open Event',
        description: 'Only verified users can RSVP.',
        category: 'webinar',
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 90000000),
        locationType: 'virtual',
        venueOrLink: 'https://zoom.us',
        organizer: organizer._id,
        approvalStatus: 'approved',
      });

      const res = await request(app)
        .post(`/api/v1/events/${event._id}/rsvp`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('NOT_VERIFIED');
    });
  });

  describe('6. Admin Moderation: Approve & Reject (§4.5)', () => {
    it('admin can approve a pending event making it publicly visible', async () => {
      const { user: organizer } = await createTestUser({ role: 'alumni' });
      const { token: adminToken } = await createTestUser({ role: 'admin' });
      const { token: studentToken } = await createTestUser({ role: 'student', verificationStatus: 'email_verified' });

      const event = await Event.create({
        title: 'To Be Approved',
        description: 'Waiting for admin approval.',
        category: 'career',
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 90000000),
        locationType: 'virtual',
        venueOrLink: 'https://zoom.us',
        organizer: organizer._id,
        approvalStatus: 'pending',
      });

      // 1. Approve
      const approveRes = await request(app)
        .patch(`/api/v1/events/${event._id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.event.approvalStatus).toBe('approved');

      // 2. Now visible to student
      const listRes = await request(app)
        .get('/api/v1/events')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(listRes.body.data.events.some((e: any) => e.id === event._id.toString())).toBe(true);
    });

    it('admin can reject an event with a reason and non-admin cannot approve/reject (403)', async () => {
      const { user: organizer, token: orgToken } = await createTestUser({ role: 'alumni' });
      const { token: adminToken } = await createTestUser({ role: 'admin' });

      const event = await Event.create({
        title: 'Spam Event',
        description: 'Inappropriate content.',
        category: 'networking',
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 90000000),
        locationType: 'virtual',
        venueOrLink: 'https://spam.com',
        organizer: organizer._id,
        approvalStatus: 'pending',
      });

      // Non-admin tries to approve -> 403
      const unauthorizedRes = await request(app)
        .patch(`/api/v1/events/${event._id}/approve`)
        .set('Authorization', `Bearer ${orgToken}`);
      expect(unauthorizedRes.status).toBe(403);

      // Admin rejects with reason -> 200
      const rejectRes = await request(app)
        .patch(`/api/v1/events/${event._id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Does not meet university event standards.' });

      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.data.event.approvalStatus).toBe('rejected');
      expect(rejectRes.body.data.event.rejectionReason).toBe('Does not meet university event standards.');
    });
  });
});
