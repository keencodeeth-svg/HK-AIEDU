export type RequestError = Error & { status?: number; payload?: unknown };

type ErrorPayload = {
  error?: string;
  message?: string;
};

export async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errorPayload = (payload as ErrorPayload | null) ?? null;
    const error = new Error(errorPayload?.error ?? errorPayload?.message ?? "加载失败") as RequestError;
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload as T;
}

export function getRequestStatus(error: unknown) {
  if (error && typeof error === "object" && "status" in error && typeof error.status === "number") {
    return error.status;
  }
  return undefined;
}

export function getRequestErrorPayload<T = unknown>(error: unknown) {
  if (error && typeof error === "object" && "payload" in error) {
    return ((error as { payload?: T | null }).payload ?? null) as T | null;
  }
  return null;
}

export function isAuthError(error: unknown) {
  const status = getRequestStatus(error);
  return status === 401 || status === 403;
}

export function getRequestErrorMessage(error: unknown, fallback = "加载失败") {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export function formatLoadedTime(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
