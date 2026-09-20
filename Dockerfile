# ---- Build stage ----
FROM node:24-slim AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# node:sqlite is stable/unflagged on Node 24; build uses in-memory DB (see src/lib/db.ts)
RUN npm run build

# ---- Runtime stage ----
FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV SMS_DATA_DIR=/data
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN mkdir -p /data
# Standalone server + static assets + public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
VOLUME ["/data"]
CMD ["node", "server.js"]
