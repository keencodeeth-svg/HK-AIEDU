import crypto from "crypto";
import { cookies } from "next/headers";
import { ApiError, preconditionRequired, unauthorized } from "./api/http";
import { getSessionCookieName } from "./auth";

const ADMIN_STEP_UP_COOKIE = "mvp_admin_step_up";
const ADMIN_STEP_UP_SCOPE = "admin-high-risk";
const DEFAULT_STEP_UP_TTL_MINUTES = 10;
const MAX_STEP_UP_TTL_MINUTES = 60;

type AdminStepUpContext = {
  userId: string;
  sessionToken: string;
  now?: Date;
};

type AdminStepUpPayload = {
  scope: string;
  uid: string;
  sid: string;
  iat: number;
  exp: number;
};

type AdminStepUpVerification =
  | {
      valid: true;
      issuedAt: string;
      expiresAt: string;
    }
  | {
      valid: false;
      reason: string;
    };

function getAdminStepUpSecret() {
  const configured = process.env.ADMIN_STEP_UP_SECRET?.trim();
  if (configured) {
    return configured;
  }
  if (process.env.API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER === "true") {
    return "api-test-admin-step-up-secret";
  }
  if (process.env.NODE_ENV === "production") {
    throw new ApiError(503, "admin step-up unavailable");
  }
  return "dev-only-admin-step-up-secret";
}

function getAdminStepUpTtlMinutes() {
  const raw = Number(process.env.ADMIN_STEP_UP_TTL_MINUTES ?? DEFAULT_STEP_UP_TTL_MINUTES);
  if (!Number.isFinite(raw)) {
    return DEFAULT_STEP_UP_TTL_MINUTES;
  }
  return Math.min(MAX_STEP_UP_TTL_MINUTES, Math.max(1, Math.round(raw)));
}

function hashSessionToken(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function signPayload(encodedPayload: string) {
  return crypto.createHmac("sha256", getAdminStepUpSecret()).update(encodedPayload).digest("base64url");
}

function encodePayload(payload: AdminStepUpPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(value: string) {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as AdminStepUpPayload;
  } catch {
    return null;
  }
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getCurrentSessionToken() {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get(getSessionCookieName())?.value;
  if (!sessionToken) {
    unauthorized();
  }
  return sessionToken;
}

export function getAdminStepUpCookieName() {
  return ADMIN_STEP_UP_COOKIE;
}

export function createAdminStepUpToken(context: AdminStepUpContext) {
  const now = context.now ?? new Date();
  const issuedAtSeconds = Math.floor(now.getTime() / 1000);
  const expiresAtSeconds = issuedAtSeconds + getAdminStepUpTtlMinutes() * 60;
  const payload: AdminStepUpPayload = {
    scope: ADMIN_STEP_UP_SCOPE,
    uid: context.userId,
    sid: hashSessionToken(context.sessionToken),
    iat: issuedAtSeconds,
    exp: expiresAtSeconds
  };
  const encodedPayload = encodePayload(payload);
  const signature = signPayload(encodedPayload);
  return {
    token: `${encodedPayload}.${signature}`,
    issuedAt: new Date(issuedAtSeconds * 1000).toISOString(),
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString()
  };
}

export function verifyAdminStepUpToken(token: string | null | undefined, context: AdminStepUpContext): AdminStepUpVerification {
  if (!token) {
    return { valid: false, reason: "missing" };
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return { valid: false, reason: "malformed" };
  }

  const expectedSignature = signPayload(encodedPayload);
  if (!safeEqual(signature, expectedSignature)) {
    return { valid: false, reason: "signature" };
  }

  const payload = decodePayload(encodedPayload);
  if (!payload) {
    return { valid: false, reason: "payload" };
  }

  if (payload.scope !== ADMIN_STEP_UP_SCOPE) {
    return { valid: false, reason: "scope" };
  }
  if (payload.uid !== context.userId) {
    return { valid: false, reason: "user" };
  }
  if (payload.sid !== hashSessionToken(context.sessionToken)) {
    return { valid: false, reason: "session" };
  }

  const nowSeconds = Math.floor((context.now ?? new Date()).getTime() / 1000);
  if (payload.exp <= nowSeconds) {
    return { valid: false, reason: "expired" };
  }

  return {
    valid: true,
    issuedAt: new Date(payload.iat * 1000).toISOString(),
    expiresAt: new Date(payload.exp * 1000).toISOString()
  };
}

export function setAdminStepUpCookie(response: Response, token: string, expiresAt: string) {
  const nextResponse = response as Response & {
    cookies?: {
      set: (name: string, value: string, options: Record<string, unknown>) => void;
    };
  };
  if (!nextResponse.cookies?.set) {
    return;
  }

  const maxAge = Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)
  );

  nextResponse.cookies.set(ADMIN_STEP_UP_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    path: "/api/admin",
    secure: process.env.NODE_ENV === "production",
    maxAge
  });
}

export function clearAdminStepUpCookie(response: Response) {
  const nextResponse = response as Response & {
    cookies?: {
      set: (name: string, value: string, options: Record<string, unknown>) => void;
    };
  };
  if (!nextResponse.cookies?.set) {
    return;
  }

  nextResponse.cookies.set(ADMIN_STEP_UP_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    path: "/api/admin",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0
  });
}

export function issueAdminStepUp(response: Response, userId: string) {
  const sessionToken = getCurrentSessionToken();
  const grant = createAdminStepUpToken({
    userId,
    sessionToken
  });
  setAdminStepUpCookie(response, grant.token, grant.expiresAt);
  return grant;
}

export function assertAdminStepUp(user: { id: string; role?: string }) {
  if (user.role && user.role !== "admin") {
    unauthorized();
  }

  const cookieStore = cookies();
  const sessionToken = getCurrentSessionToken();
  const verification = verifyAdminStepUpToken(cookieStore.get(ADMIN_STEP_UP_COOKIE)?.value, {
    userId: user.id,
    sessionToken
  });

  if (!verification.valid) {
    preconditionRequired("admin step-up required", {
      stepUpRequired: true,
      reason: verification.reason
    });
  }

  return verification;
}
