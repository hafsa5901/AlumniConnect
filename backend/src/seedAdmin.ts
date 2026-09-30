/**
 * Seed Admin Script — npm run seed:admin
 *
 * Creates ONE admin user if none exists.
 * Reads credentials from ADMIN_EMAIL / ADMIN_PASSWORD env vars.
 * Idempotent: no-op if an admin already exists.
 * Never runs in production without explicit ALLOW_PROD_SEED=true.
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import mongoose from 'mongoose';
import User from './models/User';
import { hashPassword } from './utils/auth';

export interface SeedAdminOptions {
  mongoUri?: string;
  nodeEnv?: string;
  allowProdSeed?: string;
  adminEmail?: string;
  adminPassword?: string;
  disconnectAfter?: boolean;
}

export async function seedAdminCore(options?: SeedAdminOptions): Promise<{ created: boolean; email: string }> {
  const nodeEnv = options?.nodeEnv ?? process.env.NODE_ENV ?? 'development';
  const allowProdSeed = options?.allowProdSeed ?? process.env.ALLOW_PROD_SEED;
  const adminEmail = options?.adminEmail ?? process.env.ADMIN_EMAIL;
  const adminPassword = options?.adminPassword ?? process.env.ADMIN_PASSWORD;
  const mongoUri = options?.mongoUri ?? process.env.MONGODB_URI;

  if (!mongoUri && mongoose.connection.readyState === 0) {
    throw new Error('MONGODB_URI not set. Aborting seed.');
  }

  if (nodeEnv === 'production' && allowProdSeed !== 'true') {
    throw new Error('Seed script must not run in production without ALLOW_PROD_SEED=true.');
  }

  if (nodeEnv === 'production' && (!adminEmail || !adminEmail.trim() || !adminPassword || !adminPassword.trim())) {
    throw new Error('In production, ADMIN_EMAIL and ADMIN_PASSWORD environment variables must be explicitly defined. Aborting seed.');
  }

  if (!adminEmail || !adminPassword) {
    if (nodeEnv !== 'test') {
      console.warn('⚠️  ADMIN_EMAIL or ADMIN_PASSWORD not set in .env.');
      console.warn('   Using development defaults: admin@alumniconnect.local');
    }
  }

  const email = (adminEmail || 'admin@alumniconnect.local').trim().toLowerCase();
  const password = adminPassword || 'Admin123456';

  if (mongoose.connection.readyState === 0 && mongoUri) {
    await mongoose.connect(mongoUri);
  }

  const existingAdmin = await User.findOne({ role: 'admin' });
  if (existingAdmin) {
    if (nodeEnv !== 'test') {
      console.log(`ℹ️  Admin already exists: ${existingAdmin.email}. Skipping.`);
    }
    if (options?.disconnectAfter) {
      await mongoose.disconnect();
    }
    return { created: false, email: existingAdmin.email };
  }

  const passwordHash = await hashPassword(password);

  await User.create({
    name: 'Platform Admin',
    email,
    passwordHash,
    role: 'admin',
    accountStatus: 'active',
    verificationStatus: 'admin_approved',
    department: 'Administration',
    batch: '2024',
  });

  if (nodeEnv !== 'test') {
    console.log('\n✅ Admin user created:');
    console.log(`   Email:    ${email}`);
    console.log('   Password: [CONFIGURED IN ENVIRONMENT]');
  }

  if (options?.disconnectAfter) {
    await mongoose.disconnect();
  }

  return { created: true, email };
}

if (require.main === module) {
  seedAdminCore({ disconnectAfter: true }).catch((err) => {
    console.error('❌ Seed failed:', err.message || err);
    process.exit(1);
  });
}
