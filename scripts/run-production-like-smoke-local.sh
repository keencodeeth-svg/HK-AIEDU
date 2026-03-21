#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="${PRODUCTION_LIKE_COMPOSE_FILE:-docker-compose.local.yml}"
DB_HOST="${PRODUCTION_LIKE_DB_HOST:-127.0.0.1}"
DB_PORT="${PRODUCTION_LIKE_DB_PORT:-54329}"
DB_USER="${PRODUCTION_LIKE_DB_USER:-postgres}"
DB_PASSWORD="${PRODUCTION_LIKE_DB_PASSWORD:-postgres}"
DB_NAME_ENV="${PRODUCTION_LIKE_DB_NAME:-}"
ADMIN_DB_NAME="${PRODUCTION_LIKE_ADMIN_DB_NAME:-postgres}"
USE_EXISTING_DB="${PRODUCTION_LIKE_USE_EXISTING_DB:-0}"
TEST_SCRIPT="${PRODUCTION_LIKE_TEST_SCRIPT:-${PRODUCTION_LIKE_API_TEST_SCRIPT:-test:smoke:production-like}}"
EPHEMERAL_DB_MODE="${PRODUCTION_LIKE_EPHEMERAL_DB:-auto}"
RESET_DB="${PRODUCTION_LIKE_DB_RESET:-0}"
KEEP_DB="${PRODUCTION_LIKE_KEEP_DB:-0}"

TEMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/hk-ai-edu-production-like.XXXXXX")"
RUNTIME_DIR="$TEMP_ROOT/runtime-data"
SEED_DIR="$TEMP_ROOT/data"
DB_NAME=""
EPHEMERAL_DB_USED=0
DB_CREATED=0

normalize_flag() {
  local value
  value="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')"
  case "$value" in
    1|true|yes|on)
      printf '1'
      ;;
    0|false|no|off|"")
      printf '0'
      ;;
    *)
      echo "Invalid boolean flag: ${1:-}" >&2
      exit 1
      ;;
  esac
}

flag_is_true() {
  [[ "$(normalize_flag "${1:-}")" == "1" ]]
}

infer_db_name_from_url() {
  local url="$1"
  local fallback="$2"
  if [[ -z "$url" ]]; then
    printf '%s' "$fallback"
    return
  fi

  local without_query="${url%%\?*}"
  local candidate="${without_query##*/}"
  if [[ -z "$candidate" || "$candidate" == "$without_query" ]]; then
    printf '%s' "$fallback"
    return
  fi
  printf '%s' "$candidate"
}

should_use_ephemeral_db() {
  local mode
  mode="$(printf '%s' "$EPHEMERAL_DB_MODE" | tr '[:upper:]' '[:lower:]')"
  case "$mode" in
    1|true|yes|on)
      return 0
      ;;
    0|false|no|off)
      return 1
      ;;
    auto|"")
      [[ -z "$DB_NAME_ENV" && -z "${DATABASE_URL:-}" ]]
      return
      ;;
    *)
      echo "Invalid PRODUCTION_LIKE_EPHEMERAL_DB value: $EPHEMERAL_DB_MODE" >&2
      exit 1
      ;;
  esac
}

build_ephemeral_db_name() {
  local base="$1"
  local suffix
  suffix="$(date +%Y%m%d%H%M%S)_$$"
  local max_base_length=$((63 - ${#suffix} - 1))
  if (( max_base_length < 1 )); then
    max_base_length=1
  fi
  printf '%s_%s' "${base:0:max_base_length}" "$suffix"
}

require_local_pg_client() {
  for command_name in pg_isready psql createdb dropdb; do
    if ! command -v "$command_name" >/dev/null 2>&1; then
      echo "$command_name is required when PRODUCTION_LIKE_USE_EXISTING_DB=1."
      exit 1
    fi
  done
}

run_pg_client() {
  local command_name="$1"
  shift
  if [[ "$USE_EXISTING_DB" == "1" ]]; then
    PGPASSWORD="$DB_PASSWORD" "$command_name" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$@"
    return
  fi
  docker compose -f "$COMPOSE_FILE" exec -T postgres env PGPASSWORD="$DB_PASSWORD" \
    "$command_name" -h 127.0.0.1 -p 5432 -U "$DB_USER" "$@"
}

database_exists() {
  local db_name="$1"
  local escaped_name
  escaped_name="$(printf "%s" "$db_name" | sed "s/'/''/g")"
  local result
  result="$(
    run_pg_client psql -d "$ADMIN_DB_NAME" -Atqc \
      "SELECT 1 FROM pg_database WHERE datname = '${escaped_name}' LIMIT 1;"
  )"
  [[ "$result" == "1" ]]
}

create_database() {
  run_pg_client createdb "$1"
  DB_CREATED=1
}

drop_database_if_exists() {
  local db_name="$1"
  if ! database_exists "$db_name"; then
    return 0
  fi
  run_pg_client dropdb --if-exists "$db_name"
  DB_CREATED=0
}

prepare_target_database() {
  if [[ "$(normalize_flag "$RESET_DB")" == "1" ]]; then
    echo "Resetting production-like database $DB_NAME..."
    drop_database_if_exists "$DB_NAME"
    create_database "$DB_NAME"
    return
  fi

  if [[ "$EPHEMERAL_DB_USED" == "1" ]]; then
    echo "Creating isolated production-like database $DB_NAME..."
    create_database "$DB_NAME"
    return
  fi

  if database_exists "$DB_NAME"; then
    echo "Reusing production-like database $DB_NAME"
    return
  fi

  echo "Creating production-like database $DB_NAME..."
  create_database "$DB_NAME"
}

cleanup() {
  local exit_code=$?
  if [[ "$EPHEMERAL_DB_USED" == "1" ]] && [[ "$DB_CREATED" == "1" ]] && ! flag_is_true "$KEEP_DB"; then
    if drop_database_if_exists "$DB_NAME"; then
      echo "Dropped isolated production-like database $DB_NAME"
    else
      echo "Warning: failed to drop isolated production-like database $DB_NAME" >&2
    fi
  fi
  rm -rf "$TEMP_ROOT"
  exit "$exit_code"
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

DB_NAME="$(infer_db_name_from_url "${DATABASE_URL:-}" "hk_aiedu_local")"
if [[ -n "$DB_NAME_ENV" ]]; then
  DB_NAME="$DB_NAME_ENV"
fi
if should_use_ephemeral_db; then
  DB_NAME="$(build_ephemeral_db_name "$DB_NAME")"
  EPHEMERAL_DB_USED=1
fi

if [[ "$USE_EXISTING_DB" != "1" ]] && ! command -v docker >/dev/null 2>&1; then
  echo "docker is required for local production-like smoke."
  exit 1
fi

if [[ "$USE_EXISTING_DB" != "1" ]] && ! docker compose version >/dev/null 2>&1; then
  echo "docker compose is required for local production-like smoke."
  exit 1
fi

if [[ "$USE_EXISTING_DB" == "1" ]]; then
  require_local_pg_client
fi

echo "Waiting for local PostgreSQL to become ready..."
if [[ "$USE_EXISTING_DB" == "1" ]]; then
  for attempt in $(seq 1 30); do
    if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$ADMIN_DB_NAME" >/dev/null 2>&1; then
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
    if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U "$DB_USER" -d "$ADMIN_DB_NAME" >/dev/null 2>&1; then
      break
    fi

    if [[ "$attempt" == "30" ]]; then
      echo "PostgreSQL did not become ready in time."
      exit 1
    fi

    sleep 2
  done
fi

prepare_target_database

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
if [[ "$EPHEMERAL_DB_USED" == "1" ]]; then
  echo "Using isolated production-like database ${DB_NAME}"
  if flag_is_true "$KEEP_DB"; then
    echo "Keeping isolated database after run because PRODUCTION_LIKE_KEEP_DB=1"
  fi
fi

npm run build
npm run db:migrate
npm run seed:base
npm run seed:stage3
npm run security:migrate-passwords
npm run "$TEST_SCRIPT"
