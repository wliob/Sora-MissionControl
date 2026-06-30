# Sora Mission Control Deploy Runbook

> **Last Updated:** 2026-06-29 (Phase H — Unraid v2 HTTPS secure-transport gate)
> **Current Version:** v2 (Sora-MissionControl)
> **Previous Version:** v1 (running as `sora-missioncontrol-proxy` container on Unraid)

This runbook covers two deployment targets:
1. **Unraid Tower (192.168.10.5)** — **PRIMARY** production deployment, Docker container with Hermes Runtime Bridge
2. **Hermes Host / baset-ai (192.168.0.85)** — development/staging deployment, systemd user service

## Security Notes

- **HTTPS required for sensitive routes:** Use `https://192.168.10.5:3443` for login, Kanban, session, admin, and PTY access. The plain HTTP listener on `3187` may answer health checks, but sensitive routes intentionally return `403` when `MISSION_CONTROL_REQUIRE_SECURE_TRANSPORT=true`.
- **Self-signed LAN certificate:** Tower uses a self-signed certificate in `/mnt/user/appdata/sora-missioncontrol/runtime/tls/`. Browsers will warn until the cert/CA is trusted on the client.
- **Do not send credentials over LAN HTTP:** Never send dashboard credentials, cookies, or `X-Mission-Control-Key` to `http://192.168.10.5:3187`.
- **Admin token rotation:** Rotate the token periodically by updating the runtime secret file and restarting the service/container.

---

## Target A: Unraid Tower (PRIMARY — Production)

**IP:** 192.168.10.5
**Container name:** `sora-missioncontrol-proxy`
**Ports:** 3443 HTTPS, 3187 plain HTTP health/blocked fallback
**App URL:** `https://192.168.10.5:3443`
**Health URL:** `https://192.168.10.5:3443/health`

This is the primary user-facing deployment. The Docker container runs on Unraid, serves the React SPA + admin proxy over HTTPS on port 3443, leaves port 3187 as a plain HTTP listener with sensitive routes blocked, and bridges Hermes CLI commands to the AI host via SSH.

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Unraid Tower (192.168.10.5)                                   │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ sora-missioncontrol-proxy container (v2)                 │ │
│  │                                                          │ │
│  │  missionControlProxy.js                                  │ │
│  │    │                                                     │ │
│  │    ├── proxyDashboardRequest() ──► HTTP ──► 192.168.0.85:9119 │
│  │    │   (kanban API — direct proxy)                      │ │
│  │    │                                                     │ │
│  │    ├── Serve SPA (dist/) on port 3187                   │ │
│  │    │                                                     │ │
│  │    └── runHermes(args)                                    │ │
│  │          │                                                │ │
│  │          └── execFile('hermes', args)                     │ │
│  │                │                                          │ │
│  │                └── /usr/local/bin/hermes (bridge script) │ │
│  │                      │                                    │ │
│  │                      └── SSH tunnel ──► 192.168.0.85:22 │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ NGINX Reverse Proxy (recommended)                        │ │
│  │  smc.unraid.local:80 → 127.0.0.1:3187                   │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│ baset-ai / Hermes Host (192.168.0.85)                         │
│                                                               │
│  /home/wliob/.local/bin/hermes                                │
│    (real Hermes CLI — auth, cron, mcp, skills, webhooks)     │
│                                                               │
│  SSH authorized_keys:                                         │
│    no-port-forwarding,no-X11-forwarding,no-agent-forwarding, │
│    no-pty hhc-tunnel@tower                                   │
└──────────────────────────────────────────────────────────────┘
```

### Prerequisites

- Unraid Tower with Docker support
- AI host (baset-ai) must be reachable from Tower on port 22 (SSH)
- Hermes CLI installed on AI host at `/home/wliob/.local/bin/hermes`
- SSH key pair for bridge authentication
- App data directory on Unraid: `/mnt/user/appdata/sora-missioncontrol/`

### SSH Key Setup (one-time)

On Unraid Tower, generate a dedicated key for the bridge:

```bash
ssh-keygen -t ed25519 -f /root/.ssh/hermes_tunnel -N '' -C 'hhc-tunnel@tower'
```

Copy the public key to the AI host's authorized_keys with restrictions:

```bash
# On baset-ai, add to ~/.ssh/authorized_keys:
no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty ssh-ed25519 AAAA... hhc-tunnel@tower
```

Verify connectivity:

```bash
ssh -i /root/.ssh/hermes_tunnel -o StrictHostKeyChecking=no wliob@192.168.0.85 '/home/wliob/.local/bin/hermes --version'
```

### V2 Deployment — Step by Step

These are the exact steps to deploy Sora-MissionControl v2 to Unraid Tower.

#### 1. Build the app on the development host

```bash
cd /home/wliob/llm-brain/Projects/Active/Sora-MissionControl
npm run build
```

Verify the build produced `dist/`:

```bash
ls -la dist/index.html dist/assets/
```

#### 2. Copy release to Unraid

```bash
# Create v2 directory
ssh root@192.168.10.5 'mkdir -p /mnt/user/appdata/sora-missioncontrol/v2'

# Copy all needed files
scp -r dist/ missionControlProxy.js package.json package-lock.json \
  docker-compose.yml Dockerfile deploy/hermes-bridge.sh \
  root@192.168.10.5:/mnt/user/appdata/sora-missioncontrol/v2/

# Copy env template (edit on Unraid with real secrets)
scp .env.proxy root@192.168.10.5:/mnt/user/appdata/sora-missioncontrol/v2/.env.proxy.template

# Fix permissions on hermes-bridge.sh
ssh root@192.168.10.5 'chmod 755 /mnt/user/appdata/sora-missioncontrol/v2/hermes-bridge.sh'
```

#### 3. Create runtime secrets on Unraid

```bash
ssh root@192.168.10.5
mkdir -p /mnt/user/appdata/sora-missioncontrol/runtime
cat > /mnt/user/appdata/sora-missioncontrol/runtime/proxy.env << 'ENVEOF'
MISSION_CONTROL_ADMIN_PROXY_KEY=<your-strong-random-token-here>
ENVEOF
chmod 600 /mnt/user/appdata/sora-missioncontrol/runtime/proxy.env
```

**IMPORTANT:** Generate a strong random token. Do NOT use the development placeholder from `.env.proxy`. Example token generation:

```bash
openssl rand -hex 32
```

#### 4. Stop old v1 container (if running)

```bash
# On Unraid
docker stop sora-missioncontrol-proxy 2>/dev/null || true
docker rm sora-missioncontrol-proxy 2>/dev/null || true
```

#### 5. Build and start v2 container

```bash
cd /mnt/user/appdata/sora-missioncontrol/v2

# Export runtime secrets
source /mnt/user/appdata/sora-missioncontrol/runtime/proxy.env

# Build and start
MISSION_CONTROL_ADMIN_PROXY_KEY="$MISSION_CONTROL_ADMIN_PROXY_KEY" \
HERMES_DASHBOARD_URL=http://192.168.0.85:9119 \
HERMES_DASHBOARD_PROXY_TARGET=http://192.168.0.85:9119 \
  docker compose up -d --build
```

#### 6. Verify deployment

```bash
# HTTPS health check (use -k unless the LAN cert is trusted by this client)
curl -fsk https://192.168.10.5:3443/health

# Expected: {"ok":true,"service":"sora-mission-control-admin-proxy"}

# Check container is running
docker ps --filter name=sora-missioncontrol-proxy

# Check logs
docker compose logs -f --tail=50 sora-missioncontrol-proxy
```

#### 7. Smoke tests

```bash
# Plain HTTP sensitive routes must be transport-blocked (403)
curl -s -o /tmp/smc-http-login.txt -w '%{http_code}\n' http://192.168.10.5:3187/login
curl -s -o /tmp/smc-http-session.txt -w '%{http_code}\n' http://192.168.10.5:3187/api/session
curl -s -o /tmp/smc-http-admin.txt -w '%{http_code}\n' http://192.168.10.5:3187/admin/keys
curl -s -H 'Host: 127.0.0.1:3187' -o /tmp/smc-http-host-spoof.txt -w '%{http_code}\n' http://192.168.10.5:3187/login
curl -s -H 'X-Forwarded-Proto: https' -o /tmp/smc-http-xfp-spoof.txt -w '%{http_code}\n' http://192.168.10.5:3187/login

# Unauthenticated admin over HTTPS should reach the auth gate (401), not the transport gate (403)
curl -sk -w '\n%{http_code}' https://192.168.10.5:3443/admin/keys

# Authenticated admin reads over HTTPS only (should return 200 with data)
source /mnt/user/appdata/sora-missioncontrol/runtime/proxy.env
curl -sk -w '\n%{http_code}' \
  -H "X-Mission-Control-Key: $MISSION_CONTROL_ADMIN_PROXY_KEY" \
  https://192.168.10.5:3443/admin/keys

curl -sk -w '\n%{http_code}' \
  -H "X-Mission-Control-Key: $MISSION_CONTROL_ADMIN_PROXY_KEY" \
  https://192.168.10.5:3443/admin/cron

curl -sk -w '\n%{http_code}' \
  -H "X-Mission-Control-Key: $MISSION_CONTROL_ADMIN_PROXY_KEY" \
  https://192.168.10.5:3443/admin/mcp

curl -sk -w '\n%{http_code}' \
  -H "X-Mission-Control-Key: $MISSION_CONTROL_ADMIN_PROXY_KEY" \
  https://192.168.10.5:3443/admin/skills

# Verify HTTPS SPA loads
curl -sk -w '\n%{http_code}' https://192.168.10.5:3443/ | head -5

# Verify SSH bridge inside container
docker exec sora-missioncontrol-proxy /usr/local/bin/hermes auth list
```

**Expected results:**
- HTTPS `/health` returns `{"ok":true,"service":"sora-mission-control-admin-proxy"}`
- Plain HTTP sensitive routes and spoof attempts return HTTP `403`
- Unauthenticated HTTPS `/admin/*` returns HTTP `401`
- Authenticated HTTPS `/admin/*` returns HTTP `200` with JSON data
- HTTPS SPA returns HTTP `200` with `<!DOCTYPE html>`
- Bridge `hermes auth list` returns auth provider listing (or honest error if Hermes is unreachable)

### NGINX Reverse Proxy Configuration

For cleaner URLs, place an HTTPS reverse proxy in front of the SMC container. The client-facing proxy must be HTTPS-only. Prefer forwarding to the container's HTTPS listener (`3443`); if you forward to plain `3187`, configure `MISSION_CONTROL_TRUSTED_PROXY_PEERS` to the proxy's actual source IP and keep the proxy HTTPS-only.

#### Option A: NginxProxyManager (Unraid Community App)

1. Install NginxProxyManager from Unraid Community Apps
2. Add a new Proxy Host:
   - **Domain Names:** `smc.unraid.local` (or your LAN domain)
   - **Scheme:** `https`
   - **Forward Hostname/IP:** `192.168.10.5`
   - **Forward Port:** `3443`
   - **SSL:** enable a LAN/self-signed cert or trusted internal CA cert
   - **Websockets Support:** Enabled (for PTY/WebSocket use)
   - **Access List:** LAN-only; block external access unless separately reviewed
   - **Advanced:** disable upstream cert verification if using the SMC self-signed cert

#### Option B: Manual NGINX vhost

```nginx
# /etc/nginx/conf.d/smc.unraid.local.conf
server {
    listen 443 ssl http2;
    server_name smc.unraid.local smc.*;

    ssl_certificate     /path/to/lan/fullchain.pem;
    ssl_certificate_key /path/to/lan/privkey.pem;

    # Increase proxy timeouts for admin operations
    proxy_read_timeout 120s;
    proxy_connect_timeout 15s;

    location / {
        proxy_pass https://127.0.0.1:3443;
        proxy_ssl_verify off; # acceptable only for the local self-signed upstream cert
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;

        # Pass admin proxy token header through over HTTPS only
        proxy_set_header X-Mission-Control-Key $http_x_mission_control_key;
    }
}

server {
    listen 80;
    server_name smc.unraid.local smc.*;
    return 301 https://$host$request_uri;
}
```

#### Option C: Traefik (if using Traefik on Unraid)

Add labels to the `docker-compose.yml` and route the service through an HTTPS entrypoint:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.smc.rule=Host(`smc.unraid.local`)"
  - "traefik.http.routers.smc.entrypoints=websecure"
  - "traefik.http.routers.smc.tls=true"
  - "traefik.http.services.smc.loadbalancer.server.scheme=https"
  - "traefik.http.services.smc.loadbalancer.server.port=3443"
```

### Health Checks (Unraid-Specific)

```bash
# From Unraid host itself
curl -fsk https://127.0.0.1:3443/health
docker exec sora-missioncontrol-proxy curl -fsS http://127.0.0.1:3187/health

# From any LAN client
curl -fsk https://192.168.10.5:3443/health

# From development host (baset-ai)
curl -fsk https://192.168.10.5:3443/health

# Docker health
docker inspect sora-missioncontrol-proxy --format='{{.State.Health.Status}}'
docker stats --no-stream sora-missioncontrol-proxy
```

### Rollback (Unraid)

```bash
cd /mnt/user/appdata/sora-missioncontrol

# Stop v2
cd v2
docker compose down

# Point to v1 backup (if available) or previous release
cd /mnt/user/appdata/sora-missioncontrol/v1
source ../runtime/proxy.env
MISSION_CONTROL_ADMIN_PROXY_KEY="$MISSION_CONTROL_ADMIN_PROXY_KEY" \
HERMES_DASHBOARD_URL=http://192.168.0.85:9119 \
  docker compose up -d
```

Or use the pre-built v1 image directly:

```bash
docker run -d \
  --name sora-missioncontrol-proxy \
  --restart unless-stopped \
  -p 3187:3187 \
  -v /root/.ssh/hermes_tunnel:/var/run/secrets/hermes_tunnel:ro \
  -e NODE_ENV=production \
  -e MISSION_CONTROL_PROXY_HOST=0.0.0.0 \
  -e MISSION_CONTROL_PROXY_PORT=3187 \
  -e MISSION_CONTROL_PROXY_AUTH_MODE=required \
  -e MISSION_CONTROL_ADMIN_PROXY_KEY="<runtime-secret>" \
  -e HERMES_DASHBOARD_URL=http://192.168.0.85:9119 \
  -e HERMES_REMOTE_USER=wliob \
  -e HERMES_REMOTE_HOST=192.168.0.85 \
  -e HERMES_REMOTE_PATH=/home/wliob/.local/bin/hermes \
  -e HERMES_SSH_KEY=/var/run/secrets/hermes_tunnel \
  sora-missioncontrol-proxy:bridge-20260625
```

### Bridge Env Vars

| Variable | Default | Description |
|----------|---------|-------------|
| HERMES_REMOTE_USER | wliob | SSH username on AI host |
| HERMES_REMOTE_HOST | 192.168.0.85 | AI host IP/hostname |
| HERMES_REMOTE_PATH | /home/wliob/.local/bin/hermes | Path to real hermes binary |
| HERMES_SSH_KEY | /var/run/secrets/hermes_tunnel | Path to SSH private key |
| HERMES_ACCEPT_HOOKS | (unset) | Set to "1" to pass through hooks acceptance |
| HERMES_DASHBOARD_URL | http://192.168.0.85:9119 | Dashboard/Kanban API base URL |
| HERMES_DASHBOARD_PROXY_TARGET | (from HERMES_DASHBOARD_URL) | Explicit proxy target (takes priority) |
| HERMES_WS_URL | ws://192.168.0.85:9119 | WebSocket URL (future use) |

### Bridge Security Model

- SSH key is mounted read-only into the container at `/var/run/secrets/hermes_tunnel`
- AI host authorized_keys restricts the key: no port forwarding, no X11, no agent, no PTY
- The bridge script only executes `hermes` commands with user-supplied arguments
- The bridge uses `StrictHostKeyChecking=no` because Tower and baset-ai are on the same trusted LAN
- All hermes output is sanitized via `stripNoise()` in the proxy (Bitwarden secret lines removed)
- Container runs as non-root `missioncontrol` user (UID 1001)
- Security options: `no-new-privileges:true`, all capabilities dropped, read-only root filesystem

---

## Target B: Hermes Host / baset-ai (Development / Staging)

**IP:** 192.168.0.85
**Service:** `sora-missioncontrol-proxy.service` (systemd user service)
**Port:** 3187

This deployment runs directly on the Hermes host where the CLI is available natively. Used for development, staging, and testing before Unraid production deployment.

### Current State

- `http://192.168.0.85:9119/kanban` is reachable.
- `sora-missioncontrol-proxy` is active/enabled as a `wliob` user service.
- Target-local `http://127.0.0.1:3187/health` works over SSH.
- Target self-LAN `http://192.168.0.85:3187/health` works over SSH.
- LAN `http://192.168.0.85:3187/health` works from the development host.
- Required-token behavior works over SSH: unauthenticated `/admin/keys` returns `401`, token-authenticated `/admin/keys` returns `200`.

### Systemd Deployment (baset-ai)

On `192.168.0.85`, unpack the release and install dependencies:

```bash
sudo install -d -m 0755 /opt/sora-missioncontrol/releases
sudo install -d -m 0755 /opt/sora-missioncontrol/releases/<timestamp>
sudo tar -xzf sora-missioncontrol-<timestamp>.tar.gz -C /opt/sora-missioncontrol/releases/<timestamp>
sudo ln -sfn /opt/sora-missioncontrol/releases/<timestamp> /opt/sora-missioncontrol/current
cd /opt/sora-missioncontrol/current
npm ci --omit=dev
```

Create the runtime secret file:

```bash
sudo install -d -m 0750 /etc/sora-missioncontrol
sudo install -m 0600 /dev/null /etc/sora-missioncontrol/proxy.env
sudo editor /etc/sora-missioncontrol/proxy.env
```

Required file content:

```env
MISSION_CONTROL_ADMIN_PROXY_KEY=<runtime-secret>
```

Install the service:

```bash
sudo cp deploy/sora-missioncontrol-proxy.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now sora-missioncontrol-proxy.service
```

### Dev-Specific Service File

For development on baset-ai, use the companion service file `deploy/sora-missioncontrol-proxy-dev.service` which points to the development working directory and uses user-level node:

```bash
# Copy dev service
cp deploy/sora-missioncontrol-proxy-dev.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now sora-missioncontrol-proxy-dev.service
```

Key differences from production:
- `WorkingDirectory=/home/wliob/llm-brain/Projects/Active/Sora-MissionControl`
- `ExecStart=/home/wliob/.hermes/node/bin/node missionControlProxy.js`
- Runs as user service (no root required)
- Auth mode can be `optional` or `required` depending on testing needs

### Smoketests (baset-ai)

```bash
curl -fsS http://127.0.0.1:3187/health
curl -fsS http://192.168.0.85:3187/health
curl -s -o /tmp/sora-admin-status.txt -w '%{http_code}' http://127.0.0.1:3187/admin/keys
```

Run a token-authenticated admin read:

```bash
. /etc/sora-missioncontrol/proxy.env
curl -s -w '\n%{http_code}' \
  -H "X-Mission-Control-Key: $MISSION_CONTROL_ADMIN_PROXY_KEY" \
  http://127.0.0.1:3187/admin/keys
```

### Rollback (baset-ai)

```bash
sudo systemctl stop sora-missioncontrol-proxy.service
sudo ln -sfn /opt/sora-missioncontrol/releases/<previous-timestamp> /opt/sora-missioncontrol/current
sudo systemctl start sora-missioncontrol-proxy.service
```

---

## Release Bundle

Create a release bundle on the development host:

```bash
cd /home/wliob/llm-brain/Projects/Active/Sora-MissionControl
bash deploy/create-release-bundle.sh
```

The command prints a tarball path under `shared/releases/`. Copy that tarball to the deployment target using the operator-approved channel.

### Bundle Contents

The release bundle includes:
- `missionControlProxy.js` — Node proxy server
- `package.json` + `package-lock.json` — for `npm ci --omit=dev`
- `dist/` — built React SPA
- `src/` — source (for reference; not needed at runtime)
- `Dockerfile` + `docker-compose.yml` — Docker deployment
- `deploy/sora-missioncontrol-proxy.service` — systemd template (production)
- `deploy/sora-missioncontrol-proxy-dev.service` — systemd template (development)
- `deploy/hermes-bridge.sh` — SSH bridge script
- `deploy/OPERATOR-RUNBOOK.md` — this runbook
- `deploy/create-release-bundle.sh` — release script (for reference)
- `.env.proxy` — env template (no real secrets)
- `docs/` — project documentation
- `README.md` + `AGENTS.md` + `OVERVIEW.md` — project handoff docs

---

## LAN Firewall

If target-local health works but LAN health from another client fails, confirm inbound TCP `3187` is allowed on the target host.

For UFW-based hosts:

```bash
sudo ufw allow 3187/tcp comment 'Sora Mission Control proxy'
sudo ufw status numbered
```

Then verify from another LAN client:

```bash
curl -fsS http://192.168.0.85:3187/health  # baset-ai
curl -fsS http://192.168.10.5:3187/health  # Unraid Tower
```

---

## Troubleshooting

### Container won't start

```bash
# Check logs
docker compose logs sora-missioncontrol-proxy

# Check env vars
docker compose config

# Verify SSH key is mounted
docker run --rm -v /root/.ssh/hermes_tunnel:/key:ro alpine cat /key | head -1
```

### Admin routes return 502

The dashboard proxy target is unreachable. Verify:

```bash
# From inside container
docker exec sora-missioncontrol-proxy wget -qO- http://192.168.0.85:9119/kanban

# Check env vars
docker exec sora-missioncontrol-proxy env | grep HERMES_DASHBOARD
```

### Hermes bridge fails

```bash
# Test SSH from Unraid host
ssh -i /root/.ssh/hermes_tunnel -o StrictHostKeyChecking=no wliob@192.168.0.85 'echo ok'

# Test inside container
docker exec sora-missioncontrol-proxy /usr/local/bin/hermes --version

# Check bridge env vars
docker exec sora-missioncontrol-proxy env | grep HERMES_REMOTE
```

### Port already in use

```bash
# Check what's on 3187
ss -tlnp | grep 3187

# If old container is still running
docker stop sora-missioncontrol-proxy
docker rm sora-missioncontrol-proxy
```

---

## Operations Cheat Sheet

### Unraid (Production)

```bash
# Status
docker ps --filter name=sora-missioncontrol-proxy

# Logs
docker compose -f /mnt/user/appdata/sora-missioncontrol/v2/docker-compose.yml logs -f --tail=100

# Restart
docker compose -f /mnt/user/appdata/sora-missioncontrol/v2/docker-compose.yml restart

# Stop
docker compose -f /mnt/user/appdata/sora-missioncontrol/v2/docker-compose.yml down

# Rebuild and start
cd /mnt/user/appdata/sora-missioncontrol/v2
source ../runtime/proxy.env
MISSION_CONTROL_ADMIN_PROXY_KEY="$MISSION_CONTROL_ADMIN_PROXY_KEY" \
  docker compose up -d --build

# Health
curl -fsk https://192.168.10.5:3443/health
```

### baset-ai (Development/Staging)

```bash
# Status
ssh wliob@192.168.0.85 'systemctl --user status sora-missioncontrol-proxy.service'

# Logs
ssh wliob@192.168.0.85 'journalctl --user -u sora-missioncontrol-proxy.service -f'

# Restart
ssh wliob@192.168.0.85 'systemctl --user restart sora-missioncontrol-proxy.service'

# Stop
ssh wliob@192.168.0.85 'systemctl --user stop sora-missioncontrol-proxy.service'

# Health
curl -fsS http://192.168.0.85:3187/health
```

---

## Notes

- Keep `MISSION_CONTROL_PROXY_AUTH_MODE=required` for any deployment reachable beyond localhost.
- Keep `MISSION_CONTROL_ADMIN_PROXY_KEY` in the runtime environment or secret file, not in source control.
- If the browser is served from a different origin than the proxy, set a precise `MISSION_CONTROL_CORS_ORIGIN`; do not use wildcard CORS unless explicitly accepting that risk.
- The Unraid container is the PRIMARY production target. baset-ai is for development, staging, and as fallback.
- V1 container must be explicitly stopped before starting V2 to avoid port conflicts.
- Direct HTTPS on port 3443 is the primary production access path. Direct port 3187 is plain HTTP and should only be used for health checks or to verify sensitive-route `403` denials; never use it for login, cookies, admin tokens, Kanban, or PTY.
