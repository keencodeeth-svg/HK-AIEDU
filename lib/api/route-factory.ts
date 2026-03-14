import { getCurrentUser, getSessionCookieName, type UserRole } from "@/lib/auth";
import { updateRequestContext } from "@/lib/request-context";
import { buildCacheHeaders, type ApiCachePreset } from "./cache";
import { apiSuccess, forbidden, unauthorized, withApi } from "./http";
import { parseJson, parseParams, parseSearchParams, type Validator } from "./validation";

export type ApiDomain = "auth" | "learning" | "exam" | "ai" | "admin";

type CurrentUser = Awaited<ReturnType<typeof getCurrentUser>>;

type RouteFactoryMeta = {
  requestId: string;
  traceId: string;
};

export type RouteFactoryContext<
  TParams extends Record<string, string>,
  TQuery,
  TBody,
  TUser extends CurrentUser
> = {
  request: Request;
  params: TParams;
  query: TQuery;
  body: TBody;
  user: TUser;
  meta: RouteFactoryMeta;
};

type RouteFactoryConfig<
  TParams extends Record<string, string>,
  TQuery,
  TBody,
  TUser extends CurrentUser
> = {
  domain: ApiDomain;
  role?: UserRole | UserRole[];
  sameOrigin?: "auto" | "always" | "off";
  runtimeGuardrails?: "auto" | "off";
  params?: Validator<TParams>;
  query?: Validator<TQuery>;
  body?: Validator<TBody>;
  cache?: ApiCachePreset;
  legacyRoot?: boolean;
  handler: (ctx: RouteFactoryContext<TParams, TQuery, TBody, TUser>) => Promise<Response | unknown>;
};

function normalizeRoles(role: UserRole | UserRole[] | undefined) {
  if (!role) return [];
  return Array.isArray(role) ? role : [role];
}

function isSafeMethod(method: string | null | undefined) {
  const normalized = String(method ?? "GET").toUpperCase();
  return normalized === "GET" || normalized === "HEAD" || normalized === "OPTIONS";
}

function isSameOriginProtectionEnabled() {
  if (process.env.API_ENFORCE_SAME_ORIGIN === "false") return false;
  if (process.env.API_ENFORCE_SAME_ORIGIN === "true") return true;
  return true;
}

function hasSessionCookie(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return false;
  const sessionCookieName = getSessionCookieName();
  return cookieHeader
    .split(";")
    .some((entry) => entry.trim().startsWith(`${sessionCookieName}=`));
}

function normalizeOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (process.env.API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER === "true") {
      if (url.hostname === "127.0.0.1" || url.hostname === "[::1]") {
        url.hostname = "localhost";
      }
    }
    return url.origin;
  } catch {
    return null;
  }
}

function getPrimaryHeaderValue(value: string | null | undefined) {
  if (!value) return null;
  const primary = value
    .split(",")[0]
    ?.trim();
  return primary || null;
}

function normalizeForwardedProto(value: string | null | undefined) {
  const normalized = getPrimaryHeaderValue(value)?.toLowerCase() ?? null;
  if (normalized === "http" || normalized === "https") {
    return normalized;
  }
  return null;
}

function normalizeForwardedPort(value: string | null | undefined) {
  const normalized = getPrimaryHeaderValue(value);
  if (!normalized) return null;
  return /^\d+$/.test(normalized) ? normalized : null;
}

function buildExpectedOriginFromForwardedHeaders(request: Request) {
  const forwardedHost = getPrimaryHeaderValue(request.headers.get("x-forwarded-host"));
  const host = getPrimaryHeaderValue(request.headers.get("host"));
  const authority = forwardedHost ?? host;
  if (!authority) return null;

  const forwardedProto = normalizeForwardedProto(request.headers.get("x-forwarded-proto"));
  const forwardedPort = normalizeForwardedPort(request.headers.get("x-forwarded-port"));
  const fallbackOrigin = normalizeOrigin(request.url);
  const protocol = forwardedProto ?? fallbackOrigin?.split("://")[0] ?? null;
  if (!protocol) return null;

  if (authority.includes(":") || !forwardedPort) {
    return `${protocol}://${authority}`;
  }

  const isDefaultPort =
    (protocol === "http" && forwardedPort === "80") ||
    (protocol === "https" && forwardedPort === "443");

  return `${protocol}://${isDefaultPort ? authority : `${authority}:${forwardedPort}`}`;
}

function getRequestSourceOrigin(request: Request) {
  const originHeader = normalizeOrigin(request.headers.get("origin"));
  if (originHeader) return originHeader;
  const refererHeader = normalizeOrigin(request.headers.get("referer"));
  if (refererHeader) return refererHeader;
  if (process.env.API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER === "true") {
    return normalizeOrigin(request.headers.get("x-test-origin"));
  }
  return null;
}

function shouldEnforceSameOrigin(
  request: Request,
  domain: ApiDomain,
  sameOriginMode: "auto" | "always" | "off" | undefined
) {
  if (!isSameOriginProtectionEnabled()) return false;
  if (sameOriginMode === "off") return false;
  if (isSafeMethod(request.method)) return false;
  if (sameOriginMode === "always") return true;
  return domain !== "auth" && hasSessionCookie(request);
}

function enforceSameOrigin(request: Request) {
  const expectedOrigin = buildExpectedOriginFromForwardedHeaders(request) ?? normalizeOrigin(request.url);
  const sourceOrigin = getRequestSourceOrigin(request);
  if (!expectedOrigin || !sourceOrigin || sourceOrigin !== expectedOrigin) {
    forbidden("same-origin request required");
  }
}

function buildRouteHeaders(domain: ApiDomain, cachePreset: ApiCachePreset) {
  const headers = new Headers(buildCacheHeaders(cachePreset));
  headers.set("x-api-domain", domain);
  return headers;
}

export function createApiRoute<
  TParams extends Record<string, string> = Record<string, string>,
  TQuery = Record<string, never>,
  TBody = undefined,
  TUser extends CurrentUser = CurrentUser
  >(config: RouteFactoryConfig<TParams, TQuery, TBody, TUser>) {
  return withApi<TParams>(
    async (request, context, meta) => {
      const cachePreset = config.cache ?? "private-realtime";
      const headers = buildRouteHeaders(config.domain, cachePreset);
      const roles = normalizeRoles(config.role);
      const pathname = (() => {
        try {
          return new URL(request.url).pathname;
        } catch {
          return "/";
        }
      })();
      // Auth lookup is lazy: only execute when the route declares role constraints.
      const currentUser = roles.length ? await getCurrentUser() : null;

      updateRequestContext({
        userId: currentUser?.id,
        userRole: currentUser?.role,
        apiDomain: config.domain,
        pathname,
        method: (request.method || "GET").toUpperCase()
      });

      if (roles.length) {
        if (!currentUser) {
          unauthorized();
        }
        if (!roles.includes(currentUser.role)) {
          forbidden();
        }
      }

      if (shouldEnforceSameOrigin(request, config.domain, config.sameOrigin)) {
        enforceSameOrigin(request);
      }

      const params = config.params
        ? parseParams(context.params as Record<string, string | undefined>, config.params)
        : ((context.params ?? {}) as TParams);
      const query = config.query ? parseSearchParams(request, config.query) : ({} as TQuery);
      const body = config.body ? await parseJson(request, config.body) : (undefined as TBody);

      const result = await config.handler({
        request,
        params,
        query,
        body,
        user: currentUser as TUser,
        meta
      });

      if (result instanceof Response) {
        // Preserve raw Response behavior while enforcing unified domain/cache headers.
        headers.forEach((value, key) => {
          result.headers.set(key, value);
        });
        return result;
      }
      // Non-Response payloads are wrapped into normalized API envelope.
      const response = apiSuccess(result, {
        requestId: meta.requestId,
        traceId: meta.traceId,
        legacyRoot: config.legacyRoot
      });
      headers.forEach((value, key) => {
        response.headers.set(key, value);
      });
      return response;
    },
    {
      runtimeGuardrails: config.runtimeGuardrails ?? "auto"
    }
  );
}
