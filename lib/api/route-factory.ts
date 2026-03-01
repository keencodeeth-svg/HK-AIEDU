import { getCurrentUser, type UserRole } from "@/lib/auth";
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
  return withApi<TParams>(async (request, context, meta) => {
    const cachePreset = config.cache ?? "private-realtime";
    const headers = buildRouteHeaders(config.domain, cachePreset);
    const roles = normalizeRoles(config.role);
    // Auth lookup is lazy: only execute when the route declares role constraints.
    const currentUser = roles.length ? await getCurrentUser() : null;

    if (roles.length) {
      if (!currentUser) {
        unauthorized();
      }
      if (!roles.includes(currentUser.role)) {
        forbidden();
      }
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
  });
}
