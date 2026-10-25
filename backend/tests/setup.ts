import dotenv from 'dotenv';
import path from 'path';

// Isolate email transport test environment from host developer .env
// Set explicit defaults before dotenv loads, since dotenv preserves existing process.env variables.
process.env.NODE_ENV = 'test';
process.env.REQUIRE_PROD_EMAIL = 'false';
process.env.SMTP_REQUIRED = 'false';
process.env.SMTP_HOST = '';
process.env.SMTP_PORT = '587';
process.env.SMTP_SECURE = 'false';
process.env.SMTP_USER = '';
process.env.SMTP_PASSWORD = '';
process.env.SMTP_PASS = '';
process.env.EMAIL_SERVICE = '';
process.env.EMAIL_USER = '';
process.env.EMAIL_PASSWORD = '';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Guarantee test isolation after dotenv load
process.env.NODE_ENV = 'test';
process.env.REQUIRE_PROD_EMAIL = 'false';
process.env.SMTP_REQUIRED = 'false';
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASSWORD = '';
process.env.SMTP_PASS = '';
process.env.EMAIL_SERVICE = '';
process.env.EMAIL_USER = '';
process.env.EMAIL_PASSWORD = '';
process.env.AUTH_RATE_LIMIT_DISABLED = 'true';
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-jwt-access-secret-32-chars-minimum!';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-32-chars-minimum!';
