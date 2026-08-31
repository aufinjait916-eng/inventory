# ==============================================================================
# Multi-stage Production Dockerfile for AssetFlow
# (React + Vite + Tailwind CSS + Node.js Express + PostgreSQL + Drizzle ORM)
# Compatible with linux/amd64 and linux/arm64 (Apple Silicon, TrueNAS, Raspberry Pi)
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. Build Stage: Compiles TypeScript frontend and backend bundle
# ------------------------------------------------------------------------------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy all source files
COPY . .

# Build Vite client assets (dist/) and bundle backend server (dist/server.cjs)
RUN npm run build

# ------------------------------------------------------------------------------
# 2. Production Stage: Hardened, cross-platform container runtime
# ------------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install curl for container health check
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Install production dependencies only
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev --no-audit --no-fund; fi && \
    npm cache clean --force

# Copy built application assets and server bundle from builder stage
COPY --from=builder /app/dist ./dist

# Create dedicated non-root user for security (Debian format)
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -s /bin/sh -m nodejs && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose AssetFlow web server port
EXPOSE 3000

# Health check configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start production server
CMD ["node", "dist/server.cjs"]

