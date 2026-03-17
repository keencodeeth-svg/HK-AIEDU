"use client";

import Link from "next/link";
import { useState } from "react";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import PasswordPolicyHint from "@/components/auth/PasswordPolicyHint";
import { resolveRecoveryRequestError } from "@/lib/auth-form-errors";
import { formatLoadedTime, requestJson } from "@/lib/client-request";

const roleOptions = [
  { value: "student" as const, label: "学生", desc: "学习空间、作业、练习" },
  { value: "teacher" as const, label: "教师", desc: "作业发布、批改、分析" },
  { value: "parent" as const, label: "家长", desc: "周报、监督、回执" },
  { value: "admin" as const, label: "管理员", desc: "题库、知识点、系统" },
  { value: "school_admin" as const, label: "学校管理员", desc: "学校组织、班级、教师" }
];

const issueOptions = [
  { value: "forgot_password" as const, label: "忘记密码", desc: "记得账号但无法登录" },
  { value: "forgot_account" as const, label: "找回账号", desc: "不确定注册邮箱或身份" },
  { value: "account_locked" as const, label: "账号被锁定", desc: "登录失败次数过多" }
];

type RecoveryRole = (typeof roleOptions)[number]["value"];
type RecoveryIssueType = (typeof issueOptions)[number]["value"];

type RecoveryResponse = {
  message?: string;
  data?: {
    ticketId?: string;
    submittedAt?: string;
    duplicate?: boolean;
    serviceLevel?: string;
    nextSteps?: string[];
  };
};

export default function RecoverPage() {
  const [role, setRole] = useState<RecoveryRole>("student");
  const [issueType, setIssueType] = useState<RecoveryIssueType>("forgot_password");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecoveryResponse["data"] | null>(null);
  const [resultMessage, setResultMessage] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setResultMessage("");

    try {
      const normalizedEmail = email.trim();
      const payload = await requestJson<RecoveryResponse>("/api/auth/recovery-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          email: normalizedEmail,
          name: name.trim(),
          issueType,
          studentEmail: studentEmail.trim(),
          schoolName: schoolName.trim(),
          note: note.trim()
        })
      });
      setResult(payload.data ?? null);
      setResultMessage(payload.message ?? "恢复请求已提交");
    } catch (nextError) {
      setError(resolveRecoveryRequestError(nextError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid auth-page" style={{ gap: 18, maxWidth: 620 }}>
      <div className="section-head">
        <div>
          <h2>账号恢复</h2>
          <div className="section-sub">当你忘记密码、忘记账号或账号被临时锁定时，可在这里提交恢复请求。</div>
        </div>
        <span className="chip">恢复中心</span>
      </div>

      {result ? (
        <StatePanel
          title="恢复请求已受理"
          description={resultMessage}
          tone="success"
          action={
            <Link className="button secondary" href="/login">
              返回登录
            </Link>
          }
        >
          <div className="grid" style={{ gap: 8 }}>
            <div style={{ fontSize: 13, color: "var(--ink-1)" }}>请求编号：{result.ticketId ?? "--"}</div>
            <div style={{ fontSize: 13, color: "var(--ink-1)" }}>
              提交时间：{formatLoadedTime(result.submittedAt ?? null)}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-1)" }}>服务时效：{result.serviceLevel ?? "1 个工作日内处理"}</div>
            {result.nextSteps?.length ? (
              <ul style={{ margin: "4px 0 0 18px", color: "var(--ink-1)" }}>
                {result.nextSteps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </StatePanel>
      ) : null}

      <Card title="提交恢复请求" tag="安全流程">
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
            <div className="section-title">问题类型</div>
            <select className="form-control" value={issueType} onChange={(event) => setIssueType(event.target.value as RecoveryIssueType)} disabled={loading}>
              {issueOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label} · {item.desc}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <div className="section-title">注册邮箱</div>
            <input className="form-control" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="请输入注册时使用的邮箱" required />
          </label>

          <label className="form-field">
            <div className="section-title">姓名（建议填写）</div>
            <input className="form-control" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="方便管理员快速核对" disabled={loading} />
          </label>

          {role === "parent" ? (
            <label className="form-field">
              <div className="section-title">绑定学生邮箱（可选）</div>
              <input className="form-control" type="email" inputMode="email" autoCapitalize="none" value={studentEmail} onChange={(event) => setStudentEmail(event.target.value)} placeholder="若记得可填写，便于加快处理" disabled={loading} />
            </label>
          ) : null}

          {role === "teacher" || role === "school_admin" ? (
            <label className="form-field">
              <div className="section-title">学校名称（可选）</div>
              <input className="form-control" autoComplete="organization" value={schoolName} onChange={(event) => setSchoolName(event.target.value)} placeholder="例如：航科实验学校" disabled={loading} />
            </label>
          ) : null}

          <label className="form-field">
            <div className="section-title">补充说明（可选）</div>
            <textarea className="form-control" rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：登录被锁定、换了设备、忘记使用哪个邮箱注册等" disabled={loading} />
          </label>

          <PasswordPolicyHint />
          {error ? <div className="status-note error">{error}</div> : null}

          <button className="button primary" type="submit" disabled={loading || !email.trim()}>
            {loading ? "提交中..." : "提交恢复请求"}
          </button>
        </form>

        <div className="auth-links">
          <div>
            想直接登录？<Link href="/login">返回登录</Link>
          </div>
          <div>
            还没有账号？<Link href="/register">去注册</Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
