import fs from "fs/promises";
import path from "path";
import { isDbEnabled, isDatabaseRequired, queryOne } from "./db";
import {
  getRuntimeGuardrailIssues,
  listHighFrequencyStateFiles,
  listMigrationPriorityStateFiles,
  shouldEnforceRuntimeGuardrails
} from "./runtime-guardrails";

type HealthState = "pass" | "warn" | "fail";

export type HealthCheckResult = {
  name: string;
  state: HealthState;
  required: boolean;
  message: string;
  details?: Record<string, unknown>;
};

export type ReadinessPayload = {
  ok: boolean;
  ready: boolean;
  service: string;
  mode: "readiness";
  ts: string;
  summary: {
    checks: number;
    pass: number;
    warn: number;
    fail: number;
  };
  checks: HealthCheckResult[];
};

function parseBooleanEnv(value: string | undefined) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") return false;
  return null;
}

function isObjectStorageEnabled(envName: string, defaultValue: boolean) {
  const parsed = parseBooleanEnv(process.env[envName]);
  if (parsed === null) return defaultValue;
  return parsed;
}

function getObjectStorageRoot() {
  const configured = process.env.OBJECT_STORAGE_ROOT?.trim();
  if (configured) {
    return configured;
  }
  return path.join(process.cwd(), ".runtime-data", "objects");
}

function getRuntimeDataRoot() {
  return path.resolve(process.cwd(), process.env.DATA_DIR ?? ".runtime-data");
}

function getSeedDataRoot() {
  return path.resolve(process.cwd(), process.env.DATA_SEED_DIR ?? "data");
}

export function getLivenessPayload() {
  return {
    ok: true,
    alive: true,
    service: "k12-ai-tutor",
    mode: "liveness" as const,
    ts: new Date().toISOString()
  };
}

async function checkDatabase(runtimeIssues: string[]): Promise<HealthCheckResult> {
  const required = shouldEnforceRuntimeGuardrails() || isDatabaseRequired() || Boolean(process.env.DATABASE_URL?.trim());

  if (!isDbEnabled()) {
    return {
      name: "database",
      required,
      state: required ? "fail" : "warn",
      message: required ? "database not configured" : "running with JSON fallback",
      details: {
        configured: false,
        required
      }
    };
  }

  if (runtimeIssues.length) {
    return {
      name: "database",
      required: true,
      state: "warn",
      message: "database configured, readiness probe skipped because runtime guardrails are failing",
      details: {
        configured: true,
        skipped: true
      }
    };
  }

  try {
    const row = await queryOne<{ ok: number }>("SELECT 1 as ok");
    return {
      name: "database",
      required: true,
      state: row?.ok === 1 ? "pass" : "fail",
      message: row?.ok === 1 ? "database reachable" : "database probe returned unexpected result",
      details: {
        configured: true
      }
    };
  } catch (error) {
    return {
      name: "database",
      required: true,
      state: "fail",
      message: "database probe failed",
      details: {
        configured: true,
        error: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

async function checkObjectStorage(runtimeIssues: string[]): Promise<HealthCheckResult> {
  const enabled =
    isObjectStorageEnabled("FILE_OBJECT_STORAGE_ENABLED", true) ||
    isObjectStorageEnabled("LIBRARY_OBJECT_STORAGE_ENABLED", true);
  const explicitRoot = process.env.OBJECT_STORAGE_ROOT?.trim() || null;
  const allowDefaultRoot = parseBooleanEnv(process.env.OBJECT_STORAGE_ALLOW_DEFAULT_ROOT) === true;
  const root = getObjectStorageRoot();
  const strict = shouldEnforceRuntimeGuardrails();

  if (!enabled) {
    return {
      name: "objectStorage",
      required: false,
      state: "warn",
      message: "object storage disabled by configuration",
      details: {
        enabled: false
      }
    };
  }

  if (strict && !explicitRoot && !allowDefaultRoot) {
    return {
      name: "objectStorage",
      required: true,
      state: "fail",
      message: "object storage root must be explicitly configured in guarded runtime",
      details: {
        enabled: true,
        root,
        explicitRootConfigured: false
      }
    };
  }

  if (runtimeIssues.length && strict) {
    return {
      name: "objectStorage",
      required: true,
      state: "warn",
      message: "object storage configuration pending runtime guardrail cleanup",
      details: {
        enabled: true,
        root,
        explicitRootConfigured: Boolean(explicitRoot)
      }
    };
  }

  try {
    await fs.mkdir(root, { recursive: true });
    await fs.access(root);
    return {
      name: "objectStorage",
      required: true,
      state: explicitRoot || allowDefaultRoot || !strict ? "pass" : "warn",
      message: explicitRoot
        ? "object storage root is writable"
        : allowDefaultRoot
          ? "object storage root is writable via approved default path"
          : "object storage root is writable via default local path",
      details: {
        enabled: true,
        root,
        explicitRootConfigured: Boolean(explicitRoot)
      }
    };
  } catch (error) {
    return {
      name: "objectStorage",
      required: true,
      state: "fail",
      message: "object storage root is not writable",
      details: {
        enabled: true,
        root,
        explicitRootConfigured: Boolean(explicitRoot),
        error: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

function checkJsonFallback(runtimeIssues: string[]): HealthCheckResult {
  const enabled = parseBooleanEnv(process.env.ALLOW_JSON_FALLBACK);
  const strict = shouldEnforceRuntimeGuardrails();
  if (strict && enabled === true) {
    return {
      name: "jsonFallback",
      required: true,
      state: "fail",
      message: "JSON fallback must be disabled in guarded runtime",
      details: {
        allowJsonFallback: true,
        runtimeIssues: runtimeIssues.length
      }
    };
  }

  if (enabled === true) {
    return {
      name: "jsonFallback",
      required: false,
      state: "warn",
      message: "JSON fallback still enabled",
      details: {
        allowJsonFallback: true
      }
    };
  }

  return {
    name: "jsonFallback",
    required: strict,
    state: "pass",
    message: "JSON fallback disabled for runtime traffic",
    details: {
      allowJsonFallback: Boolean(enabled)
    }
  };
}

function checkRuntimeGuardrails(runtimeIssues: string[]): HealthCheckResult {
  if (!shouldEnforceRuntimeGuardrails()) {
    return {
      name: "runtimeGuardrails",
      required: false,
      state: "warn",
      message: "runtime guardrails not enforced in this environment",
      details: {
        enforced: false
      }
    };
  }

  if (!runtimeIssues.length) {
    return {
      name: "runtimeGuardrails",
      required: true,
      state: "pass",
      message: "runtime guardrails satisfied",
      details: {
        enforced: true
      }
    };
  }

  return {
    name: "runtimeGuardrails",
    required: true,
    state: "fail",
    message: "runtime guardrails failing",
    details: {
      enforced: true,
      issues: runtimeIssues
    }
  };
}

async function checkHighFrequencyStateFiles(): Promise<HealthCheckResult> {
  const runtimeRoot = getRuntimeDataRoot();
  const seedRoot = getSeedDataRoot();
  const runtimeFiles: string[] = [];
  const seedFiles: string[] = [];
  const strict = shouldEnforceRuntimeGuardrails();

  await Promise.all(
    listHighFrequencyStateFiles().map(async (fileName) => {
      try {
        await fs.access(path.join(runtimeRoot, fileName));
        runtimeFiles.push(fileName);
      } catch {
        // ignore missing runtime files
      }

      try {
        await fs.access(path.join(seedRoot, fileName));
        seedFiles.push(fileName);
      } catch {
        // ignore missing seed files
      }
    })
  );

  runtimeFiles.sort();
  seedFiles.sort();

  if (!runtimeFiles.length && !seedFiles.length) {
    return {
      name: "highFrequencyState",
      required: strict,
      state: "pass",
      message: "no high-frequency JSON state files detected",
      details: {
        runtimeRoot,
        seedRoot
      }
    };
  }

  return {
    name: "highFrequencyState",
    required: strict,
    state: strict ? "fail" : "warn",
    message: strict
      ? "high-frequency JSON state files detected on local disk"
      : "high-frequency JSON state files present in local storage",
    details: {
      runtimeRoot,
      seedRoot,
      runtimeFiles,
      seedFiles
    }
  };
}

async function checkMigrationPriorityStateFiles(): Promise<HealthCheckResult> {
  const runtimeRoot = getRuntimeDataRoot();
  const seedRoot = getSeedDataRoot();
  const runtimeFiles: string[] = [];
  const seedFiles: string[] = [];

  await Promise.all(
    listMigrationPriorityStateFiles().map(async (fileName) => {
      try {
        await fs.access(path.join(runtimeRoot, fileName));
        runtimeFiles.push(fileName);
      } catch {
        // ignore missing runtime files
      }

      try {
        await fs.access(path.join(seedRoot, fileName));
        seedFiles.push(fileName);
      } catch {
        // ignore missing seed files
      }
    })
  );

  runtimeFiles.sort();
  seedFiles.sort();

  if (!runtimeFiles.length && !seedFiles.length) {
    return {
      name: "migrationPriorityState",
      required: false,
      state: "pass",
      message: "no migration-priority JSON state files detected",
      details: {
        runtimeRoot,
        seedRoot
      }
    };
  }

  return {
    name: "migrationPriorityState",
    required: false,
    state: "warn",
    message: "migration-priority JSON state files still present on local disk",
    details: {
      runtimeRoot,
      seedRoot,
      runtimeFiles,
      seedFiles
    }
  };
}

export async function getReadinessPayload(): Promise<ReadinessPayload> {
  const runtimeIssues = getRuntimeGuardrailIssues();
  const checks = [
    checkRuntimeGuardrails(runtimeIssues),
    await checkDatabase(runtimeIssues),
    await checkObjectStorage(runtimeIssues),
    checkJsonFallback(runtimeIssues),
    await checkHighFrequencyStateFiles(),
    await checkMigrationPriorityStateFiles()
  ];

  const summary = checks.reduce(
    (acc, check) => {
      acc.checks += 1;
      if (check.state === "pass") acc.pass += 1;
      if (check.state === "warn") acc.warn += 1;
      if (check.state === "fail") acc.fail += 1;
      return acc;
    },
    { checks: 0, pass: 0, warn: 0, fail: 0 }
  );

  return {
    ok: summary.fail === 0,
    ready: summary.fail === 0,
    service: "k12-ai-tutor",
    mode: "readiness",
    ts: new Date().toISOString(),
    summary,
    checks
  };
}
