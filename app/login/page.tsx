"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import { trackEvent } from "@/lib/analytics-client";

type LoginRole = "student" | "teacher" | "parent" | "admin" | "school_admin";

type LoginErrorPayload = {
  error?: string;
  details?: {
    remainingAttempts?: number;
    failedCount?: number;
    maxFailedAttempts?: number;
    lockUntil?: string | null;
  };
  role?: LoginRole;
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

export default function LoginPage() {
  const [role, setRole] = useState<LoginRole>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const roleOptions = [
    { value: "student" as const, label: "学生", desc: "学习/练习/作业" },
    { value: "teacher" as const, label: "教师", desc: "作业发布/批改/分析" },
    { value: "parent" as const, label: "家长", desc: "周报/监督/提醒" },
    { value: "admin" as const, label: "管理员", desc: "题库/知识点/日志" },
    { value: "school_admin" as const, label: "学校管理员", desc: "学校组织/教师/班级" }
  ];

  const placeholderMap: Record<LoginRole, string> = {
    student: "student@demo.com",
    teacher: "teacher@demo.com",
    parent: "parent@demo.com",
    admin: "admin@demo.com",
    school_admin: "school-admin@demo.com"
  };

  useEffect(() => {
    trackEvent({
      eventName: "login_page_view",
      page: "/login",
      props: { entry: "direct" }
    });
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role })
      });
      const data = (await res.json()) as LoginErrorPayload;
      if (!res.ok) {
        trackEvent({
          eventName: "login_failed",
          page: "/login",
          entityId: role,
          props: {
            selectedRole: role,
            status: res.status,
            error: data?.error ?? "登录失败",
            remainingAttempts: data?.details?.remainingAttempts ?? null,
            lockUntil: data?.details?.lockUntil ?? null
          }
        });
        throw new Error(resolveLoginErrorMessage(data, res.status));
      }

      trackEvent({
        eventName: "login_success",
        page: "/login",
        entityId: data.role ?? role,
        props: {
          selectedRole: role,
          actualRole: data.role ?? role
        }
      });

      const target =
        data.role === "admin"
          ? "/admin"
          : data.role === "teacher"
            ? "/teacher"
            : data.role === "parent"
              ? "/parent"
              : data.role === "school_admin"
                ? "/school"
                : "/student";
      window.location.assign(target);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid auth-page" style={{ gap: 18, maxWidth: 520 }}>
      <div className="section-head">
        <div>
          <h2>登录航科AI教育</h2>
          <div className="section-sub">进入学生、教师、家长与管理端的学习空间。</div>
        </div>
        <span className="chip">账号中心</span>
      </div>
      <Card title="登录" tag="入口">
        <form onSubmit={handleSubmit} className="auth-form">
          <div>
            <div className="section-title">选择身份</div>
            <div className="role-grid">
              {roleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`role-card${role === option.value ? " active" : ""}`}
                  onClick={() => setRole(option.value)}
                >
                  <div className="role-title">{option.label}</div>
                  <div className="role-desc">{option.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <label className="form-field">
            <div className="section-title">邮箱</div>
            <input
              className="form-control"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={placeholderMap[role]}
            />
          </label>
          <label className="form-field">
            <div className="section-title">密码</div>
            <input
              className="form-control"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Student123"
            />
          </label>
          {error ? <div className="status-note error">{error}</div> : null}
          <button className="button primary" type="submit" disabled={loading}>
            {loading ? "登录中..." : "登录"}
          </button>
        </form>
        <div className="auth-footnote">
          演示账号：student@demo.com / Student123（可切换身份后登录）
        </div>
        <div className="pill-list" style={{ marginTop: 12 }}>
          <span className="pill">学生注册</span>
          <span className="pill">家长注册</span>
          <span className="pill">教师注册</span>
          <span className="pill">管理员注册</span>
          <span className="pill">学校管理员注册</span>
        </div>
        <div className="auth-links">
          <div>
            没有账号？<Link href="/register">去注册</Link>
          </div>
          <div>
            教师注册：<Link href="/teacher/register">去注册</Link>
          </div>
          <div>
            管理员注册：<Link href="/admin/register">去注册</Link>
          </div>
          <div>
            学校管理员注册：<Link href="/school/register">去注册</Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
