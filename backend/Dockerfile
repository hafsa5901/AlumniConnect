# Multi-stage Dockerfile for AlumniConnect Backend API

# ── Stage 1: Build Stage ──────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies cleanly using package-lock.json
COPY package.json package-lock.json ./
RUN npm ci

# Copy TypeScript configuration and source code
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript to CommonJS (outputs to /app/dist)
RUN npm run build

# ── Stage 2: Production Runtime Stage ─────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Set default production environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Install production dependencies only and purge npm cache
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled JavaScript output from builder stage
COPY --from=builder /app/dist ./dist

# Initialize uploads directories with proper permissions for the node user
RUN mkdir -p uploads uploads_private && chown -R node:node /app

# Run as non-root node user for container security
USER node

# Expose standard backend port
EXPOSE 5000

# Launch node binary directly to ensure kernel SIGTERM / SIGINT signals are received for graceful shutdown
CMD ["node", "dist/server.js"]
