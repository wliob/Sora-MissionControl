#!/bin/sh
# Hermes Runtime Bridge — SSH wrapper for Unraid containers
# Replaces /usr/local/bin/hermes — execs hermes on AI host via SSH.
# Cloud · Sora-MissionControl · 2026-06-25
#
# Env vars:
#   HERMES_REMOTE_USER      SSH user (default: wliob)
#   HERMES_REMOTE_HOST      AI host IP (default: 192.168.0.85)
#   HERMES_REMOTE_PATH      Path to hermes on remote (default: /home/wliob/.local/bin/hermes)
#   HERMES_SSH_KEY          Path to SSH private key (default: /var/run/secrets/hermes_tunnel)
#   HERMES_ACCEPT_HOOKS     Passed through to remote hermes if set to "1"

set -e

REMOTE_USER="${HERMES_REMOTE_USER:-wliob}"
REMOTE_HOST="${HERMES_REMOTE_HOST:-192.168.0.85}"
REMOTE_HERMES="${HERMES_REMOTE_PATH:-/home/wliob/.local/bin/hermes}"
SSH_KEY="${HERMES_SSH_KEY:-/var/run/secrets/hermes_tunnel}"
SSH_OPTS="-o ConnectTimeout=15 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o BatchMode=yes -o LogLevel=ERROR"

if [ ! -f "$SSH_KEY" ]; then
  echo "hermes-bridge: SSH key not found at $SSH_KEY" >&2
  exit 69
fi

# Build the remote command.
# We shell-quote every argument so spaces/special chars survive the SSH trip.
REMOTE_CMD=""
if [ "${HERMES_ACCEPT_HOOKS:-0}" = "1" ]; then
  REMOTE_CMD="HERMES_ACCEPT_HOOKS=1 "
fi
REMOTE_CMD="${REMOTE_CMD}${REMOTE_HERMES}"

for arg in "$@"; do
  # Escape single quotes: replace ' with '\'' then wrap in single quotes
  escaped=$(printf '%s' "$arg" | sed "s/'/'\\\\''/g")
  REMOTE_CMD="${REMOTE_CMD} '${escaped}'"
done

exec ssh $SSH_OPTS -i "$SSH_KEY" "${REMOTE_USER}@${REMOTE_HOST}" "$REMOTE_CMD"
