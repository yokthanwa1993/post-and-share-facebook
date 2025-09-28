# Use official Node.js LTS image
FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies first (including production deps only)
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source
COPY . .

# Ensure scheduler script is executable (if needed)
RUN chmod +x post-and-share.sh || true

ENV NODE_ENV=production

# Default environment values (can be overridden via CapRover env vars)
ENV CRON_SCHEDULE="*/15 * * * *"
ENV RUN_ON_START=true

CMD ["node", "scheduler.js"]
