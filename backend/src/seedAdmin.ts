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

async function seedAdmin() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI not set. Aborting seed.');
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_SEED !== 'true') {
    console.error('❌ Seed script must not run in production without ALLOW_PROD_SEED=true.');
    process.exit(1);
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.warn('⚠️  ADMIN_EMAIL or ADMIN_PASSWORD not set in .env.');
    console.warn('   Using defaults: admin@alumniconnect.local / Admin123456');
    console.warn('   CHANGE THESE BEFORE GOING TO PRODUCTION.\n');
  }

  const email = adminEmail || 'admin@alumniconnect.local';
  const password = adminPassword || 'Admin123456';

  await mongoose.connect(mongoUri);
  console.log('✅ MongoDB connected');

  const existingAdmin = await User.findOne({ role: 'admin' });
  if (existingAdmin) {
    console.log(`ℹ️  Admin already exists: ${existingAdmin.email}. Skipping.`);
    await mongoose.disconnect();
    return;
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

  console.log('\n✅ Admin user created:');
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${adminPassword ? '[from env]' : password}`);
  console.log('\n🔒 Change this password immediately if using the default.');

  await mongoose.disconnect();
}

seedAdmin().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
