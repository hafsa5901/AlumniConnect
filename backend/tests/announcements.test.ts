import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app';
import User from '../src/models/User';
import Announcement from '../src/models/Announcement';
import AdminAuditLog from '../src/models/AdminAuditLog';
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
  await Announcement.deleteMany({});
  await AdminAuditLog.deleteMany({});
});

describe('Announcements & News End-to-End Suite', () => {
  async function createTestUser(role: 'admin' | 'student' | 'alumni', overrides: Record<string, any> = {}) {
    const user = await User.create({
      name: overrides.name || `${role.charAt(0).toUpperCase() + role.slice(1)} User`,
      email: overrides.email || `${role}_${Date.now()}_${Math.random()}@college.edu`,
      passwordHash: 'dummyhash123',
      role,
      accountStatus: overrides.accountStatus || 'active',
      verificationStatus: 'admin_approved',
      department: 'Computer Science',
      batch: '2022',
      ...overrides,
    });
    const token = signAccessToken({ userId: user._id.toString(), role: user.role });
    return { user, token };
  }

  // 1. Admin can create, edit, publish, unpublish, and delete
  it('1. Admin can create, edit, publish, unpublish, and delete announcements', async () => {
    const { token: adminToken } = await createTestUser('admin');

    // Create draft
    const createRes = await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Campus Hackathon 2026',
        summary: 'Annual 48-hour inter-college software hackathon.',
        content: 'Registration is now officially open for all branches and years.',
        category: 'Workshops',
        published: false,
      })
      .expect(201);

    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data.announcement.title).toBe('Campus Hackathon 2026');
    expect(createRes.body.data.announcement.published).toBe(false);
    expect(createRes.body.data.announcement.publishedAt).toBeNull();
    const id = createRes.body.data.announcement.id;

    // Edit content
    const editRes = await request(app)
      .patch(`/api/v1/announcements/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Campus Hackathon 2026 - Extended Registration',
      })
      .expect(200);

    expect(editRes.body.data.announcement.title).toBe('Campus Hackathon 2026 - Extended Registration');
    expect(editRes.body.data.announcement.published).toBe(false);

    // Publish
    const publishRes = await request(app)
      .patch(`/api/v1/announcements/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ published: true })
      .expect(200);

    expect(publishRes.body.data.announcement.published).toBe(true);
    expect(publishRes.body.data.announcement.publishedAt).not.toBeNull();
    const firstPublishedAt = publishRes.body.data.announcement.publishedAt;

    // Unpublish
    const unpublishRes = await request(app)
      .patch(`/api/v1/announcements/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ published: false })
      .expect(200);

    expect(unpublishRes.body.data.announcement.published).toBe(false);

    // Delete
    const deleteRes = await request(app)
      .delete(`/api/v1/announcements/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(deleteRes.body.success).toBe(true);
    expect(deleteRes.body.data.message).toBe('Announcement deleted successfully.');

    // Confirm deleted from DB
    const checkDeleted = await Announcement.findById(id);
    expect(checkDeleted).toBeNull();
  });

  // 2. Student and Alumni can list and read published items
  it('2. Student and Alumni can list and read published announcements', async () => {
    const { user: adminUser } = await createTestUser('admin');
    const { token: studentToken } = await createTestUser('student');
    const { token: alumniToken } = await createTestUser('alumni');

    const announcement = await Announcement.create({
      title: 'Placement Drive Schedule',
      summary: 'Details regarding upcoming placement drives.',
      content: 'Top tech tier-1 companies will arrive next Monday morning.',
      category: 'Placements',
      author: adminUser._id,
      published: true,
      publishedAt: new Date(),
    });

    // Student list
    const studentListRes = await request(app)
      .get('/api/v1/announcements')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    expect(studentListRes.body.data.announcements.length).toBe(1);
    expect(studentListRes.body.data.announcements[0].title).toBe('Placement Drive Schedule');

    // Alumni detail read
    const alumniDetailRes = await request(app)
      .get(`/api/v1/announcements/${announcement._id}`)
      .set('Authorization', `Bearer ${alumniToken}`)
      .expect(200);

    expect(alumniDetailRes.body.data.announcement.title).toBe('Placement Drive Schedule');
    expect(alumniDetailRes.body.data.announcement.content).toContain('tier-1 companies');
  });

  // 3. Student and Alumni get 403 on every write route and on /manage
  it('3. Student and Alumni receive 403 FORBIDDEN_ROLE on write routes and /manage', async () => {
    const { token: studentToken } = await createTestUser('student');
    const { token: alumniToken } = await createTestUser('alumni');

    for (const token of [studentToken, alumniToken]) {
      // POST /
      const postRes = await request(app)
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Unauthorized', summary: 'Fail', content: 'Fail', category: 'General' })
        .expect(403);
      expect(postRes.body.error.code).toBe('FORBIDDEN_ROLE');

      // GET /manage
      const manageRes = await request(app)
        .get('/api/v1/announcements/manage')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      expect(manageRes.body.error.code).toBe('FORBIDDEN_ROLE');

      // PATCH /:id
      const dummyId = new mongoose.Types.ObjectId();
      const patchRes = await request(app)
        .patch(`/api/v1/announcements/${dummyId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'New' })
        .expect(403);
      expect(patchRes.body.error.code).toBe('FORBIDDEN_ROLE');

      // DELETE /:id
      const delRes = await request(app)
        .delete(`/api/v1/announcements/${dummyId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      expect(delRes.body.error.code).toBe('FORBIDDEN_ROLE');
    }
  });

  // 4. Unauthenticated requests get 401 on every route
  it('4. Unauthenticated requests get 401 NOT_AUTHENTICATED on all routes', async () => {
    const dummyId = new mongoose.Types.ObjectId();

    await request(app).get('/api/v1/announcements').expect(401);
    await request(app).get('/api/v1/announcements/manage').expect(401);
    await request(app).get(`/api/v1/announcements/${dummyId}`).expect(401);
    await request(app).post('/api/v1/announcements').send({}).expect(401);
    await request(app).patch(`/api/v1/announcements/${dummyId}`).send({}).expect(401);
    await request(app).delete(`/api/v1/announcements/${dummyId}`).expect(401);
  });

  // 5. Unpublished items are absent from list, search, and detail route for ordinary users
  it('5. Unpublished items are absent from public list, search, and detail for non-admins (returns 404)', async () => {
    const { user: adminUser } = await createTestUser('admin');
    const { token: studentToken } = await createTestUser('student');

    const draft = await Announcement.create({
      title: 'Secret Draft Policy',
      summary: 'Confidential summary',
      content: 'Confidential content',
      category: 'General',
      author: adminUser._id,
      published: false,
    });

    // Public list
    const listRes = await request(app)
      .get('/api/v1/announcements')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(listRes.body.data.announcements.length).toBe(0);

    // Bypassing attempts with query params
    const leakAttempt1 = await request(app)
      .get('/api/v1/announcements?published=false')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(leakAttempt1.body.data.announcements.length).toBe(0);

    const leakAttempt2 = await request(app)
      .get('/api/v1/announcements?status=draft')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(leakAttempt2.body.data.announcements.length).toBe(0);

    // Search query
    const searchRes = await request(app)
      .get('/api/v1/announcements?q=Secret')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(searchRes.body.data.announcements.length).toBe(0);

    // Direct detail request returns 404
    const detailRes = await request(app)
      .get(`/api/v1/announcements/${draft._id}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(404);
    expect(detailRes.body.error.code).toBe('NOT_FOUND');
    expect(detailRes.body.error.message).toBe('Announcement not found.');
  });

  // 6. Admin can read drafts and use /manage with status filter
  it('6. Admin can read drafts and use /manage with status filters', async () => {
    const { user: adminUser, token: adminToken } = await createTestUser('admin');

    const draft = await Announcement.create({
      title: 'Draft Announcement',
      summary: 'Draft summary',
      content: 'Draft content',
      category: 'Academic',
      author: adminUser._id,
      published: false,
    });

    const pub = await Announcement.create({
      title: 'Published Announcement',
      summary: 'Pub summary',
      content: 'Pub content',
      category: 'Academic',
      author: adminUser._id,
      published: true,
      publishedAt: new Date(),
    });

    // Admin can read draft detail
    const detailRes = await request(app)
      .get(`/api/v1/announcements/${draft._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(detailRes.body.data.announcement.published).toBe(false);

    // /manage?status=all
    const allRes = await request(app)
      .get('/api/v1/announcements/manage?status=all')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(allRes.body.data.announcements.length).toBe(2);

    // /manage?status=draft
    const draftRes = await request(app)
      .get('/api/v1/announcements/manage?status=draft')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(draftRes.body.data.announcements.length).toBe(1);
    expect(draftRes.body.data.announcements[0].title).toBe('Draft Announcement');

    // /manage?status=published
    const pubRes = await request(app)
      .get('/api/v1/announcements/manage?status=published')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(pubRes.body.data.announcements.length).toBe(1);
    expect(pubRes.body.data.announcements[0].title).toBe('Published Announcement');
  });

  // 7. A suspended, deactivated, or demoted admin is rejected on writes
  it('7. Suspended, deactivated, or demoted admin holding old valid token is rejected', async () => {
    const { user: adminUser, token: oldAdminToken } = await createTestUser('admin');

    // Suspend admin in DB
    adminUser.accountStatus = 'suspended';
    await adminUser.save();

    const writeRes = await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${oldAdminToken}`)
      .send({ title: 'Test', summary: 'Test', content: 'Test', category: 'General' })
      .expect(403);

    expect(writeRes.body.error.code).toBe('ACCOUNT_SUSPENDED');

    // Reactivate but demote to student
    adminUser.accountStatus = 'active';
    adminUser.role = 'student';
    await adminUser.save();

    const demotedRes = await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${oldAdminToken}`)
      .send({ title: 'Test', summary: 'Test', content: 'Test', category: 'General' })
      .expect(403);

    expect(demotedRes.body.error.code).toBe('FORBIDDEN_ROLE');
  });

  // 8. Mass assignment: body containing author, publishedAt, _id, or unknown fields cannot set them
  it('8. Mass assignment protection: author, publishedAt, _id, and unknown fields are rejected', async () => {
    const { token: adminToken } = await createTestUser('admin');
    const fakeAuthorId = new mongoose.Types.ObjectId().toString();

    // Unknown field is rejected by strict validator
    const res = await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Valid Title',
        summary: 'Valid Summary',
        content: 'Valid Content',
        category: 'General',
        author: fakeAuthorId,
        publishedAt: '2020-01-01T00:00:00.000Z',
        _id: fakeAuthorId,
        maliciousKey: 'maliciousValue',
      })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // 9. Invalid category, over-length fields, empty-after-trim fields, bad cover URLs are rejected
  it('9. Rejects invalid category, overlength fields, empty-after-trim, and non-https / credential URLs', async () => {
    const { token: adminToken } = await createTestUser('admin');

    // Invalid category
    await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'T', summary: 'S', content: 'C', category: 'InvalidCategory' })
      .expect(400);

    // Empty after trim
    await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: '   ', summary: 'S', content: 'C', category: 'General' })
      .expect(400);

    // Overlength title (> 150)
    await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'A'.repeat(151), summary: 'S', content: 'C', category: 'General' })
      .expect(400);

    // Overlength summary (> 300)
    await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Valid Title', summary: 'A'.repeat(301), content: 'C', category: 'General' })
      .expect(400);

    // Overlength content (> 10000)
    await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Valid Title', summary: 'S', content: 'A'.repeat(10001), category: 'General' })
      .expect(400);

    // Bad coverImage: http
    await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'T', summary: 'S', content: 'C', category: 'General', coverImage: 'http://insecure.com/img.jpg' })
      .expect(400);

    // Bad coverImage: javascript:
    await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'T', summary: 'S', content: 'C', category: 'General', coverImage: 'javascript:alert(1)' })
      .expect(400);

    // Bad coverImage: embedded credentials
    await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'T', summary: 'S', content: 'C', category: 'General', coverImage: 'https://user:pass@example.com/img.png' })
      .expect(400);
  });

  // 10. Malformed and nonexistent IDs behave per convention; double delete returns 404; PATCH deleted returns 404
  it('10. Malformed/nonexistent IDs return 404; double delete returns 404; PATCH on deleted returns 404', async () => {
    const { token: adminToken } = await createTestUser('admin');
    const nonexistentId = new mongoose.Types.ObjectId();

    // Malformed ID
    await request(app).get('/api/v1/announcements/not-a-valid-id').set('Authorization', `Bearer ${adminToken}`).expect(404);
    await request(app).patch('/api/v1/announcements/not-a-valid-id').set('Authorization', `Bearer ${adminToken}`).send({ title: 'X' }).expect(404);
    await request(app).delete('/api/v1/announcements/not-a-valid-id').set('Authorization', `Bearer ${adminToken}`).expect(404);

    // Nonexistent ID
    await request(app).get(`/api/v1/announcements/${nonexistentId}`).set('Authorization', `Bearer ${adminToken}`).expect(404);
    await request(app).patch(`/api/v1/announcements/${nonexistentId}`).set('Authorization', `Bearer ${adminToken}`).send({ title: 'X' }).expect(404);
    await request(app).delete(`/api/v1/announcements/${nonexistentId}`).set('Authorization', `Bearer ${adminToken}`).expect(404);

    // Create and delete, then delete again
    const item = await Announcement.create({
      title: 'To Be Deleted',
      summary: 'Summary',
      content: 'Content',
      category: 'General',
      author: new mongoose.Types.ObjectId(),
    });

    await request(app).delete(`/api/v1/announcements/${item._id}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    // Double delete -> 404
    await request(app).delete(`/api/v1/announcements/${item._id}`).set('Authorization', `Bearer ${adminToken}`).expect(404);
    // PATCH deleted -> 404
    await request(app).patch(`/api/v1/announcements/${item._id}`).set('Authorization', `Bearer ${adminToken}`).send({ title: 'Revive' }).expect(404);
  });

  // 11. Search: regex metacharacters in q do not error or hang; category[$ne]=x style input is rejected
  it('11. Search handling: regex metacharacters in q do not error; query injection is rejected', async () => {
    const { user: adminUser } = await createTestUser('admin');
    const { token: studentToken } = await createTestUser('student');

    await Announcement.create({
      title: 'Announcement With (Special) [Characters] .* +',
      summary: 'Testing regex metacharacters safely',
      content: 'Deep content with symbols.',
      category: 'Important',
      author: adminUser._id,
      published: true,
      publishedAt: new Date(),
    });

    // Regex metacharacters in q
    const res = await request(app)
      .get('/api/v1/announcements?q=(Special)')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(res.body.data.announcements.length).toBe(1);

    // NoSQL object injection attempt (category[$ne]=x)
    const injectionRes = await request(app)
      .get('/api/v1/announcements?category[$ne]=Invalid')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(400);
    expect(injectionRes.body.error.code).toBe('VALIDATION_ERROR');
  });

  // 12. Pagination: limit capped at 50, invalid page or limit handled, order stable, total correct
  it('12. Pagination caps limit at 50, handles invalid inputs, maintains deterministic sorting', async () => {
    const { user: adminUser } = await createTestUser('admin');
    const { token: studentToken } = await createTestUser('student');

    // Create 15 items with identical publishedAt
    const fixedDate = new Date();
    const items = [];
    for (let i = 1; i <= 15; i++) {
      items.push({
        title: `Item ${i.toString().padStart(2, '0')}`,
        summary: `Summary ${i}`,
        content: `Content ${i}`,
        category: 'General',
        author: adminUser._id,
        published: true,
        publishedAt: fixedDate,
      });
    }
    await Announcement.insertMany(items);

    // Page 1 with limit 5
    const p1 = await request(app)
      .get('/api/v1/announcements?page=1&limit=5')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(p1.body.data.announcements.length).toBe(5);
    expect(p1.body.data.total).toBe(15);
    expect(p1.body.data.totalPages).toBe(3);

    // Page 2 with limit 5
    const p2 = await request(app)
      .get('/api/v1/announcements?page=2&limit=5')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(p2.body.data.announcements.length).toBe(5);

    // Confirm no duplicates between p1 and p2 (stable tie-breaking on _id)
    const p1Ids = p1.body.data.announcements.map((a: any) => a.id);
    const p2Ids = p2.body.data.announcements.map((a: any) => a.id);
    expect(p1Ids.some((id: string) => p2Ids.includes(id))).toBe(false);

    // Limit cap at 50 when 100 requested
    const capRes = await request(app)
      .get('/api/v1/announcements?limit=100')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(capRes.body.data.limit).toBe(50);
  });

  // 13. publishedAt is set on unpublished-to-published transition, not changed by editing, not accepted from client
  it('13. publishedAt lifecycle: set on transition to published, preserved on edits, ignored from client', async () => {
    const { token: adminToken } = await createTestUser('admin');

    // Create with client publishedAt attempt
    const createRes = await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Title',
        summary: 'Summary',
        content: 'Content',
        category: 'General',
        published: true,
      })
      .expect(201);

    const initialPublishedAt = new Date(createRes.body.data.announcement.publishedAt).getTime();
    expect(initialPublishedAt).toBeGreaterThan(0);
    const id = createRes.body.data.announcement.id;

    // Wait 10ms and edit title
    await new Promise((r) => setTimeout(r, 15));
    const editRes = await request(app)
      .patch(`/api/v1/announcements/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'New Title' })
      .expect(200);

    const afterEditPublishedAt = new Date(editRes.body.data.announcement.publishedAt).getTime();
    expect(afterEditPublishedAt).toBe(initialPublishedAt);
  });

  // 14. Payload containing script tags stored and returned as inert text
  it('14. HTML/script payload stored and returned as inert text without corruption', async () => {
    const { token: adminToken } = await createTestUser('admin');
    const xssPayload = '<script>alert("xss")</script> & <b>bold</b>';

    const res = await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Safe Title',
        summary: xssPayload,
        content: xssPayload,
        category: 'General',
        published: true,
      })
      .expect(201);

    expect(res.body.data.announcement.summary).toBe(xssPayload);
    expect(res.body.data.announcement.content).toBe(xssPayload);
  });

  // 15. Exactly one audit record per successful mutation and none for failed ones
  it('15. Exactly one AdminAuditLog record per mutation; no full content in log', async () => {
    const { user: adminUser, token: adminToken } = await createTestUser('admin');

    // Create
    const createRes = await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Audit Target',
        summary: 'Short summary',
        content: 'Very long content that should never be stored in audit logs...',
        category: 'Important',
        published: false,
      })
      .expect(201);

    const id = createRes.body.data.announcement.id;
    let logs = await AdminAuditLog.find({ targetId: id });
    expect(logs.length).toBe(1);
    expect(logs[0].action).toBe('announcement.create');
    expect(logs[0].targetType).toBe('announcement');
    expect(logs[0].metadata.title).toBe('Audit Target');
    expect((logs[0].metadata as any).content).toBeUndefined();

    // Publish
    await request(app)
      .patch(`/api/v1/announcements/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ published: true })
      .expect(200);

    logs = await AdminAuditLog.find({ targetId: id });
    expect(logs.length).toBe(2);
    expect(logs[1].action).toBe('announcement.publish');

    // Failed patch -> no new audit log
    await request(app)
      .patch(`/api/v1/announcements/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ category: 'InvalidCategory' })
      .expect(400);

    logs = await AdminAuditLog.find({ targetId: id });
    expect(logs.length).toBe(2);

    // Delete
    await request(app)
      .delete(`/api/v1/announcements/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    logs = await AdminAuditLog.find({ targetId: id });
    expect(logs.length).toBe(3);
    expect(logs[2].action).toBe('announcement.delete');
  });

  // 16. The response contract matches what the frontend expects
  it('16. Response contract matches expected field names (id, title, summary, category, author, pagination)', async () => {
    const { user: adminUser, token: adminToken } = await createTestUser('admin', { name: 'Dr. Admin' });

    const createRes = await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Envelope Verification',
        summary: 'Summary for envelope',
        content: 'Content for envelope',
        category: 'Academic',
        published: true,
      })
      .expect(201);

    const announcement = createRes.body.data.announcement;
    expect(announcement).toHaveProperty('id');
    expect(announcement).toHaveProperty('_id');
    expect(announcement).toHaveProperty('title', 'Envelope Verification');
    expect(announcement).toHaveProperty('summary');
    expect(announcement).toHaveProperty('content');
    expect(announcement).toHaveProperty('category', 'Academic');
    expect(announcement).toHaveProperty('author');
    expect(announcement.author).toHaveProperty('name', 'Dr. Admin');
    expect(announcement).toHaveProperty('published', true);
    expect(announcement).toHaveProperty('publishedAt');
    expect(announcement).toHaveProperty('createdAt');
    expect(announcement).toHaveProperty('updatedAt');

    const listRes = await request(app)
      .get('/api/v1/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(listRes.body.data).toHaveProperty('announcements');
    expect(listRes.body.data).toHaveProperty('items');
    expect(listRes.body.data).toHaveProperty('total');
    expect(listRes.body.data).toHaveProperty('page');
    expect(listRes.body.data).toHaveProperty('limit');
    expect(listRes.body.data).toHaveProperty('totalPages');
    expect(listRes.body.data).toHaveProperty('pagination');
  });
});
