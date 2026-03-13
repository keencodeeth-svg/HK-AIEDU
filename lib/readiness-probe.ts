import crypto from "crypto";
import { getCurrentUser } from "./auth";
import { unauthorized } from "./api/http";

export const READINESS_PROBE_HEADER = "x-readiness-token";

function isApiTestRuntime() {
  return process.env.NODE_ENV === "test" || process.env.API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER === "true";
}

function isBypassEnabled() {
  return process.env.NODE_ENV !== "production" || isApiTestRuntime();
}

function hasValidReadinessToken(request: Request) {
  const expected = process.env.READINESS_PROBE_TOKEN?.trim();
  const provided = request.headers.get(READINESS_PROBE_HEADER)?.trim();

  if (!expected || !provided) return false;

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function assertReadinessProbeAccess(request: Request) {
  if (isBypassEnabled()) {
    return { mode: "bypass" as const };
  }

  if (hasValidReadinessToken(request)) {
    return { mode: "token" as const };
  }

  let user = null;
  try {
    user = await getCurrentUser();
  } catch {
    user = null;
  }
  if (user?.role === "admin") {
    return {
      mode: "admin" as const,
      userId: user.id
    };
  }

  unauthorized("readiness authorization required");
}
