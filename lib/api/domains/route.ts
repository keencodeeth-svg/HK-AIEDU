import { createApiRoute, type ApiDomain, type RouteFactoryContext } from "@/lib/api/route-factory";
import type { ApiCachePreset } from "@/lib/api/cache";
import type { Validator } from "@/lib/api/validation";
import { getCurrentUser, type UserRole } from "@/lib/auth";

type CurrentUser = Awaited<ReturnType<typeof getCurrentUser>>;

export type DomainRouteConfig<
  TParams extends Record<string, string>,
  TQuery,
  TBody,
  TUser extends CurrentUser
> = {
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

export function createDomainRoute(domain: ApiDomain) {
  // Domain wrapper centralizes cache/security conventions and tags route ownership.
  return function <
    TParams extends Record<string, string> = Record<string, string>,
    TQuery = Record<string, never>,
    TBody = undefined,
    TUser extends CurrentUser = CurrentUser
  >(config: DomainRouteConfig<TParams, TQuery, TBody, TUser>) {
    return createApiRoute<TParams, TQuery, TBody, TUser>({
      ...config,
      domain
    });
  };
}
