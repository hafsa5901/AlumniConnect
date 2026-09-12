import { createServer } from 'http';
import { env } from './config/env';
import { connectDB } from './config/db';
import app from './app';
import { initSocket } from './socket';

async function bootstrap(): Promise<void> {
  // Connect to MongoDB first — exits process on failure
  await connectDB();

  const httpServer = createServer(app);

  // Mount Socket.IO
  initSocket(httpServer);

  httpServer.listen(env.PORT, () => {
    console.log(`🚀 AlumniConnect API running on port ${env.PORT} [${env.NODE_ENV}]`);
    console.log(`   Health: http://localhost:${env.PORT}/api/health`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n📴 ${signal} received — shutting down gracefully...`);
    httpServer.close(async () => {
      const { disconnectDB } = await import('./config/db');
      await disconnectDB();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    console.error('🔴 Unhandled Promise Rejection:', reason);
    // Don't crash in production — log and continue
    if (env.NODE_ENV === 'development') {
      process.exit(1);
    }
  });
}

bootstrap();
