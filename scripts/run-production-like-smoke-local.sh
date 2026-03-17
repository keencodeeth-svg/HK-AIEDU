#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="${PRODUCTION_LIKE_COMPOSE_FILE:-docker-compose.local.yml}"
DB_HOST="${PRODUCTION_LIKE_DB_HOST:-127.0.0.1}"
DB_PORT="${PRODUCTION_LIKE_DB_PORT:-54329}"
DB_NAME="${PRODUCTION_LIKE_DB_NAME:-hk_aiedu_local}"
DB_USER="${PRODUCTION_LIKE_DB_USER:-postgres}"
DB_PASSWORD="${PRODUCTION_LIKE_DB_PASSWORD:-postgres}"
USE_EXISTING_DB="${PRODUCTION_LIKE_USE_EXISTING_DB:-0}"
TEST_SCRIPT="${PRODUCTION_LIKE_TEST_SCRIPT:-${PRODUCTION_LIKE_API_TEST_SCRIPT:-test:smoke:production-like}}"

TEMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/hk-ai-edu-production-like.XXXXXX")"
RUNTIME_DIR="$TEMP_ROOT/runtime-data"
SEED_DIR="$TEMP_ROOT/data"

cleanup() {
  rm -rf "$TEMP_ROOT"
}

trap cleanup EXIT

mkdir -p "$RUNTIME_DIR" "$SEED_DIR"
cp -R data/. "$SEED_DIR"/

for blocked_file in \
  admin-logs.json \
  analytics-events.json \
  assignment-progress.json \
  assignment-submissions.json \
  auth-login-attempts.json \
  auth-login-profiles.json \
  auth-recovery-attempts.json \
  correction-tasks.json \
  exam-answers.json \
  exam-assignments.json \
  exam-submissions.json \
  focus-sessions.json \
  mastery-records.json \
  memory-reviews.json \
  notifications.json \
  parent-action-receipts.json \
  question-attempts.json \
  review-tasks.json \
  sessions.json \
  study-plans.json \
  wrong-review-items.json
do
  rm -f "$SEED_DIR/$blocked_file"
done

if [[ "$USE_EXISTING_DB" != "1" ]] && ! command -v docker >/dev/null 2>&1; then
  echo "docker is required for local production-like smoke."
  exit 1
fi

if [[ "$USE_EXISTING_DB" != "1" ]] && ! docker compose version >/dev/null 2>&1; then
  echo "docker compose is required for local production-like smoke."
  exit 1
fi

echo "Waiting for local PostgreSQL to become ready..."
if [[ "$USE_EXISTING_DB" == "1" ]]; then
  for attempt in $(seq 1 30); do
    if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
      break
    fi

    if [[ "$attempt" == "30" ]]; then
      echo "PostgreSQL did not become ready in time."
      exit 1
    fi

    sleep 2
  done
else
  if [[ "${PRODUCTION_LIKE_SKIP_DOCKER_UP:-0}" != "1" ]]; then
    docker compose -f "$COMPOSE_FILE" up -d postgres
  fi

  for attempt in $(seq 1 30); do
    if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
      break
    fi

    if [[ "$attempt" == "30" ]]; then
      echo "PostgreSQL did not become ready in time."
      exit 1
    fi

    sleep 2
  done
fi

export DATABASE_URL="${DATABASE_URL:-postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}}"
export DB_SSL="${DB_SSL:-false}"
export REQUIRE_DATABASE="true"
export ALLOW_JSON_FALLBACK="false"
export DATA_DIR="${DATA_DIR:-$RUNTIME_DIR}"
export DATA_SEED_DIR="${DATA_SEED_DIR:-$SEED_DIR}"
export OBJECT_STORAGE_ROOT="${OBJECT_STORAGE_ROOT:-$TEMP_ROOT/objects}"
export FILE_OBJECT_STORAGE_ENABLED="${FILE_OBJECT_STORAGE_ENABLED:-true}"
export LIBRARY_OBJECT_STORAGE_ENABLED="${LIBRARY_OBJECT_STORAGE_ENABLED:-true}"
export FILE_INLINE_CONTENT="${FILE_INLINE_CONTENT:-false}"
export LIBRARY_INLINE_FILE_CONTENT="${LIBRARY_INLINE_FILE_CONTENT:-false}"
export READINESS_PROBE_TOKEN="${READINESS_PROBE_TOKEN:-local-readiness-token}"

echo "Using DATABASE_URL=${DATABASE_URL}"
echo "Using DATA_DIR=${DATA_DIR}"
echo "Using DATA_SEED_DIR=${DATA_SEED_DIR}"
echo "Using OBJECT_STORAGE_ROOT=${OBJECT_STORAGE_ROOT}"
echo "Using PRODUCTION_LIKE_TEST_SCRIPT=${TEST_SCRIPT}"

npm run build
npm run db:migrate
npm run seed:base
npm run seed:stage3
npm run security:migrate-passwords
npm run "$TEST_SCRIPT"
