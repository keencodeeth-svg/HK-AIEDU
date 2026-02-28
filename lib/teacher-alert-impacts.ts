import crypto from "crypto";
import { isDbEnabled, query, queryOne } from "./db";
import { readJson, writeJson } from "./storage";

export type TeacherAlertImpactBaseline = {
  riskScore: number;
  status: "active" | "acknowledged";
  metrics: Record<string, number | string | null>;
  recommendedAction?: string | null;
  actionType?: "assign_review" | "notify_student" | "auto_chain" | "mark_done" | null;
};

export type TeacherAlertImpactRecord = {
  id: string;
  actionId: string;
  teacherId: string;
  alertId: string;
  classId: string | null;
  studentIds: string[];
  baseline: TeacherAlertImpactBaseline;
  createdAt: string;
};

export type TeacherAlertImpactWindow = {
  hours: 24 | 72;
  ready: boolean;
  dueAt: string | null;
  remainingHours: number;
  riskDelta: number | null;
  riskDeltaRate: number | null;
  improved: boolean | null;
};

export type TeacherAlertImpactReport = {
  tracked: boolean;
  actionId: string | null;
  trackedAt: string | null;
  elapsedHours: number;
  baseline: TeacherAlertImpactBaseline | null;
  current: {
    riskScore: number;
    status: "active" | "acknowledged";
    metrics: Record<string, number | string | null>;
  } | null;
  deltas: {
    riskScore: number | null;
    metricDeltas: Record<string, number>;
  };
  windows: {
    h24: TeacherAlertImpactWindow;
    h72: TeacherAlertImpactWindow;
  };
};

type CurrentAlertSnapshot = {
  riskScore: number;
  status: "active" | "acknowledged";
  metrics?: Record<string, number | string | null> | null;
};

type DbTeacherAlertImpact = {
  id: string;
  action_id: string;
  teacher_id: string;
  alert_id: string;
  class_id: string | null;
  student_ids: string[] | string | null;
  baseline: unknown;
  created_at: string;
};

const IMPACT_FILE = "teacher-alert-impacts.json";

function round(value: number, digits = 2) {
  const scale = Math.pow(10, digits);
  return Math.round(value * scale) / scale;
}

function normalizeMetricMap(
  input: Record<string, number | string | null> | null | undefined
): Record<string, number | string | null> {
  if (!input) return {};
  const next: Record<string, number | string | null> = {};
  Object.entries(input).forEach(([key, value]) => {
    if (!key) return;
    if (typeof value === "number" || typeof value === "string" || value === null) {
      next[key] = value;
    }
  });
  return next;
}

function parseStudentIds(input: string[] | string | null): string[] {
  if (Array.isArray(input)) return input.filter((item) => typeof item === "string");
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string");
      }
    } catch {
      return [];
    }
  }
  return [];
}

function parseBaseline(input: unknown): TeacherAlertImpactBaseline {
  const fallback: TeacherAlertImpactBaseline = {
    riskScore: 0,
    status: "active",
    metrics: {}
  };
  if (!input) return fallback;

  const parsed =
    typeof input === "string"
      ? (() => {
          try {
            return JSON.parse(input) as unknown;
          } catch {
            return null;
          }
        })()
      : input;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return fallback;
  }

  const data = parsed as Partial<TeacherAlertImpactBaseline>;
  return {
    riskScore: typeof data.riskScore === "number" ? data.riskScore : 0,
    status: data.status === "acknowledged" ? "acknowledged" : "active",
    metrics: normalizeMetricMap(data.metrics),
    recommendedAction: typeof data.recommendedAction === "string" ? data.recommendedAction : null,
    actionType:
      data.actionType === "assign_review" ||
      data.actionType === "notify_student" ||
      data.actionType === "auto_chain" ||
      data.actionType === "mark_done"
        ? data.actionType
        : null
  };
}

function mapDbImpact(row: DbTeacherAlertImpact): TeacherAlertImpactRecord {
  return {
    id: row.id,
    actionId: row.action_id,
    teacherId: row.teacher_id,
    alertId: row.alert_id,
    classId: row.class_id,
    studentIds: parseStudentIds(row.student_ids),
    baseline: parseBaseline(row.baseline),
    createdAt: row.created_at
  };
}

export async function upsertTeacherAlertImpact(input: {
  actionId: string;
  teacherId: string;
  alertId: string;
  classId?: string | null;
  studentIds?: string[];
  baseline: TeacherAlertImpactBaseline;
}) {
  const now = new Date().toISOString();
  const studentIds = Array.from(new Set((input.studentIds ?? []).filter(Boolean)));
  const baseline: TeacherAlertImpactBaseline = {
    riskScore: Math.max(0, Math.round(input.baseline.riskScore ?? 0)),
    status: input.baseline.status === "acknowledged" ? "acknowledged" : "active",
    metrics: normalizeMetricMap(input.baseline.metrics),
    recommendedAction: input.baseline.recommendedAction ?? null,
    actionType: input.baseline.actionType ?? null
  };

  if (!isDbEnabled()) {
    const list = readJson<TeacherAlertImpactRecord[]>(IMPACT_FILE, []);
    const index = list.findIndex((item) => item.actionId === input.actionId);
    const next: TeacherAlertImpactRecord = {
      id: index >= 0 ? list[index].id : `alert-impact-${crypto.randomBytes(6).toString("hex")}`,
      actionId: input.actionId,
      teacherId: input.teacherId,
      alertId: input.alertId,
      classId: input.classId ?? null,
      studentIds,
      baseline,
      createdAt: now
    };
    if (index >= 0) {
      list[index] = next;
    } else {
      list.push(next);
    }
    writeJson(IMPACT_FILE, list);
    return next;
  }

  const existing = await queryOne<DbTeacherAlertImpact>(
    "SELECT * FROM teacher_alert_impacts WHERE action_id = $1",
    [input.actionId]
  );

  const row = await queryOne<DbTeacherAlertImpact>(
    `INSERT INTO teacher_alert_impacts
      (id, action_id, teacher_id, alert_id, class_id, student_ids, baseline, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (action_id) DO UPDATE SET
       teacher_id = EXCLUDED.teacher_id,
       alert_id = EXCLUDED.alert_id,
       class_id = EXCLUDED.class_id,
       student_ids = EXCLUDED.student_ids,
       baseline = EXCLUDED.baseline,
       created_at = EXCLUDED.created_at
     RETURNING *`,
    [
      existing?.id ?? `alert-impact-${crypto.randomBytes(6).toString("hex")}`,
      input.actionId,
      input.teacherId,
      input.alertId,
      input.classId ?? null,
      studentIds,
      baseline,
      now
    ]
  );
  return row ? mapDbImpact(row) : null;
}

export async function getTeacherAlertImpactByAlert(params: { teacherId: string; alertId: string }) {
  if (!isDbEnabled()) {
    const list = readJson<TeacherAlertImpactRecord[]>(IMPACT_FILE, []);
    return (
      list
        .filter((item) => item.teacherId === params.teacherId && item.alertId === params.alertId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
    );
  }

  const row = await queryOne<DbTeacherAlertImpact>(
    `SELECT * FROM teacher_alert_impacts
     WHERE teacher_id = $1 AND alert_id = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [params.teacherId, params.alertId]
  );
  return row ? mapDbImpact(row) : null;
}

function buildMetricDeltaMap(params: {
  baseline: Record<string, number | string | null>;
  current: Record<string, number | string | null>;
}) {
  const result: Record<string, number> = {};
  Object.entries(params.baseline).forEach(([key, value]) => {
    const currentValue = params.current[key];
    if (typeof value !== "number" || !Number.isFinite(value)) return;
    if (typeof currentValue !== "number" || !Number.isFinite(currentValue)) return;
    result[key] = round(currentValue - value, 2);
  });
  return result;
}

function buildWindow(params: {
  hours: 24 | 72;
  trackedAt: string;
  riskScoreDelta: number | null;
  baselineRiskScore: number;
}) {
  const trackedTs = new Date(params.trackedAt).getTime();
  if (!Number.isFinite(trackedTs)) {
    return {
      hours: params.hours,
      ready: false,
      dueAt: null,
      remainingHours: params.hours,
      riskDelta: null,
      riskDeltaRate: null,
      improved: null
    } satisfies TeacherAlertImpactWindow;
  }

  const dueAtTs = trackedTs + params.hours * 60 * 60 * 1000;
  const nowTs = Date.now();
  const remainingHours = Math.max(0, (dueAtTs - nowTs) / (60 * 60 * 1000));
  const ready = remainingHours <= 0;
  const riskDelta = ready ? params.riskScoreDelta : null;
  const riskDeltaRate =
    ready && riskDelta !== null && params.baselineRiskScore > 0
      ? round((riskDelta / params.baselineRiskScore) * 100, 2)
      : null;

  return {
    hours: params.hours,
    ready,
    dueAt: new Date(dueAtTs).toISOString(),
    remainingHours: round(remainingHours, 2),
    riskDelta,
    riskDeltaRate,
    improved: riskDelta === null ? null : riskDelta < 0
  } satisfies TeacherAlertImpactWindow;
}

export function buildTeacherAlertImpactReport(params: {
  record: TeacherAlertImpactRecord | null;
  current: CurrentAlertSnapshot | null;
}): TeacherAlertImpactReport {
  if (!params.record) {
    return {
      tracked: false,
      actionId: null,
      trackedAt: null,
      elapsedHours: 0,
      baseline: null,
      current: params.current
        ? {
            riskScore: params.current.riskScore,
            status: params.current.status,
            metrics: normalizeMetricMap(params.current.metrics)
          }
        : null,
      deltas: { riskScore: null, metricDeltas: {} },
      windows: {
        h24: {
          hours: 24,
          ready: false,
          dueAt: null,
          remainingHours: 24,
          riskDelta: null,
          riskDeltaRate: null,
          improved: null
        },
        h72: {
          hours: 72,
          ready: false,
          dueAt: null,
          remainingHours: 72,
          riskDelta: null,
          riskDeltaRate: null,
          improved: null
        }
      }
    };
  }

  const baseline = params.record.baseline;
  const current = params.current
    ? {
        riskScore: params.current.riskScore,
        status: params.current.status,
        metrics: normalizeMetricMap(params.current.metrics)
      }
    : null;
  const riskScoreDelta = current ? round(current.riskScore - baseline.riskScore, 2) : null;
  const metricDeltas = current
    ? buildMetricDeltaMap({
        baseline: baseline.metrics,
        current: current.metrics
      })
    : {};

  const createdTs = new Date(params.record.createdAt).getTime();
  const elapsedHours = Number.isFinite(createdTs) ? round((Date.now() - createdTs) / (60 * 60 * 1000), 2) : 0;

  return {
    tracked: true,
    actionId: params.record.actionId,
    trackedAt: params.record.createdAt,
    elapsedHours,
    baseline,
    current,
    deltas: {
      riskScore: riskScoreDelta,
      metricDeltas
    },
    windows: {
      h24: buildWindow({
        hours: 24,
        trackedAt: params.record.createdAt,
        riskScoreDelta,
        baselineRiskScore: baseline.riskScore
      }),
      h72: buildWindow({
        hours: 72,
        trackedAt: params.record.createdAt,
        riskScoreDelta,
        baselineRiskScore: baseline.riskScore
      })
    }
  };
}
