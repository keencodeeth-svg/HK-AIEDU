import crypto from "crypto";
import { readJson, writeJson } from "./storage";
import { isDbEnabled, query, queryOne } from "./db";
import { getUsers } from "./auth";
import { getAttempts } from "./progress";

const EXPERIMENT_FLAGS_FILE = "experiment-flags.json";
export const CHALLENGE_EXPERIMENT_KEY = "challenge_learning_loop_v2";

export type ExperimentVariant = "control" | "treatment";

export type ExperimentFlag = {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rollout: number;
  updatedAt: string;
};

export type ExperimentAssignment = {
  key: string;
  enabled: boolean;
  rollout: number;
  bucket: number;
  variant: ExperimentVariant;
};

type DbExperimentFlag = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  rollout: number;
  updated_at: string;
};

type FlagPreset = {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rollout: number;
};

const DEFAULT_FLAGS: FlagPreset[] = [
  {
    key: CHALLENGE_EXPERIMENT_KEY,
    name: "挑战学习闭环 V2",
    description: "挑战任务从纯打卡升级为薄弱点修复闭环，支持灰度放量。",
    enabled: true,
    rollout: 50
  }
];

export type ABVariantReport = {
  variant: ExperimentVariant;
  users: number;
  retainedUsers: number;
  retentionRate: number;
  attempts: number;
  accuracy: number;
  wrongAttemptUsers: number;
  reviewCompletedUsers: number;
  reviewCompletionRate: number;
};

type ABVariantAccumulator = ABVariantReport & {
  correctAnswers: number;
};

export type ChallengeABReport = {
  experiment: {
    key: string;
    name: string;
    enabled: boolean;
    rollout: number;
  };
  window: {
    days: number;
    from: string;
    to: string;
  };
  variants: ABVariantReport[];
  delta: {
    retentionRate: number;
    accuracy: number;
    reviewCompletionRate: number;
  };
  recommendation: {
    action: "increase" | "decrease" | "keep";
    suggestedRollout: number;
    reason: string;
  };
};

function normalizeExperimentKey(value: string) {
  return value.trim().toLowerCase();
}

function clampRollout(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function roundPct(value: number) {
  return Math.round(value * 100) / 100;
}

function mapFlag(row: DbExperimentFlag): ExperimentFlag {
  return {
    id: row.id,
    key: normalizeExperimentKey(row.key),
    name: row.name,
    description: row.description ?? "",
    enabled: row.enabled,
    rollout: clampRollout(row.rollout),
    updatedAt: row.updated_at
  };
}

function mergeDefaults(flags: ExperimentFlag[]) {
  const map = new Map(
    flags.map((item) => {
      const key = normalizeExperimentKey(item.key);
      return [
        key,
        {
          ...item,
          key
        }
      ] as const;
    })
  );
  const now = new Date().toISOString();
  DEFAULT_FLAGS.forEach((preset) => {
    const key = normalizeExperimentKey(preset.key);
    if (map.has(key)) return;
    map.set(key, {
      id: `exp-${crypto.randomBytes(6).toString("hex")}`,
      key,
      name: preset.name,
      description: preset.description,
      enabled: preset.enabled,
      rollout: preset.rollout,
      updatedAt: now
    });
  });
  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

function getBucket(key: string, userId: string) {
  const normalizedKey = normalizeExperimentKey(key);
  const hash = crypto.createHash("sha256").update(`${normalizedKey}:${userId}`).digest("hex");
  const prefix = hash.slice(0, 8);
  return Number.parseInt(prefix, 16) % 100;
}

export async function listExperimentFlags() {
  if (!isDbEnabled()) {
    const list = readJson<ExperimentFlag[]>(EXPERIMENT_FLAGS_FILE, []);
    const merged = mergeDefaults(list);
    writeJson(EXPERIMENT_FLAGS_FILE, merged);
    return merged;
  }

  const rows = await query<DbExperimentFlag>("SELECT * FROM experiment_flags ORDER BY key ASC");
  const existing = rows.map(mapFlag);
  const merged = mergeDefaults(existing);

  for (const item of merged) {
    if (existing.find((flag) => flag.key === item.key)) continue;
    await query(
      `INSERT INTO experiment_flags (id, key, name, description, enabled, rollout, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (key) DO NOTHING`,
      [item.id, item.key, item.name, item.description, item.enabled, item.rollout, item.updatedAt]
    );
  }

  const refreshed = await query<DbExperimentFlag>("SELECT * FROM experiment_flags ORDER BY key ASC");
  return mergeDefaults(refreshed.map(mapFlag));
}

export async function getExperimentFlag(key: string) {
  const normalizedKey = normalizeExperimentKey(key);
  const flags = await listExperimentFlags();
  return flags.find((item) => item.key === normalizedKey) ?? null;
}

export async function upsertExperimentFlag(input: {
  key: string;
  enabled?: boolean;
  rollout?: number;
}) {
  const key = normalizeExperimentKey(input.key);
  const current = await getExperimentFlag(key);
  const preset = DEFAULT_FLAGS.find((item) => normalizeExperimentKey(item.key) === key);
  const now = new Date().toISOString();

  const next: ExperimentFlag = {
    id: current?.id ?? `exp-${crypto.randomBytes(6).toString("hex")}`,
    key,
    name: current?.name ?? preset?.name ?? key,
    description: current?.description ?? preset?.description ?? "",
    enabled: input.enabled ?? current?.enabled ?? preset?.enabled ?? false,
    rollout: clampRollout(input.rollout ?? current?.rollout ?? preset?.rollout ?? 0),
    updatedAt: now
  };

  if (!isDbEnabled()) {
    const list = mergeDefaults(readJson<ExperimentFlag[]>(EXPERIMENT_FLAGS_FILE, []));
    const index = list.findIndex((item) => item.key === key);
    if (index >= 0) {
      list[index] = next;
    } else {
      list.push(next);
    }
    writeJson(EXPERIMENT_FLAGS_FILE, list);
    return next;
  }

  const row = current
    ? await queryOne<DbExperimentFlag>(
        `UPDATE experiment_flags
         SET key = $2,
             name = $3,
             description = $4,
             enabled = $5,
             rollout = $6,
             updated_at = $7
         WHERE id = $1
         RETURNING *`,
        [current.id, next.key, next.name, next.description, next.enabled, next.rollout, next.updatedAt]
      )
    : await queryOne<DbExperimentFlag>(
        `INSERT INTO experiment_flags (id, key, name, description, enabled, rollout, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [next.id, next.key, next.name, next.description, next.enabled, next.rollout, next.updatedAt]
      );
  return row ? mapFlag(row) : next;
}

export async function assignExperimentVariant(params: {
  key: string;
  userId: string;
  flag?: ExperimentFlag | null;
}) {
  const normalizedKey = normalizeExperimentKey(params.key);
  const flag = params.flag ?? (await getExperimentFlag(normalizedKey));
  const enabled = flag?.enabled ?? false;
  const rollout = clampRollout(flag?.rollout ?? 0);
  const bucket = getBucket(normalizedKey, params.userId);
  const variant: ExperimentVariant = enabled && bucket < rollout ? "treatment" : "control";
  return {
    key: normalizedKey,
    enabled,
    rollout,
    bucket,
    variant
  } as ExperimentAssignment;
}

function buildEmptyVariant(variant: ExperimentVariant): ABVariantAccumulator {
  return {
    variant,
    users: 0,
    retainedUsers: 0,
    retentionRate: 0,
    attempts: 0,
    accuracy: 0,
    wrongAttemptUsers: 0,
    reviewCompletedUsers: 0,
    reviewCompletionRate: 0,
    correctAnswers: 0
  };
}

function buildRecommendation(input: {
  currentRollout: number;
  delta: {
    retentionRate: number;
    accuracy: number;
    reviewCompletionRate: number;
  };
}) {
  const { currentRollout, delta } = input;
  const positive =
    delta.retentionRate >= 5 && delta.accuracy >= 3 && delta.reviewCompletionRate >= 5;
  const negative =
    delta.retentionRate <= -5 || delta.accuracy <= -3 || delta.reviewCompletionRate <= -5;

  if (positive) {
    const suggestedRollout = Math.min(100, currentRollout + 20);
    return {
      action: "increase" as const,
      suggestedRollout,
      reason: "实验组在留存、正确率和复练完成率上均明显优于对照组，建议放量。"
    };
  }

  if (negative) {
    const suggestedRollout = Math.max(0, currentRollout - 20);
    return {
      action: "decrease" as const,
      suggestedRollout,
      reason: "实验组关键指标未达标或出现回落，建议收敛流量并继续调参。"
    };
  }

  return {
    action: "keep" as const,
    suggestedRollout: currentRollout,
    reason: "实验结果波动在可接受范围内，建议继续观察并积累样本。"
  };
}

export async function getChallengeABReport(days = 7): Promise<ChallengeABReport> {
  const windowDays = Math.max(3, Math.min(30, Math.round(days)));
  const flag = await getExperimentFlag(CHALLENGE_EXPERIMENT_KEY);
  const now = Date.now();
  const fromTs = now - windowDays * 24 * 60 * 60 * 1000;
  const fromIso = new Date(fromTs).toISOString();
  const toIso = new Date(now).toISOString();

  const students = (await getUsers()).filter((user) => user.role === "student");
  const assignments = await Promise.all(
    students.map(async (student) => ({
      userId: student.id,
      assignment: await assignExperimentVariant({
        key: CHALLENGE_EXPERIMENT_KEY,
        userId: student.id,
        flag
      })
    }))
  );
  const assignmentMap = new Map(assignments.map((item) => [item.userId, item.assignment]));

  const attempts = (await getAttempts()).filter((attempt) => {
    const ts = new Date(attempt.createdAt).getTime();
    return ts >= fromTs;
  });
  const attemptsByUser = new Map<string, typeof attempts>();
  attempts.forEach((attempt) => {
    const list = attemptsByUser.get(attempt.userId) ?? [];
    list.push(attempt);
    attemptsByUser.set(attempt.userId, list);
  });

  const metrics = {
    control: buildEmptyVariant("control"),
    treatment: buildEmptyVariant("treatment")
  };

  students.forEach((student) => {
    const assignment = assignmentMap.get(student.id);
    const variant = assignment?.variant ?? "control";
    const bucket = metrics[variant];
    bucket.users += 1;

    const userAttempts = attemptsByUser.get(student.id) ?? [];
    if (userAttempts.length > 0) {
      bucket.retainedUsers += 1;
    }
    bucket.attempts += userAttempts.length;

    const correct = userAttempts.filter((item) => item.correct).length;
    const wrong = userAttempts.length - correct;

    const reviewAttempts = userAttempts.filter((item) => item.reason === "wrong-book-review");
    const reviewCompleted = reviewAttempts.length > 0;
    const hasWrong = wrong > 0;
    if (hasWrong) {
      bucket.wrongAttemptUsers += 1;
      if (reviewCompleted) {
        bucket.reviewCompletedUsers += 1;
      }
    }

    bucket.correctAnswers += correct;
  });

  (["control", "treatment"] as const).forEach((variant) => {
    const item = metrics[variant];
    item.retentionRate = item.users ? roundPct((item.retainedUsers / item.users) * 100) : 0;
    item.accuracy = item.attempts ? roundPct((item.correctAnswers / item.attempts) * 100) : 0;
    item.reviewCompletionRate = item.wrongAttemptUsers
      ? roundPct((item.reviewCompletedUsers / item.wrongAttemptUsers) * 100)
      : 0;
  });

  const delta = {
    retentionRate: roundPct(metrics.treatment.retentionRate - metrics.control.retentionRate),
    accuracy: roundPct(metrics.treatment.accuracy - metrics.control.accuracy),
    reviewCompletionRate: roundPct(
      metrics.treatment.reviewCompletionRate - metrics.control.reviewCompletionRate
    )
  };

  const recommendation = buildRecommendation({
    currentRollout: clampRollout(flag?.rollout ?? 0),
    delta
  });

  return {
    experiment: {
      key: CHALLENGE_EXPERIMENT_KEY,
      name: flag?.name ?? "挑战学习闭环 V2",
      enabled: flag?.enabled ?? false,
      rollout: clampRollout(flag?.rollout ?? 0)
    },
    window: {
      days: windowDays,
      from: fromIso,
      to: toIso
    },
    variants: [metrics.control, metrics.treatment].map((item) => ({
      variant: item.variant,
      users: item.users,
      retainedUsers: item.retainedUsers,
      retentionRate: item.retentionRate,
      attempts: item.attempts,
      accuracy: item.accuracy,
      wrongAttemptUsers: item.wrongAttemptUsers,
      reviewCompletedUsers: item.reviewCompletedUsers,
      reviewCompletionRate: item.reviewCompletionRate
    })),
    delta,
    recommendation
  };
}
