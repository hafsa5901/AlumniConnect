import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../src/models/User';
import { seedAdminCore } from '../src/seedAdmin';

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
});

describe('Admin Seeding Production Safety Tests', () => {
  it('refuses to seed in production if ALLOW_PROD_SEED is not explicitly true', async () => {
    await expect(
      seedAdminCore({
        nodeEnv: 'production',
        allowProdSeed: undefined,
        adminEmail: 'admin@prod.com',
        adminPassword: 'SecureProdPassword123!',
      })
    ).rejects.toThrow('Seed script must not run in production without ALLOW_PROD_SEED=true.');

    const admin = await User.findOne({ role: 'admin' });
    expect(admin).toBeNull();
  });

  it('refuses to seed in production if ALLOW_PROD_SEED is false', async () => {
    await expect(
      seedAdminCore({
        nodeEnv: 'production',
        allowProdSeed: 'false',
        adminEmail: 'admin@prod.com',
        adminPassword: 'SecureProdPassword123!',
      })
    ).rejects.toThrow('Seed script must not run in production without ALLOW_PROD_SEED=true.');

    const admin = await User.findOne({ role: 'admin' });
    expect(admin).toBeNull();
  });

  it('refuses to seed in production if ADMIN_PASSWORD is missing or empty', async () => {
    await expect(
      seedAdminCore({
        nodeEnv: 'production',
        allowProdSeed: 'true',
        adminEmail: 'admin@prod.com',
        adminPassword: '',
      })
    ).rejects.toThrow('In production, ADMIN_EMAIL and ADMIN_PASSWORD environment variables must be explicitly defined.');

    const admin = await User.findOne({ role: 'admin' });
    expect(admin).toBeNull();
  });

  it('successfully creates an admin when ALLOW_PROD_SEED=true and credentials are provided in production', async () => {
    const result = await seedAdminCore({
      nodeEnv: 'production',
      allowProdSeed: 'true',
      adminEmail: 'admin@prod.com',
      adminPassword: 'SuperSecureProdPassword123!',
    });

    expect(result.created).toBe(true);
    expect(result.email).toBe('admin@prod.com');

    const admin = await User.findOne({ email: 'admin@prod.com' });
    expect(admin).not.toBeNull();
    expect(admin?.role).toBe('admin');
    expect(admin?.verificationStatus).toBe('admin_approved');
  });

  it('is idempotent and skips creation if an admin already exists', async () => {
    await seedAdminCore({
      nodeEnv: 'production',
      allowProdSeed: 'true',
      adminEmail: 'admin1@prod.com',
      adminPassword: 'Password1!',
    });

    const secondResult = await seedAdminCore({
      nodeEnv: 'production',
      allowProdSeed: 'true',
      adminEmail: 'admin2@prod.com',
      adminPassword: 'Password2!',
    });

    expect(secondResult.created).toBe(false);
    expect(secondResult.email).toBe('admin1@prod.com');

    const admins = await User.find({ role: 'admin' });
    expect(admins.length).toBe(1);
    expect(admins[0].email).toBe('admin1@prod.com');
  });
});
