import crypto from "crypto";
import { NextResponse } from "next/server";
import { recordApiRequest } from "../observability";

const RESERVED_KEYS = new Set(["code", "message", "data", "requestId", "timestamp", "error"]);

type ApiEnvelopeBase = {
  code: number;
  message: string;
  requestId: string;
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

export function apiSuccess<T>(
  data: T,
  options: {
    status?: number;
    message?: string;
    request?: Request;
    requestId?: string;
    legacyRoot?: boolean;
  } = {}
) {
  const requestId = options.requestId ?? getRequestId(options.request);
  const payload: Record<string, unknown> = {
    code: 0,
    message: options.message ?? "ok",
    data,
    requestId,
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

  return NextResponse.json(payload as ApiSuccessEnvelope<T>, {
    status: options.status ?? 200,
    headers: { "x-request-id": requestId }
  });
}

export function apiError(
  status: number,
  message: string,
  options: {
    details?: unknown;
    request?: Request;
    requestId?: string;
  } = {}
) {
  const requestId = options.requestId ?? getRequestId(options.request);
  const payload: ApiErrorEnvelope = {
    code: status,
    message,
    error: message,
    data: null,
    requestId,
    timestamp: getTimestamp(),
    details: options.details
  };
  return NextResponse.json(payload, {
    status,
    headers: { "x-request-id": requestId }
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
  meta: { requestId: string }
) => Promise<Response | unknown>;

export function withApi<TParams extends Record<string, string> = Record<string, string>>(
  handler: RouteHandler<TParams>
) {
  return async (request: Request, context: RouteContext<TParams>) => {
    const requestId = getRequestId(request);
    const safeContext = context ?? ({ params: {} as TParams });
    const startedAt = Date.now();
    let status = 500;
    let path = "/";

    try {
      path = new URL(request.url).pathname;
    } catch {
      path = "/";
    }

    try {
      const result = await handler(request, safeContext, { requestId });
      if (result instanceof Response) {
        status = result.status;
        result.headers.set("x-request-id", requestId);
        return result;
      }
      status = 200;
      return apiSuccess(result, { requestId });
    } catch (error) {
      const apiErr = toApiError(error);
      status = apiErr.status;
      return apiError(apiErr.status, apiErr.message, {
        requestId,
        details: apiErr.details
      });
    } finally {
      try {
        await recordApiRequest({
          method: request.method || "GET",
          path,
          status,
          durationMs: Date.now() - startedAt
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
