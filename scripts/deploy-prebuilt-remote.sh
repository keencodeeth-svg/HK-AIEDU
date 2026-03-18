#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  DEPLOY_REMOTE_HOST=root@example.com npm run deploy:remote:prebuilt

Required env:
  DEPLOY_REMOTE_HOST            SSH target, for example root@8.136.122.236

Common optional env:
  DEPLOY_EXTERNAL_HEALTH_URL    External health URL, for example https://8.136.122.236/api/health
  DEPLOY_REMOTE_ENV_SOURCE      Remote env source file, default /var/www/HK-AIEDU/.env.production
  DEPLOY_REMOTE_REPO_DIR        Remote repo dir, default /var/www/HK-AIEDU
  DEPLOY_REMOTE_RELEASES_DIR    Remote releases dir, default /var/www/releases
  DEPLOY_PM2_APP_NAME           PM2 app name, default hk-ai-edu
  DEPLOY_CANARY_APP_NAME        PM2 canary app name, default <app>-canary
  DEPLOY_SKIP_BUILD             Skip local build when set to 1
  DEPLOY_ALLOW_DIRTY            Allow deploying a dirty worktree when set to 1
  DEPLOY_SKIP_CANARY            Skip port 3001 canary when set to 1

What it does:
  1. Optionally runs a local build.
  2. Creates a prebuilt release archive without node_modules or .next/cache.
  3. Uploads the archive to the remote host.
  4. Restores the remote .env.production into the release dir.
  5. Installs production deps only, runs db:migrate, starts canary, then cuts PM2 over.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

log() {
  printf '[deploy] %s\n' "$1"
}

require_cmd git
require_cmd npm
require_cmd tar
require_cmd ssh
require_cmd scp
require_cmd curl

DEPLOY_REMOTE_HOST="${DEPLOY_REMOTE_HOST:-}"
if [[ -z "$DEPLOY_REMOTE_HOST" ]]; then
  usage >&2
  echo "DEPLOY_REMOTE_HOST is required." >&2
  exit 1
fi

DEPLOY_PROJECT_NAME="${DEPLOY_PROJECT_NAME:-HK-AIEDU}"
DEPLOY_REMOTE_REPO_DIR="${DEPLOY_REMOTE_REPO_DIR:-/var/www/HK-AIEDU}"
DEPLOY_REMOTE_RELEASES_DIR="${DEPLOY_REMOTE_RELEASES_DIR:-/var/www/releases}"
DEPLOY_REMOTE_ENV_SOURCE="${DEPLOY_REMOTE_ENV_SOURCE:-$DEPLOY_REMOTE_REPO_DIR/.env.production}"
DEPLOY_PM2_APP_NAME="${DEPLOY_PM2_APP_NAME:-hk-ai-edu}"
DEPLOY_CANARY_APP_NAME="${DEPLOY_CANARY_APP_NAME:-${DEPLOY_PM2_APP_NAME}-canary}"
DEPLOY_TARGET_COMMIT="${DEPLOY_TARGET_COMMIT:-$(git rev-parse HEAD)}"
DEPLOY_BUILD_COMMAND="${DEPLOY_BUILD_COMMAND:-npm run build}"
DEPLOY_REMOTE_INSTALL_COMMAND="${DEPLOY_REMOTE_INSTALL_COMMAND:-npm ci --omit=dev --no-audit --no-fund}"
DEPLOY_REMOTE_MIGRATE_COMMAND="${DEPLOY_REMOTE_MIGRATE_COMMAND:-npm run db:migrate}"
DEPLOY_REMOTE_PRODUCTION_PORT="${DEPLOY_REMOTE_PRODUCTION_PORT:-3000}"
DEPLOY_REMOTE_CANARY_PORT="${DEPLOY_REMOTE_CANARY_PORT:-3001}"
DEPLOY_CANARY_WAIT_SECONDS="${DEPLOY_CANARY_WAIT_SECONDS:-8}"
DEPLOY_PRODUCTION_WAIT_SECONDS="${DEPLOY_PRODUCTION_WAIT_SECONDS:-5}"
DEPLOY_EXTERNAL_HEALTH_URL="${DEPLOY_EXTERNAL_HEALTH_URL:-}"
DEPLOY_SKIP_BUILD="${DEPLOY_SKIP_BUILD:-0}"
DEPLOY_ALLOW_DIRTY="${DEPLOY_ALLOW_DIRTY:-0}"
DEPLOY_SKIP_CANARY="${DEPLOY_SKIP_CANARY:-0}"
DEPLOY_SSH_PORT="${DEPLOY_SSH_PORT:-22}"

SSH_OPTS=(-p "$DEPLOY_SSH_PORT" -o ConnectTimeout=20)
SCP_OPTS=(-P "$DEPLOY_SSH_PORT" -o ConnectTimeout=20)

WORKTREE_STATUS="$(git status --short)"
RELEASE_LABEL="$DEPLOY_TARGET_COMMIT"
if [[ -n "$WORKTREE_STATUS" ]]; then
  if [[ "$DEPLOY_ALLOW_DIRTY" != "1" ]]; then
    echo "Refusing to deploy a dirty worktree. Commit/stash changes or set DEPLOY_ALLOW_DIRTY=1." >&2
    git status --short >&2
    exit 1
  fi
  RELEASE_LABEL="${DEPLOY_TARGET_COMMIT}-dirty-$(date '+%Y%m%d%H%M%S')"
fi

if [[ "$DEPLOY_SKIP_BUILD" != "1" ]]; then
  log "Running local build: $DEPLOY_BUILD_COMMAND"
  eval "$DEPLOY_BUILD_COMMAND"
else
  log "Skipping local build because DEPLOY_SKIP_BUILD=1"
fi

if [[ ! -f ".next/BUILD_ID" ]]; then
  echo "Missing .next/BUILD_ID. Run a local build first or unset DEPLOY_SKIP_BUILD." >&2
  exit 1
fi

TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/hk-ai-edu-deploy.XXXXXX")"
ARCHIVE_NAME="${DEPLOY_PROJECT_NAME}-${RELEASE_LABEL}-prebuilt.tgz"
ARCHIVE_PATH="$TEMP_DIR/$ARCHIVE_NAME"
REMOTE_ARCHIVE_PATH="$DEPLOY_REMOTE_RELEASES_DIR/$ARCHIVE_NAME"
REMOTE_RELEASE_DIR="$DEPLOY_REMOTE_RELEASES_DIR/${DEPLOY_PROJECT_NAME}-${RELEASE_LABEL}"

cleanup() {
  rm -rf "$TEMP_DIR"
}

trap cleanup EXIT

log "Creating prebuilt archive at $ARCHIVE_PATH"
export COPYFILE_DISABLE=1
export COPY_EXTENDED_ATTRIBUTES_DISABLE=1
tar \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.next/cache' \
  --exclude='.runtime-data' \
  --exclude='coverage' \
  --exclude='playwright-report' \
  --exclude='test-results' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='.env.production' \
  --exclude='.DS_Store' \
  -czf "$ARCHIVE_PATH" \
  .

log "Uploading archive to $DEPLOY_REMOTE_HOST:$REMOTE_ARCHIVE_PATH"
ssh "${SSH_OPTS[@]}" "$DEPLOY_REMOTE_HOST" "mkdir -p '$DEPLOY_REMOTE_RELEASES_DIR'"
scp "${SCP_OPTS[@]}" "$ARCHIVE_PATH" "$DEPLOY_REMOTE_HOST:$REMOTE_ARCHIVE_PATH"

log "Activating remote release $REMOTE_RELEASE_DIR"
ssh "${SSH_OPTS[@]}" "$DEPLOY_REMOTE_HOST" bash -s -- \
  "$DEPLOY_TARGET_COMMIT" \
  "$DEPLOY_PROJECT_NAME" \
  "$DEPLOY_REMOTE_ENV_SOURCE" \
  "$DEPLOY_REMOTE_RELEASES_DIR" \
  "$REMOTE_RELEASE_DIR" \
  "$REMOTE_ARCHIVE_PATH" \
  "$DEPLOY_PM2_APP_NAME" \
  "$DEPLOY_CANARY_APP_NAME" \
  "$DEPLOY_REMOTE_PRODUCTION_PORT" \
  "$DEPLOY_REMOTE_CANARY_PORT" \
  "$DEPLOY_CANARY_WAIT_SECONDS" \
  "$DEPLOY_PRODUCTION_WAIT_SECONDS" \
  "$DEPLOY_SKIP_CANARY" \
  "$DEPLOY_REMOTE_INSTALL_COMMAND" \
  "$DEPLOY_REMOTE_MIGRATE_COMMAND" <<'REMOTE_SCRIPT'
set -euo pipefail

target_commit="$1"
project_name="$2"
remote_env_source="$3"
remote_releases_dir="$4"
remote_release_dir="$5"
remote_archive_path="$6"
pm2_app_name="$7"
canary_app_name="$8"
production_port="$9"
canary_port="${10}"
canary_wait="${11}"
production_wait="${12}"
skip_canary="${13}"
install_command="${14}"
migrate_command="${15}"

load_release_env() {
  set -a
  # shellcheck disable=SC1091
  . "$remote_release_dir/.env.production"
  set +a
}

if [[ ! -f "$remote_env_source" ]]; then
  echo "Remote env source not found: $remote_env_source" >&2
  exit 1
fi

mkdir -p "$remote_releases_dir"
rm -rf "$remote_release_dir"
mkdir -p "$remote_release_dir"
tar -xzf "$remote_archive_path" -C "$remote_release_dir"
rm -f "$remote_archive_path"
cp "$remote_env_source" "$remote_release_dir/.env.production"
cd "$remote_release_dir"

printf 'commit=%s\n' "$target_commit" > DEPLOYMENT_INFO
printf 'project=%s\n' "$project_name" >> DEPLOYMENT_INFO
printf 'released_at=%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" >> DEPLOYMENT_INFO

export NEXT_TELEMETRY_DISABLED=1
export NODE_ENV=production

eval "$install_command"
load_release_env

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL not set after loading .env.production" >&2
  exit 1
fi

eval "$migrate_command"

if [[ "$skip_canary" != "1" ]]; then
  pm2 delete "$canary_app_name" >/dev/null 2>&1 || true
  load_release_env
  pm2 start npm --name "$canary_app_name" --cwd "$remote_release_dir" -- start -- -p "$canary_port" -H 127.0.0.1 >/dev/null
  sleep "$canary_wait"
  curl -fsS "http://127.0.0.1:${canary_port}/api/health" >/dev/null
  if [[ -n "${READINESS_PROBE_TOKEN:-}" ]]; then
    curl -fsS -H "x-readiness-token: $READINESS_PROBE_TOKEN" "http://127.0.0.1:${canary_port}/api/health/readiness" >/dev/null
  fi
fi

pm2 delete "$pm2_app_name" >/dev/null 2>&1 || true
load_release_env
pm2 start npm --name "$pm2_app_name" --cwd "$remote_release_dir" -- start -- -p "$production_port" -H 127.0.0.1 >/dev/null
sleep "$production_wait"
curl -fsS "http://127.0.0.1:${production_port}/api/health" >/dev/null
if [[ -n "${READINESS_PROBE_TOKEN:-}" ]]; then
  curl -fsS -H "x-readiness-token: $READINESS_PROBE_TOKEN" "http://127.0.0.1:${production_port}/api/health/readiness" >/dev/null
fi

pm2 delete "$canary_app_name" >/dev/null 2>&1 || true
pm2 save >/dev/null
pm2 list
REMOTE_SCRIPT

if [[ -n "$DEPLOY_EXTERNAL_HEALTH_URL" ]]; then
  log "Checking external health: $DEPLOY_EXTERNAL_HEALTH_URL"
  curl -fsS --max-time 20 "$DEPLOY_EXTERNAL_HEALTH_URL" >/dev/null
fi

log "Remote deploy complete for $RELEASE_LABEL"
log "Active release: $REMOTE_RELEASE_DIR"
