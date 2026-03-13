export type SelfRegisterDecision = {
  accepted: boolean;
  allowBootstrap: boolean;
  requireInvite: boolean;
  error?: "invite code required" | "invalid invite code";
};

function parseBooleanEnv(value: string | undefined) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") return false;
  return null;
}

export function normalizeInviteCode(code?: string | null) {
  return (code ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase();
}

export function collectInviteCodes(codes: Array<string | undefined | null>) {
  return new Set(codes.map((item) => normalizeInviteCode(item)).filter(Boolean));
}

export function isInitialSelfRegisterEnabled(envValue: string | undefined) {
  return parseBooleanEnv(envValue) === true;
}

export function decideSelfRegisterAccess(input: {
  existingCount: number;
  inputInviteCode?: string | null;
  configuredInviteCodes: Array<string | undefined | null>;
  bootstrapEnabled: boolean;
}): SelfRegisterDecision {
  const allowedCodes = collectInviteCodes(input.configuredInviteCodes);
  const requireInvite = allowedCodes.size > 0;

  if (requireInvite) {
    const normalizedInput = normalizeInviteCode(input.inputInviteCode);
    if (!normalizedInput) {
      return {
        accepted: false,
        allowBootstrap: false,
        requireInvite: true,
        error: "invite code required"
      };
    }
    if (!allowedCodes.has(normalizedInput)) {
      return {
        accepted: false,
        allowBootstrap: false,
        requireInvite: true,
        error: "invalid invite code"
      };
    }
    return {
      accepted: true,
      allowBootstrap: false,
      requireInvite: true
    };
  }

  const allowBootstrap = input.bootstrapEnabled && input.existingCount === 0;
  if (allowBootstrap) {
    return {
      accepted: true,
      allowBootstrap: true,
      requireInvite: false
    };
  }

  return {
    accepted: false,
    allowBootstrap: false,
    requireInvite: false,
    error: "invite code required"
  };
}
