import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { errorHandler, createError } from './middleware/errorHandler';
import authRouter from './routes/auth';
import adminRouter from './routes/admin';
import usersRouter from './routes/users';
import dashboardRouter from './routes/dashboard';
import alumniRouter from './routes/alumni';
import eventsRouter from './routes/events';
import jobsRouter from './routes/jobs';
import mentorshipRouter from './routes/mentorship';

const app = express();

// ── Security headers ─────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS (explicit allowlist — no wildcard) ───────────────────────────────────
app.use(
  cors({
    origin: (requestOrigin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!requestOrigin || requestOrigin === env.CLIENT_URL) {
        return callback(null, true);
      }
      return callback(createError('Not allowed by CORS policy.', 403, 'CORS_NOT_ALLOWED'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Cookie parsing (for httpOnly refresh token) ──────────────────────────────
app.use(cookieParser());

// ── Request logging ───────────────────────────────────────────────────────────
if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Static uploads ────────────────────────────────────────────────────────────
app.use('/uploads', express.static('uploads'));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    },
  });
});

// ── API v1 routes ─────────────────────────────────────────────────────────────
app.use('/api/v1/auth',      authRouter);
app.use('/api/v1/admin',     adminRouter);
app.use('/api/v1/users',     usersRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/alumni',    alumniRouter);
app.use('/api/v1/events',     eventsRouter);
app.use('/api/v1/jobs',       jobsRouter);
app.use('/api/v1/mentorship', mentorshipRouter);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource does not exist.',
    },
  });
});

// ── Centralized error handler ─────────────────────────────────────────────────
app.use(errorHandler);

export default app;
