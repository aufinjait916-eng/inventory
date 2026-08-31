# ==============================================================================
# Multi-stage Production Dockerfile for AssetFlow
# (React + Vite + Tailwind CSS + Node.js Express + PostgreSQL + Drizzle ORM)
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. Build Stage: Compiles TypeScript frontend and backend
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy all source files
COPY . .

# Build Vite client assets (dist/) and bundle backend server (dist/server.cjs)
RUN npm run build

# ------------------------------------------------------------------------------
# 2. Production Stage: Minimal, hardened container runtime
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install curl for container health check
RUN apk add --no-cache curl

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application assets and server bundle from builder stage
COPY --from=builder /app/dist ./dist

# Create dedicated non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose AssetFlow web server port
EXPOSE 3000

# Health check configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start production server
CMD ["node", "dist/server.cjs"]
