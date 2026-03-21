"use client";

import { useCallback, useState, type FormEvent } from "react";
import { resolveRecoveryRequestError } from "@/lib/auth-form-errors";
import { requestJson } from "@/lib/client-request";
import type { RecoveryIssueType, RecoveryResponse, RecoveryRole } from "./types";

type RecoverFormState = {
  role: RecoveryRole;
  issueType: RecoveryIssueType;
  email: string;
  name: string;
  studentEmail: string;
  schoolName: string;
  note: string;
};

export const recoveryRoleOptions = [
  { value: "student" as const, label: "学生", desc: "学习空间、作业、练习" },
  { value: "teacher" as const, label: "教师", desc: "作业发布、批改、分析" },
  { value: "parent" as const, label: "家长", desc: "周报、监督、回执" },
  { value: "admin" as const, label: "管理员", desc: "题库、知识点、系统" },
  { value: "school_admin" as const, label: "学校管理员", desc: "学校组织、班级、教师" }
];

export const recoveryIssueOptions = [
  { value: "forgot_password" as const, label: "忘记密码", desc: "记得账号但无法登录" },
  { value: "forgot_account" as const, label: "找回账号", desc: "不确定注册邮箱或身份" },
  { value: "account_locked" as const, label: "账号被锁定", desc: "登录失败次数过多" }
];

export function useRecoverPage() {
  const [form, setForm] = useState<RecoverFormState>({
    role: "student",
    issueType: "forgot_password",
    email: "",
    name: "",
    studentEmail: "",
    schoolName: "",
    note: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecoveryResponse["data"] | null>(null);
  const [resultMessage, setResultMessage] = useState("");

  const setField = useCallback(<K extends keyof RecoverFormState>(field: K, value: RecoverFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setLoading(true);
      setError(null);
      setResult(null);
      setResultMessage("");

      try {
        const payload = await requestJson<RecoveryResponse>("/api/auth/recovery-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: form.role,
            email: form.email.trim(),
            name: form.name.trim(),
            issueType: form.issueType,
            studentEmail: form.studentEmail.trim(),
            schoolName: form.schoolName.trim(),
            note: form.note.trim()
          })
        });
        setResult(payload.data ?? null);
        setResultMessage(payload.message ?? "恢复请求已提交");
      } catch (nextError) {
        setError(resolveRecoveryRequestError(nextError));
      } finally {
        setLoading(false);
      }
    },
    [form]
  );

  return {
    role: form.role,
    issueType: form.issueType,
    email: form.email,
    name: form.name,
    studentEmail: form.studentEmail,
    schoolName: form.schoolName,
    note: form.note,
    loading,
    error,
    result,
    resultMessage,
    setField,
    handleSubmit
  };
}
