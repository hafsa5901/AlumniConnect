import dotenv from 'dotenv';
import path from 'path';

// Load .env before anything else
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: requireEnv('MONGODB_URI'),
  JWT_ACCESS_SECRET: requireEnv('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: requireEnv('JWT_REFRESH_SECRET'),
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  COLLEGE_EMAIL_DOMAINS: (process.env.COLLEGE_EMAIL_DOMAINS || 'college.edu,university.edu')
    .split(',')
    .map((d) => d.trim().toLowerCase()),
  STUDENT_REQUIRES_ADMIN_APPROVAL: process.env.STUDENT_REQUIRES_ADMIN_APPROVAL === 'true',
  EMAIL_SERVICE: process.env.EMAIL_SERVICE || 'ethereal',
  EMAIL_USER: process.env.EMAIL_USER || '',
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@alumniconnect.local',
  FILE_STORAGE_DRIVER: (process.env.FILE_STORAGE_DRIVER || 'local') as 'local' | 's3',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || '',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
  // Rate limit overrides for test environments
  AUTH_RATE_LIMIT_DISABLED: process.env.AUTH_RATE_LIMIT_DISABLED === 'true',
};

