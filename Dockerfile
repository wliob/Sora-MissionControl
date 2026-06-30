# Stage 1: install dependencies and build the React app.
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --omit=dev

# Stage 2: same-origin app + admin proxy server.
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV MISSION_CONTROL_PROXY_HOST=0.0.0.0
ENV MISSION_CONTROL_PROXY_PORT=3187

# Hermes Runtime Bridge: SSH client for remote hermes CLI execution
RUN apk add --no-cache openssh-client

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY missionControlProxy.js ./missionControlProxy.js

# Hermes Runtime Bridge: wrapper script replaces hermes CLI with SSH bridge
COPY deploy/hermes-bridge.sh /usr/local/bin/hermes
RUN chmod 755 /usr/local/bin/hermes

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 missioncontrol && \
    chown -R missioncontrol:nodejs /app && \
    chmod 644 /app/missionControlProxy.js
USER missioncontrol

EXPOSE 3187

CMD ["node", "missionControlProxy.js"]
