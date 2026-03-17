const warnedJsonFallbackFiles = new Set<string>();
let lastLoggedIssueKey: string | null = null;

const HIGH_FREQUENCY_STATE_FILES = new Set([
  "admin-logs.json",
  "analytics-events.json",
  "assignment-progress.json",
  "assignment-submissions.json",
  "auth-login-attempts.json",
  "auth-login-profiles.json",
  "auth-recovery-attempts.json",
  "correction-tasks.json",
  "exam-answers.json",
  "exam-assignments.json",
  "exam-submissions.json",
  "focus-sessions.json",
  "mastery-records.json",
  "memory-reviews.json",
  "notifications.json",
  "parent-action-receipts.json",
  "question-attempts.json",
  "review-tasks.json",
  "sessions.json",
  "study-plans.json",
  "wrong-review-items.json"
]);

const MIGRATION_PRIORITY_STATE_FILES = new Set<string>();

function parseBooleanEnv(value: string | undefined) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") return false;
  return null;
}

function isBuildPhase() {
  return process.env.NEXT_PHASE === "phase-production-build" || process.env.npm_lifecycle_event === "build";
}

function isApiTestRuntime() {
  if (process.env.NODE_ENV === "test") return true;
  if ((process.env.API_TEST_SUITE ?? process.env.API_TEST_SCOPE)?.trim()) return true;
  if (process.env.API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER === "true") return true;
  return false;
}

function isProductionRuntime() {
  return process.env.NODE_ENV === "production" && !isBuildPhase();
}

function isObjectStorageEnabled(envName: string, defaultValue: boolean) {
  const parsed = parseBooleanEnv(process.env[envName]);
  if (parsed === null) return defaultValue;
  return parsed;
}

export function shouldEnforceRuntimeGuardrails() {
  const explicit = parseBooleanEnv(process.env.RUNTIME_GUARDRAILS_ENFORCE);
  if (explicit !== null) return explicit;
  return isProductionRuntime() && !isApiTestRuntime();
}

export function shouldAllowDbBootstrapFromJsonFallback() {
  if (shouldEnforceRuntimeGuardrails()) return false;
  const explicitAllowJsonFallback = parseBooleanEnv(process.env.ALLOW_JSON_FALLBACK);
  if (explicitAllowJsonFallback === false) return false;
  return true;
}

export function getRuntimeGuardrailIssues() {
  if (!shouldEnforceRuntimeGuardrails()) return [] as string[];

  const issues: string[] = [];
  if (!process.env.DATABASE_URL?.trim()) {
    issues.push("DATABASE_URL is required when runtime guardrails are enforced.");
  }
  if (parseBooleanEnv(process.env.ALLOW_JSON_FALLBACK) === true) {
    issues.push("ALLOW_JSON_FALLBACK=true is not allowed when runtime guardrails are enforced.");
  }
  if (parseBooleanEnv(process.env.FILE_INLINE_CONTENT) === true) {
    issues.push("FILE_INLINE_CONTENT=true is not allowed when runtime guardrails are enforced.");
  }
  if (parseBooleanEnv(process.env.LIBRARY_INLINE_FILE_CONTENT) === true) {
    issues.push("LIBRARY_INLINE_FILE_CONTENT=true is not allowed when runtime guardrails are enforced.");
  }

  const objectStorageRequired =
    isObjectStorageEnabled("FILE_OBJECT_STORAGE_ENABLED", true) ||
    isObjectStorageEnabled("LIBRARY_OBJECT_STORAGE_ENABLED", true);
  const allowDefaultObjectStorageRoot = parseBooleanEnv(process.env.OBJECT_STORAGE_ALLOW_DEFAULT_ROOT) === true;
  if (objectStorageRequired && !process.env.OBJECT_STORAGE_ROOT?.trim() && !allowDefaultObjectStorageRoot) {
    issues.push(
      "OBJECT_STORAGE_ROOT must be set when runtime guardrails are enforced. Set OBJECT_STORAGE_ALLOW_DEFAULT_ROOT=true only if you intentionally accept the local default path."
    );
  }

  return issues;
}

export function logRuntimeGuardrailIssues(issues: string[]) {
  if (!issues.length) return;
  const key = issues.join("|");
  if (lastLoggedIssueKey === key) return;
  lastLoggedIssueKey = key;
  console.error(`[runtime-guardrails] ${issues.join(" ")}`);
}

export function assertRuntimeGuardrails() {
  const issues = getRuntimeGuardrailIssues();
  if (!issues.length) return;
  logRuntimeGuardrailIssues(issues);
  throw new Error(`[runtime-guardrails] ${issues.join(" ")}`);
}

export function requiresDatabaseBackedState(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  if (!normalized) return false;

  const explicit = parseBooleanEnv(process.env.HIGH_FREQUENCY_STATE_REQUIRE_DB);
  if (explicit === false) return false;
  if (explicit === true) return HIGH_FREQUENCY_STATE_FILES.has(normalized);

  return shouldEnforceRuntimeGuardrails() && HIGH_FREQUENCY_STATE_FILES.has(normalized);
}

export function isHighFrequencyStateFile(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  if (!normalized) return false;
  return HIGH_FREQUENCY_STATE_FILES.has(normalized);
}

export function listHighFrequencyStateFiles() {
  return Array.from(HIGH_FREQUENCY_STATE_FILES).sort();
}

export function isMigrationPriorityStateFile(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  if (!normalized) return false;
  return MIGRATION_PRIORITY_STATE_FILES.has(normalized);
}

export function listMigrationPriorityStateFiles() {
  return Array.from(MIGRATION_PRIORITY_STATE_FILES).sort();
}

export function warnOnJsonFallbackUsage(fileName: string) {
  if (!shouldEnforceRuntimeGuardrails()) return;
  const normalized = fileName.trim().toLowerCase();
  if (!normalized || warnedJsonFallbackFiles.has(normalized)) return;
  warnedJsonFallbackFiles.add(normalized);
  if (isMigrationPriorityStateFile(normalized)) {
    console.warn(
      `[runtime-guardrails] JSON storage fallback touched "${fileName}" while runtime guardrails are enforced. This file is in the migration-priority set and should move to database-backed state before broad rollout.`
    );
    return;
  }
  console.warn(
    `[runtime-guardrails] JSON storage fallback touched "${fileName}" while runtime guardrails are enforced. Migrate this state off runtime disk before broad rollout.`
  );
}
