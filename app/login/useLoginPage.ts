"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { trackEvent } from "@/lib/analytics-client";
import {
  getRequestErrorMessage,
  getRequestErrorPayload,
  getRequestStatus,
  requestJson
} from "@/lib/client-request";
import type { LoginErrorPayload, LoginRole, LoginSuccessPayload } from "./types";

type LoginFormState = {
  role: LoginRole;
  email: string;
  password: string;
};

export const loginRoleOptions = [
  { value: "student" as const, label: "学生", desc: "学习/练习/作业" },
  { value: "teacher" as const, label: "教师", desc: "作业发布/批改/分析" },
  { value: "parent" as const, label: "家长", desc: "周报/监督/提醒" },
  { value: "admin" as const, label: "管理员", desc: "题库/知识点/日志" },
  { value: "school_admin" as const, label: "学校管理员", desc: "学校组织/教师/班级" }
];

export const loginPlaceholderMap: Record<LoginRole, string> = {
  student: "student@demo.com",
  teacher: "teacher@demo.com",
  parent: "parent@demo.com",
  admin: "admin@demo.com",
  school_admin: "school-admin@demo.com"
};

function formatLockUntil(lockUntil?: string | null) {
  if (!lockUntil) return "";
  const value = new Date(lockUntil);
  if (Number.isNaN(value.getTime())) return lockUntil;
  return value.toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function resolveLoginErrorMessage(payload: LoginErrorPayload, status: number) {
  const lockUntil = formatLockUntil(payload.details?.lockUntil);
  if (status === 429) {
    return lockUntil
      ? `登录失败次数过多，账号已临时锁定至 ${lockUntil}。`
      : "登录失败次数过多，账号已临时锁定，请稍后再试。";
  }

  const remainingAttempts = payload.details?.remainingAttempts;
  if (typeof remainingAttempts === "number") {
    if (remainingAttempts <= 1) {
      return "邮箱或密码错误，再错 1 次账号将被临时锁定。";
    }
    return `邮箱或密码错误，还可再尝试 ${remainingAttempts} 次。`;
  }

  return payload.error ?? "登录失败";
}

function getLoginTarget(role: LoginRole) {
  if (role === "admin") {
    return "/admin";
  }
  if (role === "teacher") {
    return "/teacher";
  }
  if (role === "parent") {
    return "/parent";
  }
  if (role === "school_admin") {
    return "/school";
  }
  return "/student";
}

export function useLoginPage() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState<LoginFormState>({
    role: "student",
    email: "",
    password: ""
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const setField = useCallback(<K extends keyof LoginFormState>(field: K, value: LoginFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  useEffect(() => {
    trackEvent({
      eventName: "login_page_view",
      page: "/login",
      props: {
        entry: searchParams.get("entry") ?? "direct",
        preselectedRole: searchParams.get("role") ?? null
      }
    });
  }, [searchParams]);

  useEffect(() => {
    const nextRole = searchParams.get("role");
    if (
      nextRole === "student" ||
      nextRole === "teacher" ||
      nextRole === "parent" ||
      nextRole === "admin" ||
      nextRole === "school_admin"
    ) {
      setField("role", nextRole);
    }
  }, [searchParams, setField]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setLoading(true);
      setError(null);

      try {
        const normalizedEmail = form.email.trim();
        const payload = await requestJson<LoginSuccessPayload>("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: normalizedEmail,
            password: form.password,
            role: form.role
          })
        });

        trackEvent({
          eventName: "login_success",
          page: "/login",
          entityId: payload.role ?? form.role,
          props: {
            selectedRole: form.role,
            actualRole: payload.role ?? form.role
          }
        });

        window.location.assign(getLoginTarget(payload.role ?? form.role));
      } catch (nextError) {
        const payload = getRequestErrorPayload<LoginErrorPayload>(nextError);
        const status = getRequestStatus(nextError) ?? 0;

        trackEvent({
          eventName: "login_failed",
          page: "/login",
          entityId: form.role,
          props: {
            selectedRole: form.role,
            status,
            error: payload?.error ?? getRequestErrorMessage(nextError, "登录失败"),
            remainingAttempts: payload?.details?.remainingAttempts ?? null,
            lockUntil: payload?.details?.lockUntil ?? null
          }
        });

        setError(resolveLoginErrorMessage(payload ?? {}, status));
      } finally {
        setLoading(false);
      }
    },
    [form]
  );

  return {
    role: form.role,
    email: form.email,
    password: form.password,
    error,
    loading,
    setField,
    handleSubmit
  };
}
