# syntax=docker/dockerfile:1.6
#
# Multi-stage build for NTT GRC Hub.
# Output: a small Node 22 alpine runtime image listening on $PORT (default 5182).

# ----- 1. Build stage -----
FROM node:22-alpine AS build
WORKDIR /app

# Install deps with a clean cache layer.
COPY package.json package-lock.json* ./
RUN npm ci

# Build the SvelteKit app (adapter-node → ./build).
COPY . .
RUN npm run build && npm prune --omit=dev

# ----- 2. Runtime stage -----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=5182
ENV HOST=0.0.0.0
WORKDIR /app

# Copy only what the runtime needs.
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# Drop privileges.
RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 5182
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/" >/dev/null 2>&1 || exit 1

CMD ["node", "build/index.js"]
