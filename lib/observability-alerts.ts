import { getAiCallMetricsSummary } from "./ai-task-policies";
import { getApiMetricsSummary } from "./observability";

type ApiMetricsSummary = Awaited<ReturnType<typeof getApiMetricsSummary>>;
type AiMetricsSummary = Awaited<ReturnType<typeof getAiCallMetricsSummary>>;

export type ObservabilityDomain = "api" | "ai";
export type ObservabilityAlertSeverity = "medium" | "high" | "critical";
export type ObservabilityCheckStatus = "healthy" | "alert" | "insufficient";
export type ObservabilityMetricUnit = "%" | "ms" | "count";
export type ObservabilityMetricId =
  | "api_error_rate_24h"
  | "api_p95_duration_24h"
  | "api_s5xx_24h"
  | "ai_timeout_rate"
  | "ai_success_rate"
  | "ai_budget_reject_rate"
  | "ai_quality_reject_rate";

export type ObservabilityCheck = {
  id: ObservabilityMetricId;
  domain: ObservabilityDomain;
  title: string;
  status: ObservabilityCheckStatus;
  severity?: ObservabilityAlertSeverity;
  currentValue: number;
  warnThreshold: number;
  criticalThreshold: number;
  unit: ObservabilityMetricUnit;
  sampleSize: number;
  sampleLabel: string;
  message: string;
  focusLabel?: string;
  recommendedAction?: string;
};

export type ObservabilityAlert = ObservabilityCheck & {
  status: "alert";
  severity: ObservabilityAlertSeverity;
};

export const OBSERVABILITY_ALERT_THRESHOLDS = {
  api: {
    minRequests24h: 25,
    errorRateWarn: 4,
    errorRateCritical: 10,
    p95DurationWarnMs: 1200,
    p95DurationCriticalMs: 2500,
    s5xxWarnCount24h: 1,
    s5xxCriticalCount24h: 5
  },
  ai: {
    minCalls: 10,
    timeoutRateWarn: 8,
    timeoutRateCritical: 20,
    successRateWarn: 85,
    successRateCritical: 70,
    budgetRejectRateWarn: 6,
    budgetRejectRateCritical: 15,
    qualityRejectRateWarn: 8,
    qualityRejectRateCritical: 18
  }
} as const;

type ObservabilityAlertsReportInput = {
  api: ApiMetricsSummary;
  ai: AiMetricsSummary;
};

export type ObservabilityAlertsReport = ReturnType<typeof evaluateObservabilityAlerts>;

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function toFixedMetric(value: number) {
  return Number.isFinite(value) ? round(value) : 0;
}

function severityRank(severity: ObservabilityAlertSeverity) {
  switch (severity) {
    case "critical":
      return 3;
    case "high":
      return 2;
    case "medium":
    default:
      return 1;
  }
}

function compareAlertSeverity(
  currentValue: number,
  warnThreshold: number,
  criticalThreshold: number,
  warnSeverity: ObservabilityAlertSeverity
) {
  if (currentValue >= criticalThreshold) {
    return "critical" as const;
  }
  if (currentValue >= warnThreshold) {
    return warnSeverity;
  }
  return null;
}

function compareLowIsBadSeverity(
  currentValue: number,
  warnThreshold: number,
  criticalThreshold: number,
  warnSeverity: ObservabilityAlertSeverity
) {
  if (currentValue <= criticalThreshold) {
    return "critical" as const;
  }
  if (currentValue <= warnThreshold) {
    return warnSeverity;
  }
  return null;
}

function createInsufficientCheck(input: Omit<ObservabilityCheck, "status" | "message"> & { minimumSample: number }) {
  return {
    ...input,
    status: "insufficient" as const,
    message: `样本不足：当前仅 ${input.sampleSize} 个${input.sampleLabel}，至少需要 ${input.minimumSample} 个`
  };
}

function createHealthyCheck(input: Omit<ObservabilityCheck, "status" | "message" | "severity"> & { message: string }) {
  return {
    ...input,
    status: "healthy" as const,
    message: input.message
  };
}

function createAlertCheck(
  input: Omit<ObservabilityAlert, "status" | "message"> & {
    message: string;
  }
) {
  return {
    ...input,
    status: "alert" as const,
    message: input.message
  };
}

function describeApiRoute(route: ApiMetricsSummary["routes"][number] | undefined) {
  return route ? `${route.method} ${route.path}` : undefined;
}

function findWorstRouteByError(routes: ApiMetricsSummary["routes"]) {
  return [...routes].sort((a, b) => {
    if (b.errorRate !== a.errorRate) return b.errorRate - a.errorRate;
    if (b.errors !== a.errors) return b.errors - a.errors;
    if (b.requests !== a.requests) return b.requests - a.requests;
    return a.key.localeCompare(b.key);
  })[0];
}

function findSlowestRoute(routes: ApiMetricsSummary["routes"]) {
  return [...routes].sort((a, b) => {
    if (b.p95DurationMs !== a.p95DurationMs) return b.p95DurationMs - a.p95DurationMs;
    if (b.avgDurationMs !== a.avgDurationMs) return b.avgDurationMs - a.avgDurationMs;
    if (b.requests !== a.requests) return b.requests - a.requests;
    return a.key.localeCompare(b.key);
  })[0];
}

function findWorstAiRowByHighestRate(
  rows: AiMetricsSummary["rows"],
  pick: (row: AiMetricsSummary["rows"][number]) => number
) {
  return [...rows].sort((a, b) => {
    const valueDiff = pick(b) - pick(a);
    if (valueDiff !== 0) return valueDiff;
    if (b.calls !== a.calls) return b.calls - a.calls;
    return a.key.localeCompare(b.key);
  })[0];
}

function findWorstAiRowByLowestRate(
  rows: AiMetricsSummary["rows"],
  pick: (row: AiMetricsSummary["rows"][number]) => number
) {
  return [...rows].sort((a, b) => {
    const valueDiff = pick(a) - pick(b);
    if (valueDiff !== 0) return valueDiff;
    if (b.calls !== a.calls) return b.calls - a.calls;
    return a.key.localeCompare(b.key);
  })[0];
}

export function evaluateObservabilityAlerts(input: ObservabilityAlertsReportInput) {
  const { api, ai } = input;
  const checks: ObservabilityCheck[] = [];
  const apiThresholds = OBSERVABILITY_ALERT_THRESHOLDS.api;
  const aiThresholds = OBSERVABILITY_ALERT_THRESHOLDS.ai;

  const worstApiErrorRoute = findWorstRouteByError(api.routes);
  const slowestApiRoute = findSlowestRoute(api.routes);
  const worstAiTimeoutRow = findWorstAiRowByHighestRate(ai.rows, (row) => row.timeoutRate);
  const worstAiSuccessRow = findWorstAiRowByLowestRate(ai.rows, (row) => row.successRate);
  const worstAiBudgetRow = findWorstAiRowByHighestRate(ai.rows, (row) => row.budgetRejectRate);
  const worstAiQualityRow = findWorstAiRowByHighestRate(ai.rows, (row) => row.qualityRejectRate);

  if (api.window24h.requests < apiThresholds.minRequests24h) {
    checks.push(
      createInsufficientCheck({
        id: "api_error_rate_24h",
        domain: "api",
        title: "API 错误率",
        currentValue: api.window24h.errorRate,
        warnThreshold: apiThresholds.errorRateWarn,
        criticalThreshold: apiThresholds.errorRateCritical,
        unit: "%",
        sampleSize: api.window24h.requests,
        sampleLabel: "24h 请求",
        minimumSample: apiThresholds.minRequests24h,
        focusLabel: describeApiRoute(worstApiErrorRoute),
        recommendedAction: "补足请求样本后再判断，或先在 metrics 原始明细中检查单路由异常。"
      })
    );
  } else {
    const severity = compareAlertSeverity(
      api.window24h.errorRate,
      apiThresholds.errorRateWarn,
      apiThresholds.errorRateCritical,
      "high"
    );
    if (severity) {
      checks.push(
        createAlertCheck({
          id: "api_error_rate_24h",
          domain: "api",
          title: "API 错误率超阈值",
          severity,
          currentValue: api.window24h.errorRate,
          warnThreshold: apiThresholds.errorRateWarn,
          criticalThreshold: apiThresholds.errorRateCritical,
          unit: "%",
          sampleSize: api.window24h.requests,
          sampleLabel: "24h 请求",
          focusLabel: describeApiRoute(worstApiErrorRoute),
          recommendedAction: "优先排查最近 24h 的错误请求和最差路由，核对鉴权、依赖健康与最近发布变更。",
          message: `最近24h错误率 ${toFixedMetric(api.window24h.errorRate)}%（${api.window24h.errors}/${api.window24h.requests}）高于阈值 ${apiThresholds.errorRateWarn}%`
        })
      );
    } else {
      checks.push(
        createHealthyCheck({
          id: "api_error_rate_24h",
          domain: "api",
          title: "API 错误率",
          currentValue: api.window24h.errorRate,
          warnThreshold: apiThresholds.errorRateWarn,
          criticalThreshold: apiThresholds.errorRateCritical,
          unit: "%",
          sampleSize: api.window24h.requests,
          sampleLabel: "24h 请求",
          focusLabel: describeApiRoute(worstApiErrorRoute),
          recommendedAction: "继续关注高错误率路由即可。",
          message: `最近24h错误率 ${toFixedMetric(api.window24h.errorRate)}%，处于阈值内`
        })
      );
    }
  }

  if (api.window24h.requests < apiThresholds.minRequests24h) {
    checks.push(
      createInsufficientCheck({
        id: "api_p95_duration_24h",
        domain: "api",
        title: "API P95 延迟",
        currentValue: api.window24h.p95DurationMs,
        warnThreshold: apiThresholds.p95DurationWarnMs,
        criticalThreshold: apiThresholds.p95DurationCriticalMs,
        unit: "ms",
        sampleSize: api.window24h.requests,
        sampleLabel: "24h 请求",
        minimumSample: apiThresholds.minRequests24h,
        focusLabel: describeApiRoute(slowestApiRoute),
        recommendedAction: "样本补足后再判断；若已有明显慢接口，可直接查看 route 级 metrics。"
      })
    );
  } else {
    const severity = compareAlertSeverity(
      api.window24h.p95DurationMs,
      apiThresholds.p95DurationWarnMs,
      apiThresholds.p95DurationCriticalMs,
      "medium"
    );
    if (severity) {
      checks.push(
        createAlertCheck({
          id: "api_p95_duration_24h",
          domain: "api",
          title: "API P95 延迟偏高",
          severity,
          currentValue: api.window24h.p95DurationMs,
          warnThreshold: apiThresholds.p95DurationWarnMs,
          criticalThreshold: apiThresholds.p95DurationCriticalMs,
          unit: "ms",
          sampleSize: api.window24h.requests,
          sampleLabel: "24h 请求",
          focusLabel: describeApiRoute(slowestApiRoute),
          recommendedAction: "优先排查最慢接口的数据库查询、串行 IO 与外部依赖超时。",
          message: `最近24h P95 延迟 ${toFixedMetric(api.window24h.p95DurationMs)}ms，高于阈值 ${apiThresholds.p95DurationWarnMs}ms`
        })
      );
    } else {
      checks.push(
        createHealthyCheck({
          id: "api_p95_duration_24h",
          domain: "api",
          title: "API P95 延迟",
          currentValue: api.window24h.p95DurationMs,
          warnThreshold: apiThresholds.p95DurationWarnMs,
          criticalThreshold: apiThresholds.p95DurationCriticalMs,
          unit: "ms",
          sampleSize: api.window24h.requests,
          sampleLabel: "24h 请求",
          focusLabel: describeApiRoute(slowestApiRoute),
          recommendedAction: "继续关注最慢接口即可。",
          message: `最近24h P95 延迟 ${toFixedMetric(api.window24h.p95DurationMs)}ms，处于阈值内`
        })
      );
    }
  }

  const s5xxCount24h = api.window24h.statusBuckets?.s5xx ?? api.statusBuckets.s5xx;
  if (api.window24h.requests < apiThresholds.minRequests24h) {
    checks.push(
      createInsufficientCheck({
        id: "api_s5xx_24h",
        domain: "api",
        title: "API 5xx 错误",
        currentValue: s5xxCount24h,
        warnThreshold: apiThresholds.s5xxWarnCount24h,
        criticalThreshold: apiThresholds.s5xxCriticalCount24h,
        unit: "count",
        sampleSize: api.window24h.requests,
        sampleLabel: "24h 请求",
        minimumSample: apiThresholds.minRequests24h,
        focusLabel: describeApiRoute(worstApiErrorRoute),
        recommendedAction: "样本补足后再判断；若已有 5xx 记录，先核对 recentErrors。"
      })
    );
  } else {
    const severity = compareAlertSeverity(
      s5xxCount24h,
      apiThresholds.s5xxWarnCount24h,
      apiThresholds.s5xxCriticalCount24h,
      "high"
    );
    if (severity) {
      checks.push(
        createAlertCheck({
          id: "api_s5xx_24h",
          domain: "api",
          title: "API 5xx 异常",
          severity,
          currentValue: s5xxCount24h,
          warnThreshold: apiThresholds.s5xxWarnCount24h,
          criticalThreshold: apiThresholds.s5xxCriticalCount24h,
          unit: "count",
          sampleSize: api.window24h.requests,
          sampleLabel: "24h 请求",
          focusLabel: describeApiRoute(worstApiErrorRoute),
          recommendedAction: "优先处理 5xx 根因，核对服务依赖、数据库连接与运行时异常日志。",
          message: `最近24h共产生 ${s5xxCount24h} 次 5xx，已超过阈值 ${apiThresholds.s5xxWarnCount24h}`
        })
      );
    } else {
      checks.push(
        createHealthyCheck({
          id: "api_s5xx_24h",
          domain: "api",
          title: "API 5xx 错误",
          currentValue: s5xxCount24h,
          warnThreshold: apiThresholds.s5xxWarnCount24h,
          criticalThreshold: apiThresholds.s5xxCriticalCount24h,
          unit: "count",
          sampleSize: api.window24h.requests,
          sampleLabel: "24h 请求",
          focusLabel: describeApiRoute(worstApiErrorRoute),
          recommendedAction: "继续保持 5xx 清零。",
          message: `最近24h 5xx 为 ${s5xxCount24h}，处于阈值内`
        })
      );
    }
  }

  if (ai.totalCalls < aiThresholds.minCalls) {
    checks.push(
      createInsufficientCheck({
        id: "ai_timeout_rate",
        domain: "ai",
        title: "AI 超时率",
        currentValue: ai.timeoutRate,
        warnThreshold: aiThresholds.timeoutRateWarn,
        criticalThreshold: aiThresholds.timeoutRateCritical,
        unit: "%",
        sampleSize: ai.totalCalls,
        sampleLabel: "最近 AI 调用",
        minimumSample: aiThresholds.minCalls,
        focusLabel: worstAiTimeoutRow?.key,
        recommendedAction: "补足调用样本后再判断，或直接检查 timeout 的 recentFailures。"
      })
    );
  } else {
    const severity = compareAlertSeverity(
      ai.timeoutRate,
      aiThresholds.timeoutRateWarn,
      aiThresholds.timeoutRateCritical,
      "medium"
    );
    if (severity) {
      checks.push(
        createAlertCheck({
          id: "ai_timeout_rate",
          domain: "ai",
          title: "AI 超时率偏高",
          severity,
          currentValue: ai.timeoutRate,
          warnThreshold: aiThresholds.timeoutRateWarn,
          criticalThreshold: aiThresholds.timeoutRateCritical,
          unit: "%",
          sampleSize: ai.totalCalls,
          sampleLabel: "最近 AI 调用",
          focusLabel: worstAiTimeoutRow?.key,
          recommendedAction: "检查 provider 超时配置、回退链顺序与外部模型稳定性。",
          message: `最近 AI 调用超时率 ${toFixedMetric(ai.timeoutRate)}%，高于阈值 ${aiThresholds.timeoutRateWarn}%`
        })
      );
    } else {
      checks.push(
        createHealthyCheck({
          id: "ai_timeout_rate",
          domain: "ai",
          title: "AI 超时率",
          currentValue: ai.timeoutRate,
          warnThreshold: aiThresholds.timeoutRateWarn,
          criticalThreshold: aiThresholds.timeoutRateCritical,
          unit: "%",
          sampleSize: ai.totalCalls,
          sampleLabel: "最近 AI 调用",
          focusLabel: worstAiTimeoutRow?.key,
          recommendedAction: "继续观察 provider timeout。",
          message: `最近 AI 调用超时率 ${toFixedMetric(ai.timeoutRate)}%，处于阈值内`
        })
      );
    }
  }

  if (ai.totalCalls < aiThresholds.minCalls) {
    checks.push(
      createInsufficientCheck({
        id: "ai_success_rate",
        domain: "ai",
        title: "AI 成功率",
        currentValue: ai.successRate,
        warnThreshold: aiThresholds.successRateWarn,
        criticalThreshold: aiThresholds.successRateCritical,
        unit: "%",
        sampleSize: ai.totalCalls,
        sampleLabel: "最近 AI 调用",
        minimumSample: aiThresholds.minCalls,
        focusLabel: worstAiSuccessRow?.key,
        recommendedAction: "补足调用样本后再判断。"
      })
    );
  } else {
    const severity = compareLowIsBadSeverity(
      ai.successRate,
      aiThresholds.successRateWarn,
      aiThresholds.successRateCritical,
      "high"
    );
    if (severity) {
      checks.push(
        createAlertCheck({
          id: "ai_success_rate",
          domain: "ai",
          title: "AI 成功率偏低",
          severity,
          currentValue: ai.successRate,
          warnThreshold: aiThresholds.successRateWarn,
          criticalThreshold: aiThresholds.successRateCritical,
          unit: "%",
          sampleSize: ai.totalCalls,
          sampleLabel: "最近 AI 调用",
          focusLabel: worstAiSuccessRow?.key,
          recommendedAction: "检查失败分布、policy 拦截比例与主备模型可用性。",
          message: `最近 AI 调用成功率 ${toFixedMetric(ai.successRate)}%，低于阈值 ${aiThresholds.successRateWarn}%`
        })
      );
    } else {
      checks.push(
        createHealthyCheck({
          id: "ai_success_rate",
          domain: "ai",
          title: "AI 成功率",
          currentValue: ai.successRate,
          warnThreshold: aiThresholds.successRateWarn,
          criticalThreshold: aiThresholds.successRateCritical,
          unit: "%",
          sampleSize: ai.totalCalls,
          sampleLabel: "最近 AI 调用",
          focusLabel: worstAiSuccessRow?.key,
          recommendedAction: "继续保持主备模型稳定性。",
          message: `最近 AI 调用成功率 ${toFixedMetric(ai.successRate)}%，处于阈值内`
        })
      );
    }
  }

  if (ai.totalCalls < aiThresholds.minCalls) {
    checks.push(
      createInsufficientCheck({
        id: "ai_budget_reject_rate",
        domain: "ai",
        title: "AI 预算拒绝率",
        currentValue: ai.budgetRejectRate,
        warnThreshold: aiThresholds.budgetRejectRateWarn,
        criticalThreshold: aiThresholds.budgetRejectRateCritical,
        unit: "%",
        sampleSize: ai.totalCalls,
        sampleLabel: "最近 AI 调用",
        minimumSample: aiThresholds.minCalls,
        focusLabel: worstAiBudgetRow?.key,
        recommendedAction: "补足调用样本后再判断，或先核对预算策略配置。"
      })
    );
  } else {
    const severity = compareAlertSeverity(
      ai.budgetRejectRate,
      aiThresholds.budgetRejectRateWarn,
      aiThresholds.budgetRejectRateCritical,
      "medium"
    );
    if (severity) {
      checks.push(
        createAlertCheck({
          id: "ai_budget_reject_rate",
          domain: "ai",
          title: "AI 预算拒绝率偏高",
          severity,
          currentValue: ai.budgetRejectRate,
          warnThreshold: aiThresholds.budgetRejectRateWarn,
          criticalThreshold: aiThresholds.budgetRejectRateCritical,
          unit: "%",
          sampleSize: ai.totalCalls,
          sampleLabel: "最近 AI 调用",
          focusLabel: worstAiBudgetRow?.key,
          recommendedAction: "复核任务预算上限，避免正常流量被策略过度拦截。",
          message: `最近 AI 调用预算拒绝率 ${toFixedMetric(ai.budgetRejectRate)}%，高于阈值 ${aiThresholds.budgetRejectRateWarn}%`
        })
      );
    } else {
      checks.push(
        createHealthyCheck({
          id: "ai_budget_reject_rate",
          domain: "ai",
          title: "AI 预算拒绝率",
          currentValue: ai.budgetRejectRate,
          warnThreshold: aiThresholds.budgetRejectRateWarn,
          criticalThreshold: aiThresholds.budgetRejectRateCritical,
          unit: "%",
          sampleSize: ai.totalCalls,
          sampleLabel: "最近 AI 调用",
          focusLabel: worstAiBudgetRow?.key,
          recommendedAction: "继续保持预算策略稳定。",
          message: `最近 AI 调用预算拒绝率 ${toFixedMetric(ai.budgetRejectRate)}%，处于阈值内`
        })
      );
    }
  }

  if (ai.totalCalls < aiThresholds.minCalls) {
    checks.push(
      createInsufficientCheck({
        id: "ai_quality_reject_rate",
        domain: "ai",
        title: "AI 质检拒绝率",
        currentValue: ai.qualityRejectRate,
        warnThreshold: aiThresholds.qualityRejectRateWarn,
        criticalThreshold: aiThresholds.qualityRejectRateCritical,
        unit: "%",
        sampleSize: ai.totalCalls,
        sampleLabel: "最近 AI 调用",
        minimumSample: aiThresholds.minCalls,
        focusLabel: worstAiQualityRow?.key,
        recommendedAction: "补足调用样本后再判断，或先核对质量阈值配置。"
      })
    );
  } else {
    const severity = compareAlertSeverity(
      ai.qualityRejectRate,
      aiThresholds.qualityRejectRateWarn,
      aiThresholds.qualityRejectRateCritical,
      "medium"
    );
    if (severity) {
      checks.push(
        createAlertCheck({
          id: "ai_quality_reject_rate",
          domain: "ai",
          title: "AI 质检拒绝率偏高",
          severity,
          currentValue: ai.qualityRejectRate,
          warnThreshold: aiThresholds.qualityRejectRateWarn,
          criticalThreshold: aiThresholds.qualityRejectRateCritical,
          unit: "%",
          sampleSize: ai.totalCalls,
          sampleLabel: "最近 AI 调用",
          focusLabel: worstAiQualityRow?.key,
          recommendedAction: "检查质量阈值是否过严，或评估模型输出是否真实退化。",
          message: `最近 AI 调用质检拒绝率 ${toFixedMetric(ai.qualityRejectRate)}%，高于阈值 ${aiThresholds.qualityRejectRateWarn}%`
        })
      );
    } else {
      checks.push(
        createHealthyCheck({
          id: "ai_quality_reject_rate",
          domain: "ai",
          title: "AI 质检拒绝率",
          currentValue: ai.qualityRejectRate,
          warnThreshold: aiThresholds.qualityRejectRateWarn,
          criticalThreshold: aiThresholds.qualityRejectRateCritical,
          unit: "%",
          sampleSize: ai.totalCalls,
          sampleLabel: "最近 AI 调用",
          focusLabel: worstAiQualityRow?.key,
          recommendedAction: "继续观察质量阈值命中趋势。",
          message: `最近 AI 调用质检拒绝率 ${toFixedMetric(ai.qualityRejectRate)}%，处于阈值内`
        })
      );
    }
  }

  const alerts = checks
    .filter((item): item is ObservabilityAlert => item.status === "alert" && Boolean(item.severity))
    .sort((a, b) => {
      const severityDiff = severityRank(b.severity) - severityRank(a.severity);
      if (severityDiff !== 0) return severityDiff;
      if (a.domain !== b.domain) return a.domain.localeCompare(b.domain);
      return a.id.localeCompare(b.id);
    });

  const criticalAlerts = alerts.filter((item) => item.severity === "critical").length;
  const highAlerts = alerts.filter((item) => item.severity === "high").length;
  const mediumAlerts = alerts.filter((item) => item.severity === "medium").length;
  const healthyChecks = checks.filter((item) => item.status === "healthy").length;
  const suppressedChecks = checks.filter((item) => item.status === "insufficient").length;

  return {
    generatedAt: new Date().toISOString(),
    overallStatus: criticalAlerts > 0 ? ("critical" as const) : alerts.length > 0 ? ("degraded" as const) : ("healthy" as const),
    summary: {
      totalChecks: checks.length,
      evaluatedChecks: checks.length - suppressedChecks,
      healthyChecks,
      suppressedChecks,
      openAlerts: alerts.length,
      criticalAlerts,
      highAlerts,
      mediumAlerts
    },
    thresholds: OBSERVABILITY_ALERT_THRESHOLDS,
    alerts,
    checks,
    signals: {
      api: {
        totalRequests: api.totalRequests,
        totalErrors: api.totalErrors,
        errorRate: api.errorRate,
        p95DurationMs: api.p95DurationMs,
        window24h: {
          requests: api.window24h.requests,
          errors: api.window24h.errors,
          errorRate: api.window24h.errorRate,
          p95DurationMs: api.window24h.p95DurationMs,
          statusBuckets: api.window24h.statusBuckets ?? null
        },
        statusBuckets: api.statusBuckets
      },
      ai: {
        totalCalls: ai.totalCalls,
        successCalls: ai.successCalls,
        successRate: ai.successRate,
        timeoutRate: ai.timeoutRate,
        budgetRejectRate: ai.budgetRejectRate,
        qualityRejectRate: ai.qualityRejectRate,
        avgLatencyMs: ai.avgLatencyMs,
        p95LatencyMs: ai.p95LatencyMs
      }
    }
  };
}

export async function getObservabilityAlertsSummary() {
  const [api, ai] = await Promise.all([getApiMetricsSummary(100), getAiCallMetricsSummary(100)]);
  return evaluateObservabilityAlerts({ api, ai });
}
