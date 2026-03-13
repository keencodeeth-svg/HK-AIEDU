import { AsyncLocalStorage } from "async_hooks";

type RequestContext = {
  requestId: string;
  traceId: string;
  userId?: string;
  userRole?: string;
  apiDomain?: string;
  pathname?: string;
  method?: string;
};

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, callback: () => Promise<T> | T) {
  return storage.run(context, callback);
}

export function getRequestContext() {
  return storage.getStore() ?? null;
}

export function getRequestIdFromContext() {
  return getRequestContext()?.requestId;
}

export function getTraceIdFromContext() {
  return getRequestContext()?.traceId;
}

export function updateRequestContext(patch: Partial<RequestContext>) {
  const current = storage.getStore();
  if (!current) return;
  Object.assign(current, patch);
}
