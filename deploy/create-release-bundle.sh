#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
release_dir="$project_root/shared/releases"
bundle="$release_dir/sora-missioncontrol-$stamp.tar.gz"

mkdir -p "$release_dir"
cd "$project_root"

npm run build

tar -czf "$bundle" \
  --exclude='node_modules' \
  --exclude='shared/releases' \
  --exclude='shared/playwright-results' \
  --exclude='coverage' \
  --exclude='*.tsbuildinfo' \
  package.json \
  package-lock.json \
  missionControlProxy.js \
  index.html \
  tsconfig.json \
  vite.config.ts \
  vitest.config.ts \
  src \
  public \
  Dockerfile \
  docker-compose.yml \
  .env.proxy \
  docs \
  deploy/create-release-bundle.sh \
  deploy/sora-missioncontrol-proxy.service \
  deploy/sora-missioncontrol-proxy-dev.service \
  deploy/OPERATOR-RUNBOOK.md \
  deploy/hermes-bridge.sh \
  README.md \
  AGENTS.md \
  OVERVIEW.md \
  dist

printf '%s\n' "$bundle"
