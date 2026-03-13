import crypto from "crypto";
import { NextResponse } from "next/server";
import { reportApiServerError } from "../error-tracker";
import { recordApiRequest } from "../observability";
import { runWithRequestContext } from "../request-context";
import { getRuntimeGuardrailIssues, logRuntimeGuardrailIssues } from "../runtime-guardrails";

const RESERVED_KEYS = new Set(["code", "message", "data", "requestId", "traceId", "timestamp", "error"]);

type ApiEnvelopeBase = {
  code: number;
  message: string;
  requestId: string;
  traceId: string;
  timestamp: string;
};

type ApiSuccessEnvelope<T> = ApiEnvelopeBase & {
  code: 0;
  data: T;
};

type ApiErrorEnvelope = ApiEnvelopeBase & {
  error: string;
  data: null;
  details?: unknown;
};

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function getTimestamp() {
  return new Date().toISOString();
}

export function getRequestId(request?: Request) {
  const headerId = request?.headers.get("x-request-id")?.trim();
  if (headerId) return headerId;
  return crypto.randomUUID();
}

export function getTraceId(request?: Request, fallbackRequestId?: string) {
  const headerId = request?.headers.get("x-trace-id")?.trim();
  if (headerId) return headerId;
  return fallbackRequestId ?? getRequestId(request);
}

export function apiSuccess<T>(
  data: T,
  options: {
    status?: number;
    message?: string;
    request?: Request;
    requestId?: string;
    traceId?: string;
    legacyRoot?: boolean;
    headers?: HeadersInit;
  } = {}
) {
  const requestId = options.requestId ?? getRequestId(options.request);
  const traceId = options.traceId ?? getTraceId(options.request, requestId);
  const payload: Record<string, unknown> = {
    code: 0,
    message: options.message ?? "ok",
    data,
    requestId,
    traceId,
    timestamp: getTimestamp()
  };

  if (options.legacyRoot !== false && data && typeof data === "object" && !Array.isArray(data)) {
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (key === "data") {
        payload.data = value;
        continue;
      }
      if (key === "message") {
        if (options.message === undefined && typeof value === "string" && value.trim()) {
          payload.message = value;
        }
        continue;
      }
      if (!RESERVED_KEYS.has(key)) {
        payload[key] = value;
      }
    }
  }

  const headers = new Headers(options.headers);
  headers.set("x-request-id", requestId);
  headers.set("x-trace-id", traceId);

  return NextResponse.json(payload as ApiSuccessEnvelope<T>, {
    status: options.status ?? 200,
    headers
  });
}

export function apiError(
  status: number,
  message: string,
  options: {
    details?: unknown;
    request?: Request;
    requestId?: string;
    traceId?: string;
    headers?: HeadersInit;
  } = {}
) {
  const requestId = options.requestId ?? getRequestId(options.request);
  const traceId = options.traceId ?? getTraceId(options.request, requestId);
  const payload: ApiErrorEnvelope = {
    code: status,
    message,
    error: message,
    data: null,
    requestId,
    traceId,
    timestamp: getTimestamp(),
    details: options.details
  };
  const headers = new Headers(options.headers);
  headers.set("x-request-id", requestId);
  headers.set("x-trace-id", traceId);
  return NextResponse.json(payload, {
    status,
    headers
  });
}

function toApiError(error: unknown) {
  if (error instanceof ApiError) return error;
  if (error instanceof SyntaxError) return new ApiError(400, "invalid json body");
  return new ApiError(500, "internal server error");
}

type RouteContext<TParams extends Record<string, string> = Record<string, string>> = {
  params: TParams;
};

type RouteHandler<TParams extends Record<string, string> = Record<string, string>> = (
  request: Request,
  context: RouteContext<TParams>,
  meta: { requestId: string; traceId: string }
) => Promise<Response | unknown>;

export function withApi<TParams extends Record<string, string> = Record<string, string>>(
  handler: RouteHandler<TParams>,
  options: {
    runtimeGuardrails?: "auto" | "off";
  } = {}
) {
  return async (request: Request, context: RouteContext<TParams>) => {
    const requestId = getRequestId(request);
    const traceId = getTraceId(request, requestId);
    const safeContext = context ?? ({ params: {} as TParams });
    const startedAt = Date.now();
    let status = 500;
    let path = "/";

    try {
      path = new URL(request.url).pathname;
    } catch {
      path = "/";
    }

    const runtimeIssues = options.runtimeGuardrails === "off" ? [] : getRuntimeGuardrailIssues();
    if (runtimeIssues.length) {
      logRuntimeGuardrailIssues(runtimeIssues);
      status = 503;
      return apiError(503, "service temporarily unavailable", {
        requestId,
        traceId
      });
    }

    try {
      const result = await runWithRequestContext({ requestId, traceId }, () =>
        handler(request, safeContext, { requestId, traceId })
      );
      if (result instanceof Response) {
        status = result.status;
        if (status >= 500) {
          void reportApiServerError({
            error: new Error(`route returned ${status}`),
            requestId,
            traceId,
            method: request.method || "GET",
            path,
            status
          });
        }
        result.headers.set("x-request-id", requestId);
        result.headers.set("x-trace-id", traceId);
        return result;
      }
      status = 200;
      return apiSuccess(result, { requestId, traceId });
    } catch (error) {
      const apiErr = toApiError(error);
      status = apiErr.status;
      if (status >= 500) {
        void reportApiServerError({
          error,
          requestId,
          traceId,
          method: request.method || "GET",
          path,
          status,
          details: apiErr.details
        });
      }
      return apiError(apiErr.status, apiErr.message, {
        requestId,
        traceId,
        details: apiErr.details
      });
    } finally {
      try {
        await recordApiRequest({
          method: request.method || "GET",
          path,
          status,
          durationMs: Date.now() - startedAt,
          traceId
        });
      } catch {
        // observability must never block business response
      }
    }
  };
}

export function badRequest(message: string, details?: unknown): never {
  throw new ApiError(400, message, details);
}

export function unauthorized(message = "unauthorized", details?: unknown): never {
  throw new ApiError(401, message, details);
}

export function forbidden(message = "forbidden", details?: unknown): never {
  throw new ApiError(403, message, details);
}

export function notFound(message = "not found", details?: unknown): never {
  throw new ApiError(404, message, details);
}

export function conflict(message = "conflict", details?: unknown): never {
  throw new ApiError(409, message, details);
}

export function preconditionRequired(message = "precondition required", details?: unknown): never {
  throw new ApiError(428, message, details);
}
