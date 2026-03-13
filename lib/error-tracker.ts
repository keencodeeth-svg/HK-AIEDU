import { getRequestContext } from "./request-context";

export type ErrorTrackingSource = "api" | "ai" | "client";
export type ErrorTrackingLevel = "error" | "warning";

type TrackingContext = {
  requestId?: string;
  traceId?: string;
  method?: string;
  path?: string;
  userId?: string;
  userRole?: string;
  apiDomain?: string;
  entityType?: string;
  entityId?: string;
  digest?: string;
  status?: number;
  tags?: Record<string, string | number | boolean | null | undefined>;
  details?: unknown;
};

type ReportTrackedErrorInput = TrackingContext & {
  source: ErrorTrackingSource;
  level?: ErrorTrackingLevel;
  error?: unknown;
  message?: string;
};

export type ReportTrackedErrorResult = {
  enabled: boolean;
  reported: boolean;
  traceId?: string;
  requestId?: string;
  statusCode?: number;
  reason?: string;
};

const MAX_STACK_LENGTH = 4000;
const MAX_MESSAGE_LENGTH = 400;
const MAX_STRING_LENGTH = 600;
const MAX_OBJECT_KEYS = 20;
const MAX_ARRAY_ITEMS = 12;

function truncate(value: string | undefined | null, maxLength: number) {
  if (!value) return undefined;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function getEnvironment() {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || "development";
}

function getTrackingEndpoint() {
  const value = process.env.ERROR_TRACKING_WEBHOOK_URL?.trim();
  return value ? value : null;
}

function getTrackingToken() {
  const value = process.env.ERROR_TRACKING_TOKEN?.trim();
  return value ? value : null;
}

export function getErrorTrackingStatus() {
  const endpoint = getTrackingEndpoint();
  return {
    enabled: Boolean(endpoint),
    mode: endpoint ? ("webhook" as const) : ("disabled" as const),
    app: process.env.ERROR_TRACKING_APP?.trim() || "hk-ai-edu",
    environment: getEnvironment(),
    endpointConfigured: Boolean(endpoint),
    fieldMap: {
      traceId: "traceId",
      requestId: "requestId",
      userRole: "user.role",
      userId: "user.id",
      path: "request.path",
      method: "request.method",
      apiDomain: "request.domain",
      entityType: "entity.type",
      entityId: "entity.id"
    }
  };
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: truncate(error.name || "Error", 120) ?? "Error",
      message: truncate(error.message || "unknown error", MAX_MESSAGE_LENGTH) ?? "unknown error",
      stack: truncate(error.stack, MAX_STACK_LENGTH)
    };
  }
  if (typeof error === "string") {
    return {
      name: "Error",
      message: truncate(error, MAX_MESSAGE_LENGTH) ?? "unknown error",
      stack: undefined
    };
  }
  return {
    name: "Error",
    message: "unknown error",
    stack: undefined
  };
}

function sanitizeUnknown(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) {
    return value ?? null;
  }
  if (typeof value === "string") {
    return truncate(value, MAX_STRING_LENGTH) ?? "";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Error) {
    return {
      name: truncate(value.name || "Error", 120) ?? "Error",
      message: truncate(value.message || "unknown error", MAX_MESSAGE_LENGTH) ?? "unknown error",
      stack: truncate(value.stack, MAX_STACK_LENGTH) ?? null
    };
  }
  if (depth >= 3) {
    return "[truncated]";
  }
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeUnknown(item, depth + 1));
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_OBJECT_KEYS);
    return Object.fromEntries(entries.map(([key, item]) => [key, sanitizeUnknown(item, depth + 1)]));
  }
  return String(value);
}

async function postTrackingPayload(payload: Record<string, unknown>) {
  const endpoint = getTrackingEndpoint();
  if (!endpoint) {
    return {
      enabled: false,
      reported: false,
      reason: "disabled"
    } satisfies ReportTrackedErrorResult;
  }

  try {
    const headers = new Headers({
      "content-type": "application/json"
    });
    const token = getTrackingToken();
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    return {
      enabled: true,
      reported: res.ok,
      statusCode: res.status,
      reason: res.ok ? undefined : `http_${res.status}`
    } satisfies ReportTrackedErrorResult;
  } catch {
    return {
      enabled: true,
      reported: false,
      reason: "network_error"
    } satisfies ReportTrackedErrorResult;
  }
}

export async function reportTrackedError(input: ReportTrackedErrorInput): Promise<ReportTrackedErrorResult> {
  const requestContext = getRequestContext();
  const errorMeta = normalizeError(input.error ?? input.message ?? "unknown error");
  const traceId = input.traceId?.trim() || requestContext?.traceId || undefined;
  const requestId = input.requestId?.trim() || requestContext?.requestId || undefined;
  const method = input.method?.trim() || requestContext?.method || undefined;
  const path = input.path?.trim() || requestContext?.pathname || undefined;
  const userId = input.userId?.trim() || requestContext?.userId || undefined;
  const userRole = input.userRole?.trim() || requestContext?.userRole || undefined;
  const apiDomain = input.apiDomain?.trim() || requestContext?.apiDomain || undefined;

  const payload = {
    app: getErrorTrackingStatus().app,
    environment: getEnvironment(),
    source: input.source,
    level: input.level ?? "error",
    occurredAt: new Date().toISOString(),
    error: {
      name: errorMeta.name,
      message: errorMeta.message,
      stack: errorMeta.stack ?? null
    },
    traceId: traceId ?? null,
    requestId: requestId ?? null,
    request: {
      method: method ?? null,
      path: path ?? null,
      domain: apiDomain ?? null,
      status: typeof input.status === "number" ? input.status : null
    },
    user: {
      id: userId ?? null,
      role: userRole ?? null
    },
    entity: {
      type: input.entityType?.trim() || null,
      id: input.entityId?.trim() || null
    },
    digest: input.digest?.trim() || null,
    tags: sanitizeUnknown(input.tags ?? {}) as Record<string, unknown>,
    details: sanitizeUnknown(input.details ?? null)
  };

  const result = await postTrackingPayload(payload);
  return {
    ...result,
    traceId,
    requestId
  };
}

export async function reportApiServerError(input: {
  error: unknown;
  requestId?: string;
  traceId?: string;
  method?: string;
  path?: string;
  status?: number;
  details?: unknown;
}) {
  return reportTrackedError({
    source: "api",
    level: "error",
    error: input.error,
    requestId: input.requestId,
    traceId: input.traceId,
    method: input.method,
    path: input.path,
    status: input.status,
    details: input.details
  });
}

export async function reportAiCallFailure(input: {
  taskType: string;
  provider: string;
  capability: "chat" | "vision";
  timeout: boolean;
  fallbackCount: number;
  latencyMs: number;
  requestChars: number;
  responseChars: number;
  errorMessage?: string;
  traceId?: string;
}) {
  return reportTrackedError({
    source: "ai",
    level: input.timeout ? "error" : "warning",
    message: input.errorMessage || "ai call failed",
    traceId: input.traceId,
    entityType: "ai_task",
    entityId: input.taskType,
    tags: {
      provider: input.provider,
      capability: input.capability,
      timeout: input.timeout,
      fallbackCount: input.fallbackCount
    },
    details: {
      taskType: input.taskType,
      provider: input.provider,
      capability: input.capability,
      timeout: input.timeout,
      fallbackCount: input.fallbackCount,
      latencyMs: input.latencyMs,
      requestChars: input.requestChars,
      responseChars: input.responseChars,
      errorMessage: input.errorMessage ?? ""
    }
  });
}

export async function reportClientRenderError(input: {
  component?: string;
  pathname?: string;
  message: string;
  stack?: string;
  digest?: string;
  requestId?: string;
  traceId?: string;
  userId?: string;
  userRole?: string;
}) {
  const error = new Error(input.message);
  error.name = "ClientRenderError";
  if (input.stack) {
    error.stack = input.stack;
  }

  return reportTrackedError({
    source: "client",
    level: "error",
    error,
    requestId: input.requestId,
    traceId: input.traceId,
    path: input.pathname,
    userId: input.userId,
    userRole: input.userRole,
    digest: input.digest,
    entityType: "ui_component",
    entityId: input.component,
    details: {
      component: input.component ?? "unknown",
      pathname: input.pathname ?? "",
      digest: input.digest ?? ""
    }
  });
}
