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

const MAX_DURATION_SAMPLES = 200;
const routeMetrics = new Map<string, RouteMetric>();

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

export function recordApiRequest(input: {
  method: string;
  path: string;
  status: number;
  durationMs: number;
}) {
  const key = `${input.method.toUpperCase()} ${input.path}`;
  const now = new Date().toISOString();
  const metric =
    routeMetrics.get(key) ??
    ({
      key,
      method: input.method.toUpperCase(),
      path: input.path,
      requests: 0,
      errors: 0,
      totalDurationMs: 0,
      durationsMs: [],
      lastStatus: input.status,
      lastSeenAt: now
    } satisfies RouteMetric);

  metric.requests += 1;
  if (input.status >= 400) {
    metric.errors += 1;
  }
  metric.totalDurationMs += Math.max(0, input.durationMs);
  pushDuration(metric.durationsMs, Math.max(0, input.durationMs));
  metric.lastStatus = input.status;
  metric.lastSeenAt = now;

  routeMetrics.set(key, metric);
}

export function getApiMetricsSummary(limit = 20) {
  const rows = Array.from(routeMetrics.values()).sort((a, b) => {
    if (b.requests !== a.requests) return b.requests - a.requests;
    return a.key.localeCompare(b.key);
  });

  const topRows = rows.slice(0, Math.max(1, limit));
  const totalRequests = rows.reduce((sum, row) => sum + row.requests, 0);
  const totalErrors = rows.reduce((sum, row) => sum + row.errors, 0);
  const durationSamples = rows.flatMap((row) => row.durationsMs);

  return {
    generatedAt: new Date().toISOString(),
    totalRoutes: rows.length,
    totalRequests,
    totalErrors,
    errorRate: totalRequests === 0 ? 0 : round((totalErrors / totalRequests) * 100),
    p95DurationMs: computeP95(durationSamples),
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
    }))
  };
}
