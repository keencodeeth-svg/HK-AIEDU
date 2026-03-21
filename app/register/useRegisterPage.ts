"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { resolveRegisterFormError } from "@/lib/auth-form-errors";
import { requestJson } from "@/lib/client-request";
import type { RegisterPayload, RegisterResponse, RegisterRole } from "./types";

type RegisterFormState = {
  role: RegisterRole;
  name: string;
  email: string;
  password: string;
  grade: string;
  schoolCode: string;
  observerCode: string;
};

export function useRegisterPage() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState<RegisterFormState>({
    role: "student",
    name: "",
    email: "",
    password: "",
    grade: "4",
    schoolCode: "",
    observerCode: ""
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const setField = useCallback(<K extends keyof RegisterFormState>(field: K, value: RegisterFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  useEffect(() => {
    const nextRole = searchParams.get("role");
    if (nextRole === "student" || nextRole === "parent") {
      setField("role", nextRole);
    }
  }, [searchParams, setField]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setLoading(true);
      setError(null);
      setMessage(null);

      const normalizedName = form.name.trim();
      const normalizedEmail = form.email.trim();
      const payload: RegisterPayload =
        form.role === "student"
          ? {
              role: form.role,
              name: normalizedName,
              email: normalizedEmail,
              password: form.password,
              grade: form.grade,
              schoolCode: form.schoolCode.trim() || undefined
            }
          : {
              role: form.role,
              name: normalizedName,
              email: normalizedEmail,
              password: form.password,
              observerCode: form.observerCode.trim()
            };

      try {
        const response = await requestJson<RegisterResponse>("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        setMessage(response.message ?? "注册成功，请登录。");
        setForm((current) => ({
          ...current,
          name: "",
          email: "",
          password: "",
          schoolCode: "",
          observerCode: ""
        }));
      } catch (nextError) {
        setError(
          resolveRegisterFormError(nextError, {
            fallback: "注册失败",
            emailExistsMessage: "该邮箱已注册，可直接登录或前往账号恢复。",
            invalidSchoolCodeMessage: "学校编码无效，请核对后重试；不填则会归入默认学校。",
            observerCodeRequiredMessage: "家长注册必须填写学生资料页中的绑定码。",
            observerCodeInvalidMessage: "绑定码无效，请回到学生资料页重新获取后再试。",
            gradeRequiredMessage: "请选择学生年级。"
          })
        );
      } finally {
        setLoading(false);
      }
    },
    [form]
  );

  return {
    role: form.role,
    name: form.name,
    email: form.email,
    password: form.password,
    grade: form.grade,
    schoolCode: form.schoolCode,
    observerCode: form.observerCode,
    message,
    error,
    loading,
    setField,
    handleSubmit
  };
}
