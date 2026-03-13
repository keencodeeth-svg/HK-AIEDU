import { getCurrentUser } from "@/lib/auth";
import { createDomainRoute, type DomainRouteConfig } from "./route";

const createAuthDomainRoute = createDomainRoute("auth");
type CurrentUser = Awaited<ReturnType<typeof getCurrentUser>>;

export function createAuthRoute<
  TParams extends Record<string, string> = Record<string, string>,
  TQuery = Record<string, never>,
  TBody = undefined,
  TUser extends CurrentUser = CurrentUser
>(config: DomainRouteConfig<TParams, TQuery, TBody, TUser>) {
  return createAuthDomainRoute<TParams, TQuery, TBody, TUser>({
    ...config,
    sameOrigin: config.sameOrigin ?? "always"
  });
}
