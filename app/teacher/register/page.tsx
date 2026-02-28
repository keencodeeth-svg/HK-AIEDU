"use client";

import { useState } from "react";
import Card from "@/components/Card";

export default function TeacherRegisterPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/teacher-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password, inviteCode })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "注册失败");
      }
      window.location.assign("/teacher");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid auth-page" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>教师注册</h2>
          <div className="section-sub">开启AI教研与班级管理功能。</div>
        </div>
        <span className="chip">教师端</span>
      </div>
      <Card title="教师注册" tag="入驻">
        <form onSubmit={handleSubmit} className="auth-form">
          <label className="form-field">
            <div className="section-title">姓名</div>
            <input
              className="form-control"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="教师"
            />
          </label>
          <label className="form-field">
            <div className="section-title">邮箱</div>
            <input
              className="form-control"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teacher@demo.com"
            />
          </label>
          <label className="form-field">
            <div className="section-title">密码</div>
            <input
              className="form-control"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="默认建议至少 8 位，含大小写和数字"
            />
            <div className="form-note">
              实际规则由后端密码策略配置控制。
            </div>
          </label>
          <label className="form-field">
            <div className="section-title">邀请码</div>
            <input
              className="form-control"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              placeholder="例如 HK-TEACH-2026（不区分大小写）"
            />
            <div className="form-note">
              若后台配置了 TEACHER_INVITE_CODE(S)，则必须填写；支持多个邀请码。
            </div>
          </label>
          {error ? <div className="status-note error">{error}</div> : null}
          <button className="button primary" type="submit" disabled={loading}>
            {loading ? "提交中..." : "注册并登录"}
          </button>
        </form>
        <div className="auth-footnote">
          默认仅允许首位教师无需邀请码注册。配置了 TEACHER_INVITE_CODE(S) 后，必须提供邀请码。
        </div>
        <div className="pill-list" style={{ marginTop: 10 }}>
          <span className="pill">AI 组卷</span>
          <span className="pill">班级学情</span>
          <span className="pill">作业批改</span>
        </div>
      </Card>
    </div>
  );
}
