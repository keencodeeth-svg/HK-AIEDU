import crypto from "crypto";
import { isDbEnabled, query } from "./db";
import { readJson, writeJson } from "./storage";

type ApiRouteLog = {
  id: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  traceId?: string;
  createdAt: string;
};

type DbApiRouteLog = {
  id: string;
  method: string;
  path: string;
  status: number;
  duration_ms: number;
  trace_id: string | null;
  created_at: string;
};

type RouteMetric = {
  key: string;
  method: string;
  path: string;
  requests: number;
  errors: number;
  totalDurationMs: number;
  durationsMs: number[];
  lastStatus: number;
  lastSeenAt: string;
};

const API_ROUTE_LOG_FILE = "api-route-logs.json";
const MAX_ROUTE_LOGS = 20000;
const MAX_DURATION_SAMPLES = 400;

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function pushDuration(list: number[], value: number) {
  list.push(value);
  if (list.length > MAX_DURATION_SAMPLES) {
    list.shift();
  }
}

function computeP95(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return round(sorted[index]);
}

function mapDbLog(row: DbApiRouteLog): ApiRouteLog {
  return {
    id: row.id,
    method: row.method,
    path: row.path,
    status: row.status,
    durationMs: row.duration_ms,
    traceId: row.trace_id ?? undefined,
    createdAt: row.created_at
  };
}

async function appendRouteLog(log: ApiRouteLog) {
  if (!isDbEnabled()) {
    const list = readJson<ApiRouteLog[]>(API_ROUTE_LOG_FILE, []);
    list.push(log);
    const next = list.length > MAX_ROUTE_LOGS ? list.slice(list.length - MAX_ROUTE_LOGS) : list;
    writeJson(API_ROUTE_LOG_FILE, next);
    return;
  }

  await query(
    `INSERT INTO api_route_logs (id, method, path, status, duration_ms, trace_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [log.id, log.method, log.path, log.status, log.durationMs, log.traceId ?? null, log.createdAt]
  );
  await query(
    `DELETE FROM api_route_logs
     WHERE id IN (
       SELECT id
       FROM api_route_logs
       ORDER BY created_at DESC
       OFFSET $1
     )`,
    [MAX_ROUTE_LOGS]
  );
}

async function getRecentRouteLogs(limit = 5000) {
  const safeLimit = Math.max(100, Math.min(MAX_ROUTE_LOGS, Math.floor(limit)));
  if (!isDbEnabled()) {
    const list = readJson<ApiRouteLog[]>(API_ROUTE_LOG_FILE, []);
    return list.slice(-safeLimit).reverse();
  }

  const rows = await query<DbApiRouteLog>(
    `SELECT *
     FROM api_route_logs
     ORDER BY created_at DESC
     LIMIT $1`,
    [safeLimit]
  );
  return rows.map(mapDbLog);
}

export async function recordApiRequest(input: {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  traceId?: string;
}) {
  const log: ApiRouteLog = {
    id: `api-route-log-${crypto.randomBytes(8).toString("hex")}`,
    method: (input.method || "GET").toUpperCase(),
    path: input.path || "/",
    status: Number.isFinite(input.status) ? input.status : 500,
    durationMs: Math.max(0, Math.round(input.durationMs || 0)),
    traceId: input.traceId?.trim() || undefined,
    createdAt: new Date().toISOString()
  };
  await appendRouteLog(log);
}

export async function getApiMetricsSummary(limit = 20) {
  const logs = await getRecentRouteLogs(8000);
  const metricMap = new Map<string, RouteMetric>();

  logs.forEach((log) => {
    const key = `${log.method} ${log.path}`;
    const metric =
      metricMap.get(key) ??
      ({
        key,
        method: log.method,
        path: log.path,
        requests: 0,
        errors: 0,
        totalDurationMs: 0,
        durationsMs: [],
        lastStatus: log.status,
        lastSeenAt: log.createdAt
      } satisfies RouteMetric);

    metric.requests += 1;
    if (log.status >= 400) {
      metric.errors += 1;
    }
    metric.totalDurationMs += log.durationMs;
    pushDuration(metric.durationsMs, log.durationMs);

    if (new Date(log.createdAt).getTime() >= new Date(metric.lastSeenAt).getTime()) {
      metric.lastSeenAt = log.createdAt;
      metric.lastStatus = log.status;
    }

    metricMap.set(key, metric);
  });

  const rows = Array.from(metricMap.values()).sort((a, b) => {
    if (b.requests !== a.requests) return b.requests - a.requests;
    return a.key.localeCompare(b.key);
  });

  const topRows = rows.slice(0, Math.max(1, Math.min(100, Math.floor(limit))));
  const totalRequests = rows.reduce((sum, row) => sum + row.requests, 0);
  const totalErrors = rows.reduce((sum, row) => sum + row.errors, 0);
  const durationSamples = rows.flatMap((row) => row.durationsMs);

  const now = Date.now();
  const day24Ago = now - 24 * 60 * 60 * 1000;
  const logs24h = logs.filter((log) => {
    const ts = new Date(log.createdAt).getTime();
    return Number.isFinite(ts) && ts >= day24Ago;
  });
  const errors24h = logs24h.filter((log) => log.status >= 400).length;
  const statusBuckets = {
    s2xx: logs.filter((log) => log.status >= 200 && log.status < 300).length,
    s3xx: logs.filter((log) => log.status >= 300 && log.status < 400).length,
    s4xx: logs.filter((log) => log.status >= 400 && log.status < 500).length,
    s5xx: logs.filter((log) => log.status >= 500).length
  };

  return {
    generatedAt: new Date().toISOString(),
    totalRoutes: rows.length,
    totalRequests,
    totalErrors,
    errorRate: totalRequests === 0 ? 0 : round((totalErrors / totalRequests) * 100),
    avgDurationMs: durationSamples.length
      ? round(durationSamples.reduce((sum, value) => sum + value, 0) / durationSamples.length)
      : 0,
    p95DurationMs: computeP95(durationSamples),
    window24h: {
      requests: logs24h.length,
      errors: errors24h,
      errorRate: logs24h.length ? round((errors24h / logs24h.length) * 100) : 0,
      p95DurationMs: computeP95(logs24h.map((item) => item.durationMs))
    },
    statusBuckets,
    routes: topRows.map((row) => ({
      key: row.key,
      method: row.method,
      path: row.path,
      requests: row.requests,
      errors: row.errors,
      errorRate: row.requests === 0 ? 0 : round((row.errors / row.requests) * 100),
      avgDurationMs: row.requests === 0 ? 0 : round(row.totalDurationMs / row.requests),
      p95DurationMs: computeP95(row.durationsMs),
      lastStatus: row.lastStatus,
      lastSeenAt: row.lastSeenAt
    })),
    recentErrors: logs
      .filter((item) => item.status >= 400)
      .slice(0, 10)
      .map((item) => ({
        method: item.method,
        path: item.path,
        status: item.status,
        durationMs: item.durationMs,
        traceId: item.traceId,
        createdAt: item.createdAt
      }))
  };
}
