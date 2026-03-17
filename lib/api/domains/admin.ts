import { getCurrentUser } from "@/lib/auth";
import { createDomainRoute, type DomainRouteConfig } from "./route";

const createAdminDomainRoute = createDomainRoute("admin");
type CurrentUser = Awaited<ReturnType<typeof getCurrentUser>>;

export function createAdminRoute<
  TParams extends Record<string, string> = Record<string, string>,
  TQuery = Record<string, never>,
  TBody = undefined,
  TUser extends CurrentUser = CurrentUser
>(config: DomainRouteConfig<TParams, TQuery, TBody, TUser>) {
  return createAdminDomainRoute<TParams, TQuery, TBody, TUser>({
    ...config,
    role: config.role ?? "admin"
  });
}
