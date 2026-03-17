import {
  formatLoadedTime,
  getRequestErrorMessage,
  getRequestErrorPayload,
  getRequestStatus
} from "@/lib/client-request";

type AuthFormErrorPayload = {
  error?: string;
  details?: {
    errors?: string[];
    retryAt?: string;
    maxAttempts?: number;
    windowMinutes?: number;
  };
};

function getErrorCode(error: unknown) {
  return getRequestErrorPayload<AuthFormErrorPayload>(error)?.error?.trim() ?? "";
}

function getPasswordPolicyMessage(error: unknown) {
  const details = getRequestErrorPayload<AuthFormErrorPayload>(error)?.details;
  return details?.errors?.find((item) => item.trim()) ?? "";
}

type RegisterErrorOptions = {
  fallback: string;
  emailExistsMessage?: string;
  invalidInviteMessage?: string;
  invalidSchoolCodeMessage?: string;
  observerCodeRequiredMessage?: string;
  observerCodeInvalidMessage?: string;
  gradeRequiredMessage?: string;
  schoolRequiredMessage?: string;
};

export function resolveRegisterFormError(error: unknown, options: RegisterErrorOptions) {
  const code = getErrorCode(error);
  const passwordPolicyMessage = getPasswordPolicyMessage(error);

  if (passwordPolicyMessage) {
    return passwordPolicyMessage;
  }

  if (code === "email exists") {
    return options.emailExistsMessage ?? "该邮箱已注册，可直接登录。";
  }

  if (code === "invite code required" || code === "invalid invite code") {
    return options.invalidInviteMessage ?? "邀请码无效，或当前不允许自助注册。";
  }

  if (code === "invalid school code" || code === "school code invalid") {
    return options.invalidSchoolCodeMessage ?? "学校编码无效，请核对后重试。";
  }

  if (code === "observerCode required") {
    return options.observerCodeRequiredMessage ?? "请输入学生资料页中的绑定码。";
  }

  if (code === "observer code invalid" || code === "student not found") {
    return options.observerCodeInvalidMessage ?? "绑定码无效，请回到学生资料页重新获取。";
  }

  if (code === "grade required") {
    return options.gradeRequiredMessage ?? "请选择学生年级。";
  }

  if (code === "school required") {
    return options.schoolRequiredMessage ?? "请填写学校名称，或输入一个有效的学校编码。";
  }

  return getRequestErrorMessage(error, options.fallback);
}

export function resolveRecoveryRequestError(error: unknown, fallback = "提交恢复请求失败") {
  const status = getRequestStatus(error) ?? 0;
  const code = getErrorCode(error);
  const payload = getRequestErrorPayload<AuthFormErrorPayload>(error);

  if (status === 429) {
    const retryAt = formatLoadedTime(payload?.details?.retryAt ?? null);
    return retryAt
      ? `恢复请求提交过于频繁，请在 ${retryAt} 后再试。`
      : "恢复请求提交过于频繁，请稍后再试。";
  }

  if (code === "email required") {
    return "请输入注册邮箱后再提交恢复请求。";
  }

  return getRequestErrorMessage(error, fallback);
}
