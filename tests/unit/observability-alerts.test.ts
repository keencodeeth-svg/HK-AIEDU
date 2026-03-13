import assert from "node:assert/strict";
import { test } from "node:test";
import {
  OBSERVABILITY_ALERT_THRESHOLDS,
  evaluateObservabilityAlerts
} from "../../lib/observability-alerts";

test("evaluateObservabilityAlerts returns ordered alerts and summary counts", () => {
  const report = evaluateObservabilityAlerts({
    api: {
      generatedAt: "2026-03-12T00:00:00.000Z",
      totalRoutes: 2,
      totalRequests: 240,
      totalErrors: 18,
      errorRate: 7.5,
      avgDurationMs: 620,
      p95DurationMs: 1800,
      window24h: {
        requests: 120,
        errors: 8,
        errorRate: 6.67,
        p95DurationMs: 1800,
        statusBuckets: {
          s2xx: 106,
          s3xx: 0,
          s4xx: 8,
          s5xx: 6
        }
      },
      statusBuckets: {
        s2xx: 222,
        s3xx: 0,
        s4xx: 12,
        s5xx: 6
      },
      routes: [
        {
          key: "GET /api/admin/observability/alerts",
          method: "GET",
          path: "/api/admin/observability/alerts",
          requests: 60,
          errors: 4,
          errorRate: 6.67,
          avgDurationMs: 800,
          p95DurationMs: 2100,
          lastStatus: 401,
          lastSeenAt: "2026-03-12T00:00:00.000Z"
        },
        {
          key: "POST /api/ai/assist",
          method: "POST",
          path: "/api/ai/assist",
          requests: 60,
          errors: 0,
          errorRate: 0,
          avgDurationMs: 420,
          p95DurationMs: 1600,
          lastStatus: 200,
          lastSeenAt: "2026-03-12T00:00:00.000Z"
        }
      ],
      recentErrors: []
    },
    ai: {
      generatedAt: "2026-03-12T00:00:00.000Z",
      totalCalls: 40,
      successCalls: 32,
      successRate: 80,
      fallbackRate: 20,
      timeoutRate: 22.5,
      qualityRejectRate: 12.5,
      budgetRejectRate: 10,
      avgLatencyMs: 1350,
      p95LatencyMs: 2900,
      rows: [
        {
          key: "assist:deepseek",
          taskType: "assist",
          provider: "deepseek",
          calls: 30,
          successRate: 76.67,
          timeoutRate: 26.67,
          avgFallback: 0.6,
          qualityRejectRate: 13.33,
          budgetRejectRate: 13.33,
          avgLatencyMs: 1420,
          p95LatencyMs: 3000,
          avgRequestChars: 180,
          avgResponseChars: 210,
          lastSeenAt: "2026-03-12T00:00:00.000Z"
        },
        {
          key: "probe:mock",
          taskType: "probe",
          provider: "mock",
          calls: 10,
          successRate: 80,
          timeoutRate: 10,
          avgFallback: 0,
          qualityRejectRate: 10,
          budgetRejectRate: 0,
          avgLatencyMs: 900,
          p95LatencyMs: 1200,
          avgRequestChars: 40,
          avgResponseChars: 20,
          lastSeenAt: "2026-03-12T00:00:00.000Z"
        }
      ],
      recentFailures: []
    }
  });

  assert.equal(report.overallStatus, "critical");
  assert.equal(report.summary.totalChecks, 7);
  assert.equal(report.summary.openAlerts, 7);
  assert.equal(report.summary.criticalAlerts, 2);
  assert.equal(report.summary.highAlerts, 2);
  assert.equal(report.summary.mediumAlerts, 3);
  assert.deepEqual(
    report.alerts.map((item) => item.id),
    [
      "ai_timeout_rate",
      "api_s5xx_24h",
      "ai_success_rate",
      "api_error_rate_24h",
      "ai_budget_reject_rate",
      "ai_quality_reject_rate",
      "api_p95_duration_24h",
    ]
  );
  assert.equal(report.alerts[0]?.focusLabel, "assist:deepseek");
  assert.equal(report.alerts[4]?.severity, "medium");
  assert.equal(report.signals.api.window24h.statusBuckets?.s5xx, 6);
});

test("evaluateObservabilityAlerts suppresses checks when samples are below thresholds", () => {
  const report = evaluateObservabilityAlerts({
    api: {
      generatedAt: "2026-03-12T00:00:00.000Z",
      totalRoutes: 1,
      totalRequests: 8,
      totalErrors: 1,
      errorRate: 12.5,
      avgDurationMs: 150,
      p95DurationMs: 220,
      window24h: {
        requests: 8,
        errors: 1,
        errorRate: 12.5,
        p95DurationMs: 220,
        statusBuckets: {
          s2xx: 7,
          s3xx: 0,
          s4xx: 1,
          s5xx: 0
        }
      },
      statusBuckets: {
        s2xx: 7,
        s3xx: 0,
        s4xx: 1,
        s5xx: 0
      },
      routes: [
        {
          key: "GET /api/demo",
          method: "GET",
          path: "/api/demo",
          requests: 8,
          errors: 1,
          errorRate: 12.5,
          avgDurationMs: 150,
          p95DurationMs: 220,
          lastStatus: 200,
          lastSeenAt: "2026-03-12T00:00:00.000Z"
        }
      ],
      recentErrors: []
    },
    ai: {
      generatedAt: "2026-03-12T00:00:00.000Z",
      totalCalls: 4,
      successCalls: 2,
      successRate: 50,
      fallbackRate: 0,
      timeoutRate: 25,
      qualityRejectRate: 25,
      budgetRejectRate: 0,
      avgLatencyMs: 800,
      p95LatencyMs: 900,
      rows: [
        {
          key: "assist:mock",
          taskType: "assist",
          provider: "mock",
          calls: 4,
          successRate: 50,
          timeoutRate: 25,
          avgFallback: 0,
          qualityRejectRate: 25,
          budgetRejectRate: 0,
          avgLatencyMs: 800,
          p95LatencyMs: 900,
          avgRequestChars: 40,
          avgResponseChars: 20,
          lastSeenAt: "2026-03-12T00:00:00.000Z"
        }
      ],
      recentFailures: []
    }
  });

  assert.equal(report.overallStatus, "healthy");
  assert.equal(report.summary.openAlerts, 0);
  assert.equal(report.summary.healthyChecks, 0);
  assert.equal(report.summary.suppressedChecks, 7);
  assert.equal(report.summary.evaluatedChecks, 0);
  assert.ok(
    report.checks.every((item) => item.status === "insufficient"),
    "all checks should be suppressed when samples are below thresholds"
  );
  assert.equal(report.thresholds.api.minRequests24h, OBSERVABILITY_ALERT_THRESHOLDS.api.minRequests24h);
  assert.equal(report.thresholds.ai.minCalls, OBSERVABILITY_ALERT_THRESHOLDS.ai.minCalls);
});
